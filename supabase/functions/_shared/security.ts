// Shared security helpers for Smelloff Supabase edge functions.
// - CORS locked to the production origins (no more wildcard `*`).
// - Best-effort in-memory rate limiting (per edge instance). Edge instances are
//   ephemeral, so this is a fallback throttle, not a global guarantee — it still
//   blunts trivial scripted abuse from a single source.

const PRIMARY_ORIGIN = "https://www.smelloff.in";

const ALLOWED_ORIGINS = new Set<string>([
  "https://www.smelloff.in",
  "https://smelloff.in",
]);

// Build CORS headers, reflecting the request Origin only when it is allow-listed.
// Disallowed origins get the primary origin, so browsers block the cross-site read.
export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") || "";
  const allow = ALLOWED_ORIGINS.has(origin) ? origin : PRIMARY_ORIGIN;
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

export function jsonResponse(
  req: Request,
  body: unknown,
  status = 200,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
}

export function preflight(req: Request): Response {
  return new Response("ok", { headers: corsHeaders(req) });
}

// Derive a best-effort client key for rate limiting from proxy headers.
// Behind Cloudflare, x-forwarded-for is a shared Cloudflare POP IP — keying on
// it would lump every visitor routed through the same POP into one bucket and
// throttle them together. cf-connecting-ip (true-client-ip on Enterprise) is
// the real client, so it wins; XFF is only the last-resort fallback. This
// matches the IP derivation used everywhere else (api/track, api/_meta, …).
export function clientKey(req: Request): string {
  const cf = req.headers.get("cf-connecting-ip") ||
    req.headers.get("true-client-ip");
  if (cf) return cf.trim();
  const xff = req.headers.get("x-forwarded-for") || "";
  return xff.split(",")[0]?.trim() || "unknown";
}

interface Bucket {
  count: number;
  resetAt: number;
}
const buckets = new Map<string, Bucket>();

// Returns true when the caller is within the limit, false when throttled.
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    // Opportunistic cleanup so the map can't grow unbounded on a long-lived instance.
    if (buckets.size > 5000) {
      for (const [k, v] of buckets) {
        if (now >= v.resetAt) buckets.delete(k);
      }
    }
    return true;
  }

  if (bucket.count >= limit) return false;
  bucket.count++;
  return true;
}
