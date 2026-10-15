// One host, one scheme, one spelling per page.
//
// Google Search Console (Oct 2026) had 56 pages indexed twice — once on
// smelloff.in and once on www.smelloff.in — because www answered 200 for every
// page. The Worker owns both hosts (wrangler.jsonc `routes`), and _redirects
// cannot match on host, so the 301 lives here.
//
// /api/* is never redirected: a 301 turns a webhook POST into a GET and the
// Razorpay / Resend signatures would stop arriving.

import routing from "../config/routing.json" with { type: "json" };

export const CANONICAL_ORIGIN = "https://smelloff.in";
const OUR_HOSTS = new Set(["smelloff.in", "www.smelloff.in"]);

// Static, host-agnostic permanent redirects (retired blog slugs etc.). When we
// are already 301ing a www/http URL, follow these too so Google gets ONE hop:
// GSC (Oct 2026) listed 20 legacy www URLs going www → apex → new post.
const STATIC_REDIRECTS = new Map(
  routing.redirects
    .filter((r) => !r.has && !/[(:*]/.test(r.source) && [301, 308].includes(r.statusCode ?? 301))
    .map((r) => [r.source, r.destination.replace(CANONICAL_ORIGIN, "")]),
);

/** Follow the static redirect table to its end (max 5 links, no loops). */
export function resolveStaticRedirect(path) {
  let current = path;
  for (let i = 0; i < 5 && STATIC_REDIRECTS.has(current); i++) {
    const next = STATIC_REDIRECTS.get(current);
    if (!next.startsWith("/") || next === current) break;
    current = next;
  }
  return current;
}

function canonicalPath(pathname) {
  let path = pathname;
  if (path.endsWith(".html")) path = path.slice(0, -5);
  if (path === "/index" || path.endsWith("/index")) path = path.slice(0, -5);
  if (path.length > 1 && path.endsWith("/")) path = path.replace(/\/+$/, "");
  return path || "/";
}

// Pages that were briefly published under /public (the build's output folder).
// GSC (Oct 2026) still knew them: bare /public answered 200 with the homepage
// (a duplicate of /), and /public/solutions/x took two hops (→ /solutions/x →
// the guide). Strip the prefix and resolve the table in the same 301.
const PUBLIC_PREFIX = /^\/public(?=\/|$)/;

/** The URL to 301 to, or null when the request is already canonical. */
export function canonicalRedirect(requestUrl) {
  const url = new URL(requestUrl);
  if (!OUR_HOSTS.has(url.hostname)) return null; // workers.dev, previews, localhost
  if (url.pathname.startsWith("/api/")) return null;
  const isPublicCopy = PUBLIC_PREFIX.test(url.pathname);
  if (url.hostname === "smelloff.in" && url.protocol === "https:" && !isPublicCopy) return null;
  const pathname = isPublicCopy ? url.pathname.replace(PUBLIC_PREFIX, "") || "/" : url.pathname;
  const target = resolveStaticRedirect(canonicalPath(pathname));
  // /cart → /odorstrike?cart=open: keep both query strings with one "?".
  const search = target.includes("?") && url.search ? "&" + url.search.slice(1) : url.search;
  return CANONICAL_ORIGIN + target + search;
}

/**
 * A path with capitals that 404'd (/Odorstrike, /Blog/Why-I-Built-Odorstrike):
 * every page and redirect source is lowercase, so the lowercase spelling is
 * the page that was meant. Returns that path, resolved through the redirect
 * table, or null when lowercasing changes nothing. The caller only follows it
 * if the lowercase URL really exists, so an unknown path still gets its 404.
 */
export function lowercaseCandidate(requestUrl) {
  const { pathname } = new URL(requestUrl);
  if (pathname.startsWith("/api/") || pathname.startsWith("/r/")) return null; // referral codes keep their case
  const lower = pathname.toLowerCase();
  if (lower === pathname) return null;
  return resolveStaticRedirect(canonicalPath(lower));
}

/**
 * The asset server's html_handling answers /page.html and /page/ with a 307.
 * Those are permanent moves, and a 307 tells Google to keep the old URL
 * indexed (GSC listed 14 trailing-slash URLs), so upgrade them to 301.
 */
export function upgradeTemporaryRedirect(requestUrl, response) {
  if (response.status !== 307) return response;
  const { pathname } = new URL(requestUrl);
  const isSpelling = pathname.endsWith(".html") || (pathname.length > 1 && pathname.endsWith("/"));
  if (!isSpelling) return response;
  const headers = new Headers(response.headers);
  return new Response(null, { status: 301, headers });
}

/**
 * /404 is a page in the asset store, so a direct hit answered 200 with a
 * noindex tag: a soft 404 in Search Console. It is only ever an error page.
 */
export function notFoundStatus(requestUrl, response) {
  const { pathname } = new URL(requestUrl);
  if (pathname !== "/404" || response.status !== 200) return response;
  return new Response(response.body, { status: 404, headers: response.headers });
}

/**
 * Search Console's HTML-file verification fetches /google<token>.html. The
 * asset server would 307 (and we 301) it to the extensionless URL; serve it
 * where Google looks instead, so ownership never depends on a redirect.
 */
export function verificationAssetPath(requestUrl) {
  const { pathname } = new URL(requestUrl);
  return /^\/google[0-9a-f]{16,}\.html$/.test(pathname) ? pathname.slice(0, -5) : null;
}
