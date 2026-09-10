import fs from 'node:fs';

const PROD_ORIGIN = process.env.VERIFY_URL || 'https://smelloff.in';

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

  const matched = liveClean === localRaw;
  console.log(`  Status: ${res.status}`);
  console.log(`  cf-cache-status: ${res.headers.get('cf-cache-status') || 'N/A'}`);
  console.log(`  x-vercel-cache: ${res.headers.get('x-vercel-cache') || 'N/A'}`);
  console.log(`  x-vercel-id: ${res.headers.get('x-vercel-id') || 'N/A'}`);
  console.log(`  Live bytes (normalized): ${liveClean.length}, Local bytes: ${localRaw.length}`);
  console.log(`  Exact byte-for-byte match: ${matched ? 'PASS ✓' : 'FAIL ✗'}`);

  if (!matched) {
    throw new Error(`Live response for ${url} does not match local ${localFilePath}`);
  }
}

async function run() {
  console.log(`Starting live deployment verification against ${PROD_ORIGIN}...`);
  try {
    await verifyRoute('/', 'index.html', true, false);
    await verifyRoute('/odorstrike', 'odorstrike.html', true, false);
    await verifyRoute('/assets/js/chrome.js', 'assets/js/chrome.js', false, false);
    await verifyRoute('/sitemap.xml', 'sitemap.xml', false, false);
    await verifyRoute('/robots.txt', 'robots.txt', false, true);

    console.log('\nAll production routes match current repository artifacts byte-for-byte.');
  } catch (err) {
    console.error('\nVerification failed:', err.message);
    process.exit(1);
  }
}

run();
