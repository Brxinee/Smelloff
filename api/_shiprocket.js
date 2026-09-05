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
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text.slice(0, 2000) };
  }
}

async function login() {
  if (!process.env.SHIPROCKET_EMAIL || !process.env.SHIPROCKET_PASSWORD) {
    throw missingConfigError();
  }

  const response = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: process.env.SHIPROCKET_EMAIL,
      password: process.env.SHIPROCKET_PASSWORD
    }),
    signal: AbortSignal.timeout(15000)
  });

  const data = await parseResponse(response);
  if (!response.ok || !data.token) {
    const message = data.message || data.error || `Authentication failed (${response.status})`;
    const err = new Error(`Shiprocket authentication failed: ${message}`);
    err.code = 'SHIPROCKET_AUTH_FAILED';
    err.status = response.status;
    throw err;
  }

  tokenCache = data.token;
  tokenExpiresAt = Date.now() + (9 * 24 * 60 * 60 * 1000);
  return tokenCache;
}

async function getToken(forceRefresh = false) {
  if (!forceRefresh && tokenCache && Date.now() < tokenExpiresAt) return tokenCache;
  return login();
}

export async function shiprocketRequest(path, options = {}, retried = false) {
  if (!isShiprocketConfigured()) throw missingConfigError();

  const token = await getToken(retried);
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    ...(options.headers || {})
  };

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
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

function norm(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function configuredPickupValue() {
  return String(process.env.SHIPROCKET_PICKUP_LOCATION || DEFAULT_PICKUP_LOCATION).trim();
}

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
    if (wantedPin) {
      match = locations.find(x => String(x.pin_code || '').trim() === wantedPin);
    }
  }

  if (!match && norm(DEFAULT_PICKUP_LOCATION) !== target) {
    match = locations.find(x => norm(x.pickup_location) === norm(DEFAULT_PICKUP_LOCATION));
  }

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
  const unitPrice = Number(item.unit_price || 0);
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
      name: String(item.name || 'Smelloff ODORSTRIKE 50ml'),
      sku: String(item.sku || 'OS-001-50ML'),
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
    weight: Math.max(0.001, Number((perUnitWeightKg * quantity).toFixed(3))),
    invoice_number: String(order.order_code)
  };

  return shiprocketRequest('/orders/create/adhoc', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function getShiprocketShipment(shipmentId) {
  return shiprocketRequest(`/shipments/${encodeURIComponent(String(shipmentId))}`, { method: 'GET' });
}

export async function trackShiprocketAwb(awb) {
  return shiprocketRequest(`/courier/track/awb/${encodeURIComponent(String(awb))}`, { method: 'GET' });
}

export function extractShiprocketIds(data) {
  const root = data?.data && typeof data.data === 'object' ? data.data : data || {};
  return {
    orderId: root.order_id ?? root.orderId ?? root.shiprocket_order_id ?? null,
    shipmentId: root.shipment_id ?? root.shipmentId ?? null,
    awb: root.awb_code ?? root.awb ?? null,
    courier: root.courier_name ?? root.courier ?? null
  };
}
