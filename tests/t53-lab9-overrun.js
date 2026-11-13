/* Audit 3, Lab 9: leaving the power on must not run the dye far past the end of the 70 mm gel without warning.
   Expect a "Stop now" warning at about 1 cm from the end (60 mm) while the gel is still running, and the power switching itself off
   at the end of the gel. LAB9_FILE overrides the page under test. */
const T = require('./_h');
(async () => {
  const b = await T.launch(), ctx = await T.ctxFor(b);
  const p = await T.open(ctx, process.env.LAB9_FILE || 'lab09.html', 'run-a-gel');
  await p.evaluate(() => { const s = document.querySelector('#g1-volt'); s.value = 150; s.dispatchEvent(new Event('input', { bubbles: true })); });
  await p.evaluate(() => document.querySelector('#g1-layout').click()); await p.waitForTimeout(300);
  await p.click('#g1-run');
  const snap = () => p.evaluate(() => ({ dye: parseFloat(document.querySelector('#g1-dye').textContent), btn: document.querySelector('#g1-run').textContent, msg: document.querySelector('#g1-msg').textContent, toast: [...document.querySelectorAll('.toast, [role=status].toast')].map(t => t.textContent).join('|') }));
  let warnedAt = null, last = null;
  const t0 = Date.now();
  while (Date.now() - t0 < 60000) {
    last = await snap();
    if (warnedAt == null && /stop now/i.test(last.msg + last.toast) && /Power off: stop/.test(last.btn)) warnedAt = last.dye;
    if (/Power on: continue/.test(last.btn)) break;
    await p.waitForTimeout(100);
  }
  console.log(JSON.stringify({ warnedAt, finalDye: last.dye, msg: last.msg.slice(0, 160) }));
  T.ok(warnedAt != null && warnedAt >= 55 && warnedAt <= 68, 'a "Stop now" warning appears while still running, near 60 mm (at ' + warnedAt + ' mm)');
  T.ok(last.dye <= 72, 'power switches off at the end of the gel, not at ' + last.dye + ' mm');
  T.ok(/end of the gel|power (was )?switched off/i.test(last.msg), 'the message explains the auto stop');
  await p.click('#g1-run'); await p.waitForTimeout(400);
  const again = await snap();
  T.ok(!/Power off: stop/.test(again.btn) || again.dye <= 72, 'continuing past the end of the gel is refused');
  T.ok(p.errors.length === 0, 'no page errors ' + p.errors.join(';'));
  await b.close(); T.done('lab9 over-run');
})();
