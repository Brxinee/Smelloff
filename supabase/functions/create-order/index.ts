import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { clientKey, jsonResponse, preflight, rateLimit } from "../_shared/security.ts";

const UNIT_PRICE_RUPEES = 229;
const COD_FEE_RUPEES = 60;
const MAX_QTY = 5;
const ORDER_CODE_RE = /^SMF-\d{8}-\d{4}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function str(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function generateOrderCode(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  const r = crypto.getRandomValues(new Uint32Array(1))[0] % 10000;
  return `SMF-${y}${m}${d}-${String(r).padStart(4, "0")}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return preflight(req);
  if (req.method !== "POST") return jsonResponse(req, { error: "Method not allowed" }, 405);

  if (!rateLimit(`create-order:${clientKey(req)}`, 8, 10 * 60 * 1000)) {
    return jsonResponse(req, { error: "Too many requests. Please slow down." }, 429);
  }

  try {
    const body = await req.json().catch(() => null) as Record<string, unknown> | null;
    if (!body) return jsonResponse(req, { error: "Invalid request." }, 400);

    const phone = str(body.phone, 20).replace(/\D/g, "").slice(-10);
    if (phone.length !== 10) return jsonResponse(req, { error: "A valid 10-digit phone is required." }, 400);

    const emailRaw = str(body.email, 120).toLowerCase();
    const email = emailRaw && EMAIL_RE.test(emailRaw) ? emailRaw : null;
    if (emailRaw && !email) return jsonResponse(req, { error: "Invalid email address." }, 400);

    const paymentMethod = str(body.payment_method, 10).toLowerCase();
    if (paymentMethod !== "upi" && paymentMethod !== "cod") {
      return jsonResponse(req, { error: "Invalid payment method." }, 400);
    }

    const rawItems = Array.isArray(body.items) ? body.items : null;
    if (!rawItems || rawItems.length !== 1) return jsonResponse(req, { error: "Invalid order items." }, 400);
    const source = (rawItems[0] && typeof rawItems[0] === "object") ? rawItems[0] as Record<string, unknown> : {};
    const quantity = Number(source.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QTY) {
      return jsonResponse(req, { error: "Invalid quantity." }, 400);
    }

    if (Number(source.price) !== UNIT_PRICE_RUPEES) {
      return jsonResponse(req, { error: "Invalid product price." }, 400);
    }

    const subtotalRupees = UNIT_PRICE_RUPEES * quantity;
    const codFeeRupees = paymentMethod === "cod" ? COD_FEE_RUPEES : 0;
    const amountPaise = (subtotalRupees + codFeeRupees) * 100;
    const clientAmount = Number(body.amount);
    if (!Number.isInteger(clientAmount) || clientAmount !== amountPaise) {
      return jsonResponse(req, { error: "Order total mismatch." }, 400);
    }

    const addressIn = (body.address && typeof body.address === "object")
      ? body.address as Record<string, unknown> : null;
    if (!addressIn) return jsonResponse(req, { error: "Delivery address is required." }, 400);
    const address = {
      name: str(addressIn.name, 80),
      line: str(addressIn.line, 200),
      city: str(addressIn.city, 80),
      state: str(addressIn.state, 80),
      pincode: str(addressIn.pincode, 10).replace(/\D/g, "").slice(-6),
    };
    if (!address.name || !address.line || !address.city || !address.state || address.pincode.length !== 6) {
      return jsonResponse(req, { error: "A complete delivery address is required." }, 400);
    }

    const requestedCode = str(body.order_code, 30).toUpperCase();
    let orderCode = ORDER_CODE_RE.test(requestedCode) ? requestedCode : generateOrderCode();

    const items = [{
      name: "ODORSTRIKE Fabric Odor Mist",
      variant: "50ml",
      label: "ODORSTRIKE 50ml",
      quantity,
      price: UNIT_PRICE_RUPEES,
    }];

    const fbp = str(body.fbp, 128) || null;
    const fbc = str(body.fbc, 256) || null;
    const eventSourceUrl = str(body.event_source_url, 512) || null;
    const clientIp = req.headers.get("cf-connecting-ip") || req.headers.get("true-client-ip") || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
    const clientUa = (req.headers.get("user-agent") || "").slice(0, 512) || null;

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const payload = {
      customer_email: email,
      customer_phone: phone,
      items,
      amount: amountPaise,
      payment_method: paymentMethod,
      status: paymentMethod === "upi" ? "upi_pending" : "placed",
      upi_ref: str(body.upi_ref, 40) || null,
      address,
      order_code: orderCode,
    };

    let data: { id: string; order_code?: string } | null = null;
    let error: { code?: string; message?: string } | null = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      const result = await supabase.from("orders").insert(payload).select("id,order_code").single();
      data = result.data as { id: string; order_code?: string } | null;
      error = result.error as { code?: string; message?: string } | null;
      if (!error) break;
      if (error.code !== "23505" || requestedCode) break;
      orderCode = generateOrderCode();
      payload.order_code = orderCode;
    }
    if (error || !data?.id) throw new Error(error?.message || "Order persistence failed");

    if (codFeeRupees > 0) await supabase.from("orders").update({ cod_fee: codFeeRupees * 100 }).eq("id", data.id);
    if (fbp || fbc || clientIp || clientUa || eventSourceUrl) {
      await supabase.from("orders").update({ fbp, fbc, client_ip: clientIp, client_ua: clientUa, event_source_url: eventSourceUrl }).eq("id", data.id);
    }

    return jsonResponse(req, { id: data.id, order_code: data.order_code || orderCode }, 200);
  } catch (error) {
    console.error("[create-order] failed:", error instanceof Error ? error.message : String(error));
    return jsonResponse(req, { error: "Could not place your order. Please try again." }, 500);
  }
});
