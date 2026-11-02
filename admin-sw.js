/* Smelloff Admin service worker (scope /admin).
   Its jobs: make /admin installable as an app, and receive "new order"
   pushes (api/_order-alerts.js) while the app is closed. It caches nothing:
   the dashboard always shows live data. Offline, it shows a short notice. */
const VERSION = 'admin-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

const OFFLINE = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Smelloff Admin</title>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#0A0A0A;color:#F2F5EF;font:16px system-ui;text-align:center;padding:24px">
<div><p style="font-size:20px;margin:0 0 8px">You're offline</p><p style="color:#9DA398;margin:0 0 20px">Order alerts still arrive. The dashboard needs a connection.</p>
<button onclick="location.reload()" style="background:#B8FF57;border:0;border-radius:8px;padding:12px 20px;font:inherit">Try again</button></div></body>`;

self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return;
  event.respondWith(fetch(event.request).catch(() => new Response(OFFLINE, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })));
});

self.addEventListener('push', (event) => {
  let alert = {};
  try { alert = event.data ? event.data.json() : {}; } catch { alert = { body: event.data ? event.data.text() : '' }; }
  event.waitUntil((async () => {
    // An open dashboard rings out loud (its own sound, until "Got it").
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const w of windows) w.postMessage({ type: 'smf-alert', alert });
    await self.registration.showNotification(alert.title || 'New order · Smelloff', {
      body: alert.body || 'Open the dashboard to see it.',
      tag: alert.tag || 'order',
      renotify: true,
      requireInteraction: true,
      silent: false,
      vibrate: [600, 200, 600, 200, 600, 200, 1200],
      icon: '/admin/icon-192.png',
      badge: '/admin/badge-96.png',
      timestamp: Date.now(),
      data: { url: alert.url || '/admin#orders' },
      actions: [{ action: 'open', title: 'Open order' }],
    });
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/admin#orders', self.location.origin).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const admin = windows.find((w) => new URL(w.url).pathname.startsWith('/admin'));
    if (admin) { await admin.focus(); admin.postMessage({ type: 'smf-open', url: target }); return; }
    await self.clients.openWindow(target);
  })());
});

// A browser can rotate the push subscription; ask an open dashboard to re-register it.
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(self.clients.matchAll({ type: 'window' }).then((ws) => ws.forEach((w) => w.postMessage({ type: 'smf-resubscribe' }))));
});
