/**
 * Smelloff — Google Apps Script for the orders/waitlist sheet.
 *
 * HOW TO DEPLOY
 *  1. Open the target Google Sheet → Extensions → Apps Script.
 *  2. Replace the existing Code.gs contents with this file.
 *  3. Set SHEET_ID below to your spreadsheet's ID (or leave blank to bind to
 *     the active spreadsheet).
 *  4. Deploy → New deployment → type: Web app → execute as Me, access
 *     "Anyone". Copy the /exec URL into index.html → CFG.SHEETS_ENDPOINT.
 *
 * The site posts every field listed in HEADERS as URL params (GET via image
 * pixel) and as FormData (POST via sendBeacon). Both branches land here.
 */

var SHEET_ID = '';
var ORDERS_TAB  = 'Orders';
var WAITLIST_TAB = 'Waitlist';

var HEADERS = [
  'Order ID',
  'Payment ID',
  'Variant',
  'Variant Label',
  'Product',
  'Units',
  'Quantity',
  'Amount',
  'Shipping',
  'Total',
  'Payment Method',
  'Name',
  'Phone',
  'Email',
  'Address',
  'Pincode',
  'City',
  'State',
  'Timestamp'
];

var FIELD_FOR_HEADER = {
  'Order ID': 'orderId',
  'Payment ID': 'paymentId',
  'Variant': 'variant',
  'Variant Label': 'variantLabel',
  'Product': 'product',
  'Units': 'units',
  'Quantity': 'quantity',
  'Amount': 'amount',
  'Shipping': 'shipping',
  'Total': 'total',
  'Payment Method': 'paymentMethod',
  'Name': 'name',
  'Phone': 'phone',
  'Email': 'email',
  'Address': 'address',
  'Pincode': 'pincode',
  'City': 'city',
  'State': 'state',
  'Timestamp': 'timestamp'
};

function doGet(e)  { return handle(e); }
function doPost(e) { return handle(e); }

function handle(e) {
  var params = (e && e.parameter) ? e.parameter : {};
  var ss = SHEET_ID ? SpreadsheetApp.openById(SHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();

  if (params.orderId) {
    appendOrder(ss, params);
  } else if (params.email) {
    appendWaitlist(ss, params.email);
  }

  return ContentService
    .createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

function appendOrder(ss, params) {
  var sheet = ss.getSheetByName(ORDERS_TAB) || ss.insertSheet(ORDERS_TAB);
  ensureHeaders(sheet, HEADERS);
  var row = HEADERS.map(function (h) {
    var key = FIELD_FOR_HEADER[h];
    return params[key] != null ? params[key] : '';
  });
  sheet.appendRow(row);
}

function appendWaitlist(ss, email) {
  var sheet = ss.getSheetByName(WAITLIST_TAB) || ss.insertSheet(WAITLIST_TAB);
  ensureHeaders(sheet, ['Email', 'Timestamp']);
  sheet.appendRow([email, new Date().toISOString()]);
}

function ensureHeaders(sheet, headers) {
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sheet.setFrozenRows(1);
    return;
  }
  var firstRow = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  for (var i = 0; i < headers.length; i++) {
    if (firstRow[i] !== headers[i]) {
      sheet.getRange(1, i + 1).setValue(headers[i]).setFontWeight('bold');
    }
  }
}
