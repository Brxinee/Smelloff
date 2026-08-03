import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  clientKey,
  jsonResponse,
  preflight,
  rateLimit,
} from "../_shared/security.ts";

// Canonical server-side price table (rupees). This is the source of truth for
// what an order may cost — the browser's `amount` is NEVER trusted. An order
// total is only valid if it can be composed from these pack prices (a customer
// can buy any mix of packs via the cart), and the submitted amount must match
// the line item, which must in turn match this table.
const PACK_PRICES = [229, 399, 549];
const MAX_ORDER_RUPEES = 20000; // generous ceiling; caps the DP + absurd orders.
// Handling charge added when the customer pays cash on delivery. Server-side
// only: the client proposes a total, this decides whether the surcharge is part
// of it. Must match CFG.COD_FEE in odorstrike.html — if the two disagree, every
// COD order fails the guard below with "Order total mismatch".
const COD_FEE_RUPEES = 60;

// Is `rupees` expressible as a sum of pack prices (i.e. a legitimate order total)?
function isValidTotal(rupees: number): boolean {
  if (!Number.isInteger(rupees) || rupees <= 0 || rupees > MAX_ORDER_RUPEES) {
    return false;
  }
  const reachable = new Uint8Array(rupees + 1);
  reachable[0] = 1;
  for (const price of PACK_PRICES) {
    for (let i = price; i <= rupees; i++) {
      if (reachable[i - price]) reachable[i] = 1;
    }
  }
  return reachable[rupees] === 1;
}

const ORDER_CODE_RE = /^SMF-\d{8}-\d{4}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function str(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return preflight(req);
  if (req.method !== "POST") {
    return jsonResponse(req, { error: "Method not allowed" }, 405);
  }

  // Throttle: 8 order attempts per IP per 10 minutes.
  if (!rateLimit(`create-order:${clientKey(req)}`, 8, 10 * 60 * 1000)) {
    return jsonResponse(req, { error: "Too many requests. Please slow down." }, 429);
  }

  try {
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return jsonResponse(req, { error: "Invalid request." }, 400);
    }
    if (typeof body !== "object" || body === null) {
      return jsonResponse(req, { error: "Invalid request." }, 400);
    }

    // --- Normalise + validate identity / contact ---
    const phone = str(body.phone, 20).replace(/\D/g, "").slice(-10);
    if (phone.length !== 10) {
      return jsonResponse(req, { error: "A valid 10-digit phone is required." }, 400);
    }

    const emailRaw = str(body.email, 120).toLowerCase();
    const email = emailRaw && EMAIL_RE.test(emailRaw) ? emailRaw : null;
    if (emailRaw && !email) {
      return jsonResponse(req, { error: "Invalid email address." }, 400);
    }

    const paymentMethod = str(body.payment_method, 10).toLowerCase();
    if (paymentMethod !== "upi" && paymentMethod !== "cod") {
      return jsonResponse(req, { error: "Invalid payment method." }, 400);
    }

    // --- Validate line items ---
    const rawItems = Array.isArray(body.items) ? body.items : null;
    if (!rawItems || rawItems.length < 1 || rawItems.length > 10) {
      return jsonResponse(req, { error: "Invalid order items." }, 400);
    }
    // Re-shape items to a known schema so we never persist arbitrary client JSON.
    const items = rawItems.map((it) => {
      const o = (it && typeof it === "object") ? it as Record<string, unknown> : {};
      const qty = Number(o.quantity);
      return {
        name: str(o.name, 80) || "ODORSTRIKE Fabric Mist",
        variant: str(o.variant, 40),
        label: str(o.label, 80),
        quantity: Number.isInteger(qty) && qty > 0 && qty <= 30 ? qty : 1,
        price: Number(o.price),
      };
    });

    // --- Price guard: recompute trust server-side, never from the client total ---
    // The browser submits a single line item carrying the UNIT price and the
    // quantity; the subtotal is `price × quantity` and must be composable from
    // the pack table. Reading `price` as if it were already the line total was a
    // bug: a two-bottle order submitted price 229 with amount ₹458, the guard
    // compared ₹458 against ₹229 and rejected it, so every order of more than
    // one bottle silently failed to mirror into the database.
    if (items.length !== 1) {
      return jsonResponse(req, { error: "Unexpected order shape." }, 400);
    }
    const subtotalRupees = items[0].price * items[0].quantity;
    if (!isValidTotal(subtotalRupees)) {
      return jsonResponse(req, { error: "Order total could not be verified." }, 400);
    }
    // The COD handling charge is decided HERE, from the payment method, and is
    // never read from the request — otherwise the one figure the customer pays
    // over and above the product price would be client-controlled.
    const codFeeRupees = paymentMethod === "cod" ? COD_FEE_RUPEES : 0;
    const codFeePaise = codFeeRupees * 100;
    // Server-computed amount in paise — this is what we store, not body.amount.
    const amountPaise = (subtotalRupees + codFeeRupees) * 100;
    const clientAmount = Number(body.amount);
    if (!Number.isInteger(clientAmount) || clientAmount !== amountPaise) {
      // Client tried to pay an amount that doesn't match the verified price.
      return jsonResponse(req, { error: "Order total mismatch." }, 400);
    }

    // --- Validate address ---
    const addrIn = (body.address && typeof body.address === "object")
      ? body.address as Record<string, unknown>
      : null;
    if (!addrIn) {
      return jsonResponse(req, { error: "Delivery address is required." }, 400);
    }
    const address = {
      name: str(addrIn.name, 80),
      line: str(addrIn.line, 200),
      city: str(addrIn.city, 80),
      state: str(addrIn.state, 80),
      pincode: str(addrIn.pincode, 10).replace(/\D/g, "").slice(0, 6),
    };
    if (!address.line || !address.city || !address.state || address.pincode.length !== 6) {
      return jsonResponse(req, { error: "A complete delivery address is required." }, 400);
    }

    const upiRef = str(body.upi_ref, 40) || null;
    const codeRaw = str(body.order_code, 20).toUpperCase();
    const order_code = ORDER_CODE_RE.test(codeRaw) ? codeRaw : null;

    // Meta CAPI attribution — stored so the server-side Purchase/Refund (fired
    // later from the order lifecycle) can build strong Advanced Matching without
    // depending on the shopper's browser still being open. fbp/fbc/url come from
    // the client; the real IP + UA are read from headers (never trusted from the
    // body). cf-connecting-ip is preferred so we get the shopper, not a CF POP.
    const fbp = str(body.fbp, 128) || null;
    const fbc = str(body.fbc, 256) || null;
    const eventSourceUrl = str(body.event_source_url, 512) || null;
    const clientIpAddr =
      (req.headers.get("cf-connecting-ip") ||
        req.headers.get("true-client-ip") ||
        (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() ||
        null) || null;
    const clientUa = (req.headers.get("user-agent") || "").slice(0, 512) || null;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const status = paymentMethod === "upi" ? "upi_pending" : "placed";

    const { data, error } = await supabase
      .from("orders")
      .insert({
        customer_email: email,
        customer_phone: phone,
        items,
        amount: amountPaise, // server-verified, in paise
        payment_method: paymentMethod,
        status,
        upi_ref: upiRef,
        address,
        order_code,
      })
      .select("id")
      .single();

    if (error) throw error;

    // Best-effort, same reasoning as the CAPI stamp below: cod_fee arrives in a
    // separate update so a deploy that lands before migration 20260804 still
    // takes the order. The charge is already inside `amount`, so losing this
    // write costs reporting granularity, never money.
    try {
      if (codFeePaise > 0 && data?.id) {
        await supabase
          .from("orders")
          .update({ cod_fee: codFeePaise })
          .eq("id", data.id);
      }
    } catch (_) { /* column not migrated yet — ignore */ }

    // Best-effort: stamp the Meta CAPI attribution fields in a SEPARATE update
    // so order creation never depends on those columns existing (the migration
    // may not be applied yet). A failure here is swallowed — the order is
    // already saved and the response is unaffected.
    try {
      if (fbp || fbc || clientIpAddr || clientUa || eventSourceUrl) {
        await supabase
          .from("orders")
          .update({
            fbp,
            fbc,
            client_ip: clientIpAddr,
            client_ua: clientUa,
            event_source_url: eventSourceUrl,
          })
          .eq("id", data.id);
      }
    } catch (_e) { /* attribution is best-effort; never block the order */ }

    return jsonResponse(req, { id: data.id }, 200);
  } catch (_e) {
    // Generic message — never leak internal/DB error details to the client.
    return jsonResponse(req, { error: "Could not place your order. Please try again." }, 500);
  }
});
