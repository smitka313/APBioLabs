/* Shared drivers for the t59 tests: for each lab, write the predictions and run each main simulation once,
   so the data tables fill. Adapted from the flows in t47-delight-labs1-7.js / t47-delight-labs8-13.js.
   Not a test on its own. Usage: const D = require('./t59-drive'); await D.RUN.lab05(page); const dump = await D.dump(page); */
const sleep = ms => new Promise(r => setTimeout(r, ms));
const fillPred = (p, key, text) => p.evaluate(([k, t]) => { const el = document.getElementById('p-' + k); if (!el) return; el.value = t; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }, [key, text]);
const setv = (p, sel, v) => p.evaluate(([s, v]) => { const e = document.querySelector(s); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, [sel, String(v)]);
const jc = (p, sel) => p.evaluate(s => document.querySelector(s).click(), sel);
const show = async (p, id) => { await p.evaluate(h => { location.hash = h; }, id); await p.waitForTimeout(500); };
const go = (p, sel) => p.evaluate(s => Lab.pages.go(document.querySelector(s)), sel);
const tlDone = (p, key, timeout = 60000) => p.waitForFunction(k => { const r = Lab.timelapse.all().find(x => x.key === k); return r && !r.recording && r.count > 2; }, key, { timeout });
const tlReady = (p, sel, timeout = 60000) => p.waitForFunction(s => /Timelapse ready/.test((document.querySelector(s + ' .tl-status') || {}).textContent || ''), sel, { timeout });
const P = 'I predict the value will increase because of the biology we studied in class.';

const RUN = {
  async lab01(p) {
    await show(p, 'grow-and-score');
    await fillPred(p, 'predict-selection', P); await fillPred(p, 'predict-design', P);
    await p.click('#autocount'); await sleep(3000);
    await show(p, 'select-and-pollinate');
    await p.click('#select-btn'); await sleep(300);
    await p.click('#pollinate'); await tlDone(p, 'pollination');
    await p.click('#grow'); await show(p, 'generation-2');
    await p.click('#score2'); await sleep(2500);
  },
  async lab02(p) {
    await show(p, 'card-model');
    for (const k of ['predict-card', 'predict-spreadsheet', 'predict-drift', 'predict-design']) await fillPred(p, k, P);
    await p.click('#card-run5'); await sleep(300);
    await show(p, 'build-the-model');
    for (const n of [16, 1000]) { await setv(p, '#ss-n', n); await p.click('#ss-recalc'); await p.click('#ss-record'); }
    await show(p, 'many-generations');
    await p.click('#mg-run'); await tlDone(p, 'genepool');
  },
  async lab03(p) {
    await show(p, 'blast-the-genes');
    await fillPred(p, 'predict-blast', P); await fillPred(p, 'predict-design', P);
    await p.click('#run-blast'); await sleep(500); await p.click('#log-blast'); await sleep(300);
  },
  async lab04(p) {
    await show(p, 'sa-v');
    for (const k of ['predict-sav', 'predict-bags', 'predict-plasmo', 'predict-soak', 'predict-design']) await fillPred(p, k, P);
    await p.click('#p1-run'); await tlDone(p, 'agar');
    await show(p, 'model-cells'); await p.click('#p2-run'); await sleep(4000);
    await show(p, 'water-potential');
    await p.evaluate(() => { for (let i = 0; i < 6; i++) { const s = document.querySelector('#p3b-as' + i); s.selectedIndex = Math.min(s.options.length - 1, i + 1); s.dispatchEvent(new Event('change', { bubbles: true })); } });
    await p.click('#p3b-run'); await sleep(4000);
  },
  async lab05(p) {
    await show(p, 'sink-disks');
    await fillPred(p, 'predict-floatassay', P); await fillPred(p, 'predict-design', P);
    await p.click('#inf-pull'); await p.waitForFunction(() => !document.querySelector('#inf-pull').disabled, null, { timeout: 20000 });
    await p.click('#inf-pour'); await show(p, 'float-assay');
    await setv(p, '#cup-speed', '0.5'); await setv(p, '#cup-len', 30);
    await p.click('#cup-run'); await tlDone(p, 'floatassay', 90000);
  },
  async lab06(p) {
    await show(p, 'microrespirometer');
    for (const k of ['predict-microresp', 'predict-gas', 'predict-design']) await fillPred(p, k, P);
    await setv(p, '#p-speed', '6');
    await p.click('#p-run'); await tlDone(p, 'microresp');
    await show(p, 'gas-sensors');
    await setv(p, '#g-sensor', 'o2'); await setv(p, '#g-contents', 'peas');
    await p.click('#g-run'); await tlDone(p, 'gasrun');
  },
  async lab07(p) {
    await show(p, 'root-tips');
    for (const k of ['predict-roottips', 'predict-meiosis', 'predict-sordaria', 'predict-design']) await fillPred(p, k, P);
    for (const t of ['control', 'lectin']) {
      await p.click('[data-treat="' + t + '"]'); await p.click('#rt-prep'); await sleep(300);
      await jc(p, '#rt-auto'); await p.click('#rt-record'); await sleep(300);
    }
    await show(p, 'sordaria'); await jc(p, '#s-auto'); await p.click('#s-record'); await sleep(300);
  },
  async lab08(p) {
    await show(p, 'transform');
    for (let i = 0; i < 9; i++) { await p.click('#do-step'); await p.waitForFunction(() => !document.querySelector('#do-step').disabled, null, { timeout: 40000 }); }
    await p.evaluate(() => { document.querySelectorAll('#pred-grid select').forEach(s => { s.value = 'white'; s.dispatchEvent(new Event('change', { bubbles: true })); }); });
    await p.click('#do-step'); await sleep(1500);
    await p.waitForFunction(() => /Colonies|Lawn|growth/i.test(document.querySelector('#plate-readouts').textContent), null, { timeout: 60000 });
    await sleep(1500);
  },
  async lab09(p) {
    await show(p, 'run-a-gel');
    await p.evaluate(() => document.querySelector('#g1-layout').click());
    await p.click('#g1-run');
    await p.waitForFunction(() => +document.querySelector('#g1-dye').textContent >= 50, null, { timeout: 90000 }).catch(() => {});   // run until the dye front is ~5 cm down the 7 cm gel
    await p.click('#g1-run'); await sleep(800);
    await p.click('#g1-stain'); await sleep(500); await p.click('#g1-skip'); await sleep(500); await p.click('#g1-stain'); await sleep(500); await p.click('#g1-skip'); await sleep(1200);
  },
  async lab10(p) {
    await show(p, 'part-1-npp');
    await go(p, '#p-p1-diagram'); await p.fill('#p-p1-diagram', P); await sleep(1300);
    await p.click('#p1-plus7'); await sleep(900);
    await p.click('#p1-harvest'); await sleep(500);
    await p.click('#p1-dry'); await tlReady(p, '#p1-timelapse', 20000); await sleep(800);
    await go(p, '#p-p2-diagram'); await p.fill('#p-p2-diagram', P); await sleep(1300);
    await p.click('#p2-run'); await tlReady(p, '#p2-timelapse', 20000); await sleep(800);
  },
  async lab11(p) {
    await show(p, 'stomata');
    await go(p, '#p-predict-stomata'); await p.fill('#p-predict-stomata', P); await sleep(1300);
    await p.click('#st-m400'); await sleep(300);
    for (let i = 0; i < 2; i++) { await p.click('#st-record'); await sleep(200); }
    await go(p, '#p-predict-water'); await p.fill('#p-predict-water', P); await sleep(1300);
    await go(p, '#tr-run'); await p.click('#tr-run'); await tlReady(p, '#tr-timelapse', 20000); await sleep(800);
  },
  async lab12(p) {
    await show(p, 'geotaxis-vial');
    await go(p, '#p-predict-vial'); await p.fill('#p-predict-vial', P); await sleep(1300);
    await p.click('#vial-run'); await tlReady(p, '#vial-timelapse', 30000); await sleep(800);
    await go(p, '#p-predict'); await p.fill('#p-predict', P); await sleep(1300);
    await go(p, '#c-run');
    await p.evaluate(() => { const c = document.querySelector('#c-pause'); if (c.checked) c.click(); });
    await p.click('#c-run'); await tlReady(p, '#ch-timelapse', 60000); await sleep(1500);
  },
  async lab13(p) {
    await show(p, 'procedure-1');
    const spec = sel => p.evaluate(s => { const b2 = document.querySelector(s + ' button[data-v="spec"]'); if (b2) b2.click(); }, sel);
    await go(p, '#p-predict-assay'); await p.fill('#p-predict-assay', P); await sleep(1300);
    await spec('#m1'); await go(p, '#p1-run');
    await p.click('#p1-run'); await tlReady(p, '#p1-timelapse', 30000); await sleep(800);
    await go(p, '#p-p2-pred'); await p.fill('#p-p2-pred', P); await sleep(1300);
    await spec('#m2'); await go(p, '#p2-run');
    await p.click('#p2-run'); await tlReady(p, '#p2-timelapse', 40000); await sleep(800);
  },
};

/* Extra steps that put rows in a SAVED data table where the main run alone does not (Lab 1 summary tables are rebuilt,
   Lab 8 records a run through the efficiency calculator, Lab 9 records band measurements). */
const SAVE_ROWS = {
  async lab01(p) { await show(p, 'design'); await p.click('#d-run'); await sleep(1500); },
  async lab08(p) {
    await p.evaluate(() => Lab.pages.go(document.querySelector('#c-count')));
    const c = await p.evaluate(() => plates['p-amp'].count);
    await setv(p, '#c-count', c); await setv(p, '#c-mass', 0.05); await setv(p, '#c-frac', 0.196); await setv(p, '#c-spread', 0.0098); await setv(p, '#c-eff', Math.round(c / 0.0098)); await setv(p, '#c-sci', '1 × 10^3');
    await jc(p, '#calc-add'); await sleep(500);
  },
  async lab09(p) {
    const lanes = await p.evaluate(() => [...document.querySelectorAll('#g1-mlane option')].map(o => o.value));
    for (const l of lanes) { await p.selectOption('#g1-mlane', l); await p.click('#g1-mall'); await sleep(100); }
  },
};
/* All registered tables (id, saved key, column keys/labels and rows) plus key results. */
const dump = p => p.evaluate(() => ({
  tables: Lab._reg.tables.map(t => ({ id: t.el.id, save: t.opts.save || null, cols: t.opts.columns.map(c => ({ key: c.key, label: c.label, unit: c.unit || '', digits: c.digits })), rows: JSON.parse(JSON.stringify(t.getRows())) })),
  keyres: Lab.keyResults(),
  datasetId: Lab.identity.seed.datasetId,
}));
module.exports = { RUN, SAVE_ROWS, dump, fillPred, setv, jc, show, go, sleep, tlDone, tlReady };
