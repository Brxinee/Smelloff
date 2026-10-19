import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { jsonResponse, preflight } from "../_shared/security.ts";

// Retired. Checkout posts to the Worker's /api/create-order, which
// prices orders from config/product.json. This copy wrote orders with the
// service-role key from any caller, at stale prices, and its COD rows were
// booked into Shiprocket by the 15-minute sync.
// It stays deployed only as this stub so the old URL answers 410 instead of
// running the old code. Delete it in Supabase (Edge Functions → create-order →
// Delete) and then remove this folder.
Deno.serve((req: Request) => {
  if (req.method === "OPTIONS") return preflight(req);
  return jsonResponse(req, { error: "This endpoint has been retired." }, 410);
});
