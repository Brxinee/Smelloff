import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  clientKey,
  jsonResponse,
  preflight,
  rateLimit,
} from "../_shared/security.ts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return preflight(req);
  if (req.method !== "POST") {
    return jsonResponse(req, { error: "Method not allowed" }, 405);
  }

  // Throttle review submissions: 10 / 10 min / IP.
  if (!rateLimit(`submit-review:${clientKey(req)}`, 10, 10 * 60 * 1000)) {
    return jsonResponse(req, { error: "Too many requests. Please slow down." }, 429);
  }

  try {
    let b: Record<string, unknown>;
    try {
      b = await req.json();
    } catch {
      return jsonResponse(req, { error: "Invalid request." }, 400);
    }

    const orderId = String(b.order_id || "").trim();
    const rating = Number(b.rating);
    const body = String(b.body || "").trim();
    const anonymous = !!b.anonymous;
    const name = anonymous ? "Anonymous" : String(b.name || "").trim().slice(0, 60) || "Anonymous";

    if (!UUID_RE.test(orderId)) {
      return jsonResponse(req, { error: "Reviews are for verified buyers — we couldn't find your purchase on this device." }, 403);
    }
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return jsonResponse(req, { error: "Pick a star rating." }, 400);
    }
    if (body.length < 8 || body.length > 600) {
      return jsonResponse(req, { error: "Write at least a sentence (max 600 characters)." }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // The order must exist — that's what makes "Verified buyer" real.
    const { data: order } = await supabase
      .from("orders")
      .select("id, status, address")
      .eq("id", orderId)
      .maybeSingle();

    if (!order || order.status === "cancelled") {
      return jsonResponse(req, { error: "Reviews are for verified buyers — we couldn't match your purchase." }, 403);
    }

    const addr = (order.address || {}) as Record<string, string>;
    const { data, error } = await supabase
      .from("reviews")
      .insert({
        name,
        rating,
        body,
        anonymous,
        city: addr.city || null,
        order_id: order.id,
      })
      .select("name, rating, body, city, anonymous, created_at")
      .single();

    if (error) {
      // unique index on order_id: one review per order
      if (String(error.code) === "23505") {
        return jsonResponse(req, { error: "You've already reviewed this order — thank you!" }, 409);
      }
      throw error;
    }

    return jsonResponse(req, { review: data });
  } catch (_e) {
    return jsonResponse(req, { error: "Could not post your review. Please try again." }, 500);
  }
});
