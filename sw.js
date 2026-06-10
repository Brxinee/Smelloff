/* Smelloff service worker — offline + repeat-visit speed.
   Safe-by-design: only same-origin GET requests are handled.
   Cross-origin (Supabase, analytics, Meta, Google Apps Script) and /api/
   are never intercepted, so the checkout/payment flow is untouched. */
const VERSION = 'smelloff-v2';
const STATIC_CACHE = 'static-' + VERSION;
const PAGE_CACHE = 'pages-' + VERSION;

/* Minimal precache: the offline shell + critical fonts/css. */
const PRECACHE = [
  '/',
  '/assets/css/main.css?v=1',
  '/assets/js/app.js?v=1',
  '/assets/js/scroll-effects.js?v=1',
  '/assets/fonts.css',
  '/assets/fonts/dm-sans-normal-latin-400.woff2',
  '/assets/fonts/barlow-condensed-normal-latin-900.woff2',
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

/* Static asset = same-origin file we can safely cache-first. */
function isStaticAsset(url) {
  return /\.(?:css|js|mjs|woff2?|ttf|otf|png|jpg|jpeg|webp|svg|gif|avif|ico)$/i.test(url.pathname);
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;                       // never touch POST (orders, tracking)

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;        // ignore cross-origin (Supabase, analytics, Meta)
  if (url.pathname.startsWith('/api/')) return;           // never cache API routes

  // Static assets: cache-first, then revalidate in background.
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

  // Navigations / HTML: network-first, fall back to cache, then offline shell.
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(
      fetch(req).then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(PAGE_CACHE).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => caches.match(req).then((c) => c || caches.match('/')))
    );
  }
});
