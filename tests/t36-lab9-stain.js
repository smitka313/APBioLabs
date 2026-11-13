/* Lab 9: staining and destaining are watched, timed processes (soak, resolve, clear) that resume from the clock.
   Run: NODE_PATH=$(npm root -g) node tests/t36-lab9-stain.js   (about 90 s: the process runs in real time) */
const T = require('./_h');

/* Band contrast of the HindIII marker lane (lane 4), read from the canvas pixels: relative spread (percent) between the light and dark rows
   down the lane, so the darkening blue wash alone does not count. Ghost bands on a pale gel give ~0; crisp blue bands on a clear gel give the largest value. */
const contrast = p => p.evaluate(() => {
  const cv = document.querySelector('#g1-cv'), G = gel1.st.geom, k = cv.width / cv.clientWidth, x = cv.getContext('2d');
  const cx = G.gx0 + G.lw * 3.5, x0 = Math.round((cx - G.lw * 0.15) * k), w = Math.max(2, Math.round(G.lw * 0.3 * k));
  const y0 = Math.round(G.y0 * k + 2 * G.mmPx * k), y1 = Math.round(G.Y(44) * k), d = x.getImageData(x0, y0, w, y1 - y0).data, rows = [];
  for (let y = 0; y < y1 - y0; y++) { let s = 0; for (let i = 0; i < w; i++) { const o = (y * w + i) * 4; s += 0.3 * d[o] + 0.59 * d[o + 1] + 0.11 * d[o + 2]; } rows.push(s / w); }
  rows.sort((a, b) => a - b);
  return 100 * (rows[Math.floor(rows.length * 0.9)] - rows[Math.floor(rows.length * 0.05)]) / rows[Math.floor(rows.length * 0.9)];
});
const phase = p => p.evaluate(() => gel1.st.phase());
const ui = p => p.evaluate(() => ({ btn: document.querySelector('#g1-stain').textContent, dis: document.querySelector('#g1-stain').disabled, box: !document.querySelector('#g1-sbox').hidden, prog: +document.querySelector('#g1-sprog').value, count: document.querySelector('#g1-scount').textContent, mall: document.querySelector('#g1-mall').disabled, why: (document.querySelector('#g1-mall-why') || {}).textContent, skip: !document.querySelector('#g1-skip').offsetParent }));
const prep = async p => { await p.evaluate(() => document.querySelector('#g1-layout').click()); await p.click('#g1-run'); await p.waitForTimeout(5500); await p.click('#g1-run'); };

(async () => {
  const b = await T.launch(), ctx = await T.ctxFor(b);
  const p = await T.open(ctx, 'lab09.html', 'run-a-gel');
  await prep(p);
  const c0 = await contrast(p);

  // 1. the stain progresses over time
  await p.click('#g1-stain');
  const t0 = Date.now(); let u = await ui(p);
  T.ok(u.dis && u.box && /Staining/.test(u.btn) && /s left/.test(u.count), 'button disabled with countdown while staining: ' + u.btn + ' / ' + u.count);
  await p.waitForTimeout(300);
  T.ok(/Staining in progress/.test(await p.evaluate(() => document.querySelector('#g1-stain-why').textContent)), 'stain button states its reason');
  const series = [], progs = [];
  while (Date.now() - t0 < 28500) { series.push(Math.round(await contrast(p))); progs.push((await ui(p)).prog); await p.waitForTimeout(2200); }
  console.log('  contrast during stain:', series.join(' '), ' (before: ' + Math.round(c0) + ')');
  T.ok(series.every((v, i) => i === 0 || v >= series[i - 1] - 1), 'band contrast rises monotonically while staining');
  T.ok(series[series.length - 1] > series[0] + 8, 'contrast grows from faint to clear');
  T.ok(progs.every((v, i) => i === 0 || v >= progs[i - 1]) && progs[0] < 20, 'progress bar advances: ' + progs.join(','));
  T.ok(await phase(p) === 'stained', 'staining finished by itself after ~27 s');
  u = await ui(p); T.ok(!u.dis && /Destain/.test(u.btn) && !u.box, 'Destain button enabled, bar hidden: ' + u.btn);
  // measuring is gated until destaining is done
  T.ok(u.mall && /Destain the gel first/.test(u.why), 'measuring gated after staining: ' + u.why);

  // 2. destain, with skip and gate
  await p.click('#g1-stain'); await p.waitForTimeout(400);
  u = await ui(p); T.ok(u.dis && u.skip === false && u.mall && /Wait for destaining to finish/.test(u.why), 'during destaining: button disabled, Skip shown, measuring gated "' + u.why + '"');
  const steps1 = await p.evaluate(() => document.querySelector('#g1-steps').textContent);
  await p.waitForTimeout(8000);
  const cMid = await contrast(p);
  await p.click('#g1-skip'); await p.waitForTimeout(500);
  T.ok(await phase(p) === 'done', 'Skip ahead finishes destaining immediately');
  const cEnd = await contrast(p);
  T.ok(cEnd > cMid + 5, 'contrast keeps rising to the crisp end state: ' + Math.round(cMid) + ' -> ' + Math.round(cEnd));
  await p.waitForTimeout(900);
  u = await ui(p); T.ok(!u.mall && /Destained/.test(u.btn) && !u.box, 'measuring allowed once destained: ' + u.btn);
  const checklist = () => p.evaluate(() => [...document.querySelectorAll('#g1-steps li')].map(li => li.className.includes('is-done') ? 'x' : 'o').join(''));
  T.ok(await checklist() === 'xxxoo', 'checklist agrees (load, run, stain/destain done; measure and curve open): ' + await checklist());
  T.ok(/Stain, then destain/.test(steps1), 'checklist has a stain and destain step');
  await p.selectOption('#g1-mlane', '3'); await p.click('#g1-mall'); await p.waitForTimeout(300);
  T.ok(await p.evaluate(() => gel1.meas.getRows().length) > 0, 'bands can be measured after destaining');

  // 3. skip during staining, then reload mid-destain resumes from the clock
  await p.evaluate(() => document.querySelector('#g1-new').click()); await prep(p);
  await p.click('#g1-stain'); await p.waitForTimeout(500); await p.click('#g1-skip'); await p.waitForTimeout(400);
  T.ok(await phase(p) === 'stained', 'Skip ahead finishes staining');
  await p.click('#g1-stain'); await p.waitForTimeout(6000);
  const before = (await ui(p)).prog; const at = await p.evaluate(() => gel1.st.destainAt);
  await p.reload(); await p.waitForTimeout(1200);
  u = await ui(p);
  T.ok(await phase(p) === 'destaining' && u.box && u.dis, 'reload mid-destain: still destaining, bar shown, button disabled');
  T.ok(u.prog >= before && u.prog < before + 20 && u.prog > 10, 'progress resumed from the clock: ' + before + ' -> ' + u.prog);
  T.ok(await p.evaluate(a => gel1.st.destainAt === a, at), 'start time kept across reload');
  // while the page was "closed" for a while: rewind the saved start by 40 s and reload -> finished
  await p.evaluate(() => { const k = 'gelstate-g1', r = Lab.store.get(k); r.destainAt -= 40000; Lab.store.set(k, r); });
  await p.reload(); await p.waitForTimeout(1200);
  T.ok(await phase(p) === 'done' && !(await ui(p)).mall, 'reload after the time has passed: destained and measurable');
  // reload mid-stain
  await p.evaluate(() => document.querySelector('#g1-new').click()); await prep(p);
  await p.click('#g1-stain'); await p.waitForTimeout(400);
  await p.evaluate(() => { const k = 'gelstate-g1', r = Lab.store.get(k); r.stainAt -= 15000; Lab.store.set(k, r); });
  await p.reload(); await p.waitForTimeout(1200);
  u = await ui(p); const sp = await p.evaluate(() => gel1.st.stainP());
  T.ok(await phase(p) === 'staining' && sp > 0.5 && sp < 0.65 && /1\d s left/.test(u.count), 'reload mid-stain resumes at ~55%: ' + Math.round(sp * 100) + '%, ' + u.count);
  T.ok(await p.evaluate(() => gel1.st.blockReason()) === 'Wait for staining to finish, then destain', 'measuring gated mid-stain');
  T.ok(p.errors.length === 0, 'no page errors ' + p.errors.join(';'));
  await p.close();

  // 4. reduced motion: jumps to the end
  const c2 = await b.newContext({ viewport: { width: 1366, height: 768 }, reducedMotion: 'reduce' });
  await T.routeLibs(c2);
  await c2.addInitScript(() => { try { localStorage.setItem('aplab:student', JSON.stringify({ name: 'Test Student', period: '3' })); localStorage.setItem('aplab:tour', JSON.stringify({ seen: true, v: 1 })); } catch (e) { /* ignore */ } });
  const q = await T.open(c2, 'lab09.html', 'run-a-gel');
  await q.evaluate(() => document.querySelector('#g1-layout').click()); await q.click('#g1-run'); await q.waitForTimeout(600);
  await q.click('#g1-stain'); await q.waitForTimeout(500);
  T.ok(await phase(q) === 'stained' && !(await ui(q)).box, 'reduced motion: staining jumps straight to the end');
  await q.click('#g1-stain'); await q.waitForTimeout(500);
  u = await ui(q);
  T.ok(await phase(q) === 'done' && !u.mall && !u.box, 'reduced motion: destaining jumps straight to the end, measuring open');
  T.ok(await contrast(q) > 40, 'reduced motion end state shows crisp bands: ' + Math.round(await contrast(q)));
  T.ok(q.errors.length === 0, 'no page errors (reduced motion) ' + q.errors.join(';'));
  await b.close(); T.done('lab9 stain');
})();
