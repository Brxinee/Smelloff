import type { Order } from "@/types";

/**
 * Order logging to Google Sheets. Two supported transports:
 *  - SHEETS_WEBHOOK_URL (Apps Script) — simplest, used if present.
 *  - Service account via googleapis — used if webhook absent and creds present.
 * Credentials never reach the client; this module is server-only.
 */

export async function logOrderToSheet(order: Order): Promise<void> {
  const webhook = process.env.SHEETS_WEBHOOK_URL;
  if (webhook) {
    await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(serializeOrder(order)),
    });
    return;
  }

  const sheetId = process.env.GOOGLE_SHEETS_ID;
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  if (!sheetId || !email || !key) {
    // Env-gated: no transport configured. Log and move on — never strand the order.
    console.warn("[sheets] No Sheets transport configured; skipping order log.");
    return;
  }

  // Lazy import so the heavy googleapis dep isn't bundled unless used.
  const { google } = await import("googleapis");
  const auth = new google.auth.JWT({
    email,
    key: key.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const sheets = google.sheets({ version: "v4", auth });
  const row = serializeOrder(order);
  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: "Orders!A1",
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [Object.values(row)] },
  });
}

function serializeOrder(order: Order): Record<string, string> {
  return {
    createdAt: order.createdAt,
    orderId: order.id,
    name: order.customer.name,
    phone: order.customer.phone,
    email: order.customer.email,
    address: [
      order.customer.address1,
      order.customer.address2,
      order.customer.city,
      order.customer.state,
      order.customer.pincode,
    ]
      .filter(Boolean)
      .join(", "),
    items: order.items.map((i) => `${i.label} x${i.qty}`).join(" | "),
    subtotal: String(order.subtotal),
    shipping: String(order.shipping),
    codFee: String(order.codFee),
    total: String(order.total),
    payment: order.paymentMethod,
    razorpayPaymentId: order.razorpayPaymentId ?? "",
  };
}
