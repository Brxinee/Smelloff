import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { email, phone, items, amount, payment_method, address, upi_ref, order_code } = body;

    // Email is optional — phone is the primary identifier for guest checkout.
    if (!phone || !items || !amount || !payment_method || !address) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const code = String(order_code || "").trim().toUpperCase();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const status = payment_method === "upi" ? "upi_pending" : "placed";

    const { data, error } = await supabase
      .from("orders")
      .insert({
        customer_email: email || null,
        customer_phone: phone,
        items,
        amount,          // already in paise from the browser
        payment_method,
        status,
        upi_ref: upi_ref || null,
        address,
        order_code: /^SMF-\d{8}-\d{4}$/.test(code) ? code : null,
      })
      .select("id")
      .single();

    if (error) throw error;

    return new Response(
      JSON.stringify({ id: data.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Internal error";
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
