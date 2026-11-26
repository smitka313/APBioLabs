'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const Report = require('../openscied-submission-report.js');
const NOW = new Date('2026-01-03T12:20:00Z');
const fixture = () => ({
  title: 'Ecosystem Report', unit: 'Unit 1', source: 'Simulated trial; separate observations from field data',
  status: 'final', datasetId: 'AB-08', student: { name: 'Example Student', period: '4' },
  keyResults: [{ label: 'Loss', value: 0, unit: 'tokens', note: 'Zero losses observed.' }],
  sections: [{ title: 'Trial evidence', items: [
    { type: 'answer', prompt: 'What did you observe?', value: 'First line\nSecond <tag> & line' },
    { type: 'table', title: 'Counts', columns: ['Winter', 'Rain?'], rows: [[0, false], [21, true], [null, '']] },
  ] }],
});

test('report normalization snapshots typed activity evidence and preserves zero, false and multiline answers', () => {
  const input = fixture(), actual = Report.normalize(input, NOW);
  input.sections[0].items[0].value = 'changed after capture';
  input.student.name = 'Different Student';
  assert.equal(actual.status, 'final');
  assert.equal(actual.student.name, 'Example Student');
  assert.equal(actual.exportedAt, NOW.toISOString());
  assert.equal(actual.keyResults[0].value, '0');
  assert.equal(actual.sections[0].items[0].value, 'First line\nSecond <tag> & line');
  assert.deepEqual(actual.sections[0].items[1].rows, [['0', 'false'], ['21', 'true'], ['', '']]);
});
test('disagreeing missing list, no evidence and unrecognized status never show completed', () => {
  const withMissing = Report.normalize({ ...fixture(), missing: ['Write a claim', ' Write a claim ', 'Finish two trials'] }, NOW);
  assert.equal(withMissing.status, 'draft');
  assert.deepEqual(withMissing.missing, ['Write a claim', 'Finish two trials']);
  assert.equal(Report.normalize({ ...fixture(), sections: [], keyResults: [] }, NOW).status, 'draft');
  assert.equal(Report.normalize({ ...fixture(), status: 'constructor' }, NOW).status, 'draft');
});
test('anonymous has no generated name, identity or Dataset ID and recovery never becomes final', () => {
  const r = Report.normalize({ ...fixture(), status: 'recovery', student: null, datasetId: '' }, NOW);
  assert.deepEqual(r.student, { name: '', period: '' });
  assert.equal(r.datasetId, '');
  assert.equal(r.status, 'recovery');
  assert.equal(r.allowIdentityEdit, false);
  assert.equal(Report.normalize({ ...fixture(), allowIdentityEdit: false, student: null }, NOW).allowIdentityEdit, false);
  assert.equal(Report.normalize({ ...fixture(), status: 'draft', student: null }, NOW).allowIdentityEdit, true);
  assert.equal(r.sections[0].items[1].rows[0][0], '0');
});
test('invalid evidence shapes fail rather than silently omitting data from the report', () => {
  const bad = fixture();
  bad.sections[0].items[1].rows.push(['misaligned']);
  assert.throws(() => Report.normalize(bad, NOW), /table row/);
  assert.throws(() => Report.normalize({ ...fixture(), keyResults: [{ label: 'Student note', value: { text: 'do not lose' } }] }, NOW), /Report values/);
  assert.throws(() => Report.normalize({ ...fixture(), source: '' }, NOW), /report source/);
});
test('Word contract creates editable typed runs, tables and repeated headers without AP resume data', async () => {
  class MockNode { constructor(options) { this.options = options; } }
  class TableRow extends MockNode {}
  const D = new Proxy({ Packer: { toBlob: output => output }, TableRow,
    HeadingLevel: { TITLE: 'title', HEADING_1: 'h1', HEADING_2: 'h2' },
    WidthType: { PERCENTAGE: '%' }, ShadingType: { CLEAR: 'clear' }, BorderStyle: { SINGLE: 'single' },
    PageNumber: { CURRENT: 'CURRENT', TOTAL_PAGES: 'TOTAL_PAGES' }, AlignmentType: { RIGHT: 'right' },
  }, { get: (obj, key) => obj[key] || MockNode });
  const document = await Report.word(Report.normalize(fixture(), NOW), D);
  function findRow(value) {
    if (value instanceof TableRow && value.options.tableHeader) return true;
    if (value != null && typeof value === 'object') return Object.values(value).some(findRow);
    return false;
  }
  const json = JSON.stringify(document);
  assert.match(json, /ACTIVITY COMPLETE/);
  assert.match(json, /This does not show who did the work or how well/);
  assert.match(json, /Second <tag> & line/);
  assert.match(json, /Example Student/);
  assert.match(json, /Simulated trial/);
  assert.match(json, /Page /);
  assert.doesNotMatch(json, /aplab_payload|LB1/);
  assert.ok(findRow(document));
});

function mountedReport(options = {}) {
  const fs = require('node:fs');
  const vm = require('node:vm');
  const Guard = require('../openscied-save-session.js');
  class Node {
    constructor(tag) {
      Object.assign(this, { tag, children: [], handlers: {}, className: '',
        classList: { add() {}, remove() {} } });
    }
    append(...nodes) { nodes.forEach(n => { n.parent = this; this.children.push(n); }); }
    after(n) { n.parent = this.parent; this.parent.children.splice(this.parent.children.indexOf(this) + 1, 0, n); }
    replaceChildren(...nodes) { this.children = []; this.append(...nodes); }
    replaceWith(n) { this.after(n); this.remove(); }
    remove() { if (this.parent) this.parent.children.splice(this.parent.children.indexOf(this), 1); }
    setAttribute() {}
    addEventListener(key, fn) { this.handlers[key] = fn; }
    click() { if (this.download) downloads.push(this.download); this.handlers.click?.(); }
    focus() {}
    showModal() { this.open = true; }
    querySelector(sel) { return this.all().find(n => n.className.split(' ').includes(sel.slice(1))); }
    all() { return [this, ...this.children.flatMap(n => n.all())]; }
    getClientRects() { return [1]; }
    getContext() { return null; }
  }
  function copyNode(n) {
    const copy = Object.assign(new Node(n.tag), { className:n.className, id:n.id, textContent:n.textContent });
    copy.append(...n.children.map(copyNode));
    return copy;
  }
  const createDocument = () => ({ body: new Node('body'), head: new Node('head'), createElement: tag => new Node(tag),
    documentElement: { lang:'en' }, importNode: copyNode, baseURI:'https://example.test/activity', querySelectorAll: () => [] });
  const doc = createDocument();
  const events = {}, downloads = [], printed = [], tabPrinted = [], work = new Map();
  const printTab = { document:createDocument(), opener: {}, print: () => tabPrinted.push('print'), close() {} };
  let popupAttempts = 0;
  let owner = { name: 'Original Student', period: '4' };
  const storage = { getItem: k => work.get(k) ?? null, setItem: (k, v) => work.set(k, v), removeItem: k => work.delete(k) };
  const key = 'aplab:openscied:b1-carrying:fixture';
  const guard = Guard.open(storage, 'b1-carrying', [key]);
  guard.read(key);
  assert.ok(guard.write(key, 'fictional saved work').ok);
  const identify = Guard.reportIdentity(guard, [key], () => owner);
  const collect = () => ({ ...fixture(), student: identify(), status: guard.check(key).ok ? 'final' : 'recovery' });
  let startPack;
  const packStarted = new Promise(resolve => { startPack = resolve; });
  let release;
  const pack = new Promise(resolve => { release = resolve; });
  class WordNode { constructor(options) { this.options = options; } }
  const window = {
    document: doc, print: () => printed.push(doc.body.querySelector('.osr-label').textContent),
    open() { popupAttempts++; return options.popupBlocked ? null : printTab; },
    addEventListener: (key, fn) => { events[key] = fn; }, removeEventListener: key => delete events[key],
    URL: { createObjectURL: () => 'blob:test', revokeObjectURL() {} }, setTimeout() {},
    docx: new Proxy({ Packer: { toBlob: () => { startPack(); return pack; } } },
      { get: (obj, key) => key === 'then' ? undefined : obj[key] || WordNode }),
  };
  vm.runInNewContext(fs.readFileSync(require.resolve('../openscied-submission-report.js'), 'utf8'), { window, URL });
  const target = new Node('target'); doc.body.append(target);
  window.OpenSciEdSubmission.mount({ target, collect, printInNewTab:options.printInNewTab }).open();
  return {
    doc, events, downloads, printed, packStarted, release, printTab, tabPrinted,
    get popupAttempts() { return popupAttempts; },
    retire() {
      assert.ok(Guard.invalidate(storage).ok);
      storage.removeItem(key); owner = { name: 'Other Student', period: '2' };
      assert.equal(collect().status, 'recovery');
      assert.equal(collect().student.name, 'Original Student');
    },
    button: text => doc.body.all().find(n => n.tag === 'button' && n.textContent === text),
  };
}

test('an open preview must downgrade before the PDF button or native print can export retired work', () => {
  for (const nativePrint of [false, true]) {
    const f = mountedReport();
    assert.equal(f.doc.body.querySelector('.osr-label').textContent, 'Activity complete');
    f.retire();
    if (nativePrint) f.events.beforeprint?.();
    else f.button('Print or save as PDF').click();
    assert.equal(f.doc.body.querySelector('.osr-label').textContent, 'Recovered work');
    assert.deepEqual(f.printed, []);
    assert.ok(f.doc.body.all().some(n => n.textContent === 'Original Student'));
    assert.ok(!f.doc.body.all().some(n => n.textContent === 'Other Student'));
    assert.equal(f.doc.body.querySelector('.osr-identity-editor'), undefined);
    f.button('Print or save as PDF').click();
    assert.deepEqual(f.printed, ['Recovered work']);
  }
});

test('Word packing revalidates the open snapshot before download', async () => {
  const f = mountedReport();
  const wordButton = f.button('Download Word (.docx)') || f.button('Download .docx');
  wordButton.click();
  await f.packStarted;
  f.retire();
  f.release({});
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(f.downloads, [], 'completion file was not downloaded after handoff');
  assert.equal(f.doc.body.querySelector('.osr-label').textContent, 'Recovered work');
  wordButton.click();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(f.downloads, ['ecosystem-report-recovery.docx']);
});

test('opted-in Print opens a report-only tab and never prints the live activity', () => {
  const f = mountedReport({ printInNewTab:true });
  f.button('Print or save as PDF').click();
  assert.equal(f.popupAttempts, 1);
  assert.equal(f.printTab.opener, null);
  assert.deepEqual(f.printed, []);
  const sheet = f.printTab.document.body.querySelector('.osr-print-sheet');
  assert.equal(sheet.querySelector('.osr-title').tag, 'h1');
  assert.equal(sheet.querySelector('.osr-label').textContent, 'Activity complete');
  assert.ok(sheet.all().some(n => n.textContent === 'Original Student'));
  const print = sheet.all().find(n => n.tag === 'button');
  const css = f.printTab.document.head.children.find(n => n.tag === 'link');
  assert.equal(css.href, 'https://example.test/openscied-submission-report.css');
  assert.equal(print.disabled, true);
  css.handlers.load();
  assert.equal(print.disabled, false);
  print.click();
  assert.deepEqual(f.tabPrinted, ['print']);
  assert.deepEqual(f.printed, []);
});

test('a blocked print tab keeps the report preview and offers the Word fallback', () => {
  const f = mountedReport({ printInNewTab:true, popupBlocked:true });
  f.button('Print or save as PDF').click();
  assert.equal(f.popupAttempts, 1);
  assert.deepEqual(f.printed, []);
  assert.ok(f.doc.body.all().some(n => /Allow pop-ups.*Word report/.test(n.textContent || '')));
  assert.equal(f.doc.body.querySelector('.osr-label').textContent, 'Activity complete');
});
