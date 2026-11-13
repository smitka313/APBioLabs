/* Delight features wired into Labs 1-7: timelapse records and replays (live runs), predict-vs-actual cards render with real data,
   sound calls do not throw with sound on, and no "new" badge appears after a reload.
   Run: NODE_PATH=$(npm root -g) node tests/t47-delight-labs1-7.js [lab05 lab06 ...] */
const T = require('./_h');

const only = process.argv.slice(2);
const want = n => !only.length || only.includes(n);

/* Seed sound on (a real gesture is still needed before audio starts, so every call must simply not throw). */
async function ctx(b, o = {}) {
  const c = await T.ctxFor(b, o);
  await c.addInitScript(() => { try { localStorage.setItem('aplab:pref:sound', 'on'); } catch (e) { /* ignore */ } });
  return c;
}
const fillPred = (p, key, text) => p.evaluate(([k, t]) => { const el = document.getElementById('p-' + k); el.value = t; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }, [key, text]);
const setv = (p, sel, v) => p.evaluate(([s, v]) => { const e = document.querySelector(s); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, [sel, String(v)]);
const show = async (p, id) => { await p.evaluate(h => { location.hash = h; }, id); await p.waitForTimeout(500); };
const cards = p => p.evaluate(() => Array.from(document.querySelectorAll('.pvc')).map(c => ({ quote: (c.querySelector('.pvc-quote') || {}).textContent || '', hasQuote: !c.querySelector('.pvc-quote').hidden, sum: c.querySelector('.pvc-sum').hidden ? '' : c.querySelector('.pvc-sum').textContent, what: c.querySelector('.pvc-what').textContent, wait: c.querySelector('.pvc-what').classList.contains('is-wait'), snap: !c.querySelector('.pvc-snap').hidden, link: (c.querySelector('.pvc-what a') || {}).hash || '' })));
const badges = p => p.evaluate(() => Array.from(document.querySelectorAll('.tab-badge')).filter(b => !b.hidden && b.offsetParent !== null).length);
const recCount = (p, key) => p.evaluate(k => { const r = Lab.timelapse.all().find(x => x.key === k); return r ? r.count : -1; }, key);

async function timelapse(p, key, mountSel) {
  await p.waitForFunction(k => { const r = Lab.timelapse.all().find(x => x.key === k); return r && !r.recording && r.count > 2; }, key, { timeout: 40000 });
  const n = await recCount(p, key);
  T.ok(n > 2, key + ': recorded ' + n + ' frames');
  await p.waitForTimeout(800);
  const bar = p.locator(mountSel + ' .tl-bar');
  T.ok(await bar.locator('.tl-replay').isEnabled() && await bar.locator('.tl-gif').isEnabled(), key + ': Replay and GIF buttons enabled');
  await bar.locator('.tl-replay').click();
  await p.waitForSelector('.tl-card', { timeout: 3000 });
  T.ok(/Frame \d+ of \d+/.test(await p.locator('.tl-pos').innerText()), key + ': replay opens with frames: ' + (await p.locator('.tl-pos').innerText()));
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
}

const LABS = {
  async lab05(b) {
    const c = await ctx(b), p = await T.open(c, 'lab05.html', 'sink-disks');
    await fillPred(p, 'predict-floatassay', 'I predict the bicarbonate cup will float first because it has more CO2.');
    await fillPred(p, 'predict-design', 'I predict the rate will increase as light increases because more light drives photosynthesis.');
    await p.click('#inf-pull'); await p.waitForFunction(() => !document.querySelector('#inf-pull').disabled, null, { timeout: 20000 });
    await p.click('#inf-pour'); await show(p, 'float-assay');
    await setv(p, '#cup-speed', '0.5'); await setv(p, '#cup-len', 12);
    await p.click('#cup-run');
    await timelapse(p, 'floatassay', '#cup-timelapse');
    await show(p, 'design');
    await p.click('#d-run');
    await timelapse(p, 'designrun', '#d-timelapse');
    return p;
  },
  async lab06(b) {
    const c = await ctx(b), p = await T.open(c, 'lab06.html', 'microrespirometer');
    await fillPred(p, 'predict-microresp', 'I predict the plug in the seed tube will move toward the chamber and the bead tube will not move because seeds use O2.');
    await fillPred(p, 'predict-gas', 'I predict O2 will fall and CO2 will rise because the peas respire.');
    await fillPred(p, 'predict-design', 'I predict the rate will increase as temperature increases because enzymes work faster.');
    await setv(p, '#p-speed', '6');
    await p.click('#p-run');
    await timelapse(p, 'microresp', '#p-timelapse');
    await show(p, 'gas-sensors');
    await setv(p, '#g-sensor', 'o2'); await setv(p, '#g-contents', 'peas');
    await p.click('#g-run');
    await timelapse(p, 'gasrun', '#g-timelapse');
    await show(p, 'design');
    for (const t of [10, 30]) {
      await setv(p, '#d-temp', t); await p.click('#d-run');
      await p.waitForFunction(() => !document.querySelector('#d-timelapse .tl-bar button').disabled || true, null, { timeout: 1000 });
      await p.waitForFunction(k => { const r = Lab.timelapse.all().find(x => x.key === k); return r && !r.recording && r.count > 2; }, 'designrun', { timeout: 30000 });
      await p.waitForTimeout(1200);
    }
    await timelapse(p, 'designrun', '#d-timelapse');
    return p;
  },
  async lab01(b) {
    const c = await ctx(b), p = await T.open(c, 'lab01.html', 'grow-and-score');
    await fillPred(p, 'predict-selection', 'I predict the generation 2 mean will be higher than generation 1 because I pick plants with the most hairs.');
    await fillPred(p, 'predict-design', 'I predict the selected line will increase while the control line will stay the same.');
    await p.click('#autocount');
    await show(p, 'select-and-pollinate');
    await p.click('#select-btn'); await p.waitForTimeout(300);
    await p.click('#pollinate');
    await timelapse(p, 'pollination', '#bee-timelapse');
    await p.click('#grow'); await show(p, 'generation-2');
    await p.click('#score2'); await show(p, 'design');
    await p.click('#d-run'); await p.waitForTimeout(800);
    return p;
  },
  async lab02(b) {
    const c = await ctx(b), p = await T.open(c, 'lab02.html', 'card-model');
    await fillPred(p, 'predict-card', 'I predict p will change and drift down in a small class because of chance.');
    await fillPred(p, 'predict-spreadsheet', 'I predict new p will be farther from the start with 16 zygotes than with 1000.');
    await fillPred(p, 'predict-drift', 'I predict small populations will vary and drift apart and large populations will stay the same.');
    await fillPred(p, 'predict-design', 'I predict the final p will vary less as N increases.');
    await p.click('#card-run5'); await p.waitForTimeout(300);
    await show(p, 'build-the-model');
    for (const n of [16, 16, 1000, 1000]) { await setv(p, '#ss-n', n); await p.click('#ss-recalc'); await p.click('#ss-record'); }
    await show(p, 'many-generations');
    await p.click('#mg-run');
    await timelapse(p, 'genepool', '#mg-timelapse');
    await show(p, 'design');
    await p.click('#dz-run'); await p.waitForTimeout(1200);
    return p;
  },
  async lab03(b) {
    const c = await ctx(b), p = await T.open(c, 'lab03.html', 'blast-the-genes');
    await fillPred(p, 'predict-blast', 'I predict the top hit will be the chicken with about 90% identity because birds are close to dinosaurs.');
    await fillPred(p, 'predict-design', 'I predict the percent identity will decrease as time since the common ancestor increases.');
    await p.click('#run-blast'); await p.waitForTimeout(500); await p.click('#log-blast');
    await show(p, 'design');
    await p.click('#d-run'); await p.waitForTimeout(500); await p.click('#d-log'); await p.waitForTimeout(800);
    return p;
  },
  async lab04(b) {
    const c = await ctx(b), p = await T.open(c, 'lab04.html', 'sa-v');
    await fillPred(p, 'predict-sav', 'I predict the smallest block will have the highest percent reached by acid because it has more surface for its volume.');
    await fillPred(p, 'predict-bags', 'I predict the bag with sucrose inside will gain mass and the bag with salt outside will lose mass because water moves to higher solute.');
    await fillPred(p, 'predict-plasmo', 'I predict the cells in salt will shrink and pull away from the wall because water leaves.');
    await fillPred(p, 'predict-soak', 'I predict the cores in low sucrose will gain mass and in high sucrose will lose mass because of water potential.');
    await fillPred(p, 'predict-design', 'I predict the result will increase as the level increases because of diffusion.');
    await p.click('#p1-run');
    await timelapse(p, 'agar', '#p1-timelapse');
    await show(p, 'model-cells'); await p.click('#p2-run'); await p.waitForTimeout(4000);
    await show(p, 'plasmolysis');
    await p.evaluate(() => { const s = document.querySelector('#p3a-sel'); if (s && s.options.length > 1) { s.selectedIndex = s.options.length - 1; s.dispatchEvent(new Event('change', { bubbles: true })); } });
    await p.click('#p3a-run');
    await timelapse(p, 'plasmolysis', '#p3a-timelapse');
    await p.click('#p3a-rec'); await p.waitForTimeout(300);
    await p.evaluate(() => { const i = document.querySelector('#p3a-table input[data-k="plz"]'); i.value = '12'; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); });
    await show(p, 'water-potential');
    await p.evaluate(() => { for (let i = 0; i < 6; i++) { const s = document.querySelector('#p3b-as' + i); s.selectedIndex = Math.min(s.options.length - 1, i + 1); s.dispatchEvent(new Event('change', { bubbles: true })); } });
    await p.click('#p3b-run'); await p.waitForTimeout(3500);
    await show(p, 'design');
    await p.click('#d-run'); await p.waitForTimeout(3500);
    return p;
  },
};

(async () => {
  const b = await T.launch();
  for (const n of Object.keys(LABS)) {
    if (!want(n)) continue;
    console.log('\n== ' + n);
    const p = await LABS[n](b);
    // predict cards (Evaluate or Reflect part)
    await show(p, await p.evaluate(() => { const s = Array.from(document.querySelectorAll('section.step')).find(s => /^(Evaluate|Reflect)$/.test(s.dataset.step)); return s.id; }));
    await p.waitForTimeout(800);
    const cs = await cards(p);
    T.ok(cs.length > 0, n + ': predictCompare cards render (' + cs.length + ')');
    cs.forEach((c, i) => console.log('    card ' + i + ': ' + JSON.stringify(c).slice(0, 360)));
    T.ok(cs.some(c => c.hasQuote && c.sum && !c.wait), n + ': at least one card shows the saved prediction and a real result');
    T.ok(cs.every(c => !c.link || /^#[\w-]+$/.test(c.link)), n + ': "Finish ... first" links are anchors');
    T.ok(await p.evaluate(() => !document.querySelector('.predict-quote')), n + ': old quote box is gone');
    T.ok(!p.errors.length, n + ': no page errors ' + p.errors.join(' | '));
    // reload: no new badge appears
    await p.reload(); await p.waitForTimeout(3500);
    T.ok(await badges(p) === 0, n + ': no "new" badge after reload');
    T.ok(!p.errors.length, n + ': no page errors after reload ' + p.errors.join(' | '));
    await p.context().close();
  }
  await b.close();
  T.done('t47-delight-labs1-7');
})();
