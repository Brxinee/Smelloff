/* Smelloff service worker — offline + repeat-visit speed.
   Safe-by-design: only same-origin GET requests are handled.
   Cross-origin (Supabase, analytics, Meta, Google Apps Script) and /api/
   are never intercepted, so the checkout/payment flow is untouched. */
const VERSION = 'smelloff-v29';
const STATIC_CACHE = 'static-' + VERSION;
const PAGE_CACHE = 'pages-' + VERSION;

/* Minimal precache: the offline shell ('/') + the assets it actually renders
   with. The homepage is self-contained (inline CSS/JS) and only pulls in the
   first-party tracker plus its two display fonts, so precache exactly those.
   Everything else (blog.css, fonts.css, sub-page fonts) is same-origin and
   gets cached-first at runtime on first visit — no need to precache it.
   The tracker is kept on the PDP's existing URL but is network-first below,
   so stale immutable browser/service-worker copies cannot block checkout fixes. */
const PRECACHE = [
  '/',
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

  // The tracker contains checkout compatibility code on /odorstrike. Never
  // serve that script cache-first. Always try the network first so a newly
  // deployed tracker is used immediately; fall back to the last cached copy
  // only when the network is unavailable.
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
