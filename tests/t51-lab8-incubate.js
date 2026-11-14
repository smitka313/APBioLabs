/* Audit 3 round 2, Lab 8, each from a fully erased state (a fresh browser context has no saved lab data):
   - the mixture line follows every step (plasmid step shows the plasmid volume at once);
   - after incubation the button is not frozen on "Incubating… 0 s" and is usable, also after a reload mid-incubation;
   - the PLATES tile stays in the tile row after incubation, showing the incubated state. LAB8_FILE overrides the page. */
const T = require('./_h');
(async () => {
  const b = await T.launch();
  const FILE = process.env.LAB8_FILE || 'lab08.html';
  const fresh = async () => { const ctx = await T.ctxFor(b); const p = await T.open(ctx, FILE, 'transform'); await p.evaluate(() => { Object.keys(localStorage).filter(k => /^aplab:lab08/.test(k)).forEach(k => localStorage.removeItem(k)); }); await p.reload(); await p.waitForTimeout(900); return p; };
  const idle = p => p.waitForFunction(() => !document.querySelector('#do-step').disabled || /Incubat.*Working/.test(''), null, { timeout: 40000 });
  const vol = p => p.evaluate(() => document.querySelector('#vol-list').textContent);
  const setPreds = p => p.evaluate(() => { document.querySelectorAll('#pred-grid select').forEach(s => { s.value = 'none'; s.dispatchEvent(new Event('change', { bubbles: true })); }); });
  const btn = p => p.evaluate(() => ({ t: document.querySelector('#do-step').textContent.trim(), dis: document.querySelector('#do-step').disabled }));
  const tiles = p => p.evaluate(() => [...document.querySelectorAll('#plate-readouts .readout')].map(r => r.textContent.replace(/\s+/g, ' ').trim()));

  // ---- erased run 1: mixture line, button, tile
  let p = await fresh();
  T.ok(await p.evaluate(() => !Object.keys(localStorage).some(k => /sim-state/.test(k))), 'erased start');
  const seen = [];
  for (let i = 0; i < 9; i++) {
    await p.click('#do-step'); await idle(p); await p.waitForTimeout(150);
    seen.push(await vol(p));
    if (i === 0) T.ok(/250 µL transformation solution/.test(seen[0]) && !/plasmid/.test(seen[0]), 'after solution step: ' + seen[0]);
    if (i === 3) T.ok(/10 µL plasmid/.test(seen[3]) && !/(^| )0 µL plasmid/.test(seen[3]), 'after plasmid step: ' + seen[3]);
    if (i === 7) T.ok(/250 µL LB/.test(seen[7]), 'after recovery step: ' + seen[7]);
    if (i === 8) T.ok(/spread 100 µL per plate/.test(seen[8]), 'after plating step: ' + seen[8]);
  }
  const t0 = await tiles(p); T.ok(t0.length === 1 && /Plates.*Spread, not yet incubated/.test(t0[0]), 'plated tile: ' + t0[0]);
  await setPreds(p);
  await p.click('#do-step'); await p.waitForTimeout(1200);
  let s = await btn(p); T.ok(/Incubating… \d+ s/.test(s.t) && s.dis, 'mid-incubation countdown: ' + s.t);
  await p.waitForFunction(() => /Incubated/.test(document.querySelector('#ro-status').textContent), null, { timeout: 40000 }); await p.waitForTimeout(500);
  s = await btn(p); T.ok(!/Incubating|Working/.test(s.t) && /Incubated/.test(s.t) && !s.dis, 'after incubation the button is usable and says: ' + s.t + (s.dis ? ' (disabled)' : ''));
  await p.evaluate(() => document.querySelector('#do-step').click()); await p.waitForTimeout(300);
  T.ok(await p.evaluate(() => /Incubated 24 h/.test(document.body.innerText)), 'clicking the finished button gives feedback');
  const t1 = await tiles(p);
  T.ok(t1.length === 7 && /^Plates.*Incubated 24 h/.test(t1[0]), 'PLATES tile stays and says incubated: ' + t1[0] + ' (' + t1.length + ' tiles)');
  await p.context().close();

  // ---- erased run 2: reload mid-incubation
  p = await fresh();
  for (let i = 0; i < 9; i++) { await p.click('#do-step'); await idle(p); }
  await setPreds(p); await p.click('#do-step'); await p.waitForTimeout(1500);
  await p.reload(); await p.waitForTimeout(900);
  s = await btn(p); T.ok(/Incubating… \d+ s/.test(s.t) && s.dis, 'reload mid-incubation resumes the countdown: ' + s.t);
  await p.waitForFunction(() => /Incubated/.test(document.querySelector('#ro-status').textContent), null, { timeout: 40000 }); await p.waitForTimeout(500);
  s = await btn(p); T.ok(!/Incubating|Working/.test(s.t) && !s.dis, 'after a mid-incubation reload the button ends usable: ' + s.t);
  const t2 = await tiles(p); T.ok(t2.length === 7 && /^Plates.*Incubated/.test(t2[0]), 'PLATES tile present after reload run: ' + t2[0]);
  await p.reload(); await p.waitForTimeout(900);
  s = await btn(p); const t3 = await tiles(p);
  T.ok(!/Incubating|Working/.test(s.t) && !s.dis && /^Plates.*Incubated/.test(t3[0]) && /Incubated/.test(await vol(p) + s.t), 'reload after completion keeps button, tile and mixture line: ' + s.t);
  T.ok(p.errors.length === 0, 'no page errors ' + p.errors.join(';'));
  await b.close(); T.done('lab8 incubate');
})();
