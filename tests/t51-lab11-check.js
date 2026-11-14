/* Audit 3 round 2, Lab 11: from a fully erased state, with 6 plants of which 3 are filled and correct, the Water loss part must not be "done",
   and the check text must follow every edit on the same edit (no re-press of Check). LAB11_FILE overrides the page. */
const T = require('./_h');
(async () => {
  const b = await T.launch(), ctx = await T.ctxFor(b, { width: 1366, height: 900 });   // fresh context = empty localStorage apart from the sign-in/tour seed
  const p = await T.open(ctx, process.env.LAB11_FILE || 'lab11.html', 'water-loss');
  T.ok(await p.evaluate(() => !Object.keys(localStorage).some(k => /tr-table|tr-check/.test(k))), 'erased start: no saved Water loss data');
  const st = () => p.evaluate(() => ({
    msg: document.querySelector('#tr-check-msg').textContent, cls: document.querySelector('#tr-check-msg').className,
    chk: document.querySelector('#tr-steps [data-step-id="chk"]').classList.contains('is-done'),
    nav: [...document.querySelectorAll('.step-nav li')].map(l => l.textContent.replace(/\s+/g, ' ').trim()).filter(t => /Water loss/.test(t))[0],
    rows: JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k => /tr-table$/.test(k))) || '[]') }));
  const setv = async (i, v) => { const inp = p.locator('#tr-table input[data-r="' + i + '"]'); await inp.fill(v); await p.waitForTimeout(150); };   // typing only: no blur, so no change event
  const fill = async (i, good) => { const v = (await st()).rows[i].rpa; await setv(i, String(good ? +v.toPrecision(5) : 999)); };
  await p.evaluate(() => { const t = document.querySelector('#p-predict-water'); t.value = 'fan most'; t.dispatchEvent(new Event('input', { bubbles: true })); });
  for (let k = 0; k < 2; k++) { if (k) await p.selectOption('#tr-cond', 'fan'); await p.click('#tr-run'); await p.waitForTimeout(5500); }
  let s = await st(); T.ok(s.rows.length === 6, '6 plants run (' + s.rows.length + ')');
  for (let i = 0; i < 6; i++) await fill(i, true);
  await p.click('#tr-check'); await p.waitForTimeout(200);
  s = await st(); T.ok(/6 of 6 correct/.test(s.msg) && s.chk, 'all 6 filled and checked: done (' + s.msg + ')');
  for (let i = 3; i < 6; i++) await setv(i, '');
  s = await st();
  T.ok(/3 of 6 correct, 3 still blank/.test(s.msg), 'after blanking 3 rows the text updates on the same edit (' + s.msg + ')');
  T.ok(!s.chk, 'check step is not ticked with 3 blank rows');
  T.ok(!/\(done\)/.test(s.nav || ''), 'Water loss part badge not done: ' + s.nav);
  await fill(3, true);
  s = await st(); T.ok(/4 of 6 correct, 2 still blank/.test(s.msg), 'filling one row: count follows the same edit (' + s.msg + ')');
  await fill(4, false);
  s = await st(); T.ok(/4 of 6 correct, 1 still blank/.test(s.msg) && /Recheck plant\(s\) 5/.test(s.msg), 'a wrong value shows at once (' + s.msg + ')');
  await fill(4, true); await fill(5, true);
  s = await st(); T.ok(/6 of 6 correct/.test(s.msg) && s.chk && /\(done\)/.test(s.nav || ''), 'all filled and correct: ticked and badge done (' + s.nav + ')');
  await p.reload(); await p.waitForTimeout(900);
  s = await st(); T.ok(/6 of 6/.test(s.msg) && s.chk, 'restored after reload');
  T.ok(p.errors.length === 0, 'no page errors ' + p.errors.join(';'));
  await b.close(); T.done('lab11 check');
})();
