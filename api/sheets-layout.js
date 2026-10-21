// The design of the two Google Sheets, as code. Every sync calls
// ensureLayout(): it reads a version stamp stored in the spreadsheet and, if
// the stamp is old or a tab is missing, rebuilds the design in place. Data
// rows, owner columns (COD call, Notes) and the owner's inputs (period picker,
// stock numbers) are kept. So the sheets never drift from this file, and a
// design change ships by bumping LAYOUT_VERSION. Setup: docs/GOOGLE-SHEETS-SETUP.md.
import { ORDER_COLUMNS, CONTACT_COLUMNS } from './_sheet-columns.js';
import { getSpreadsheetMeta, readRanges, batchUpdate, columnLetter } from './_google-sheets.js';

export const LAYOUT_VERSION = '2026-10-20.1';
const STAMP_KEY = 'smelloff_layout';

// Brand: Carbon Black · Ice White · Signal Lime (CLAUDE.md "Brand palette").
const C = {
  ink: '#0A0A0A', lime: '#B8FF57', limeDark: '#5E8F12', ice: '#F2F5EF', white: '#FFFFFF',
  card: '#F2F4EF', band: '#F7F8F5', line: '#E2E5DE', muted: '#6B7066', faint: '#9DA398',
  owner: '#FFF8D6', input: '#FFF59D', blueText: '#0B4A85',
  amber: '#FFEFC2', amberText: '#7A5300', red: '#FCE1E1', redText: '#9B1C1C',
  green: '#DDF2D3', greenText: '#1E5C12', blue: '#DCEBFA', grey: '#EDEEEA', greyText: '#8A8F86',
  orange: '#FFD8B0',
};
const BODY = 'Inter';
const PERIODS = ['All time', 'This month', 'Last month', 'Last 7 days', 'Last 30 days', 'This year'];
const DISPLAY = 'Space Grotesk';

const rgb = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v) => Math.round((v / 255) * 1000) / 1000;
  return { red: ch((n >> 16) & 255), green: ch((n >> 8) & 255), blue: ch(n & 255) };
};
const color = (hex) => ({ rgbColor: rgb(hex) });
const R = (sheetId, r0, r1, c0, c1) => ({ sheetId, startRowIndex: r0, endRowIndex: r1, startColumnIndex: c0, endColumnIndex: c1 });

const NUM = {
  money: { type: 'CURRENCY', pattern: '"₹"#,##0' },
  int: { type: 'NUMBER', pattern: '0' },
  dec1: { type: 'NUMBER', pattern: '0.0' },
  pct: { type: 'PERCENT', pattern: '0%' },
  date: { type: 'DATE', pattern: 'dd mmm yyyy' },
  datetime: { type: 'DATE_TIME', pattern: 'dd mmm yyyy, hh:mm' },
  month: { type: 'DATE', pattern: 'mmm yyyy' },
  text: { type: 'TEXT', pattern: '@' },
};

function cellFormat(st = {}) {
  const f = {
    textFormat: {
      fontFamily: st.font || BODY,
      fontSize: st.size || 10,
      ...(st.bold ? { bold: true } : {}),
      ...(st.italic ? { italic: true } : {}),
      foregroundColorStyle: color(st.fg || C.ink),
    },
    verticalAlignment: st.valign || 'MIDDLE',
    horizontalAlignment: st.align || 'LEFT',
    wrapStrategy: st.wrap || 'CLIP',
    ...(st.bg ? { backgroundColorStyle: color(st.bg) } : {}),
    padding: { left: st.padLeft ?? 6, right: 6, top: 2, bottom: 2 },
  };
  if (st.number) f.numberFormat = st.number;
  return f;
}

function cellValue(v) {
  if (v === undefined || v === null || v === '') return undefined;
  if (typeof v === 'number') return { numberValue: v };
  if (typeof v === 'string' && v.startsWith('=')) return { formulaValue: v };
  return { stringValue: String(v) };
}

// A small drawing surface for the generated tabs: set cells with a style,
// merge, then emit compact requests: the base format once, one repeatCell per
// rectangle of equally styled cells, and the values on their own.
class Canvas {
  constructor(sheetId, rows, cols, base) {
    Object.assign(this, { sheetId, rows, cols, base });
    this.cells = new Map();
    this.extra = [];
  }
  set(r, c, value, style = {}) { this.cells.set(`${r}:${c}`, { value, style: { ...this.base, ...style } }); return this; }
  fill(r0, r1, c0, c1, style) {
    for (let r = r0; r < r1; r += 1) for (let c = c0; c < c1; c += 1) {
      const k = `${r}:${c}`; const cur = this.cells.get(k);
      this.cells.set(k, { value: cur?.value, style: { ...this.base, ...(cur?.style || {}), ...style } });
    }
    return this;
  }
  merge(r0, r1, c0, c1) { this.extra.push({ mergeCells: { range: R(this.sheetId, r0, r1, c0, c1), mergeType: 'MERGE_ALL' } }); return this; }
  border(r0, r1, c0, c1, sides, hex, style = 'SOLID') {
    const b = { style, colorStyle: color(hex) };
    const req = { range: R(this.sheetId, r0, r1, c0, c1) };
    for (const s of sides) req[s] = b;
    this.extra.push({ updateBorders: req });
    return this;
  }
  requests() {
    const { sheetId, rows, cols } = this;
    const formats = new Map();
    const keyOf = (st) => {
      const f = cellFormat(st);
      const k = JSON.stringify(f);
      formats.set(k, f);
      return k;
    };
    const base = keyOf(this.base);
    const grid = [];
    for (let r = 0; r < rows; r += 1) {
      grid.push([]);
      for (let c = 0; c < cols; c += 1) grid[r].push(keyOf(this.cells.get(`${r}:${c}`)?.style || this.base));
    }
    const out = [{ repeatCell: { range: R(sheetId, 0, rows, 0, cols), cell: { userEnteredFormat: formats.get(base) }, fields: 'userEnteredFormat' } }];
    // Runs of one style along a row, grown downwards while the row below has
    // the same run.
    const rects = [];
    let open = new Map();
    for (let r = 0; r < rows; r += 1) {
      const next = new Map();
      for (let c = 0; c < cols;) {
        let j = c + 1;
        while (j < cols && grid[r][j] === grid[r][c]) j += 1;
        if (grid[r][c] !== base) {
          const id = `${c}:${j}:${grid[r][c]}`;
          const rect = open.get(id) || { r0: r, c0: c, c1: j, k: grid[r][c] };
          if (!open.has(id)) rects.push(rect);
          rect.r1 = r + 1;
          next.set(id, rect);
        }
        c = j;
      }
      open = next;
    }
    for (const x of rects) out.push({ repeatCell: { range: R(sheetId, x.r0, x.r1, x.c0, x.c1), cell: { userEnteredFormat: formats.get(x.k) }, fields: 'userEnteredFormat' } });
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols;) {
        const v = cellValue(this.cells.get(`${r}:${c}`)?.value);
        if (!v) { c += 1; continue; }
        const values = [];
        let j = c;
        for (let w; j < cols && (w = cellValue(this.cells.get(`${r}:${j}`)?.value)); j += 1) values.push({ userEnteredValue: w });
        out.push({ updateCells: { start: { sheetId, rowIndex: r, columnIndex: c }, rows: [{ values }], fields: 'userEnteredValue' } });
        c = j;
      }
    }
    return [...out, ...this.extra];
  }
}

// One request per run of equal sizes.
function sizes(sheetId, dimension, list) {
  const out = [];
  for (let i = 0; i < list.length;) {
    let j = i + 1;
    while (j < list.length && list[j] === list[i]) j += 1;
    out.push({ updateDimensionProperties: { range: { sheetId, dimension, startIndex: i, endIndex: j }, properties: { pixelSize: list[i] }, fields: 'pixelSize' } });
    i = j;
  }
  return out;
}

// Google rejects an empty textFormat in a rule ("only supports bold, italic,
// strikethrough, foreground color and background color"), so leave it out.
function cf(ranges, formula, st) {
  const text = { ...(st.fg ? { foregroundColorStyle: color(st.fg) } : {}), ...(st.bold ? { bold: true } : {}) };
  return {
    addConditionalFormatRule: {
      index: 0,
      rule: {
        ranges,
        booleanRule: {
          condition: { type: 'CUSTOM_FORMULA', values: [{ userEnteredValue: formula }] },
          format: {
            ...(st.bg ? { backgroundColorStyle: color(st.bg) } : {}),
            ...(Object.keys(text).length ? { textFormat: text } : {}),
          },
        },
      },
    },
  };
}

/* ── shared pieces ─────────────────────────────────────────────────────── */

// Header band: brand, page title and (where there is room) the sync status
// line. Spans are [startColumn, endColumn) on that tab's grid.
function band(cv, title, { brand, head, status, statusCell = '' }) {
  cv.fill(0, 1, 0, cv.cols, { bg: C.ink });
  cv.set(0, brand[0], 'SMELLOFF', { bg: C.ink, fg: C.lime, font: DISPLAY, size: 18, bold: true });
  cv.set(0, head[0], title, { bg: C.ink, fg: C.ice, font: DISPLAY, size: 13, bold: true });
  if (brand[1] - brand[0] > 1) cv.merge(0, 1, brand[0], brand[1]);
  if (head[1] - head[0] > 1) cv.merge(0, 1, head[0], head[1]);
  if (status) {
    cv.set(0, status[0], statusCell, { bg: C.ink, fg: C.faint, size: 8, italic: true, align: 'RIGHT', wrap: 'WRAP' });
    if (status[1] - status[0] > 1) cv.merge(0, 1, status[0], status[1]);
  }
}

function section(cv, r, c0, c1, label) {
  cv.set(r, c0, label, { font: DISPLAY, size: 13, bold: true, valign: 'BOTTOM', padLeft: 0 });
  cv.merge(r, r + 1, c0, c1);
  cv.border(r, r + 1, c0, c1, ['bottom'], C.lime, 'SOLID_THICK');
}

// A card: label / big number / small line, two columns wide.
function tile(cv, r, c, { label, value, sub, number }) {
  const rows = [
    [label, { bg: C.card, fg: C.muted, size: 9, valign: 'BOTTOM', padLeft: 10 }],
    [value, { bg: C.card, font: DISPLAY, size: 22, bold: true, number, padLeft: 10 }],
    [sub, { bg: C.card, fg: C.muted, size: 9, valign: 'TOP', padLeft: 10 }],
  ];
  rows.forEach(([v, st], i) => {
    // Both cells of the row get the style, so neighbouring tiles share one
    // format rectangle.
    cv.set(r + i, c, v, st).set(r + i, c + 1, undefined, st);
    cv.merge(r + i, r + i + 1, c, c + 2);
  });
  cv.border(r, r + 3, c, c + 2, ['top', 'bottom', 'left', 'right'], C.white, 'SOLID_THICK');
}

function tableHeader(cv, r, c0, labels) {
  labels.forEach((l, i) => cv.set(r, c0 + i, l, { bold: true, size: 9, fg: C.muted, bg: C.band }));
  cv.border(r, r + 1, c0, c0 + labels.length, ['bottom'], C.line);
}

// Data rows of a formula-driven list: per-column formats, light row lines.
function tableBody(cv, r0, rows, c0, formats) {
  formats.forEach((st, i) => cv.fill(r0, r0 + rows, c0 + i, c0 + i + 1, st || {}));
  cv.border(r0, r0 + rows, c0, c0 + formats.length, ['innerHorizontal', 'bottom'], C.line);
}

const tileCf = (sheetId, r, c, formula, st) => cf([R(sheetId, r, r + 3, c, c + 2)], formula, st);
const cellRef = (r, c) => `$${columnLetter(c + 1)}$${r + 1}`;

/* ── Orders data ───────────────────────────────────────────────────────── */

const ORDER_STATUS_GREY = '^(Cancelled|Payment failed|Payment pending|Payment not verified|Verifying payment)$';
const COURIER_PROBLEM = 'exception|rto|undelivered|lost|damage|ndr|failed';

function ordersRefs(columns) {
  const letter = (h) => {
    const i = columns.findIndex((c) => c.header === h);
    if (i < 0) throw new Error(`Orders column "${h}" missing`);
    return columnLetter(i + 1);
  };
  const O = (h) => `Orders!$${letter(h)}:$${letter(h)}`;
  const sale = `ISNUMBER(MATCH(${O('Status')},SaleStatuses,0))`;
  const toShip = `ISNUMBER(MATCH(${O('Status')},ToShipStatuses,0))`;
  const onWay = `ISNUMBER(MATCH(${O('Status')},OnTheWayStatuses,0))`;
  const inPeriod = `${O('Order date')}>=PeriodStart,${O('Order date')}<PeriodEnd`;
  const periodIfs = `${O('Order date')},">="&PeriodStart,${O('Order date')},"<"&PeriodEnd`;
  return { letter, O, sale, toShip, onWay, inPeriod, periodIfs };
}

// A list that may come back empty. IFERROR would replace every cell of an
// HSTACKed error array (the message showed twice), so test the first cell.
const listOr = (expr, msg) => `=LET(r,${expr},IF(ISERROR(INDEX(r,1,1)),"${msg}",r))`;

// First name for WhatsApp messages, built inside the sheet.
const firstName = (nm) => `IF(${nm}="","there",INDEX(SPLIT(${nm}," "),1))`;
const wa = (ph, text, label) => `HYPERLINK("https://wa.me/91"&${ph}${text ? `&"?text="&ENCODEURL(${text})` : ''},"${label}")`;

function dashboard(sheetId, columns) {
  const { O, sale, toShip, onWay, inPeriod, periodIfs } = ordersRefs(columns);
  const cv = new Canvas(sheetId, 80, 10, {});
  band(cv, 'Orders dashboard', { brand: [1, 3], head: [3, 6], status: [6, 9], statusCell: 'Waiting for the first website sync.' });

  // Period picker
  cv.set(2, 1, 'Showing', { fg: C.muted, size: 10, align: 'RIGHT' });
  cv.set(2, 2, 'All time', { bg: C.lime, bold: true, align: 'CENTER', size: 11 });
  cv.set(2, 3, '=IF(Period="All time","Every order so far",TEXT(PeriodStart,"d mmm yyyy")&" to "&TEXT(PeriodEnd-1,"d mmm yyyy"))', { fg: C.muted });
  cv.merge(2, 3, 3, 9);

  const B = 1;
  const t = (k) => B + 2 * k;
  const v = (r, k) => cellRef(r + 1, t(k)); // value cell of the tile starting at row r
  const requests = [];

  section(cv, 4, 1, 9, 'Needs action now');
  const a = 5;
  tile(cv, a, t(0), { label: 'To ship', value: `=SUMPRODUCT(COUNTIF(${O('Status')},ToShipStatuses))`, sub: '=IF(' + v(a, 0) + '=0,"All shipped","New, confirmed or packed")', number: NUM.int });
  tile(cv, a, t(1), { label: 'COD to confirm', value: `=COUNTIFS(${O('Payment')},"COD",${O('Status')},"New",${O('COD call')},"")`, sub: 'See the To do tab', number: NUM.int });
  tile(cv, a, t(2), { label: 'Courier problems', value: `=SUMPRODUCT(REGEXMATCH(LOWER(${O('Courier status')}),"${COURIER_PROBLEM}")*(${toShip}+${onWay}))`, sub: 'Pickup exception, RTO, undelivered', number: NUM.int });
  tile(cv, a, t(3), { label: 'Waiting over 2 days', value: `=SUMPRODUCT(COUNTIFS(${O('Status')},ToShipStatuses,${O('Order date')},"<"&(NOW()-2)))`, sub: 'Not shipped within 48 hours', number: NUM.int });
  requests.push(
    tileCf(sheetId, a, t(0), `=${v(a, 0)}>0`, { bg: C.amber }),
    tileCf(sheetId, a, t(1), `=${v(a, 1)}>0`, { bg: C.amber }),
    tileCf(sheetId, a, t(2), `=${v(a, 2)}>0`, { bg: C.red, fg: C.redText }),
    tileCf(sheetId, a, t(3), `=${v(a, 3)}>0`, { bg: C.orange }),
  );

  section(cv, 9, 1, 9, '="Sales · "&LOWER(Period)');
  const s = 10;
  const orders = `SUMPRODUCT(COUNTIFS(${O('Status')},SaleStatuses,${periodIfs}))`;
  const sumOf = (h, extra = sale) => `SUM(IFERROR(FILTER(${O(h)},${extra},${inPeriod}),0))`;
  tile(cv, s, t(0), { label: 'Orders', value: `=${orders}`, sub: `=${sumOf('Bottles')}&" bottles"`, number: NUM.int });
  tile(cv, s, t(1), { label: 'Order value', value: `=${sumOf('Total (₹)')}`, sub: `="₹"&TEXT(${sumOf('Total (₹)', `${O('Status')}="Delivered"`)},"#,##0")&" delivered"`, number: NUM.money });
  tile(cv, s, t(2), { label: 'Average order', value: `=IF(${v(s, 0)}=0,0,${v(s, 1)}/${v(s, 0)})`, sub: 'Order value ÷ orders', number: NUM.money });
  tile(cv, s, t(3), { label: 'Customers', value: `=IFERROR(ROWS(UNIQUE(FILTER(${O('Phone')},${sale},${inPeriod}))),0)`, sub: 'Different phone numbers', number: NUM.int });

  const p = 14;
  const notDone = `SUMPRODUCT(COUNTIFS(${O('Status')},{"Payment pending","Payment failed"},${periodIfs}))`;
  tile(cv, p, t(0), { label: 'Delivered', value: `=COUNTIFS(${O('Status')},"Delivered",${periodIfs})`, sub: `=IFERROR("Avg "&TEXT(AVERAGE(FILTER(${O('Delivered on')}-${O('Order date')},ISNUMBER(${O('Delivered on')}),ISNUMBER(${O('Order date')}),${inPeriod})),"0.0")&" days to arrive","No deliveries yet")`, number: NUM.int });
  tile(cv, p, t(1), { label: 'Paid on delivery (COD)', value: `=IF(${v(s, 0)}=0,0,SUMPRODUCT(COUNTIFS(${O('Status')},SaleStatuses,${O('Payment')},"COD",${periodIfs}))/${v(s, 0)})`, sub: 'Share of orders', number: NUM.pct });
  tile(cv, p, t(2), { label: 'Checkout completion', value: `=IF(${v(s, 0)}+${notDone}=0,0,${v(s, 0)}/(${v(s, 0)}+${notDone}))`, sub: `=${notDone}&" checkouts not finished"`, number: NUM.pct });
  tile(cv, p, t(3), { label: 'Cancelled', value: `=COUNTIFS(${O('Status')},"Cancelled",${periodIfs})`, sub: 'Orders cancelled', number: NUM.int });

  section(cv, 18, 1, 9, 'Stock and reviews');
  const k = 19;
  const shipped = `SUM(IFERROR(FILTER(${O('Bottles')},${onWay}+(${O('Status')}="Delivered")),0))`;
  const waiting = `SUM(IFERROR(FILTER(${O('Bottles')},${toShip}),0))`;
  tile(cv, k, t(0), { label: 'Bottles left', value: `=IF(BottlesReceived="","Not set",BottlesReceived-${shipped}-${waiting})`, sub: `=IF(BottlesReceived="","Type your stock in Settings","After "&${waiting}&" waiting to ship")`, number: NUM.int });
  tile(cv, k, t(1), { label: 'Bottles shipped', value: `=${shipped}`, sub: 'All time', number: NUM.int });
  tile(cv, k, t(2), { label: 'Reviews to ask for', value: `=COUNTIFS(${O('Status')},"Delivered",${O('Review (stars)')},"")`, sub: 'Delivered, no review yet', number: NUM.int });
  tile(cv, k, t(3), { label: 'Average review', value: `=IFERROR(AVERAGE(FILTER(${O('Review (stars)')},ISNUMBER(${O('Review (stars)')}))),"None yet")`, sub: `=COUNT(${O('Review (stars)')})&" reviews"`, number: NUM.dec1 });
  requests.push(
    tileCf(sheetId, k, t(0), `=AND(ISNUMBER(${v(k, 0)}),${v(k, 0)}<LowStockAt)`, { bg: C.red, fg: C.redText }),
    tileCf(sheetId, k, t(2), `=${v(k, 2)}>0`, { bg: C.amber }),
  );

  section(cv, 23, 1, 9, 'Orders and order value, last 12 months');
  // rows 24-37 hold the chart (anchored below)

  const m0 = 39; // header row of the month table
  tableHeader(cv, m0, 1, ['Month', 'Orders', 'Bottles', 'Order value (₹)', 'Average order (₹)', 'COD orders', 'Prepaid orders', 'Cancelled']);
  // One MAP per column over the twelve months in column B.
  const months = `$B$${m0 + 2}:$B$${m0 + 13}`;
  const col = (letter) => `$${letter}$${m0 + 2}:$${letter}$${m0 + 13}`;
  const inMonth = `${O('Order date')}>=m,${O('Order date')}<EDATE(m,1)`;
  const ifsMonth = `${O('Order date')},">="&m,${O('Order date')},"<"&EDATE(m,1)`;
  const perMonth = (body) => `=MAP(${months},LAMBDA(m,${body}))`;
  const r1 = m0 + 1;
  cv.set(r1, 1, '=MAP(SEQUENCE(12,1,-11,1),LAMBDA(k,EDATE(EOMONTH(TODAY(),-1)+1,k)))');
  cv.set(r1, 2, perMonth(`SUMPRODUCT(COUNTIFS(${O('Status')},SaleStatuses,${ifsMonth}))`));
  cv.set(r1, 3, perMonth(`SUM(IFERROR(FILTER(${O('Bottles')},${sale},${inMonth}),0))`));
  cv.set(r1, 4, perMonth(`SUM(IFERROR(FILTER(${O('Total (₹)')},${sale},${inMonth}),0))`));
  cv.set(r1, 5, `=MAP(${col('C')},${col('E')},LAMBDA(n,v,IF(n=0,0,v/n)))`);
  cv.set(r1, 6, perMonth(`SUMPRODUCT(COUNTIFS(${O('Status')},SaleStatuses,${O('Payment')},"COD",${ifsMonth}))`));
  cv.set(r1, 7, perMonth(`SUMPRODUCT(COUNTIFS(${O('Status')},SaleStatuses,${O('Payment')},"Prepaid",${ifsMonth}))`));
  cv.set(r1, 8, perMonth(`COUNTIFS(${O('Status')},"Cancelled",${ifsMonth})`));
  tableBody(cv, m0 + 1, 12, 1, [{ number: NUM.month }, { number: NUM.int, align: 'CENTER' }, { number: NUM.int, align: 'CENTER' },
    { number: NUM.money }, { number: NUM.money }, { number: NUM.int, align: 'CENTER' }, { number: NUM.int, align: 'CENTER' }, { number: NUM.int, align: 'CENTER' }]);

  section(cv, 53, 1, 9, '="Where sales come from · "&LOWER(Period)');
  const L = ordersRefs(columns).letter;
  const [st, dt, id] = [L('Status'), L('Order date'), L('Order ID')];
  const q = (select, rest) => `=IFERROR(QUERY(Orders!A:${columnLetter(columns.length)},"select ${select} where ${st} matches '"&TEXTJOIN("|",TRUE,SaleStatuses)&"' and ${dt} >= datetime '"&TEXT(PeriodStart,"yyyy-mm-dd HH:mm:ss")&"' and ${dt} < datetime '"&TEXT(PeriodEnd,"yyyy-mm-dd HH:mm:ss")&"' group by ${rest}",1),"No sales in this period")`;
  cv.set(54, 1, q(`${L('State')}, count(${id}), sum(${L('Total (₹)')})`, `${L('State')} order by count(${id}) desc label ${L('State')} 'State', count(${id}) 'Orders', sum(${L('Total (₹)')}) 'Value (₹)'`));
  cv.set(54, 5, q(`${L('Source')}, count(${id})`, `${L('Source')} order by count(${id}) desc label ${L('Source')} 'Source (blank = not recorded)', count(${id}) 'Orders'`));
  cv.fill(54, 55, 1, 4, { bold: true, size: 9, fg: C.muted, bg: C.band });
  cv.fill(54, 55, 5, 7, { bold: true, size: 9, fg: C.muted, bg: C.band });
  cv.fill(55, 80, 3, 4, { number: NUM.money });
  cv.fill(55, 80, 2, 3, { number: NUM.int, align: 'CENTER' });
  cv.fill(55, 80, 6, 7, { number: NUM.int, align: 'CENTER' });

  const rowPx = Array(80).fill(21);
  rowPx[0] = 56; rowPx[1] = 10; rowPx[2] = 30; rowPx[3] = 8;
  for (const r of [4, 9, 18, 23, 38, 53]) rowPx[r] = 34;
  for (const r0 of [a, s, p, k]) { rowPx[r0] = 22; rowPx[r0 + 1] = 40; rowPx[r0 + 2] = 22; }
  rowPx[8] = 16; rowPx[13] = 6; rowPx[17] = 16; rowPx[22] = 16;

  const chart = {
    addChart: { chart: {
      spec: {
        fontName: BODY,
        backgroundColorStyle: color(C.white),
        basicChart: {
          chartType: 'COMBO', legendPosition: 'TOP_LEGEND', headerCount: 1,
          axis: [{ position: 'BOTTOM_AXIS' }, { position: 'LEFT_AXIS', title: 'Orders' }, { position: 'RIGHT_AXIS', title: 'Order value (₹)' }],
          domains: [{ domain: { sourceRange: { sources: [R(sheetId, m0, m0 + 13, 1, 2)] } } }],
          series: [
            { series: { sourceRange: { sources: [R(sheetId, m0, m0 + 13, 2, 3)] } }, targetAxis: 'LEFT_AXIS', type: 'COLUMN', colorStyle: color(C.ink) },
            { series: { sourceRange: { sources: [R(sheetId, m0, m0 + 13, 4, 5)] } }, targetAxis: 'RIGHT_AXIS', type: 'LINE', colorStyle: color(C.limeDark), lineStyle: { width: 3 } },
          ],
        },
      },
      position: { overlayPosition: { anchorCell: { sheetId, rowIndex: 24, columnIndex: 1 }, offsetXPixels: 0, offsetYPixels: 4, widthPixels: 920, heightPixels: 290 } },
    } },
  };

  return {
    requests: [...cv.requests(), ...requests, ...sizes(sheetId, 'ROWS', rowPx), ...sizes(sheetId, 'COLUMNS', [24, 115, 115, 115, 115, 115, 115, 115, 115, 24]), chart,
      { setDataValidation: { range: R(sheetId, 2, 3, 2, 3), rule: { condition: { type: 'ONE_OF_LIST', values: PERIODS.map((x) => ({ userEnteredValue: x })) }, strict: true, showCustomUi: true, inputMessage: 'Pick the period for the sales numbers' } } }],
    named: { Period: R(sheetId, 2, 3, 2, 3), SyncStatus: R(sheetId, 0, 1, 6, 7) },
    inputs: [R(sheetId, 2, 3, 2, 3)],
    grid: { rows: 80, cols: 10, frozen: 1 },
  };
}

function todo(sheetId, columns) {
  const { O, toShip, onWay } = ordersRefs(columns);
  const rows = 150;
  const cv = new Canvas(sheetId, rows, 10, {});
  band(cv, 'To do', { brand: [1, 2], head: [2, 5], status: [5, 9], statusCell: '=SyncStatus' });
  cv.set(2, 1, 'Work through these from the top. The lists update after every order and every 15 minutes. Tap a link to open WhatsApp with the message ready.', { fg: C.muted, wrap: 'WRAP' });
  cv.merge(2, 3, 1, 9);

  let r = 4;
  const block = ({ title, sub, headers, formula, cap, formats }) => {
    section(cv, r, 1, 9, title);
    cv.set(r + 1, 1, sub, { fg: C.muted, size: 9 }); cv.merge(r + 1, r + 2, 1, 9);
    tableHeader(cv, r + 2, 1, headers);
    cv.set(r + 3, 1, formula);
    tableBody(cv, r + 3, cap, 1, formats);
    r += 3 + cap + 1;
  };
  const name = (nm) => firstName(nm);
  const fId = { bold: true }; const fTxt = { number: NUM.text }; const fMoney = { number: NUM.money };
  const fWhen = { number: NUM.datetime }; const fDay = { number: NUM.date }; const fLink = { align: 'CENTER', bold: true, fg: C.limeDark };

  const codCount = `COUNTIFS(${O('Payment')},"COD",${O('Status')},"New",${O('COD call')},"")`;
  block({
    title: `="Confirm these COD orders before shipping ("&${codCount}&")"`,
    sub: 'Message or call each buyer, then pick the result in the COD call column on the Orders tab. Confirming first cuts returned parcels.',
    headers: ['Order ID', 'Name', 'Phone', 'Total (₹)', 'City', 'Ordered', 'WhatsApp'],
    cap: 15, formats: [fId, {}, fTxt, fMoney, {}, fWhen, fLink],
    formula: listOr(`ARRAY_CONSTRAIN(LET(f,SORT(FILTER({${O('Order ID')},${O('Name')},${O('Phone')},${O('Total (₹)')},${O('City')},${O('Order date')}},${O('Payment')}="COD",${O('Status')}="New",${O('COD call')}=""),6,TRUE),HSTACK(f,MAP(INDEX(f,,1),INDEX(f,,2),INDEX(f,,3),INDEX(f,,4),INDEX(f,,5),LAMBDA(id,nm,ph,tot,ct,${wa('ph', `"Hi "&${name('nm')}&", this is Smelloff. Please confirm your Cash on Delivery order "&id&" for ₹"&tot&", delivering to "&ct&". Reply YES to confirm or NO to cancel."`, 'Confirm on WhatsApp')})))),15,7)`, 'Nothing to confirm'),
  });
  block({
    title: `="Ship these orders, oldest first ("&SUMPRODUCT(COUNTIF(${O('Status')},ToShipStatuses))&")"`,
    sub: 'New, confirmed or packed orders that have not left yet. Orange on the Orders tab means waiting more than 2 days.',
    headers: ['Order ID', 'Ordered', 'Name', 'Phone', 'Payment', 'City', 'Status', 'Courier status'],
    cap: 20, formats: [fId, fWhen, {}, fTxt, { align: 'CENTER' }, {}, { bold: true }, {}],
    formula: `=IFERROR(ARRAY_CONSTRAIN(SORT(FILTER({${O('Order ID')},${O('Order date')},${O('Name')},${O('Phone')},${O('Payment')},${O('City')},${O('Status')},${O('Courier status')}},${toShip}),2,TRUE),20,8),"Nothing waiting to ship")`,
  });
  const problem = `REGEXMATCH(LOWER(${O('Courier status')}),"${COURIER_PROBLEM}")`;
  block({
    title: `="Sort out with the courier ("&SUMPRODUCT(${problem}*(${toShip}+${onWay}))&")"`,
    sub: 'Open orders where Shiprocket reports a problem. Check the parcel in Shiprocket and call the buyer if the address or phone is the issue.',
    headers: ['Order ID', 'Name', 'Phone', 'Courier', 'AWB', 'Courier status', 'Tracking'],
    cap: 10, formats: [fId, {}, fTxt, {}, fTxt, { bold: true, fg: C.redText }, fLink],
    formula: listOr(`ARRAY_CONSTRAIN(LET(f,FILTER({${O('Order ID')},${O('Name')},${O('Phone')},${O('Courier')},${O('AWB')},${O('Courier status')}},${problem},${toShip}+${onWay}),HSTACK(f,MAP(INDEX(f,,5),LAMBDA(awb,IF(awb="","",HYPERLINK("https://www.shiprocket.co/tracking/"&awb,"Track")))))),10,7)`, 'No courier problems'),
  });
  block({
    title: `="Ask for a review ("&COUNTIFS(${O('Status')},"Delivered",${O('Review (stars)')},"")&")"`,
    sub: 'Delivered orders with no review yet, newest first. Reviews from real buyers are the only way to get review stars on Google.',
    headers: ['Order ID', 'Name', 'Phone', 'Delivered on', 'WhatsApp'],
    cap: 15, formats: [fId, {}, fTxt, fDay, fLink],
    formula: listOr(`ARRAY_CONSTRAIN(LET(f,SORT(FILTER({${O('Order ID')},${O('Name')},${O('Phone')},${O('Delivered on')}},${O('Status')}="Delivered",${O('Review (stars)')}=""),4,FALSE),HSTACK(f,MAP(INDEX(f,,2),INDEX(f,,3),LAMBDA(nm,ph,${wa('ph', `"Hi "&${name('nm')}&", this is Smelloff. Hope ODORSTRIKE is working well for you. Could you leave a quick review? It takes a minute: https://smelloff.in/track-order"`, 'Ask on WhatsApp')})))),15,5)`, 'No reviews to ask for'),
  });
  block({
    title: '="Checkouts that did not finish, last 30 days"',
    sub: 'Payment pending or failed. A short, helpful message often saves the order.',
    headers: ['Order ID', 'Name', 'Phone', 'Total (₹)', 'Tried on', 'What happened', 'WhatsApp'],
    cap: rows - r - 4, formats: [fId, {}, fTxt, fMoney, fWhen, {}, fLink],
    formula: listOr(`LET(f,SORT(FILTER({${O('Order ID')},${O('Name')},${O('Phone')},${O('Total (₹)')},${O('Order date')},${O('Status')}},REGEXMATCH(${O('Status')},"^(Payment pending|Payment failed)$"),${O('Order date')}>=TODAY()-30),5,FALSE),HSTACK(f,MAP(INDEX(f,,1),INDEX(f,,2),INDEX(f,,3),LAMBDA(id,nm,ph,${wa('ph', `"Hi "&${name('nm')}&", this is Smelloff. Your order "&id&" did not go through. Can we help you finish it?"`, 'Chat on WhatsApp')}))))`, 'No unfinished checkouts in the last 30 days'),
  });

  const rowPx = Array(rows).fill(24);
  rowPx[0] = 56; rowPx[1] = 10; rowPx[2] = 36; rowPx[3] = 8;
  return {
    requests: [...cv.requests(), ...sizes(sheetId, 'ROWS', rowPx), ...sizes(sheetId, 'COLUMNS', [24, 150, 165, 110, 95, 125, 140, 140, 160, 24])],
    named: {}, inputs: [], grid: { rows, cols: 10, frozen: 1 },
  };
}

function settings(sheetId) {
  const cv = new Canvas(sheetId, 24, 6, {});
  band(cv, 'Settings', { brand: [1, 2], head: [2, 5] });
  section(cv, 2, 1, 5, 'Your numbers');
  cv.set(3, 1, 'Bottles received from the factory (total so far)');
  cv.set(3, 2, '', { bg: C.input, fg: C.blueText, bold: true, align: 'CENTER', number: NUM.int, size: 11 });
  cv.set(4, 1, 'Warn when bottles left drops below');
  cv.set(4, 2, 20, { bg: C.input, fg: C.blueText, bold: true, align: 'CENTER', number: NUM.int, size: 11 });
  cv.set(5, 1, 'Change only the yellow cells. Everything else in this file is filled and kept tidy by the website.', { fg: C.muted, size: 9, wrap: 'WRAP' });
  cv.merge(5, 6, 1, 5);

  section(cv, 7, 1, 5, 'Used by the formulas');
  tableHeader(cv, 8, 1, ['Counts as a sale', 'To ship', 'On the way']);
  const lists = [['New', 'New', 'Shipped'], ['Confirmed', 'Confirmed', 'Out for delivery'], ['Packed', 'Packed', ''], ['Shipped', '', ''], ['Out for delivery', '', ''], ['Delivered', '', '']];
  lists.forEach((row, i) => row.forEach((v, j) => cv.set(9 + i, 1 + j, v, { fg: C.muted, size: 9 })));
  cv.set(16, 1, 'Period start', { fg: C.muted, size: 9 });
  cv.set(16, 2, '=SWITCH(Period,"Last 7 days",TODAY()-6,"Last 30 days",TODAY()-29,"This month",EOMONTH(TODAY(),-1)+1,"Last month",EOMONTH(TODAY(),-2)+1,"This year",DATE(YEAR(TODAY()),1,1),DATE(2000,1,1))', { fg: C.muted, size: 9, number: NUM.date });
  cv.set(17, 1, 'Period end (not included)', { fg: C.muted, size: 9 });
  cv.set(17, 2, '=IF(Period="Last month",EOMONTH(TODAY(),-1)+1,TODAY()+1)', { fg: C.muted, size: 9, number: NUM.date });
  cv.set(18, 1, 'Design version', { fg: C.muted, size: 9 });
  cv.set(18, 2, LAYOUT_VERSION, { fg: C.muted, size: 9 });

  const rowPx = Array(24).fill(24);
  rowPx[0] = 56; rowPx[1] = 10; rowPx[2] = 34; rowPx[3] = 30; rowPx[4] = 30; rowPx[7] = 34;
  return {
    requests: [...cv.requests(), ...sizes(sheetId, 'ROWS', rowPx), ...sizes(sheetId, 'COLUMNS', [24, 380, 150, 150, 150, 24])],
    named: {
      BottlesReceived: R(sheetId, 3, 4, 2, 3), LowStockAt: R(sheetId, 4, 5, 2, 3),
      SaleStatuses: R(sheetId, 9, 15, 1, 2), ToShipStatuses: R(sheetId, 9, 12, 2, 3), OnTheWayStatuses: R(sheetId, 9, 11, 3, 4),
      PeriodStart: R(sheetId, 16, 17, 2, 3), PeriodEnd: R(sheetId, 17, 18, 2, 3),
    },
    inputs: [R(sheetId, 3, 5, 2, 3)],
    grid: { rows: 24, cols: 6, frozen: 1 },
  };
}

/* ── Customers & Emails ────────────────────────────────────────────────── */

function contactsRefs(columns) {
  const letter = (h) => {
    const i = columns.findIndex((c) => c.header === h);
    if (i < 0) throw new Error(`Contacts column "${h}" missing`);
    return columnLetter(i + 1);
  };
  return (h) => `Contacts!$${letter(h)}:$${letter(h)}`;
}

const VALID_EMAIL = '"^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$"';

function summary(sheetId, columns) {
  const K = contactsRefs(columns);
  const cv = new Canvas(sheetId, 26, 10, {});
  band(cv, 'Customers & emails', { brand: [1, 3], head: [3, 6], status: [6, 9], statusCell: 'Waiting for the first website sync.' });
  cv.set(2, 1, 'Every buyer, newsletter signup and contact-form message, one row per person on the Contacts tab. The Follow up tab lists who to message.', { fg: C.muted, wrap: 'WRAP' });
  cv.merge(2, 3, 1, 9);
  const t = (k) => 1 + 2 * k;
  const v = (r, k) => cellRef(r + 1, t(k));

  section(cv, 4, 1, 9, 'People');
  tile(cv, 5, t(0), { label: 'In the list', value: `=SUMPRODUCT(COUNTIF(${K('Type')},{"Customer","Tried to order","Subscriber","Enquiry"}))`, sub: 'Buyers, subscribers, enquiries', number: NUM.int });
  tile(cv, 5, t(1), { label: 'Customers', value: `=COUNTIF(${K('Type')},"Customer")`, sub: 'At least one real order', number: NUM.int });
  tile(cv, 5, t(2), { label: 'Repeat customers', value: `=COUNTIF(${K('Paid orders')},">1")`, sub: `=IF(${v(5, 1)}=0,"No customers yet",TEXT(${v(5, 2)}/${v(5, 1)},"0%")&" of customers")`, number: NUM.int });
  tile(cv, 5, t(3), { label: 'Tried to order', value: `=COUNTIF(${K('Type')},"Tried to order")`, sub: 'See Follow up', number: NUM.int });
  tile(cv, 9, t(0), { label: 'Subscribers', value: `=COUNTIF(${K('Type')},"Subscriber")`, sub: 'Signed up, no order yet', number: NUM.int });
  tile(cv, 9, t(1), { label: 'Can get offer emails', value: `=IFERROR(ROWS(FILTER(${K('Email')},${K('Email offers')}="Yes",REGEXMATCH(${K('Email')},${VALID_EMAIL}))),0)`, sub: 'Opted in, valid address', number: NUM.int });
  tile(cv, 9, t(2), { label: 'Order value', value: `=SUM(${K('Order value (₹)')})`, sub: 'From all customers', number: NUM.money });
  tile(cv, 9, t(3), { label: 'Average per customer', value: `=IF(${v(5, 1)}=0,0,${v(9, 2)}/${v(5, 1)})`, sub: 'Order value ÷ customers', number: NUM.money });

  section(cv, 13, 1, 9, 'Offer email list');
  cv.set(14, 1, 'People who opted in, ready to paste into BCC or Resend. Mistyped addresses are left out.', { fg: C.muted, size: 9 });
  cv.merge(14, 15, 1, 9);
  cv.set(15, 1, `=IFERROR(TEXTJOIN(", ",TRUE,FILTER(${K('Email')},${K('Email offers')}="Yes",REGEXMATCH(${K('Email')},${VALID_EMAIL}))),"Nobody has opted in yet")`, { bg: C.card, wrap: 'WRAP', valign: 'TOP', size: 9 });
  cv.merge(15, 16, 1, 9);

  const rowPx = Array(26).fill(21);
  rowPx[0] = 56; rowPx[1] = 10; rowPx[2] = 36; rowPx[3] = 8; rowPx[4] = 34; rowPx[13] = 34; rowPx[15] = 170;
  for (const r0 of [5, 9]) { rowPx[r0] = 22; rowPx[r0 + 1] = 40; rowPx[r0 + 2] = 22; }
  rowPx[8] = 6; rowPx[12] = 16;
  return {
    requests: [...cv.requests(), ...sizes(sheetId, 'ROWS', rowPx), ...sizes(sheetId, 'COLUMNS', [24, 115, 115, 115, 115, 115, 115, 115, 115, 24]),
      tileCf(sheetId, 5, t(3), `=${v(5, 3)}>0`, { bg: C.amber })],
    named: { SyncStatus: R(sheetId, 0, 1, 6, 7) },
    inputs: [], grid: { rows: 26, cols: 10, frozen: 1 },
  };
}

function followUp(sheetId, columns) {
  const K = contactsRefs(columns);
  const rows = 70;
  const cv = new Canvas(sheetId, rows, 9, {});
  band(cv, 'Follow up', { brand: [1, 2], head: [2, 4], status: [4, 8], statusCell: '=SyncStatus' });
  let r = 2;
  const block = ({ title, sub, headers, formula, cap, formats }) => {
    section(cv, r, 1, 8, title);
    cv.set(r + 1, 1, sub, { fg: C.muted, size: 9 }); cv.merge(r + 1, r + 2, 1, 8);
    tableHeader(cv, r + 2, 1, headers);
    cv.set(r + 3, 1, formula);
    tableBody(cv, r + 3, cap, 1, formats);
    r += 3 + cap + 1;
  };
  const fTxt = { number: NUM.text }; const fDay = { number: NUM.date }; const fLink = { align: 'CENTER', bold: true, fg: C.limeDark };
  block({
    title: `="Started an order but did not finish ("&COUNTIF(${K('Type')},"Tried to order")&")"`,
    sub: 'Newest first. Ask if something went wrong; a working phone number and a short message often bring the order back.',
    headers: ['Name', 'Phone', 'Email', 'Last try', 'What happened', 'WhatsApp'],
    cap: 20, formats: [{ bold: true }, fTxt, {}, fDay, {}, fLink],
    formula: listOr(`ARRAY_CONSTRAIN(LET(f,SORT(FILTER({${K('Name')},${K('Phone')},${K('Email')},${K('Last order')},${K('Last order status')}},${K('Type')}="Tried to order"),4,FALSE),HSTACK(f,MAP(INDEX(f,,1),INDEX(f,,2),LAMBDA(nm,ph,IF(ph="","",${wa('ph', `"Hi "&${firstName('nm')}&", this is Smelloff. We saw your ODORSTRIKE order did not go through. Can we help you finish it?"`, 'Chat on WhatsApp')}))))),20,6)`, 'Nobody to follow up'),
  });
  block({
    title: '="Top customers"',
    sub: 'By order value. Thank them, ask for a review, or offer the pack of 5.',
    headers: ['Name', 'Phone', 'Email', 'Last order', 'Paid orders', 'Order value (₹)', 'WhatsApp'],
    cap: rows - r - 4, formats: [{ bold: true }, fTxt, {}, fDay, { align: 'CENTER' }, { number: NUM.money }, fLink],
    formula: listOr(`ARRAY_CONSTRAIN(LET(f,SORT(FILTER({${K('Name')},${K('Phone')},${K('Email')},${K('Last order')},${K('Paid orders')},${K('Order value (₹)')}},${K('Type')}="Customer"),6,FALSE),HSTACK(f,MAP(INDEX(f,,2),LAMBDA(ph,IF(ph="","",${wa('ph', '', 'Chat')}))))),25,7)`, 'No customers yet'),
  });
  const rowPx = Array(rows).fill(24);
  rowPx[0] = 56; rowPx[1] = 10;
  return {
    requests: [...cv.requests(), ...sizes(sheetId, 'ROWS', rowPx), ...sizes(sheetId, 'COLUMNS', [24, 170, 110, 240, 105, 140, 120, 150, 24])],
    named: {}, inputs: [], grid: { rows, cols: 9, frozen: 1 },
  };
}

/* ── data tabs (Orders, Contacts) ──────────────────────────────────────── */

const TYPE_STYLE = {
  datetime: { number: NUM.datetime },
  date: { number: NUM.date },
  money: { number: NUM.money, align: 'RIGHT' },
  int: { number: NUM.int, align: 'CENTER' },
  text: { number: NUM.text },
  center: { align: 'CENTER' },
  chip: { align: 'CENTER', bold: true },
  link: { align: 'CENTER', bold: true },
  id: { bold: true },
  long: {},
  plain: {},
  choice: { bg: C.owner },
  note: { bg: C.owner, wrap: 'WRAP' },
};

function dataTab(sheetId, rowCount, columns, kind) {
  const n = columns.length;
  const firstOwner = columns.findIndex((c) => c.kind === 'owner');
  const synced = firstOwner < 0 ? n : firstOwner;
  const L = (h) => columnLetter(columns.findIndex((c) => c.header === h) + 1);
  const col = (h) => columns.findIndex((c) => c.header === h);
  const req = [];
  // Body and header formats, one repeatCell per run of equal columns.
  const runs = (r0, r1, styleOf) => {
    for (let i = 0; i < n;) {
      const f = cellFormat(styleOf(columns[i]));
      const k = JSON.stringify(f);
      let j = i + 1;
      while (j < n && JSON.stringify(cellFormat(styleOf(columns[j]))) === k) j += 1;
      req.push({ repeatCell: { range: R(sheetId, r0, r1, i, j), cell: { userEnteredFormat: f }, fields: 'userEnteredFormat' } });
      i = j;
    }
  };
  runs(1, rowCount, (c) => TYPE_STYLE[c.type] || {});
  runs(0, 1, (c) => (c.kind === 'owner'
    ? { bg: C.lime, fg: C.ink, bold: true, wrap: 'WRAP' }
    : { bg: C.ink, fg: C.ice, bold: true, wrap: 'WRAP' }));
  req.push(...sizes(sheetId, 'COLUMNS', columns.map((c) => c.width || 120)));
  req.push({ updateDimensionProperties: { range: { sheetId, dimension: 'ROWS', startIndex: 0, endIndex: 1 }, properties: { pixelSize: 40 }, fields: 'pixelSize' } });
  req.push({ updateDimensionProperties: { range: { sheetId, dimension: 'ROWS', startIndex: 1, endIndex: rowCount }, properties: { pixelSize: 28 }, fields: 'pixelSize' } });
  // Every range starts at row 0: new orders are inserted at row 2, and a range
  // starting at row 2 would be pushed below them instead of growing.
  req.push({ addBanding: { bandedRange: { range: R(sheetId, 0, rowCount, 0, synced), rowProperties: { headerColorStyle: color(C.ink), firstBandColorStyle: color(C.white), secondBandColorStyle: color(C.band) } } } });

  const all = [R(sheetId, 0, rowCount, 0, n)];
  const at = (h) => [R(sheetId, 0, rowCount, col(h), col(h) + 1)];
  if (kind === 'orders') {
    const S = `$${L('Status')}1`;
    req.push(
      cf(all, `=REGEXMATCH(${S},"${ORDER_STATUS_GREY}")`, { fg: C.greyText }),
      cf(at('Status'), `=${S}="Delivered"`, { bg: C.green, fg: C.greenText, bold: true }),
      cf(at('Status'), `=OR(${S}="Shipped",${S}="Out for delivery")`, { bg: C.blue, fg: C.blueText, bold: true }),
      cf(at('Status'), `=OR(${S}="New",${S}="Confirmed",${S}="Packed")`, { bg: C.amber, fg: C.amberText, bold: true }),
      cf(at('Status'), `=OR(${S}="Cancelled",${S}="Payment failed")`, { bg: C.grey, fg: C.greyText, bold: true }),
      cf(at('Order date'), `=AND(REGEXMATCH(${S},"^(New|Confirmed|Packed)$"),$${L('Order date')}1<NOW()-2)`, { bg: C.orange, bold: true }),
      cf(at('Courier status'), `=REGEXMATCH(LOWER($${L('Courier status')}1),"${COURIER_PROBLEM}")`, { bg: C.red, fg: C.redText, bold: true }),
      cf(at('COD call'), `=AND($${L('Payment')}1="COD",${S}="New",$${L('COD call')}1="")`, { bg: C.input }),
      cf(at('Review (stars)'), `=AND(ISNUMBER($${L('Review (stars)')}1),$${L('Review (stars)')}1>=4)`, { fg: C.greenText, bold: true }),
    );
  } else {
    const T = `$${L('Type')}1`;
    req.push(
      cf(at('Type'), `=${T}="Customer"`, { bg: C.green, fg: C.greenText, bold: true }),
      cf(at('Type'), `=${T}="Tried to order"`, { bg: C.amber, fg: C.amberText, bold: true }),
      cf(at('Type'), `=${T}="Subscriber"`, { bg: C.blue, fg: C.blueText, bold: true }),
      cf(at('Email offers'), `=$${L('Email offers')}1="Yes"`, { fg: C.greenText, bold: true }),
      cf(at('Email offers'), `=$${L('Email offers')}1="No"`, { fg: C.greyText }),
      cf(at('Paid orders'), `=AND(ISNUMBER($${L('Paid orders')}1),$${L('Paid orders')}1>1)`, { bg: C.lime, bold: true }),
    );
  }
  columns.forEach((c, i) => {
    if (c.type === 'choice') {
      req.push({ setDataValidation: { range: R(sheetId, 1, rowCount, i, i + 1), rule: { condition: { type: 'ONE_OF_LIST', values: c.choices.map((x) => ({ userEnteredValue: x })) }, strict: false, showCustomUi: true } } });
    }
  });
  req.push({ setBasicFilter: { filter: { range: R(sheetId, 0, rowCount, 0, n) } } });
  req.push({ addProtectedRange: { protectedRange: { range: R(sheetId, 0, rowCount, 0, synced), description: 'Smelloff: filled by the website', warningOnly: true } } });

  const intro = kind === 'orders'
    ? 'Filled by the website from the order database: new orders appear at the top within seconds, status, courier and dates refresh every 15 minutes. The black columns are overwritten; the lime ones (COD call, Notes) are yours. Test orders and checkouts from the business number are left out.'
    : 'Filled by the website: every buyer, newsletter signup and contact-form message, one row per person (by email, or phone when there is no email). Rows it does not know, like the April 2026 waitlist, are never changed. The lime column is yours.';
  req.push({ updateCells: { start: { sheetId, rowIndex: 0, columnIndex: 0 }, rows: [{ values: columns.map((c, i) => ({ note: i === 0 ? intro : c.note || '' })) }], fields: 'note' } });
  return req;
}

/* ── books ─────────────────────────────────────────────────────────────── */

export const BOOKS = {
  orders: {
    dataTab: 'Orders', kind: 'orders', columns: ORDER_COLUMNS,
    tabs: [
      { title: 'Dashboard', id: 1001, build: (id) => dashboard(id, ORDER_COLUMNS), color: C.lime },
      { title: 'To do', id: 1003, build: (id) => todo(id, ORDER_COLUMNS), color: C.lime },
      { title: 'Orders', id: 1002, data: true, color: C.ink },
      { title: 'Settings', id: 1004, build: (id) => settings(id), color: C.faint },
    ],
    // The owner's inputs survive a rebuild. `legacy` is where the hand-built
    // design of 18 Oct 2026 kept them, before they had names.
    inputs: {
      Period: { legacy: "'Dashboard'!B5", valid: (v) => PERIODS.includes(v) },
      BottlesReceived: { legacy: "'Dashboard'!B30", valid: Number.isFinite },
      LowStockAt: { valid: Number.isFinite },
    },
  },
  contacts: {
    dataTab: 'Contacts', kind: 'contacts', columns: CONTACT_COLUMNS,
    tabs: [
      { title: 'Summary', id: 2001, build: (id) => summary(id, CONTACT_COLUMNS), color: C.lime },
      { title: 'Follow up', id: 2003, build: (id) => followUp(id, CONTACT_COLUMNS), color: C.lime },
      { title: 'Contacts', id: 2002, data: true, color: C.ink },
    ],
    inputs: {},
  },
};

const OUR_NAMES = ['Period', 'SyncStatus', 'BottlesReceived', 'LowStockAt', 'SaleStatuses', 'ToShipStatuses', 'OnTheWayStatuses', 'PeriodStart', 'PeriodEnd'];

export function stampOf(meta) {
  return (meta.developerMetadata || []).find((m) => m.metadataKey === STAMP_KEY) || null;
}

// Pure: from the spreadsheet's current state to the requests that bring it to
// LAYOUT_VERSION. `header` is the data tab's row 1; `inputs` the owner's
// current values by named range.
export function planLayout(book, meta, { header = [], inputs = {} } = {}) {
  const sheets = new Map((meta.sheets || []).map((s) => [s.properties.title, s]));
  // Google may leave out a sheetId of 0 (the first tab of a new file).
  const idOf = (s) => s.properties.sheetId ?? 0;
  const usedIds = new Set((meta.sheets || []).map(idOf));
  const req = [];
  const ids = {};

  // 1. Tabs exist, in order, coloured.
  book.tabs.forEach((tab, index) => {
    const found = sheets.get(tab.title);
    let id = found ? idOf(found) : undefined;
    if (id === undefined) {
      id = tab.id;
      while (usedIds.has(id)) id += 100;
      usedIds.add(id);
      req.push({ addSheet: { properties: { sheetId: id, title: tab.title, index } } });
    }
    ids[tab.title] = id;
    req.push({ updateSheetProperties: { properties: { sheetId: id, index, hidden: false, tabColorStyle: color(tab.color) }, fields: 'index,hidden,tabColorStyle' } });
  });

  // 2. Clear what we own: generated tabs entirely, data tabs' rules only.
  for (const tab of book.tabs) {
    const s = sheets.get(tab.title);
    if (!s) continue;
    const id = ids[tab.title];
    const grid = s.properties.gridProperties || {};
    for (let i = 0; i < (s.conditionalFormats || []).length; i += 1) req.push({ deleteConditionalFormatRule: { sheetId: id, index: 0 } });
    for (const b of s.bandedRanges || []) req.push({ deleteBanding: { bandedRangeId: b.bandedRangeId } });
    for (const p of s.protectedRanges || []) {
      if (!tab.data || /website|^Smelloff/i.test(p.description || '')) req.push({ deleteProtectedRange: { protectedRangeId: p.protectedRangeId } });
    }
    if (!tab.data) {
      for (const c of s.charts || []) req.push({ deleteEmbeddedObject: { objectId: c.chartId } });
      req.push({ unmergeCells: { range: R(id, 0, grid.rowCount || 1000, 0, grid.columnCount || 26) } });
      req.push({ updateCells: { range: R(id, 0, grid.rowCount || 1000, 0, grid.columnCount || 26), fields: 'userEnteredValue,userEnteredFormat,note,dataValidation' } });
    }
  }
  for (const nr of meta.namedRanges || []) {
    if (OUR_NAMES.includes(nr.name)) req.push({ deleteNamedRange: { namedRangeId: nr.namedRangeId } });
  }

  // 3. Data tab: add missing columns where they belong, write the header.
  const dataTitle = book.dataTab;
  const dataId = ids[dataTitle];
  const dataSheet = sheets.get(dataTitle);
  let rowCount = dataSheet?.properties.gridProperties?.rowCount || 1000;
  const have = header.map((h) => String(h ?? '').trim());
  if (!dataSheet) req.push({ updateSheetProperties: { properties: { sheetId: dataId, gridProperties: { rowCount, columnCount: book.columns.length } }, fields: 'gridProperties.rowCount,gridProperties.columnCount' } });
  let columnCount = dataSheet?.properties.gridProperties?.columnCount || 26;
  if (have.some(Boolean)) {
    book.columns.forEach((c, i) => {
      if (have[i] === c.header) return;
      if (have.includes(c.header)) throw new Error(`Column "${c.header}" is out of place in ${dataTitle} (column ${have.indexOf(c.header) + 1}, expected ${i + 1}). Move it back; nothing was changed.`);
      req.push({ insertDimension: { range: { sheetId: dataId, dimension: 'COLUMNS', startIndex: i, endIndex: i + 1 }, inheritFromBefore: i > 0 } });
      have.splice(i, 0, c.header);
      columnCount += 1;
    });
  }
  if (dataSheet && columnCount < book.columns.length) {
    req.push({ appendDimension: { sheetId: dataId, dimension: 'COLUMNS', length: book.columns.length - columnCount } });
  }
  req.push({ updateCells: { start: { sheetId: dataId, rowIndex: 0, columnIndex: 0 }, rows: [{ values: book.columns.map((c) => ({ userEnteredValue: { stringValue: c.header } })) }], fields: 'userEnteredValue' } });
  req.push({ updateSheetProperties: { properties: { sheetId: dataId, gridProperties: { frozenRowCount: 1, frozenColumnCount: 2, hideGridlines: true } }, fields: 'gridProperties.frozenRowCount,gridProperties.frozenColumnCount,gridProperties.hideGridlines' } });
  req.push(...dataTab(dataId, rowCount, book.columns, book.kind));

  // 4. Generated tabs: grid size, content, named ranges, input protection.
  const named = {};
  for (const tab of book.tabs) {
    if (tab.data) continue;
    const id = ids[tab.title];
    const built = tab.build(id);
    req.push({ updateSheetProperties: { properties: { sheetId: id, gridProperties: { rowCount: built.grid.rows, columnCount: built.grid.cols, frozenRowCount: built.grid.frozen, frozenColumnCount: 0, hideGridlines: true } }, fields: 'gridProperties.rowCount,gridProperties.columnCount,gridProperties.frozenRowCount,gridProperties.frozenColumnCount,gridProperties.hideGridlines' } });
    req.push(...built.requests);
    Object.assign(named, built.named);
    // Google allows unprotected cells only in a protection given as the whole
    // sheet ({ sheetId } alone), not as a range that happens to cover it.
    req.push({ addProtectedRange: { protectedRange: { range: { sheetId: id }, unprotectedRanges: built.inputs, description: 'Smelloff: built by the website (yellow and lime cells are yours)', warningOnly: true } } });
  }
  for (const [name, range] of Object.entries(named)) req.push({ addNamedRange: { namedRange: { name, range } } });

  // 5. The owner's inputs go back where they were.
  for (const [name, value] of Object.entries(inputs)) {
    const range = named[name];
    if (!range || value === undefined || value === null || value === '') continue;
    req.push({ updateCells: { start: { sheetId: range.sheetId, rowIndex: range.startRowIndex, columnIndex: range.startColumnIndex }, rows: [{ values: [{ userEnteredValue: typeof value === 'number' ? { numberValue: value } : { stringValue: String(value) } }] }], fields: 'userEnteredValue' } });
  }

  // 6. Stamp the version.
  const stamp = stampOf(meta);
  req.push(stamp
    ? { updateDeveloperMetadata: { dataFilters: [{ developerMetadataLookup: { metadataId: stamp.metadataId } }], developerMetadata: { metadataValue: LAYOUT_VERSION }, fields: 'metadataValue' } }
    : { createDeveloperMetadata: { developerMetadata: { metadataKey: STAMP_KEY, metadataValue: LAYOUT_VERSION, location: { spreadsheet: true }, visibility: 'DOCUMENT' } } });

  return { requests: req, dataTab: { sheetId: dataId, rowCount } };
}

export function needsLayout(book, meta) {
  const titles = new Set((meta.sheets || []).map((s) => s.properties.title));
  return stampOf(meta)?.metadataValue !== LAYOUT_VERSION || book.tabs.some((t) => !titles.has(t.title));
}

// Called by every sync. One metadata read when the design is current; a full
// rebuild (keeping data and inputs) when it isn't, or when forced from /admin.
export async function ensureLayout(spreadsheetId, bookKey, { force = false } = {}) {
  const book = BOOKS[bookKey];
  const meta = await getSpreadsheetMeta(spreadsheetId);
  const data = (meta.sheets || []).find((s) => s.properties.title === book.dataTab);
  if (!force && !needsLayout(book, meta)) {
    return { rebuilt: false, dataTab: { sheetId: data.properties.sheetId ?? 0, rowCount: data.properties.gridProperties?.rowCount || 0 } };
  }
  const names = new Set((meta.namedRanges || []).map((n) => n.name));
  const wanted = Object.entries(book.inputs);
  const reads = await readRanges(spreadsheetId, [
    ...(data ? [`'${book.dataTab}'!1:1`] : []),
    ...wanted.map(([name, x]) => (names.has(name) || !x.legacy ? name : x.legacy)),
  ]);
  const header = data ? (reads[0]?.[0] || []) : [];
  const inputs = {};
  wanted.forEach(([name, x], i) => {
    const value = reads[i + (data ? 1 : 0)]?.[0]?.[0];
    if (x.valid(value)) inputs[name] = value;
  });
  const plan = planLayout(book, meta, { header, inputs });
  await batchUpdate(spreadsheetId, plan.requests);
  return { rebuilt: true, dataTab: plan.dataTab };
}
