import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const money = ['index.html', 'odorstrike.html'];

// Owner's call (2026-10-11): the photo slots stay visible as briefs until the
// photography lands (reverses the earlier "hide them" fix). Swap each .ph-img
// div for an <img class="ph-photo"> of the stated ratio.
test('photo placeholder slots are visible on the homepage and PDP', () => {
  for (const f of money) {
    const html = fs.readFileSync(f, 'utf8');
    assert.doesNotMatch(html, /\.ph-img\{display:none/, `${f}: .ph-img slots must render`);
    // A slot is either still a brief (.ph-img) or filled with its photo (.ph-photo).
    const slots = (html.match(/class="[^"]*\bph-(img|photo)\b/g) || []).length;
    assert.ok(slots >= 4, `${f}: image slots missing`);
  }
  // The placeholder combo cards ("Combo name", "₹ —") were removed on 2026-10-15; the offer box sells the real pair.
  assert.doesNotMatch(fs.readFileSync('index.html', 'utf8'), /id="combos"|data-ph="Combo name"/);
  assert.doesNotMatch(fs.readFileSync('odorstrike.html', 'utf8'), /<section class="pd-sec" id="size"[^>]*\shidden>/);
});

// Brand palette (owner, 2026-10-11): Carbon Black, Ice White, Signal Lime.
test('tokens use the brand palette and buttons are Signal Lime', () => {
  for (const f of ['assets/css/tokens.css', 'index.html', 'odorstrike.html']) {
    const src = fs.readFileSync(f, 'utf8');
    for (const t of ['--ink:#0A0A0A;', '--text:#F2F5EF;', '--acid:#B8FF57;', '--cta:#B8FF57;']) {
      assert.ok(src.includes(t), `${f}: missing ${t}`);
    }
  }
});

// Calm layout (2026-10-11): no full-width acid bands; lime is the accent.
test('no acid bands', () => {
  const idx = fs.readFileSync('index.html', 'utf8');
  for (const sel of ['.final{', '.ticker{']) {
    const rule = idx.slice(idx.indexOf('  ' + sel), idx.indexOf('}', idx.indexOf('  ' + sel)));
    assert.doesNotMatch(rule, /background:var\(--acid\)/, `index.html ${sel} is acid again`);
  }
  assert.match(fs.readFileSync('assets/css/chrome.css', 'utf8'), /\.sf-announce\{background:var\(--surface\)/);
  assert.doesNotMatch(fs.readFileSync('assets/css/chrome.css', 'utf8') + fs.readFileSync('assets/css/soft.css', 'utf8'), /font-weight:900/);
});

test('blog and checkout follow the quiet layer too', () => {
  const blog = fs.readFileSync('assets/css/blog.css', 'utf8');
  for (const sel of ['.article-category', '.end-cta .buy-btn']) {
    const at = blog.indexOf(sel + ' {') >= 0 ? blog.indexOf(sel + ' {') : blog.indexOf(sel + '{');
    assert.ok(at >= 0, `blog.css lost ${sel}`);
    assert.doesNotMatch(blog.slice(at, blog.indexOf('}', at)), /background: ?var\(--acid\)/, `blog.css ${sel} is acid again`);
  }
  const chrome = fs.readFileSync('assets/js/chrome.js', 'utf8');
  assert.ok(!/'PAY ₹|'PLACE COD ORDER/.test(chrome), 'checkout button labels are sentence case');
});

// config/product.json claims.prohibited, enforced on the visible copy of the two money pages.
test('money pages carry no prohibited product claims', () => {
  const banned = /no white marks|no marks\b|anti-regrowth|anti regrowth|zero residue|residue-free/i;
  for (const f of money) {
    const visible = fs.readFileSync(f, 'utf8').replace(/<!--[\s\S]*?-->/g, '').replace(/<script[\s\S]*?<\/script>/g, '');
    const hit = visible.match(new RegExp(`.{0,40}(${banned.source}).{0,40}`, 'i'));
    assert.equal(hit, null, `${f}: ${hit && hit[0]}`);
  }
});

// The bar covered ~200px of an 844px phone screen with two stacked buttons.
test('consent bar puts Accept and Reject side by side on phones, equal weight', () => {
  for (const f of ['index.html', 'odorstrike.html', 'assets/css/chrome.css', 'assets/js/consent-analytics.js']) {
    const src = fs.readFileSync(f, 'utf8');
    assert.ok(src.includes('#smelloff-consent-bar .cb-actions button{flex:1 1 130px'), `${f}: buttons must share one row`);
    assert.ok(!src.includes('#smelloff-consent-bar .cb-actions button{flex:1 1 100%}'), `${f}: stacked buttons are back`);
  }
});

test('delivery estimate counts the 48-hour dispatch window into the late date', () => {
  const html = fs.readFileSync('odorstrike.html', 'utf8');
  assert.match(html, /var hi = addBusinessDays\(now, hiCount \+ DISPATCH_DAYS\);/);
});

// Owner's call (2026-10-11): show three key ingredients and count the rest.
test('the full ingredient list is not published — three actives plus a count', () => {
  const supporting = /polysorbate|PE9010|ethylhexylglycerin|citric acid/i;
  for (const f of ['odorstrike.html', 'index.html', 'blog/odorstrike-ingredients.html', 'llms.txt', 'llms-full.txt', 'products.json', 'merchant-feed.xml']) {
    assert.doesNotMatch(fs.readFileSync(f, 'utf8'), supporting, `${f} names a supporting ingredient`);
  }
  assert.match(fs.readFileSync('odorstrike.html', 'utf8'), /HPβCD · Zinc PCA · Triethyl Citrate <span class="pd-inci-more">\+ 8 more<\/span>/);
});

// Photos dropped into the slots: every one exists, carries real alt text and
// lazy-loads (they're all below the fold).
test('slot photos exist and have alt text', () => {
  for (const f of money) {
    const html = fs.readFileSync(f, 'utf8');
    const imgs = html.match(/<img class="[^"]*\bph-photo\b[^>]*>/g) || [];
    assert.ok(imgs.length >= 4, `${f}: expected filled photo slots`);
    for (const tag of imgs) {
      const src = tag.match(/ src="\/([^"]+)"/)[1];
      assert.ok(fs.existsSync(src), `${f}: ${src} missing`);
      for (const s of (tag.match(/srcset="([^"]+)"/)?.[1] || '').split(',').filter(Boolean)) {
        const p = s.trim().split(' ')[0].slice(1);
        assert.ok(fs.existsSync(p), `${f}: ${p} missing`);
      }
      assert.match(tag, /alt="[^"]{20,}"/, `${f}: ${src} needs descriptive alt`);
      assert.match(tag, /loading="lazy"/);
    }
  }
});

// Photos load per network: AVIF first with a WebP fallback, several widths,
// the skeleton shimmer while they load (soft.css §10; owner, 2026-10-12: no
// blurry previews), and a head script that drops to the smallest
// file on Data Saver / 2G before any lazy image picks one.
test('slot photos are responsive, AVIF-first and network-aware', () => {
  for (const f of money) {
    const html = fs.readFileSync(f, 'utf8');
    const pics = html.match(/<picture class="ph-pic"><source[\s\S]*?<\/picture>/g) || [];
    assert.ok(pics.length >= 4, `${f}: expected <picture class="ph-pic"> photos`);
    for (const p of pics) {
      const avif = p.match(/<source type="image\/avif" srcset="([^"]+)" sizes="[^"]+">/);
      assert.ok(avif, `${f}: photo missing its AVIF source`);
      const files = avif[1].split(',').map(s => s.trim().split(' ')[0].slice(1));
      assert.ok(files.length >= 2, `${f}: AVIF needs more than one width`);
      for (const file of files) assert.ok(fs.existsSync(file), `${f}: ${file} missing`);
      assert.match(p, /\d+w, \/assets\/[^"]+\.webp \d+w/, `${f}: WebP fallback needs several widths`);
      assert.doesNotMatch(p, /data-no-skel|data:image/, `${f}: photos show the skeleton while loading, never a blurred preview`);
    }
    const head = html.slice(0, html.indexOf('</head>'));
    assert.match(head, /navigator\.connection/, `${f}: network-aware sizes script must sit in <head>`);
    assert.match(head, /saveData\|\|\/2g\//);
  }
});

// Homepage hero v4 (2026-10-11): photo first — the product in use, one static
// image, one buy button. The photo is the LCP image, so it must never be lazy,
// and the head preload must ask for the same sizes the <picture> will.
test('homepage hero is a fast, static, product-in-use photo', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  const hero = html.slice(html.indexOf('<section class="hero"'), html.indexOf('</section>', html.indexOf('<section class="hero"')));
  const img = hero.match(/<img [^>]*hero-spray-collar[^>]*>/);
  assert.ok(img, 'hero photo missing');
  assert.match(img[0], /fetchpriority="high"/);
  assert.doesNotMatch(img[0], /loading="lazy"/, 'the LCP image must load eagerly');
  assert.match(img[0], /alt="[^"]*fabric, not the skin"/, 'alt must say what the photo shows');
  assert.doesNotMatch(img[0], /data-no-skel|data:image/, 'the hero shows the skeleton while loading, not a blurred preview');
  assert.match(hero, /<source type="image\/avif" srcset="[^"]+"/);
  const picSizes = hero.match(/<source type="image\/avif" srcset="[^"]+" sizes="([^"]+)"/)[1];
  const preload = html.match(/<link rel="preload" as="image" type="image\/avif" fetchpriority="high"\s+imagesrcset="[^"]+"\s+imagesizes="([^"]+)">/);
  assert.ok(preload, 'hero AVIF preload missing');
  assert.equal(preload[1], picSizes, 'preload imagesizes must match the <picture> sizes, or the photo downloads twice');
  for (const f of hero.match(/\/assets\/photos\/hero-spray-collar[^ "]*\.(avif|webp)/g)) assert.ok(fs.existsSync(f.slice(1)), `${f} missing`);
  assert.ok(!/carousel|swiper|slick/i.test(hero), 'one static hero image, not a carousel');
  assert.equal((hero.match(/class="hm-btn"/g) || []).length, 1, 'one primary action in the hero');
});

// Sharp images (2026-10-12, owner): no cut-out bottles and no cropping. The
// old 241px cutout looked blurry; the owner then asked for real photos shown
// whole instead of cutouts. Offer boxes, cart and blog cards use the in-hand
// photo on black with `contain`.
test('no page uses a bottle cutout; the in-hand photo is shown whole', () => {
  const pages = ['index.html', 'odorstrike.html', 'blog/index.html',
    ...fs.readdirSync('blog').filter((f) => f.endsWith('.html')).map((f) => `blog/${f}`)];
  for (const f of pages) {
    assert.doesNotMatch(fs.readFileSync(f, 'utf8'), /odorstrike-bottle-(cutout|studio)/, `${f}: use the in-hand photo, not a cutout`);
  }
  assert.doesNotMatch(fs.readFileSync('scripts/blog/apply-reader.mjs', 'utf8'), /odorstrike-bottle-(cutout|studio)/);
  const home = fs.readFileSync('index.html', 'utf8');
  const pdp = fs.readFileSync('odorstrike.html', 'utf8');
  assert.match(home, /\.offer-art \.offer-photo\{[^}]*object-fit:contain/, 'homepage offer photo must not be cropped');
  assert.match(pdp, /\.pd-offer-art \.pd-offer-photo\{[^}]*object-fit:contain/, 'PDP offer photo must not be cropped');
  for (const html of [home, pdp]) assert.match(html, /offer-in-hand-black@960\.webp/, 'offer box photo missing');
});

// Competitor research (2026-10-15, docs/audits/competitor-conversion-2026-10.md).
test('PDP delivery check: pincode → same window as checkout, no COD amount, text only', () => {
  const pdp = fs.readFileSync('odorstrike.html', 'utf8');
  const form = pdp.slice(pdp.indexOf('<form class="pd-pin"'), pdp.indexOf('</form>', pdp.indexOf('<form class="pd-pin"')));
  assert.match(form, /<label for="pdPin">/, 'pincode field needs a visible label');
  assert.match(form, /inputmode="numeric"/);
  assert.doesNotMatch(form, /₹/, 'outside checkout the site names COD, not its amount');
  // It sits below the buy buttons, so the phone fold measurements don't move.
  assert.ok(pdp.indexOf('id="pdPinForm"') > pdp.indexOf('id="pdpCartBtn"'));
  const js = pdp.slice(pdp.indexOf('// PDP DELIVERY CHECK'), pdp.indexOf('// PAYMENT FAILED POLICY OVERLAY'));
  assert.match(js, /window\.calculateDeliveryEstimate/, 'must reuse the checkout estimate');
  assert.doesNotMatch(js, /innerHTML/, 'API text goes through textContent');
  assert.match(js, /getElementById\('f_pin'\)/, 'a checked pincode carries into checkout');
});

test('PDP compare table names clothes perfume sprays, modestly', () => {
  const pdp = fs.readFileSync('odorstrike.html', 'utf8');
  const table = pdp.slice(pdp.indexOf('<table class="pd-compare">'), pdp.indexOf('</table>', pdp.indexOf('<table class="pd-compare">')));
  assert.match(table, /<th scope="col">Clothes perfume spray<\/th>/);
  for (const row of table.match(/<tr>.*?<\/tr>/g)) assert.equal((row.match(/<t[hd]\b/g) || []).length, 5, row);
});

// Full-site audit (2026-10-15). partners.smelloff.in has no DNS record
// (NXDOMAIN), so the footer's "Partners" link was dead on 74 pages.
test('the footer links nowhere that does not resolve', () => {
  const gen = fs.readFileSync('scripts/apply-chrome.mjs', 'utf8');
  assert.doesNotMatch(gen, /href="https:\/\/partners\.smelloff\.in"/);
});

// Pages other than / and /odorstrike take their layout from chrome.css §12.
// Loaded async they painted unstyled and jumped (blog index CLS 0.19 on 4G).
test('shared CSS blocks paint on every page except the two self-contained ones', () => {
  for (const f of ['faq.html', 'about.html', 'privacy.html', 'blog/index.html', 'blog/how-to-use-odorstrike.html']) {
    const html = fs.readFileSync(f, 'utf8');
    assert.match(html, /<link rel="stylesheet" href="\/assets\/css\/chrome\.css\?v=/, `${f}: chrome.css must block`);
    assert.match(html, /<link rel="stylesheet" href="\/assets\/fonts\.css\?v=/, `${f}: fonts.css must block`);
  }
  // A heading width in `ch` changes with the font, so it rewraps when the web font lands.
  assert.doesNotMatch(fs.readFileSync('blog/index.html', 'utf8'), /\.b-hero h1\{[^}]*max-width:\d+ch/);
});

test('headings fall back to a real bold face sized for Space Grotesk 700', () => {
  for (const f of ['assets/fonts.css', 'index.html']) {
    assert.match(fs.readFileSync(f, 'utf8'), /font-family:'Space Grotesk Fallback';font-weight:600 900;src:local\('Arial Bold'\)[^}]*size-adjust:100\.3%/, f);
  }
});

// Quantity used to be fixed once checkout opened. The pair price is offered
// as a button the buyer presses, never pre-applied.
test('checkout lets the buyer change quantity and opt into the pair', () => {
  const pdp = fs.readFileSync('odorstrike.html', 'utf8');
  const overlay = pdp.slice(pdp.indexOf('id="checkoutOverlay"'), pdp.indexOf('<!-- 1 · CONTACT -->'));
  for (const id of ['ckDecBtn', 'ckQtyVal', 'ckIncBtn', 'ckPairBtn']) assert.ok(overlay.includes(`id="${id}"`), id);
  assert.match(pdp, /function ckStepQty\(delta\)[\s\S]*?setCartQty\(q\);[\s\S]*?renderCheckoutPrices\(\);/);
  assert.match(pdp, /pairBtn\.hidden = !up;/);
  assert.match(pdp, /function ckUpsellTarget\(q\) \{ return q === 1 \? 2 : \(q === 3 \|\| q === 4\) \? 5 : 0; \}/);
  // Pack cards on the PDP set the quantity; none is pre-selected beyond one.
  const cards = [...pdp.matchAll(/class="pd-pk[^"]*" data-qty="(\d+)"[^>]*aria-pressed="(true|false)"/g)];
  assert.deepEqual(cards.map((m) => m[1]), ['1', '2', '5', '1', '2', '5']);
  assert.deepEqual(cards.filter((m) => m[2] === 'true').map((m) => m[1]), ['1', '1']);
});

// Checkout states the offer itself: pack cards (1 / 2 / 5) with per-bottle
// prices, MRP and discount rows, and what every order includes. One bottle
// stays checked by default; the cards' prices come from CFG.PRICES.
test('checkout shows the pack offer, the saving and what is included', () => {
  const pdp = fs.readFileSync('odorstrike.html', 'utf8');
  const overlay = pdp.slice(pdp.indexOf('id="checkoutOverlay"'), pdp.indexOf('<!-- 1 · CONTACT -->'));
  const cards = [...overlay.matchAll(/class="ck-pk" data-qty="(\d+)" role="radio" aria-checked="(true|false)"/g)];
  assert.deepEqual(cards.map((m) => m[1]), ['1', '2', '5']);
  assert.deepEqual(cards.filter((m) => m[2] === 'true').map((m) => m[1]), ['1']);
  for (const id of ['checkoutMrp', 'ckMrpTotal', 'ckDiscount', 'ckSaved']) assert.ok(overlay.includes(`id="${id}"`), id);
  assert.match(pdp, /var mrp = \(\(CFG && CFG\.MRP && Number\(CFG\.MRP\.solo\)\) \|\| t\.unit\) \* t\.qty;/);
  const perks = overlay.slice(overlay.indexOf('class="ck-perks"'));
  for (const w of ['Free shipping', '7-day returns', 'Cash on Delivery']) assert.ok(perks.includes(w), w);
  // The COD amount stays on the COD option, never in the perks.
  assert.doesNotMatch(perks.slice(0, perks.indexOf('</ul>')), /₹/);
});
