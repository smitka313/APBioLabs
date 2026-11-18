/* Focused regressions: run with node --test tests/audit6-followup.test.js. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

function clockContext(storage) {
  const controls = { '#clock-max': { checked: true }, '#clock-max-range': { value: '350' } };
  let graphs = 0, reports = 0;
  const context = { Lab: { $: id => controls[id], store: {
    get: key => storage[key], set: (key, value) => { storage[key] = JSON.parse(JSON.stringify(value)); }
  } }, drawClock: () => graphs++, Own: { runAll: () => reports++ } };
  const source = read('lab03.html');
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf('// Restore both controls'), source.indexOf("const clockChart = Lab.chart('#clock-chart',")), context);
  return { context, controls, calls: () => [graphs, reports] };
}

test('Lab 3 restores the selected cutoff and disabled state across reloads', () => {
  const storage = {};
  const first = clockContext(storage);
  first.controls['#clock-max-range'].value = '130';
  vm.runInContext('saveClockFitOptions()', first.context);
  assert.deepEqual(first.calls(), [1, 1]);
  const reloaded = clockContext(storage);
  assert.equal(reloaded.controls['#clock-max-range'].value, '130');
  assert.equal(reloaded.controls['#clock-max'].checked, true);
  reloaded.controls['#clock-max'].checked = false;
  vm.runInContext('saveClockFitOptions()', reloaded.context);
  const again = clockContext(storage);
  assert.equal(again.controls['#clock-max-range'].value, '130');
  assert.equal(again.controls['#clock-max'].checked, false);
});

test('Lab 3 keeps defaults for missing or invalid stored cutoffs', () => {
  for (const saved of [undefined, { cutoff: null }, { cutoff: 'bad' }, { cutoff: 601 }, { cutoff: 135 }]) {
    const instance = clockContext({ 'clock-fit-options': saved });
    assert.equal(instance.controls['#clock-max-range'].value, '350');
  }
});

const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
function linreg(x, y) {
  const mx = mean(x), my = mean(y);
  const m = x.reduce((sum, v, i) => sum + (v - mx) * (y[i] - my), 0) / x.reduce((sum, v) => sum + (v - mx) ** 2, 0);
  const b = my - m * mx;
  const r2 = 1 - y.reduce((sum, v, i) => sum + (v - (m * x[i] + b)) ** 2, 0) / y.reduce((sum, v) => sum + (v - my) ** 2, 0);
  return { m, b, r2, predict: v => m * v + b };
}

test('Lab 9 updates curve, unknown estimates and warnings on the final input before blur', () => {
  const sizes = [23130, 9416, 6557, 4361, 2322, 2027];
  const rows = sizes.map((known, i) => ({ gel: 1, dist: [5, 14, 19, 25, 33, 35][i], known: i === 5 ? null : known, sample: 'HindIII', band: i + 1 }));
  let save, targetInput, bubbleInput, analyses = 0;
  const input = { dataset: { r: '5', k: 'known' }, value: '2027', matches: selector => selector === '.mtable input[data-r]', addEventListener: (name, callback) => { if (name === 'input') targetInput = callback; } };
  function element() { return { innerHTML: '', value: '', checked: true, addEventListener() {}, insertAdjacentHTML(where, html) { this.innerHTML += html; } }; }
  const els = { '.fits': element(), '.curve': element(), '.est': element(), '.meas-err': element(), '.excl input': element(), '.gsel': element() };
  const mroot = { addEventListener: (name, callback) => { if (name === 'input') bubbleInput = callback; }, querySelectorAll: () => [], querySelector: () => null };
  const context = {
    measSel: '#meas1', P: 'g1', GEL_MM: 70, esc: String,
    cfg: { onAnalyze: () => analyses++ }, reportFrags: () => {},
    meas: { getRows: () => rows },
    rows, cols: [{ key: 'known', num: true }], opts: { save: 'g1-meas' }, el: {},
    $$: () => [input], store: { set: (key, value) => { save = JSON.parse(JSON.stringify(value)); } },
    Lab: { $: selector => selector === '#meas1' ? mroot : els[selector], fmt: (value, digits) => Number(value).toFixed(digits), store: { get: () => undefined, set() {} }, stats: { mean, se: a => Math.sqrt(a.reduce((sum, v) => sum + (v - mean(a)) ** 2, 0) / (a.length - 1) / a.length), linreg } }
  };
  vm.createContext(context);
  const shared = read('lab.js');
  const startInput = shared.indexOf("      $$('input[data-r]', el).forEach(inp => inp.addEventListener('input'");
  const endInput = shared.indexOf("      $$('input[data-r]', el).forEach(inp => inp.addEventListener('change'", startInput);
  assert(startInput >= 0 && endInput > startInput);
  vm.runInContext(shared.slice(startInput, endInput), context);
  const source = read('lab09.html');
  const start = source.indexOf('  const mroot = Lab.$(measSel);');
  const end = source.indexOf("  Lab.$('.clear', mroot).addEventListener", start);
  vm.runInContext(source.slice(start, end), context);
  vm.runInContext('analyze()', context);
  assert(els['.fits'].innerHTML.includes('Extrapolation warning'));
  assert(els['.est'].innerHTML.includes('HindIII'));
  const previous = analyses;
  targetInput(); // Real Lab.table input listener saves the last typed cell.
  assert.equal(save[5].known, 2027);
  bubbleInput({ target: input }); // The same event then bubbles to the measurement container.
  assert.equal(analyses, previous + 1);
  const expected = linreg(rows.slice(1).map(r => r.dist), sizes.slice(1).map(Math.log10));
  assert(els['.fits'].innerHTML.includes(expected.m.toFixed(4) + 'd + ' + expected.b.toFixed(3)));
  assert(!els['.fits'].innerHTML.includes('Extrapolation warning'));
  assert(!els['.est'].innerHTML.includes('HindIII'));
  bubbleInput({ target: { matches: () => false } });
  assert.equal(analyses, previous + 1); // unrelated controls do not trigger a measurement update
  input.value = '';
  targetInput(); bubbleInput({ target: input });
  assert.equal(save[5].known, null);
  assert(els['.est'].innerHTML.includes('HindIII')); // clearing a marker withdraws it immediately too
});
