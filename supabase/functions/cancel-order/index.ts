import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { jsonResponse, preflight } from "../_shared/security.ts";

// Retired. It relied on Supabase Auth logins, which the site
// does not use (there are no auth users), and cancelled orders with the
// service-role key for any token whose email matched an order.
// It stays deployed only as this stub so the old URL answers 410 instead of
// running the old code. Delete it in Supabase (Edge Functions → cancel-order →
// Delete) and then remove this folder.
Deno.serve((req: Request) => {
  if (req.method === "OPTIONS") return preflight(req);
  return jsonResponse(req, { error: "This endpoint has been retired." }, 410);
});
