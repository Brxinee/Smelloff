"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2 } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { newsletterSchema, type NewsletterInput } from "@/lib/validators/contact";

export function Newsletter() {
  const [done, setDone] = React.useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<NewsletterInput>({ resolver: zodResolver(newsletterSchema) });

  const onSubmit = async (data: NewsletterInput) => {
    try {
      await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    } catch {
      /* non-blocking: still show success UX */
    } finally {
      setDone(true);
    }
  };

  return (
    <section className="section-y bg-bg" aria-labelledby="news-h">
      <Container>
        <div className="mx-auto max-w-xl rounded-2xl border border-border bg-surface p-8 text-center">
          <h2 id="news-h" className="text-2xl">
            Launch offers, no spam
          </h2>
          <p className="mt-2 text-ink-2">
            Get early-bird pricing and restock alerts. We email occasionally and
            you can unsubscribe any time.
          </p>
          {done ? (
            <p className="mt-6 inline-flex items-center gap-2 font-medium text-success">
              <CheckCircle2 className="h-5 w-5" aria-hidden /> You&apos;re on the
              list. Thank you!
            </p>
          ) : (
            <form
              onSubmit={handleSubmit(onSubmit)}
              className="mt-6 flex flex-col gap-4 text-left"
              noValidate
            >
              <Field label="Email" error={errors.email?.message}>
                {(p) => (
                  <Input
                    type="email"
                    placeholder="you@email.com"
                    autoComplete="email"
                    {...p}
                    {...register("email")}
                  />
                )}
              </Field>
              <label className="flex items-start gap-2 text-sm text-ink-2">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 accent-[var(--brand)]"
                  {...register("consent")}
                />
                <span>
                  I agree to receive marketing emails from Smelloff and accept the{" "}
                  <a href="/privacy" className="underline">
                    Privacy Policy
                  </a>
                  . (DPDP consent)
                </span>
              </label>
              {errors.consent && (
                <p className="text-sm text-error">{errors.consent.message}</p>
              )}
              <Button type="submit" loading={isSubmitting}>
                Subscribe
              </Button>
            </form>
          )}
        </div>
      </Container>
    </section>
  );
}
