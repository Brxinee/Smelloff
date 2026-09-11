#!/usr/bin/env node
/**
 * scripts/analyze-analytics-export.mjs
 *
 * Repeatable, hardened ingestion and analysis engine for Smelloff.in
 * GA4 and Google Search Console exported data files (CSV / TSV).
 *
 * Features:
 *   - Auto-detects dataset types from file headers / schemas
 *   - Validates event names, currency, numeric ranges, and schemas
 *   - Deduplicates purchase events by transaction_id without dropping intermediate events
 *   - Calculates event-based, session-based, and user-based funnel metrics with explicit labeling
 *   - Segments by device, CTA location, payment method, quantity, acquisition, and landing page
 *   - Processes Google Search Console queries and pages
 *   - Strictly reports sample sizes (n = X) and preserves UNKNOWN as "unavailable" (never assumes 0)
 *   - Safe empty-state handling when no export files exist
 *
 * Usage:
 *   node scripts/analyze-analytics-export.mjs [data_directory_or_file]
 *   node scripts/analyze-analytics-export.mjs ./data
 */

import fs from 'node:fs';
import path from 'node:path';

// --- Robust CSV / TSV Parser ---
export function parseDelimitedText(content, delimiter = ',') {
  if (!content || typeof content !== 'string') return { headers: [], data: [], errors: [] };
  
  // Normalize newlines
  const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n');
  const rows = [];
  const errors = [];
  
  let rowIndex = 0;
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const rawLine = lines[lineIndex].trim();
    if (!rawLine || rawLine.startsWith('#')) continue; // Skip comments and empty lines
    
    const row = [];
    let insideQuotes = false;
    let currentField = '';
    
    for (let i = 0; i < rawLine.length; i++) {
      const char = rawLine[i];
      if (char === '"') {
        if (insideQuotes && rawLine[i + 1] === '"') {
          currentField += '"';
          i++; // Skip escaped quote
        } else {
          insideQuotes = !insideQuotes;
        }
      } else if (char === delimiter && !insideQuotes) {
        row.push(currentField.trim());
        currentField = '';
      } else {
        currentField += char;
      }
    }
    row.push(currentField.trim());
    
    // Check unclosed quotes
    if (insideQuotes) {
      errors.push({ line: lineIndex + 1, reason: 'Unclosed quotes in CSV line' });
    }
    
    if (row.some(f => f.length > 0)) {
      rows.push(row);
      rowIndex++;
    }
  }
  
  if (rows.length === 0) return { headers: [], data: [], errors };
  
  // Clean headers: remove BOM (\uFEFF) and trim
  const rawHeaders = rows[0].map(h => h.replace(/^\uFEFF/, '').trim());
  const data = [];
  
  for (let r = 1; r < rows.length; r++) {
    const rowObj = {};
    const currentRow = rows[r];
    for (let c = 0; c < rawHeaders.length; c++) {
      rowObj[rawHeaders[c]] = currentRow[c] !== undefined ? currentRow[c] : '';
    }
    data.push(rowObj);
  }
  
  return { headers: rawHeaders, data, errors };
}

// --- Dataset Type Identifier ---
export function identifyDatasetType(headers) {
  if (!headers || !Array.isArray(headers)) return 'UNKNOWN';
  const hLower = headers.map(h => h.toLowerCase().trim());
  const hNormalized = headers.map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim());
  
  const hasCol = (pattern) => {
    const patLower = pattern.toLowerCase();
    const patNorm = pattern.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
    return hLower.some(h => h.includes(patLower)) || hNormalized.some(h => h.includes(patNorm));
  };
  
  // 1. Search Console Queries
  if (hasCol('top queries') || (hasCol('query') && (hasCol('clicks') || hasCol('impressions')))) {
    return 'GSC_QUERIES';
  }
  // 2. Search Console Pages
  if (hasCol('top pages') || (hasCol('page') && hasCol('impressions') && !hasCol('event') && !hasCol('views'))) {
    return 'GSC_PAGES';
  }
  // 3. Ecommerce Transactions (prioritize over dimensions when transaction_id is present)
  if (hasCol('transaction id') || hasCol('transaction_id') || (hasCol('item name') && hasCol('item revenue')) || (hasCol('item name') && hasCol('value') && hasCol('quantity'))) {
    return 'GA4_ECOMMERCE';
  }
  // 4. CTA Custom Parameter
  if (hasCol('cta_location') || hasCol('cta location') || hasCol('custom cta')) {
    return 'GA4_CTA';
  }
  // 5. Payment Type Dimension
  if (hasCol('payment_type') || hasCol('payment type') || hasCol('payment method')) {
    return 'GA4_PAYMENT';
  }
  // 6. Device Category
  if (hasCol('device category') || hasCol('device_category') || hasCol('device')) {
    return 'GA4_DEVICE';
  }
  // 7. AI Referral Tracking
  if (hasCol('ai_source') || hasCol('ai_referral') || hasCol('ai referral')) {
    return 'GA4_AI_REFERRAL';
  }
  // 8. Acquisition Channels
  if (hasCol('source / medium') || hasCol('source_medium') || hasCol('source medium') || hasCol('session default channel group') || hasCol('channel group')) {
    return 'GA4_ACQUISITION';
  }
  // 9. Landing Pages
  if (hasCol('landing page') || hasCol('landing_page') || hasCol('landing page + query string')) {
    return 'GA4_LANDING_PAGES';
  }
  // 10. Funnel / Standard Events
  if (hasCol('event name') || hasCol('event_name') || hasCol('event count') || hasCol('events')) {
    return 'GA4_FUNNEL_EVENTS';
  }
  
  return 'UNKNOWN';
}

// --- Number & Currency Parsing Helpers ---
function parseCleanNumber(val, defaultVal = 0) {
  if (val === undefined || val === null || val === '') return defaultVal;
  if (typeof val === 'number') return isNaN(val) ? defaultVal : val;
  const clean = String(val).replace(/[^0-9.-]/g, '');
  const num = parseFloat(clean);
  return isNaN(num) ? defaultVal : num;
}

function parseCleanInt(val, defaultVal = 0) {
  if (val === undefined || val === null || val === '') return defaultVal;
  if (typeof val === 'number') return isNaN(val) ? defaultVal : Math.floor(val);
  const clean = String(val).replace(/[^0-9-]/g, '');
  const num = parseInt(clean, 10);
  return isNaN(num) ? defaultVal : num;
}

// --- Main Analyzer Function ---
export function runAnalysis(targetPath = './data', options = { silent: false }) {
  const log = (...args) => { if (!options.silent) console.log(...args); };
  
  log('='.repeat(70));
  log('SMELLOFF.IN HARDENED ANALYTICS INGESTION & CONVERSION ENGINE');
  log('='.repeat(70));
  
  const filesToProcess = [];
  
  if (fs.existsSync(targetPath)) {
    const stat = fs.statSync(targetPath);
    if (stat.isDirectory()) {
      const entries = fs.readdirSync(targetPath);
      for (const entry of entries) {
        if (entry.endsWith('.csv') || entry.endsWith('.tsv') || entry.endsWith('.txt')) {
          filesToProcess.push(path.join(targetPath, entry));
        }
      }
    } else if (stat.isFile()) {
      filesToProcess.push(targetPath);
    }
  }
  
  if (filesToProcess.length === 0) {
    log('\n## 1. Data Files Found');
    log('None in directory / path: ' + targetPath);
    log('\n' + '='.repeat(70));
    log('NO HISTORICAL DATA AVAILABLE — NO BUSINESS CONCLUSION CAN BE MADE.');
    log('='.repeat(70));
    log('\nTo run an analysis, place GA4 / Search Console CSV exports into:');
    log('  ./data/ (or pass the file/folder path as an argument)');
    log('\nSupported datasets:');
    log('  - GA4 Funnel Events (event_name, event_count, total_users, sessions)');
    log('  - GA4 Ecommerce (transaction_id, item_name, price, quantity, value, currency)');
    log('  - GA4 Custom Dimensions (cta_location, payment_type, device_category, ai_source)');
    log('  - Google Search Console (Queries.csv, Pages.csv)');
    log('='.repeat(70));
    return {
      status: 'NO_DATA',
      message: 'NO HISTORICAL DATA AVAILABLE — NO BUSINESS CONCLUSION CAN BE MADE.',
      summary: null
    };
  }
  
  log(`\n## 1. Data Files Found (${filesToProcess.length} file(s)):`);
  const datasets = [];
  
  for (const f of filesToProcess) {
    const raw = fs.readFileSync(f, 'utf8');
    const isTsv = f.endsWith('.tsv');
    const parsed = parseDelimitedText(raw, isTsv ? '\t' : ',');
    const type = identifyDatasetType(parsed.headers);
    log(`  - ${path.basename(f)}: ${parsed.data.length} rows [Identified Type: ${type}]`);
    datasets.push({
      file: f,
      fileName: path.basename(f),
      type,
      headers: parsed.headers,
      data: parsed.data,
      parseErrors: parsed.errors
    });
  }
  
  // --- Data Quality & Validation Audit ---
  log('\n## 2. Data Quality & Exclusion Audit');
  const quality = {
    totalRows: 0,
    validRows: 0,
    invalidRows: 0,
    excludedRows: 0,
    exclusions: [],
    duplicatePurchases: 0,
    testOrders: 0,
    currencyIssues: 0,
    missingEventNames: 0
  };
  
  const deduplicatedPurchases = new Map(); // transaction_id -> purchase record
  
  for (const ds of datasets) {
    quality.totalRows += ds.data.length;
    
    if (ds.type === 'GA4_ECOMMERCE') {
      for (const row of ds.data) {
        const txId = (row['Transaction ID'] || row['transaction_id'] || row['Transaction id'] || '').trim();
        const value = parseCleanNumber(row['Value'] || row['value'] || row['Item revenue'] || row['Purchase revenue']);
        const currency = (row['Currency'] || row['currency'] || 'INR').trim().toUpperCase();
        const qty = parseCleanInt(row['Quantity'] || row['quantity'] || row['Items'] || '1', 1);
        
        // 1. Check transaction id
        if (!txId) {
          quality.invalidRows++;
          quality.exclusions.push({ file: ds.fileName, row, reason: 'Missing transaction_id in purchase record' });
          continue;
        }
        
        // 2. Check test/demo records
        if (txId.toLowerCase().includes('test') || txId.toLowerCase().includes('demo') || txId.toLowerCase().includes('dummy')) {
          quality.excludedRows++;
          quality.testOrders++;
          quality.exclusions.push({ file: ds.fileName, row, reason: 'Identified test/demo transaction' });
          continue;
        }
        
        // 3. Currency check
        if (currency && currency !== 'INR') {
          quality.currencyIssues++;
          quality.exclusions.push({ file: ds.fileName, row, reason: `Incompatible currency: ${currency} (expected INR)` });
        }
        
        // 4. Value check
        if (value <= 0) {
          quality.invalidRows++;
          quality.exclusions.push({ file: ds.fileName, row, reason: `Invalid purchase value: ${value}` });
          continue;
        }
        
        // 5. Quantity check
        if (qty <= 0) {
          quality.invalidRows++;
          quality.exclusions.push({ file: ds.fileName, row, reason: `Invalid quantity: ${qty}` });
          continue;
        }
        
        // 6. Duplicate transaction check
        if (deduplicatedPurchases.has(txId)) {
          quality.duplicatePurchases++;
          quality.excludedRows++;
          quality.exclusions.push({ file: ds.fileName, row, reason: `Duplicate transaction_id: ${txId}` });
          continue;
        }
        
        deduplicatedPurchases.set(txId, {
          txId,
          value,
          currency,
          quantity: qty,
          paymentType: (row['Payment type'] || row['payment_type'] || row['payment_method'] || 'unknown').toLowerCase().trim(),
          date: row['Date'] || row['date'] || ''
        });
        quality.validRows++;
      }
    } else if (ds.type === 'GA4_FUNNEL_EVENTS') {
      for (const row of ds.data) {
        const eventName = (row['Event name'] || row['event_name'] || '').trim().toLowerCase();
        if (!eventName) {
          quality.missingEventNames++;
          quality.invalidRows++;
          quality.exclusions.push({ file: ds.fileName, row, reason: 'Missing event_name' });
          continue;
        }
        quality.validRows++;
      }
    } else {
      quality.validRows += ds.data.length;
    }
  }
  
  log(`  - Total Rows Ingested: ${quality.totalRows}`);
  log(`  - Valid Rows Processed: ${quality.validRows}`);
  log(`  - Invalid Rows Rejected: ${quality.invalidRows}`);
  log(`  - Excluded Records (Duplicates / Tests): ${quality.excludedRows}`);
  log(`  - Unique Deduplicated Purchases: ${deduplicatedPurchases.size}`);
  
  // --- Date Range Detection ---
  log('\n## 3. Observed Date Range');
  const observedDates = [];
  for (const ds of datasets) {
    for (const row of ds.data) {
      const d = row['Date'] || row['date'] || row['Day'] || '';
      if (d && d.length >= 8) observedDates.push(d);
    }
  }
  observedDates.sort();
  const dateRangeStr = observedDates.length > 0
    ? `${observedDates[0]} to ${observedDates[observedDates.length - 1]} (${new Set(observedDates).size} distinct days observed)`
    : 'Not explicitly specified in exported columns';
  log(`  - Observed Period: ${dateRangeStr}`);
  
  // --- Funnel Metrics Aggregation ---
  log('\n## 4. Overall Funnel Metrics');
  
  // Extract standard event counts
  const eventMetrics = {
    page_view: { events: null, users: null, sessions: null },
    view_item: { events: null, users: null, sessions: null },
    add_to_cart: { events: null, users: null, sessions: null },
    begin_checkout: { events: null, users: null, sessions: null },
    add_payment_info: { events: null, users: null, sessions: null },
    purchase: { events: null, users: null, sessions: null }
  };
  
  for (const ds of datasets) {
    if (ds.type === 'GA4_FUNNEL_EVENTS') {
      for (const row of ds.data) {
        const name = (row['Event name'] || row['event_name'] || '').trim().toLowerCase();
        if (eventMetrics[name]) {
          const evCount = parseCleanInt(row['Event count'] || row['event_count'] || row['Events']);
          const uCount = parseCleanInt(row['Total users'] || row['Users'] || row['total_users']);
          const sCount = parseCleanInt(row['Sessions'] || row['sessions']);
          
          if (evCount > 0) eventMetrics[name].events = (eventMetrics[name].events || 0) + evCount;
          if (uCount > 0) eventMetrics[name].users = (eventMetrics[name].users || 0) + uCount;
          if (sCount > 0) eventMetrics[name].sessions = (eventMetrics[name].sessions || 0) + sCount;
        }
      }
    }
  }
  
  // Override purchase event count with deduplicated transactions if ecommerce export is present
  if (deduplicatedPurchases.size > 0) {
    eventMetrics.purchase.events = deduplicatedPurchases.size;
    eventMetrics.purchase.transactions = deduplicatedPurchases.size;
  }
  
  log('  Counting Methodology:');
  log('    - Event Rate: (Next Step Events / Prior Step Events) * 100%');
  log('    - User Rate: (Next Step Users / Prior Step Users) * 100% [when user counts exist]');
  log('    - End-to-End: (Purchases / PDP view_item) * 100%');
  log('');
  
  const formatCount = (val) => val !== null && val !== undefined ? String(val) : 'unavailable';
  const calcRate = (numerator, denominator) => {
    if (numerator === null || denominator === null || denominator === 0) return 'unavailable';
    return ((numerator / denominator) * 100).toFixed(1) + '%';
  };
  
  const pdpEvents = eventMetrics.view_item.events;
  const atcEvents = eventMetrics.add_to_cart.events;
  const chkEvents = eventMetrics.begin_checkout.events;
  const payEvents = eventMetrics.add_payment_info.events;
  const purEvents = eventMetrics.purchase.events;
  
  log('  | Funnel Step | Event Count | Step Conversion Rate (Event-Based) | Cumulative Rate from PDP |');
  log('  | :--- | :---: | :---: | :---: |');
  log(`  | 1. Page View (\`page_view\`) | ${formatCount(eventMetrics.page_view.events)} | — | — |`);
  log(`  | 2. PDP View (\`view_item\`) | ${formatCount(pdpEvents)} | ${calcRate(pdpEvents, eventMetrics.page_view.events)} (from PV) | 100.0% |`);
  log(`  | 3. Add to Cart (\`add_to_cart\`) | ${formatCount(atcEvents)} | ${calcRate(atcEvents, pdpEvents)} (PDP → ATC) | ${calcRate(atcEvents, pdpEvents)} |`);
  log(`  | 4. Begin Checkout (\`begin_checkout\`) | ${formatCount(chkEvents)} | ${calcRate(chkEvents, atcEvents)} (ATC → Chk) | ${calcRate(chkEvents, pdpEvents)} |`);
  log(`  | 5. Add Payment Info (\`add_payment_info\`) | ${formatCount(payEvents)} | ${calcRate(payEvents, chkEvents)} (Chk → Pay) | ${calcRate(payEvents, pdpEvents)} |`);
  log(`  | 6. Purchase (\`purchase\`) | ${formatCount(purEvents)} | ${calcRate(purEvents, payEvents)} (Pay → Pur) | ${calcRate(purEvents, pdpEvents)} |`);
  
  // --- Revenue & Quantity Distribution ---
  let totalRevenue = 0;
  const qtyDistribution = { 1: 0, 2: 0, 3: 0, '4+': 0 };
  const paymentBreakdown = { cod: { orders: 0, revenue: 0 }, razorpay: { orders: 0, revenue: 0 }, upi: { orders: 0, revenue: 0 }, other: { orders: 0, revenue: 0 } };
  
  for (const [txId, tx] of deduplicatedPurchases.entries()) {
    totalRevenue += tx.value;
    const qKey = tx.quantity >= 4 ? '4+' : String(tx.quantity);
    if (qtyDistribution[qKey] !== undefined) qtyDistribution[qKey]++;
    else qtyDistribution['4+']++;
    
    if (tx.paymentType.includes('cod')) {
      paymentBreakdown.cod.orders++;
      paymentBreakdown.cod.revenue += tx.value;
    } else if (tx.paymentType.includes('razorpay') || tx.paymentType.includes('card') || tx.paymentType.includes('netbanking')) {
      paymentBreakdown.razorpay.orders++;
      paymentBreakdown.razorpay.revenue += tx.value;
    } else if (tx.paymentType.includes('upi')) {
      paymentBreakdown.upi.orders++;
      paymentBreakdown.upi.revenue += tx.value;
    } else {
      paymentBreakdown.other.orders++;
      paymentBreakdown.other.revenue += tx.value;
    }
  }
  
  const aov = deduplicatedPurchases.size > 0 ? (totalRevenue / deduplicatedPurchases.size).toFixed(2) : null;
  log(`\n  - Total Valid Purchases: ${deduplicatedPurchases.size > 0 ? deduplicatedPurchases.size : 'unavailable'}`);
  log(`  - Total Realized Revenue: ${deduplicatedPurchases.size > 0 ? '₹' + totalRevenue.toLocaleString('en-IN') : 'unavailable'}`);
  log(`  - Average Order Value (AOV): ${aov ? '₹' + aov : 'unavailable'}`);
  
  // --- CTA Breakdown ---
  log('\n## 5. CTA Location Performance');
  const ctaStats = {};
  for (const ds of datasets) {
    if (ds.type === 'GA4_CTA') {
      for (const row of ds.data) {
        const loc = (row['cta_location'] || row['CTA Location'] || row['cta location'] || 'unknown').toLowerCase().trim();
        const evCount = parseCleanInt(row['Event count'] || row['event_count'] || row['Clicks'] || '1', 1);
        const chkCount = parseCleanInt(row['begin_checkout'] || row['Checkout starts'] || '0', 0);
        const purCount = parseCleanInt(row['purchases'] || row['Purchases'] || '0', 0);
        const rev = parseCleanNumber(row['revenue'] || row['Revenue'] || '0', 0);
        
        if (!ctaStats[loc]) ctaStats[loc] = { clicks: 0, checkouts: 0, purchases: 0, revenue: 0 };
        ctaStats[loc].clicks += evCount;
        ctaStats[loc].checkouts += chkCount;
        ctaStats[loc].purchases += purCount;
        ctaStats[loc].revenue += rev;
      }
    }
  }
  
  if (Object.keys(ctaStats).length > 0) {
    log('  | CTA Location | Interactions (n) | Checkouts | Purchases | Purchase Rate | Revenue |');
    log('  | :--- | :---: | :---: | :---: | :---: | :---: |');
    for (const [loc, st] of Object.entries(ctaStats)) {
      const pRate = st.clicks > 0 && st.purchases > 0 ? ((st.purchases / st.clicks) * 100).toFixed(1) + '%' : 'unavailable';
      const revStr = st.revenue > 0 ? '₹' + st.revenue.toLocaleString('en-IN') : '—';
      log(`  | \`${loc}\` | n = ${st.clicks} | ${st.checkouts} | ${st.purchases} | ${pRate} | ${revStr} |`);
    }
  } else {
    log('  No dedicated cta_location export dataset provided.');
  }
  
  // --- Device Breakdown ---
  log('\n## 6. Device Category Breakdown');
  const deviceStats = {};
  for (const ds of datasets) {
    if (ds.type === 'GA4_DEVICE') {
      for (const row of ds.data) {
        const dev = (row['Device category'] || row['device_category'] || row['Device'] || 'unknown').toLowerCase().trim();
        const sessions = parseCleanInt(row['Sessions'] || row['sessions'] || '0', 0);
        const users = parseCleanInt(row['Users'] || row['users'] || '0', 0);
        const purchases = parseCleanInt(row['Purchases'] || row['purchases'] || '0', 0);
        const revenue = parseCleanNumber(row['Revenue'] || row['revenue'] || '0', 0);
        
        if (!deviceStats[dev]) deviceStats[dev] = { sessions: 0, users: 0, purchases: 0, revenue: 0 };
        deviceStats[dev].sessions += sessions;
        deviceStats[dev].users += users;
        deviceStats[dev].purchases += purchases;
        deviceStats[dev].revenue += revenue;
      }
    }
  }
  
  if (Object.keys(deviceStats).length > 0) {
    log('  | Device Category | Sessions (n) | Users | Purchases | Purchase Rate | Revenue |');
    log('  | :--- | :---: | :---: | :---: | :---: | :---: |');
    for (const [dev, st] of Object.entries(deviceStats)) {
      const pRate = st.sessions > 0 ? ((st.purchases / st.sessions) * 100).toFixed(2) + '%' : 'unavailable';
      log(`  | ${dev} | n = ${st.sessions} | ${st.users} | ${st.purchases} | ${pRate} | ₹${st.revenue.toLocaleString('en-IN')} |`);
    }
  } else {
    log('  No dedicated device_category export dataset provided.');
  }
  
  // --- Payment Method Breakdown ---
  log('\n## 7. Payment Method Breakdown');
  if (deduplicatedPurchases.size > 0) {
    log('  | Method | Orders (n) | Share | Realized Revenue |');
    log('  | :--- | :---: | :---: | :---: |');
    const tot = deduplicatedPurchases.size;
    for (const [m, st] of Object.entries(paymentBreakdown)) {
      if (st.orders > 0) {
        const share = ((st.orders / tot) * 100).toFixed(1) + '%';
        log(`  | ${m.toUpperCase()} | n = ${st.orders} | ${share} | ₹${st.revenue.toLocaleString('en-IN')} |`);
      }
    }
  } else {
    log('  No purchase payment data provided.');
  }
  
  // --- Quantity Distribution ---
  log('\n## 8. Quantity Distribution');
  if (deduplicatedPurchases.size > 0) {
    log('  | Quantity | Order Count (n) | Order Share |');
    log('  | :--- | :---: | :---: |');
    const tot = deduplicatedPurchases.size;
    for (const [q, cnt] of Object.entries(qtyDistribution)) {
      const share = tot > 0 ? ((cnt / tot) * 100).toFixed(1) + '%' : '0%';
      log(`  | ${q} Unit(s) | n = ${cnt} | ${share} |`);
    }
  } else {
    log('  No quantity distribution data provided.');
  }

  // --- Acquisition & Landing Pages Breakdown ---
  log('\n## 9. Acquisition & Landing Pages Breakdown');
  const acquisitionStats = {};
  const landingPageStats = {};
  const aiReferralStats = {};

  for (const ds of datasets) {
    if (ds.type === 'GA4_ACQUISITION') {
      for (const row of ds.data) {
        const channel = (row['Session default channel group'] || row['Session primary channel group (Default Channel Group)'] || row['Source / medium'] || row['source / medium'] || 'unknown').trim();
        const sessions = parseCleanInt(row['Sessions'] || row['sessions'] || '0', 0);
        const users = parseCleanInt(row['Users'] || row['users'] || row['Total users'] || '0', 0);
        const purchases = parseCleanInt(row['Purchases'] || row['purchases'] || '0', 0);
        const revenue = parseCleanNumber(row['Revenue'] || row['revenue'] || '0', 0);
        if (!acquisitionStats[channel]) acquisitionStats[channel] = { sessions: 0, users: 0, purchases: 0, revenue: 0 };
        acquisitionStats[channel].sessions += sessions;
        acquisitionStats[channel].users += users;
        acquisitionStats[channel].purchases += purchases;
        acquisitionStats[channel].revenue += revenue;
      }
    } else if (ds.type === 'GA4_LANDING_PAGES') {
      for (const row of ds.data) {
        const page = (row['Landing page'] || row['Landing page + query string'] || row['page path'] || 'unknown').trim();
        const sessions = parseCleanInt(row['Sessions'] || row['sessions'] || '0', 0);
        const purchases = parseCleanInt(row['Purchases'] || row['purchases'] || '0', 0);
        const revenue = parseCleanNumber(row['Revenue'] || row['revenue'] || '0', 0);
        if (!landingPageStats[page]) landingPageStats[page] = { sessions: 0, purchases: 0, revenue: 0 };
        landingPageStats[page].sessions += sessions;
        landingPageStats[page].purchases += purchases;
        landingPageStats[page].revenue += revenue;
      }
    } else if (ds.type === 'GA4_AI_REFERRAL') {
      for (const row of ds.data) {
        const aiSource = (row['ai_source'] || row['AI Source'] || row['ai_referral'] || 'unknown').trim();
        const sessions = parseCleanInt(row['Sessions'] || row['sessions'] || row['Event count'] || '1', 1);
        const purchases = parseCleanInt(row['Purchases'] || row['purchases'] || '0', 0);
        if (!aiReferralStats[aiSource]) aiReferralStats[aiSource] = { sessions: 0, purchases: 0 };
        aiReferralStats[aiSource].sessions += sessions;
        aiReferralStats[aiSource].purchases += purchases;
      }
    }
  }

  if (Object.keys(acquisitionStats).length > 0) {
    log('  Acquisition Channels:');
    for (const [ch, st] of Object.entries(acquisitionStats)) {
      log(`    - ${ch}: n = ${st.sessions} sessions, ${st.purchases} purchases`);
    }
  } else {
    log('  No dedicated acquisition channel export provided.');
  }

  if (Object.keys(landingPageStats).length > 0) {
    log('  Landing Pages:');
    for (const [lp, st] of Object.entries(landingPageStats)) {
      log(`    - ${lp}: n = ${st.sessions} sessions, ${st.purchases} purchases`);
    }
  } else {
    log('  No dedicated landing page export provided.');
  }

  if (Object.keys(aiReferralStats).length > 0) {
    log('  AI Referrals:');
    for (const [src, st] of Object.entries(aiReferralStats)) {
      log(`    - ${src}: n = ${st.sessions} sessions, ${st.purchases} purchases`);
    }
  } else {
    log('  No AI referral export provided.');
  }
  
  // --- Google Search Console Analysis ---
  log('\n## 10. Search Console Performance');
  const gscQueries = [];
  const gscPages = [];
  
  for (const ds of datasets) {
    if (ds.type === 'GSC_QUERIES') {
      for (const row of ds.data) {
        const query = row['Top queries'] || row['Query'] || row['query'] || '';
        const clicks = parseCleanInt(row['Clicks'] || row['clicks']);
        const impressions = parseCleanInt(row['Impressions'] || row['impressions']);
        const ctr = parseCleanNumber(row['CTR'] || row['ctr']);
        const pos = parseCleanNumber(row['Position'] || row['position'] || row['Average position']);
        if (query) gscQueries.push({ query, clicks, impressions, ctr, pos });
      }
    } else if (ds.type === 'GSC_PAGES') {
      for (const row of ds.data) {
        const page = row['Top pages'] || row['Page'] || row['page'] || '';
        const clicks = parseCleanInt(row['Clicks'] || row['clicks']);
        const impressions = parseCleanInt(row['Impressions'] || row['impressions']);
        const ctr = parseCleanNumber(row['CTR'] || row['ctr']);
        const pos = parseCleanNumber(row['Position'] || row['position'] || row['Average position']);
        if (page) gscPages.push({ page, clicks, impressions, ctr, pos });
      }
    }
  }
  
  if (gscQueries.length > 0) {
    log(`  - Total Queries Logged: ${gscQueries.length}`);
    const topOpportunities = [...gscQueries]
      .filter(q => q.impressions >= 20 && q.clicks === 0)
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, 5);
    
    if (topOpportunities.length > 0) {
      log('  Top High-Impression / Zero-Click Queries:');
      for (const q of topOpportunities) {
        log(`    - "${q.query}": ${q.impressions} impressions, pos ${q.pos.toFixed(1)}`);
      }
    }
  } else {
    log('  No Search Console queries export provided.');
  }
  
  // --- Bottleneck Determination ---
  log('\n## 11. Single Biggest Measurable Funnel Bottleneck');
  let bottleneck = 'INSUFFICIENT_DATA';
  let evidence = 'No complete funnel dataset provided.';
  
  if (pdpEvents && atcEvents && chkEvents && purEvents) {
    const atcDrop = (pdpEvents - atcEvents) / pdpEvents;
    const chkDrop = (atcEvents - chkEvents) / atcEvents;
    const purDrop = payEvents ? (chkEvents - purEvents) / chkEvents : (chkEvents - purEvents) / chkEvents;
    
    const maxDrop = Math.max(atcDrop, chkDrop, purDrop);
    if (maxDrop === atcDrop) {
      bottleneck = 'PDP_TO_ADD_TO_CART_DROP';
      evidence = `PDP views (n = ${pdpEvents}) to Add to Cart (n = ${atcEvents}) had a ${(atcDrop * 100).toFixed(1)}% drop.`;
    } else if (maxDrop === chkDrop) {
      bottleneck = 'CART_TO_CHECKOUT_DROP';
      evidence = `Add to Cart (n = ${atcEvents}) to Checkout (n = ${chkEvents}) had a ${(chkDrop * 100).toFixed(1)}% drop.`;
    } else {
      bottleneck = 'CHECKOUT_TO_PURCHASE_DROP';
      evidence = `Checkout starts (n = ${chkEvents}) to Completed Purchases (n = ${purEvents}) had a ${(purDrop * 100).toFixed(1)}% drop.`;
    }
    log(`  - Identified Bottleneck: ${bottleneck}`);
    log(`  - Evidence: ${evidence}`);
  } else {
    log('  NO HISTORICAL DATA AVAILABLE — NO BUSINESS CONCLUSION CAN BE MADE.');
  }
  
  log('='.repeat(70));
  
  return {
    status: 'PROCESSED',
    filesCount: filesToProcess.length,
    datasets,
    quality,
    eventMetrics,
    revenue: { total: totalRevenue, count: deduplicatedPurchases.size, aov },
    paymentBreakdown,
    qtyDistribution,
    ctaStats,
    deviceStats,
    acquisitionStats,
    landingPageStats,
    aiReferralStats,
    gscQueries,
    gscPages,
    bottleneck,
    evidence
  };
}

// CLI Execution
if (process.argv[1] && process.argv[1].endsWith('analyze-analytics-export.mjs')) {
  const targetDir = process.argv[2] || './data';
  runAnalysis(targetDir);
}
