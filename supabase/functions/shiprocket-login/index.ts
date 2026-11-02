// Shiprocket login relay (2026-11-02).
//
// Shiprocket started answering every login from the Cloudflare Worker with
// "User blocked due to too many failed login attempts", even for a brand-new
// API user, while the same credentials logged in fine from another network:
// the block is on the shared Cloudflare egress address, not on the account.
// The Worker calls this function only after a direct login is refused that
// way, and stores the token it gets back (see api/_shiprocket.js).
//
// - It only ever calls Shiprocket's fixed login URL (no caller-chosen URL).
// - It stores nothing and logs no credential or token.
// - Only a caller holding the project's service-role key may use it. The key
//   is checked by reading admin_settings (service role only) with it, so it
//   works for both the legacy JWT and the newer secret-key format.
// - verify_jwt is off for this function: the check above replaces it.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const LOGIN_URL = "https://apiv2.shiprocket.in/v1/external/auth/login";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

async function callerIsServiceRole(key: string): Promise<boolean> {
  const base = Deno.env.get("SUPABASE_URL");
  if (!base || !key || key.length < 20) return false;
  try {
    const res = await fetch(`${base}/rest/v1/admin_settings?select=key&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const key = (req.headers.get("x-service-key") || "").trim();
  if (!(await callerIsServiceRole(key))) return json({ error: "Unauthorized" }, 401);

  let body: { email?: unknown; password?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid request." }, 400);
  }
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!email || !password || email.length > 200 || password.length > 200) {
    return json({ error: "email and password are required." }, 400);
  }

  try {
    const res = await fetch(LOGIN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      signal: AbortSignal.timeout(15000),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && typeof data.token === "string" && data.token) {
      return json({ token: data.token });
    }
    const message = String(data.message || data.error || `Shiprocket login failed (${res.status})`).slice(0, 300);
    return json({ error: message, status: res.status }, 502);
  } catch (err) {
    return json({ error: `Shiprocket login unreachable: ${String((err as Error)?.message || err).slice(0, 200)}` }, 504);
  }
});
