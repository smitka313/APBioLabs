/* Lab 4: every soak adds 3 rows to the SA:V table. Repeating the same block at the same soak time must be labelled as a replicate
   ("A · cube, trial 2") with a clear message, not silently duplicated. Starts from an erased lab.
   Run: NODE_PATH=$(npm root -g) node tests/t57-lab4-replicates.js */
const { ok, done, launch, ctxFor, open } = require('./_h');
(async () => {
  const b = await launch(), ctx = await ctxFor(b, { reduced: true }), p = await open(ctx, 'lab04.html');
  await p.evaluate(() => Lab.pages.go('sa-v')); await p.waitForTimeout(400);
  await p.evaluate(() => document.querySelectorAll('textarea[id^="p-predict-"]').forEach(t => { t.value = 'Smaller blocks fill faster.'; t.dispatchEvent(new Event('input', { bubbles: true })); t.dispatchEvent(new Event('change', { bubbles: true })); }));
  await p.waitForTimeout(1200);
  const blks = () => p.evaluate(() => Array.from(document.querySelectorAll('#p1-table tbody tr')).map(tr => tr.cells[0].textContent.trim()));
  const note = () => p.evaluate(() => (document.getElementById('p1-note') || {}).textContent || '');
  await p.evaluate(() => document.getElementById('p1-run').click()); await p.waitForTimeout(1200);
  const r1 = await blks(); console.log('   soak 1', JSON.stringify(r1));
  ok(r1.length === 3, 'first soak: 3 rows');
  await p.evaluate(() => document.getElementById('p1-run').click()); await p.waitForTimeout(1200);
  const r2 = await blks(); console.log('   soak 2', JSON.stringify(r2), JSON.stringify(await note()));
  ok(r2.length === 6, 'second soak: 6 rows');
  ok(new Set(r2).size === 6, 'every row has a distinct label (no silent duplicates): ' + r2.join(' | '));
  ok(/trial 2/.test(r2.slice(3).join(' ')), 'the repeat is labelled as trial 2');
  ok(/trial 2|replicate|repeat/i.test(await note()) && /Clear table/.test(await note()), 'a message explains that rows were added as replicates and how to start over: "' + (await note()).slice(0, 90) + '"');
  await p.evaluate(() => { const s = document.getElementById('p1-t'); s.value = String(+s.min + 1 > +s.max ? s.min : (+s.value === +s.max ? +s.value - +s.step : +s.value + +s.step)); s.dispatchEvent(new Event('input', { bubbles: true })); });
  await p.evaluate(() => document.getElementById('p1-run').click()); await p.waitForTimeout(1200);
  const r3 = await blks(); console.log('   soak 3 (other soak time)', JSON.stringify(r3.slice(6)));
  ok(r3.length === 9 && r3.slice(6).every(x => /trial 1/.test(x)), 'a different soak time is a new condition, so it starts again at trial 1: ' + r3.slice(6).join(' | '));
  await p.reload(); await p.waitForTimeout(900); await p.evaluate(() => Lab.pages.go('sa-v')); await p.waitForTimeout(300);
  const r4 = await blks();
  ok(JSON.stringify(r4) === JSON.stringify(r3), 'labels survive a reload');
  ok(p.errors.length === 0, 'no page errors ' + p.errors.join('|'));
  await b.close(); done('t57-lab4-replicates');
})();
