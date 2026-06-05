import { NextResponse } from "next/server";
import { z } from "zod";
import { logOrderToSheet } from "@/lib/sheets";
import { customerSchema, cartItemSchema } from "@/lib/validators/order";
import {
  FREE_SHIPPING_THRESHOLD,
  FLAT_SHIPPING,
  COD_FEE,
} from "@/lib/constants";
import type { Order } from "@/types";

export const runtime = "nodejs";

const bodySchema = z.object({
  customer: customerSchema,
  items: z.array(cartItemSchema).min(1),
  paymentMethod: z.literal("cod"),
});

/** Creates + logs a COD order. */
export async function POST(req: Request) {
  let body;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid order" }, { status: 400 });
  }

  const subtotal = body.items.reduce((s, i) => s + i.price * i.qty, 0);
  const shipping = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : FLAT_SHIPPING;
  const orderId = `COD-${Date.now().toString(36).toUpperCase()}`;

  const order: Order = {
    id: orderId,
    items: body.items,
    customer: body.customer,
    subtotal,
    shipping,
    codFee: COD_FEE,
    total: subtotal + shipping + COD_FEE,
    paymentMethod: "cod",
    createdAt: new Date().toISOString(),
  };

  try {
    await logOrderToSheet(order);
  } catch (e) {
    console.error("[sheets] COD log failed", e);
    // Still confirm the order to the customer; reconcile from server logs.
  }

  return NextResponse.json({ ok: true, orderId });
}
