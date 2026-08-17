import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  clientKey,
  jsonResponse,
  preflight,
  rateLimit,
} from "../_shared/security.ts";

// Canonical active commercial SKU. The website currently sells one 50ml SKU
// only; historical bundle prices must never be accepted by the live order API.
const ACTIVE_SKU = "OS-001-50ML";
const ACTIVE_PRODUCT_NAME = "ODORSTRIKE Fabric Mist";
const ACTIVE_UNIT_PRICE_RUPEES = 229;
const COD_FEE_RUPEES = 60;
const MAX_ORDER_RUPEES = 20000;

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

    const rawItems = Array.isArray(body.items) ? body.items : null;
    if (!rawItems || rawItems.length !== 1) {
      return jsonResponse(req, { error: "Only the active ODORSTRIKE SKU can be ordered." }, 400);
    }

    const raw = (rawItems[0] && typeof rawItems[0] === "object")
      ? rawItems[0] as Record<string, unknown>
      : {};
    const sku = str(raw.sku, 40);
    const quantity = Number(raw.quantity);
    const submittedPrice = Number(raw.price);

    // The browser cannot activate historical/inactive SKUs by submitting a
    // matching old price. SKU and unit price both have to match the active
    // catalog entry on the server.
    if (sku && sku !== ACTIVE_SKU) {
      return jsonResponse(req, { error: "This product option is no longer available." }, 400);
    }
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 30) {
      return jsonResponse(req, { error: "Invalid quantity." }, 400);
    }
    if (!Number.isInteger(submittedPrice) || submittedPrice !== ACTIVE_UNIT_PRICE_RUPEES) {
      return jsonResponse(req, { error: "The current product price could not be verified." }, 400);
    }

    const items = [{
      sku: ACTIVE_SKU,
      name: ACTIVE_PRODUCT_NAME,
      variant: str(raw.variant, 40),
      label: str(raw.label, 80),
      quantity,
      price: ACTIVE_UNIT_PRICE_RUPEES,
    }];

    const subtotalRupees = ACTIVE_UNIT_PRICE_RUPEES * quantity;
    if (!Number.isInteger(subtotalRupees) || subtotalRupees <= 0 || subtotalRupees > MAX_ORDER_RUPEES) {
      return jsonResponse(req, { error: "Order total could not be verified." }, 400);
    }

    // COD fee is determined server-side from the payment method.
    const codFeeRupees = paymentMethod === "cod" ? COD_FEE_RUPEES : 0;
    const codFeePaise = codFeeRupees * 100;
    const amountPaise = (subtotalRupees + codFeeRupees) * 100;
    const clientAmount = Number(body.amount);
    if (!Number.isInteger(clientAmount) || clientAmount !== amountPaise) {
      return jsonResponse(req, { error: "Order total mismatch." }, 400);
    }

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

    const fbp = str(body.fbp, 128) || null;
    const fbc = str(body.fbc, 256) || null;
    const eventSourceUrl = str(body.event_source_url, 512) || null;
    const clientIpAddr =
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("true-client-ip") ||
      (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() ||
      null;
    const clientUa = (req.headers.get("user-agent") || "").slice(0, 512) || null;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Prevent an accidental retry of the same checkout code from creating a
    // second order when the first insert actually succeeded but the response
    // was lost. The database should also have a unique index on order_code.
    if (order_code) {
      const { data: existing } = await supabase
        .from("orders")
        .select("id")
        .eq("order_code", order_code)
        .maybeSingle();
      if (existing?.id) return jsonResponse(req, { id: existing.id, duplicate: true }, 200);
    }

    const status = paymentMethod === "upi" ? "upi_pending" : "placed";

    const { data, error } = await supabase
      .from("orders")
      .insert({
        customer_email: email,
        customer_phone: phone,
        items,
        amount: amountPaise,
        payment_method: paymentMethod,
        status,
        upi_ref: upiRef,
        address,
        order_code,
      })
      .select("id")
      .single();

    if (error) {
      // If a DB unique constraint catches a race between two identical retries,
      // return the existing order rather than creating/supporting a duplicate.
      if (error.code === "23505" && order_code) {
        const { data: existing } = await supabase
          .from("orders")
          .select("id")
          .eq("order_code", order_code)
          .maybeSingle();
        if (existing?.id) return jsonResponse(req, { id: existing.id, duplicate: true }, 200);
      }
      throw error;
    }

    try {
      if (codFeePaise > 0 && data?.id) {
        await supabase.from("orders").update({ cod_fee: codFeePaise }).eq("id", data.id);
      }
    } catch (_) { /* reporting field is best-effort */ }

    try {
      if (fbp || fbc || clientIpAddr || clientUa || eventSourceUrl) {
        await supabase.from("orders").update({
          fbp,
          fbc,
          client_ip: clientIpAddr,
          client_ua: clientUa,
          event_source_url: eventSourceUrl,
        }).eq("id", data.id);
      }
    } catch (_) { /* attribution is best-effort */ }

    return jsonResponse(req, { id: data.id }, 200);
  } catch (_e) {
    return jsonResponse(req, { error: "Could not place your order. Please try again." }, 500);
  }
});