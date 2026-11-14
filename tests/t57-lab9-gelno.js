/* Audit 4 #5, Lab 9: the Gel number in the scene and the Gel column in the data tables agree, also after reloads.
   Bug: st.gel started at (highest measured gel + 1) and a restored gel took max(that, saved), so every reload of a gel that had been
   measured bumped the scene to "Gel 2", then the next measurement was filed under Gel 2 while the earlier rows said Gel 1.
   Erased state, run + stain + destain + measure, reload twice. LAB9_FILE overrides the page. */
const T = require('./_h');
(async () => {
  const b = await T.launch(), ctx = await T.ctxFor(b);
  const p = await T.open(ctx, process.env.LAB9_FILE || 'lab09.html', 'run-a-gel');
  await p.evaluate(() => { Object.keys(localStorage).filter(k => /^aplab:lab09/.test(k)).forEach(k => localStorage.removeItem(k)); });
  await p.reload(); await p.waitForTimeout(900);
  const tile = () => p.evaluate(() => document.querySelector('#g1-gelno').textContent.trim());
  const rows = () => p.evaluate(() => (Lab.store.get('g1-meas') || []).map(r => r.gel));
  await p.evaluate(() => { const s = document.querySelector('#g1-volt'); s.value = 150; s.dispatchEvent(new Event('input', { bubbles: true })); });
  await p.evaluate(() => document.querySelector('#g1-layout').click()); await p.waitForTimeout(300);
  await p.click('#g1-run'); await p.waitForFunction(() => /continue/.test(document.querySelector('#g1-run').textContent), null, { timeout: 60000 });
  await p.click('#g1-stain'); await p.waitForTimeout(28000); await p.click('#g1-stain'); await p.waitForTimeout(26000);
  for (const v of await p.evaluate(() => [...document.querySelectorAll('#g1-mlane option')].map(o => o.value))) { await p.selectOption('#g1-mlane', v); await p.click('#g1-mall'); await p.waitForTimeout(200); if ((await rows()).length) break; }
  const r0 = await rows(); T.ok(r0.length > 0 && r0.every(g => g === 1), 'first gel: rows filed under Gel 1 (' + r0.join(',') + ')');
  T.ok(await tile() === '1', 'scene says Gel 1');
  for (let i = 1; i <= 2; i++) { await p.reload(); await p.waitForTimeout(1000); const t = await tile(); T.ok(t === '1', `after reload ${i} the scene still says Gel 1 (it says ${t})`); }
  const sel = await p.evaluate(() => [...document.querySelectorAll('#meas1 .gsel option')].map(o => o.textContent));
  T.ok(sel.length === 1 && /Gel 1/.test(sel[0]), 'the table menu lists only Gel 1: ' + sel.join('|'));
  await p.evaluate(() => document.querySelector('#g1-new').click()); await p.waitForTimeout(300);
  T.ok(await tile() === '2', 'pouring a new gel after a run makes it Gel 2');
  await p.reload(); await p.waitForTimeout(1000);
  T.ok(await tile() === '2', 'and a reload keeps Gel 2');
  T.ok(p.errors.length === 0, 'no page errors ' + p.errors.join(';'));
  await b.close(); T.done('lab9 gel numbering');
})();
