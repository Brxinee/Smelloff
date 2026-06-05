import { NextResponse } from "next/server";
import { z } from "zod";
import {
  verifyRazorpaySignature,
  fetchRazorpayOrder,
} from "@/lib/razorpay";
import { logOrderToSheet } from "@/lib/sheets";
import { customerSchema, orderItemInputSchema } from "@/lib/validators/order";
import { repriceCart } from "@/lib/content";
import { shippingFor } from "@/lib/constants";
import type { Order } from "@/types";

export const runtime = "nodejs";

const bodySchema = z.object({
  razorpay_order_id: z.string(),
  razorpay_payment_id: z.string(),
  razorpay_signature: z.string(),
  customer: customerSchema,
  items: z.array(orderItemInputSchema).min(1),
});

export async function POST(req: Request) {
  let body;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // 1) Authenticate the payment signature (order_id|payment_id).
  const valid = verifyRazorpaySignature({
    orderId: body.razorpay_order_id,
    paymentId: body.razorpay_payment_id,
    signature: body.razorpay_signature,
  });
  if (!valid) {
    return NextResponse.json({ error: "Signature verification failed" }, { status: 400 });
  }

  // 2) Reprice the claimed items from the catalog (never trust client prices).
  let items;
  try {
    items = repriceCart(body.items);
  } catch {
    return NextResponse.json({ error: "Cart contains an invalid item" }, { status: 400 });
  }
  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  const shipping = shippingFor(subtotal);
  const total = subtotal + shipping;

  // 3) Bind the order contents to what was actually paid: the authenticated
  //    Razorpay order amount must equal the server-recomputed total. This stops
  //    a client paying for a cheap order then claiming more expensive items.
  try {
    const rzpOrder = await fetchRazorpayOrder(body.razorpay_order_id);
    if (rzpOrder.amount !== Math.round(total * 100)) {
      return NextResponse.json(
        { error: "Order amount does not match payment" },
        { status: 400 }
      );
    }
  } catch (e) {
    console.error("[razorpay/verify] amount check failed", e);
    return NextResponse.json({ error: "Could not confirm payment" }, { status: 502 });
  }

  const order: Order = {
    id: body.razorpay_payment_id,
    items,
    customer: body.customer,
    subtotal,
    shipping,
    codFee: 0,
    total,
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
