#!/usr/bin/env node
/**
 * GSC / AEO pass: keep FAQ JSON-LD and visible <details> in sync, and add
 * answers for leftover Search Console queries (impressions, 0 CTR).
 *
 * Hidden FAQ schema (a Question in JSON-LD that is not on the page) is a
 * rich-result violation. Google will drop the FAQ snippet. This script is
 * idempotent: re-running it is a no-op once the page is in sync.
 *
 *   node scripts/seo/apply-gsc-aeo.mjs           # write
 *   node scripts/seo/apply-gsc-aeo.mjs --check   # fail on drift
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const CHECK = process.argv.includes('--check');
const TODAY = new Date().toISOString().slice(0, 10);

const SKIP_DIRS = new Set([
  'node_modules', '.git', '.github', 'scripts', 'docs', 'api', 'supabase',
  '_shared', 'emails', 'admin', 'outreach', '.vercel', '.thumbnail-sources',
]);

/** Extra Q/A keyed by repo-relative HTML path. Exact GSC phrasing where it helps. */
const EXTRA = {
  'index.html': [
    {
      q: 'Where can I buy ODORSTRIKE in India?',
      a: 'Only at https://smelloff.in/. One 50ml bottle is ₹229 prepaid UPI with free shipping across India, or ₹289 cash on delivery. It is not positioned as an Amazon or Flipkart listing.',
    },
    {
      q: 'Is ODORSTRIKE a fabric freshener for sofas, couches or rooms?',
      a: 'No. Clothes only. It is not a room spray and not for sofas, curtains, shoes, helmets, bags or pets. For couches and rooms, a home fabric freshener is the other category.',
    },
    {
      q: 'Are there cheap fabric refresher options in India that work as well as popular brands?',
      a: 'For clothes, yes: ODORSTRIKE is ₹229 prepaid. It is a fabric-only odor eliminator (HPβCD + Zinc PCA), not a perfume cover and not a sofa/room freshener like the large home brands. Compare on the clothes job, not the bottle size.',
    },
  ],
  'blog/gym-clothes-smell-after-washing.html': [
    {
      q: 'Why do workout clothes still smell after washing?',
      a: 'Workout clothes — dri-fit, gym tees, polyester tights — still smell after washing because the fibre holds skin oils a cold cycle does not dissolve. Softener coats the residue in. Strip-wash to reset; a fabric mist is for between wears on a clean shirt, not to dissolve old biofilm.',
    },
  ],
  'blog/best-fabric-odor-spray-india-2026-body-odor.html': [
    {
      q: 'What is the best and top rated fabric refresher spray for clothes and bedding in India?',
      a: 'For clothes, look for a named odor active (HPβCD, Zinc PCA) and a short dry time — ODORSTRIKE is ₹229 prepaid at smelloff.in. It is not for bedding, sofas, mattresses or rooms. Bedding and upholstery need a home-size fabric freshener; a 50ml clothes mist is the wrong tool.',
    },
    {
      q: 'What spray makes clothes smell good?',
      a: 'If the job is odor in a shirt, a fabric odor eliminator beats a perfume spray. Perfume covers for minutes; HPβCD and Zinc PCA trap and neutralise the molecule in the weave. ODORSTRIKE is the clothes job at ₹229, not a scent cloud.',
    },
  ],
  'blog/best-deodorant-spray-for-clothes-not-skin.html': [
    {
      q: 'What is a cloth deodorant?',
      a: 'A cloth deodorant is a spray made for fabric, not skin. Regular deodorant is for underarms. ODORSTRIKE is a fabric-only odor mist: clothes, not skin, not a perfume. ₹229 prepaid at smelloff.in.',
    },
    {
      q: 'Is there a spray for clothes not skin?',
      a: 'Yes. ODORSTRIKE is a 50ml fabric-only odor mist. Do not use skin deodorant on a shirt — it can stain and still miss odor in the weave. Spray the garment from 15–20 cm, let it dry about 10 seconds.',
    },
  ],
  'blog/deodorant-vs-fabric-mist.html': [
    {
      q: 'Can deodorant be used on clothes?',
      a: 'No. Deodorant is for skin. Spraying it on a shirt can stain fabric and still miss odor already in the weave. Use a fabric-only mist on clothing. ODORSTRIKE is the fabric job — clothes only, never skin.',
    },
  ],
  'blog/hpbcd-cyclodextrin-fabric-odor.html': [
    {
      q: 'What is a cyclodextrin spray?',
      a: 'A cyclodextrin spray uses ring-shaped sugar molecules to trap odor. ODORSTRIKE uses HPβCD (hydroxypropyl beta-cyclodextrin) in a water-based fabric mist, not as a skin deodorant. It is for clothes.',
    },
    {
      q: 'What is cyclodextrin in deodorant?',
      a: 'Some skin deodorants add cyclodextrin to bind odor on the body. That is a skin product. ODORSTRIKE uses HPβCD on fabric, not as a deodorant. Do not put it on skin.',
    },
  ],
  'blog/remove-cooking-smell-from-clothes.html': [
    {
      q: 'How to get curry smell out of clothes without washing?',
      a: 'Get the garment out of the kitchen, air it 20 minutes, then mist the front panel, forearms and shoulders with a water-based fabric odor mist. Oil splashes are stains and need a wash.',
    },
  ],
  'blog/fabric-deodorizer-spray-india-guide-2026.html': [
    {
      q: 'What is the best fabric refresher for couches and sofas that actually removes odors in India?',
      a: 'ODORSTRIKE is not that product. Couches, sofas, curtains and rooms are a home-fabric-freshener job. ODORSTRIKE is clothes only — shirts, tees, jackets, denim. Buy a large upholstery spray for furniture.',
    },
  ],
  'blog/why-clothes-smell-musty-after-being-stored.html': [
    {
      q: 'Why do clothes start to smell after being stored?',
      a: 'Closed, humid storage traps volatile compounds on dry fabric. Air them, dry fully, then mist residual odor. A fabric mist is a reset for leftover smell, not a substitute for drying damp clothes before they go in.',
    },
  ],
  'blog/why-clothes-smell-bad-after-drying.html': [
    {
      q: 'Why do clothes smell after drying?',
      a: 'Slow indoor drying lets bacteria keep working while the cloth is damp, and any odor that survived the wash concentrates as water leaves. Dry fully in moving air, skip softener, and mist residual odor on a dry garment. Rewash if it is actually dirty.',
    },
  ],
  'blog/why-polyester-holds-odor-longer-than-cotton.html': [
    {
      q: 'Does polyester hold odor longer than cotton?',
      a: 'Yes, typically. Polyester is oleophilic — it grips the skin lipids that odor bacteria feed on. Cotton absorbs water and releases residue more readily in a wash. That is why dri-fit and gym polyester smell again after a cold cycle.',
    },
  ],
  'blog/why-body-odor-comes-back-on-clothes-so-quickly.html': [
    {
      q: 'Why do Indian men sweat smell more on clothes?',
      a: 'Heat, humidity and rewear make odor in fabric easier to smell again, whoever is wearing the shirt. The odor is in the cloth, not a stereotype about skin. Wash when soiled, dry fully, and treat residual odor on clean fabric.',
    },
  ],
  'blog/odorstrike-vs-febreze-india.html': [
    {
      q: 'Is there a Febreze alternative in India for clothes?',
      a: 'For clothes, ODORSTRIKE is the Indian alternative: 50ml pocket mist, ₹229 prepaid, HPβCD + Zinc PCA, clothes only. Febreze-style products are home-size bottles for rooms, sofas and curtains.',
    },
  ],
  'blog/keep-clothes-fresh-while-travelling.html': [
    {
      q: 'How to keep clothes fresh in a suitcase?',
      a: 'Pack fully dry clothes, keep worn items in a separate bag, and mist residual odor on clean fabric before it goes back in. A damp shirt in a closed suitcase is what turns the whole bag.',
    },
  ],
  'blog/remove-mothball-almirah-smell-from-clothes.html': [
    {
      q: 'How to get naphthalene smell out of clothes?',
      a: 'Air the garment in moving air for several hours, then mist residual odor with a water-based fabric odor mist. Naphthalene (mothballs) lives in the fibre; a perfume cover will not last. Wash if the smell is heavy or the cloth is soiled.',
    },
  ],
  'blog/spray-to-remove-sweat-smell-from-clothes-quickly.html': [
    {
      q: 'What is a shirt odor spray?',
      a: 'A shirt odor spray is a fabric mist for clothing, not a skin deodorant. ODORSTRIKE is 50ml, pocket-sized, ₹229 prepaid. Mist collar, underarms and upper back from 15–20 cm; it air-dries in about 10 seconds. Fabric only.',
    },
  ],
  'blog/zinc-pca-fabric-odor-ingredient-guide.html': [
    {
      q: 'Is zinc ricinoleate the same as Zinc PCA on clothes?',
      a: 'No. Smelloff does not use zinc ricinoleate. Formula v3.1 uses Zinc PCA and Zinc Gluconate on fabric, with HPβCD. Older Smelloff URLs about zinc ricinoleate redirect here.',
    },
  ],
};

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') && entry.name !== '.') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(full, out);
    } else if (entry.name.endsWith('.html')) out.push(full);
  }
  return out;
}

function jsonLdScripts(html) {
  const re = /<script([^>]*type=["']application\/ld\+json["'][^>]*)>([\s\S]*?)<\/script>/gi;
  const out = [];
  let m;
  while ((m = re.exec(html))) {
    try {
      out.push({
        start: m.index,
        end: m.index + m[0].length,
        attrs: m[1],
        data: JSON.parse(m[2]),
      });
    } catch {
      /* leave broken scripts for check-structured-data */
    }
  }
  return out;
}

function asArray(node) {
  if (!node) return [];
  return Array.isArray(node) ? node : [node];
}

function findFaqPage(data) {
  for (const n of asArray(data)) {
    if (n && n['@type'] === 'FAQPage') return n;
    if (n && Array.isArray(n['@graph'])) {
      const hit = n['@graph'].find((x) => x && x['@type'] === 'FAQPage');
      if (hit) return hit;
    }
  }
  return null;
}

function visibleSummaries(html) {
  return [...html.matchAll(/<summary>([\s\S]*?)<\/summary>/gi)].map((m) =>
    m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(),
  );
}

function hasQuestion(list, q) {
  const key = q.toLowerCase().replace(/\s+/g, ' ').trim();
  return list.some((x) => x.toLowerCase().replace(/\s+/g, ' ').trim() === key);
}

function detailsHtml(q, a, homepage) {
  if (homepage) {
    return `<details>\n        <summary>${q}</summary>\n        <p class="so-faq__a">${a}</p>\n      </details>`;
  }
  return `<details>\n      <summary>${q}</summary>\n      <div class="faq-a"><p>${a}</p></div>\n    </details>`;
}

function insertVisible(html, q, a, rel) {
  if (!looksLikeQuestion(q, a)) return html;
  if (hasQuestion(visibleSummaries(html), q)) return html;
  const block = detailsHtml(q, a, rel === 'index.html');
  const soFaq = html.search(/<div class="so-faq">/);
  if (soFaq !== -1) {
    const close = html.indexOf('</div>', soFaq);
    if (close !== -1) return html.slice(0, close) + block + '\n    ' + html.slice(close);
  }
  const openRe = /<section class="faq"[^>]*>/i;
  const open = openRe.exec(html);
  if (open) {
    const walk = /<(\/?)section\b[^>]*>/gi;
    walk.lastIndex = open.index;
    let depth = 0;
    let end = -1;
    let w;
    while ((w = walk.exec(html))) {
      depth += w[1] === '/' ? -1 : 1;
      if (depth === 0) {
        end = w.index;
        break;
      }
    }
    if (end !== -1) return html.slice(0, end) + block + '\n  ' + html.slice(end);
  }
  return html;
}

function bumpDates(html) {
  let out = html.replace(/"dateModified"\s*:\s*"20\d{2}-\d{2}-\d{2}"/g, `"dateModified":"${TODAY}"`);
  if (/property=["']article:modified_time["']/.test(out)) {
    out = out.replace(
      /(<meta[^>]+property=["']article:modified_time["'][^>]+content=["'])[^"']*(["'])/i,
      `$1${TODAY}$2`,
    );
  } else if (/property=["']article:published_time["']/.test(out)) {
    out = out.replace(
      /(<meta[^>]+property=["']article:published_time["'][^>]*>)/i,
      `$1\n<meta property="article:modified_time" content="${TODAY}">`,
    );
  }
  return out;
}

function upsertFaqJsonLd(html, questions) {
  const scripts = jsonLdScripts(html);
  const faqScript = [...scripts].reverse().find((s) => findFaqPage(s.data));
  const entity = questions.map(({ q, a }) => ({
    '@type': 'Question',
    name: q,
    acceptedAnswer: { '@type': 'Answer', text: a },
  }));
  const payload = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: entity,
  });
  const tag = `<script type="application/ld+json">\n${payload}\n</script>`;
  if (faqScript) {
    return html.slice(0, faqScript.start) + tag + html.slice(faqScript.end);
  }
  return html.replace(/<\/head>/i, `${tag}\n</head>`);
}

function looksLikeQuestion(q, a) {
  const name = String(q || '').replace(/\s+/g, ' ').trim();
  const ans = String(a || '').replace(/\s+/g, ' ').trim();
  if (name.length < 12 || name.length > 140) return false;
  if (ans.length < 24 || ans.length > 900) return false;
  if (/full formula|ingredient notes|one bottle\. two combos/i.test(name)) return false;
  return /[?]/.test(name) || /^(can|what|why|how|is|are|does|do|will|where|when|which|should)\b/i.test(name);
}

function faqSlice(html) {
  const open = html.search(/<(?:div class="so-faq"|section class="faq")\b/i);
  if (open === -1) return '';
  return html.slice(open, open + 20000);
}

function collectFaqPairs(html, rel) {
  const pairs = [];
  const seen = new Set();
  const add = (q, a) => {
    const name = String(q || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    const ans = String(a || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    const key = name.toLowerCase();
    if (!looksLikeQuestion(name, ans) || seen.has(key)) return;
    seen.add(key);
    pairs.push({ q: name, a: ans });
  };

  for (const s of jsonLdScripts(html)) {
    const faq = findFaqPage(s.data);
    if (!faq) continue;
    for (const item of asArray(faq.mainEntity)) {
      const q = (item && item.name) || '';
      const a = (item && item.acceptedAnswer && item.acceptedAnswer.text) || '';
      if (q && a) add(q, a);
    }
  }

  for (const extra of EXTRA[rel] || []) add(extra.q, extra.a);

  const visRe = /<summary>([\s\S]*?)<\/summary>\s*(?:<div class="faq-a"><p>([\s\S]*?)<\/p><\/div>|<p class="so-faq__a">([\s\S]*?)<\/p>)/gi;
  const slice = faqSlice(html) || html;
  let m;
  while ((m = visRe.exec(slice))) {
    add(m[1], m[2] || m[3] || '');
  }
  return pairs;
}

function processFile(file) {
  const rel = path.relative(REPO, file).split(path.sep).join('/');
  if (rel === '404.html' || rel === 'shop.html' || rel === 'odorstrike.html' || rel === 'payment-failed.html') {
    return false;
  }
  let html = fs.readFileSync(file, 'utf8');
  const before = html;

  const pairs = collectFaqPairs(html, rel);
  const extras = EXTRA[rel] || [];
  const hasFaqSurface = /class="faq"|class="so-faq"|FAQPage/.test(html) || extras.length > 0;
  if (!hasFaqSurface && pairs.length === 0) return false;

  if (pairs.length) {
    for (const { q, a } of pairs) html = insertVisible(html, q, a, rel);
    html = upsertFaqJsonLd(html, collectFaqPairs(html, rel));
  }

  if (html !== before) {
    html = bumpDates(html);
    if (CHECK) return true;
    fs.writeFileSync(file, html);
    return true;
  }
  return false;
}

const files = walk(REPO);
const changed = files.filter(processFile);
if (CHECK && changed.length) {
  console.error(`GSC/AEO FAQ drift in ${changed.length} file(s):\n- ${changed.map((f) => path.relative(REPO, f)).join('\n- ')}`);
  process.exit(1);
}
console.log(`GSC/AEO FAQ: ${CHECK ? 'clean' : `updated ${changed.length} page(s)`}`);
