import { NextResponse } from "next/server";
import { z } from "zod";
import { logOrderToSheet } from "@/lib/sheets";
import { customerSchema, orderItemInputSchema } from "@/lib/validators/order";
import { repriceCart } from "@/lib/content";
import { shippingFor, COD_FEE } from "@/lib/constants";
import type { Order } from "@/types";

export const runtime = "nodejs";

const bodySchema = z.object({
  customer: customerSchema,
  items: z.array(orderItemInputSchema).min(1),
  paymentMethod: z.literal("cod"),
});

/** Creates + logs a COD order. Prices are derived server-side from the catalog. */
export async function POST(req: Request) {
  let body;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid order" }, { status: 400 });
  }

  let items;
  try {
    items = repriceCart(body.items);
  } catch {
    return NextResponse.json({ error: "Cart contains an invalid item" }, { status: 400 });
  }

  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  const shipping = shippingFor(subtotal);
  const orderId = `COD-${Date.now().toString(36).toUpperCase()}`;

  const order: Order = {
    id: orderId,
    items,
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
