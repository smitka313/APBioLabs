/* Lab 9 pauses at the 60 mm classroom target. A deliberate continuation must
   stop at the physical end of the 70 mm gel and refuse further running.
   LAB9_FILE overrides the page under test. */
const T = require('./_h');
(async () => {
  const b = await T.launch(), ctx = await T.ctxFor(b);
  const p = await T.open(ctx, process.env.LAB9_FILE || 'lab09.html', 'run-a-gel');
  await p.evaluate(() => { const s = document.querySelector('#g1-volt'); s.value = 150; s.dispatchEvent(new Event('input', { bubbles: true })); });
  await p.evaluate(() => document.querySelector('#g1-layout').click()); await p.waitForTimeout(300);
  const snap = () => p.evaluate(() => ({ dye: parseFloat(document.querySelector('#g1-dye').textContent), btn: document.querySelector('#g1-run').textContent, msg: document.querySelector('#g1-msg').textContent, toast: [...document.querySelectorAll('.toast, [role=status].toast')].map(t => t.textContent).join('|') }));
  async function runUntilStopped() {
    await p.click('#g1-run');
    await p.waitForFunction(() => /Power on: continue/.test(document.querySelector('#g1-run').textContent), null, { timeout: 60000 });
    return snap();
  }
  const target = await runUntilStopped();
  console.log('Classroom target:', JSON.stringify(target));
  T.ok(Number.isFinite(target.dye) && Math.abs(target.dye - 60) <= 0.1, 'power pauses at the 60 mm classroom target: ' + target.dye + ' mm');
  T.ok(/recommended stopping point \(60 mm\)/.test(target.msg) && /Power switched off automatically/.test(target.msg) && /Stain the gel/.test(target.msg), 'target message explains the automatic stop and next step');
  const end = await runUntilStopped();
  console.log('Physical end:', JSON.stringify(end));
  T.ok(Number.isFinite(end.dye) && end.dye >= 70 && end.dye <= 72, 'deliberate continuation switches off at the physical end: ' + end.dye + ' mm');
  T.ok(/end of the gel/.test(end.msg) && /power was switched off/i.test(end.msg), 'physical-end message explains the safety stop');
  await p.click('#g1-run'); await p.waitForTimeout(400);
  const again = await snap();
  T.ok(!/Power off: stop/.test(again.btn) && again.dye === end.dye && /power stays off/.test(again.msg), 'continuing past the end is refused without moving the dye');
  T.ok(p.errors.length === 0, 'no page errors ' + p.errors.join(';'));
  await b.close(); T.done('lab9 over-run');
})();

