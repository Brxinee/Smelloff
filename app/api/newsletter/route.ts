import { NextResponse } from "next/server";
import { newsletterSchema } from "@/lib/validators/contact";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let data;
  try {
    data = newsletterSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  // DPDP-consented opt-in. Wire to your ESP / Sheet here.
  // Kept env-gated so the form works out of the box without a provider.
  console.info("[newsletter] subscribe", { email: data.email });

  return NextResponse.json({ ok: true });
}
