/* Lab 5: after re-running the float assay, every derived text (key results, Analyze prompt, FRQ data) must match the NEW run.
   Run: NODE_PATH=$(npm root -g) node tests/t50-lab5-rerun.js */
const { ok, done, launch, ctxFor, open } = require('./_h');
(async () => {
  const b = await launch(), ctx = await ctxFor(b), p = await open(ctx, 'lab05.html');
  await p.evaluate(() => ['predict-floatassay', 'predict-design'].forEach(k => { const t = document.getElementById('p-' + k); t.value = 'I predict they float because O2 builds up.'; t.dispatchEvent(new Event('input', { bubbles: true })); t.dispatchEvent(new Event('change', { bubbles: true })); }));
  await p.evaluate(() => Lab.pages.go('sink-disks')); await p.waitForTimeout(400);
  await p.evaluate(() => document.getElementById('inf-pull').click()); await p.waitForTimeout(5000);
  await p.evaluate(() => document.getElementById('inf-pour').click()); await p.waitForTimeout(400);
  await p.evaluate(() => Lab.pages.go('float-assay')); await p.waitForTimeout(400);
  await p.evaluate(() => { const s = document.getElementById('cup-speed'); s.value = '0.5'; s.dispatchEvent(new Event('input', { bubbles: true })); const l = document.getElementById('cup-len'); l.value = '30'; l.dispatchEvent(new Event('input', { bubbles: true })); });
  const finished = () => p.waitForFunction(() => { const c = Lab.store.get('cup-run'); return c && document.querySelectorAll('#cup-table tbody tr').length >= c.len + 1; }, null, { timeout: 150000 }).catch(() => {});
  const state = () => p.evaluate(() => {
    const k = Lab.store.get('keyres:et50-bicarb');
    const own = document.querySelector('[data-own="own-assay"] label').textContent;
    const frq = document.querySelector('#frq .small').textContent;
    const rows = Array.from(document.querySelectorAll('#cup-table tbody tr')).map(tr => +tr.cells[1].textContent);
    return { key: k && k.value, own: own.slice(0, 90), frq, rows: rows.length };
  });
  const num = s => { const m = /ET.{1,3} = ([\d.]+) min/.exec(s); return m ? +m[1] : null; };
  await p.evaluate(() => document.getElementById('cup-run').click()); await finished(); await p.waitForTimeout(2500);
  const s1 = await state(); console.log(JSON.stringify(s1));
  ok(s1.key != null && Math.abs(num(s1.own) - s1.key) < 0.06 && num(s1.frq) === s1.key, 'run 1: key/Analyze/FRQ agree on ' + s1.key);
  let changed = false;
  for (let i = 0; i < 4 && !changed; i++) {
    await p.evaluate(() => document.getElementById('cup-run').click()); await p.waitForTimeout(4000);
    const mid = await state(); console.log('mid', JSON.stringify(mid));
    ok(mid.rows < 12 && mid.key == null, 'mid-run (' + mid.rows + ' rows, half not floating yet): no old-run ET50 in Key results (' + mid.key + ')');
    ok(!/= [\d.]+ min/.test(mid.frq), 'mid-run: FRQ data line does not quote the old run: ' + mid.frq);
    ok(!/= [\d.]+ min/.test(mid.own), 'mid-run: Analyze prompt does not quote the old run: ' + mid.own);
    await finished(); await p.waitForTimeout(2500);
    const s2 = await state(); console.log(JSON.stringify(s2));
    ok(s2.key != null && num(s2.own) === s2.key && num(s2.frq) === s2.key, 're-run ' + (i + 1) + ': key/Analyze/FRQ agree on ' + s2.key);
    if (s2.key !== s1.key) changed = true;
  }
  ok(changed, 'a re-run produced a different ET50 (so staleness was testable)');
  ok(p.errors.length === 0, 'no page errors ' + p.errors.join('|'));
  await b.close(); done('t50-lab5-rerun');
})();
