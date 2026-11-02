/*
 * "New order" alerts on the owner's phone: a push notification to every
 * device that turned alerts on in /admin (Settings → Order alerts).
 *
 * alertNewOrder() runs beside the owner's new-order email
 * (sendAdminNewOrderEmail), so every path that emails the owner also rings:
 * a COD order when it is saved, a prepaid order when its payment confirms.
 * Several prepaid paths can confirm the same order; a one-row claim per
 * order code (admin_settings "order-alert:<code>") makes sure it rings once.
 * Best-effort: a push failure never touches the order or the email.
 */
import { generateVapidKeys, sendPush } from './_push.js';
import { isMarkedTest } from './sheets-sync.js';

const base = () => (process.env.SUPABASE_URL || 'https://tnuqjydmoxczdjnsgpci.supabase.co').replace(/\/$/, '');
const key = () => process.env.SUPABASE_SERVICE_ROLE_KEY || '';

async function sb(path, { method = 'GET', body, prefer = 'return=representation' } = {}) {
  const res = await fetch(`${base()}/rest/v1/${path}`, {
    method,
    headers: { apikey: key(), Authorization: `Bearer ${key()}`, 'Content-Type': 'application/json', Prefer: prefer },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(8000),
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(data?.message || `Database error ${res.status}`);
  return data;
}

export async function getVapidKeys({ create = true } = {}) {
  const read = async () => (await sb('admin_settings?key=eq.vapid&select=value'))?.[0]?.value || null;
  let keys = await read();
  if (!keys && create) {
    await sb('admin_settings', { method: 'POST', prefer: 'resolution=ignore-duplicates,return=minimal', body: { key: 'vapid', value: await generateVapidKeys() } });
    keys = await read(); // another request may have won the race: use its keys
  }
  return keys;
}

const validSubscription = (s) => s && /^https:\/\/[^\s]+$/.test(s.endpoint || '') && typeof s.keys?.p256dh === 'string' && typeof s.keys?.auth === 'string'
  && s.keys.p256dh.length >= 80 && s.keys.p256dh.length <= 100 && s.keys.auth.length >= 16 && s.keys.auth.length <= 32;

export async function saveSubscription(subscription, label = '') {
  if (!validSubscription(subscription)) throw new Error('That device subscription is not valid.');
  const [row] = await sb('admin_push_subscriptions?on_conflict=endpoint', {
    method: 'POST',
    prefer: 'resolution=merge-duplicates,return=representation',
    body: { endpoint: subscription.endpoint, p256dh: subscription.keys.p256dh, auth: subscription.keys.auth, label: String(label || '').slice(0, 80) || null, failures: 0 },
  });
  return row;
}

export const removeSubscription = (endpoint) => sb(`admin_push_subscriptions?endpoint=eq.${encodeURIComponent(endpoint)}`, { method: 'DELETE', prefer: 'return=minimal' });
export const removeDevice = (id) => sb(`admin_push_subscriptions?id=eq.${id}`, { method: 'DELETE', prefer: 'return=minimal' });
export const listDevices = () => sb('admin_push_subscriptions?select=id,created_at,label,endpoint,last_sent_at,failures&order=created_at.desc');

export async function pushToAdmins(payload, { devices } = {}) {
  const subs = devices || await sb('admin_push_subscriptions?select=id,endpoint,p256dh,auth,failures');
  if (!subs?.length) return { sent: 0, failed: 0, removed: 0, devices: 0 };
  const keys = await getVapidKeys();
  const results = await Promise.allSettled(subs.map((s) => sendPush({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, keys)));
  let sent = 0, failed = 0, removed = 0;
  const now = new Date().toISOString();
  await Promise.all(results.map(async (r, i) => {
    const s = subs[i];
    try {
      if (r.status === 'fulfilled' && r.value.ok) { sent++; await sb(`admin_push_subscriptions?id=eq.${s.id}`, { method: 'PATCH', prefer: 'return=minimal', body: { last_sent_at: now, failures: 0 } }); }
      else if (r.status === 'fulfilled' && r.value.gone) { removed++; await removeDevice(s.id); }
      else { failed++; await sb(`admin_push_subscriptions?id=eq.${s.id}`, { method: 'PATCH', prefer: 'return=minimal', body: { failures: (s.failures || 0) + 1 } }); }
    } catch { /* bookkeeping only */ }
  }));
  return { sent, failed, removed, devices: subs.length };
}

const rupees = (paise) => `₹${Math.round(Number(paise || 0) / 100).toLocaleString('en-IN')}`;

export function orderAlert(order) {
  const a = order?.address || {};
  const cod = String(order?.payment_method || '').toLowerCase() === 'cod';
  const bottles = (Array.isArray(order?.items) ? order.items : []).reduce((s, i) => s + (Number(i?.quantity) || 0), 0) || 1;
  const test = isMarkedTest(order);
  return {
    kind: 'order',
    title: `${test ? 'Test order' : 'New order'} · ${rupees(order?.amount)} ${cod ? 'COD' : 'paid'}`,
    body: [a.name, a.city, `${bottles} bottle${bottles === 1 ? '' : 's'}`, order?.order_code].filter(Boolean).join(' · '),
    tag: order?.order_code || 'order',
    url: `/admin#orders/${order?.order_code || ''}`,
  };
}

export async function alertNewOrder(order) {
  if (!key() || !order?.order_code) return { skipped: true };
  const devices = await sb('admin_push_subscriptions?select=id,endpoint,p256dh,auth,failures');
  if (!devices?.length) return { skipped: true, reason: 'no devices' };
  // Once per order: the first path to claim the code sends it.
  const claimed = await sb('admin_settings', { method: 'POST', prefer: 'resolution=ignore-duplicates,return=representation', body: { key: `order-alert:${order.order_code}`, value: { at: new Date().toISOString() } } });
  if (!claimed?.length) return { skipped: true, reason: 'already alerted' };
  return pushToAdmins(orderAlert(order), { devices });
}
