/* Audit 3, Lab 11: "Check my rate/area values" must not report success for rows that are blank. With every plant filled and correct it says
   "3 of 3 correct"; after more plants are run (blank rows) or a value is blanked, the message must not still claim that.
   LAB11_FILE overrides the page under test. */
const T = require('./_h');
(async () => {
  const b = await T.launch(), ctx = await T.ctxFor(b);
  const p = await T.open(ctx, process.env.LAB11_FILE || 'lab11.html', 'water-loss');
  const setv = (sel, v) => p.evaluate(([s, v]) => { const e = document.querySelector(s); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); }, [sel, v]);
  await setv('#p-predict-water', 'fan fastest');
  await setv('#tr-n', '3');
  const run = async n => { await p.click('#tr-run'); await p.waitForFunction(k => document.querySelectorAll('#tr-table tbody tr').length >= k, n, { timeout: 60000 }); await p.waitForTimeout(5500); };
  await run(3);
  const rows = () => p.evaluate(() => JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k => /tr-table$/.test(k)))).map(r => [r.n, r.rpa, r.rpaIn]));
  const fill = (i, v) => p.evaluate(([i, v]) => { const el = document.querySelector(`#tr-table input[data-r="${i}"][data-k="rpaIn"]`); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }, [i, v]);
  const msg = () => p.evaluate(() => ({ t: document.querySelector('#tr-check-msg').textContent, c: document.querySelector('#tr-check-msg').className }));
  const check = async () => { await p.evaluate(() => document.querySelector('#tr-check').click()); await p.waitForTimeout(300); return msg(); };
  let m = await check();
  T.ok(!/ok/.test(m.c), 'all rows blank: not a pass (' + m.t.slice(0, 50) + ')');
  let r = await rows();
  for (let i = 0; i < 3; i++) await fill(i, String(r[i][1]));
  await p.waitForTimeout(300);
  m = await check();
  T.ok(/ok/.test(m.c) && /3 of 3/.test(m.t), 'all three filled correctly: "' + m.t + '"');
  await run(6);                                   // three more plants, values blank
  m = await msg();
  console.log('after 3 more blank plants:', JSON.stringify(m));
  T.ok(!/ok/.test(m.c) && !/^3 of 3 correct\.?$/.test(m.t), 'message no longer claims a full pass after blank rows were added');
  m = await check();
  T.ok(!/ok/.test(m.c) && /3 still blank/.test(m.t), 'pressing Check names the blank rows: "' + m.t + '"');
  await p.evaluate(() => { const t = document.querySelectorAll('#tr-table tbody tr'); });
  r = await rows();
  for (let i = 3; i < 6; i++) await fill(i, String(r[i][1]));
  await p.waitForTimeout(300);
  m = await check();
  T.ok(/ok/.test(m.c) && /6 of 6/.test(m.t), 'all six filled: "' + m.t + '"');
  await fill(1, '');                               // blank one value again
  await p.waitForTimeout(300);
  m = await msg();
  T.ok(!/ok/.test(m.c), 'blanking a value updates the message at once: "' + m.t + '"');
  T.ok(p.errors.length === 0, 'no page errors ' + p.errors.join(';'));
  await b.close(); T.done('lab11 check blank');
})();
