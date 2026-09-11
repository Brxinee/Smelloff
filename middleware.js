// Vercel Routing Middleware — AI & human traffic capture for smelloff.in

export const config = {
  matcher: [
    '/((?!api/|_vercel/|.*\\.).*)',
    '/google163974d1a8d940cf89b0ec712246c779.html',
  ],
};

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

  // Tracking functionality removed due to privacy compliance.
}
