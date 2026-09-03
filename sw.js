/* Smelloff service worker — offline + repeat-visit speed.
   Safe-by-design: only same-origin GET requests are handled.
   Cross-origin (Supabase, analytics, Meta, Google Apps Script) and /api/
   are never intercepted, so the checkout/payment flow is untouched. */
const VERSION = 'smelloff-v29-21st';
const STATIC_CACHE = 'static-' + VERSION;
const PAGE_CACHE = 'pages-' + VERSION;
const HOME_SKIN = '/assets/css/21st-home.css?v=2';

const PRECACHE = [
  '/',
  HOME_SKIN,
  '/assets/js/track.js?v=2',
  '/assets/fonts/fraunces-normal-latin-400.woff2',
  '/assets/fonts/inter-tight-normal-latin-400.woff2',
  '/assets/css/tokens.css?v=4605ce3e',
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

async function skinHomepageResponse(response) {
  if (!response || !response.ok) return response;
  const type = response.headers.get('content-type') || '';
  if (!type.includes('text/html')) return response;
  const source = await response.text();
  if (source.includes('/assets/css/21st-home.css')) return new Response(source, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers
  });
  const tag = `<link rel="stylesheet" href="${HOME_SKIN}">`;
  const styled = source.includes('</head>') ? source.replace('</head>', `${tag}</head>`) : source;
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  headers.set('content-type', 'text/html; charset=utf-8');
  return new Response(styled, { status: response.status, statusText: response.statusText, headers });
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

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

  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    event.respondWith((async () => {
      try {
        const network = await fetch(req);
        const response = url.pathname === '/' ? await skinHomepageResponse(network) : network;
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(PAGE_CACHE).then((c) => c.put(req, copy));
        }
        return response;
      } catch (err) {
        const cached = await caches.match(req);
        return cached || caches.match('/');
      }
    })());
  }
});