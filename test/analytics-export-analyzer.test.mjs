import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { runAnalysis, parseDelimitedText, identifyDatasetType } from '../scripts/analyze-analytics-export.mjs';

const FIXTURE_DIR = path.resolve('./test/fixtures/analytics');

describe('scripts/analyze-analytics-export.mjs Pipeline QA & Hardening Tests', () => {
  before(() => {
    fs.mkdirSync(FIXTURE_DIR, { recursive: true });
  });

  after(() => {
    if (fs.existsSync(FIXTURE_DIR)) {
      fs.rmSync(FIXTURE_DIR, { recursive: true, force: true });
    }
  });

  test('Empty workspace returns clean NO HISTORICAL DATA AVAILABLE status', () => {
    const emptyDir = path.join(FIXTURE_DIR, 'empty');
    fs.mkdirSync(emptyDir, { recursive: true });
    
    const result = runAnalysis(emptyDir, { silent: true });
    assert.equal(result.status, 'NO_DATA');
    assert.equal(result.summary, null);
    assert.match(result.message, /NO HISTORICAL DATA AVAILABLE/);
  });

  test('parseDelimitedText correctly parses CSV and TSV with quoted fields, BOM, and reports errors', () => {
    const csvContent = '\uFEFF"Transaction ID","Item name","Value"\n"TX-101","ODORSTRIKE, 50ml",229\n"TX-102","ODORSTRIKE ""Double"" Pack",458';
    const parsed = parseDelimitedText(csvContent, ',');
    
    assert.deepEqual(parsed.headers, ['Transaction ID', 'Item name', 'Value']);
    assert.equal(parsed.data.length, 2);
    assert.equal(parsed.data[0]['Transaction ID'], 'TX-101');
    assert.equal(parsed.data[0]['Item name'], 'ODORSTRIKE, 50ml');
    assert.equal(parsed.data[1]['Item name'], 'ODORSTRIKE "Double" Pack');

    // Test malformed unclosed quotes
    const badContent = '"Unclosed,Field 2\n"Valid","Row"';
    const badParsed = parseDelimitedText(badContent, ',');
    assert.ok(badParsed.errors.length > 0, 'Reported unclosed quotes');
  });

  test('identifyDatasetType accurately classifies all supported schemas', () => {
    assert.equal(identifyDatasetType(['Event name', 'Event count', 'Total users']), 'GA4_FUNNEL_EVENTS');
    assert.equal(identifyDatasetType(['Transaction ID', 'Item name', 'Value', 'Quantity']), 'GA4_ECOMMERCE');
    assert.equal(identifyDatasetType(['cta_location', 'Event count', 'Purchases']), 'GA4_CTA');
    assert.equal(identifyDatasetType(['Device category', 'Sessions', 'Users']), 'GA4_DEVICE');
    assert.equal(identifyDatasetType(['Payment type', 'Transactions', 'Revenue']), 'GA4_PAYMENT');
    assert.equal(identifyDatasetType(['Source / medium', 'Sessions', 'Users']), 'GA4_ACQUISITION');
    assert.equal(identifyDatasetType(['Landing page', 'Sessions', 'Purchases']), 'GA4_LANDING_PAGES');
    assert.equal(identifyDatasetType(['ai_source', 'Sessions', 'Purchases']), 'GA4_AI_REFERRAL');
    assert.equal(identifyDatasetType(['Top queries', 'Clicks', 'Impressions', 'CTR']), 'GSC_QUERIES');
    assert.equal(identifyDatasetType(['Top pages', 'Clicks', 'Impressions', 'CTR']), 'GSC_PAGES');
    assert.equal(identifyDatasetType(['Unknown_Col_1', 'Unknown_Col_2']), 'UNKNOWN');
  });

  test('Processes synthetic fixtures: handles deduplication, currencies, quantities, devices, CTAs, acquisition, and Search Console deterministically', () => {
    const testDir = path.join(FIXTURE_DIR, 'full_run');
    fs.mkdirSync(testDir, { recursive: true });

    // 1. Funnel Events
    const eventsCsv = `Event name,Event count,Total users,Sessions
page_view,1000,800,950
view_item,500,450,480
add_to_cart,100,90,95
begin_checkout,50,48,50
add_payment_info,40,38,40
purchase,20,20,20`;
    fs.writeFileSync(path.join(testDir, 'funnel_events.csv'), eventsCsv);

    // 2. Ecommerce Purchases with:
    // - 1 regular single unit purchase (₹229)
    // - 1 multi-quantity (2 units) prepaid purchase (₹458)
    // - 1 COD purchase (₹289)
    // - 1 duplicate transaction (should be excluded from deduplicated total)
    // - 1 test transaction (should be excluded)
    // - 1 invalid negative/zero value (should be excluded)
    // - 1 missing transaction id (should be excluded)
    // - 1 invalid currency USD (should be flagged)
    const ecomCsv = `Transaction ID,Item name,Quantity,Value,Currency,Payment type
TX_CANONICAL_01,ODORSTRIKE 50ml,1,229,INR,upi
TX_MULTI_QTY_02,ODORSTRIKE 50ml,2,458,INR,razorpay
TX_COD_ORDER_03,ODORSTRIKE 50ml,1,289,INR,cod
TX_CANONICAL_01,ODORSTRIKE 50ml,1,229,INR,upi
TX_TEST_ORDER_99,ODORSTRIKE 50ml,1,229,INR,upi
TX_INVALID_ZERO,ODORSTRIKE 50ml,1,0,INR,upi
,ODORSTRIKE 50ml,1,229,INR,upi
TX_FOREIGN_USD,ODORSTRIKE 50ml,1,20,USD,razorpay`;
    fs.writeFileSync(path.join(testDir, 'ecommerce.csv'), ecomCsv);

    // 3. CTA Performance
    const ctaCsv = `cta_location,Event count,begin_checkout,purchases,revenue
pdp_hero,60,30,10,2290
mobile_sticky,40,20,10,2450`;
    fs.writeFileSync(path.join(testDir, 'cta.csv'), ctaCsv);

    // 4. Device Performance
    const deviceCsv = `Device category,Sessions,Users,Purchases,Revenue
mobile,800,650,15,3500
desktop,200,150,5,1238`;
    fs.writeFileSync(path.join(testDir, 'device.csv'), deviceCsv);

    // 5. Acquisition Performance
    const acqCsv = `Session default channel group,Sessions,Users,Purchases,Revenue
Direct,400,350,8,1832
Organic Search,300,280,7,1603
Organic Social,100,90,3,687`;
    fs.writeFileSync(path.join(testDir, 'acquisition.csv'), acqCsv);

    // 6. Landing Pages Performance
    const lpCsv = `Landing page,Sessions,Purchases,Revenue
/,450,8,1832
/odorstrike,300,9,2061
/solutions/body-odor-clothes,50,1,229`;
    fs.writeFileSync(path.join(testDir, 'landing_pages.csv'), lpCsv);

    // 7. AI Referrals
    const aiCsv = `ai_source,Sessions,Purchases
chatgpt,30,1
claude,15,0
gemini,20,1`;
    fs.writeFileSync(path.join(testDir, 'ai_referrals.csv'), aiCsv);

    // 8. Search Console Queries
    const gscCsv = `Top queries,Clicks,Impressions,CTR,Position
fabric odor remover spray,12,150,8.0%,3.2
gym clothes smell sweat,0,45,0.0%,8.5
armpit smell removal clothes,0,30,0.0%,6.1`;
    fs.writeFileSync(path.join(testDir, 'Queries.csv'), gscCsv);

    const result = runAnalysis(testDir, { silent: true });
    
    assert.equal(result.status, 'PROCESSED');
    assert.equal(result.datasets.length, 8);

    // Data Quality checks
    assert.equal(result.quality.duplicatePurchases, 1, 'Duplicate transaction identified');
    assert.equal(result.quality.testOrders, 1, 'Test transaction identified');
    assert.equal(result.quality.currencyIssues, 1, 'USD currency issue flagged');
    assert.equal(result.quality.invalidRows, 2, 'Zero-value row and missing transaction_id rejected');
    
    // Total valid deduplicated purchases in ecommerce dataset: TX_CANONICAL_01, TX_MULTI_QTY_02, TX_COD_ORDER_03, TX_FOREIGN_USD = 4
    assert.equal(result.revenue.count, 4);
    assert.equal(result.revenue.total, 229 + 458 + 289 + 20);

    // Payment breakdown
    assert.equal(result.paymentBreakdown.cod.orders, 1);
    assert.equal(result.paymentBreakdown.upi.orders, 1);
    assert.equal(result.paymentBreakdown.razorpay.orders, 2); // TX_MULTI_QTY_02 + TX_FOREIGN_USD

    // Quantity breakdown
    assert.equal(result.qtyDistribution['1'], 3);
    assert.equal(result.qtyDistribution['2'], 1);

    // CTA breakdown
    assert.equal(result.ctaStats['pdp_hero'].clicks, 60);
    assert.equal(result.ctaStats['mobile_sticky'].clicks, 40);

    // Device breakdown
    assert.equal(result.deviceStats['mobile'].sessions, 800);
    assert.equal(result.deviceStats['desktop'].sessions, 200);

    // Acquisition channels
    assert.equal(result.acquisitionStats['Direct'].sessions, 400);
    assert.equal(result.acquisitionStats['Organic Search'].purchases, 7);

    // Landing pages
    assert.equal(result.landingPageStats['/odorstrike'].sessions, 300);

    // AI referrals
    assert.equal(result.aiReferralStats['chatgpt'].sessions, 30);
    assert.equal(result.aiReferralStats['gemini'].purchases, 1);

    // Search Console
    assert.equal(result.gscQueries.length, 3);
  });
});
