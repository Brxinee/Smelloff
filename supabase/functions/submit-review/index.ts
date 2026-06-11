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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const b = await req.json();
    const orderId = String(b.order_id || "").trim();
    const rating = Number(b.rating);
    const body = String(b.body || "").trim();
    const anonymous = !!b.anonymous;
    const name = anonymous ? "Anonymous" : String(b.name || "").trim().slice(0, 60) || "Anonymous";

    if (!UUID_RE.test(orderId)) {
      return json({ error: "Reviews are for verified buyers — we couldn't find your purchase on this device." }, 403);
    }
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return json({ error: "Pick a star rating." }, 400);
    }
    if (body.length < 8 || body.length > 600) {
      return json({ error: "Write at least a sentence (max 600 characters)." }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // The order must exist — that's what makes "Verified buyer" real.
    const { data: order } = await supabase
      .from("orders")
      .select("id, status, address")
      .eq("id", orderId)
      .maybeSingle();

    if (!order || order.status === "cancelled") {
      return json({ error: "Reviews are for verified buyers — we couldn't match your purchase." }, 403);
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
        return json({ error: "You've already reviewed this order — thank you!" }, 409);
      }
      throw error;
    }

    return json({ review: data });
  } catch (_e) {
    return json({ error: "Could not post your review. Please try again." }, 500);
  }
});
