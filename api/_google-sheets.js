// Minimal Google Sheets client for the Worker: a service-account token signed
// with WebCrypto (no SDK), one read and one batchUpdate per tab, and the
// reconcile plan that turns "rows the database says exist" into the fewest
// cell writes. Setup: docs/GOOGLE-SHEETS-SETUP.md.

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets';
const SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
const TIMEOUT_MS = 10000;

let cachedToken = null; // { token, exp, email }
let pendingToken = null; // shared by the parallel reads of one run

// GOOGLE_SERVICE_ACCOUNT_JSON is the key file Google downloads, pasted as is.
// Base64 of it is accepted too, since dashboards sometimes mangle newlines.
export function readServiceAccount() {
  const raw = String(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '').trim();
  if (!raw) return null;
  let text = raw;
  if (!raw.startsWith('{')) {
    try { text = Buffer.from(raw, 'base64').toString('utf8'); } catch { return null; }
  }
  try {
    const sa = JSON.parse(text);
    return sa.client_email && sa.private_key ? sa : null;
  } catch {
    return null;
  }
}

export const isSheetsConfigured = () => Boolean(readServiceAccount());

const b64url = (bytes) => Buffer.from(bytes).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');

function pemToDer(pem) {
  const body = String(pem).replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  return Buffer.from(body, 'base64');
}

async function signJwt(sa, nowSec) {
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(JSON.stringify({
    iss: sa.client_email, scope: SCOPE, aud: TOKEN_URL, iat: nowSec, exp: nowSec + 3600,
  }));
  const input = `${header}.${claims}`;
  const key = await crypto.subtle.importKey(
    'pkcs8', pemToDer(sa.private_key), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(input));
  return `${input}.${b64url(new Uint8Array(sig))}`;
}

function getAccessToken() {
  const sa = readServiceAccount();
  if (!sa) return Promise.reject(new Error('GOOGLE_SERVICE_ACCOUNT_JSON is missing or not a service-account key.'));
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.email === sa.client_email && cachedToken.exp - 120 > now) return Promise.resolve(cachedToken.token);
  if (!pendingToken) pendingToken = fetchAccessToken(sa, now).finally(() => { pendingToken = null; });
  return pendingToken;
}

async function fetchAccessToken(sa, now) {
  const assertion = await signJwt(sa, now);
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }).toString(),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) throw new Error(`Google token error ${res.status}: ${data.error_description || data.error || 'no token'}`);
  cachedToken = { token: data.access_token, exp: now + Number(data.expires_in || 3600), email: sa.client_email };
  return cachedToken.token;
}

async function sheetsFetch(path, { method = 'GET', body } = {}) {
  const token = await getAccessToken();
  const res = await fetch(`${SHEETS_API}/${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const hint = res.status === 403 || res.status === 404
      ? ' (is the sheet shared with the service account as Editor?)' : '';
    throw new Error(`Google Sheets ${res.status}: ${data?.error?.message || 'request failed'}${hint}`);
  }
  return data;
}

// Raw values (numbers stay numbers, dates come back as serial numbers) so the
// plan can compare them with what the database says.
export async function readTab(spreadsheetId, tab, lastColumn) {
  const range = encodeURIComponent(`'${tab.replace(/'/g, "''")}'!A1:${lastColumn}`);
  const data = await sheetsFetch(`${spreadsheetId}/values/${range}?valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=SERIAL_NUMBER`);
  return Array.isArray(data.values) ? data.values : [];
}

export async function getSheetId(spreadsheetId, tab) {
  const data = await sheetsFetch(`${spreadsheetId}?fields=sheets.properties`);
  const sheet = (data.sheets || []).find((s) => s?.properties?.title === tab);
  if (!sheet) throw new Error(`Tab "${tab}" not found in spreadsheet ${spreadsheetId}.`);
  return sheet.properties.sheetId;
}

export async function batchUpdate(spreadsheetId, requests) {
  if (!requests.length) return null;
  return sheetsFetch(`${spreadsheetId}:batchUpdate`, { method: 'POST', body: { requests } });
}

// Dates go in as serial numbers in IST (the sheet's columns carry the date
// format), so the sheet can sort, filter and sum by them.
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
export function toSheetDate(value) {
  const ms = Date.parse(value || '');
  if (!Number.isFinite(ms)) return '';
  const seconds = Math.round((ms + IST_OFFSET_MS) / 1000);
  return seconds / 86400 + 25569;
}

// Strings are sent as stringValue, which Sheets stores as literal text: a name
// like "=IMPORTXML(…)" can never run as a formula, and phone numbers and
// pincodes keep their digits.
function cell(value) {
  if (value === undefined || value === null || value === '') return {};
  if (typeof value === 'number' && Number.isFinite(value)) return { userEnteredValue: { numberValue: value } };
  return { userEnteredValue: { stringValue: String(value) } };
}

const isBlank = (v) => v === undefined || v === null || v === '';

function sameValue(a, b) {
  if (isBlank(a) && isBlank(b)) return true;
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) < 1e-6;
  return String(a ?? '') === String(b ?? '');
}

// Column kinds:
//   sync   — the database owns it; rewritten when it changes
//   insert — written once when the row is added, then left to the owner
//   owner  — never written (COD call, notes)
// The plan never deletes a row the database no longer knows, never blanks a
// cell the database has no value for, and only removes an exact duplicate key
// whose owner cells are empty (two order events racing to insert one order).
export function planTabSync({ sheetId, columns, existing, rows, keyOf, merge }) {
  const headers = columns.map((c) => c.header);
  const requests = [];
  const header = existing[0] || [];

  if (!header.length) {
    requests.push({
      updateCells: {
        start: { sheetId, rowIndex: 0, columnIndex: 0 },
        rows: [{ values: headers.map(cell) }],
        fields: 'userEnteredValue',
      },
    });
  } else {
    const mismatch = headers.findIndex((h, i) => String(header[i] ?? '').trim() !== h);
    if (mismatch !== -1) {
      throw new Error(`Header mismatch in column ${mismatch + 1}: sheet has "${header[mismatch] ?? ''}", sync expects "${headers[mismatch]}". Nothing was written.`);
    }
  }

  const ownerCols = columns.map((c, i) => (c.kind === 'owner' ? i : -1)).filter((i) => i >= 0);
  const syncRuns = [];
  columns.forEach((c, i) => {
    if (c.kind !== 'sync') return;
    const last = syncRuns[syncRuns.length - 1];
    if (last && last.end === i) last.end = i + 1;
    else syncRuns.push({ start: i, end: i + 1 });
  });

  const rowOf = new Map();
  const duplicates = [];
  for (let r = 1; r < existing.length; r += 1) {
    const key = keyOf(existing[r] || []);
    if (!key) continue;
    if (!rowOf.has(key)) { rowOf.set(key, r); continue; }
    const ownerEmpty = ownerCols.every((c) => isBlank(existing[r]?.[c]));
    if (ownerEmpty) duplicates.push(r);
  }

  let updated = 0;
  const fresh = [];
  for (const row of rows) {
    const key = keyOf(row);
    if (!key) continue;
    if (!rowOf.has(key)) { fresh.push(row); continue; }
    const r = rowOf.get(key);
    const have = existing[r] || [];
    const final = columns.map((col, i) => {
      if (col.kind !== 'sync') return have[i];
      let want = merge ? merge(col, have[i], row[i]) : row[i];
      if (isBlank(want)) want = have[i];
      return want;
    });
    const changed = syncRuns.some(({ start, end }) => {
      for (let i = start; i < end; i += 1) if (!sameValue(have[i], final[i])) return true;
      return false;
    });
    if (!changed) continue;
    updated += 1;
    for (const { start, end } of syncRuns) {
      requests.push({
        updateCells: {
          start: { sheetId, rowIndex: r, columnIndex: start },
          rows: [{ values: final.slice(start, end).map(cell) }],
          fields: 'userEnteredValue',
        },
      });
    }
  }

  for (const r of duplicates.sort((a, b) => b - a)) {
    requests.push({ deleteDimension: { range: { sheetId, dimension: 'ROWS', startIndex: r, endIndex: r + 1 } } });
  }

  if (fresh.length) {
    // Newest first: new rows go in under the header and take the formatting
    // of the row below them (dates, currency, dropdowns).
    requests.push({
      insertDimension: {
        range: { sheetId, dimension: 'ROWS', startIndex: 1, endIndex: 1 + fresh.length },
        inheritFromBefore: false,
      },
    });
    requests.push({
      updateCells: {
        start: { sheetId, rowIndex: 1, columnIndex: 0 },
        rows: fresh.map((row) => ({ values: columns.map((col, i) => cell(col.kind === 'owner' ? '' : row[i])) })),
        fields: 'userEnteredValue',
      },
    });
  }

  return { requests, inserted: fresh.length, updated, removed: duplicates.length };
}

export function columnLetter(n) {
  let s = '';
  for (let x = n; x > 0; x = Math.floor((x - 1) / 26)) s = String.fromCharCode(65 + ((x - 1) % 26)) + s;
  return s;
}

export async function syncTab({ spreadsheetId, tab, columns, rows, keyOf, merge }) {
  const [sheetId, existing] = await Promise.all([
    getSheetId(spreadsheetId, tab),
    readTab(spreadsheetId, tab, columnLetter(columns.length)),
  ]);
  const plan = planTabSync({ sheetId, columns, existing, rows, keyOf, merge });
  await batchUpdate(spreadsheetId, plan.requests);
  return { inserted: plan.inserted, updated: plan.updated, removed: plan.removed };
}
