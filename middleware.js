// Vercel Routing Middleware — AI & human traffic capture for smelloff.in

export const config = {
  matcher: [
    '/((?!api/|_vercel/|.*\\.).*)',
    '/blog/assets/:path*',
    '/google163974d1a8d940cf89b0ec712246c779.html',
  ],
};

const INGEST = 'https://admin.smelloff.in/api/traffic';
const BLOG_IMAGE_FALLBACK = '/blog/assets/why-shirt-zones-smell-after-washing.jpg';

// Eight legacy blog card image families were published with missing files.
// Catch every AVIF/WebP/JPG and @1200 variant and send it to a real JPG asset.
const BROKEN_BLOG_ASSET = /^\/blog\/assets\/(?:alternative-to-deodorant-for-clothes-smell|best-body-odor-remover-spray-for-men-india|mumbai-humidity-sweat-smell-survival-guide|office-ac-trap-why-rewear-shirts-smell-worse|perfume-plus-sweat-chemical-reaction|spray-to-remove-sweat-smell-from-clothes-instantly|where-to-buy-odorstrike-in-india|why-deodorant-stops-working-after-3-hours)(?:@1200)?\.(?:avif|webp|jpg)$/;

const GSC_FILE = '/google163974d1a8d940cf89b0ec712246c779.html';
const GSC_BODY = 'google-site-verification: google163974d1a8d940cf89b0ec712246c779.html';

export default function middleware(request, context) {
  const { pathname: reqPath } = new URL(request.url);

  if (reqPath === GSC_FILE) {
    return new Response(GSC_BODY, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' },
    });
  }

  if (BROKEN_BLOG_ASSET.test(reqPath)) {
    return Response.redirect(new URL(BLOG_IMAGE_FALLBACK, request.url), 301);
  }

  if (reqPath.startsWith('/blog/assets/')) return;

  try {
    const ua = request.headers.get('user-agent') || '';
    const ref = request.headers.get('referer') || '';
    const ip =
      request.headers.get('cf-connecting-ip') ||
      request.headers.get('true-client-ip') ||
      (request.headers.get('x-forwarded-for') || '').split(',')[0].trim();
    const { pathname } = new URL(request.url);

    const forward = fetch(INGEST, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: pathname, ua, ref, ip }),
      keepalive: true,
    }).catch(() => {});

    if (context && typeof context.waitUntil === 'function') context.waitUntil(forward);
  } catch {}
}
