// Vercel Routing (Edge) Middleware — AI & human traffic capture for smelloff.in
// ---------------------------------------------------------------------------
// WHY THIS EXISTS
//   The client-side /api/track beacon is JavaScript and deliberately drops
//   bots, so almost every AI crawler (GPTBot, ClaudeBot, OAI-SearchBot,
//   PerplexityBot, ChatGPT-User, …) is invisible — they don't run JS, so they
//   never fire it. This middleware runs at the edge on every HTML document
//   request, BEFORE any JS, where the User-Agent + Referer are present on every
//   request. It fire-and-forgets that raw metadata to the admin's /api/traffic
//   ingest (admin.smelloff.in), which classifies it and logs one row into the
//   `traffic_log` table shown on the admin "AI traffic" panel.
//
// SAFETY (this is a live storefront)
//   • It never rewrites or redirects HTML pages. Every normal request only has
//     its headers read and continues untouched; Vercel's redirects/rewrites in
//     vercel.json and normal page serving are unaffected.
//   • The one exception below repairs the currently broken legacy blog-card
//     image URLs by redirecting only those exact missing image variants to the
//     existing Smelloff OG image. This is deliberately limited to the 8 cards
//     affected on /blog so valid blog assets continue to work normally.
//   • The forward runs inside context.waitUntil and every error is swallowed,
//     so it is non-blocking and fail-silent. If the ingest or Supabase is down,
//     pages still load.
//   • It touches no protected integration (checkout, Razorpay, COD/OTP, GA4,
//     Meta Pixel, Supabase, Sheets, Resend, WhatsApp) and blocks no crawler —
//     AI bots keep full access to read/cite pages.
//
// PRIVACY (matches the existing cookieless, consent-free analytics model)
//   No cookie, no client storage, no PII. The raw IP is forwarded only so the
//   admin can compute the SAME daily-rotating one-way visitor hash it already
//   uses for /api/track; it is never stored. Human User-Agents are dropped
//   server-side; only bot UAs are kept (truncated) for tuning the classifier.

export const config = {
  // Real HTML document routes only. Exclude the serverless API, Vercel
  // internals, and anything with a file extension (assets, images, fonts,
  // css/js, robots.txt, sitemap.xml, llms.txt, …) so we log page hits, not
  // asset fetches. `cleanUrls: true` means pages like /about have no extension
  // and are matched; /about.html-style requests carry a dot and are excluded.
  // The one dotted exception is the Google Search Console verification file:
  // it must answer 200 at its exact .html URL, but `cleanUrls` 308s every
  // .html path — so that single path is matched here and answered directly
  // below, before the redirect can fire.
  matcher: [
    '/((?!api/|_vercel/|.*\\.).*)',
    '/blog/assets/:path*',
    '/google163974d1a8d940cf89b0ec712246c779.html',
  ],
};

const INGEST = 'https://admin.smelloff.in/api/traffic';
const BLOG_IMAGE_FALLBACK = '/assets/og-image.jpg';

// These are the legacy blog-card image families currently referenced by the
// index page but missing from production. The <picture> markup asks for AVIF,
// WebP, and JPG plus @1200 variants, so catch every one and send the browser
// to a real image instead of rendering a broken-image icon + alt text.
const BROKEN_BLOG_ASSET = /^\/blog\/assets\/(?:alternative-to-deodorant-for-clothes-smell|best-body-odor-remover-spray-for-men-india|mumbai-humidity-sweat-smell-survival-guide|office-ac-trap-why-rewear-shirts-smell-worse|perfume-plus-sweat-chemical-reaction|spray-to-remove-sweat-smell-from-clothes-instantly|where-to-buy-odorstrike-in-india|why-deodorant-stops-working-after-3-hours)(?:@1200)?\.(?:avif|webp|jpg)$/;

// GSC HTML-file verification demands the exact token content at the exact
// .html path with no redirect. Keep this string in sync with the file of the
// same name at the repo root (which still serves the clean-URL variant).
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

  // Repair the broken /blog card images at the edge. This gives the browser a
  // normal HTTP image response path and prevents the broken icon/alt-text UI.
  if (BROKEN_BLOG_ASSET.test(reqPath)) {
    return Response.redirect(new URL(BLOG_IMAGE_FALLBACK, request.url), 307);
  }

  // Asset requests are intentionally invisible to traffic analytics. If this
  // matcher fires for a valid asset, simply let Vercel serve it normally.
  if (reqPath.startsWith('/blog/assets/')) return;

  try {
    const ua = request.headers.get('user-agent') || '';
    const ref = request.headers.get('referer') || '';
    // Behind Cloudflare, x-forwarded-for at the Vercel edge is a Cloudflare
    // POP — the real visitor IP only lives in cf-connecting-ip. Prefer it so
    // the admin's human visitor hash counts real people, not POPs.
    const ip =
      request.headers.get('cf-connecting-ip') ||
      request.headers.get('true-client-ip') ||
      (request.headers.get('x-forwarded-for') || '').split(',')[0].trim();
    const { pathname } = new URL(request.url);

    // Fire-and-forget: kick off the POST, never await it in the request path.
    const forward = fetch(INGEST, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: pathname, ua, ref, ip }),
      keepalive: true,
    }).catch(() => {});

    // Let it finish after the response is sent, without delaying the page.
    if (context && typeof context.waitUntil === 'function') context.waitUntil(forward);
  } catch {
    // Analytics must never affect page delivery.
  }

  // Return nothing → the request continues to the origin unchanged.
}
