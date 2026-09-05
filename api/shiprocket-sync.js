import { isAllowedOrigin, clientIp, checkRateLimit, isAdminAuthorized } from './_security.js';
import { createShiprocketOrder, getShiprocketShipment, trackShiprocketAwb, extractShiprocketIds, isShiprocketConfigured } from './_shiprocket.js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://tnuqjydmoxczdjnsgpci.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const STATUS_RANK = {
  upi_pending: 0,
  placed: 1,
  confirmed: 2,
  packed: 3,
  dispatched: 4,
  out_for_delivery: 5,
  delivered: 6,
  cancelled: 99,
  payment_not_verified: 99,
  failed: 99,
  verification_pending: 99
};

function mapShiprocketStatus(currentStatus) {
  const status = String(currentStatus || '').trim().toLowerCase();
  if (status === 'delivered') return 'delivered';
  if (status === 'out for delivery' || status === 'out_for_delivery') return 'out_for_delivery';
  if (status === 'in transit' || status === 'shipped' || status === 'picked up' || status === 'handover to courier') return 'dispatched';
  if (status === 'packed') return 'packed';
  return null;
}

async function supabaseFetch(path, options = {}) {
  if (!SERVICE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured.');
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    signal: options.signal || AbortSignal.timeout(15000)
  });
  if (!response.ok) throw new Error(`Supabase ${response.status}: ${await response.text().catch(() => '')}`);
  return response;
}

async function getOrder(orderCode) {
  const response = await supabaseFetch(`orders?order_code=eq.${encodeURIComponent(orderCode)}&limit=1`);
  const data = await response.json().catch(() => []);
  return Array.isArray(data) && data.length ? data[0] : null;
}

async function listSyncCandidates(limit = 50) {
  const params = new URLSearchParams({
    select: '*',
    status: 'in.(placed,confirmed,packed,dispatched,out_for_delivery,delivered)',
    order: 'created_at.desc',
    limit: String(Math.min(50, Math.max(1, limit)))
  });
  const response = await supabaseFetch(`orders?${params.toString()}`);
  const data = await response.json().catch(() => []);
  return Array.isArray(data) ? data : [];
}

async function patchOrder(orderCode, patch) {
  await supabaseFetch(`orders?order_code=eq.${encodeURIComponent(orderCode)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      ...patch,
      shiprocket_synced_at: new Date().toISOString()
    })
  });
}

async function createMissingShiprocketOrder(order) {
  if (!order || order.shiprocket_order_id) return null;
  if (!['placed', 'confirmed', 'packed', 'dispatched', 'out_for_delivery', 'delivered'].includes(String(order.status || '').toLowerCase())) return null;

  try {
    const response = await createShiprocketOrder(order);
    const ids = extractShiprocketIds(response);
    const patch = {
      shiprocket_order_id: ids.orderId ? Number(ids.orderId) : null,
      shiprocket_shipment_id: ids.shipmentId ? Number(ids.shipmentId) : null,
      shiprocket_awb: ids.awb ? String(ids.awb) : null,
      shiprocket_courier: ids.courier ? String(ids.courier) : null,
      shiprocket_status: 'ORDER_CREATED',
      shiprocket_error: null
    };
    if (!patch.shiprocket_order_id) {
      throw new Error('Shiprocket accepted the request but did not return an order ID.');
    }
    await patchOrder(order.order_code, patch);
    return { status: 'created', ...patch };
  } catch (err) {
    await supabaseFetch(`orders?order_code=eq.${encodeURIComponent(order.order_code)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        shiprocket_error: String(err.message || 'Shiprocket create failed').slice(0, 1000),
        shiprocket_synced_at: new Date().toISOString()
      })
    }).catch(() => {});
    return { status: 'create_failed', error: String(err.message || 'Shiprocket create failed').slice(0, 500) };
  }
}

async function syncSingleOrder(order) {
  if (!order) return { orderCode: null, status: 'skipped' };

  let createResult = null;
  if (!order.shiprocket_order_id) {
    createResult = await createMissingShiprocketOrder(order);
    if (!order.shiprocket_order_id) {
      return { orderCode: order.order_code, status: createResult?.status || 'skipped', error: createResult?.error || null };
    }
    order = { ...order, ...createResult };
  }

  let shipment = null;
  let awb = order.shiprocket_awb || null;
  let courier = order.shiprocket_courier || null;
  let shiprocketStatus = order.shiprocket_status || null;
  let trackingData = null;

  try {
    if (order.shiprocket_shipment_id) {
      shipment = await getShiprocketShipment(order.shiprocket_shipment_id);
      const ids = extractShiprocketIds(shipment);
      awb = awb || ids.awb;
      courier = courier || ids.courier;
    }

    if (awb) {
      trackingData = await trackShiprocketAwb(awb);
      const td = trackingData?.tracking_data || {};
      const track = Array.isArray(td.shipment_track) && td.shipment_track.length ? td.shipment_track[0] : null;
      shiprocketStatus = track?.current_status || td.shipment_status || shiprocketStatus;
      courier = courier || track?.courier_name || null;
    }

    const nextStatus = mapShiprocketStatus(shiprocketStatus);
    const currentRank = STATUS_RANK[order.status] ?? 0;
    const nextRank = nextStatus ? (STATUS_RANK[nextStatus] ?? 0) : currentRank;
    const statusPatch = nextStatus && nextRank >= currentRank && nextStatus !== order.status
      ? { status: nextStatus, updated_at: new Date().toISOString() }
      : {};

    const patch = {
      ...statusPatch,
      ...(awb ? { shiprocket_awb: String(awb), tracking_id: String(awb), tracking_url: 'https://www.shiprocket.co/tracking/' } : {}),
      ...(courier ? { shiprocket_courier: String(courier), courier: String(courier) } : {}),
      ...(shiprocketStatus ? { shiprocket_status: String(shiprocketStatus) } : {}),
      shiprocket_error: null
    };

    if (Object.keys(patch).length) await patchOrder(order.order_code, patch);

    return {
      orderCode: order.order_code,
      status: createResult ? 'created_and_synced' : 'synced',
      localStatus: statusPatch.status || order.status,
      shiprocketStatus,
      awb,
      courier
    };
  } catch (err) {
    await supabaseFetch(`orders?order_code=eq.${encodeURIComponent(order.order_code)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        shiprocket_error: String(err.message || 'Shiprocket sync failed').slice(0, 1000),
        shiprocket_synced_at: new Date().toISOString()
      })
    }).catch(() => {});
    return { orderCode: order.order_code, status: 'failed', error: String(err.message || 'Shiprocket sync failed').slice(0, 500) };
  }
}

function isCronAuthorized(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = String(req.headers.authorization || '');
  return auth === `Bearer ${secret}`;
}

export default async function handler(req, res) {
  res.setHeader('X-Powered-By', 'Smelloff-Shiprocket');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  const origin = req.headers.origin;
  if (origin) {
    if (!isAllowedOrigin(origin)) return res.status(403).json({ error: 'Origin not allowed' });
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Key, X-Admin-Secret');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const cronRequest = req.method === 'GET' && isCronAuthorized(req);
  if (!cronRequest && !isAdminAuthorized(req)) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }

  if (!isShiprocketConfigured()) {
    return res.status(503).json({ error: 'Shiprocket is not configured.' });
  }

  const ip = clientIp(req);
  if (!checkRateLimit(`shiprocket-sync:${ip}`, 60, 10 * 60 * 1000)) {
    return res.status(429).json({ error: 'Rate limit exceeded.' });
  }

  try {
    if (req.method === 'POST') {
      const body = req.body && typeof req.body === 'object' ? req.body : {};
      const orderCode = String(body.orderCode || body.order_code || '').trim().toUpperCase();
      if (!/^SMF-\d{8}-\d{4}$/.test(orderCode)) {
        return res.status(400).json({ error: 'Valid Smelloff order code required.' });
      }
      const order = await getOrder(orderCode);
      if (!order) return res.status(404).json({ error: 'Order not found.' });
      return res.status(200).json(await syncSingleOrder(order));
    }

    const orders = await listSyncCandidates(50);
    const results = [];
    for (const order of orders) {
      results.push(await syncSingleOrder(order));
    }

    return res.status(200).json({
      ok: true,
      scanned: orders.length,
      results
    });
  } catch (err) {
    console.error('[shiprocket-sync] Error:', err);
    return res.status(500).json({ error: 'Shiprocket sync failed.' });
  }
}
