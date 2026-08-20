import crypto from 'node:crypto';

const PAYU_MID = process.env.PAYU_MID || '';
const PAYU_KEY = process.env.PAYU_KEY || '';
const PAYU_SALT = process.env.PAYU_SALT || '';
const PAYU_BASE_URL = (process.env.PAYU_BASE_URL || 'https://info.payu.in').replace(/\/$/, '');

function sha512(value) {
  return crypto.createHash('sha512').update(value, 'utf8').digest('hex');
}

function timingSafeEqualHex(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a.toLowerCase(), 'utf8'), Buffer.from(b.toLowerCase(), 'utf8'));
  } catch {
    return false;
  }
}

export function isPayuConfigured() {
  return Boolean(PAYU_MID && PAYU_KEY && PAYU_SALT);
}

export function payuConfigError() {
  if (!PAYU_MID) return 'PAYU_MID is not configured.';
  if (!PAYU_KEY) return 'PAYU_KEY is not configured.';
  if (!PAYU_SALT) return 'PAYU_SALT is not configured.';
  return null;
}

export async function createPayuUpiIntent({ transactionId, amount }) {
  if (!isPayuConfigured()) throw new Error(payuConfigError());
  const url = `${PAYU_BASE_URL}/v1/intent`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      mid: PAYU_MID,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      transactionId,
      transactionAmount: Number(amount).toFixed(2),
      expiryTime: '1800',
      refUrl: 'https://smelloff.in/odorstrike',
      category: '01'
    })
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload || payload.status !== 1 || !payload.result) {
    const message = payload?.message || payload?.msg || `PayU intent request failed (${response.status})`;
    throw new Error(message);
  }

  const intentUri = payload.result.intentUri || payload.result.intentId;
  const intentUrl = payload.result.intentUrl || payload.result.intentUrlWithQR || '';
  if (!intentUri) throw new Error('PayU did not return a UPI intent URI.');

  return {
    intentUri,
    intentUrl,
    transactionId: payload.result.transactionId || transactionId,
    expiryTime: payload.result.expiryTime || 1800
  };
}

export async function verifyPayuPayment(transactionId) {
  if (!isPayuConfigured()) throw new Error(payuConfigError());
  if (!transactionId) throw new Error('PayU transaction ID is required.');

  const command = 'verify_payment';
  const hash = sha512(`${PAYU_KEY}|${command}|${transactionId}|${PAYU_SALT}`);
  const body = new URLSearchParams({
    key: PAYU_KEY,
    command,
    var1: transactionId,
    hash
  });

  const response = await fetch(`${PAYU_BASE_URL}/merchant/postservice.php?form=2`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload) {
    throw new Error(`PayU verify_payment failed (${response.status})`);
  }

  const details = payload?.transaction_details;
  let tx = null;
  if (details && typeof details === 'object') {
    tx = details[transactionId] || Object.values(details)[0] || null;
  }

  const status = String(tx?.status || tx?.unmappedstatus || '').toLowerCase();
  const amount = Number(tx?.amount ?? tx?.amt ?? NaN);
  const success = payload.status === 1 && (status === 'success' || status === 'captured' || status === 'successfully completed');

  return {
    success,
    status: status || 'unknown',
    amount: Number.isFinite(amount) ? amount : null,
    payuTxnId: tx?.mihpayid || tx?.payuid || null,
    bankRef: tx?.bank_ref_num || tx?.bank_ref_no || null,
    raw: payload
  };
}

export function verifyPayuResponseHash(params) {
  if (!params || !params.hash || !params.status || !params.txnid || !params.amount || !params.productinfo || !params.firstname || params.email == null || !params.key) {
    return false;
  }

  const hashString = [
    PAYU_SALT,
    params.status,
    '', '', '', '', '',
    params.udf5 || '',
    params.udf4 || '',
    params.udf3 || '',
    params.udf2 || '',
    params.udf1 || '',
    params.email || '',
    params.firstname || '',
    params.productinfo || '',
    params.amount || '',
    params.txnid || '',
    params.key || PAYU_KEY
  ].join('|');

  return timingSafeEqualHex(sha512(hashString), String(params.hash));
}

export function getPayuPublicConfig() {
  return {
    mid: PAYU_MID,
    configured: isPayuConfigured()
  };
}
