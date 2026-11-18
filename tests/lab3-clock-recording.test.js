/* Execute the real Add-all handler against retained, repeated and refreshed searches. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '..', 'lab03.html'), 'utf8');
const clone = value => JSON.parse(JSON.stringify(value));
const labels = { human: 'Human', chimp: 'Chimpanzee', mouse: 'Mouse', frog: 'Frog' };
const ages = { chimp: 6.5, mouse: 80, frog: 300 };
const hit = (id, ident) => ({ id, ident, bits: ident * 2 });
const search = (gene = 'A', hits = [hit('chimp', 99.675), hit('mouse', 96), hit('frog', 85)]) => ({ gene, org: 'human', hits });

function regression(x, y) {
  const mean = values => values.reduce((a, b) => a + b, 0) / values.length;
  const mx = mean(x), my = mean(y);
  const m = x.reduce((sum, value, i) => sum + (value - mx) * (y[i] - my), 0) /
    x.reduce((sum, value) => sum + (value - mx) ** 2, 0);
  const b = my - m * mx;
  return { m, b, predict: value => m * value + b };
}

function setup(saved = [], result = search()) {
  let rows = clone(saved), writes = 0, refreshes = 0, handler;
  const status = { textContent: '', className: '' }, out = { insertAdjacentHTML() {} };
  const els = { '#d-log': { addEventListener(name, fn) { assert.equal(name, 'click'); handler = fn; } },
    '#d-status': status, '#d-out': out, '#clock-max': { checked: true }, '#clock-max-range': { value: '350' } };
  const table = { getRows: () => rows, setRows(value) { rows = clone(value); writes++; } };
  const ctx = { dRes: result, clockTable: table, orgLabel: id => labels[id],
    mrcaAge: (query, id) => ages[id], Own: { runAll() { refreshes++; } },
    Lab: { $: selector => els[selector], sound: { play() {} }, stats: { linreg: regression } } };
  vm.createContext(ctx);
  const start = source.indexOf("Lab.$('#d-log').addEventListener('click',");
  const end = source.indexOf('// Restore both controls', start);
  assert.ok(start > 0 && end > start);
  vm.runInContext(source.slice(start, end), ctx);
  vm.runInContext(source.slice(source.indexOf('function clockFitRows('), source.indexOf('function drawClock(')), ctx);
  return { click: () => handler(), rows: () => clone(rows), status,
    result(value) { ctx.dRes = value; }, calls: () => ({ writes, refreshes }),
    fit: () => vm.runInContext('selectedClockFit()', ctx) };
}

test('repeated Add-all clicks and reloads keep one row per hit and a stable fitted count', () => {
  const first = setup();
  first.click();
  const recorded = first.rows();
  first.click();
  assert.deepEqual(first.rows(), recorded);
  assert.equal(first.fit().rows.length, 3);
  assert.ok(Math.abs(first.fit().fit.m + 0.05) < 1e-12);
  const reload = setup(first.rows());
  reload.click();
  assert.deepEqual(reload.rows(), recorded);
  assert.equal(reload.fit().rows.length, 3);
  assert.match(reload.status.textContent, /Refreshed 3 clock comparisons/);
});

test('new search replaces conflicting retained values and duplicates for its query/gene', () => {
  const stale = [
    { gene: 'A', q: 'Human', hit: 'Chimpanzee', t: 6.5, ident: 97.6, bits: 190 },
    { gene: 'A', q: 'Human', hit: 'Chimpanzee', t: 6.5, ident: 98.3, bits: 195 },
    { gene: 'A', q: 'Human', hit: 'Mouse', t: 80, ident: 90, bits: 180 }
  ];
  const instance = setup(stale);
  instance.click();
  assert.equal(instance.rows().length, 3);
  assert.equal(instance.rows().filter(r => r.hit === 'Chimpanzee').length, 1);
  assert.equal(instance.rows()[0].ident, 99.675);
  assert.equal(instance.rows()[0].bits, Math.round(99.675 * 2));
  assert.equal(instance.fit().rows.length, 3);
  assert.ok(Math.abs(instance.fit().fit.m + 0.05) < 1e-12);
  assert.match(instance.status.textContent, /replaced 3 previously recorded rows/);
  assert.deepEqual(instance.calls(), { writes: 1, refreshes: 1 });
});

test('refreshing a query/gene preserves other genes and queries exactly', () => {
  const others = [
    { gene: 'B', q: 'Human', hit: 'Chimpanzee', t: 6.5, ident: 92, bits: 184 },
    { gene: 'A', q: 'Mouse', hit: 'Human', t: 80, ident: 90, bits: 180 }
  ];
  const instance = setup(others.concat({ gene: 'A', q: 'Human', hit: 'Frog', t: 300, ident: 75 }));
  instance.click();
  assert.deepEqual(instance.rows().slice(0, 2), others);
  instance.result(search('B'));
  instance.click();
  assert.equal(instance.rows().filter(r => r.gene === 'A' && r.q === 'Human').length, 3);
  assert.equal(instance.rows().filter(r => r.gene === 'B' && r.q === 'Human').length, 3);
  assert.deepEqual(instance.rows().find(r => r.q === 'Mouse'), others[1]);
});

test('a changed target selection refreshes the active comparison group', () => {
  const instance = setup();
  instance.click();
  instance.result(search('A', [hit('chimp', 98.3)]));
  instance.click();
  assert.equal(instance.rows().length, 1);
  assert.equal(instance.rows()[0].ident, 98.3);
});

test('duplicate targets in a result are recorded once', () => {
  const instance = setup([], search('A', [hit('chimp', 98.3), hit('chimp', 98.3)]));
  instance.click();
  assert.equal(instance.rows().length, 1);
});

test('missing, pasted and empty searches keep retained work intact', () => {
  const saved = [{ gene: 'B', q: 'Human', hit: 'Mouse', t: 80, ident: 80, bits: 160 }];
  for (const result of [null, { ...search(), org: 'pasted' }, search('A', [])]) {
    const instance = setup(saved, result);
    instance.click();
    assert.deepEqual(instance.rows(), saved);
    assert.deepEqual(instance.calls(), { writes: 0, refreshes: 0 });
  }
});
