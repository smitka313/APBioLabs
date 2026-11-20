const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../openscied-dashboard.js'), 'utf8');
function setup(blocked = false, overrides = {}) {
  const elements = new Map();
  function element() {
    const handlers = {};
    return { value: '', disabled: false, textContent: '', open: false,
      addEventListener(type, fn) { handlers[type] = fn; },
      fire(type) { handlers[type]?.({ preventDefault() {} }); },
      showModal() { this.open = true; }, close() { this.open = false; },
      click() {}, remove() {} };
  }
  const data = { 'aplab:openscied:b3-cell-cycle:v1': '{"trials":[1]}',
    'aplab:openscied:future-activity:v1': '{"answer":"saved"}',
    'aplab:student': '{"name":"Student","period":"2"}',
    'aplab:lab05:results': '{"rate":4}', 'aplab:pref:theme': '"dark"',
    'aplab:openscied-other:keep': 'unrelated' };
  Object.assign(data, overrides);
  const storage = blocked ? new Proxy({}, { ownKeys() { throw new Error('Storage blocked'); } }) : data;
  Object.defineProperty(data, 'getItem', { value: key => data[key] ?? null });
  Object.defineProperty(data, 'removeItem', { value: key => { delete data[key]; } });
  let mounted = '', blob;
  const context = { document: { readyState: 'complete',
      querySelector(selector) { if (!elements.has(selector)) elements.set(selector, element()); return elements.get(selector); },
      createElement: element, body: { appendChild() {} } },
    Lab: { identity: { mount(selector) { mounted = selector; }, get: () => ({ name: 'Student', period: '2' }) } },
    localStorage: storage, window: { addEventListener() {} }, Blob,
    URL: { createObjectURL(value) { blob = value; return 'blob:backup'; }, revokeObjectURL() {} }, setTimeout() {} };
  vm.runInNewContext(source, context);
  return { data, el: selector => elements.get(selector), mounted, blob: () => blob };
}
test('mounts the shared sign-in and confirms an OpenSciEd-only reset', () => {
  const s = setup(), before = { ...s.data };
  assert.equal(s.mounted, '#openscied-student-identity');
  s.el('#clear-openscied-results').fire('click');
  assert.equal(s.el('#clear-openscied-dialog').open, true);
  assert.equal(s.el('#confirm-openscied-clear').disabled, true);
  s.el('#cancel-openscied-clear').fire('click');
  assert.deepEqual({ ...s.data }, before, 'cancel must preserve every saved result');
  s.el('#clear-openscied-results').fire('click');
  s.el('#openscied-erase-confirmation').value = 'erase';
  s.el('#openscied-erase-confirmation').fire('input');
  s.el('#clear-openscied-form').fire('submit');
  assert.deepEqual({ ...s.data }, before, 'incorrect confirmation cannot erase');
  s.el('#openscied-erase-confirmation').value = 'ERASE';
  s.el('#openscied-erase-confirmation').fire('input');
  assert.equal(s.el('#confirm-openscied-clear').disabled, false);
  s.el('#clear-openscied-form').fire('submit');
  assert.deepEqual(Object.keys(s.data).sort(), Object.keys(before).filter(k => !k.startsWith('aplab:openscied:')).sort());
  for (const key of Object.keys(s.data)) assert.equal(s.data[key], before[key]);
  assert.equal(s.el('#clear-openscied-dialog').open, false);
  assert.equal(s.el('#clear-openscied-results').disabled, true);
});
test('backup includes exact OpenSciEd values and identity without erasing results', async () => {
  const s = setup(), before = { ...s.data };
  s.el('#download-openscied-results').fire('click');
  const payload = JSON.parse(await s.blob().text());
  assert.equal(payload.student.name, 'Student');
  assert.equal(payload.format, 'openscied-saved-work-v1');
  assert.deepEqual(payload.work, Object.fromEntries(Object.entries(before).filter(([k]) => k.startsWith('aplab:openscied:'))));
  assert.deepEqual({ ...s.data }, before);
});
test('blocked browser storage disables actions and explains the problem', () => {
  const s = setup(true);
  assert.equal(s.el('#clear-openscied-results').disabled, true);
  assert.equal(s.el('#download-openscied-results').disabled, true);
  assert.match(s.el('#openscied-results-status').textContent, /cannot access saved work/);
});
test('progress counts saved rounds, trial sets, and written answers; resume targets the saved section', () => {
  const saved = { v: 1, game: { round: 2, roundResults: { 1: { divisions: 1 } } },
    trials: [{}, {}, {}, {}, {}, {}], fields: { 'analysis-design': 'Controlled settings',
      'analysis-variation': 'Repeated trials', explanation: 'Longer time', 'model-prediction': '   ' },
    lastSection: 'analyze', lastVisitedAt: 123 };
  const s = setup(false, { 'aplab:openscied:b3-cell-cycle:v1': JSON.stringify(saved) });
  assert.match(s.el('#cell-cycle-progress').textContent, /Round 1 complete.*2 trial sets saved.*3 of 8 responses/);
  assert.equal(s.el('#openscied-resume').hidden, false);
  assert.equal(s.el('#openscied-resume-link').href, 'openscied-b3-cell-cycle.html#analyze');
});
test('legacy saves resume at the relevant section and saved strings cannot change the destination', () => {
  const s = setup(false, { 'aplab:openscied:b3-cell-cycle:v1': JSON.stringify({ v: 1,
    game: { round: 1 }, lastSection: '//untrusted.example', fields: {} }) });
  assert.equal(s.el('#openscied-resume-link').href, 'openscied-b3-cell-cycle.html#cell-game');
  assert.match(s.el('#cell-cycle-progress').textContent, /Round 1 in progress/);
});
test('per-activity restart preserves other OpenSciEd activities and offers a scoped backup', async () => {
  const s = setup(), before = { ...s.data };
  s.el('#cell-cycle-reset').fire('click');
  assert.match(s.el('#clear-openscied-title').textContent, /Restart Cell Cycle/);
  s.el('#backup-before-openscied-clear').fire('click');
  const payload = JSON.parse(await s.blob().text());
  assert.deepEqual(Object.keys(payload.work), ['aplab:openscied:b3-cell-cycle:v1']);
  s.el('#openscied-erase-confirmation').value = 'ERASE';
  s.el('#clear-openscied-form').fire('submit');
  assert.equal(s.data['aplab:openscied:b3-cell-cycle:v1'], undefined);
  for (const key of Object.keys(s.data)) assert.equal(s.data[key], before[key]);
  assert.equal(s.el('#cell-cycle-reset').disabled, true);
  assert.equal(s.el('#openscied-resume').hidden, true);
  assert.equal(s.el('#cell-cycle-progress').textContent, 'Not started');
});
test('unreadable work stays downloadable and resettable without showing a misleading Resume link', () => {
  const s = setup(false, { 'aplab:openscied:b3-cell-cycle:v1': '{broken json' });
  assert.match(s.el('#cell-cycle-progress').textContent, /could not be read/);
  assert.equal(s.el('#openscied-resume').hidden, true);
  assert.equal(s.el('#cell-cycle-reset').disabled, false);
});
