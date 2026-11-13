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
