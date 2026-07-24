// Supabase Auth "Send SMS" hook — delivers login OTPs through an Indian SMS
// provider instead of Twilio.
//
// Why this exists: Supabase's built-in phone providers (Twilio, MessageBird,
// Vonage, Textlocal) bill roughly ₹3 per SMS to India via Twilio. Indian
// providers charge ₹0.12–0.25. Auth calls this hook with the generated OTP and
// we hand it to whichever provider is configured — the login flow, the client
// and the session handling are identical either way, so switching provider is
// an env change, not a code change.
//
// Config (Supabase → Project Settings → Edge Functions → Secrets):
//   SMS_PROVIDER        msg91 (default) | 2factor | fast2sms
//   SEND_SMS_HOOK_SECRET  the v1,whsec_… secret shown when you enable the hook.
//                         REQUIRED — without it every request is rejected.
//   MSG91_AUTHKEY + MSG91_TEMPLATE_ID          (SMS_PROVIDER=msg91)
//   TWOFACTOR_API_KEY + TWOFACTOR_TEMPLATE     (SMS_PROVIDER=2factor)
//   FAST2SMS_API_KEY + FAST2SMS_MESSAGE_ID + FAST2SMS_SENDER_ID  (fast2sms)
//
// India also requires the OTP template to be registered on DLT with your
// provider whichever vendor you pick — that's TRAI, not the vendor. The
// registered template must contain a single variable for the code.
//
// Deploy: supabase functions deploy send-sms-hook --no-verify-jwt
// (Auth calls this with a webhook signature, not a user JWT.)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

interface HookPayload {
  user?: { id?: string; phone?: string };
  sms?: { otp?: string };
}

const enc = new TextEncoder();

function fail(message: string, httpCode = 500): Response {
  // Shape Auth understands — it surfaces `message` to the caller.
  return new Response(
    JSON.stringify({ error: { http_code: httpCode, message } }),
    { status: httpCode, headers: { "Content-Type": "application/json" } },
  );
}

// Constant-time compare so a bad signature can't be probed byte by byte.
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

// Standard Webhooks verification (the scheme Supabase Auth hooks use).
// Signs `${id}.${timestamp}.${body}` with the base64 secret; the header may
// carry several space-separated `v1,<sig>` values (during secret rotation).
async function verifySignature(
  req: Request,
  rawBody: string,
  secret: string,
): Promise<boolean> {
  const id = req.headers.get("webhook-id");
  const timestamp = req.headers.get("webhook-timestamp");
  const signature = req.headers.get("webhook-signature");
  if (!id || !timestamp || !signature) return false;

  // Reject stale/replayed deliveries (5 minute tolerance, both directions).
  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  if (Math.abs(Date.now() / 1000 - ts) > 300) return false;

  const base64Secret = secret.replace(/^v1,\s*/, "").replace(/^whsec_/, "");
  let keyBytes: Uint8Array;
  try {
    keyBytes = Uint8Array.from(atob(base64Secret), (c) => c.charCodeAt(0));
  } catch {
    return false;
  }

  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, enc.encode(`${id}.${timestamp}.${rawBody}`)),
  );

  for (const part of signature.split(" ")) {
    const [version, value] = part.split(",");
    if (version !== "v1" || !value) continue;
    try {
      const provided = Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
      if (timingSafeEqual(mac, provided)) return true;
    } catch { /* malformed segment — try the next one */ }
  }
  return false;
}

// --- Providers -------------------------------------------------------------
// Each returns nothing on success and throws on failure. Phone arrives as
// E.164 digits without '+' (919876543210); `local` is the last 10 digits.

async function sendViaMsg91(phone: string, otp: string): Promise<void> {
  const authkey = Deno.env.get("MSG91_AUTHKEY");
  const templateId = Deno.env.get("MSG91_TEMPLATE_ID");
  if (!authkey || !templateId) throw new Error("MSG91 is not configured");

  const res = await fetch("https://control.msg91.com/api/v5/flow/", {
    method: "POST",
    headers: { "Content-Type": "application/json", authkey },
    body: JSON.stringify({
      template_id: templateId,
      recipients: [{ mobiles: phone, otp, OTP: otp }],
    }),
  });
  const text = await res.text();
  // MSG91 answers 200 with {"type":"error"} on rejection, so status alone
  // is not enough to call it delivered.
  if (!res.ok || text.includes('"type":"error"')) {
    throw new Error(`MSG91 rejected the message: ${text.slice(0, 200)}`);
  }
}

async function sendVia2Factor(local: string, otp: string): Promise<void> {
  const apiKey = Deno.env.get("TWOFACTOR_API_KEY");
  const template = Deno.env.get("TWOFACTOR_TEMPLATE");
  if (!apiKey || !template) throw new Error("2Factor is not configured");

  const url = `https://2factor.in/API/V1/${encodeURIComponent(apiKey)}/SMS/${
    encodeURIComponent(local)
  }/${encodeURIComponent(otp)}/${encodeURIComponent(template)}`;
  const res = await fetch(url);
  const text = await res.text();
  if (!res.ok || !text.includes('"Status":"Success"')) {
    throw new Error(`2Factor rejected the message: ${text.slice(0, 200)}`);
  }
}

async function sendViaFast2Sms(local: string, otp: string): Promise<void> {
  const apiKey = Deno.env.get("FAST2SMS_API_KEY");
  const messageId = Deno.env.get("FAST2SMS_MESSAGE_ID");
  const senderId = Deno.env.get("FAST2SMS_SENDER_ID");
  if (!apiKey || !messageId || !senderId) {
    throw new Error("Fast2SMS is not configured");
  }

  const res = await fetch("https://www.fast2sms.com/dev/bulkV2", {
    method: "POST",
    headers: { "Content-Type": "application/json", authorization: apiKey },
    body: JSON.stringify({
      route: "dlt",
      sender_id: senderId,
      message: messageId,
      variables_values: otp,
      numbers: local,
      flash: 0,
    }),
  });
  const text = await res.text();
  if (!res.ok || text.includes('"return":false')) {
    throw new Error(`Fast2SMS rejected the message: ${text.slice(0, 200)}`);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return fail("Method not allowed", 405);

  const secret = Deno.env.get("SEND_SMS_HOOK_SECRET") || "";
  if (!secret) {
    // Fail closed: an unsigned hook endpoint is an open SMS relay.
    console.error("[send-sms-hook] SEND_SMS_HOOK_SECRET is not set");
    return fail("SMS hook is not configured", 500);
  }

  const rawBody = await req.text();
  if (!(await verifySignature(req, rawBody, secret))) {
    return fail("Invalid signature", 401);
  }

  let payload: HookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return fail("Invalid payload", 400);
  }

  const phone = String(payload.user?.phone || "").replace(/\D/g, "");
  const otp = String(payload.sms?.otp || "").trim();
  if (!phone || !otp) return fail("Missing phone or OTP", 400);

  const local = phone.slice(-10);
  const provider = (Deno.env.get("SMS_PROVIDER") || "msg91").toLowerCase();

  try {
    if (provider === "msg91") await sendViaMsg91(phone, otp);
    else if (provider === "2factor") await sendVia2Factor(local, otp);
    else if (provider === "fast2sms") await sendViaFast2Sms(local, otp);
    else return fail(`Unknown SMS_PROVIDER: ${provider}`, 500);
  } catch (e) {
    // Log the provider's reason for us; return a generic message to the caller
    // so provider internals never reach the browser.
    console.error("[send-sms-hook] send failed:", e instanceof Error ? e.message : e);
    return fail("Could not send the verification code. Please try again.", 500);
  }

  return new Response(JSON.stringify({}), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
