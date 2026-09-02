import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import sendEmailHandler from './api/send-email.js';
import trackHandler from './api/track.js';
import metaCapiHandler from './api/meta-capi.js';
import metaCapiDrainHandler from './api/meta-capi-drain.js';
import createOrderHandler from './api/create-order.js';
import verifyPaymentHandler from './api/verify-payment.js';
import paymentStatusHandler from './api/payment-status.js';
import adminVerifyPaymentHandler from './api/admin/verify-payment.js';
import webhookHandler from './api/webhook.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Vercel redirects, read from vercel.json so the dev server matches production.
// The 40 pruned blog slugs alone are why this is worth loading rather than
// hand-listing: without it, `node server.js` 404s on URLs that 301 in prod.
//
// Only *literal* sources are registered. Vercel's matcher is its own dialect —
// `/policies/:slug(a|b|c)` is valid there and throws in Express 5's router
// (path-to-regexp 8 dropped inline regex groups). Anything with a pattern
// character, and anything with a `has` condition (host matching, which the dev
// server can't reproduce), is skipped and hand-written below instead.
const vercelConfigPath = path.join(__dirname, 'vercel.json');
if (fs.existsSync(vercelConfigPath)) {
  try {
    const { redirects } = JSON.parse(fs.readFileSync(vercelConfigPath, 'utf8'));
    if (Array.isArray(redirects)) {
      for (const rule of redirects) {
        if (!rule.source || !rule.destination || rule.has) continue;
        if (/[:*()[\]$?+]/.test(rule.source)) continue;
        const status = rule.permanent === false ? 302 : 301;
        app.get(rule.source, (req, res) => res.redirect(status, rule.destination));
      }
    }
  } catch (err) {
    console.error('server.js: could not read redirects from vercel.json —', err.message);
  }
}

// Patterned redirects, hand-written because Vercel's matcher syntax above
// doesn't survive translation to Express.
app.get('/r/:code', (req, res) => {
  res.redirect(`/?ref=${encodeURIComponent(req.params.code)}`);
});

app.get('/policies/:slug', (req, res) => {
  const allowed = ['privacy', 'terms', 'returns', 'refund', 'shipping', 'cancellation', 'payment-failed'];
  if (allowed.includes(req.params.slug)) {
    return res.redirect(301, `/${req.params.slug}`);
  }
  res.redirect(301, '/');
});

app.get('/index', (req, res) => {
  res.redirect(301, '/');
});

app.get('/solutions/index', (req, res) => {
  res.redirect(301, '/solutions');
});

app.get('/blog/index', (req, res) => {
  res.redirect(301, '/blog');
});

// Machine-readable product catalog for AI shopping agents. CORS-open on purpose:
// it exists to be fetched cross-origin. Vercel serves the file directly in prod;
// this route only adds the headers the static handler below wouldn't.
app.get('/products.json', (req, res) => {
  const productsPath = path.join(__dirname, 'products.json');
  if (!fs.existsSync(productsPath)) {
    return res.status(404).json({ error: 'Product catalog not found' });
  }
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.sendFile(productsPath);
});

// API Routes
app.all('/api/send-email', (req, res) => sendEmailHandler(req, res));
app.all('/api/track', (req, res) => trackHandler(req, res));
app.all('/api/meta-capi', (req, res) => metaCapiHandler(req, res));
app.all('/api/meta-capi-drain', (req, res) => metaCapiDrainHandler(req, res));
app.all('/api/create-order', (req, res) => createOrderHandler(req, res));
app.all('/api/verify-payment', (req, res) => verifyPaymentHandler(req, res));
app.all('/api/payment-status', (req, res) => paymentStatusHandler(req, res));
app.all('/api/admin/verify-payment', (req, res) => adminVerifyPaymentHandler(req, res));
app.all('/api/webhook', (req, res) => webhookHandler(req, res));
app.all('/api/payment/create-order', (req, res) => createOrderHandler(req, res));
app.all('/api/payment/verify', (req, res) => verifyPaymentHandler(req, res));
app.all('/api/payment/status', (req, res) => paymentStatusHandler(req, res));
app.all('/api/payment/webhook', (req, res) => webhookHandler(req, res));

// Clean URL & static file handling middleware
app.use((req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();

  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath.endsWith('/') && urlPath !== '/') {
    urlPath = urlPath.slice(0, -1);
  }

  let filePath = path.join(__dirname, urlPath);

  // Check if target is a directory and has index.html
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    const indexPath = path.join(filePath, 'index.html');
    if (fs.existsSync(indexPath)) {
      return res.sendFile(indexPath);
    }
  }

  // Check direct file existence
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    return res.sendFile(filePath);
  }

  // Clean URLs: try adding .html extension
  if (!path.extname(filePath)) {
    const htmlPath = filePath + '.html';
    if (fs.existsSync(htmlPath) && fs.statSync(htmlPath).isFile()) {
      return res.sendFile(htmlPath);
    }
  }

  next();
});

// 404 handler
app.use((req, res) => {
  const custom404 = path.join(__dirname, '404.html');
  if (fs.existsSync(custom404)) {
    res.status(404).sendFile(custom404);
  } else {
    res.status(404).send('Not Found');
  }
});

app.listen(PORT, HOST, () => {
  console.log(`Server running at http://${HOST}:${PORT}`);
});
