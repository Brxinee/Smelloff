import { NextResponse } from "next/server";
import { contactSchema } from "@/lib/validators/contact";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let data;
  try {
    data = contactSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid message" }, { status: 400 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.CONTACT_TO_EMAIL;

  // Env-gated: if Resend isn't configured, accept gracefully (log server-side).
  if (!apiKey || !to) {
    console.info("[contact] (no email transport configured)", {
      name: data.name,
      email: data.email,
    });
    return NextResponse.json({ ok: true });
  }

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? "Smelloff <onboarding@resend.dev>",
      to,
      replyTo: data.email,
      subject: `Contact form — ${data.name}${data.orderId ? ` (Order ${data.orderId})` : ""}`,
      text: `From: ${data.name} <${data.email}>\nOrder: ${data.orderId ?? "—"}\n\n${data.message}`,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[contact] send failed", e);
    return NextResponse.json({ error: "Send failed" }, { status: 502 });
  }
}
