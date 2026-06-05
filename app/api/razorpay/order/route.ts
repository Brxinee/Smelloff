import { NextResponse } from "next/server";
import { z } from "zod";
import { createRazorpayOrder, razorpayConfigured } from "@/lib/razorpay";
import { cartItemSchema } from "@/lib/validators/order";

export const runtime = "nodejs";

const bodySchema = z.object({
  amount: z.number().int().positive(),
  items: z.array(cartItemSchema).min(1),
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

  // Recompute amount server-side from item prices — never trust the client total.
  const computed = parsed.items.reduce((sum, i) => sum + i.price * i.qty, 0);
  // Allow shipping/COD deltas but reject obviously tampered amounts.
  if (parsed.amount < computed) {
    return NextResponse.json({ error: "Amount mismatch" }, { status: 400 });
  }

  try {
    const order = await createRazorpayOrder(
      parsed.amount,
      `sm_${Date.now()}`
    );
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
