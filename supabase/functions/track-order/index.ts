import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  clientKey,
  jsonResponse,
  preflight,
  rateLimit,
} from "../_shared/security.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return preflight(req);
  if (req.method !== "POST") {
    return jsonResponse(req, { error: "Method not allowed" }, 405);
  }

  // Throttle lookups so the code+phone pair can't be brute-forced: 15 / 10 min / IP.
  if (!rateLimit(`track-order:${clientKey(req)}`, 15, 10 * 60 * 1000)) {
    return jsonResponse(req, { error: "Too many requests. Please slow down." }, 429);
  }

  try {
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return jsonResponse(req, { error: "Invalid request." }, 400);
    }

    const code = String(body.order_code || "").trim().toUpperCase();
    const phone = String(body.phone || "").replace(/\D/g, "").slice(-10);

    if (!/^SMF-\d{8}-\d{4}$/.test(code) || phone.length !== 10) {
      return jsonResponse(req, { error: "Enter your order ID (SMF-…) and the 10-digit phone used at checkout." }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: order, error } = await supabase
      .from("orders")
      .select("order_code, created_at, updated_at, status, status_history, payment_method, amount, items, tracking_id, courier, tracking_url, customer_phone, address")
      .eq("order_code", code)
      .maybeSingle();

    // Phone must match the one on the order — a generic error either way so the
    // endpoint can't be used to probe which order codes exist.
    const orderPhone = String(order?.customer_phone || "").replace(/\D/g, "").slice(-10);
    if (error || !order || orderPhone !== phone) {
      return jsonResponse(req, { error: "No order found for that ID + phone combination. Check both and try again, or WhatsApp us." }, 404);
    }

    // Sanitized response: no email, no street address — only what the customer
    // needs to see the order's progress. status_history is a timestamped trail
    // ([{status, at}]) so the timeline can show WHEN each stage happened.
    const addr = (order.address || {}) as Record<string, string>;
    const history = Array.isArray(order.status_history) ? order.status_history : [];
    return jsonResponse(req, {
      order_code: order.order_code,
      placed_at: order.created_at,
      updated_at: order.updated_at,
      status: order.status,
      status_history: history,
      payment_method: order.payment_method,
      amount: order.amount, // paise
      items: order.items,
      city: addr.city || null,
      state: addr.state || null,
      tracking_id: order.tracking_id,
      courier: order.courier,
      tracking_url: order.tracking_url,
    });
  } catch (_e) {
    return jsonResponse(req, { error: "Something went wrong. Try again in a minute." }, 500);
  }
});
