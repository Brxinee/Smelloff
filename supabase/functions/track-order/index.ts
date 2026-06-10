import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const code = String(body.order_code || "").trim().toUpperCase();
    const phone = String(body.phone || "").replace(/\D/g, "").slice(-10);

    if (!/^SMF-\d{8}-\d{4}$/.test(code) || phone.length !== 10) {
      return json({ error: "Enter your order ID (SMF-…) and the 10-digit phone used at checkout." }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: order, error } = await supabase
      .from("orders")
      .select("order_code, created_at, status, payment_method, amount, items, tracking_id, courier, tracking_url, customer_phone, address")
      .eq("order_code", code)
      .maybeSingle();

    // Phone must match the one on the order — a generic error either way so the
    // endpoint can't be used to probe which order codes exist.
    const orderPhone = String(order?.customer_phone || "").replace(/\D/g, "").slice(-10);
    if (error || !order || orderPhone !== phone) {
      return json({ error: "No order found for that ID + phone combination. Check both and try again, or WhatsApp us." }, 404);
    }

    // Sanitized response: no email, no street address — only what the customer
    // needs to see the order's progress.
    const addr = (order.address || {}) as Record<string, string>;
    return json({
      order_code: order.order_code,
      placed_at: order.created_at,
      status: order.status,
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
    return json({ error: "Something went wrong. Try again in a minute." }, 500);
  }
});
