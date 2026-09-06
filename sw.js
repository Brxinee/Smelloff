/* Smelloff service worker — offline + repeat-visit speed.
   Safe-by-design: only same-origin GET requests are handled.
   Cross-origin (Supabase, analytics, Meta, Google Apps Script) and /api/
   are never intercepted, so the checkout/payment flow is untouched. */
const VERSION = 'smelloff-v31';
const STATIC_CACHE = 'static-' + VERSION;
const PAGE_CACHE = 'pages-' + VERSION;

/* Keep the homepage and PDP themselves available as explicit page entries.
   The PDP must never silently fall back to the homepage: doing so makes a
   failed navigation look like the "See ODORSTRIKE" link is broken. */
const PRECACHE = [
  '/',
  '/odorstrike',
  '/odorstrike?buy=1',
  '/assets/js/track.js?v=801e292b',
  '/assets/fonts/fraunces-normal-latin-400.woff2',
  '/assets/fonts/inter-tight-normal-latin-400.woff2',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((k) => k !== STATIC_CACHE && k !== PAGE_CACHE)
          .map((k) => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

function isStaticAsset(url) {
  return /\.(?:css|js|mjs|woff2?|ttf|otf|png|jpg|jpeg|webp|svg|gif|avif|ico)$/i.test(url.pathname);
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  /* The tracker contains checkout compatibility code. Always prefer the
     network so a newly deployed tracker is used immediately. */
  if (url.pathname === '/assets/js/track.js') {
    event.respondWith(
      fetch(req, { cache: 'no-store' }).then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(STATIC_CACHE).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => caches.match(req))
    );
    return;
  }

  /* Immutable/hash-versioned assets can use cache-first. */
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const network = fetch(req).then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(STATIC_CACHE).then((c) => c.put(req, copy));
          }
          return res;
        }).catch(() => cached);
        return cached || network;
      })
    );
    return;
  }

  /* HTML navigations are network-first. If the exact page has previously been
     cached, use that exact page offline. NEVER substitute `/` for another
     route: `/odorstrike` must stay `/odorstrike`. */
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(
      fetch(req).then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(PAGE_CACHE).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => caches.match(req))
    );
  }
});
