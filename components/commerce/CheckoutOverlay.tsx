"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Lock } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { useCartStore } from "@/lib/cart-store";
import { useUIStore } from "@/lib/ui-store";
import { formatINR } from "@/lib/format";
import { customerSchema, type CustomerInput } from "@/lib/validators/order";
import { COD_FEE } from "@/lib/constants";
import { markHasOrdered } from "@/lib/buyer";
import { trackPurchase } from "@/lib/analytics";
import type { OrderPaymentMethod } from "@/types";

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  order_id: string;
  name: string;
  description: string;
  prefill: { name: string; email: string; contact: string };
  theme: { color: string };
  handler: (res: RazorpayResponse) => void;
  modal?: { ondismiss?: () => void };
}
interface RazorpayResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}
declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => { open: () => void };
  }
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

export function CheckoutOverlay() {
  const open = useUIStore((s) => s.checkoutOpen);
  const close = useUIStore((s) => s.closeCheckout);
  const items = useCartStore((s) => s.items);
  const subtotal = useCartStore((s) => s.subtotal());
  const shipping = useCartStore((s) => s.shipping());
  const clear = useCartStore((s) => s.clear);

  const [method, setMethod] = React.useState<OrderPaymentMethod>("razorpay");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [confirmedId, setConfirmedId] = React.useState<string | null>(null);

  const codFee = method === "cod" ? COD_FEE : 0;
  const total = subtotal + shipping + codFee;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CustomerInput>({
    resolver: zodResolver(customerSchema),
    mode: "onBlur",
  });

  const finalize = React.useCallback(
    (orderId: string) => {
      markHasOrdered();
      trackPurchase({
        id: orderId,
        total,
        items: items.map((i) => ({ name: i.label, qty: i.qty, price: i.price })),
      });
      clear();
      setConfirmedId(orderId);
    },
    [clear, items, total]
  );

  const onSubmit = async (customer: CustomerInput) => {
    setError(null);
    setSubmitting(true);
    try {
      if (method === "cod") {
        const res = await fetch("/api/sheets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ customer, items, paymentMethod: "cod" }),
        });
        if (!res.ok) throw new Error("Could not place your COD order.");
        const data = (await res.json()) as { orderId: string };
        finalize(data.orderId);
        return;
      }

      // Razorpay path
      const orderRes = await fetch("/api/razorpay/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: total, items }),
      });
      if (!orderRes.ok) {
        const data = (await orderRes.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(data.error ?? "Could not start payment. Try COD instead.");
      }
      const order = (await orderRes.json()) as {
        id: string;
        amount: number;
        currency: string;
        keyId: string;
      };

      const loaded = await loadRazorpayScript();
      if (!loaded || !window.Razorpay) {
        throw new Error("Payment SDK failed to load. Check your connection.");
      }

      const rzp = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        order_id: order.id,
        name: "Smelloff — ODORSTRIKE",
        description: "Fabric odor eliminator",
        prefill: {
          name: customer.name,
          email: customer.email,
          contact: customer.phone,
        },
        theme: { color: "#0F6E78" },
        handler: async (resp) => {
          try {
            const verifyRes = await fetch("/api/razorpay/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpay_order_id: resp.razorpay_order_id,
                razorpay_payment_id: resp.razorpay_payment_id,
                razorpay_signature: resp.razorpay_signature,
                customer,
                items,
              }),
            });
            if (!verifyRes.ok) throw new Error("verify failed");
            finalize(resp.razorpay_payment_id);
          } catch {
            setError(
              "Payment received but confirmation failed. We'll email you — keep your payment ID."
            );
          }
        },
        modal: { ondismiss: () => setSubmitting(false) },
      });
      rzp.open();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  // Reset confirmation when reopening
  React.useEffect(() => {
    if (open) setConfirmedId(null);
  }, [open]);

  return (
    <Modal open={open} onClose={close} title="Checkout" fullScreen>
      {confirmedId ? (
        <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
          <CheckCircle2 className="h-14 w-14 text-success" aria-hidden />
          <h3 className="font-display text-2xl">Order confirmed</h3>
          <p className="text-ink-2">
            Thank you! Your order ID is{" "}
            <strong className="text-ink">{confirmedId}</strong>. We&apos;ll send
            updates to your email and phone.
          </p>
          <Button onClick={close} variant="secondary">
            Continue shopping
          </Button>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="grid gap-6 p-5 lg:grid-cols-[1fr_320px]"
          noValidate
        >
          <div className="flex flex-col gap-6">
            <section aria-labelledby="contact-h">
              <h3 id="contact-h" className="mb-3 font-display text-lg">
                Contact
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Full name" required error={errors.name?.message}>
                  {(p) => <Input autoComplete="name" {...p} {...register("name")} />}
                </Field>
                <Field label="Phone" required error={errors.phone?.message}>
                  {(p) => (
                    <Input
                      type="tel"
                      autoComplete="tel"
                      inputMode="numeric"
                      {...p}
                      {...register("phone")}
                    />
                  )}
                </Field>
                <Field
                  label="Email"
                  required
                  error={errors.email?.message}
                  className="sm:col-span-2"
                >
                  {(p) => (
                    <Input type="email" autoComplete="email" {...p} {...register("email")} />
                  )}
                </Field>
              </div>
            </section>

            <section aria-labelledby="ship-h">
              <h3 id="ship-h" className="mb-3 font-display text-lg">
                Shipping address
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Address"
                  required
                  error={errors.address1?.message}
                  className="sm:col-span-2"
                >
                  {(p) => (
                    <Input autoComplete="address-line1" {...p} {...register("address1")} />
                  )}
                </Field>
                <Field label="Apartment, landmark (optional)" className="sm:col-span-2">
                  {(p) => (
                    <Input autoComplete="address-line2" {...p} {...register("address2")} />
                  )}
                </Field>
                <Field label="City" required error={errors.city?.message}>
                  {(p) => <Input autoComplete="address-level2" {...p} {...register("city")} />}
                </Field>
                <Field label="State" required error={errors.state?.message}>
                  {(p) => <Input autoComplete="address-level1" {...p} {...register("state")} />}
                </Field>
                <Field label="Pincode" required error={errors.pincode?.message}>
                  {(p) => (
                    <Input
                      inputMode="numeric"
                      autoComplete="postal-code"
                      {...p}
                      {...register("pincode")}
                    />
                  )}
                </Field>
              </div>
            </section>

            <section aria-labelledby="pay-h">
              <h3 id="pay-h" className="mb-3 font-display text-lg">
                Payment
              </h3>
              <div className="grid gap-3">
                {(["razorpay", "cod"] as const).map((m) => (
                  <label
                    key={m}
                    className={`flex cursor-pointer items-center justify-between rounded-xl border-2 p-4 ${
                      method === m ? "border-brand bg-brand-tint/40" : "border-border"
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="payment"
                        checked={method === m}
                        onChange={() => setMethod(m)}
                        className="h-4 w-4 accent-[var(--brand)]"
                      />
                      <span className="font-medium text-ink">
                        {m === "razorpay"
                          ? "Pay online (UPI / Cards / Netbanking)"
                          : "Cash on Delivery"}
                      </span>
                    </span>
                    {m === "cod" && (
                      <span className="text-sm text-ink-3">+{formatINR(COD_FEE)} fee</span>
                    )}
                  </label>
                ))}
              </div>
              <p className="mt-2 text-xs text-ink-3">
                All costs shown upfront — no surprises. Prefer prepaid? UPI is
                instant and fee-free.
              </p>
            </section>
          </div>

          {/* Persistent order summary */}
          <aside className="h-fit rounded-xl border border-border bg-surface p-5 lg:sticky lg:top-4">
            <h3 className="mb-3 font-display text-lg">Order summary</h3>
            <ul className="mb-3 space-y-2 text-sm">
              {items.map((i) => (
                <li key={i.variantId} className="flex justify-between gap-2">
                  <span className="text-ink-2">
                    {i.label} × {i.qty}
                  </span>
                  <span className="text-ink">{formatINR(i.price * i.qty)}</span>
                </li>
              ))}
            </ul>
            <dl className="space-y-1 border-t border-border pt-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-ink-2">Subtotal</dt>
                <dd className="text-ink">{formatINR(subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-2">Shipping</dt>
                <dd className="text-ink">
                  {shipping === 0 ? "Free" : formatINR(shipping)}
                </dd>
              </div>
              {codFee > 0 && (
                <div className="flex justify-between">
                  <dt className="text-ink-2">COD fee</dt>
                  <dd className="text-ink">{formatINR(codFee)}</dd>
                </div>
              )}
              <div className="flex justify-between border-t border-border pt-2 text-base font-bold">
                <dt>Total</dt>
                <dd>{formatINR(total)}</dd>
              </div>
            </dl>

            {error && (
              <p role="alert" className="mt-3 text-sm text-error">
                {error}
              </p>
            )}

            <Button
              type="submit"
              fullWidth
              size="lg"
              loading={submitting}
              className="mt-4"
              disabled={items.length === 0}
            >
              <Lock className="h-4 w-4" aria-hidden />
              {method === "cod" ? "Place COD order" : `Pay ${formatINR(total)}`}
            </Button>
            <p className="mt-3 text-center text-xs text-ink-3">
              Secure checkout · Card data never stored · 7-day returns
            </p>
          </aside>
        </form>
      )}
    </Modal>
  );
}
