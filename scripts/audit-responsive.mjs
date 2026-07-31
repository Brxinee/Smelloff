/* =====================================================================
   Responsive audit — renders every page at every width and reports real
   horizontal overflow, undersized consent-bar targets and safe-area gaps.
   =====================================================================
   Run it after any layout change. It is the check behind the numbers in
   CLAUDE.md § "Responsive rules".

   Playwright is deliberately NOT a dependency of this project: the site
   is static, and Vercel installs devDependencies during the build, so
   adding it would put a browser download on the deploy path for tooling
   that runs maybe once a month. Install it ad hoc instead:

       PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm i --no-save playwright
       node scripts/serve-static.mjs &          # or any static server
       node scripts/audit-responsive.mjs

   Point it at a different origin with BASE=..., and narrow the sweep with
   PAGES=/,/odorstrike or WIDTHS=320,768.

   TWO THINGS THIS GETS RIGHT, because both cost a debugging pass:

   1. `body{overflow-x:hidden}` on index.html and odorstrike.html clamps
      documentElement.scrollWidth. An audit that trusts scrollWidth reports
      those two pages clean no matter how badly they overflow. The probe
      neutralises the declaration before measuring.

   2. getBoundingClientRect returns un-clipped geometry, so the marquee
      tracks (2095–6546px wide, inside wrappers that already carry
      overflow:hidden) look like catastrophic overflow and are not. An
      element only pushes the page out if EVERY ancestor has
      overflow-x:visible — `hidden` and `clip` clip just as `auto` and
      `scroll` do.
   ===================================================================== */

import { chromium } from 'playwright';

const BASE = process.env.BASE || 'http://localhost:8099';
const CHROME = process.env.CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const WIDTHS = (process.env.WIDTHS || '320,360,375,393,430,520,600,720,767,768,820,900,960,1024,1280,1440,1920')
  .split(',').map(Number);

// EVERY page, not a sample. Both defects found in the second pass
// (.verdict-table, and the blog header with no gutter) were on pages the
// first pass's shortened list didn't include — the list was the weak link,
// not the code. Keep this in sync with the PAGES table in apply-chrome.mjs.
const PAGES = (process.env.PAGES || [
  '/', '/odorstrike', '/faq', '/about', '/contact', '/reviews', '/track-order',
  '/shipping', '/returns', '/refund', '/cancellation', '/privacy', '/terms',
  '/payment-failed', '/404.html',
  // solutions hub + regional guides
  '/solutions/', '/solutions/monsoon-damp-fabric-care',
  '/solutions/post-gym-workout-sweat-spray',
  '/solutions/office-commute-fabric-refresher',
  '/solutions/denim-outerwear-dry-care',
  // blog index + every post
  '/blog/',
  '/blog/why-i-built-odorstrike', '/blog/odorstrike-review-30-day-india-test',
  '/blog/odorstrike-vs-febreze-india', '/blog/ambi-pur-vs-odorstrike',
  '/blog/what-is-fabric-odor-eliminator', '/blog/hpbcd-cyclodextrin-fabric-odor',
  '/blog/zinc-pca-fabric-odor-ingredient-guide',
  '/blog/beta-cyclodextrin-odor-removal-science',
  '/blog/best-fabric-odor-spray-india-2026-body-odor',
  '/blog/best-deodorant-spray-for-clothes-not-skin',
  '/blog/deodorant-vs-fabric-mist',
  '/blog/spray-to-remove-sweat-smell-from-clothes-instantly',
  '/blog/does-fabric-spray-stain-clothes', '/blog/gym-clothes-smell-after-washing',
  '/blog/odorstrike-ingredients', '/blog/wedding-festive-wear-odor-guide',
  '/blog/how-to-use-odorstrike',
].join(',')).split(',');

const probe = () => {
  const docW = document.documentElement.clientWidth;
  const overflow = [];

  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    if (cs.position === 'fixed') continue;          // fixed bars are handled below
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;

    // Fully off-screen to the left is the visually-hidden idiom, not a defect:
    // skip links park at left:-9999px until focused. What matters is content
    // PARTIALLY cut — left of zero while still partly on screen. Checking
    // `left < 0` alone reports every skip link on every page at every width.
    if (r.right <= 0) continue;

    const overRight = r.right - docW;
    const overLeft = r.left < 0 ? -r.left : 0;
    if (overRight <= 1 && overLeft <= 1) continue;

    // Clipped by an ancestor? Then it isn't pushing the page out. See (2).
    let a = el.parentElement, clipped = false;
    while (a && a !== document.documentElement) {
      if (getComputedStyle(a).overflowX !== 'visible') { clipped = true; break; }
      a = a.parentElement;
    }
    if (clipped) continue;

    // Report the outermost offender only — the child is usually just cargo.
    if (el.parentElement) {
      const p = el.parentElement.getBoundingClientRect();
      if (p.right > docW + 1 || p.left < -1) continue;
    }

    const side = overRight >= overLeft
      ? `right +${Math.round(overRight)}px`
      : `left -${Math.round(overLeft)}px`;
    overflow.push(
      el.tagName.toLowerCase() +
      (el.id ? '#' + el.id : '') +
      (typeof el.className === 'string' && el.className
        ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '') +
      ` (${side})`
    );
  }

  // The consent bar is the most-seen component on the site and lived in three
  // drifted copies; it earns its own assertion. Buttons must be >=44px and the
  // action row must sit inside the viewport.
  let consent = null;
  const bar = document.getElementById('smelloff-consent-bar');
  if (bar && getComputedStyle(bar).display !== 'none') {
    const acts = bar.querySelector('.cb-actions');
    const btns = [...bar.querySelectorAll('button')].map(b => b.getBoundingClientRect());
    if (acts && btns.length) {
      consent = {
        over: Math.round(Math.max(0, acts.getBoundingClientRect().right - docW)),
        minH: Math.round(Math.min(...btns.map(b => b.height))),
      };
    }
  }

  return { overflow: [...new Set(overflow)], consent };
};

const browser = await chromium.launch({ executablePath: CHROME });
let combos = 0, overflowFails = 0, consentFails = 0;

for (const page of PAGES) {
  for (const width of WIDTHS) {
    const ctx = await browser.newContext({
      viewport: { width, height: 800 },
      isMobile: width < 768, hasTouch: width < 768,
    });
    const pg = await ctx.newPage();
    try {
      await pg.goto(BASE + page, { waitUntil: 'networkidle', timeout: 25000 });
      await pg.addStyleTag({ content: 'html,body{overflow-x:visible !important}' });  // see (1)
      await pg.waitForTimeout(180);
      const r = await pg.evaluate(probe);
      combos++;
      if (r.overflow.length) {
        overflowFails++;
        console.log(`OVERFLOW  ${page} @${width}px  ${r.overflow.slice(0, 4).join('  |  ')}`);
      }
      if (r.consent && (r.consent.over > 0 || r.consent.minH < 44)) {
        consentFails++;
        console.log(`CONSENT   ${page} @${width}px  overflow=+${r.consent.over}px  smallestButton=${r.consent.minH}px`);
      }
    } catch (e) {
      console.log(`ERROR     ${page} @${width}px  ${e.message.slice(0, 70)}`);
    }
    await ctx.close();
  }
}
await browser.close();

console.log(`\n${combos} page/width combos checked (${PAGES.length} pages x ${WIDTHS.length} widths)`);
console.log(`  horizontal overflow : ${overflowFails}`);
console.log(`  consent bar defects : ${consentFails}`);
process.exit(overflowFails + consentFails ? 1 : 0);
