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

/** The URL to 301 to, or null when the request is already canonical. */
export function canonicalRedirect(requestUrl) {
  const url = new URL(requestUrl);
  if (!OUR_HOSTS.has(url.hostname)) return null; // workers.dev, previews, localhost
  if (url.pathname.startsWith("/api/")) return null;
  if (url.hostname === "smelloff.in" && url.protocol === "https:") return null;
  return CANONICAL_ORIGIN + resolveStaticRedirect(canonicalPath(url.pathname)) + url.search;
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
