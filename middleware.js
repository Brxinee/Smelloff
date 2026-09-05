// Vercel Routing Middleware — AI & human traffic capture for smelloff.in

export const config = {
  matcher: [
    '/((?!api/|_vercel/|.*\\.).*)',
    '/google163974d1a8d940cf89b0ec712246c779.html',
  ],
};

const INGEST = 'https://admin.smelloff.in/api/traffic';
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
