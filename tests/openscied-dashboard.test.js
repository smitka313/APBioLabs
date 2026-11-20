const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../openscied-dashboard.js'), 'utf8');
function setup(blocked = false) {
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
