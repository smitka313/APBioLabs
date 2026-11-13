/* Audit 3, Lab 10: while a harvest is in the oven (tile "drying…", e.g. 38 of 48 h) its dry point must not be on the graph or in the
   Reflect snapshot, and the page must say that the harvest is still drying (an earlier day-28 point is otherwise indistinguishable from it).
   LAB10_FILE overrides the page under test. */
const T = require('./_h');
(async () => {
  const b = await T.launch(), ctx = await T.ctxFor(b, { width: 1920, height: 1080 });
  const p = await T.open(ctx, process.env.LAB10_FILE || 'lab10.html', 'part-1-npp');
  const state = () => p.evaluate(() => {
    const ch = document.querySelector('#p1-chart'), snap = document.querySelector('#reflect-compare');
    const get = re => { const k = Object.keys(localStorage).find(k => re.test(k)); return k ? JSON.parse(localStorage.getItem(k)) : null; };
    return { tile: document.querySelector('#p1-rd').textContent, status: document.querySelector('#p1-status').textContent,
      pts: ch.querySelectorAll('circle').length, chartText: ch.textContent.replace(/\s+/g, ' '),
      snap: snap ? snap.textContent.replace(/\s+/g, ' ') : '', sum: get(/p1sum$/) };
  });
  const drySettled = () => p.waitForFunction(() => !document.querySelector('#p1-rd').textContent.includes('drying'), null, { timeout: 15000 });
  await p.evaluate(() => { const t = document.querySelector('#p-p1-diagram'); t.value = 'energy in from light, out as respiration and biomass'; t.dispatchEvent(new Event('input', { bubbles: true })); });
  for (let i = 0; i < 4; i++) { await p.click('#p1-plus7'); await p.waitForTimeout(700); }   // day 28
  // first harvest: single point must not exist at 38 h
  await p.click('#p1-harvest'); await p.waitForTimeout(400); await p.click('#p1-dry');
  await p.waitForFunction(() => /Oven at 100 °C… 3[6-9] h/.test(document.querySelector('#p1-status').textContent), null, { timeout: 10000 });
  let s = await state();
  T.ok(/drying/.test(s.tile) && s.pts === 0, 'harvest 1 at ~38 h: tile says drying, graph has no point (' + s.pts + ')');
  T.ok(!/Mean dry mass per plant: \d/.test(s.snap), 'harvest 1 at ~38 h: Reflect snapshot has no dry mass yet');
  await drySettled(); await p.waitForTimeout(300);
  const one = await state();
  T.ok(one.pts === 1, 'harvest 1 plotted after drying finishes');
  // second harvest the same day: the day-28 point on the graph is harvest 1; the page must say harvest 2 is still drying
  await p.click('#p1-harvest'); await p.waitForTimeout(400); await p.click('#p1-dry');
  await p.waitForFunction(() => /Oven at 100 °C… 3[6-9] h/.test(document.querySelector('#p1-status').textContent), null, { timeout: 10000 });
  s = await state();
  T.ok(s.pts === one.pts && s.sum.length === 1, 'harvest 2 at ~38 h: no new point (' + one.pts + ' -> ' + s.pts + ')');
  T.ok(/still drying/i.test(s.chartText), 'graph says harvest 2 is still drying');
  T.ok(/still in the oven/i.test(s.snap), 'Reflect snapshot says harvest 2 is still in the oven');
  await drySettled(); await p.waitForTimeout(300);
  s = await state();
  T.ok(s.pts === 2 && !/still drying/i.test(s.chartText) && !/still in the oven/i.test(s.snap), 'after drying: second point, notes gone');
  await b.close(); T.done('lab10 dry');
})();
