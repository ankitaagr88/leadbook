/**
 * LeadBook — one-time Sheet setup
 *
 * Run setupMasterTemplate() once against a blank Spreadsheet to produce the
 * master template. Per-agent assembly then duplicates that Sheet rather than
 * re-running this.
 *
 * Safe to re-run: existing tabs keep their data. Only missing tabs, missing
 * header columns and missing seed rows are added.
 */

var HEADERS = {
  'Config':       ['AgentName', 'AgentPhone', 'AgentEmail', 'ReferralCode', 'CreatedDate', 'SharedSecret'],
  'Products':     ['Product', 'Description', 'SortOrder', 'Active'],
  'DocTemplates': ['Product', 'DocName', 'SortOrder'],
  'Leads':        ['LeadID', 'Name', 'Phone', 'Address', 'City', 'Area', 'Product',
                   'NextVisitDate', 'NextStep', 'CreatedDate', 'Status'],
  'FollowUps':    ['FollowUpID', 'LeadID', 'Date', 'Note', 'LoggedAt'],
  'Documents':    ['DocID', 'LeadID', 'DocName', 'Shared', 'UpdatedAt']
};

/** Columns held as plain text so Sheets stops reformatting our ISO strings. */
var TEXT_COLUMNS = {
  'Config':    ['AgentPhone', 'CreatedDate'],
  'Leads':     ['Phone', 'NextVisitDate', 'CreatedDate'],
  'FollowUps': ['Date', 'LoggedAt'],
  'Documents': ['UpdatedAt']
};

/**
 * Starter products come from the industry's seed file, not from here.
 *
 * Paste one `Seed.gs` alongside this file — `insurance/Seed.gs`, or whichever
 * vertical this Sheet is for — and it defines `SEED_PRODUCTS`. Apps Script puts
 * every .gs file in one global scope, so nothing needs importing.
 *
 * With no seed file the Sheet is built empty and the agent adds her own
 * products from the Products screen. That is the whole point: this file knows
 * nothing about any industry.
 */
function seedProductList_() {
  return (typeof SEED_PRODUCTS !== 'undefined' && SEED_PRODUCTS) ? SEED_PRODUCTS : [];
}


/**
 * Builds every tab, seeds Products and DocTemplates, and writes a placeholder
 * Config row with a freshly generated access code.
 */
function setupMasterTemplate() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  Object.keys(HEADERS).forEach(function (name) {
    var sh = ss.getSheetByName(name) || ss.insertSheet(name);
    writeHeaders_(sh, HEADERS[name]);
    lockTextColumns_(sh, TEXT_COLUMNS[name] || []);
  });

  seedProducts_(ss.getSheetByName('Products'), ss.getSheetByName('DocTemplates'));
  var code = seedConfig_(ss.getSheetByName('Config'));
  removeDefaultSheet_(ss);

  Logger.log('LeadBook setup complete.');
  Logger.log('Access code: %s', code);
  Logger.log('Fill in AgentName / AgentPhone / AgentEmail on the Config tab — the agent logs in with that phone and email.');
  return code;
}


/**
 * Regenerates the access code. Any device that is already signed in will be
 * signed out on its next request.
 */
function rotateAccessCode() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Config');
  var col = HEADERS.Config.indexOf('SharedSecret') + 1;
  var code = generateAccessCode_();
  sh.getRange(2, col).setValue(code);
  Logger.log('New access code: %s — every signed-in device will need to log in again.', code);
  return code;
}


/* ------------------------------------------------------------------ */

/** Adds any missing header columns without disturbing existing ones. */
function writeHeaders_(sh, headers) {
  var existing = sh.getLastColumn()
    ? sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(function (h) { return String(h).trim(); })
    : [];

  var merged = existing.filter(Boolean);
  headers.forEach(function (h) {
    if (merged.indexOf(h) === -1) merged.push(h);
  });

  sh.getRange(1, 1, 1, merged.length)
    .setValues([merged])
    .setFontWeight('bold')
    .setBackground('#f1f3f5');
  sh.setFrozenRows(1);
  sh.autoResizeColumns(1, merged.length);
}


/** Reads the sheet's own header row, so this stays correct on a re-run where
 *  columns sit in a different order than HEADERS declares. */
function lockTextColumns_(sh, textColumns) {
  var actual = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0]
    .map(function (h) { return String(h).trim(); });

  textColumns.forEach(function (header) {
    var col = actual.indexOf(header) + 1;
    if (col > 0) sh.getRange(2, col, sh.getMaxRows() - 1, 1).setNumberFormat('@');
  });
}


function seedProducts_(productsSheet, templatesSheet) {
  if (productsSheet.getLastRow() > 1) return;   // agent may already have edited these

  var seed = seedProductList_();
  if (!seed.length) return;                     // no industry seed file — start empty

  var productRows = seed.map(function (p, i) {
    return [p.name, p.description || '', i + 1, true];
  });
  productsSheet.getRange(2, 1, productRows.length, 4).setValues(productRows);

  if (templatesSheet.getLastRow() > 1) return;

  var templateRows = [];
  seed.forEach(function (p) {
    (p.docs || []).forEach(function (docName, i) {
      templateRows.push([p.name, docName, i + 1]);
    });
  });
  if (templateRows.length) {
    templatesSheet.getRange(2, 1, templateRows.length, 3).setValues(templateRows);
  }
}


function seedConfig_(sh) {
  var col = HEADERS.Config.indexOf('SharedSecret') + 1;
  if (sh.getLastRow() > 1) {
    var existing = String(sh.getRange(2, col).getValue());
    if (existing) return existing;
    var replacement = generateAccessCode_();
    sh.getRange(2, col).setValue(replacement);
    return replacement;
  }

  var code = generateAccessCode_();
  sh.getRange(2, 1, 1, HEADERS.Config.length).setValues([[
    '[Agent Name]',
    '[+91 XXXXXXXXXX]',
    '[agent@example.com]',
    '[REFCODE]',
    Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd'),
    code
  ]]);
  return code;
}


function removeDefaultSheet_(ss) {
  var sheet1 = ss.getSheetByName('Sheet1');
  if (sheet1 && ss.getSheets().length > 1 && sheet1.getLastRow() === 0) {
    ss.deleteSheet(sheet1);
  }
}


/**
 * `K7M4-QP2X-9RTB-F3WN` — grouped for readability, and drawn from an alphabet
 * with no I/L/O/0/1 so it survives being read off a screen and typed by hand.
 * The server compares case-insensitively and ignores the dashes.
 */
function generateAccessCode_() {
  var alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  var groups = [];
  for (var g = 0; g < 4; g++) {
    var group = '';
    for (var i = 0; i < 4; i++) {
      group += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
    }
    groups.push(group);
  }
  return groups.join('-');
}
