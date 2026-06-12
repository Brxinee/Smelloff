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

  if (!rateLimit(`cancel-order:${clientKey(req)}`, 15, 10 * 60 * 1000)) {
    return jsonResponse(req, { error: "Too many requests. Please slow down." }, 429);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
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
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId)) {
      return jsonResponse(req, { error: "Missing or invalid order_id" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Verify the caller's JWT and get their identity (authentication).
    const jwt = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);

    if (authError || !user) {
      return jsonResponse(req, { error: "Unauthorized" }, 401);
    }

    // Re-fetch the order to verify ownership and current status.
    const { data: order, error: fetchError } = await supabase
      .from("orders")
      .select("id, customer_email, status")
      .eq("id", orderId)
      .single();

    if (fetchError || !order) {
      return jsonResponse(req, { error: "Order not found" }, 404);
    }

    // Authorization: the order must belong to the authenticated user. Guest
    // orders (no email) can't be cancelled via the logged-in flow — fail closed
    // rather than crash on a null email.
    const orderEmail = (order.customer_email || "").toLowerCase();
    if (!orderEmail || orderEmail !== (user.email || "").toLowerCase()) {
      return jsonResponse(req, { error: "Unauthorized" }, 403);
    }

    // Only allow cancellation before dispatch.
    const cancellable = ["placed", "upi_pending", "confirmed"];
    if (!cancellable.includes(order.status)) {
      return jsonResponse(req, { error: "Order cannot be cancelled — it has already been dispatched or delivered." }, 422);
    }

    // Mark as cancelled. UPI refunds are handled manually offline by the merchant.
    const { error: updateError } = await supabase
      .from("orders")
      .update({ status: "cancelled" })
      .eq("id", orderId);

    if (updateError) throw updateError;

    return jsonResponse(req, { success: true }, 200);
  } catch (_e) {
    return jsonResponse(req, { error: "Could not cancel the order. Please try again." }, 500);
  }
});
