// End to end: a COD order placed through the real /api/create-order handler
// reaches both Google Sheets through the real sync and layout code. Google is
// replaced by a strict in-memory Sheets API that rejects what Google rejects
// (a range past the grid, overlapping merges, a duplicate name, an unknown id,
// an unknown request) and applies each batch atomically, so a request the
// layout gets wrong fails here, not on the owner's sheet. Formula results need
// Google itself; docs/GOOGLE-SHEETS-SETUP.md says how they were checked.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

import createOrderHandlerRaw from '../api/create-order.js';
import { syncSheets, ORDER_COLUMNS, CONTACT_COLUMNS } from '../api/sheets-sync.js';
import { LAYOUT_VERSION } from '../api/sheets-layout.js';

/* ── a strict fake of the Sheets API ────────────────────────────────────── */

class SheetsError extends Error {}
const bad = (msg) => { throw new SheetsError(msg); };
const DIM = { ROWS: ['startRowIndex', 'endRowIndex', 'rowCount'], COLUMNS: ['startColumnIndex', 'endColumnIndex', 'columnCount'] };
const CELL_FIELDS = { userEnteredValue: 'v', userEnteredFormat: 'f', note: 'note', dataValidation: 'dv' };
const OUR_NAMES = ['Period', 'PeriodStart', 'PeriodEnd', 'SyncStatus', 'BottlesReceived', 'LowStockAt', 'SaleStatuses', 'ToShipStatuses', 'OnTheWayStatuses'];
const colIndex = (letters) => [...letters.toUpperCase()].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
const intersects = (a, b) => a.startRowIndex < b.endRowIndex && b.startRowIndex < a.endRowIndex
  && a.startColumnIndex < b.endColumnIndex && b.startColumnIndex < a.endColumnIndex;
const inside = (a, b) => a.startRowIndex >= b.startRowIndex && a.endRowIndex <= b.endRowIndex
  && a.startColumnIndex >= b.startColumnIndex && a.endColumnIndex <= b.endColumnIndex;

class FakeBook {
  constructor(tabs) {
    this.seq = 7000;
    this.calls = { batch: 0, meta: 0 };
    this.s = { sheets: [], namedRanges: [], developerMetadata: [] };
    for (const t of tabs) this.addTab(t);
  }

  addTab({ title, sheetId, rows = 1000, cols = 26, hidden = false, values = [] }) {
    const sheet = {
      properties: { sheetId, title, index: this.s.sheets.length, hidden, gridProperties: { rowCount: rows, columnCount: cols } },
      grid: [], merges: [], conditionalFormats: [], bandedRanges: [], protectedRanges: [], charts: [],
    };
    this.s.sheets.push(sheet);
    values.forEach((row, r) => row.forEach((v, c) => { if (v !== '' && v !== undefined) this.cell(sheet, r, c).v = toValue(v); }));
    return sheet;
  }

  sheet(id) { return this.s.sheets.find((x) => x.properties.sheetId === id) || bad(`No grid with id: ${id}`); }
  tab(title) { return this.s.sheets.find((x) => x.properties.title === title); }
  cell(sheet, r, c) {
    sheet.grid[r] ||= [];
    return (sheet.grid[r][c] ||= {});
  }

  check(range, what) {
    const sheet = this.sheet(range.sheetId);
    const g = sheet.properties.gridProperties;
    for (const [s, e, count] of Object.values(DIM)) {
      const a = range[s] ?? 0; const b = range[e] ?? g[count];
      if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || a >= b || b > g[count]) {
        bad(`${what}: range ${JSON.stringify(range)} is outside the ${g.rowCount}x${g.columnCount} grid of "${sheet.properties.title}"`);
      }
    }
    return sheet;
  }

  rangesOf(sheet) {
    const out = [...sheet.merges, ...sheet.conditionalFormats.flatMap((r) => r.ranges), ...sheet.bandedRanges.map((b) => b.range)];
    for (const p of sheet.protectedRanges) out.push(p.range, ...(p.unprotectedRanges || []));
    if (sheet.basicFilter) out.push(sheet.basicFilter.range);
    for (const n of this.s.namedRanges) if (n.range.sheetId === sheet.properties.sheetId) out.push(n.range);
    return out;
  }

  move(sheet, dim, at, n) {
    const [s, e] = DIM[dim];
    for (const r of this.rangesOf(sheet)) {
      if (r[s] === undefined) continue; // a whole-sheet range moves with the sheet
      if (n > 0) {
        if (r[s] >= at) { r[s] += n; r[e] += n; } else if (r[e] > at) r[e] += n;
      } else {
        const b = at - n;
        const fix = (x) => (x <= at ? x : x >= b ? x + n : at);
        r[s] = fix(r[s]); r[e] = fix(r[e]);
      }
    }
  }

  // Google's values API: trailing empty rows and cells are left out.
  read(rangeText, mode) {
    let sheet; let r0 = 0; let r1; let c0 = 0; let c1;
    const named = this.s.namedRanges.find((n) => n.name === rangeText);
    if (named) {
      sheet = this.sheet(named.range.sheetId);
      ({ startRowIndex: r0, endRowIndex: r1, startColumnIndex: c0, endColumnIndex: c1 } = named.range);
    } else {
      const m = /^'((?:[^']|'')+)'!([A-Z]*)(\d*)(?::([A-Z]*)(\d*))?$/.exec(rangeText) || bad(`Unable to parse range: ${rangeText}`);
      sheet = this.tab(m[1].replace(/''/g, "'")) || bad(`Unable to parse range: ${rangeText}`);
      const g = sheet.properties.gridProperties;
      const one = m[4] === undefined && m[5] === undefined;
      c0 = m[2] ? colIndex(m[2]) : 0; r0 = m[3] ? Number(m[3]) - 1 : 0;
      c1 = one ? c0 + 1 : m[4] ? colIndex(m[4]) + 1 : g.columnCount;
      r1 = one ? r0 + 1 : m[5] ? Number(m[5]) : g.rowCount;
    }
    const out = [];
    for (let r = r0; r < Math.min(r1, sheet.grid.length); r += 1) {
      const row = [];
      for (let c = c0; c < c1; c += 1) {
        const v = sheet.grid[r]?.[c]?.v;
        row.push(v === undefined ? '' : v.formulaValue ?? v.numberValue ?? v.stringValue ?? v.boolValue);
      }
      while (row.length && row[row.length - 1] === '') row.pop();
      out.push(row);
    }
    while (out.length && !out[out.length - 1].length) out.pop();
    void mode;
    return out;
  }

  meta(fields) {
    this.calls.meta += 1;
    const sheets = this.s.sheets.map((x) => {
      if (fields === 'sheets.properties') return { properties: structuredClone(x.properties) };
      const o = { properties: structuredClone(x.properties) };
      if (x.conditionalFormats.length) o.conditionalFormats = x.conditionalFormats.map((r) => ({ ranges: structuredClone(r.ranges) }));
      if (x.charts.length) o.charts = x.charts.map((c) => ({ chartId: c.chartId }));
      if (x.bandedRanges.length) o.bandedRanges = x.bandedRanges.map((b) => ({ bandedRangeId: b.bandedRangeId }));
      if (x.protectedRanges.length) o.protectedRanges = x.protectedRanges.map((p) => ({ protectedRangeId: p.protectedRangeId, ...(p.description ? { description: p.description } : {}) }));
      return o;
    });
    if (fields === 'sheets.properties') return { sheets };
    return {
      sheets,
      ...(this.s.namedRanges.length ? { namedRanges: structuredClone(this.s.namedRanges) } : {}),
      ...(this.s.developerMetadata.length ? { developerMetadata: structuredClone(this.s.developerMetadata) } : {}),
    };
  }

  batch(requests) {
    this.calls.batch += 1;
    const saved = structuredClone(this.s);
    const savedSeq = this.seq;
    try {
      requests.forEach((req, i) => {
        const keys = Object.keys(req);
        if (keys.length !== 1) bad(`request ${i}: one kind per request, got ${keys.join(',')}`);
        const fn = this[`do_${keys[0]}`] || bad(`request ${i}: unknown request ${keys[0]}`);
        try { fn.call(this, req[keys[0]]); } catch (err) { throw new SheetsError(`Invalid requests[${i}].${keys[0]}: ${err.message}`); }
      });
    } catch (err) {
      this.s = saved; this.seq = savedSeq;
      throw err;
    }
  }

  do_addSheet({ properties: p }) {
    if (this.s.sheets.some((x) => x.properties.sheetId === p.sheetId)) bad(`sheet id ${p.sheetId} exists`);
    if (this.s.sheets.some((x) => x.properties.title.toLowerCase() === p.title.toLowerCase())) bad(`A sheet with the name "${p.title}" already exists`);
    const sheet = this.addTab({ title: p.title, sheetId: p.sheetId ?? (this.seq += 1), rows: p.gridProperties?.rowCount, cols: p.gridProperties?.columnCount });
    this.reorder(sheet, p.index ?? this.s.sheets.length - 1, true);
  }

  reorder(sheet, index, fresh = false) {
    const list = this.s.sheets;
    const from = list.indexOf(sheet);
    list.splice(from, 1);
    // Google counts a move by the indexes before the move.
    list.splice(Math.min(!fresh && index > from ? index - 1 : index, list.length), 0, sheet);
    list.forEach((x, i) => { x.properties.index = i; });
  }

  do_updateSheetProperties({ properties: p, fields }) {
    const sheet = this.sheet(p.sheetId);
    for (const path of fields.split(',')) {
      const parts = path.split('.');
      const value = parts.reduce((o, k) => o?.[k], p);
      if (path === 'index') { this.reorder(sheet, value); continue; }
      if (path === 'gridProperties.rowCount' || path === 'gridProperties.columnCount') {
        if (!Number.isInteger(value) || value < 1) bad(`${path} ${value}`);
        if (path.endsWith('rowCount')) sheet.grid.length = Math.min(sheet.grid.length, value);
        else sheet.grid.forEach((row) => { if (row) row.length = Math.min(row.length, value); });
      }
      let o = sheet.properties;
      parts.slice(0, -1).forEach((k) => { o = (o[k] ||= {}); });
      o[parts[parts.length - 1]] = structuredClone(value);
    }
    const g = sheet.properties.gridProperties;
    if ((g.frozenRowCount || 0) >= g.rowCount || (g.frozenColumnCount || 0) >= g.columnCount) bad('frozen rows/columns must leave part of the grid unfrozen');
    for (const m of sheet.merges) {
      if (m.startRowIndex < (g.frozenRowCount || 0) && m.endRowIndex > (g.frozenRowCount || 0)) bad('cannot freeze through a merged cell');
      if (m.endRowIndex > g.rowCount || m.endColumnIndex > g.columnCount) bad('resize would cut a merged cell');
    }
  }

  do_updateDimensionProperties({ range, properties, fields }) {
    const sheet = this.sheet(range.sheetId);
    const count = sheet.properties.gridProperties[DIM[range.dimension][2]];
    if (!(range.startIndex >= 0 && range.startIndex < range.endIndex && range.endIndex <= count)) bad(`dimension range ${range.startIndex}-${range.endIndex} outside ${count}`);
    if (fields !== 'pixelSize' || !(properties.pixelSize > 0)) bad('pixelSize only');
  }

  eachCell(range, fn) {
    const sheet = this.check(range, 'cells');
    for (let r = range.startRowIndex; r < range.endRowIndex; r += 1) {
      for (let c = range.startColumnIndex; c < range.endColumnIndex; c += 1) fn(this.cell(sheet, r, c), r, c);
    }
  }

  fieldsOf(fields) {
    return fields.split(',').map((f) => CELL_FIELDS[f.trim()] || bad(`unsupported cell field ${f}`));
  }

  do_repeatCell({ range, cell, fields }) {
    const keys = this.fieldsOf(fields);
    this.eachCell(range, (x) => {
      for (const k of keys) {
        const src = cell[Object.keys(CELL_FIELDS).find((n) => CELL_FIELDS[n] === k)];
        if (src === undefined) delete x[k]; else x[k] = structuredClone(src);
      }
    });
  }

  do_updateCells({ start, range, rows, fields }) {
    const keys = this.fieldsOf(fields);
    const field = (k) => Object.keys(CELL_FIELDS).find((n) => CELL_FIELDS[n] === k);
    if (range) {
      if (rows) bad('rows with range not used here');
      this.eachCell(range, (x) => { for (const k of keys) delete x[k]; });
      return;
    }
    const sheet = this.sheet(start.sheetId);
    const g = sheet.properties.gridProperties;
    rows.forEach((row, i) => (row.values || []).forEach((v, j) => {
      const r = start.rowIndex + i; const c = start.columnIndex + j;
      if (r >= g.rowCount || c >= g.columnCount) bad(`cell ${r},${c} exceeds grid limits of "${sheet.properties.title}"`);
      const x = this.cell(sheet, r, c);
      for (const k of keys) { if (v[field(k)] === undefined) delete x[k]; else x[k] = structuredClone(v[field(k)]); }
      if (x.v) toValue(x.v); // validates the value kind
    }));
  }

  do_mergeCells({ range, mergeType }) {
    const sheet = this.check(range, 'merge');
    if (mergeType !== 'MERGE_ALL') bad('MERGE_ALL only');
    if ((range.endRowIndex - range.startRowIndex) * (range.endColumnIndex - range.startColumnIndex) < 2) bad('a merge needs two cells');
    const rest = [];
    for (const m of sheet.merges) {
      if (!intersects(m, range)) rest.push(m);
      else if (!inside(m, range)) bad('You must select all cells in a merged range to merge or unmerge them.');
    }
    sheet.merges = [...rest, structuredClone(range)];
  }

  do_unmergeCells({ range }) {
    const sheet = this.check(range, 'unmerge');
    sheet.merges = sheet.merges.filter((m) => {
      if (!intersects(m, range)) return true;
      if (!inside(m, range)) bad('You must select all cells in a merged range to merge or unmerge them.');
      return false;
    });
  }

  do_updateBorders(b) { this.check(b.range, 'borders'); }

  do_addConditionalFormatRule({ rule, index = 0 }) {
    const sheet = this.sheet(rule.ranges[0].sheetId);
    rule.ranges.forEach((r) => this.check(r, 'conditional format'));
    // Found on a real spreadsheet: an empty textFormat is refused.
    const f = rule.booleanRule.format;
    const textKeys = Object.keys(f.textFormat || {});
    if (Object.keys(f).some((k) => !['backgroundColorStyle', 'textFormat'].includes(k))
      || ('textFormat' in f && (!textKeys.length || textKeys.some((k) => !['bold', 'italic', 'strikethrough', 'foregroundColorStyle'].includes(k))))) {
      bad('ConditionalFormatRule.format only supports bold, italic, strikethrough, foreground color and background color.');
    }
    if (index > sheet.conditionalFormats.length) bad(`index ${index}`);
    sheet.conditionalFormats.splice(index, 0, structuredClone(rule));
  }

  do_deleteConditionalFormatRule({ sheetId, index }) {
    const sheet = this.sheet(sheetId);
    if (!(index >= 0 && index < sheet.conditionalFormats.length)) bad(`No conditional format on sheet ${sheetId} at index ${index}`);
    sheet.conditionalFormats.splice(index, 1);
  }

  do_addBanding({ bandedRange }) {
    const sheet = this.check(bandedRange.range, 'banding');
    if (sheet.bandedRanges.some((b) => intersects(b.range, bandedRange.range))) bad('You cannot add alternating background colors to a range that already has alternating background colors.');
    sheet.bandedRanges.push({ ...structuredClone(bandedRange), bandedRangeId: (this.seq += 1) });
  }

  do_deleteBanding({ bandedRangeId }) {
    const sheet = this.s.sheets.find((x) => x.bandedRanges.some((b) => b.bandedRangeId === bandedRangeId)) || bad(`No banded range with id ${bandedRangeId}`);
    sheet.bandedRanges = sheet.bandedRanges.filter((b) => b.bandedRangeId !== bandedRangeId);
  }

  do_addProtectedRange({ protectedRange: p }) {
    const sheet = this.check(p.range, 'protected range');
    // Found on a real spreadsheet: holes need a whole-sheet protection.
    if (p.unprotectedRanges?.length && Object.keys(p.range).some((k) => k !== 'sheetId')) bad('unprotectedRanges are only allowed on ProtectedRanges covering a whole sheet.');
    for (const u of p.unprotectedRanges || []) this.check(u, 'unprotected range');
    sheet.protectedRanges.push({ ...structuredClone(p), protectedRangeId: (this.seq += 1) });
  }

  do_deleteProtectedRange({ protectedRangeId }) {
    const sheet = this.s.sheets.find((x) => x.protectedRanges.some((p) => p.protectedRangeId === protectedRangeId)) || bad(`No protected range with id ${protectedRangeId}`);
    sheet.protectedRanges = sheet.protectedRanges.filter((p) => p.protectedRangeId !== protectedRangeId);
  }

  do_addNamedRange({ namedRange }) {
    const { name, range } = namedRange;
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name) || /^[A-Za-z]{1,3}\d+$/.test(name)) bad(`invalid name ${name}`);
    if (this.s.namedRanges.some((n) => n.name.toLowerCase() === name.toLowerCase())) bad(`A named range with name "${name}" already exists`);
    this.check(range, 'named range');
    this.s.namedRanges.push({ namedRangeId: String((this.seq += 1)), name, range: structuredClone(range) });
  }

  do_deleteNamedRange({ namedRangeId }) {
    if (!this.s.namedRanges.some((n) => n.namedRangeId === namedRangeId)) bad(`No named range with id ${namedRangeId}`);
    this.s.namedRanges = this.s.namedRanges.filter((n) => n.namedRangeId !== namedRangeId);
  }

  do_addChart({ chart }) {
    const a = chart.position.overlayPosition.anchorCell;
    const sheet = this.check({ sheetId: a.sheetId, startRowIndex: a.rowIndex, endRowIndex: a.rowIndex + 1, startColumnIndex: a.columnIndex, endColumnIndex: a.columnIndex + 1 }, 'chart anchor');
    const spec = chart.spec.basicChart;
    for (const src of [...spec.domains.map((d) => d.domain), ...spec.series.map((s) => s.series)]) src.sourceRange.sources.forEach((r) => this.check(r, 'chart source'));
    sheet.charts.push({ ...structuredClone(chart), chartId: (this.seq += 1) });
  }

  do_deleteEmbeddedObject({ objectId }) {
    const sheet = this.s.sheets.find((x) => x.charts.some((c) => c.chartId === objectId)) || bad(`No embedded object with id ${objectId}`);
    sheet.charts = sheet.charts.filter((c) => c.chartId !== objectId);
  }

  do_setDataValidation({ range, rule }) { this.eachCell(range, (x) => { if (rule) x.dv = structuredClone(rule); else delete x.dv; }); }
  do_setBasicFilter({ filter }) { this.check(filter.range, 'filter').basicFilter = structuredClone(filter); }

  do_insertDimension({ range, inheritFromBefore }) {
    const sheet = this.sheet(range.sheetId);
    const [, , count] = DIM[range.dimension];
    const g = sheet.properties.gridProperties;
    const n = range.endIndex - range.startIndex;
    if (!(n > 0 && range.startIndex >= 0 && range.startIndex <= g[count])) bad('insert range');
    if (inheritFromBefore && range.startIndex === 0) bad('cannot inherit from before the first row/column');
    const from = inheritFromBefore ? range.startIndex - 1 : range.startIndex;
    const like = (x) => (x ? { ...(x.f ? { f: structuredClone(x.f) } : {}), ...(x.dv ? { dv: structuredClone(x.dv) } : {}) } : undefined);
    if (range.dimension === 'ROWS') {
      const src = sheet.grid[from];
      sheet.grid.splice(range.startIndex, 0, ...Array.from({ length: n }, () => (src ? src.map(like) : undefined)));
    } else {
      sheet.grid.forEach((row) => { if (row) row.splice(range.startIndex, 0, ...Array.from({ length: n }, () => like(row[from]))); });
    }
    g[count] += n;
    this.move(sheet, range.dimension, range.startIndex, n);
  }

  do_appendDimension({ sheetId, dimension, length }) {
    if (!(length > 0)) bad('length');
    this.sheet(sheetId).properties.gridProperties[DIM[dimension][2]] += length;
  }

  do_deleteDimension({ range }) {
    const sheet = this.sheet(range.sheetId);
    const [, , count] = DIM[range.dimension];
    const g = sheet.properties.gridProperties;
    const n = range.endIndex - range.startIndex;
    if (!(n > 0 && range.endIndex <= g[count])) bad('delete range');
    if (range.dimension === 'ROWS') sheet.grid.splice(range.startIndex, n);
    else sheet.grid.forEach((row) => row?.splice(range.startIndex, n));
    g[count] -= n;
    this.move(sheet, range.dimension, range.startIndex, -n);
  }

  do_copyPaste({ source, destination, pasteType }) {
    if (pasteType !== 'PASTE_FORMAT') bad('PASTE_FORMAT only');
    const sheet = this.check(source, 'copy source');
    this.check(destination, 'paste destination');
    const h = source.endRowIndex - source.startRowIndex; const w = source.endColumnIndex - source.startColumnIndex;
    this.eachCell(destination, (x, r, c) => {
      const src = sheet.grid[source.startRowIndex + ((r - destination.startRowIndex) % h)]?.[source.startColumnIndex + ((c - destination.startColumnIndex) % w)];
      if (src?.f) x.f = structuredClone(src.f); else delete x.f;
      if (src?.dv) x.dv = structuredClone(src.dv); else delete x.dv;
    });
  }

  do_createDeveloperMetadata({ developerMetadata: m }) {
    if (!m.location?.spreadsheet || !m.metadataKey || m.visibility !== 'DOCUMENT') bad('spreadsheet-level DOCUMENT metadata only');
    this.s.developerMetadata.push({ ...structuredClone(m), metadataId: (this.seq += 1) });
  }

  do_updateDeveloperMetadata({ dataFilters, developerMetadata, fields }) {
    const id = dataFilters[0].developerMetadataLookup.metadataId;
    const m = this.s.developerMetadata.find((x) => x.metadataId === id) || bad(`No developer metadata with id ${id}`);
    if (fields !== 'metadataValue') bad('metadataValue only');
    m.metadataValue = developerMetadata.metadataValue;
  }

  // Static checks Google can't do for us before a formula runs: brackets
  // balance, every named range and tab a formula names exists.
  lint() {
    const problems = [];
    const titles = new Set(this.s.sheets.map((x) => x.properties.title));
    const names = new Set(this.s.namedRanges.map((n) => n.name));
    const formulas = [];
    for (const sheet of this.s.sheets) {
      sheet.grid.forEach((row, r) => row?.forEach((x, c) => { if (x?.v?.formulaValue) formulas.push([`${sheet.properties.title}!R${r + 1}C${c + 1}`, x.v.formulaValue]); }));
      sheet.conditionalFormats.forEach((rule, i) => formulas.push([`${sheet.properties.title} rule ${i}`, rule.booleanRule.condition.values[0].userEnteredValue]));
    }
    for (const [where, f] of formulas) {
      const code = f.replace(/"(?:[^"]|"")*"/g, '""');
      if (code.includes('"') && (code.match(/"/g).length % 2)) problems.push(`${where}: unbalanced quotes`);
      let depth = 0;
      for (const ch of code) { depth += ch === '(' ? 1 : ch === ')' ? -1 : 0; if (depth < 0) break; }
      if (depth !== 0) problems.push(`${where}: unbalanced brackets`);
      for (const n of OUR_NAMES) if (new RegExp(`\\b${n}\\b`).test(code) && !names.has(n)) problems.push(`${where}: no named range ${n}`);
      for (const m of code.matchAll(/(?:'((?:[^']|'')+)'|\b([A-Za-z][\w ]*?))!/g)) {
        const t = (m[1] || m[2]).replace(/''/g, "'");
        if (!titles.has(t)) problems.push(`${where}: no tab "${t}"`);
      }
    }
    return problems;
  }

  async handle(url, opts) {
    const u = new URL(url);
    const method = opts.method || 'GET';
    const path = decodeURIComponent(u.pathname.replace(/^\/v4\/spreadsheets\/[^/:]+/, ''));
    try {
      if (method === 'POST' && path === ':batchUpdate') { this.batch(JSON.parse(opts.body).requests); return json({ replies: [] }); }
      if (method === 'GET' && path === '') return json(this.meta(u.searchParams.get('fields')));
      if (path.startsWith('/values/')) {
        const range = path.slice('/values/'.length);
        if (method === 'GET') return json({ range, values: this.read(range, u.searchParams.get('valueRenderOption')) });
        if (method === 'PUT') {
          const named = this.s.namedRanges.find((n) => n.name === range) || bad(`Unable to parse range: ${range}`);
          const [[text]] = JSON.parse(opts.body).values;
          this.cell(this.sheet(named.range.sheetId), named.range.startRowIndex, named.range.startColumnIndex).v = { stringValue: text };
          return json({});
        }
      }
      bad(`unexpected ${method} ${path}`);
    } catch (err) {
      if (err instanceof SheetsError) return json({ error: { code: 400, message: err.message } }, 400);
      throw err;
    }
    return null;
  }
}

function toValue(v) {
  if (v && typeof v === 'object') {
    const kinds = ['formulaValue', 'numberValue', 'stringValue', 'boolValue'].filter((k) => k in v);
    if (kinds.length !== 1) bad(`a cell value has one kind, got ${JSON.stringify(v)}`);
    return v;
  }
  if (typeof v === 'number') return { numberValue: v };
  if (typeof v === 'string' && v.startsWith('=')) return { formulaValue: v };
  return { stringValue: String(v) };
}
const json = (body, status = 200) => new Response(JSON.stringify(body), { status });

/* ── the shop: Supabase, the env, the order form ────────────────────────── */

const ORDERS_ID = 'orders-book';
const CONTACTS_ID = 'contacts-book';
const db = { orders: [], waitlist: [], contact_messages: [], reviews: [] };
let books;

function supabase(u, opts) {
  const method = opts.method || 'GET';
  const table = u.pathname.replace('/rest/v1/', '');
  const q = u.searchParams;
  if (method === 'POST' && table === 'orders') {
    const at = new Date().toISOString();
    const row = { id: crypto.randomUUID(), created_at: at, updated_at: at, status_history: [], ...JSON.parse(opts.body) };
    row.status_history = [{ status: row.status, at }]; // the orders_track_status trigger
    db.orders.push(row);
    return json([row], 201);
  }
  if (method !== 'GET' || !db[table]) return json([]);
  let rows = [...db[table]];
  const code = q.get('order_code');
  if (code) rows = rows.filter((o) => `eq.${o.order_code}` === code);
  if (q.get('order_id') === 'not.is.null') rows = rows.filter((r) => r.order_id);
  if (q.get('order') === 'created_at.desc') rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
  return json(rows);
}

// Status changes the way /admin and the Shiprocket sync make them.
function advance(code, patch) {
  const o = db.orders.find((x) => x.order_code === code);
  const at = new Date(Date.now() + 1000 * (o.status_history.length)).toISOString();
  if (patch.status && patch.status !== o.status) o.status_history.push({ status: patch.status, at });
  Object.assign(o, patch, { updated_at: at });
}

const ENV = {};
function setEnv(vars) {
  for (const [k, v] of Object.entries(vars)) {
    if (!(k in ENV)) ENV[k] = process.env[k];
    if (v === undefined) delete process.env[k]; else process.env[k] = v;
  }
}
const prevFetch = globalThis.fetch;

test.before(() => {
  const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  setEnv({
    GOOGLE_SERVICE_ACCOUNT_JSON: JSON.stringify({ client_email: 'sync@smelloff-test.iam.gserviceaccount.com', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }) }),
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
    SHEETS_ORDERS_ID: ORDERS_ID,
    SHEETS_CONTACTS_ID: CONTACTS_ID,
    SHIPROCKET_EMAIL: undefined,
    SHIPROCKET_PASSWORD: undefined,
    RESEND_API_KEY: undefined,
  });
  globalThis.fetch = async (url, opts = {}) => {
    const u = new URL(String(url));
    if (u.hostname === 'oauth2.googleapis.com') return json({ access_token: 'ya29.test', expires_in: 3600 });
    if (u.hostname === 'sheets.googleapis.com') {
      const id = u.pathname.split('/')[3].split(':')[0];
      return books[id].handle(u, opts);
    }
    if (u.pathname.startsWith('/rest/v1/')) return supabase(u, opts);
    return json({});
  };
});

test.after(() => {
  globalThis.fetch = prevFetch;
  for (const [k, v] of Object.entries(ENV)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
});

const H = (cols, name) => cols.findIndex((c) => c.header === name);
const O = (name) => H(ORDER_COLUMNS, name);
const K = (name) => H(CONTACT_COLUMNS, name);
const rowsOf = (book, tab) => book.read(`'${tab}'!A1:AB`);
const valueAt = (book, name) => {
  const n = book.s.namedRanges.find((x) => x.name === name);
  return n ? book.read(name)[0]?.[0] : undefined;
};

// The two spreadsheets as they are on 19 Oct 2026: the hand-built v2 design
// (period picker in B5 and stock in B30, neither named), an order only the
// old sheet knows, hidden old tabs.
function todaysBooks() {
  const header = ORDER_COLUMNS.map((c) => c.header);
  const oldOnly = Array(ORDER_COLUMNS.length).fill('');
  oldOnly[O('Order ID')] = 'SMF-20260801-1111'; oldOnly[O('Status')] = 'Delivered'; oldOnly[O('Name')] = 'From the old sheet';
  oldOnly[O('Notes')] = 'typed by the owner';
  const orders = new FakeBook([
    { title: 'Dashboard', sheetId: 1001, rows: 200, cols: 18, values: [['Smelloff orders'], ['Waiting for the first website sync.'], [], [], ['Period', 'Last 30 days']] },
    { title: 'Orders', sheetId: 1002, rows: 1000, cols: 28, values: [header, oldOnly] },
    { title: 'Old orders log', sheetId: 1005, hidden: true, values: [['Timestamp', 'Order ID'], ['2026-08-01', 'SMF-20260801-1111']] },
  ]);
  orders.cell(orders.tab('Dashboard'), 29, 1).v = { numberValue: 120 };
  const range = (r0, r1, c) => ({ sheetId: 1001, startRowIndex: r0, endRowIndex: r1, startColumnIndex: c, endColumnIndex: c + 1 });
  for (const [name, r] of [['SyncStatus', range(1, 2, 0)], ['SaleStatuses', range(5, 11, 15)], ['ToShipStatuses', range(5, 8, 16)],
    ['OnTheWayStatuses', range(5, 7, 17)], ['PeriodStart', range(12, 13, 16)], ['PeriodEnd', range(13, 14, 16)]]) {
    orders.do_addNamedRange({ namedRange: { name, range: r } });
  }
  orders.do_mergeCells({ range: { sheetId: 1001, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 6 }, mergeType: 'MERGE_ALL' });
  orders.do_addChart({ chart: { spec: { basicChart: { domains: [{ domain: { sourceRange: { sources: [{ sheetId: 1001, startRowIndex: 20, endRowIndex: 33, startColumnIndex: 0, endColumnIndex: 1 }] } } }], series: [] } }, position: { overlayPosition: { anchorCell: { sheetId: 1001, rowIndex: 35, columnIndex: 0 } } } } });
  for (const sheetId of [1001, 1002]) {
    orders.do_addConditionalFormatRule({ rule: { ranges: [{ sheetId, startRowIndex: 0, endRowIndex: 50, startColumnIndex: 0, endColumnIndex: 3 }], booleanRule: { condition: { type: 'CUSTOM_FORMULA', values: [{ userEnteredValue: '=$C1="Delivered"' }] }, format: {} } } });
  }
  orders.do_addProtectedRange({ protectedRange: { range: { sheetId: 1002, startRowIndex: 0, endRowIndex: 1000, startColumnIndex: 0, endColumnIndex: 26 }, description: 'Filled by the website', warningOnly: true } });

  const waitlisted = Array(CONTACT_COLUMNS.length).fill('');
  waitlisted[K('Email')] = 'april@example.com'; waitlisted[K('Type')] = 'Subscriber'; waitlisted[K('Email offers')] = 'Yes';
  const contacts = new FakeBook([
    { title: 'Summary', sheetId: 2001, rows: 40, cols: 12, values: [['SMELLOFF'], ['Last synced …']] },
    { title: 'Contacts', sheetId: 0, rows: 1000, cols: 16, values: [CONTACT_COLUMNS.map((c) => c.header), waitlisted] },
  ]);
  contacts.do_addNamedRange({ namedRange: { name: 'SyncStatus', range: { sheetId: 2001, startRowIndex: 1, endRowIndex: 2, startColumnIndex: 0, endColumnIndex: 1 } } });
  return { [ORDERS_ID]: orders, [CONTACTS_ID]: contacts };
}

let testIp = 0;
async function placeOrder(body) {
  const res = {
    statusCode: 200, body: null, setHeader() {},
    status(code) { this.statusCode = code; return this; },
    json(data) { this.body = data; return this; },
  };
  await createOrderHandlerRaw({ method: 'POST', headers: { 'cf-connecting-ip': `203.0.113.${++testIp}` }, body }, res);
  return res;
}

/* ── the story of one COD order ─────────────────────────────────────────── */

let code;

test('a COD order placed on the website lands in both sheets, and the sheets get their design', async () => {
  books = todaysBooks();
  db.orders.push({
    id: 'old-1', order_code: 'SMF-20260905-2222', created_at: '2026-09-05T06:00:00Z', updated_at: '2026-09-09T06:00:00Z',
    status: 'delivered', status_history: [{ status: 'confirmed', at: '2026-09-05T06:00:00Z' }, { status: 'delivered', at: '2026-09-09T06:00:00Z' }],
    payment_method: 'upi', amount: 22900, cod_fee: 0, customer_email: 'old.buyer@example.com', customer_phone: '9812345678',
    address: { name: 'Old Buyer', line: '1 Lane', city: 'Chennai', state: 'Tamil Nadu', pincode: '600001' }, items: [{ quantity: 1, price: 229 }],
  });
  db.waitlist.push({ email: 'april@example.com', source: 'blog', created_at: '2026-04-02T10:00:00Z' });

  const res = await placeOrder({
    payment_method: 'cod', name: 'Priya Sharma', email: 'Priya.S@example.com', phone: '+91 98765 01234',
    items: [{ quantity: 2, price: 229 }], amount: 50800, event_source_url: 'https://smelloff.in/odorstrike?buy=1&qty=2',
    address: { name: 'Priya Sharma', line: 'Flat 4B, Lake View Apts\nMG Road', city: 'Bengaluru', state: 'Karnataka', pincode: '560001' },
    // What assets/js/track.js keeps: she came from a creator's link on the
    // homepage, then bought from /odorstrike?buy=1 (no UTMs on that URL).
    attribution: {
      first: { source: 'instagram', medium: 'creator', campaign: 'rahul_reel', landing: '/', at: '2026-10-19T09:00:00Z' },
      last: { source: 'instagram', medium: 'creator', campaign: 'rahul_reel', landing: '/', at: '2026-10-19T09:00:00Z', email: 'not@kept.in' },
    },
  });
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  code = res.body.order_code || res.body.orderCode;
  const saved = db.orders.find((o) => o.order_code === code);
  assert.ok(saved, 'the order is saved in the database');
  assert.equal(saved.status, 'placed');
  assert.equal(saved.amount, 50800, '2 for ₹419 + ₹89 COD, in paise');
  assert.equal(saved.cod_fee, 8900);
  assert.equal(saved.attribution.channel, 'Creator', 'the order keeps where it came from');
  assert.equal(saved.attribution.last.campaign, 'rahul_reel');
  assert.equal(saved.attribution.last.email, undefined, 'only the attribution fields are kept');

  // The handler syncs after the response (awaited here: no waitUntil in tests).
  const orders = books[ORDERS_ID];
  const rows = rowsOf(orders, 'Orders');
  assert.deepEqual(rows[0], ORDER_COLUMNS.map((c) => c.header));
  const row = rows[1];
  assert.equal(row[O('Order ID')], code, 'the new order is the top row');
  assert.ok(Math.abs(row[O('Order date')] - (Date.parse(saved.created_at) + 5.5 * 3600e3) / 86400e3 - 25569) < 1e-5, 'order time in IST as a date serial');
  assert.equal(row[O('Status')], 'New');
  assert.equal(row[O('Payment')], 'COD');
  assert.equal(row[O('Name')], 'Priya Sharma');
  assert.equal(row[O('Phone')], '9876501234');
  assert.match(row[O('WhatsApp')], /^=HYPERLINK\("https:\/\/wa\.me\/919876501234\?text=Hi%20Priya%2C/);
  assert.match(row[O('WhatsApp')], new RegExp(`${code}%20for%20%E2%82%B9508%2C%20delivering%20to%20Bengaluru`));
  assert.match(row[O('WhatsApp')], /"Confirm COD"\)$/);
  assert.equal(row[O('Email')], 'priya.s@example.com');
  assert.equal(row[O('Bottles')], 2);
  assert.equal(row[O('Subtotal (₹)')], 419);
  assert.equal(row[O('COD fee (₹)')], 89);
  assert.equal(row[O('Total (₹)')], 508);
  assert.equal(row[O('Address')], 'Flat 4B, Lake View Apts, MG Road');
  assert.equal(row[O('City')], 'Bengaluru');
  assert.equal(row[O('State')], 'Karnataka');
  assert.equal(row[O('Pincode')], '560001');
  assert.equal(row[O('Source')], 'Creator · rahul_reel');
  assert.equal(row[O('COD call')] ?? '', '', 'the owner column starts empty');
  assert.equal(rows.length, 4, 'header, the new order, the old order from the database, the old-sheet-only order');
  assert.equal(rows[2][O('Order ID')], 'SMF-20260905-2222');
  assert.equal(rows[2][O('Status')], 'Delivered');
  assert.equal(rows[3][O('Order ID')], 'SMF-20260801-1111', 'rows only the old sheet knows are kept');
  assert.equal(rows[3][O('Notes')], 'typed by the owner');

  // Phone, pincode and AWB are text cells; the new row has the grid's formats.
  const ordersTab = orders.tab('Orders');
  assert.equal(ordersTab.grid[1][O('Phone')].v.stringValue, '9876501234');
  assert.equal(ordersTab.grid[1][O('Phone')].f?.numberFormat?.type, 'TEXT');
  assert.equal(ordersTab.grid[1][O('Total (₹)')].f?.numberFormat?.type, 'CURRENCY');
  assert.equal(ordersTab.grid[1][O('COD call')].dv?.condition?.type, 'ONE_OF_LIST', 'the COD call dropdown reaches the new row');
  // Rows go in at row 2, so every rule on Orders must start at row 1 (index
  // 0) and grow with the grid; one starting at row 2 is pushed below them.
  const last = ordersTab.properties.gridProperties.rowCount;
  const rules = [...ordersTab.conditionalFormats.flatMap((r) => r.ranges), ...ordersTab.bandedRanges.map((b) => b.range),
    ...ordersTab.protectedRanges.map((p) => p.range), ordersTab.basicFilter.range];
  assert.equal(rules.length, 9 + 3);
  for (const r of rules) assert.deepEqual([r.startRowIndex, r.endRowIndex], [0, last], JSON.stringify(r));

  // The design: tabs, order, stamp, the owner's inputs carried over.
  assert.deepEqual(orders.s.sheets.map((x) => [x.properties.title, Boolean(x.properties.hidden)]),
    [['Dashboard', false], ['To do', false], ['Orders', false], ['Settings', false], ['Old orders log', true]]);
  assert.equal(orders.s.developerMetadata.find((m) => m.metadataKey === 'smelloff_layout')?.metadataValue, LAYOUT_VERSION);
  assert.equal(valueAt(orders, 'Period'), 'Last 30 days', 'the period picked in the old B5 is kept');
  assert.equal(valueAt(orders, 'BottlesReceived'), 120, 'stock typed in the old B30 moves to Settings');
  assert.equal(orders.s.namedRanges.find((n) => n.name === 'BottlesReceived').range.sheetId, orders.tab('Settings').properties.sheetId);
  assert.match(valueAt(orders, 'SyncStatus'), /^Last synced by the website: .* \(2 new, 0 updated\)/);
  assert.equal(orders.tab('Dashboard').charts.length, 1, 'one chart: the old one is replaced');
  assert.equal(orders.tab('Orders').protectedRanges.length, 1, 'the old website protection is replaced, not doubled');
  assert.equal(orders.tab('Orders').bandedRanges.length, 1);
  assert.equal(orders.tab('Old orders log').grid[1][1].v.stringValue, 'SMF-20260801-1111', 'hidden old tabs are untouched');
  assert.deepEqual(orders.lint(), []);

  const contacts = books[CONTACTS_ID];
  const people = rowsOf(contacts, 'Contacts');
  const priya = people.find((p) => p[K('Email')] === 'priya.s@example.com');
  assert.ok(priya, 'the buyer is on Contacts');
  assert.equal(priya[K('Name')], 'Priya Sharma');
  assert.equal(priya[K('Phone')], '9876501234');
  assert.equal(priya[K('Type')], 'Customer');
  assert.equal(priya[K('Paid orders')], 1);
  assert.equal(priya[K('Bottles')], 2);
  assert.equal(priya[K('Order value (₹)')], 508);
  assert.equal(priya[K('Email offers')], 'No', 'a checkout is not consent to offers');
  assert.equal(people.find((p) => p[K('Email')] === 'april@example.com')[K('Email offers')], 'Yes');
  assert.deepEqual(contacts.s.sheets.map((x) => x.properties.title), ['Summary', 'Follow up', 'Contacts']);
  assert.match(valueAt(contacts, 'SyncStatus'), /^Last synced by the website/);
  assert.deepEqual(contacts.lint(), []);
});

test('the order moves through confirmed, shipped and delivered; the owner\'s columns stay', async () => {
  const orders = books[ORDERS_ID];
  const tab = orders.tab('Orders');
  const rowIndex = () => rowsOf(orders, 'Orders').findIndex((r) => r[O('Order ID')] === code);
  orders.cell(tab, rowIndex(), O('COD call')).v = { stringValue: 'Confirmed on call' };
  orders.cell(tab, rowIndex(), O('Notes')).v = { stringValue: 'Leave with the guard' };

  advance(code, { status: 'confirmed' });
  let result = await syncSheets({ route: 'test' });
  assert.equal(result.status, 'ok', JSON.stringify(result));
  assert.deepEqual(result.orders, { inserted: 0, updated: 1, removed: 0 });
  assert.equal(result.rebuilt, undefined, 'the design is current: no rebuild');
  let row = rowsOf(orders, 'Orders')[rowIndex()];
  assert.equal(row[O('Status')], 'Confirmed');
  assert.equal(row[O('WhatsApp')], '=HYPERLINK("https://wa.me/919876501234","Chat")', 'a plain chat link once confirmed');
  assert.equal(row[O('COD call')], 'Confirmed on call');
  assert.equal(row[O('Notes')], 'Leave with the guard');

  advance(code, { status: 'dispatched', shiprocket_awb: '19041234567890', shiprocket_courier: 'Delhivery Surface', shiprocket_status: 'IN_TRANSIT' });
  result = await syncSheets({ route: 'test' });
  row = rowsOf(orders, 'Orders')[rowIndex()];
  assert.equal(row[O('Status')], 'Shipped');
  assert.equal(row[O('Courier')], 'Delhivery Surface');
  assert.equal(row[O('AWB')], '19041234567890');
  assert.equal(tab.grid[rowIndex()][O('AWB')].v.stringValue, '19041234567890', 'the AWB stays text, not 1.9E+13');
  assert.equal(row[O('Tracking')], '=HYPERLINK("https://www.shiprocket.co/tracking/19041234567890","Track")');
  assert.equal(row[O('Courier status')], 'In transit');
  assert.equal(typeof row[O('Shipped on')], 'number');
  assert.equal(row[O('COD call')], 'Confirmed on call');

  advance(code, { status: 'delivered', shiprocket_status: 'DELIVERED' });
  db.reviews.push({ order_id: db.orders.find((o) => o.order_code === code).id, rating: 5 });
  result = await syncSheets({ route: 'test' });
  row = rowsOf(orders, 'Orders')[rowIndex()];
  assert.equal(row[O('Status')], 'Delivered');
  assert.ok(row[O('Delivered on')] >= row[O('Shipped on')]);
  assert.equal(row[O('Review (stars)')], 5);
  const priya = rowsOf(books[CONTACTS_ID], 'Contacts').find((p) => p[K('Email')] === 'priya.s@example.com');
  assert.equal(priya[K('Last order status')], 'Delivered');
  assert.deepEqual(orders.lint(), []);
});

test('a sync with nothing new writes nothing but the status line', async () => {
  const before = { o: books[ORDERS_ID].calls.batch, c: books[CONTACTS_ID].calls.batch, meta: books[ORDERS_ID].calls.meta };
  const result = await syncSheets({ route: 'test' });
  assert.deepEqual(result.orders, { inserted: 0, updated: 0, removed: 0 });
  assert.deepEqual(result.contacts, { inserted: 0, updated: 0, removed: 0 });
  assert.equal(books[ORDERS_ID].calls.batch, before.o, 'no batchUpdate');
  assert.equal(books[CONTACTS_ID].calls.batch, before.c, 'no batchUpdate');
  assert.equal(books[ORDERS_ID].calls.meta, before.meta + 1, 'one metadata read to check the design version');
  assert.match(valueAt(books[ORDERS_ID], 'SyncStatus'), /\(0 new, 0 updated\)/);
});

test('a new design version rebuilds in place: same data, same inputs, no doubled rules', async () => {
  const orders = books[ORDERS_ID];
  orders.cell(orders.tab('Dashboard'), ...(() => { const r = orders.s.namedRanges.find((n) => n.name === 'Period').range; return [r.startRowIndex, r.startColumnIndex]; })()).v = { stringValue: 'This month' };
  const snapshot = (book) => ({
    data: rowsOf(book, book === orders ? 'Orders' : 'Contacts'),
    tabs: book.s.sheets.map((x) => [x.properties.title, x.conditionalFormats.length, x.bandedRanges.length, x.protectedRanges.length, x.charts.length, x.merges.length]),
    names: book.s.namedRanges.map((n) => n.name).sort(),
  });
  const before = { o: snapshot(orders), c: snapshot(books[CONTACTS_ID]) };
  for (const book of Object.values(books)) book.s.developerMetadata[0].metadataValue = '2026-01-01.1';

  const result = await syncSheets({ route: 'test' });
  assert.deepEqual(result.rebuilt, ['orders', 'contacts']);
  assert.deepEqual(snapshot(orders), before.o);
  assert.deepEqual(snapshot(books[CONTACTS_ID]), before.c);
  assert.equal(valueAt(orders, 'Period'), 'This month');
  assert.equal(valueAt(orders, 'BottlesReceived'), 120);
  assert.deepEqual(orders.lint(), []);

  const forced = await syncSheets({ route: 'test', rebuild: true });
  assert.deepEqual(forced.rebuilt, ['orders', 'contacts'], '/admin "Rebuild design" forces it');
  assert.deepEqual(snapshot(orders), before.o);
});

test('a brand-new spreadsheet gets every tab and the data', async () => {
  books = {
    [ORDERS_ID]: new FakeBook([{ title: 'Sheet1', sheetId: 0 }]),
    [CONTACTS_ID]: new FakeBook([{ title: 'Sheet1', sheetId: 0 }]),
  };
  const result = await syncSheets({ route: 'test' });
  assert.equal(result.status, 'ok', JSON.stringify(result));
  assert.deepEqual(books[ORDERS_ID].s.sheets.map((x) => x.properties.title), ['Dashboard', 'To do', 'Orders', 'Settings', 'Sheet1']);
  assert.equal(rowsOf(books[ORDERS_ID], 'Orders').length, 3, 'header + both database orders');
  assert.equal(valueAt(books[ORDERS_ID], 'LowStockAt'), 20, 'default low-stock warning');
  assert.deepEqual(books[ORDERS_ID].lint(), []);
  assert.deepEqual(books[CONTACTS_ID].lint(), []);
});

test('a column the owner moved stops that sheet only, with nothing written', async () => {
  const orders = books[ORDERS_ID];
  const tab = orders.tab('Orders');
  const [a, b] = [O('City'), O('State')];
  const swap = (r) => { const row = tab.grid[r]; [row[a], row[b]] = [row[b], row[a]]; };
  for (let r = 0; r < tab.grid.length; r += 1) if (tab.grid[r]) swap(r);
  orders.s.developerMetadata[0].metadataValue = 'old';
  const before = JSON.stringify(orders.s);
  advance(code, { status: 'delivered', refund_status: 'processed' });

  const result = await syncSheets({ route: 'test' });
  assert.match(result.ordersLayoutError, /Column "City" is out of place/);
  assert.match(result.ordersError, /header/i);
  assert.equal(JSON.stringify(orders.s), before, 'not one cell changed');
  assert.equal(result.contacts.inserted >= 0, true, 'the other spreadsheet still syncs');
});
