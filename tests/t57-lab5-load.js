/* Lab 5 on load: a finished float-assay run must not be "continued" by the clock after a reload (it appended minutes 3, 4, 5 again after
   minute 20, so ET50 and every derived text changed), and a stored key result that disagrees with the table is corrected before it is quoted.
   Run: NODE_PATH=$(npm root -g) node tests/t57-lab5-load.js */
const { ok, done, launch, ctxFor, open } = require('./_h');
(async () => {
  const b = await launch(), ctx = await ctxFor(b, { reduced: true }), p = await open(ctx, 'lab05.html');
  await p.evaluate(() => { const t = document.getElementById('p-predict-floatassay'); t.value = 'I predict they float because O2 builds up.'; t.dispatchEvent(new Event('input', { bubbles: true })); t.dispatchEvent(new Event('change', { bubbles: true })); });
  await p.evaluate(() => Lab.pages.go('sink-disks')); await p.waitForTimeout(400);
  await p.evaluate(() => document.getElementById('inf-pull').click()); await p.waitForTimeout(500);
  await p.evaluate(() => document.getElementById('inf-pour').click()); await p.waitForTimeout(400);
  await p.evaluate(() => Lab.pages.go('float-assay')); await p.waitForTimeout(400);
  await p.evaluate(() => document.getElementById('cup-run').click()); await p.waitForTimeout(1500);
  const state = pg => pg.evaluate(() => ({
    key: (Lab.store.get('keyres:et50-bicarb') || {}).value,
    own: document.querySelector('[data-own="own-assay"] label').textContent,
    frq: document.querySelector('#frq .small').textContent,
    rows: Array.from(document.querySelectorAll('#cup-table tbody tr')).map(tr => +tr.cells[0].textContent)
  }));
  const num = s => { const m = /ET.{1,3} = ([\d.]+) min/.exec(s); return m ? +m[1] : null; };
  const s0 = await state(p);
  ok(s0.rows.length === 21 && s0.key != null, 'run finished: 21 rows, ET50 ' + s0.key);
  await p.evaluate(() => { const e = Lab.store.get('keyres:et50-bicarb').value; document.getElementById('et-in').value = e; document.getElementById('ret-in').value = (1 / e).toFixed(3); document.getElementById('et-check').click(); });
  await p.waitForTimeout(300);
  ok(/correct/.test(await p.textContent('#et-fb')), 'ET50 check shows a verdict');
  await p.fill('#et-in', '99'); await p.waitForTimeout(200);
  ok((await p.textContent('#et-fb')).trim() === '', 'editing the answer withdraws the old "correct" verdict');
  await p.evaluate(() => Lab.store.set('keyres:et50-bicarb', { label: 'ET50, bicarbonate cup', value: 9.5, unit: 'min', part: 'Float assay', t: 1 }));
  await p.reload({ waitUntil: 'commit' }); await p.waitForTimeout(1200);
  const s1 = await state(p);
  ok(s1.key === s0.key && Math.abs(num(s1.own) - s0.key) < 0.06 && num(s1.frq) === s0.key, 'right after reload: key/Analyze/FRQ all show the table ET50 ' + s0.key + ', not the stored 9.5 (got ' + s1.key + ' / ' + num(s1.own) + ' / ' + num(s1.frq) + ')');
  await p.waitForTimeout(3500);
  const s2 = await state(p);
  ok(s2.rows.length === 21 && s2.rows.every((m, i) => m === i), 'a finished run is not continued after reload: minutes ' + s2.rows.join(','));
  ok(s2.key === s0.key && num(s2.frq) === s0.key && Math.abs(num(s2.own) - s0.key) < 0.06, 'a few seconds later the ET50 is still ' + s0.key + ' everywhere');
  ok(p.errors.length === 0, 'no page errors ' + p.errors.join('|'));
  await b.close(); done('t57-lab5-load');
})();
