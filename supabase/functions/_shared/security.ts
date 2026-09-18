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

function constantTimeEqual(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const enc = new TextEncoder();
  const aBuf = enc.encode(a);
  const bBuf = enc.encode(b);
  if (aBuf.byteLength !== bBuf.byteLength) return false;
  let diff = 0;
  for (let i = 0; i < aBuf.byteLength; i++) {
    diff |= aBuf[i] ^ bBuf[i];
  }
  return diff === 0;
}

export function isOrderReviewEligible(order: {
  status: string;
  payment_method?: string | null;
}): boolean {
  if (!order || !order.status) return false;
  const status = String(order.status).toLowerCase().trim();
  const method = String(order.payment_method || "").toLowerCase().trim();

  // Ineligible states for any order
  if (status === "cancelled" || status === "failed" || status === "upi_pending") {
    return false;
  }

  // COD orders: payment is collected only on delivery
  if (method === "cod") {
    return status === "delivered";
  }

  // Prepaid orders: payment has been captured/verified (confirmed through delivered)
  const PREPAID_ELIGIBLE_STATUSES = new Set([
    "confirmed",
    "packed",
    "dispatched",
    "out_for_delivery",
    "delivered",
  ]);

  return PREPAID_ELIGIBLE_STATUSES.has(status);
}

export async function generateReviewToken(
  orderId: string,
  secret: string,
  expiresInMs = 24 * 60 * 60 * 1000,
): Promise<string> {
  const expiry = Date.now() + expiresInMs;
  const payload = `${orderId}:${expiry}`;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  const sigHex = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${expiry}.${sigHex}`;
}

export async function verifyReviewToken(
  orderId: string,
  token: string,
  secret: string,
): Promise<boolean> {
  if (!token || typeof token !== "string") return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [expiryStr, sigHex] = parts;
  const expiry = Number(expiryStr);
  if (!Number.isFinite(expiry) || Date.now() > expiry) return false;
  if (!sigHex || !/^[0-9a-f]{64}$/i.test(sigHex)) return false;

  const payload = `${orderId}:${expiry}`;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  const expectedSigHex = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return constantTimeEqual(sigHex.toLowerCase(), expectedSigHex.toLowerCase());
}
