/**
 * LeadBook — Apps Script backend
 *
 * Bound to ONE agent's Sheet. Deployed as a Web App:
 *   Execute as: Me   |   Who has access: Anyone
 *
 * Every request must carry the access code (SharedSecret in the Config tab).
 * It is checked before any read or write touches the Sheet. The frontend never
 * stores that code in a deployed file — the agent types it on the login screen.
 *
 * POST requests arrive as text/plain on purpose: that keeps them "simple
 * requests" so the browser skips the CORS preflight, which Apps Script cannot
 * answer.
 */

var TAB = {
  CONFIG: 'Config',
  PRODUCTS: 'Products',
  DOC_TEMPLATES: 'DocTemplates',
  LEADS: 'Leads',
  FOLLOW_UPS: 'FollowUps',
  DOCUMENTS: 'Documents'
};

/** Fields stored as full timestamps rather than plain dates. */
var DATETIME_FIELDS = ['LoggedAt', 'UpdatedAt'];

/** Lead fields the app is allowed to overwrite after creation. */
var EDITABLE_LEAD_FIELDS = [
  'Name', 'Phone', 'Address', 'City', 'Area', 'Product', 'ReferredBy',
  'NextVisitDate', 'NextStep'
];


/* ------------------------------------------------------------------ *
 * Entry points
 * ------------------------------------------------------------------ */

function doGet(e) {
  try {
    var params = (e && e.parameter) || {};
    requireSecret_(params.secret);

    var action = params.action || 'bootstrap';
    if (action !== 'bootstrap') throw new Error('Unknown GET action: ' + action);

    return json_({ ok: true, data: bootstrap_() });
  } catch (err) {
    return json_({ ok: false, error: message_(err) });
  }
}


function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');

    // Login is the one action that runs without a token — it is how a device
    // gets one.
    if (body.action === 'login') {
      return json_({ ok: true, data: login_(body.payload || {}) });
    }

    requireSecret_(body.secret);

    // Serialise writes — two devices on the same Sheet must not be handed the
    // same LeadID.
    lock.waitLock(20000);

    var payload = body.payload || {};
    var result;

    switch (body.action) {
      case 'addLead':          result = addLead_(payload); break;
      case 'updateLead':       result = updateLead_(payload); break;
      case 'addFollowUp':      result = addFollowUp_(payload); break;
      case 'toggleDocument':   result = toggleDocument_(payload); break;
      case 'addDocument':      result = addDocument_(payload); break;
      case 'removeDocument':   result = removeDocument_(payload); break;
      case 'addProduct':       result = addProduct_(payload); break;
      case 'updateProduct':    result = updateProduct_(payload); break;
      case 'setProductActive': result = setProductActive_(payload); break;
      case 'addDocTemplate':   result = addDocTemplate_(payload); break;
      case 'removeDocTemplate':result = removeDocTemplate_(payload); break;
      default:
        throw new Error('Unknown POST action: ' + body.action);
    }

    return json_({ ok: true, data: result });
  } catch (err) {
    return json_({ ok: false, error: message_(err) });
  } finally {
    try { lock.releaseLock(); } catch (ignore) {}
  }
}


/* ------------------------------------------------------------------ *
 * Login
 *
 * The agent signs in with the mobile number and email on her Config tab. On a
 * match the server hands back the access token that guards every other call —
 * which is why that token never has to ship inside the deployed frontend.
 *
 * A phone number and an email address are only semi-private, so this is a
 * convenience credential rather than a strong one. The throttle below is what
 * stops it being guessable at scale.
 * ------------------------------------------------------------------ */

var LOGIN_MAX_FAILURES = 10;
var LOGIN_COOLDOWN_SECONDS = 300;

function login_(p) {
  requireFields_(p, ['Phone', 'Email']);
  throttleLogin_();

  var config = configRow_();
  var phoneOk = samePhone_(p.Phone, config.AgentPhone);
  var emailOk = sameEmail_(p.Email, config.AgentEmail);

  if (!phoneOk || !emailOk) {
    recordLoginFailure_();
    throw new Error('Unauthorised: that mobile number and email don\'t match this LeadBook.');
  }

  clearLoginFailures_();
  return {
    token: String(config.SharedSecret || ''),
    agentName: config.AgentName || '',
    data: bootstrap_()
  };
}


/** Compares the last 10 digits, so `+91 98250 11234` matches `9825011234`. */
function samePhone_(given, stored) {
  var a = String(given || '').replace(/\D/g, '').slice(-10);
  var b = String(stored || '').replace(/\D/g, '').slice(-10);
  return a.length === 10 && a === b;
}


function sameEmail_(given, stored) {
  var a = String(given || '').trim().toLowerCase();
  var b = String(stored || '').trim().toLowerCase();
  return a.length > 0 && a === b;
}


function throttleLogin_() {
  var failures = Number(CacheService.getScriptCache().get('loginFailures') || 0);
  if (failures >= LOGIN_MAX_FAILURES) {
    throw new Error('Too many failed sign-in attempts. Try again in a few minutes.');
  }
}


function recordLoginFailure_() {
  var cache = CacheService.getScriptCache();
  var failures = Number(cache.get('loginFailures') || 0) + 1;
  cache.put('loginFailures', String(failures), LOGIN_COOLDOWN_SECONDS);
}


function clearLoginFailures_() {
  CacheService.getScriptCache().remove('loginFailures');
}


/* ------------------------------------------------------------------ *
 * Read
 * ------------------------------------------------------------------ */

/** Everything the app needs in one round trip. */
function bootstrap_() {
  var config = configRow_();
  delete config.SharedSecret;   // never leaves the server
  delete config._row;

  return {
    config: config,
    products: products_(),
    docTemplates: docTemplates_(),
    leads: strip_(readTable_(TAB.LEADS)),
    followUps: strip_(readTable_(TAB.FOLLOW_UPS)),
    documents: strip_(readTable_(TAB.DOCUMENTS))
  };
}


function products_() {
  var rows = strip_(readTable_(TAB.PRODUCTS)).filter(function (p) { return p.Product; });

  // A Sheet built before the Products tab existed still has products implied by
  // DocTemplates — surface those rather than showing the agent an empty list.
  if (!rows.length) {
    rows = unique_(readTable_(TAB.DOC_TEMPLATES).map(function (t) { return t.Product; }))
      .map(function (name, i) {
        return { Product: name, Description: '', SortOrder: i + 1, Active: true };
      });
  }

  // Only an explicit FALSE switches a product off, so a Sheet whose Products tab
  // predates the Active column reads as all-active rather than all-hidden.
  rows.forEach(function (p) { p.Active = p.Active !== false; });

  return rows.sort(function (a, b) {
    return (a.SortOrder || 0) - (b.SortOrder || 0) ||
           String(a.Product).localeCompare(String(b.Product));
  });
}


function docTemplates_() {
  return strip_(readTable_(TAB.DOC_TEMPLATES)).sort(function (a, b) {
    return String(a.Product).localeCompare(String(b.Product)) ||
           (a.SortOrder || 0) - (b.SortOrder || 0);
  });
}


/* ------------------------------------------------------------------ *
 * Leads
 * ------------------------------------------------------------------ */

function addLead_(p) {
  requireFields_(p, ['Name', 'Phone', 'City', 'Product']);

  var leadId = nextId_(TAB.LEADS, 'LeadID', 'LD-');
  var lead = {
    LeadID: leadId,
    Name: text_(p.Name),
    Phone: text_(p.Phone),
    Address: text_(p.Address),
    City: text_(p.City),
    Area: text_(p.Area),
    Product: text_(p.Product),
    ReferredBy: text_(p.ReferredBy),
    NextVisitDate: date_(p.NextVisitDate),
    NextStep: text_(p.NextStep),
    CreatedDate: todayIso_(),
    Status: 'active'
  };
  appendRow_(TAB.LEADS, lead);

  // The caller sends the checklist it actually wants — the agent ticks and
  // unticks the product's defaults on the add-lead form, and may add her own.
  // With no list supplied, fall back to the product's full default set.
  var wanted = Array.isArray(p.DocNames)
    ? p.DocNames.map(text_).filter(Boolean)
    : docTemplatesFor_(lead.Product).map(function (t) { return t.DocName; });

  var nextDocId = idCounter_(TAB.DOCUMENTS, 'DocID', 'DC-');
  var stamp = nowIso_();
  var documents = unique_(wanted).map(function (docName) {
    var doc = {
      DocID: nextDocId(),
      LeadID: leadId,
      DocName: docName,
      Shared: false,          // never pre-ticked; only the agent marks a doc shared
      UpdatedAt: stamp
    };
    appendRow_(TAB.DOCUMENTS, doc);
    return doc;
  });

  return { lead: lead, documents: documents };
}


function updateLead_(p) {
  requireFields_(p, ['LeadID']);
  var row = findRow_(TAB.LEADS, 'LeadID', p.LeadID);

  EDITABLE_LEAD_FIELDS.forEach(function (field) {
    if (!(field in p)) return;
    var value = field === 'NextVisitDate' ? date_(p[field]) : text_(p[field]);
    setCell_(TAB.LEADS, row._row, field, value);
    row[field] = value;
  });

  delete row._row;
  return { lead: row };
}


function addFollowUp_(p) {
  requireFields_(p, ['LeadID', 'Date']);
  var lead = findRow_(TAB.LEADS, 'LeadID', p.LeadID);

  var followUp = {
    FollowUpID: nextId_(TAB.FOLLOW_UPS, 'FollowUpID', 'FU-'),
    LeadID: lead.LeadID,
    Date: date_(p.Date),
    Type: followUpType_(p.Type),
    Note: text_(p.Note),
    LoggedAt: nowIso_()
  };
  appendRow_(TAB.FOLLOW_UPS, followUp);

  // The agent usually sets the next visit in the same breath as logging this
  // one, so accept both here rather than forcing a second request.
  var updated = null;
  if ('NextVisitDate' in p || 'NextStep' in p) {
    updated = updateLead_({
      LeadID: lead.LeadID,
      NextVisitDate: 'NextVisitDate' in p ? p.NextVisitDate : lead.NextVisitDate,
      NextStep: 'NextStep' in p ? p.NextStep : lead.NextStep
    }).lead;
  }

  return { followUp: followUp, lead: updated };
}


/* ------------------------------------------------------------------ *
 * Documents (per lead)
 * ------------------------------------------------------------------ */

function toggleDocument_(p) {
  requireFields_(p, ['DocID']);
  var doc = findRow_(TAB.DOCUMENTS, 'DocID', p.DocID);

  var shared = p.Shared === true || String(p.Shared).toUpperCase() === 'TRUE';
  var stamp = nowIso_();
  setCell_(TAB.DOCUMENTS, doc._row, 'Shared', shared);
  setCell_(TAB.DOCUMENTS, doc._row, 'UpdatedAt', stamp);

  doc.Shared = shared;
  doc.UpdatedAt = stamp;
  delete doc._row;
  return { document: doc };
}


function addDocument_(p) {
  requireFields_(p, ['LeadID', 'DocName']);
  findRow_(TAB.LEADS, 'LeadID', p.LeadID);   // reject orphan documents

  var doc = {
    DocID: nextId_(TAB.DOCUMENTS, 'DocID', 'DC-'),
    LeadID: text_(p.LeadID),
    DocName: text_(p.DocName),
    Shared: false,
    UpdatedAt: nowIso_()
  };
  appendRow_(TAB.DOCUMENTS, doc);
  return { document: doc };
}


function removeDocument_(p) {
  requireFields_(p, ['DocID']);
  var doc = findRow_(TAB.DOCUMENTS, 'DocID', p.DocID);
  sheet_(TAB.DOCUMENTS).deleteRow(doc._row);
  return { DocID: doc.DocID };
}


/* ------------------------------------------------------------------ *
 * Products + their default document lists
 *
 * Products are keyed by name (Leads.Product holds the text), so a rename has
 * to cascade to Leads and DocTemplates. That keeps the Sheet readable by the
 * agent, which matters more here than referential purity.
 * ------------------------------------------------------------------ */

function addProduct_(p) {
  requireFields_(p, ['Product']);
  var name = text_(p.Product);

  var clash = findProduct_(name);
  if (clash) {
    throw new Error(clash.Active === false
      ? '"' + name + '" is already in your list, switched off. Switch it back on instead.'
      : '"' + name + '" is already in your product list.');
  }

  var existing = readTable_(TAB.PRODUCTS);
  var product = {
    Product: name,
    Description: text_(p.Description),
    SortOrder: existing.length + 1,
    Active: true
  };
  appendRow_(TAB.PRODUCTS, product);

  // Seed the default checklist if the agent supplied one with the product.
  var docNames = (p.DocNames || []).map(text_).filter(Boolean);
  docNames.forEach(function (docName, i) {
    appendRow_(TAB.DOC_TEMPLATES, { Product: name, DocName: docName, SortOrder: i + 1 });
  });

  return { product: product, docTemplates: docTemplatesFor_(name) };
}


function updateProduct_(p) {
  requireFields_(p, ['Product']);
  var current = text_(p.Product);
  var row = findProduct_(current);
  if (!row) throw new Error('Product not found: ' + current);

  var renamed = ('NewProduct' in p) ? text_(p.NewProduct) : current;
  if (!renamed) throw new Error('Product name cannot be empty.');

  if (renamed.toLowerCase() !== current.toLowerCase() && findProduct_(renamed)) {
    throw new Error('"' + renamed + '" is already in your product list.');
  }

  if ('Description' in p) {
    setCell_(TAB.PRODUCTS, row._row, 'Description', text_(p.Description));
    row.Description = text_(p.Description);
  }

  if (renamed !== current) {
    setCell_(TAB.PRODUCTS, row._row, 'Product', renamed);
    row.Product = renamed;
    cascadeRename_(TAB.DOC_TEMPLATES, 'Product', current, renamed);
    cascadeRename_(TAB.LEADS, 'Product', current, renamed);
  }

  delete row._row;
  return { product: row, renamedFrom: current !== renamed ? current : null };
}


/**
 * Products are switched off, never deleted. A lead records what she actually
 * pitched at the time — deleting the product would rewrite that history, and
 * would strand every lead holding the name. An inactive product keeps its rows
 * in Leads and DocTemplates intact and simply stops being offered on new leads.
 */
function setProductActive_(p) {
  requireFields_(p, ['Product']);
  var row = findProduct_(text_(p.Product));
  if (!row) throw new Error('Product not found: ' + p.Product);

  var active = p.Active === true || String(p.Active).toUpperCase() === 'TRUE';
  setCell_(TAB.PRODUCTS, row._row, 'Active', active);
  row.Active = active;

  delete row._row;
  return { product: row };
}


function addDocTemplate_(p) {
  requireFields_(p, ['Product', 'DocName']);
  var product = text_(p.Product);
  var docName = text_(p.DocName);

  var existing = docTemplatesFor_(product);
  var clash = existing.filter(function (t) {
    return String(t.DocName).toLowerCase() === docName.toLowerCase();
  }).length;
  if (clash) throw new Error('"' + docName + '" is already on this product\'s list.');

  var template = {
    Product: product,
    DocName: docName,
    SortOrder: existing.length + 1
  };
  appendRow_(TAB.DOC_TEMPLATES, template);
  return { docTemplate: template };
}


function removeDocTemplate_(p) {
  requireFields_(p, ['Product', 'DocName']);
  var match = readTable_(TAB.DOC_TEMPLATES).filter(function (t) {
    return String(t.Product).toLowerCase() === text_(p.Product).toLowerCase() &&
           String(t.DocName).toLowerCase() === text_(p.DocName).toLowerCase();
  })[0];
  if (!match) throw new Error('Not on this product\'s list: ' + p.DocName);

  sheet_(TAB.DOC_TEMPLATES).deleteRow(match._row);
  return { Product: text_(p.Product), DocName: text_(p.DocName) };
}


function findProduct_(name) {
  return readTable_(TAB.PRODUCTS).filter(function (row) {
    return String(row.Product).toLowerCase() === String(name).toLowerCase();
  })[0] || null;
}


function cascadeRename_(tab, field, from, to) {
  readTable_(tab).forEach(function (row) {
    if (String(row[field]).toLowerCase() === String(from).toLowerCase()) {
      setCell_(tab, row._row, field, to);
    }
  });
}


/* ------------------------------------------------------------------ *
 * Sheet access
 * ------------------------------------------------------------------ */

function sheet_(name) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sh) throw new Error('Missing tab: ' + name + '. Run setupMasterTemplate() from Setup.gs.');
  return sh;
}


function headers_(sh) {
  return sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0]
    .map(function (h) { return String(h).trim(); });
}


/**
 * Reads a tab into objects keyed by header name, so reordering columns in the
 * Sheet never breaks the script. Each object carries `_row` (its 1-based sheet
 * row) for writes; strip_() removes it before anything goes over the wire.
 */
function readTable_(name) {
  var sh = sheet_(name);
  if (sh.getLastRow() < 2) return [];

  var values = sh.getDataRange().getValues();
  var headers = values[0].map(function (h) { return String(h).trim(); });
  var rows = [];

  for (var i = 1; i < values.length; i++) {
    if (values[i].join('') === '') continue;   // skip blank rows
    var obj = { _row: i + 1 };
    for (var c = 0; c < headers.length; c++) {
      if (headers[c]) obj[headers[c]] = normalise_(headers[c], values[i][c]);
    }
    rows.push(obj);
  }
  return rows;
}


/**
 * Sheets will happily hand back a Date object where we wrote an ISO string.
 * Normalise on read so the frontend only ever sees `YYYY-MM-DD`.
 */
function normalise_(header, value) {
  if (value instanceof Date) {
    var tz = Session.getScriptTimeZone();
    return DATETIME_FIELDS.indexOf(header) !== -1
      ? Utilities.formatDate(value, tz, "yyyy-MM-dd'T'HH:mm:ss")
      : Utilities.formatDate(value, tz, 'yyyy-MM-dd');
  }
  if (header === 'Shared') {
    return value === true || String(value).toUpperCase() === 'TRUE';
  }
  if (header === 'Active') {
    // Blank means active — see products_().
    return value === '' || value === true || String(value).toUpperCase() === 'TRUE';
  }
  if (header === 'SortOrder') {
    return value === '' ? 0 : Number(value);
  }
  return typeof value === 'string' ? value.trim() : value;
}


function appendRow_(name, obj) {
  var sh = sheet_(name);
  sh.appendRow(headers_(sh).map(function (h) {
    var v = obj[h];
    return (v === undefined || v === null) ? '' : v;
  }));
}


function setCell_(name, row, header, value) {
  var sh = sheet_(name);
  var col = headers_(sh).indexOf(header) + 1;
  if (col === 0) throw new Error('No "' + header + '" column in ' + name);
  sh.getRange(row, col).setValue(value);
}


function findRow_(name, keyField, keyValue) {
  var rows = readTable_(name);
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][keyField]) === String(keyValue)) return rows[i];
  }
  throw new Error(keyField + ' not found: ' + keyValue);
}


function configRow_() {
  var rows = readTable_(TAB.CONFIG);
  if (!rows.length) throw new Error('The Config tab has no data row.');
  return rows[0];
}


function docTemplatesFor_(product) {
  return strip_(readTable_(TAB.DOC_TEMPLATES)
    .filter(function (t) {
      return String(t.Product).toLowerCase() === String(product).toLowerCase();
    })
    .sort(function (a, b) { return (a.SortOrder || 0) - (b.SortOrder || 0); }));
}


/* ------------------------------------------------------------------ *
 * IDs
 * ------------------------------------------------------------------ */

/**
 * Returns a generator that hands out sequential IDs (`LD-0001`, `LD-0002`, …)
 * without re-reading the tab per call. IDs continue past the highest existing
 * number and are never reused, even after a row is deleted.
 */
function idCounter_(name, field, prefix) {
  var highest = 0;
  readTable_(name).forEach(function (row) {
    var n = parseInt(String(row[field]).replace(prefix, ''), 10);
    if (!isNaN(n) && n > highest) highest = n;
  });
  return function () {
    highest += 1;
    return prefix + ('0000' + highest).slice(-4);
  };
}


function nextId_(name, field, prefix) {
  return idCounter_(name, field, prefix)();
}


/* ------------------------------------------------------------------ *
 * Small helpers
 * ------------------------------------------------------------------ */

/**
 * Access codes are typed by hand on a phone, so compare them forgivingly —
 * dashes, spaces and case are all ignored. The code is generated from an
 * unambiguous alphabet (see Setup.gs), so nothing distinct collapses together.
 */
function normaliseSecret_(value) {
  return String(value || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}


function requireSecret_(given) {
  var expected = normaliseSecret_(configRow_().SharedSecret);
  if (!expected) throw new Error('No access code is set in the Config tab.');
  if (normaliseSecret_(given) !== expected) throw new Error('Unauthorised: that access code is not right.');
}


function requireFields_(obj, fields) {
  var missing = fields.filter(function (f) {
    return obj[f] === undefined || obj[f] === null || String(obj[f]).trim() === '';
  });
  if (missing.length) throw new Error('Missing required field(s): ' + missing.join(', '));
}


function strip_(rows) {
  return rows.map(function (row) {
    var copy = {};
    for (var k in row) if (k !== '_row') copy[k] = row[k];
    return copy;
  });
}


function unique_(list) {
  var seen = {}, out = [];
  list.forEach(function (v) {
    if (v && !seen[v]) { seen[v] = true; out.push(v); }
  });
  return out;
}


function text_(v) {
  return v === undefined || v === null ? '' : String(v).trim();
}


/**
 * How the follow-up happened. Recognised values are normalised to their proper
 * casing so the Sheet stays groupable; anything unrecognised is kept as typed
 * rather than thrown away, in case the agent edits the Sheet directly.
 */
var FOLLOW_UP_TYPES = ['Meeting', 'Call', 'WhatsApp', 'Email'];

function followUpType_(v) {
  var given = text_(v);
  if (!given) return FOLLOW_UP_TYPES[0];

  for (var i = 0; i < FOLLOW_UP_TYPES.length; i++) {
    if (FOLLOW_UP_TYPES[i].toLowerCase() === given.toLowerCase()) return FOLLOW_UP_TYPES[i];
  }
  return given;
}


/** Accepts `YYYY-MM-DD` or empty. Anything else is a caller bug worth surfacing. */
function date_(v) {
  var s = text_(v);
  if (!s) return '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error('Dates must be YYYY-MM-DD, got: ' + s);
  return s;
}


function todayIso_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
}


function nowIso_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss");
}


function message_(err) {
  return String((err && err.message) || err);
}


function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
