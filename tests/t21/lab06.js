module.exports = async ({ b, ok, ctxAs, open, keyres, ownText, frqChecks, frqReload }) => {
  const L = 'lab06';
  const c1 = await ctxAs(b, 'Ada Lovelace', '3'), c2 = await ctxAs(b, 'Grace Hopper', '3');
  const p = await open(c1, 'lab06.html'), p2 = await open(c2, 'lab06.html');
  for (const q of [p, p2]) await q.emulateMedia({ reducedMotion: 'reduce' });
  const predict = q => q.evaluate(() => ['predict-microresp', 'predict-gas', 'predict-design'].forEach(k => { const t = document.getElementById('p-' + k); if (t) { t.value = 'I predict the rate doubles per 10 degrees.'; t.dispatchEvent(new Event('input', { bubbles: true })); t.dispatchEvent(new Event('change', { bubbles: true })); } }));
  const design = async (q, temps) => {
    await q.evaluate(() => Lab.pages.go('design')); await q.waitForTimeout(400);
    for (const T of temps) {
      await q.evaluate(T => { const s = document.getElementById('d-temp'); s.value = T; s.dispatchEvent(new Event('input', { bubbles: true })); const r = document.getElementById('d-reps'); r.value = 2; r.dispatchEvent(new Event('input', { bubbles: true })); document.getElementById('d-run').click(); }, T);
      await q.waitForTimeout(900);
    }
    return q.evaluate(() => Array.from(document.querySelectorAll('#d-table tbody tr')).map(tr => tr.cells[5] ? tr.cells[5].textContent : '').join(','));
  };
  await predict(p); await predict(p2);
  const d1 = await design(p, [10, 20, 30]), d2 = await design(p2, [10, 20, 30]);
  ok(d1.length > 5 && d1 !== d2, 'two students get different design-trial rates (' + d1 + ' vs ' + d2 + ')');
  await p2.close();
  await p.evaluate(() => Lab.pages.go('analyze')); await p.waitForTimeout(300);
  ok(/Finish Microrespirometer/.test(await ownText(p, 'own-baseline')), 'own-baseline waits for data');
  await p.evaluate(() => Lab.pages.go('microrespirometer')); await p.waitForTimeout(400);
  await p.evaluate(() => document.getElementById('p-run').click()); await p.waitForTimeout(2500);
  await p.evaluate(() => Lab.pages.go('analyze')); await p.waitForTimeout(2200);
  const o1 = await ownText(p, 'own-weird'), o2 = await ownText(p, 'own-baseline');
  ok(/Your trial \d+ \(.* at \d+ °C, rate [\d.]+ µL\/min/.test(o1), 'own-weird quotes real trial: ' + o1.slice(0, 150));
  ok(/gave a rate of [\d.]+ µL/.test(o2), 'own-baseline quotes real run: ' + o2.slice(0, 120));
  const k1 = await keyres(p, L, 'rate-microresp'), k2 = await keyres(p, L, 'q10');
  ok(k1 && k1.value > 0 && k1.unit === 'µL/min', 'rate-microresp stored ' + JSON.stringify(k1));
  ok(k2 && k2.value > 1.3 && k2.value < 3.5, 'q10 stored in a realistic range ' + JSON.stringify(k2));
  await frqChecks(p, L);
  await p.reload(); await p.waitForTimeout(1200);
  await p.evaluate(() => Lab.pages.go('analyze')); await p.waitForTimeout(2200);
  const o1b = await ownText(p, 'own-weird'); ok(/Your trial \d+/.test(o1b), 'personal prompt quotes values after reload: ' + o1b.slice(0, 60));
  ok((await keyres(p, L, 'q10')).value === k2.value, 'key results survive reload');
  await frqReload(p, L);
  await c1.close(); await c2.close();
};
