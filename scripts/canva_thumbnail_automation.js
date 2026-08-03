#!/usr/bin/env node
/**
 * canva_thumbnail_automation.js
 *
 * Generates blog featured imagery through the Canva Connect Autofill API, driven
 * by the same scripts/thumbnails/thumbnails.config.mjs the local compositor uses,
 * so the copy and photography cannot drift between the two renderers.
 *
 *   export CANVA_ACCESS_TOKEN="..."      # OAuth 2.0 access token
 *   export CANVA_TEMPLATE_ID="..."       # brand_template_id
 *
 *   node scripts/canva_thumbnail_automation.js --all
 *   node scripts/canva_thumbnail_automation.js --slug gym-clothes-smell-after-washing
 *   node scripts/canva_thumbnail_automation.js --text "Why Gym Clothes Reek" --image ./macro.jpg
 *
 * ---------------------------------------------------------------------------
 * PREREQUISITE — this needs a PAID Canva plan.
 *
 * Brand Templates and the Autofill API are Canva Pro / Teams / Enterprise
 * features. On a Free plan every brand-template call returns:
 *
 *   "This feature requires a Canva paid plan (such as Canva Pro, Canva Teams,
 *    or Canva Enterprise)."
 *
 * The connected Smelloff account was on Free when this was written, which is why
 * the committed thumbnails were produced by scripts/thumbnails/build-thumbnails.mjs
 * instead. Nothing here has been executed end-to-end against a live template.
 *
 * Setup, once the plan allows it:
 *   1. Canva Developer Portal -> create a Public Integration; note Client ID/Secret.
 *   2. Enable scopes: brandtemplate:content:read, brandtemplate:meta:read,
 *      design:content:write, asset:read, asset:write.
 *   3. Add your redirect URL under Authorized Redirects.
 *   4. Create a Brand Template sized 1920x1080 containing a text field named
 *      `headline_text` and an image frame named `main_visual`. Record its id.
 *   5. Export CANVA_ACCESS_TOKEN and CANVA_TEMPLATE_ID, then run --all.
 *
 * ---------------------------------------------------------------------------
 * DELIBERATE DEVIATIONS from the reference script in the research PDF:
 *
 *  - Asset upload posts RAW BINARY with an `Asset-Upload-Metadata` header, which
 *    is what /v1/asset-uploads actually accepts. The PDF's JSON `{name, file_base64}`
 *    body is rejected by the live endpoint with 400.
 *  - Native fetch and a small arg parser instead of axios + minimist, so this adds
 *    no dependencies to a repo that ships three.
 *  - The 6-word overlay limit is a hard error, not a console.warn. A warning in a
 *    batch of 17 scrolls past unnoticed, and the whole point of the limit is that
 *    exceeding it costs measurable CTR.
 *  - Polling is bounded and backs off, so a stuck job fails instead of spinning.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const API_BASE_URL = 'https://api.canva.com/rest/v1';
const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 120000;

const CANVA_ACCESS_TOKEN = process.env.CANVA_ACCESS_TOKEN;
const CANVA_TEMPLATE_ID = process.env.CANVA_TEMPLATE_ID;

/* ------------------------------------------------------------------ helpers */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) args[key] = true;
      else { args[key] = next; i++; }
    } else args._.push(a);
  }
  return args;
}

function authHeaders(extra = {}) {
  return { Authorization: `Bearer ${CANVA_ACCESS_TOKEN}`, ...extra };
}

/** Turns Canva's HTTP failures into messages that say what to actually do. */
async function canvaFetch(url, options = {}) {
  const res = await fetch(url, options);
  if (res.ok) return res.json();

  let detail = '';
  try { detail = JSON.stringify(await res.json()); } catch { detail = await res.text().catch(() => ''); }

  const hint =
    res.status === 401
      ? 'CANVA_ACCESS_TOKEN is missing, expired or malformed — mint a fresh OAuth token.'
      : res.status === 403
        ? 'Forbidden. Either the token lacks a required scope (brandtemplate:content:read, ' +
          'design:content:write, asset:write) or the account is not on a paid plan — ' +
          'Brand Templates and Autofill are Pro/Teams/Enterprise only.'
        : res.status === 404
          ? 'Not found. Check CANVA_TEMPLATE_ID belongs to this account.'
          : res.status === 429
            ? `Rate limited. Retry after ${res.headers.get('retry-after') || 'a short'} seconds.`
            : '';

  throw new Error(`${options.method || 'GET'} ${url} -> ${res.status} ${res.statusText}\n  ${detail}${hint ? `\n  ${hint}` : ''}`);
}

async function pollJob(url, label) {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  let wait = POLL_INTERVAL_MS;

  while (Date.now() < deadline) {
    await sleep(wait);
    const body = await canvaFetch(url, { headers: authHeaders() });
    const job = body.job || body;
    const status = job.status;

    if (status === 'success') return job;
    if (status === 'failed') {
      throw new Error(`${label} failed: ${JSON.stringify(job.error || job)}`);
    }
    wait = Math.min(Math.round(wait * 1.25), 8000);
  }
  throw new Error(`${label} did not finish within ${POLL_TIMEOUT_MS / 1000}s`);
}

/* --------------------------------------------------------------- validation */

function validateTextOverlay(text) {
  const words = String(text).trim().split(/\s+/).filter(Boolean);
  if (!words.length) throw new Error('text overlay is empty');
  if (words.length > 6) {
    throw new Error(
      `text overlay is ${words.length} words ("${text}"). CTR guidance caps overlays at 6; ` +
        `past 10 the measured drop is ~16%. Shorten it in thumbnails.config.mjs.`
    );
  }
  return text;
}

/* ------------------------------------------------------------------ the API */

/** POST /v1/asset-uploads, then poll until the asset id is available. */
async function uploadAsset(filePath) {
  const absolutePath = path.resolve(filePath);
  if (!fs.existsSync(absolutePath)) throw new Error(`file not found: ${absolutePath}`);

  const name = path.basename(absolutePath);
  console.log(`  [1/3] uploading ${name} …`);

  const body = fs.readFileSync(absolutePath);
  const started = await canvaFetch(`${API_BASE_URL}/asset-uploads`, {
    method: 'POST',
    headers: authHeaders({
      'Content-Type': 'application/octet-stream',
      // The live endpoint takes the filename base64-encoded in a header and the
      // file itself as the raw body — not a JSON {file_base64} payload.
      'Asset-Upload-Metadata': JSON.stringify({
        name_base64: Buffer.from(name, 'utf8').toString('base64'),
      }),
    }),
    body,
  });

  const job = started.job || started;
  if (job.status === 'success' && job.asset) {
    console.log(`        asset id ${job.asset.id}`);
    return job.asset.id;
  }

  const done = await pollJob(`${API_BASE_URL}/asset-uploads/${job.id}`, 'asset upload');
  console.log(`        asset id ${done.asset.id}`);
  return done.asset.id;
}

/** POST /v1/autofills — maps the brand template's dataset fields. */
async function triggerAutofill(templateId, textOverlay, assetId, title) {
  validateTextOverlay(textOverlay);
  console.log(`  [2/3] autofilling template ${templateId} …`);

  const started = await canvaFetch(`${API_BASE_URL}/autofills`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      brand_template_id: templateId,
      title: title || `Blog_Thumbnail_${Date.now()}`,
      data: {
        headline_text: { type: 'text', text: textOverlay },
        main_visual: { type: 'image', asset_id: assetId },
      },
    }),
  });

  const jobId = (started.job || started).id;
  console.log(`        job ${jobId}`);
  return jobId;
}

/** GET /v1/autofills/{jobId} until it resolves. */
async function pollAutofillJob(jobId) {
  console.log(`  [3/3] waiting on job ${jobId} …`);
  const job = await pollJob(`${API_BASE_URL}/autofills/${jobId}`, 'autofill');
  const design = job.result?.design || job.design;
  console.log(`        design ${design.id} — ${design.url}`);
  return design;
}

async function generateOne({ text, image, title }) {
  const assetId = await uploadAsset(image);
  const jobId = await triggerAutofill(CANVA_TEMPLATE_ID, text, assetId, title);
  return pollAutofillJob(jobId);
}

/* -------------------------------------------------------------------- main */

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!CANVA_ACCESS_TOKEN || !CANVA_TEMPLATE_ID) {
    console.error(
      'CANVA_ACCESS_TOKEN and CANVA_TEMPLATE_ID must both be set.\n' +
        'See the setup notes at the top of this file.'
    );
    process.exit(1);
  }

  // Ad-hoc single render, matching the invocation in the research PDF.
  if (args.text || args.image) {
    if (!args.text || !args.image) {
      console.error('--text and --image must be given together.');
      process.exit(1);
    }
    await generateOne({ text: args.text, image: args.image, title: `Blog_Thumbnail_${Date.now()}` });
    return;
  }

  // Config-driven batch — the normal path.
  const { POSTS, validateConfig } = await import(
    pathToFileURL(path.join(__dirname, 'thumbnails', 'thumbnails.config.mjs')).href
  );
  validateConfig();

  const sources = process.env.THUMBNAIL_SOURCES || path.join(__dirname, '..', '.thumbnail-sources');
  const slug = typeof args.slug === 'string' ? args.slug : null;
  const posts = slug ? POSTS.filter((p) => p.slug === slug) : POSTS;

  if (!posts.length) {
    console.error(slug ? `unknown slug: ${slug}` : 'nothing to do');
    process.exit(1);
  }
  if (!slug && !args.all) {
    console.error('Refusing to render all posts without --all (each run creates new Canva designs).');
    process.exit(1);
  }

  console.log(`Generating ${posts.length} thumbnail(s) via Canva Autofill\n`);
  const results = [];

  for (const post of posts) {
    const text = `${post.top} ${post.hi}`.trim();
    console.log(`${post.slug} — "${text}"`);
    try {
      const design = await generateOne({
        text,
        image: path.join(sources, `${post.photo}.jpg`),
        title: `Blog_${post.slug}`,
      });
      results.push({ slug: post.slug, url: design.url });
    } catch (err) {
      console.error(`  ! ${err.message}\n`);
      results.push({ slug: post.slug, error: err.message });
    }
    console.log('');
  }

  const ok = results.filter((r) => r.url);
  console.log(`--- ${ok.length}/${results.length} generated ---`);
  for (const r of ok) console.log(`${r.slug}\n  ${r.url}`);
  if (ok.length !== results.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error(`\nAutomation pipeline failed: ${err.message}`);
  process.exit(1);
});
