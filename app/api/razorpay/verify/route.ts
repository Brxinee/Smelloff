import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyRazorpaySignature } from "@/lib/razorpay";
import { logOrderToSheet } from "@/lib/sheets";
import { customerSchema, cartItemSchema } from "@/lib/validators/order";
import { FREE_SHIPPING_THRESHOLD, FLAT_SHIPPING } from "@/lib/constants";
import type { Order } from "@/types";

export const runtime = "nodejs";

const bodySchema = z.object({
  razorpay_order_id: z.string(),
  razorpay_payment_id: z.string(),
  razorpay_signature: z.string(),
  customer: customerSchema,
  items: z.array(cartItemSchema).min(1),
});

export async function POST(req: Request) {
  let body;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const valid = verifyRazorpaySignature({
    orderId: body.razorpay_order_id,
    paymentId: body.razorpay_payment_id,
    signature: body.razorpay_signature,
  });

  if (!valid) {
    return NextResponse.json({ error: "Signature verification failed" }, { status: 400 });
  }

  const subtotal = body.items.reduce((s, i) => s + i.price * i.qty, 0);
  const shipping = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : FLAT_SHIPPING;

  const order: Order = {
    id: body.razorpay_payment_id,
    items: body.items,
    customer: body.customer,
    subtotal,
    shipping,
    codFee: 0,
    total: subtotal + shipping,
    paymentMethod: "razorpay",
    createdAt: new Date().toISOString(),
    razorpayOrderId: body.razorpay_order_id,
    razorpayPaymentId: body.razorpay_payment_id,
  };

  try {
    await logOrderToSheet(order);
  } catch (e) {
    // Never strand a paid order on a logging failure.
    console.error("[razorpay/verify] sheet log failed", e);
  }

  return NextResponse.json({ ok: true, orderId: order.id });
}
