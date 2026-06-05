"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { contactSchema, type ContactInput } from "@/lib/validators/contact";

export function ContactForm() {
  const [done, setDone] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ContactInput>({ resolver: zodResolver(contactSchema) });

  const onSubmit = async (data: ContactInput) => {
    setError(null);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error();
      setDone(true);
    } catch {
      setError("Couldn't send your message. Please WhatsApp or email us instead.");
    }
  };

  if (done) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <CheckCircle2 className="h-12 w-12 text-success" aria-hidden />
        <h2 className="text-xl">Message sent</h2>
        <p className="text-ink-2">Thanks for reaching out — we&apos;ll reply soon.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      <h2 className="text-xl">Send us a message</h2>
      <Field label="Name" required error={errors.name?.message}>
        {(p) => <Input autoComplete="name" {...p} {...register("name")} />}
      </Field>
      <Field label="Email" required error={errors.email?.message}>
        {(p) => <Input type="email" autoComplete="email" {...p} {...register("email")} />}
      </Field>
      <Field label="Order ID (optional)" hint="If your question is about an order">
        {(p) => <Input {...p} {...register("orderId")} />}
      </Field>
      <Field label="Message" required error={errors.message?.message}>
        {(p) => <Textarea {...p} {...register("message")} />}
      </Field>
      {error && (
        <p role="alert" className="text-sm text-error">
          {error}
        </p>
      )}
      <Button type="submit" loading={isSubmitting}>
        Send message
      </Button>
    </form>
  );
}
