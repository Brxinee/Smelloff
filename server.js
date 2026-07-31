import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import sendEmailHandler from './api/send-email.js';
import trackHandler from './api/track.js';
import metaCapiHandler from './api/meta-capi.js';
import metaCapiDrainHandler from './api/meta-capi-drain.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Vercel redirects & rewrites from vercel.json
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

app.get('/blog/index', (req, res) => {
  res.redirect(301, '/blog');
});

// API Routes
app.all('/api/send-email', (req, res) => sendEmailHandler(req, res));
app.all('/api/track', (req, res) => trackHandler(req, res));
app.all('/api/meta-capi', (req, res) => metaCapiHandler(req, res));
app.all('/api/meta-capi-drain', (req, res) => metaCapiDrainHandler(req, res));

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
