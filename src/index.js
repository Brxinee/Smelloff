import { env } from "cloudflare:workers";
import { httpServerHandler } from "cloudflare:node";
import express from "express";

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
import magicCheckoutFinalizeHandler from "../api/magic-checkout-finalize.js";
import magicCheckoutShippingInfoHandler from "../api/magic-checkout-shipping-info.js";

const app = express();

app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.all("/api/send-email", (req, res) => sendEmailHandler(req, res));
app.all("/api/track", (req, res) => trackHandler(req, res));
app.all("/api/meta-capi", (req, res) => metaCapiHandler(req, res));
app.all("/api/meta-capi-drain", (req, res) => metaCapiDrainHandler(req, res));
app.all("/api/create-order", (req, res) => createOrderHandler(req, res));
app.all("/api/verify-payment", (req, res) => verifyPaymentHandler(req, res));
app.all("/api/payment-status", (req, res) => paymentStatusHandler(req, res));
app.all("/api/admin/verify-payment", (req, res) => adminVerifyPaymentHandler(req, res));
app.all("/api/webhook", (req, res) => webhookHandler(req, res));
app.all("/api/shiprocket-sync", (req, res) => shiprocketSyncHandler(req, res));
app.all("/api/magic-checkout-finalize", (req, res) => magicCheckoutFinalizeHandler(req, res));
app.all("/api/magic-checkout-shipping-info", (req, res) => magicCheckoutShippingInfoHandler(req, res));
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
  if (path === "/solutions/index") return res.redirect(301, "/solutions");
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

const fetchHandler = httpServerHandler({ port: 3000 });

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

export default {
  fetch: fetchHandler,
  async scheduled(controller) {
    const cron = controller?.cron || "";
    if (cron === "0 3 * * *") {
      await runScheduled(metaCapiDrainHandler);
      return;
    }
    if (cron === "0 10 * * *") {
      await runScheduled(shiprocketSyncHandler);
      return;
    }
  },
};
