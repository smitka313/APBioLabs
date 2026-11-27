/* A direct Submit visit must count work restored after the report bar mounts. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '..', 'lab.js'), 'utf8');

function runStartup(readyState) {
  const sections = [], loads = [], listeners = [], saveListeners = [];
  const SAVE = { ok: true };
  let transferVisits = 0;
  // Minimal DOM for the production renderer: preserve its real text and counts.
  function h(tag, attrs, ...children) {
    return {
      tag, attrs, children: children.flat().filter(x => x != null),
      append(...items) { this.children.push(...items.flat()); },
      set textContent(value) { this.children = value ? [value] : []; },
      get textContent() { return this.children.map(x => typeof x === 'object' ? x.textContent : String(x)).join(''); }
    };
  }
  const sandbox = {
    document: { readyState, querySelectorAll: () => sections },
    window: { addEventListener(type, fn, opts) {
      if (type === 'blb:save-state') { saveListeners.push(fn); return; }
      assert.equal(type, 'load'); assert.equal(opts.once, true); loads.push(fn);
    } },
    SAVE, moveTo: () => { transferVisits++; }, queueMicrotask: fn => fn(),
    h, REG: { quizzes: [], tables: [] }, STEPBOXES: [],
    $$: (selector, sec) => { assert.equal(selector, 'textarea[data-save]'); return sec.fields; },
    workListeners: listeners, Lab: { onShow() {} }
  };
  vm.createContext(sandbox);
  const counts = source.slice(source.indexOf('  function sectionWork(sec) {'), source.indexOf('  /* Simulation steps (Lab.steps)'));
  assert.ok(counts.startsWith('  function sectionWork'));
  vm.runInContext(counts, sandbox);
  const begin = source.indexOf("    const readiness = h('div'");
  const end = source.indexOf('    const ss = saveStatusEl();', begin);
  assert.ok(begin > 0 && end > begin);
  const renderer = source.slice(begin, end);
  const field = { value: 'My restored evidence', closest: () => null };
  const sec = { id: 'reflect', dataset: { step: 'Reflect' }, fields: [field] };
  if (readyState === 'complete') sections.push(sec);
  // Execute the actual response-bar renderer at its real startup point.
  vm.runInContext(renderer + '\nglobalThis.region = readiness; globalThis.saveRegion = localWork;', sandbox);
  const startup = sandbox.region.textContent;
  if (readyState !== 'complete') sections.push(sec); // page-local scripts restore later
  for (const fn of loads) fn();
  const savedCopy = sandbox.saveRegion.children[0].textContent;
  sandbox.saveRegion.children[1].attrs.onclick();
  SAVE.ok = false;
  assert.equal(saveListeners.length, 1);
  for (const update of saveListeners) update();
  return { startup, text: sandbox.region.textContent, loads: loads.length,
    savedCopy, failedCopy: sandbox.saveRegion.children[0].textContent, transferVisits };
}

test('direct Submit startup includes controls and answers restored after response-bar creation', () => {
  const result = runStartup('loading');
  assert.match(result.startup, /0 of 0 sections/); // reproduces the premature snapshot
  assert.match(result.text, /1 of 1 sections with all tracked activities complete/);
  assert.match(result.text, /All tracked activities are complete/);
});

test('a report bar mounted after load renders existing restored work immediately', () => {
  const result = runStartup('complete');
  assert.match(result.text, /1 of 1 sections with all tracked activities complete/);
  assert.equal(result.loads, 0); // no dependency on a load event that already fired
});


test('Submit separates successful local saving, save failure, and the move-work action', () => {
  const result = runStartup('complete');
  assert.match(result.savedCopy, /in this browser only; it has not been sent to your teacher/);
  assert.match(result.failedCopy, /latest changes may not be saved.*preview a report/);
  assert.equal(result.transferVisits, 1);
});
