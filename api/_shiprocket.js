import { BASE_PRODUCT } from '../shared/products-config-workers.js';

const API_BASE = 'https://apiv2.shiprocket.in/v1/external';

let tokenCache = null;
let tokenExpiresAt = 0;
let pickupLocationCache = null;
let pickupLocationCacheExpiresAt = 0;

const DEFAULT_PICKUP_LOCATION = 'Opposite ANcorner bakery';
const DEFAULT_CHANNEL_ID = '41464314146431';

export function isShiprocketConfigured() {
  return Boolean(process.env.SHIPROCKET_EMAIL && process.env.SHIPROCKET_PASSWORD);
}

function missingConfigError() {
  const err = new Error('Shiprocket is not configured. Set SHIPROCKET_EMAIL and SHIPROCKET_PASSWORD.');
  err.code = 'SHIPROCKET_NOT_CONFIGURED';
  return err;
}

async function parseResponse(response) {
  const text = await response.text().catch(() => '');
  if (!text) return {};
  try { return JSON.parse(text); } catch { return { raw: text.slice(0, 2000) }; }
}

async function login() {
  if (!isShiprocketConfigured()) throw missingConfigError();
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: process.env.SHIPROCKET_EMAIL, password: process.env.SHIPROCKET_PASSWORD }),
    signal: AbortSignal.timeout(15000)
  });
  const data = await parseResponse(response);
  if (!response.ok || !data.token) {
    const err = new Error(`Shiprocket authentication failed: ${data.message || data.error || `Authentication failed (${response.status})`}`);
    err.code = 'SHIPROCKET_AUTH_FAILED';
    err.status = response.status;
    throw err;
  }
  tokenCache = data.token;
  tokenExpiresAt = Date.now() + 9 * 24 * 60 * 60 * 1000;
  return tokenCache;
}

async function getToken(forceRefresh = false) {
  if (!forceRefresh && tokenCache && Date.now() < tokenExpiresAt) return tokenCache;
  return login();
}

export async function shiprocketRequest(path, options = {}, retried = false) {
  const token = await getToken(retried);
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(options.headers || {}) },
    signal: options.signal || AbortSignal.timeout(20000)
  });
  const data = await parseResponse(response);
  if (response.status === 401 && !retried) {
    tokenCache = null;
    tokenExpiresAt = 0;
    pickupLocationCache = null;
    pickupLocationCacheExpiresAt = 0;
    return shiprocketRequest(path, options, true);
  }
  if (!response.ok) {
    const message = data.message || data.error || data.errors || data.raw || `HTTP ${response.status}`;
    const err = new Error(`Shiprocket API error: ${typeof message === 'string' ? message : JSON.stringify(message)}`);
    err.code = 'SHIPROCKET_API_ERROR';
    err.status = response.status;
    err.data = data;
    throw err;
  }
  return data;
}

function norm(value) { return String(value || '').trim().toLowerCase().replace(/\s+/g, ' '); }
function configuredPickupValue() { return String(process.env.SHIPROCKET_PICKUP_LOCATION || DEFAULT_PICKUP_LOCATION).trim(); }
function configuredChannelId() {
  const raw = String(process.env.SHIPROCKET_CHANNEL_ID || DEFAULT_CHANNEL_ID).trim();
  return raw && /^\d+$/.test(raw) ? Number(raw) : null;
}

export async function resolvePickupLocation() {
  if (pickupLocationCache && Date.now() < pickupLocationCacheExpiresAt) return pickupLocationCache;
  const configured = configuredPickupValue();
  const data = await shiprocketRequest('/settings/company/pickup', { method: 'GET' });
  const locations = Array.isArray(data?.data?.shipping_address) ? data.data.shipping_address : [];
  if (!locations.length) {
    const err = new Error('Shiprocket has no pickup locations configured in the account.');
    err.code = 'SHIPROCKET_NO_PICKUP_LOCATIONS';
    throw err;
  }
  const target = norm(configured);
  let match = locations.find(x => norm(x.pickup_location) === target);
  if (!match) {
    const wantedPin = (configured.match(/\b\d{6}\b/) || [])[0] || '';
    if (wantedPin) match = locations.find(x => String(x.pin_code || '').trim() === wantedPin);
  }
  if (!match && norm(DEFAULT_PICKUP_LOCATION) !== target) match = locations.find(x => norm(x.pickup_location) === norm(DEFAULT_PICKUP_LOCATION));
  if (!match) {
    const available = locations.map(x => String(x.pickup_location || '').trim()).filter(Boolean);
    const err = new Error(`Shiprocket pickup location not found: "${configured}". Available locations: ${available.join(', ') || 'none'}`);
    err.code = 'SHIPROCKET_PICKUP_NOT_FOUND';
    throw err;
  }
  pickupLocationCache = {
    name: String(match.pickup_location || '').trim(),
    address: String(match.address || '').trim(),
    city: String(match.city || '').trim(),
    state: String(match.state || '').trim(),
    pinCode: String(match.pin_code || '').trim(),
    id: match.id ?? null
  };
  pickupLocationCacheExpiresAt = Date.now() + 10 * 60 * 1000;
  return pickupLocationCache;
}

export async function createShiprocketOrder(order) {
  const address = order.address || {};
  const item = Array.isArray(order.items) && order.items.length ? order.items[0] : {};
  const quantity = Math.max(1, Number(item.quantity || 1));
  const unitPrice = Number(item.unit_price ?? item.price ?? BASE_PRODUCT.price);
  const subtotal = Number(order.amount || 0) / 100 - Number(order.cod_fee || 0) / 100;
  const pickup = await resolvePickupLocation();
  const channelId = configuredChannelId();
  const perUnitWeightKg = Number(process.env.SHIPROCKET_ITEM_WEIGHT_KG || '0.12');
  const lengthCm = Number(process.env.SHIPROCKET_LENGTH_CM || '15');
  const breadthCm = Number(process.env.SHIPROCKET_BREADTH_CM || '10');
  const heightCm = Number(process.env.SHIPROCKET_HEIGHT_CM || '6');
  const paymentMethod = String(order.payment_method || '').toLowerCase() === 'cod' ? 'COD' : 'Prepaid';
  const safeSubtotal = Math.max(0, Math.round(subtotal));

  const payload = {
    order_id: String(order.order_code),
    order_date: new Date(order.created_at || Date.now()).toISOString().slice(0, 10),
    pickup_location: pickup.name,
    ...(channelId ? { channel_id: channelId } : {}),
    comment: `Smelloff order ${order.order_code}`,
    billing_customer_name: String(address.name || '').trim(),
    billing_last_name: '',
    billing_address: String(address.line || '').trim(),
    billing_address_2: '',
    billing_isd_code: '91',
    billing_city: String(address.city || '').trim(),
    billing_pincode: String(address.pincode || '').trim(),
    billing_state: String(address.state || '').trim(),
    billing_country: 'India',
    billing_email: String(order.customer_email || '').trim(),
    billing_phone: String(order.customer_phone || '').replace(/\D/g, '').slice(-10),
    billing_alternate_phone: '',
    shipping_is_billing: true,
    shipping_customer_name: String(address.name || '').trim(),
    shipping_last_name: '',
    shipping_address: String(address.line || '').trim(),
    shipping_address_2: '',
    shipping_city: String(address.city || '').trim(),
    shipping_pincode: String(address.pincode || '').trim(),
    shipping_state: String(address.state || '').trim(),
    shipping_country: 'India',
    shipping_email: String(order.customer_email || '').trim(),
    shipping_isd_code: '91',
    shipping_phone: String(order.customer_phone || '').replace(/\D/g, '').slice(-10),
    order_items: [{
      name: String(item.name || BASE_PRODUCT.shortTitle || BASE_PRODUCT.title),
      sku: String(item.sku || BASE_PRODUCT.sku),
      units: quantity,
      selling_price: unitPrice,
      discount: 0,
      tax: '',
      hsn: ''
    }],
    payment_method: paymentMethod,
    shipping_charges: 0,
    giftwrap_charges: 0,
    transaction_charges: 0,
    total_discount: 0,
    sub_total: safeSubtotal,
    length: lengthCm,
    breadth: breadthCm,
    height: heightCm,
    // Carrier billing minimum is handled by Shiprocket; don't understate it in
    // our own request payload. Store an actual packed-weight value instead.
    weight: Math.max(0.5, Number((perUnitWeightKg * quantity).toFixed(3))),
    invoice_number: String(order.order_code)
  };

  return shiprocketRequest('/orders/create/adhoc', { method: 'POST', body: JSON.stringify(payload) });
}

export async function getShiprocketShipment(shipmentId) {
  return shiprocketRequest(`/shipments/${encodeURIComponent(String(shipmentId))}`, { method: 'GET' });
}
export async function trackShiprocketAwb(awb) {
  return shiprocketRequest(`/courier/track/awb/${encodeURIComponent(String(awb))}`, { method: 'GET' });
}
export function extractShiprocketIds(data) {
  if (!data) return { orderId: null, shipmentId: null, awb: null, courier: null };
  const root = data?.data && typeof data.data === 'object' ? data.data : data || {};
  const item = Array.isArray(root) ? root[0] : root;
  const shipment = Array.isArray(item?.shipments) && item.shipments.length
    ? item.shipments[0]
    : (item?.shipments && typeof item.shipments === 'object' ? item.shipments : {});
  return {
    orderId: item?.order_id ?? item?.orderId ?? item?.shiprocket_order_id ?? item?.id ?? null,
    shipmentId: item?.shipment_id ?? item?.shipmentId ?? shipment?.id ?? shipment?.shipment_id ?? null,
    awb: item?.awb_code ?? item?.awb ?? shipment?.awb ?? shipment?.awb_code ?? null,
    courier: item?.courier_name ?? item?.courier ?? shipment?.courier ?? shipment?.courier_name ?? null
  };
}

export function isDuplicateOrderError(err) {
  if (!err) return false;
  const status = err.status || err.statusCode || err.response?.status;
  const msg = String(err.message || err.data?.message || err.data?.error || '').toLowerCase();
  if (status === 422 || status === 409) return true;
  if (msg.includes('already been taken') || msg.includes('already exists') || msg.includes('duplicate order') || msg.includes('order id has already')) {
    return true;
  }
  return false;
}

export async function findShiprocketOrderByOrderCode(orderCode) {
  if (!orderCode) return null;

  if (typeof globalThis.__MOCK_SHIPROCKET_SERVICE__ !== 'undefined') {
    const mockService = globalThis.__MOCK_SHIPROCKET_SERVICE__;
    if (typeof mockService.findByOrderCode === 'function') {
      const match = await mockService.findByOrderCode(orderCode);
      return match ? extractShiprocketIds(match) : null;
    }
  }

  if (!isShiprocketConfigured()) return null;

  try {
    const data = await shiprocketRequest(`/orders?channel_order_id=${encodeURIComponent(String(orderCode))}`, { method: 'GET' });
    const ordersList = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : []);
    const match = ordersList.find(o =>
      String(o.channel_order_id || o.order_id || '').trim().toLowerCase() === String(orderCode).trim().toLowerCase()
    );
    if (match) {
      return extractShiprocketIds(match);
    }
  } catch (err) {
    console.error('[shiprocket] Reconciliation lookup error:', err.message);
  }
  return null;
}

function supaHeaders(extra = {}) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

/**
 * Distributed atomic claim for Shiprocket fulfillment creation.
 * Guarantees at most ONE worker across the serverless fleet can execute
 * createShiprocketOrder for a given order, preventing duplicate carrier shipments.
 */
export async function claimShiprocketFulfillment(orderCode, claimId, staleSeconds = 120) {
  if (!orderCode) return { claimed: false, alreadyCreated: false };

  // 1. Mock DB check for deterministic concurrency testing & simulation
  if (typeof globalThis.__MOCK_ORDER_DB__ !== 'undefined') {
    const db = globalThis.__MOCK_ORDER_DB__;
    const order = typeof db.get === 'function' ? db.get(orderCode) : db[orderCode];
    if (!order) return { claimed: false, alreadyCreated: false };
    if (order.shiprocket_order_id) {
      return {
        claimed: false,
        alreadyCreated: true,
        shiprocketOrderId: order.shiprocket_order_id,
        shiprocketShipmentId: order.shiprocket_shipment_id,
        shiprocketAwb: order.shiprocket_awb,
        shiprocketCourier: order.shiprocket_courier
      };
    }
    const eligible = ['placed', 'confirmed', 'packed', 'dispatched', 'out_for_delivery', 'delivered'];
    if (!eligible.includes(String(order.status || '').toLowerCase())) {
      return { claimed: false, alreadyCreated: false, ineligible: true };
    }
    const now = Date.now();
    const claimedAt = order.shiprocket_claimed_at ? new Date(order.shiprocket_claimed_at).getTime() : null;
    const isStale = claimedAt ? (now - claimedAt > staleSeconds * 1000) : true;
    if (claimedAt && !isStale && order.shiprocket_claim_id !== claimId) {
      return { claimed: false, alreadyCreated: false, inProgress: true };
    }
    order.shiprocket_claimed_at = new Date(now).toISOString();
    order.shiprocket_claim_id = claimId;
    return { claimed: true, alreadyCreated: false };
  }

  // 2. Production Supabase RPC execution
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!key) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for Shiprocket fulfillment claiming.');
  }

  const supabaseUrl = (process.env.SUPABASE_URL || 'https://tnuqjydmoxczdjnsgpci.supabase.co').replace(/\/$/, '');

  try {
    const rpcRes = await fetch(`${supabaseUrl}/rest/v1/rpc/claim_shiprocket_fulfillment`, {
      method: 'POST',
      headers: supaHeaders(),
      body: JSON.stringify({
        p_order_code: orderCode,
        p_claim_id: claimId,
        p_stale_seconds: staleSeconds
      }),
      signal: AbortSignal.timeout(10000)
    });

    if (rpcRes.ok) {
      const rows = await rpcRes.json();
      const row = Array.isArray(rows) && rows.length ? rows[0] : rows;
      if (row && typeof row === 'object') {
        return {
          claimed: Boolean(row.claimed),
          alreadyCreated: Boolean(row.already_created),
          inProgress: !row.claimed && !row.already_created,
          shiprocketOrderId: row.existing_shiprocket_order_id || null
        };
      }
    }
  } catch (err) {
    console.error('[shiprocket] RPC claim error:', err.message);
  }

  // Fallback: PostgREST atomic conditional update
  try {
    const patchRes = await fetch(`${supabaseUrl}/rest/v1/orders?order_code=eq.${encodeURIComponent(orderCode)}&shiprocket_order_id=is.null`, {
      method: 'PATCH',
      headers: supaHeaders({ Prefer: 'return=representation' }),
      body: JSON.stringify({
        shiprocket_claimed_at: new Date().toISOString(),
        shiprocket_claim_id: claimId
      }),
      signal: AbortSignal.timeout(10000)
    });
    if (patchRes.ok) {
      const data = await patchRes.json();
      if (Array.isArray(data) && data.length > 0) {
        return { claimed: true, alreadyCreated: false };
      }
    }
  } catch (err) {
    console.error('[shiprocket] Fallback claim error:', err.message);
  }

  return { claimed: false, alreadyCreated: false, inProgress: true };
}

/**
 * Permanently finalizes Shiprocket fulfillment identifiers and clears the atomic claim.
 */
export async function finalizeShiprocketFulfillment(orderCode, claimId, ids = {}) {
  if (!orderCode) return false;

  const orderId = ids.orderId ? Number(ids.orderId) : null;
  const shipmentId = ids.shipmentId ? Number(ids.shipmentId) : null;
  const awb = ids.awb ? String(ids.awb) : null;
  const courier = ids.courier ? String(ids.courier) : null;

  if (typeof globalThis.__MOCK_ORDER_DB__ !== 'undefined') {
    const db = globalThis.__MOCK_ORDER_DB__;
    const order = typeof db.get === 'function' ? db.get(orderCode) : db[orderCode];
    if (order) {
      order.shiprocket_order_id = orderId;
      order.shiprocket_shipment_id = shipmentId;
      order.shiprocket_awb = awb;
      order.shiprocket_courier = courier;
      order.shiprocket_status = 'ORDER_CREATED';
      order.shiprocket_synced_at = new Date().toISOString();
      order.shiprocket_claimed_at = null;
      order.shiprocket_claim_id = null;
      order.shiprocket_error = null;
      return true;
    }
    return false;
  }

  const supabaseUrl = (process.env.SUPABASE_URL || 'https://tnuqjydmoxczdjnsgpci.supabase.co').replace(/\/$/, '');

  try {
    const rpcRes = await fetch(`${supabaseUrl}/rest/v1/rpc/finalize_shiprocket_fulfillment`, {
      method: 'POST',
      headers: supaHeaders(),
      body: JSON.stringify({
        p_order_code: orderCode,
        p_claim_id: claimId,
        p_shiprocket_order_id: orderId,
        p_shiprocket_shipment_id: shipmentId,
        p_shiprocket_awb: awb,
        p_shiprocket_courier: courier
      }),
      signal: AbortSignal.timeout(10000)
    });
    if (rpcRes.ok) {
      const res = await rpcRes.json();
      if (res === true || (Array.isArray(res) && res[0] === true)) return true;
    }
  } catch (err) {
    console.error('[shiprocket] RPC finalize error:', err.message);
  }

  // Fallback direct patch
  try {
    const patchRes = await fetch(`${supabaseUrl}/rest/v1/orders?order_code=eq.${encodeURIComponent(orderCode)}`, {
      method: 'PATCH',
      headers: supaHeaders({ Prefer: 'return=minimal' }),
      body: JSON.stringify({
        shiprocket_order_id: orderId,
        shiprocket_shipment_id: shipmentId,
        shiprocket_awb: awb,
        shiprocket_courier: courier,
        shiprocket_status: 'ORDER_CREATED',
        shiprocket_synced_at: new Date().toISOString(),
        shiprocket_claimed_at: null,
        shiprocket_claim_id: null,
        shiprocket_error: null
      }),
      signal: AbortSignal.timeout(10000)
    });
    return patchRes.ok;
  } catch (err) {
    console.error('[shiprocket] Fallback finalize error:', err.message);
    return false;
  }
}

/**
 * Releases the atomic claim upon Shiprocket creation error so future syncs/retries can proceed.
 */
export async function releaseShiprocketFulfillmentClaim(orderCode, claimId, errorMessage = null) {
  if (!orderCode) return false;

  if (typeof globalThis.__MOCK_ORDER_DB__ !== 'undefined') {
    const db = globalThis.__MOCK_ORDER_DB__;
    const order = typeof db.get === 'function' ? db.get(orderCode) : db[orderCode];
    if (order) {
      order.shiprocket_claimed_at = null;
      order.shiprocket_claim_id = null;
      if (errorMessage) {
        order.shiprocket_error = String(errorMessage).slice(0, 1000);
      }
      order.shiprocket_synced_at = new Date().toISOString();
      return true;
    }
    return false;
  }

  const supabaseUrl = (process.env.SUPABASE_URL || 'https://tnuqjydmoxczdjnsgpci.supabase.co').replace(/\/$/, '');

  try {
    const rpcRes = await fetch(`${supabaseUrl}/rest/v1/rpc/release_shiprocket_fulfillment_claim`, {
      method: 'POST',
      headers: supaHeaders(),
      body: JSON.stringify({
        p_order_code: orderCode,
        p_claim_id: claimId,
        p_error_message: errorMessage ? String(errorMessage).slice(0, 1000) : null
      }),
      signal: AbortSignal.timeout(10000)
    });
    if (rpcRes.ok) return true;
  } catch (err) {
    console.error('[shiprocket] RPC release error:', err.message);
  }

  try {
    const patchRes = await fetch(`${supabaseUrl}/rest/v1/orders?order_code=eq.${encodeURIComponent(orderCode)}`, {
      method: 'PATCH',
      headers: supaHeaders({ Prefer: 'return=minimal' }),
      body: JSON.stringify({
        shiprocket_claimed_at: null,
        shiprocket_claim_id: null,
        shiprocket_error: errorMessage ? String(errorMessage).slice(0, 1000) : null,
        shiprocket_synced_at: new Date().toISOString()
      }),
      signal: AbortSignal.timeout(10000)
    });
    return patchRes.ok;
  } catch (err) {
    console.error('[shiprocket] Fallback release error:', err.message);
    return false;
  }
}

