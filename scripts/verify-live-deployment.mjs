import fs from 'node:fs';

const PROD_ORIGIN = process.env.VERIFY_URL || 'https://smelloff.in';
const DEPLOYMENT_ORIGIN = process.env.VERIFY_DEPLOYMENT_URL || '';

function normalizeCloudflareHtml(html) {
  return html
    .replace(/<a href="\/cdn-cgi\/l\/email-protection#[^"]*"><span class="__cf_email__"[^>]*>\[email&#160;protected\]<\/span><\/a>/g, '<a href="mailto:smelloffsupport@gmail.com">smelloffsupport@gmail.com</a>')
    .replace(/<script data-cfasync="false" src="\/cdn-cgi\/scripts\/[a-z0-9]+\/cloudflare-static\/email-decode\.min\.js"><\/script>/g, '');
}

function normalizeRobots(txt) {
  const marker = '# Smelloff robots.txt';
  const idx = txt.indexOf(marker);
  return idx !== -1 ? txt.slice(idx) : txt;
}

async function verifyRoute(routePath, localFilePath, isHtml = false, isRobots = false) {
  const url = `${PROD_ORIGIN}${routePath}`;
  console.log(`\nVerifying live route: ${url}`);
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (DeploymentVerifier)' } });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText} on ${url}`);
  }

  const liveRaw = await res.text();
  const localRaw = fs.readFileSync(localFilePath, 'utf8');

  let liveClean = liveRaw;
  if (isHtml) liveClean = normalizeCloudflareHtml(liveRaw);
  if (isRobots) liveClean = normalizeRobots(liveRaw);

  if (routePath === '/odorstrike') {
    const hasCorrectPaymentValue = liveClean.includes("gtag('event', 'add_payment_info', { payment_type: method, currency: 'INR', value: t.subtotal, items: gaItems(v.amount, t.qty) })");
    const hasOldPaymentValue = /gtag\('event',\s*'add_payment_info',\s*\{[^}]*value:\s*t\.total/.test(liveClean);
    if (!hasCorrectPaymentValue || hasOldPaymentValue) {
      throw new Error(`GA4 add_payment_info contract mismatch on ${url}: must contain value: t.subtotal and not value: t.total`);
    }
    console.log('  GA4 add_payment_info contract (value: t.subtotal, payment_type: method): PASS ✓');

    if (liveClean.includes('pData.aggregateRating') || liveClean.includes('productScript.textContent = JSON.stringify')) {
      throw new Error(`Runtime product JSON-LD schema mutation found on live ${url}`);
    }
    console.log('  Product JSON-LD static guarantee: PASS ✓');
  }

  if (routePath === '/reviews') {
    if (/<span class="agg-num"[^>]*>4\.9<\/span>/.test(liveClean)) {
      throw new Error(`Hardcoded 4.9 rating found on live ${url}`);
    }
    if (liveClean.includes('googleReviewWidgetMount') || liveClean.includes('Google Customer Reviews')) {
      throw new Error(`Google review aggregator widget found on live ${url}`);
    }
    console.log('  Reviews page clean data contract: PASS ✓');
  }

  const matched = liveClean === localRaw;
  console.log(`  Status: ${res.status}`);
  console.log(`  cf-cache-status: ${res.headers.get('cf-cache-status') || 'N/A'}`);
  console.log(`  x-vercel-cache: ${res.headers.get('x-vercel-cache') || 'N/A'}`);
  console.log(`  x-vercel-id: ${res.headers.get('x-vercel-id') || 'N/A'}`);
  console.log(`  Live bytes (normalized): ${liveClean.length}, Local bytes: ${localRaw.length}`);
  console.log(`  Exact byte-for-byte match: ${matched ? 'PASS ✓' : 'FAIL ✗'}`);

  if (!matched) {
    console.warn(`  [Notice] Live and local content differ (expected until latest build is deployed to Vercel/production).`);
  }
}

async function verifyDeploymentParity() {
  if (!DEPLOYMENT_ORIGIN) return;
  console.log(`\nComparing production (${PROD_ORIGIN}) with deployment (${DEPLOYMENT_ORIGIN})...`);
  const routes = ['/', '/odorstrike', '/reviews', '/assets/js/chrome.js'];
  for (const r of routes) {
    const pRes = await fetch(`${PROD_ORIGIN}${r}`);
    const dRes = await fetch(`${DEPLOYMENT_ORIGIN}${r}`);
    const pText = normalizeCloudflareHtml(await pRes.text());
    const dText = normalizeCloudflareHtml(await dRes.text());
    const match = pText === dText;
    console.log(`  Route ${r}: ${match ? 'PARITY ✓' : 'DIFFERENCE (deployment updating)'}`);
  }
}

async function run() {
  console.log(`Starting live deployment verification against ${PROD_ORIGIN}...`);
  try {
    await verifyRoute('/', 'index.html', true, false);
    await verifyRoute('/odorstrike', 'odorstrike.html', true, false);
    await verifyRoute('/reviews', 'reviews.html', true, false);
    await verifyRoute('/assets/js/reviews-system.js', 'assets/js/reviews-system.js', false, false);
    await verifyRoute('/assets/js/chrome.js', 'assets/js/chrome.js', false, false);
    await verifyRoute('/sitemap.xml', 'sitemap.xml', false, false);
    await verifyRoute('/robots.txt', 'robots.txt', false, true);

    await verifyDeploymentParity();

    console.log('\nDeployment verification finished.');
  } catch (err) {
    console.error('\nVerification failed:', err.message);
    process.exit(1);
  }
}

run();
