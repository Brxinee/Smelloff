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
import shiprocketSyncHandler from './api/shiprocket-sync.js';
import magicCheckoutFinalizeHandler from './api/magic-checkout-finalize.js';
import magicCheckoutShippingInfoHandler from './api/magic-checkout-shipping-info.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;
const HOST = '0.0.0.0';

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

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

app.get('/r/:code', (req, res) => {
  res.redirect(`/?ref=${encodeURIComponent(req.params.code)}`);
});

app.get('/policies/:slug', (req, res) => {
  const allowed = ['privacy', 'terms', 'returns', 'refund', 'shipping', 'cancellation', 'payment-failed'];
  if (allowed.includes(req.params.slug)) return res.redirect(301, `/${req.params.slug}`);
  res.redirect(301, '/');
});

app.get('/index', (req, res) => res.redirect(301, '/'));
app.get('/solutions/index', (req, res) => res.redirect(301, '/solutions'));
app.get('/blog/index', (req, res) => res.redirect(301, '/blog'));

app.get('/products.json', (req, res) => {
  const productsPath = path.join(__dirname, 'products.json');
  if (!fs.existsSync(productsPath)) return res.status(404).json({ error: 'Product catalog not found' });
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
app.all('/api/shiprocket-sync', (req, res) => shiprocketSyncHandler(req, res));
app.all('/api/magic-checkout-finalize', (req, res) => magicCheckoutFinalizeHandler(req, res));
app.all('/api/magic-checkout-shipping-info', (req, res) => magicCheckoutShippingInfoHandler(req, res));
app.all('/api/admin/test-email', (req, res) => sendEmailHandler(req, res));
app.all('/api/resend-webhook', (req, res) => webhookHandler(req, res));
app.all('/api/payment/create-order', (req, res) => createOrderHandler(req, res));
app.all('/api/payment/verify', (req, res) => verifyPaymentHandler(req, res));
app.all('/api/payment/status', (req, res) => paymentStatusHandler(req, res));
app.all('/api/payment/webhook', (req, res) => webhookHandler(req, res));

app.use((req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();

  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath.endsWith('/') && urlPath !== '/') urlPath = urlPath.slice(0, -1);

  const filePath = path.join(__dirname, urlPath);
  if (!filePath.startsWith(__dirname + path.sep) && filePath !== __dirname) {
    return res.status(403).send('Forbidden');
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    const indexPath = path.join(filePath, 'index.html');
    if (fs.existsSync(indexPath)) return res.sendFile(indexPath);
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) return res.sendFile(filePath);

  if (!path.extname(filePath)) {
    const htmlPath = filePath + '.html';
    if (fs.existsSync(htmlPath) && fs.statSync(htmlPath).isFile()) return res.sendFile(htmlPath);
  }

  next();
});

app.use((req, res) => {
  const custom404 = path.join(__dirname, '404.html');
  if (fs.existsSync(custom404)) res.status(404).sendFile(custom404);
  else res.status(404).send('Not Found');
});

app.listen(PORT, HOST, () => {
  console.log(`Server running at http://${HOST}:${PORT}`);
});
