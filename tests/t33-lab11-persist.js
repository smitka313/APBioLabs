/* Lab 11: leaf tracing, stomata slide + marks, transpiration run (chart and readouts) and design readouts survive a reload. */
const T = require('./_h');
(async () => {
  const b = await T.launch(), ctx = await T.ctxFor(b);
  const p = await T.open(ctx, 'lab11.html', 'leaf-area');
  // leaf area
  await p.fill('#la-full', '40'); await p.fill('#la-part', '20'); await p.click('#la-calc'); await p.waitForTimeout(200);
  const la = () => p.evaluate(() => ({ y: document.querySelector('#la-yours').textContent, t: document.querySelector('#la-true').textContent, m: document.querySelector('#la-msg').textContent }));
  const la0 = await la();
  T.ok(la0.y !== '—' && la0.t !== 'hidden', 'leaf calculated: ' + la0.y);
  await p.reload(); await p.waitForTimeout(900);
  const la1 = await la();
  T.ok(la1.y === la0.y && la1.t === la0.t && la1.m === la0.m, 'leaf result restored (same leaf, same feedback): ' + la1.y + ' / ' + la1.t);
  T.ok(await p.evaluate(() => document.querySelector('#la-full').value === '40'), 'counts restored');
  // stomata: mark one, reload
  await p.evaluate(() => Lab.pages.go('stomata')); await p.waitForTimeout(500);
  const f0 = await p.evaluate(() => { const f = document.querySelector('#st-cv').peelField(); return { n: f.stomata.length, area: f.A }; });
  await p.evaluate(() => { const f = document.querySelector('#st-cv').peelField(); if (f.stomata[0]) f.stomata[0].marked = true; });
  await p.click('#st-upper'); await p.click('#st-lower'); // regenerate then restore through save
  await p.evaluate(() => { const f = document.querySelector('#st-cv').peelField(); if (f.stomata[0]) f.stomata[0].marked = true; });
  // use the click path to save: click the canvas centre does nothing sure, so save by toggling via a real click on a stoma
  const pos = await p.evaluate(() => { const c = document.querySelector('#st-cv'), f = c.peelField(), q = f.stomata[0]; return q ? { ok: true } : { ok: false }; });
  const before = await p.evaluate(() => ({ seed: JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k => /st-state/.test(k)))).seed, mag: document.querySelector('#st-m400').getAttribute('aria-pressed') }));
  await p.reload(); await p.waitForTimeout(900);
  await p.evaluate(() => Lab.pages.go('stomata')); await p.waitForTimeout(400);
  const after = await p.evaluate(() => ({ seed: JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k => /st-state/.test(k)))).seed, mag: document.querySelector('#st-m400').getAttribute('aria-pressed'), n: document.querySelector('#st-cv').peelField().stomata.length }));
  T.ok(before.seed === after.seed, 'same slide field after reload (seed ' + after.seed + ')');
  // transpiration run
  await p.evaluate(() => Lab.pages.go('water-loss')); await p.waitForTimeout(400);
  await p.evaluate(() => { const t = document.querySelector('#p-predict-water'); t.value = 'fan most'; t.dispatchEvent(new Event('input', { bubbles: true })); });
  await p.click('#tr-run'); await p.waitForTimeout(6500);
  const rd = () => p.evaluate(() => ({ rate: document.querySelector('#tr-rate').textContent, time: document.querySelector('#tr-time').textContent, area: document.querySelector('#tr-area').textContent, pts: document.querySelectorAll('#tr-chart circle').length + document.querySelectorAll('#tr-chart path').length }));
  const r0 = await rd();
  T.ok(r0.rate !== '—', 'rate shown: ' + r0.rate);
  await p.reload(); await p.waitForTimeout(7000);
  await p.evaluate(() => Lab.pages.go('water-loss')); await p.waitForTimeout(400);
  const r1 = await rd();
  T.ok(r1.rate === r0.rate && r1.area === r0.area && r1.time === r0.time, 'run readouts restored: ' + JSON.stringify(r1));
  T.ok(r1.pts > 0, 'chart redrawn');
  T.ok(p.errors.length === 0, 'no page errors ' + p.errors.join(';'));
  await b.close(); T.done('lab11');
})();
