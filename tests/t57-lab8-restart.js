/* Audit 4 #3, Lab 8: "Start a new transformation" resets everything from the old run: the plates canvas, the timelapse frames,
   the saved prediction record, the Evaluate prediction cards, the colony marks. Starts from a fully erased state. LAB8_FILE overrides the page. */
const T = require('./_h');
const dist = (a, b) => a.reduce((t, v, i) => t + Math.abs(v - b[i]), 0) / a.length;   // mean per-channel difference (the plate texture is random)
(async () => {
  const b = await T.launch(), ctx = await T.ctxFor(b);
  const p = await T.open(ctx, process.env.LAB8_FILE || 'lab08.html', 'transform');
  await p.evaluate(() => { Object.keys(localStorage).filter(k => /^aplab:lab08/.test(k)).forEach(k => localStorage.removeItem(k)); });
  await p.reload(); await p.waitForTimeout(900);
  const idle = () => p.waitForFunction(() => !document.querySelector('#do-step').disabled, null, { timeout: 60000 });
  const snap = () => p.evaluate(async () => {
    const cv = document.querySelector('#plates'), tl = (Lab.timelapse.withRun ? Lab.timelapse.withRun() : []).reduce((a, r) => a + (r.count || 0), 0);
    return { canvas: (() => { const c = document.createElement('canvas'); c.width = 20; c.height = 12; const x = c.getContext('2d'); x.drawImage(cv, 0, 0, 20, 12); return [...x.getImageData(0, 0, 20, 12).data]; })(), tl, rec: JSON.stringify(Lab.store.get('plate-pred-record')), field: JSON.stringify(Lab.store.get('field:plate-pred-p-amp')),
      what: [...document.querySelectorAll('#ev-recall .pvc-what')].map(c => c.textContent).join('|'), pills: [...document.querySelectorAll('#pred-grid .pill')].filter(x => !x.hidden).length,
      sel: [...document.querySelectorAll('#pred-grid select')].map(s => s.value + (s.disabled ? '!' : '')).join(',') };
  });
  const fresh = await snap();
  for (let i = 0; i < 9; i++) { await p.click('#do-step'); await idle(); await p.waitForTimeout(100); }
  await p.evaluate(() => { document.querySelectorAll('#pred-grid select').forEach(s => { s.value = 'glow'; s.dispatchEvent(new Event('change', { bubbles: true })); }); });
  await p.click('#do-step');
  await p.waitForFunction(() => /Incubated/.test(document.querySelector('#ro-status').textContent), null, { timeout: 60000 }); await p.waitForTimeout(2500);
  const ran = await snap(); console.log('after run', JSON.stringify(ran.rec).slice(0, 80));
  T.ok(ran.rec !== 'null' && dist(ran.canvas, fresh.canvas) > 4, 'the run recorded predictions and drew plates');
  await p.click('#restart'); await p.waitForTimeout(800);
  const s = await snap(); console.log('after restart', JSON.stringify(s.rec).slice(0, 80));
  T.ok(dist(s.canvas, fresh.canvas) < 4, 'plates canvas matches the fresh (unplated) canvas: ' + dist(s.canvas, fresh.canvas).toFixed(2));
  T.ok(s.tl === 0, 'timelapse has no old frames (' + s.tl + ')');
  T.ok(s.rec === 'null', 'saved prediction record is gone: ' + s.rec);
  T.ok(s.field === 'null' || s.field === '""', 'saved field prediction is gone: ' + s.field);
  T.ok(/Finish/.test(s.what) && !/predicted/.test(s.what), 'Evaluate cards wait for the new run: ' + s.what.slice(0, 120));
  T.ok(s.pills === 0 && !/!/.test(s.sel), 'prediction boxes reset and enabled: ' + s.sel);
  await p.reload(); await p.waitForTimeout(900);
  const r = await snap(); T.ok(dist(r.canvas, fresh.canvas) < 4 && r.tl === 0 && r.rec === 'null', 'still reset after reload');
  T.ok(p.errors.length === 0, 'no page errors ' + p.errors.join(';'));
  await b.close(); T.done('lab8 restart');
})();
