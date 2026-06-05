import { NextResponse } from "next/server";
import { z } from "zod";
import { createRazorpayOrder, razorpayConfigured } from "@/lib/razorpay";
import { orderItemInputSchema } from "@/lib/validators/order";
import { repriceCart } from "@/lib/content";
import { shippingFor } from "@/lib/constants";

export const runtime = "nodejs";

const bodySchema = z.object({
  // `amount` from the client is ignored — the total is computed server-side.
  items: z.array(orderItemInputSchema).min(1),
});

export async function POST(req: Request) {
  if (!razorpayConfigured()) {
    return NextResponse.json(
      { error: "Online payment is not available right now. Please use COD." },
      { status: 503 }
    );
  }

  let parsed;
  try {
    parsed = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // Reprice every line from the catalog by variantId — never trust client prices.
  let items;
  try {
    items = repriceCart(parsed.items);
  } catch {
    return NextResponse.json({ error: "Cart contains an invalid item" }, { status: 400 });
  }

  const subtotal = items.reduce((sum, i) => sum + i.price * i.qty, 0);
  const total = subtotal + shippingFor(subtotal);

  try {
    const order = await createRazorpayOrder(total, `sm_${Date.now()}`);
    return NextResponse.json({
      id: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
    });
  } catch (e) {
    console.error("[razorpay/order]", e);
    return NextResponse.json(
      { error: "Could not start payment. Please try COD." },
      { status: 502 }
    );
  }
}
