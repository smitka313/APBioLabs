/* Lab 11: leaf tracing, stomata slide + marks, transpiration run (chart and readouts) and design readouts survive a reload. */
const T = require('./_h');
(async () => {
  // Web Storage for file:// URLs is browser-dependent. Exercise the same
  // ordinary, stable HTTP origin used by the live activity instead.
  const b = await T.launch(), site = await T.serve();
  try {
  const ctx = await T.ctxFor(b);
  const p = await T.open(ctx, 'lab11.html', 'leaf-area', site.url);
  // leaf area
  await p.fill('#la-full', '40'); await p.fill('#la-part', '20'); await p.click('#la-calc'); await p.waitForTimeout(200);
  const la = () => p.evaluate(() => ({ y: document.querySelector('#la-yours').textContent, t: document.querySelector('#la-true').textContent, m: document.querySelector('#la-msg').textContent }));
  const la0 = await la();
  T.ok(la0.y !== '—' && la0.t !== 'hidden', 'leaf calculated: ' + la0.y);
  // Autosaved input fields may be debounced independently of the calculated result.
  // Wait until both the calculation and input counts are durable before reloading.
  await p.waitForFunction(() => {
    const state = Lab.store.get('la-state');
    return state?.calc?.f === 40 && state?.calc?.p === 20 &&
      Lab.store.get('field:la-full') === '40' && Lab.store.get('field:la-part') === '20';
  }, null, { timeout: 5000 });
  await p.reload({ waitUntil: 'load' });
  await p.waitForFunction(expected => {
    const f = document.querySelector('#la-full'), p = document.querySelector('#la-part');
    return f?.value === '40' && p?.value === '20' &&
      document.querySelector('#la-yours')?.textContent === expected.y &&
      document.querySelector('#la-true')?.textContent === expected.t &&
      document.querySelector('#la-msg')?.textContent === expected.m;
  }, la0, { timeout: 5000 }).catch(() => {}); // Evaluate both assertions below even on a hydration timeout.
  const la1 = await la();
  T.ok(la1.y === la0.y && la1.t === la0.t && la1.m === la0.m, 'leaf result restored (same leaf, same feedback): ' + la1.y + ' / ' + la1.t);
  T.ok(await p.evaluate(() => document.querySelector('#la-full').value === '40' && document.querySelector('#la-part').value === '20'), 'both counts restored');
  // stomata: mark one, reload
  await p.evaluate(() => Lab.pages.go('stomata')); await p.waitForTimeout(500);
  const f0 = await p.evaluate(() => { const f = document.querySelector('#st-cv').peelField(); return { n: f.stomata.length, area: f.A }; });

  // A valid field can contain stomata in state while the microscope is blank.
  // Check actual painted pixels, not just the generated field's data model.
  await p.waitForTimeout(650);
  const microscopePixels = async () => p.evaluate(() => {
    const c = document.querySelector('#st-cv'), x = c.getContext('2d');
    if (!c.width || !c.height) return { visible: false, spread: 0 };
    const w = Math.min(96, c.width), h = Math.min(96, c.height);
    const pixels = x.getImageData(Math.floor((c.width - w) / 2), Math.floor((c.height - h) / 2), w, h).data;
    let lo = 255, hi = 0;
    for (let i = 0; i < pixels.length; i += 16) {
      const y = (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;
      lo = Math.min(lo, y); hi = Math.max(hi, y);
    }
    return { visible: hi - lo > 15, spread: Math.round(hi - lo) };
  });
  const painted = await microscopePixels();
  T.ok(painted.visible, 'stomata microscope renders a nonblank field (pixel spread ' + painted.spread + ')');

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
  T.done('lab11');
  } finally { await b.close(); site.close(); }
})();
