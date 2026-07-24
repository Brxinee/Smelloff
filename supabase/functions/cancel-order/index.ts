import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  clientKey,
  jsonResponse,
  preflight,
  rateLimit,
} from "../_shared/security.ts";

// Self-serve cancellation, allowed only while the parcel is still with us.
//
// Ownership is checked against orders.user_id (stamped at checkout from the
// verified phone session). The previous version matched on customer_email,
// which could never succeed once login moved to phone OTP — email is optional
// at checkout and is not part of the session identity.
//
// This runs service-role on purpose: customers hold SELECT on their orders and
// nothing more, so the pre-dispatch rule can't be sidestepped with a crafted
// PostgREST update.

// Everything up to and including "packed" is still in our hands. Once it is
// "dispatched" the courier has it and cancellation becomes a return.
const CANCELLABLE = ["placed", "upi_pending", "confirmed", "packed"];

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return preflight(req);
  if (req.method !== "POST") {
    return jsonResponse(req, { error: "Method not allowed" }, 405);
  }

  if (!rateLimit(`cancel-order:${clientKey(req)}`, 15, 10 * 60 * 1000)) {
    return jsonResponse(req, { error: "Too many requests. Please slow down." }, 429);
  }

  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    return jsonResponse(req, { error: "Unauthorized" }, 401);
  }

  try {
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return jsonResponse(req, { error: "Invalid request." }, 400);
    }

    const orderId = String(body.order_id || "").trim();
    if (!UUID_RE.test(orderId)) {
      return jsonResponse(req, { error: "Missing or invalid order_id" }, 400);
    }
    // Optional free-text reason from the cancel dialog.
    const reason = typeof body.reason === "string"
      ? body.reason.trim().slice(0, 300) || null
      : null;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Authentication: who is calling?
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (authError || !user) {
      return jsonResponse(req, { error: "Unauthorized" }, 401);
    }
    const userPhone = String(user.phone || "").replace(/\D/g, "").slice(-10);

    const { data: order, error: fetchError } = await supabase
      .from("orders")
      .select("id, user_id, customer_phone, status, payment_method, order_code")
      .eq("id", orderId)
      .maybeSingle();

    if (fetchError || !order) {
      return jsonResponse(req, { error: "Order not found" }, 404);
    }

    // Authorization: the order is the caller's, either by the stamped owner or
    // — for an order placed before the account existed — by verified phone.
    const ownsById = order.user_id && order.user_id === user.id;
    const ownsByPhone = !order.user_id &&
      userPhone.length === 10 &&
      String(order.customer_phone || "").replace(/\D/g, "").slice(-10) === userPhone;
    if (!ownsById && !ownsByPhone) {
      // Same message as "not found" so this can't be used to probe order ids.
      return jsonResponse(req, { error: "Order not found" }, 404);
    }

    if (order.status === "cancelled") {
      return jsonResponse(req, { error: "This order is already cancelled." }, 409);
    }
    if (!CANCELLABLE.includes(order.status)) {
      return jsonResponse(req, {
        error: order.status === "delivered"
          ? "This order has already been delivered. Start a return instead — see our returns policy."
          : "This order has already been dispatched, so it can't be cancelled. Refuse the delivery or start a return once it arrives.",
      }, 422);
    }

    // Guard against a race with the admin dispatching it a moment ago: only
    // flip the row if it is STILL in a cancellable state.
    const { data: updated, error: updateError } = await supabase
      .from("orders")
      .update({
        status: "cancelled",
        cancel_reason: reason,
        // cancelled_at is stamped by the orders_track_status trigger.
      })
      .eq("id", orderId)
      .in("status", CANCELLABLE)
      .select("id, status, order_code, payment_method")
      .maybeSingle();

    if (updateError) throw updateError;
    if (!updated) {
      return jsonResponse(req, {
        error: "This order was just dispatched, so it can no longer be cancelled.",
      }, 409);
    }

    // UPI refunds are issued manually by the merchant; COD owes nothing.
    return jsonResponse(req, {
      success: true,
      order_code: updated.order_code,
      refund_due: updated.payment_method === "upi",
    }, 200);
  } catch (_e) {
    return jsonResponse(req, { error: "Could not cancel the order. Please try again." }, 500);
  }
});
