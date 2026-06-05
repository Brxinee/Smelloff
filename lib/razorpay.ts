import crypto from "node:crypto";

/**
 * Server-only Razorpay helpers. The secret key never reaches the client.
 * Orders are created via the REST API to avoid pulling in the SDK.
 */

const KEY_ID = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

export function razorpayConfigured(): boolean {
  return Boolean(KEY_ID && KEY_SECRET);
}

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  status: string;
}

/** Create an order server-side. Amount is in rupees; Razorpay wants paise. */
export async function createRazorpayOrder(
  amountRupees: number,
  receipt: string
): Promise<RazorpayOrder> {
  if (!razorpayConfigured()) {
    throw new Error("Razorpay is not configured");
  }
  const auth = Buffer.from(`${KEY_ID}:${KEY_SECRET}`).toString("base64");
  const res = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: Math.round(amountRupees * 100),
      currency: "INR",
      receipt,
      payment_capture: 1,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Razorpay order failed: ${res.status} ${text}`);
  }
  return (await res.json()) as RazorpayOrder;
}

/** Verify the HMAC signature returned by Razorpay Checkout. */
export function verifyRazorpaySignature(params: {
  orderId: string;
  paymentId: string;
  signature: string;
}): boolean {
  if (!KEY_SECRET) return false;
  const expected = crypto
    .createHmac("sha256", KEY_SECRET)
    .update(`${params.orderId}|${params.paymentId}`)
    .digest("hex");
  // Constant-time compare
  const a = Buffer.from(expected);
  const b = Buffer.from(params.signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
