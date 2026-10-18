// Mirrors orders and customer contacts from Supabase into the owner's two
// Google Sheets. Runs after every order event (COD placed, prepaid confirmed)
// and on the 15-minute cron, so status, courier and AWB changes reach the
// sheet too. It used to be a browser beacon to an Apps Script, which wrote
// every order twice, missed prepaid orders entirely and accepted rows from
// anyone who found the URL.
import { syncTab, isSheetsConfigured, toSheetDate } from './_google-sheets.js';
import { BASE_PRODUCT } from '../shared/products-config-workers.js';

// "Orders data" and "Smelloff Customers & Emails" in the owner's Drive.
const ORDERS_SHEET_ID = () => process.env.SHEETS_ORDERS_ID || '1VY0Jkrj0CTjrEmamE2qLpPXF8qcUhNG5ZToWcCn1AKc';
const CONTACTS_SHEET_ID = () => process.env.SHEETS_CONTACTS_ID || '1qe8Y2DY0kKr7jVLCit9F9Xr1L3rMO1CS3ClPAMpTjJc';
const SUPABASE_URL = () => (process.env.SUPABASE_URL || 'https://tnuqjydmoxczdjnsgpci.supabase.co').replace(/\/$/, '');

export const ORDER_COLUMNS = [
  { header: 'Order date', kind: 'sync' },
  { header: 'Order ID', kind: 'sync' },
  { header: 'Status', kind: 'sync' },
  { header: 'Payment', kind: 'sync' },
  { header: 'Name', kind: 'sync' },
  { header: 'Phone', kind: 'sync' },
  { header: 'Email', kind: 'sync' },
  { header: 'Bottles', kind: 'sync' },
  { header: 'Subtotal (₹)', kind: 'sync' },
  { header: 'COD fee (₹)', kind: 'sync' },
  { header: 'Total (₹)', kind: 'sync' },
  { header: 'Address', kind: 'sync' },
  { header: 'City', kind: 'sync' },
  { header: 'State', kind: 'sync' },
  { header: 'Pincode', kind: 'sync' },
  { header: 'Courier', kind: 'sync' },
  { header: 'AWB', kind: 'sync' },
  { header: 'Tracking link', kind: 'sync' },
  { header: 'Last update', kind: 'sync' },
  { header: 'COD call', kind: 'owner' },
  { header: 'Notes', kind: 'owner' },
];

export const CONTACT_COLUMNS = [
  { header: 'Email', kind: 'sync' },
  { header: 'Name', kind: 'sync' },
  { header: 'Phone', kind: 'sync' },
  { header: 'City', kind: 'sync' },
  { header: 'State', kind: 'sync' },
  { header: 'Type', kind: 'sync' },
  { header: 'Paid orders', kind: 'sync' },
  { header: 'Bottles', kind: 'sync' },
  { header: 'Order value (₹)', kind: 'sync' },
  { header: 'Last order', kind: 'sync' },
  { header: 'Last order status', kind: 'sync' },
  { header: 'Email offers', kind: 'sync' },
  { header: 'First seen', kind: 'insert' },
  { header: 'Source', kind: 'insert' },
  { header: 'Notes', kind: 'owner' },
];

export const STATUS_LABELS = {
  placed: 'New',
  upi_pending: 'Payment pending',
  verification_pending: 'Verifying payment',
  payment_not_verified: 'Payment not verified',
  failed: 'Payment failed',
  confirmed: 'Confirmed',
  packed: 'Packed',
  dispatched: 'Shipped',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};
// Statuses that are a real sale (the Dashboard's list must match).
const SALE_STATUSES = new Set(['placed', 'confirmed', 'packed', 'dispatched', 'out_for_delivery', 'delivered']);

const SOURCE_LABELS = { footer: 'Footer newsletter', 'blog-comment': 'Blog comment', blog: 'Blog newsletter' };

const digits = (v) => String(v || '').replace(/\D/g, '').slice(-10);
const lower = (v) => String(v || '').trim().toLowerCase();
const rupees = (paise) => Math.round(Number(paise || 0)) / 100;
const businessPhone = digits(BASE_PRODUCT.manufacturer.phone);

// Test orders and the owner's own checkouts (placed from the business
// WhatsApp number) stay out of the sheets; /admin still lists them.
export function isTestOrInternal(order) {
  const name = String(order?.address?.name || '');
  const line = String(order?.address?.line || '');
  const email = lower(order?.customer_email);
  const phone = digits(order?.customer_phone);
  if (/\btest\b|key check|do not ship/i.test(`${name} ${line}`)) return true;
  if (email.endsWith('@smelloff.in')) return true;
  if (/^(\d)\1{9}$/.test(phone) || /^900000\d{4}$/.test(phone)) return true;
  return Boolean(businessPhone) && phone === businessPhone;
}

function bottlesOf(order) {
  const items = Array.isArray(order?.items) ? order.items : [];
  const n = items.reduce((sum, it) => sum + (Number(it?.quantity) || 0), 0);
  return n || 1;
}

function itemsSubtotal(order) {
  const items = Array.isArray(order?.items) ? order.items : [];
  return items.reduce((sum, it) => sum + (Number(it?.price ?? it?.unit_price) || 0) * (Number(it?.quantity) || 0), 0);
}

// Older COD rows saved 0 in cod_fee with the fee folded into amount; read it
// back from the item total so Subtotal + COD fee = Total on every row.
export function moneyOf(order) {
  const total = rupees(order?.amount);
  let codFee = rupees(order?.cod_fee);
  if (!codFee && order?.payment_method === 'cod') {
    const items = itemsSubtotal(order);
    if (items > 0 && total > items) codFee = Math.round((total - items) * 100) / 100;
  }
  return { subtotal: Math.round((total - codFee) * 100) / 100, codFee, total };
}

export function orderRow(order) {
  const a = order.address || {};
  const awb = order.shiprocket_awb || order.tracking_id || '';
  const link = order.tracking_url || (awb ? `https://www.shiprocket.co/tracking/${encodeURIComponent(awb)}` : '');
  const { subtotal, codFee, total } = moneyOf(order);
  return [
    toSheetDate(order.created_at),
    order.order_code,
    STATUS_LABELS[order.status] || order.status || '',
    order.payment_method === 'cod' ? 'COD' : 'Prepaid',
    a.name || '',
    digits(order.customer_phone),
    lower(order.customer_email),
    bottlesOf(order),
    subtotal,
    codFee,
    total,
    String(a.line || '').replace(/\s*[\r\n]+\s*/g, ', '),
    a.city || '',
    a.state || '',
    String(a.pincode || ''),
    order.shiprocket_courier || order.courier || '',
    awb,
    link,
    toSheetDate(order.updated_at || order.created_at),
    '',
    '',
  ];
}

export const orderKey = (row) => String(row?.[1] || '').trim().toUpperCase();

export const contactKey = (row) => lower(row?.[0]) || digits(row?.[2]);

// skipEmails: addresses used on test or internal orders (the owner's own).
export function buildContactRows({ orders = [], waitlist = [], messages = [], skipEmails = new Set() }) {
  const people = new Map();
  const touch = (key, at) => {
    if (!key || skipEmails.has(key)) return null;
    let p = people.get(key);
    if (!p) {
      p = { email: '', name: '', phone: '', city: '', state: '', paid: 0, bottles: 0, value: 0,
        last: null, subscribed: false, hasOrders: false, enquired: false, first: null, firstSource: '' };
      people.set(key, p);
    }
    p.lastSeen = Math.max(p.lastSeen || 0, Date.parse(at || '') || 0);
    return p;
  };
  const seenFirst = (p, at, source) => {
    const ms = Date.parse(at || '');
    if (!Number.isFinite(ms)) return;
    if (p.first === null || ms < p.first) { p.first = ms; p.firstSource = source; }
  };

  const byDate = [...orders].sort((x, y) => (Date.parse(x.created_at) || 0) - (Date.parse(y.created_at) || 0));
  for (const o of byDate) {
    const email = lower(o.customer_email);
    const phone = digits(o.customer_phone);
    const p = touch(email || phone, o.created_at);
    if (!p) continue;
    const a = o.address || {};
    p.email = email || p.email;
    p.phone = phone || p.phone;
    p.name = a.name || p.name;
    p.city = a.city || p.city;
    p.state = a.state || p.state;
    p.hasOrders = true;
    p.last = o;
    if (SALE_STATUSES.has(o.status)) {
      p.paid += 1;
      p.bottles += bottlesOf(o);
      p.value += moneyOf(o).total;
    }
    seenFirst(p, o.created_at, 'Checkout');
  }
  for (const w of waitlist) {
    const email = lower(w.email);
    const p = touch(email, w.created_at);
    if (!p) continue;
    p.email = email;
    p.subscribed = true;
    seenFirst(p, w.created_at, SOURCE_LABELS[w.source] || (w.source ? `Signup (${w.source})` : 'Signup'));
  }
  for (const m of messages) {
    const email = lower(m.email);
    const phone = digits(m.phone);
    const p = touch(email || phone, m.created_at);
    if (!p) continue;
    p.email = email || p.email;
    p.phone = phone || p.phone;
    p.name = p.name || m.name || '';
    p.enquired = true;
    seenFirst(p, m.created_at, 'Contact form');
  }

  return [...people.values()]
    .sort((x, y) => (y.lastSeen || 0) - (x.lastSeen || 0))
    .map((p) => [
      p.email,
      p.name,
      p.phone,
      p.city,
      p.state,
      p.paid ? 'Customer' : p.hasOrders ? 'Tried to order' : p.subscribed ? 'Subscriber' : 'Enquiry',
      p.paid,
      p.bottles,
      Math.round(p.value * 100) / 100,
      p.last ? toSheetDate(p.last.created_at) : '',
      p.last ? (STATUS_LABELS[p.last.status] || p.last.status || '') : '',
      p.subscribed ? 'Yes' : 'No',
      p.first ? toSheetDate(new Date(p.first).toISOString()) : '',
      p.firstSource,
      '',
    ]);
}

// Consent is only ever added: someone who opted in once (including the April
// waitlist rows typed into the sheet) stays "Yes" when they later order.
export function mergeContact(col, have, want) {
  if (col.header === 'Email offers' && have === 'Yes') return 'Yes';
  return want;
}

async function supabaseGet(path) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const res = await fetch(`${SUPABASE_URL()}/rest/v1/${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`Supabase ${path.split('?')[0]} ${res.status}`);
  return res.json();
}

const ORDER_FIELDS = 'order_code,created_at,updated_at,status,payment_method,amount,cod_fee,customer_email,customer_phone,address,items,courier,tracking_id,tracking_url,shiprocket_awb,shiprocket_courier';

export async function syncSheets({ route = 'cron' } = {}) {
  if (!isSheetsConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) return { status: 'not_configured' };
  const [allOrders, waitlist, messages] = await Promise.all([
    supabaseGet(`orders?select=${ORDER_FIELDS}&order=created_at.desc&limit=5000`),
    supabaseGet('waitlist?select=email,source,created_at&order=created_at.desc&limit=5000'),
    supabaseGet('contact_messages?select=name,email,phone,created_at&order=created_at.desc&limit=5000').catch(() => []),
  ]);
  const orders = allOrders.filter((o) => o?.order_code && !isTestOrInternal(o));
  const skipEmails = new Set(allOrders.filter(isTestOrInternal).map((o) => lower(o.customer_email)).filter(Boolean));
  for (const o of orders) skipEmails.delete(lower(o.customer_email));
  const result = { status: 'ok', route };
  // One tab failing (unshared, renamed) must not stop the other.
  try {
    result.orders = await syncTab({
      spreadsheetId: ORDERS_SHEET_ID(), tab: 'Orders', columns: ORDER_COLUMNS, rows: orders.map(orderRow), keyOf: orderKey,
    });
  } catch (err) {
    result.status = 'partial';
    result.ordersError = String(err?.message || err).slice(0, 300);
  }
  try {
    result.contacts = await syncTab({
      spreadsheetId: CONTACTS_SHEET_ID(), tab: 'Contacts', columns: CONTACT_COLUMNS,
      rows: buildContactRows({ orders, waitlist, messages, skipEmails }), keyOf: contactKey, merge: mergeContact,
    });
  } catch (err) {
    result.status = result.status === 'partial' ? 'failed' : 'partial';
    result.contactsError = String(err?.message || err).slice(0, 300);
  }
  if (result.ordersError || result.contactsError) {
    console.error(`[sheets-sync] ${route}:`, result.ordersError || '', result.contactsError || '');
  }
  return result;
}

// For order routes: never throws, so a Sheets problem can't touch checkout.
export async function syncSheetsNow(route) {
  try {
    return await syncSheets({ route });
  } catch (err) {
    console.error(`[sheets-sync] ${route}:`, err?.message || err);
    return { status: 'failed', error: String(err?.message || err).slice(0, 300) };
  }
}
