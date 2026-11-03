// Renders assets/img/og.jpg from scripts/og.html. Dev-only: needs Playwright
// (preinstalled in the cloud container; elsewhere `npx playwright install chromium`).
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.goto(pathToFileURL(path.join(ROOT, 'scripts/og.html')).href);
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(200);
await page.screenshot({ path: path.join(ROOT, 'assets/img/og.jpg'), type: 'jpeg', quality: 84 });
await browser.close();
console.log('Wrote assets/img/og.jpg');
