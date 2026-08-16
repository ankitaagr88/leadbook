/**
 * Boots index.html in jsdom against a fake Apps Script backend and walks the
 * main flows: login -> list -> filter -> detail -> doc toggle -> products.
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const PROJECT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(PROJECT, 'index.html'), 'utf8');
// Built the way an assembler would: copy the template, fill it in.
const config = JSON.parse(fs.readFileSync(path.join(PROJECT, 'config.example.json'), 'utf8'));
Object.assign(config, {
  agentSlug: 'vaishali',
  agentName: 'Vaishali Pancholi',
  appsScriptUrl: 'https://script.google.com/macros/s/TEST/exec',
  defaultCityOrder: ['Surat', 'Vadodara', 'Navsari', 'Bharuch']
});

const TOKEN = 'K7M4-QP2X-9RTB-F3WN';

const db = {
  config: { AgentName: 'Vaishali Pancholi', AgentPhone: '+91 98250 11234',
            AgentEmail: 'vaishali@example.com', ReferralCode: 'VP2026' },
  products: [
    { Product: 'Term Life', Description: 'Pure life cover for a fixed term.', SortOrder: 1 },
    { Product: 'Health Cover', Description: 'Hospitalisation cover.', SortOrder: 2 }
  ],
  docTemplates: [
    { Product: 'Term Life', DocName: 'PAN Card', SortOrder: 1 },
    { Product: 'Term Life', DocName: 'Aadhar Card', SortOrder: 2 },
    { Product: 'Health Cover', DocName: 'PAN Card', SortOrder: 1 }
  ],
  leads: [
    { LeadID: 'LD-0001', Name: 'Rakesh Chauhan', Phone: '+91 98250 11234', Address: 'B-12 Sun City',
      City: 'Surat', Area: 'Adajan', Product: 'Term Life', NextVisitDate: '2026-08-20',
      NextStep: 'Call with premium sheet', CreatedDate: '2026-08-12', Status: 'active', ReferredBy: 'Ashok Patel' },
    { LeadID: 'LD-0002', Name: 'Meera Desai', Phone: '+91 99099 45671', Address: '304 Silver Heights',
      City: 'Surat', Area: 'Vesu', Product: 'Health Cover', NextVisitDate: '2026-08-18',
      NextStep: 'Send claim ratio doc', CreatedDate: '2026-08-14', Status: 'active', ReferredBy: 'Ashok Patel' },
    { LeadID: 'LD-0003', Name: 'Vipul Rana', Phone: '+91 98790 22156', Address: 'Flat 6B',
      City: 'Vadodara', Area: 'Alkapuri', Product: 'Term Life', NextVisitDate: '',
      NextStep: '', CreatedDate: '2026-07-02', Status: 'active', ReferredBy: 'Foram Shah' }
  ],
  followUps: [
    { FollowUpID: 'FU-0001', LeadID: 'LD-0001', Date: '2026-08-03',
      Note: 'First meeting.', LoggedAt: '2026-08-03T10:00:00' }
  ],
  documents: [
    { DocID: 'DC-0001', LeadID: 'LD-0001', DocName: 'PAN Card', Shared: true, UpdatedAt: '2026-08-03T10:00:00' },
    { DocID: 'DC-0002', LeadID: 'LD-0001', DocName: 'Aadhar Card', Shared: false, UpdatedAt: '2026-08-03T10:00:00' },
    { DocID: 'DC-0003', LeadID: 'LD-0002', DocName: 'PAN Card', Shared: false, UpdatedAt: '2026-08-03T10:00:00' }
  ]
};

const bootstrap = () => JSON.parse(JSON.stringify({
  config: db.config, products: db.products, docTemplates: db.docTemplates,
  leads: db.leads, followUps: db.followUps, documents: db.documents
}));

const calls = [];
let lastFollowUp = null;
let lastAddLead = null;

function reply(payload) {
  return Promise.resolve({
    ok: true,
    text: () => Promise.resolve(JSON.stringify(payload))
  });
}

function fakeFetch(url, options, served) {
  options = options || {};

  const filename = String(url).replace(/^https?:\/\/[^/]+\//, '').split('?')[0];
  if (/config[-.]/.test(filename)) {
    if (!served.has(filename)) {
      return Promise.resolve({ ok: false, status: 404,
                               text: () => Promise.resolve('Not found') });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve(config),
                             text: () => Promise.resolve(JSON.stringify(config)) });
  }

  if (options.method === 'POST') {
    const body = JSON.parse(options.body);
    calls.push(body.action);

    if (body.action === 'login') {
      const p = body.payload;
      if (p.Phone.replace(/\D/g, '').slice(-10) !== '9825011234' ||
          p.Email.toLowerCase() !== 'vaishali@example.com') {
        return reply({ ok: false, error: 'Unauthorised: that mobile number and email don\'t match this LeadBook.' });
      }
      return reply({ ok: true, data: { token: TOKEN, agentName: 'Vaishali Pancholi', data: bootstrap() } });
    }

    if (body.secret !== TOKEN) return reply({ ok: false, error: 'Unauthorised.' });

    if (body.action === 'toggleDocument') {
      const doc = db.documents.find(d => d.DocID === body.payload.DocID);
      doc.Shared = body.payload.Shared;
      return reply({ ok: true, data: { document: doc } });
    }
    if (body.action === 'updateLead') {
      const lead = db.leads.find(l => l.LeadID === body.payload.LeadID);
      ['Name','Phone','Address','City','Area','Product','NextVisitDate','NextStep']
        .forEach(f => { if (f in body.payload) lead[f] = body.payload[f]; });
      return reply({ ok: true, data: { lead: JSON.parse(JSON.stringify(lead)) } });
    }
    if (body.action === 'addLead') {
      lastAddLead = body.payload;
      const lead = Object.assign({}, body.payload,
        { LeadID: 'LD-9001', CreatedDate: '2026-08-16', Status: 'active' });
      delete lead.DocNames;
      db.leads.push(lead);
      const documents = (body.payload.DocNames || []).map((n, i) => ({
        DocID: 'DC-90' + i, LeadID: 'LD-9001', DocName: n, Shared: false, UpdatedAt: ''
      }));
      db.documents.push(...documents);
      return reply({ ok: true, data: { lead, documents } });
    }
    if (body.action === 'setProductActive') {
      const p = db.products.find(x => x.Product === body.payload.Product);
      p.Active = body.payload.Active;
      return reply({ ok: true, data: { product: JSON.parse(JSON.stringify(p)) } });
    }
    if (body.action === 'addProduct') {
      const p = { Product: body.payload.Product, Description: body.payload.Description, SortOrder: 9 };
      db.products.push(p);
      (body.payload.DocNames || []).forEach((d, i) =>
        db.docTemplates.push({ Product: p.Product, DocName: d, SortOrder: i + 1 }));
      return reply({ ok: true, data: { product: p } });
    }
    if (body.action === 'addFollowUp') {
      lastFollowUp = body.payload;
      const fu = Object.assign({ FollowUpID: 'FU-90', LoggedAt: '2026-08-16T10:00:00' }, body.payload);
      db.followUps.push(fu);
      return reply({ ok: true, data: { followUp: fu, lead: null } });
    }
    return reply({ ok: true, data: {} });
  }

  // GET bootstrap
  calls.push('bootstrap');
  if (String(url).indexOf(encodeURIComponent(TOKEN).replace(/-/g, '-')) === -1 &&
      String(url).indexOf(TOKEN) === -1) {
    return reply({ ok: false, error: 'Unauthorised.' });
  }
  return reply({ ok: true, data: bootstrap() });
}

function makeDom(url, servedConfigs) {
  const served = new Set(servedConfigs);
  return new JSDOM(html, {
    runScripts: 'dangerously',
    url,
    pretendToBeVisual: true,
    beforeParse(window) {
      window.fetch = (u, o) => fakeFetch(u, o, served);
      window.confirm = () => true;
    }
  });
}

// What the /insurance/vaishali/ stub redirects to. The app always runs at the
// site root, so config paths resolve relative to there.
const dom = makeDom('https://leadbook.ai4work.in/?industry=insurance&agent=vaishali',
                    ['insurance/config-vaishali.json']);

const win = dom.window;
const doc = win.document;
const $ = (id) => doc.getElementById(id);
const tick = (n = 6) => new Promise(r => setTimeout(r, n));

let failures = 0;
function check(label, condition, detail) {
  if (condition) { console.log('  PASS  ' + label); }
  else { failures++; console.log('  FAIL  ' + label + (detail ? '  -> ' + detail : '')); }
}

win.addEventListener('error', e => { failures++; console.log('  ERROR ' + e.message); });

(async function run() {
  await tick(30);

  console.log('\n1. Login gate');
  check('starts on the login screen', $('device').dataset.state === 'login', $('device').dataset.state);
  check('agent name shown on gate', $('gateFoot').textContent.indexOf('Vaishali') !== -1);

  console.log('\n2. Wrong credentials are rejected');
  $('gatePhone').value = '9999999999';
  $('gateEmail').value = 'wrong@example.com';
  $('gateForm').dispatchEvent(new win.Event('submit', { bubbles: true, cancelable: true }));
  await tick(30);
  check('stays on login', $('device').dataset.state === 'login');
  check('shows an error', !$('gateError').hidden && /don't match/.test($('gateError').textContent));

  console.log('\n3. Correct credentials sign in');
  $('gatePhone').value = '98250 11234';
  $('gateEmail').value = 'Vaishali@example.com';
  $('gateForm').dispatchEvent(new win.Event('submit', { bubbles: true, cancelable: true }));
  await tick(40);
  check('app is ready', $('device').dataset.state === 'ready', $('device').dataset.state);
  check('token stored for next visit', /K7M4/.test(win.localStorage.getItem('leadbook:vaishali') || ''));
  check('agent chip filled', $('agentChip').textContent === 'Vaishali Pancholi');

  console.log('\n4. Lead list');
  const cards = () => doc.querySelectorAll('.lead-card');
  check('3 leads rendered', cards().length === 3, cards().length);
  check('soonest visit sorts first', cards()[0].textContent.indexOf('Meera') !== -1);
  check('no-date lead sorts last', cards()[2].textContent.indexOf('Vipul') !== -1);
  check('doc counts shown', /Docs: 1\/2 shared/.test(cards()[1].textContent), cards()[1].textContent.trim());
  check('summary line', /3 leads/.test($('pageSub').textContent), $('pageSub').textContent);

  console.log('\n5. City / area cascade');
  const tabs = () => doc.querySelectorAll('.index-tab');
  const click = (el) => el.dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  check('area row hidden before a city is picked', $('areaRow').innerHTML === '',
        JSON.stringify($('areaRow').innerHTML));
  check('cities from live data', tabs().length === 3, [...tabs()].map(t => t.textContent).join('|'));
  check('config order respected', tabs()[1].textContent === 'Surat');
  click(tabs()[1]);
  await tick();
  check('Surat filters to 2', cards().length === 2, cards().length);
  const areaChips = doc.querySelectorAll('.area-chip');
  check('areas appear only now, narrowed to Surat',
        [...areaChips].map(c => c.textContent).join('|') === 'All|Adajan|Vesu',
        [...areaChips].map(c => c.textContent).join('|'));
  check('area row is labelled', /Area/.test($('areaRow').textContent));
  click(areaChips[2]);
  await tick();
  check('Vesu filters to 1', cards().length === 1, cards().length);
  click(tabs()[0]);
  await tick();
  check('area row hidden again on All cities', $('areaRow').innerHTML === '');
  check('area selection reset', cards().length === 3, cards().length);

  console.log('\n5b. Product filter');
  const prodChips = () => doc.querySelectorAll('.product-chip');
  check('product chips rendered', prodChips().length === 3, prodChips().length);
  check('in her own product order',
        [...prodChips()].map(c => c.textContent).join('|') === 'All|Term Life|Health Cover',
        [...prodChips()].map(c => c.textContent).join('|'));
  click(prodChips()[1]);
  await tick();
  check('Term Life filters to 2', cards().length === 2, cards().length);
  check('chip marked active', prodChips()[1].classList.contains('active'));
  check('product filter is not narrowed by city', $('productRow').children.length === 4);
  click(tabs()[2]);
  await tick();
  check('stacks with city (Vadodara + Term Life = 1)', cards().length === 1, cards().length);
  click(tabs()[0]);
  click(prodChips()[0]);
  await tick();
  check('clearing product restores list', cards().length === 3, cards().length);

  console.log('\n6. Search');
  $('searchInput').value = '98790';
  $('searchInput').dispatchEvent(new win.Event('input', { bubbles: true }));
  await tick();
  check('phone search finds Vipul', cards().length === 1 && /Vipul/.test(cards()[0].textContent), cards().length);
  $('searchClear').dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  await tick();
  check('clearing search restores list', cards().length === 3);

  console.log('\n7. Lead detail');
  cards()[0].dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  await tick();
  check('detail sheet opens', $('detailSheet').classList.contains('open'));
  check('product description shown', /Hospitalisation/.test($('detailBody').textContent));
  check('phone is tap-to-call', doc.querySelector('a[href^="tel:"]') !== null);
  check('date formatted for display', /18 Aug 2026/.test($('detailBody').textContent),
        $('detailBody').textContent.match(/Aug[^·]*/));

  console.log('\n8. Document toggle');
  const before = calls.length;
  doc.querySelector('[data-toggle]').dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  await tick(20);
  check('toggle posted to server', calls.slice(before).indexOf('toggleDocument') !== -1, calls.slice(before).join(','));
  check('checkbox now on', doc.querySelector('.doc-check').classList.contains('on'));
  check('summary updated', $('docSummary').textContent === '1/1 shared', $('docSummary').textContent);

  console.log('\n9. Edit lead details');
  $('editLeadBtn').dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  await tick();
  check('edit form opens', $('edName') !== null && $('edName').value === 'Meera Desai', $('edName') && $('edName').value);
  check('phone box holds 10 digits only', $('edPhone').value === '99099 45671', $('edPhone').value);
  check('country code shown as fixed furniture', doc.querySelector('.phone-prefix').textContent.indexOf('+91') === 0);
  check('product editable', $('edProduct').value === 'Health Cover');
  check('all products offered', $('edProduct').options.length === 2);
  check('pencil hidden while editing', $('editLeadBtn').hidden === true);

  const citySelect = $('edCity');
  check('city picker offers an add option', [...citySelect.options].some(o => o.value === '__new__'));
  check('current city preselected', citySelect.value === 'Surat', citySelect.value);
  citySelect.value = '__new__';
  citySelect.dispatchEvent(new win.Event('change', { bubbles: true }));
  await tick();
  check('free-text city box revealed', $('edCity-new').hidden === false);
  check('area picker reset alongside it', $('edArea') !== null);

  console.log('\n9b. Empty name is refused');
  $('edName').value = '   ';
  $('edSave').dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  await tick(15);
  check('save blocked', $('edName') !== null && $('edName').classList.contains('invalid'));
  check('nothing posted', calls[calls.length - 1] !== 'updateLead', calls[calls.length - 1]);

  console.log('\n9c. Rename + reproduct + new city saves');
  $('edName').value = 'Meera D. Desai';
  $('edPhone').value = '99099 45999';
  $('edProduct').value = 'Term Life';
  check('next visit editable without logging a meeting', $('edVisit') !== null);
  check('next visit prefilled from the lead', $('edVisit').value === '2026-08-18', $('edVisit').value);
  $('edVisit').value = '2026-09-30';
  $('edNextStep').value = 'Collect income proof';
  $('edCity-new').value = 'Bharuch';
  $('edSave').dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  await tick(30);
  check('updateLead posted', calls.indexOf('updateLead') !== -1);
  check('back to read mode', $('edName') === null);
  check('pencil back', $('editLeadBtn').hidden === false);
  check('sheet title renamed', $('detailName').textContent === 'Meera D. Desai', $('detailName').textContent);
  check('new product tag shown', doc.querySelector('.detail-tag').textContent === 'Term Life');
  check('new product blurb shown', /Pure life cover/.test($('leadBlock').textContent));
  check('new city in address', /Bharuch/.test($('leadBlock').textContent), $('leadBlock').textContent);
  check('new next visit shown', /30 Sep 2026/.test($('leadBlock').textContent), $('leadBlock').textContent);
  check('new next step shown', /Collect income proof/.test($('leadBlock').textContent));
  check('list card reflects new next step', /Collect income proof/.test($('listWrap').textContent));
  check('documents untouched by product change',
        doc.querySelectorAll('#docList .doc-row').length === 1,
        doc.querySelectorAll('#docList .doc-row').length);
  closeAll();
  check('new city became a filter tab',
        [...doc.querySelectorAll('.index-tab')].some(t => t.textContent === 'Bharuch'),
        [...doc.querySelectorAll('.index-tab')].map(t => t.textContent).join('|'));

  console.log('\n10. Add-lead form');
  closeAll();
  $('fabAdd').dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  await tick();
  check('add sheet opens', $('addSheet').classList.contains('open'));
  check('products in dropdown', $('afProduct').options.length === 2, $('afProduct').options.length);
  check('product blurb shown', /Pure life cover/.test($('afProductDesc').textContent));
  check('city picker can add new', [...$('afCity').options].some(o => o.value === '__new__'));
  check('known cities offered', [...$('afCity').options].some(o => o.value === 'Vadodara'));

  const ticks = () => doc.querySelectorAll('#afDocList .doc-row');
  const changeProduct = async (v) => {
    $('afProduct').value = v;
    $('afProduct').dispatchEvent(new win.Event('change', { bubbles: true }));
    await tick();
  };

  console.log('\n10b. Documents are a real checklist');
  check('rendered as tickable rows, not a preview string', ticks().length === 2, ticks().length);
  check('uses the mockup doc-check treatment', doc.querySelector('#afDocList .doc-check') !== null);
  check('all ticked by default', [...ticks()].every(r => r.classList.contains('on')));
  check('summary counts them', $('afDocSummary').textContent === '2 of 2 ticked', $('afDocSummary').textContent);

  click(ticks()[1].querySelector('[data-pick]'));
  await tick();
  check('unticking flips the row', !ticks()[1].classList.contains('on'));
  check('unticked row reads Skipped', /Skipped/.test(ticks()[1].textContent));
  check('summary updates', $('afDocSummary').textContent === '1 of 2 ticked', $('afDocSummary').textContent);

  $('afNewDoc').value = 'Bank Statement';
  click($('afAddDoc'));
  await tick();
  check('custom document added, ticked', ticks().length === 3 && ticks()[2].classList.contains('on'));
  $('afNewDoc').value = 'pan card';
  click($('afAddDoc'));
  await tick();
  check('duplicate not added twice', ticks().length === 3, ticks().length);

  await changeProduct('Health Cover');
  check('checklist follows the product', ticks().length === 1 && /PAN Card/.test(ticks()[0].textContent),
        ticks().length);

  console.log('\n10c. Only ticked documents are saved');
  await changeProduct('Term Life');
  click(ticks()[0].querySelector('[data-pick]'));      // untick PAN Card
  await tick();
  $('afName').value = 'Checklist Test';
  $('afPhone').value = '9000000000';
  $('afCity').value = 'Surat';
  $('addForm').dispatchEvent(new win.Event('submit', { bubbles: true, cancelable: true }));
  await tick(40);
  check('addLead posted', calls.indexOf('addLead') !== -1);
  check('sent only the ticked document',
        JSON.stringify(lastAddLead && lastAddLead.DocNames) === JSON.stringify(['Aadhar Card']),
        JSON.stringify(lastAddLead && lastAddLead.DocNames));
  check('lead appears in the list', /Checklist Test/.test($('listWrap').textContent));

  console.log('\n11. Products screen');
  closeAll();
  $('menuBtn').dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  $('menuProducts').dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  await tick();
  check('product sheet opens', $('productSheet').classList.contains('open'));
  check('both products listed', doc.querySelectorAll('[data-product]').length === 2);
  check('descriptions shown', /Pure life cover/.test($('productBody').textContent));
  // Meera moved onto Term Life in 9c, and 10c added a 4th lead.
  check('doc + lead counts shown', /2 documents · 4 leads/.test($('productBody').textContent),
        $('productBody').textContent.replace(/\s+/g, ' ').slice(0, 200));
  check('singular pluralisation', /1 document · 0 leads/.test($('productBody').textContent));

  doc.querySelectorAll('[data-product]')[0].dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  await tick();
  check('editor expands', $('epName') !== null && $('epName').value === 'Term Life');
  check('default docs listed', doc.querySelectorAll('[data-doc-template]').length === 2);

  $('addProductBtn') && $('addProductBtn').dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  await tick();
  console.log('');
  console.log('11a. Follow-up types');
  closeAll();
  click(doc.querySelectorAll('.lead-card')[0]);
  await tick();
  click($('addFollowupBtn'));
  await tick();
  const typeChips = () => doc.querySelectorAll('[data-fu-type]');
  check('four types offered', typeChips().length === 4, typeChips().length);
  check('types are the expected four',
        [...typeChips()].map(c => c.textContent).join('|') === 'Meeting|Call|WhatsApp|Email',
        [...typeChips()].map(c => c.textContent).join('|'));
  check('Meeting is the default', typeChips()[0].classList.contains('active'));
  click(typeChips()[2]);
  await tick();
  check('picking WhatsApp moves the highlight',
        typeChips()[2].classList.contains('active') && !typeChips()[0].classList.contains('active'));
  $('fuNote').value = 'Sent policy comparison on WhatsApp';
  click($('saveFollowupBtn'));
  await tick(40);
  check('type sent to the server', lastFollowUp && lastFollowUp.Type === 'WhatsApp',
        lastFollowUp && lastFollowUp.Type);
  check('type shown in the history', /WhatsApp/.test($('historyList').textContent));
  check('type resets to Meeting on reopening',
        (function () { closeAll(); click(doc.querySelectorAll('.lead-card')[0]); return true; })());

  console.log('');
  console.log('11b. Referrals screen');
  closeAll();
  click($('menuBtn'));
  click($('menuReferrals'));
  await tick();
  check('referral sheet opens', $('referralSheet').classList.contains('open'));
  check('her own referral code shown',
        $('referralCode') && $('referralCode').textContent === 'VP2026',
        $('referralCode') && $('referralCode').textContent);
  const refHeads = () => doc.querySelectorAll('[data-referrer]');
  check('referrers grouped', refHeads().length === 2, refHeads().length);
  check('busiest referrer first', refHeads()[0].textContent.includes('Ashok Patel'),
        refHeads()[0].textContent);
  check('lead counts shown', /2 leads/.test(refHeads()[0].textContent));
  check('lead with no referrer excluded', !$('referralBody').textContent.includes('Checklist Test'));
  click(refHeads()[0]);
  await tick();
  const refLeads = doc.querySelectorAll('.referral-lead');
  check("expands to that referrer's leads", refLeads.length === 2, refLeads.length);
  click(refLeads[0]);
  await tick();
  check('tapping one opens the lead', $('detailSheet').classList.contains('open'));
  check('referral shown on the lead detail', /Referred by/.test($('detailBody').textContent));


  console.log('\n12. Sign out');
  closeAll();
  $('menuBtn').dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  $('menuSignOut').dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  await tick();
  check('returns to login', $('device').dataset.state === 'login');
  check('token cleared', !win.localStorage.getItem('leadbook:vaishali'));

  console.log('\n13. Deployment shapes (no agent baked into index.html)');

  // One agent on her own site, at a path like /leadbook/ — the path segment is
  // the repo name, so it must fall through to config.json.
  const single = makeDom('https://example.com/leadbook/', ['config.json']);
  await tick(50);
  const singleDoc = single.window.document;
  check('single-agent deployment boots from config.json',
        singleDoc.getElementById('device').dataset.state === 'login',
        singleDoc.getElementById('device').dataset.state + ' / ' +
        singleDoc.getElementById('errorDetail').textContent);

  // ?industry=&agent= names an instance outright. If its file is missing, erroring
  // is the only safe answer — falling back would sign her into a different agent's
  // LeadBook, or the same name in another industry.
  const wrong = makeDom('https://leadbook.ai4work.in/?industry=insurance&agent=nobody', ['config.json']);
  await tick(50);
  const wrongDoc = wrong.window.document;
  check('named agent with no config file errors, never falls back',
        wrongDoc.getElementById('device').dataset.state === 'error',
        wrongDoc.getElementById('device').dataset.state);
  check('error names the file it looked for',
        /config-nobody\.json/.test(wrongDoc.getElementById('errorDetail').textContent),
        wrongDoc.getElementById('errorDetail').textContent);

  console.log('\n' + (failures ? failures + ' FAILURE(S)' : 'All checks passed'));
  process.exit(failures ? 1 : 0);

  function closeAll() {
    doc.querySelectorAll('.sheet').forEach(s => s.classList.remove('open'));
  }
})();
