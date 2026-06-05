import { z } from "zod";

/** Indian pincode: 6 digits, not starting with 0. */
const pincode = z
  .string()
  .regex(/^[1-9][0-9]{5}$/, "Enter a valid 6-digit pincode");

/** Indian mobile: 10 digits starting 6-9, optional +91. */
const phone = z
  .string()
  .regex(/^(?:\+?91)?[6-9]\d{9}$/, "Enter a valid 10-digit mobile number");

export const customerSchema = z.object({
  name: z.string().min(2, "Please enter your name"),
  email: z.string().email("Enter a valid email"),
  phone,
  address1: z.string().min(4, "Enter your address"),
  address2: z.string().optional(),
  city: z.string().min(2, "Enter your city"),
  state: z.string().min(2, "Enter your state"),
  pincode,
});

export const cartItemSchema = z.object({
  variantId: z.string(),
  productHandle: z.string(),
  name: z.string(),
  label: z.string(),
  price: z.number().int().positive(),
  size: z.string(),
  qty: z.number().int().positive().max(20),
  image: z.string(),
});

/**
 * Server-side order input. We deliberately accept ONLY the variant id and
 * quantity from the client — price, label, size, name and image are always
 * re-derived from the product catalog server-side (never trust client prices).
 * Unknown keys (e.g. a tampered `price`) are stripped by zod and ignored.
 */
export const orderItemInputSchema = z.object({
  variantId: z.string().min(1),
  qty: z.number().int().positive().max(20),
});

export type OrderItemInput = z.infer<typeof orderItemInputSchema>;

export const checkoutSchema = z.object({
  customer: customerSchema,
  items: z.array(cartItemSchema).min(1, "Your cart is empty"),
  paymentMethod: z.enum(["razorpay", "cod"]),
});

export type CustomerInput = z.infer<typeof customerSchema>;
export type CheckoutInput = z.infer<typeof checkoutSchema>;
