import { env } from "cloudflare:workers";
import { httpServerHandler } from "cloudflare:node";
import express from "express";

import { canonicalRedirect, notFoundStatus, upgradeTemporaryRedirect, verificationAssetPath } from "./canonical.js";
import { BUILD } from "./build-info.js";

import sendEmailHandler from "../api/send-email.js";
import trackHandler from "../api/track.js";
import metaCapiHandler from "../api/meta-capi.js";
import metaCapiDrainHandler from "../api/meta-capi-drain.js";
import createOrderHandler from "../api/create-order.js";
import verifyPaymentHandler from "../api/verify-payment.js";
import paymentStatusHandler from "../api/payment-status.js";
import adminVerifyPaymentHandler from "../api/admin/verify-payment.js";
import webhookHandler from "../api/webhook.js";
import shiprocketSyncHandler from "../api/shiprocket-sync.js";
import adminHandler from "../api/admin.js";
import supportChatHandler from "../api/support-chat.js";

const app = express();

app.disable("x-powered-by");
// Keep the exact request bytes: the Razorpay and Resend webhooks verify an
// HMAC over them, and re-serialising the parsed body does not reproduce them.
const keepRawBody = (req, _res, buf) => { req.rawBody = buf.toString("utf8"); };
app.use(express.json({ limit: "1mb", verify: keepRawBody }));
app.use(express.urlencoded({ extended: true, limit: "1mb", verify: keepRawBody }));
app.use("/api", (_req, res, next) => { res.setHeader("X-Robots-Tag", "noindex, nofollow"); next(); });

// Presence only — never values. Lets the owner see which Cloudflare secrets
// are missing without logging in anywhere.
const has = (...names) => names.every((n) => Boolean(process.env[n]));
app.get("/api/health", (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json({
    status: "ok",
    // Which commit is live: compare with main after a deploy.
    build: BUILD,
    configured: {
      database: has("SUPABASE_SERVICE_ROLE_KEY"),
      email: has("RESEND_API_KEY"),
      razorpay: has("RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET"),
      razorpayWebhook: has("RAZORPAY_WEBHOOK_SECRET"),
      admin: has("ADMIN_PASSWORD"),
      cron: has("CRON_SECRET"),
      shiprocket: has("SHIPROCKET_EMAIL", "SHIPROCKET_PASSWORD"),
      metaCapi: has("META_CAPI_TOKEN"),
      supportChat: has("GEMINI_API_KEY"),
    },
  });
});

app.all("/api/send-email", (req, res) => sendEmailHandler(req, res));
app.all("/api/track", (req, res) => trackHandler(req, res));
app.all("/api/meta-capi", (req, res) => metaCapiHandler(req, res));
app.all("/api/meta-capi-drain", (req, res) => metaCapiDrainHandler(req, res));
app.all("/api/create-order", (req, res) => createOrderHandler(req, res));
app.all("/api/verify-payment", (req, res) => verifyPaymentHandler(req, res));
app.all("/api/payment-status", (req, res) => paymentStatusHandler(req, res));
app.all("/api/admin", (req, res) => adminHandler(req, res));
app.all("/api/support-chat", (req, res) => supportChatHandler(req, res));
app.all("/api/admin/verify-payment", (req, res) => adminVerifyPaymentHandler(req, res));
app.all("/api/webhook", (req, res) => webhookHandler(req, res));
app.all("/api/shiprocket-sync", (req, res) => shiprocketSyncHandler(req, res));
app.all("/api/admin/test-email", (req, res) => sendEmailHandler(req, res));
app.all("/api/resend-webhook", (req, res) => webhookHandler(req, res));
app.all("/api/payment/create-order", (req, res) => createOrderHandler(req, res));
app.all("/api/payment/verify", (req, res) => verifyPaymentHandler(req, res));
app.all("/api/payment/status", (req, res) => paymentStatusHandler(req, res));
app.all("/api/payment/webhook", (req, res) => webhookHandler(req, res));

function redirectToCanonical(req, res, next) {
  const url = new URL(req.originalUrl || req.url, "https://smelloff.in");
  const path = url.pathname;

  if (path === "/index") return res.redirect(301, "/");
  if (path === "/blog/index") return res.redirect(301, "/blog");

  if (path.endsWith(".html")) {
    const target = path.slice(0, -5) || "/";
    return res.redirect(301, target + url.search);
  }

  if (path !== "/" && path.endsWith("/")) {
    return res.redirect(301, path.slice(0, -1) + url.search);
  }

  next();
}

app.use(redirectToCanonical);

async function fetchAsset(candidate, req) {
  const url = new URL(req.originalUrl || req.url, "https://smelloff.in");
  url.pathname = candidate;
  return env.ASSETS.fetch(new Request(url.toString(), {
    method: req.method,
    headers: req.headers,
  }));
}

async function serveStatic(req, res, next) {
  if (req.method !== "GET" && req.method !== "HEAD") return next();

  const pathname = new URL(req.originalUrl || req.url, "https://smelloff.in").pathname;

  // APIs are handled above.
  if (pathname.startsWith("/api/")) return next();

  const candidates = [];
  if (pathname === "/") {
    candidates.push("/index.html");
  } else {
    candidates.push(pathname);
    if (!pathname.endsWith("/")) candidates.push(pathname + ".html");
    candidates.push(pathname.replace(/\/$/, "") + "/index.html");
  }

  for (const candidate of [...new Set(candidates)]) {
    const response = await fetchAsset(candidate, req);
    if (response.ok) {
      for (const [key, value] of response.headers) res.setHeader(key, value);
      res.status(response.status);
      if (req.method === "HEAD") return res.end();
      return res.end(Buffer.from(await response.arrayBuffer()));
    }
  }

  const notFound = await fetchAsset("/404.html", req);
  for (const [key, value] of notFound.headers) res.setHeader(key, value);
  res.status(404);
  if (req.method === "HEAD") return res.end();
  return res.end(Buffer.from(await notFound.arrayBuffer()));
}

app.use(serveStatic);

app.use((_req, res) => {
  res.status(404).json({ error: "Not Found" });
});

app.listen(3000);
// httpServerHandler() returns an ExportedHandler ({ fetch }), not a function.
const { fetch: fetchHandler } = httpServerHandler({ port: 3000 });

function scheduledMockResponse() {
  return {
    statusCode: 200,
    body: undefined,
    headers: {},
    status(code) { this.statusCode = code; return this; },
    setHeader(key, value) { this.headers[String(key).toLowerCase()] = value; },
    json(value) { this.body = value; return this; },
    send(value) { this.body = value; return this; },
    end(value) { this.body = value; return this; },
  };
}

async function runScheduled(handler) {
  const req = {
    method: "GET",
    headers: {
      authorization: process.env.CRON_SECRET ? `Bearer ${process.env.CRON_SECRET}` : "",
      origin: "https://smelloff.in",
    },
    socket: { remoteAddress: "cloudflare-cron" },
  };
  const res = scheduledMockResponse();
  await handler(req, res);
  return res.statusCode;
}

// Supabase's free tier pauses a project after ~7 days without API traffic,
// which silently stops orders being saved. One tiny read a day prevents it.
async function keepDatabaseAwake() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return;
  const base = (process.env.SUPABASE_URL || "https://tnuqjydmoxczdjnsgpci.supabase.co").replace(/\/$/, "");
  try {
    await fetch(`${base}/rest/v1/orders?select=id&limit=1`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  } catch (error) {
    console.error("[cron] database keep-alive failed:", error?.message || error);
  }
}

// Every page request reaches the Worker first (wrangler.jsonc
// run_worker_first, minus /assets/*) so www and http can be 301'd to
// https://smelloff.in. Pages are still served by the asset server —
// env.ASSETS.fetch() applies _redirects, _headers and html_handling exactly as
// a direct hit does. Misses fall through to Express (404 page, /api).
async function handleFetch(request, workerEnv, ctx) {
  const target = canonicalRedirect(request.url);
  if (target) return Response.redirect(target, 301);

  const { pathname } = new URL(request.url);
  if (!pathname.startsWith("/api/") && (request.method === "GET" || request.method === "HEAD")) {
    const verification = verificationAssetPath(request.url);
    if (verification) {
      const url = new URL(request.url);
      url.pathname = verification;
      const file = await workerEnv.ASSETS.fetch(new Request(url.toString(), request));
      if (file.status === 200) return file;
    }
    const asset = await workerEnv.ASSETS.fetch(request);
    if (asset.status !== 404) return notFoundStatus(request.url, upgradeTemporaryRedirect(request.url, asset));
  }
  return fetchHandler(request, workerEnv, ctx);
}

export default {
  fetch: handleFetch,
  async scheduled(controller) {
    const cron = controller?.cron || "";
    if (cron === "0 3 * * *") {
      await keepDatabaseAwake();
      await runScheduled(metaCapiDrainHandler);
      return;
    }
    if (cron === "*/15 * * * *") {
      await runScheduled(shiprocketSyncHandler);
      return;
    }
  },
};
