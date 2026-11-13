module.exports = async ({ b, ok, ctxAs, open, keyres, ownText, frqChecks, frqReload }) => {
  const L = 'lab07';
  const kary = async p => { await p.evaluate(() => Lab.pages.go('cancer-karyotypes')); await p.waitForTimeout(500); const out = {}; for (const c of ['normal', 'hela', 'cml']) { await p.evaluate(c => document.getElementById('k-' + c).click(), c); await p.waitForTimeout(300); out[c] = await p.evaluate(() => { const s = document.getElementById('k-svg'); return { h: s.innerHTML.length + ':' + Array.from(s.innerHTML.matchAll(/translate\([^)]*\)/g)).slice(0, 12).map(m => m[0]).join(''), n: s.querySelectorAll('g[data-i], g.chrom, g[data-chrom]').length }; }); } return out; };
  const c1 = await ctxAs(b, 'Ada Lovelace', '3'), c2 = await ctxAs(b, 'Grace Hopper', '3');
  const p = await open(c1, 'lab07.html'), p2 = await open(c2, 'lab07.html');
  const k1 = await kary(p), k2 = await kary(p2);
  ok(k1.hela.h !== k2.hela.h && k1.normal.h !== k2.normal.h, 'two students get different karyotype layouts');
  ok(k1.normal.n === k2.normal.n && k1.hela.n === k2.hela.n && k1.cml.n === k2.cml.n, 'chromosome counts do not depend on the student: ' + [k1.normal.n, k1.hela.n, k1.cml.n]);
  ok(k1.normal.n === 46 && k1.hela.n === 82 && k1.cml.n === 46, 'chromosome counts stay 46 / 82 / 46 in the rendered spreads');
  const pb = await open(c1, 'lab07.html'); const k1b = await kary(pb);
  ok(k1b.hela.h === k1.hela.h, 'same student gets the same karyotype layout again'); await pb.close();
  const tips = async q => {
    await q.evaluate(() => ['predict-roottips', 'predict-sordaria', 'predict-meiosis', 'predict-design'].forEach(k => { const t = document.getElementById('p-' + k); if (t) { t.value = 'I predict the lectin raises the mitotic index.'; t.dispatchEvent(new Event('input', { bubbles: true })); t.dispatchEvent(new Event('change', { bubbles: true })); } }));
    await q.evaluate(() => Lab.pages.go('root-tips')); await q.waitForTimeout(400);
    for (const tr of ['control', 'lectin']) for (const tip of [1, 2, 3]) {
      await q.evaluate(([tr, tip]) => { document.querySelector('[data-treat="' + tr + '"]').click(); document.querySelector('[data-tip="' + tip + '"]').click(); document.getElementById('rt-auto').click(); document.getElementById('rt-record').click(); }, [tr, tip]);
      await q.waitForTimeout(250);
    }
    await q.evaluate(() => { const b = document.getElementById('chi-run'); b.disabled = false; b.click(); }); await q.waitForTimeout(400);
    await q.evaluate(() => Lab.pages.go('sordaria')); await q.waitForTimeout(400);
    for (let i = 0; i < 4; i++) { await q.evaluate(() => document.getElementById('s-auto').click()); await q.waitForTimeout(900); await q.evaluate(() => document.getElementById('s-record').click()); await q.waitForTimeout(300); await q.evaluate(() => document.getElementById('s-new').click()); await q.waitForTimeout(300); }
    await q.waitForTimeout(1800);
  };
  await p.evaluate(() => Lab.pages.go('analyze')); await p.waitForTimeout(300);
  ok(/Finish Root tips/.test(await ownText(p, 'own-tip')), 'own-tip waits for data');
  ok(/Finish Sordaria/.test(await ownText(p, 'own-field')), 'own-field waits for data');
  await tips(p2);
  const v2 = [(await keyres(p2, L, 'mi-control')).value, (await keyres(p2, L, 'mi-lectin')).value];
  await tips(p);
  const v1 = [(await keyres(p, L, 'mi-control')).value, (await keyres(p, L, 'mi-lectin')).value];
  ok(v1[0] !== v2[0] && v1[1] !== v2[1] && v1[0] > 8 && v1[0] < 22 && v1[1] > 27 && v1[1] < 44 && v2[0] > 8 && v2[0] < 22 && v2[1] > 27 && v2[1] < 44, 'per-student mitotic indices differ and stay in range: ' + v1 + ' vs ' + v2);
  await p2.close();
  await p.evaluate(() => Lab.pages.go('analyze')); await p.waitForTimeout(300);
  await p.evaluate(() => Lab.pages.go('analyze')); await p.waitForTimeout(2200);
  const o1 = await ownText(p, 'own-tip'), o2 = await ownText(p, 'own-field');
  ok(/mitotic index of [\d.]+% \(\d+ of \d+ cells/.test(o1), 'own-tip quotes real tip: ' + o1.slice(0, 150));
  ok(/showed [\d.]+% crossover asci \(\d+ of \d+\)/.test(o2), 'own-field quotes real field: ' + o2.slice(0, 150));
  const a = await keyres(p, L, 'mi-control'), bl = await keyres(p, L, 'mi-lectin'), chi = await keyres(p, L, 'chi2-lectin'), mu = await keyres(p, L, 'map-units');
  ok(a && bl && a.unit === '%' && bl.value > a.value, 'mitotic indices stored: ' + JSON.stringify([a && a.value, bl && bl.value]));
  ok(chi && chi.value > 3.84, 'chi2 stored ' + JSON.stringify(chi));
  ok(mu && mu.value > 15 && mu.value < 38 && mu.unit === 'map units', 'map units stored in a realistic range ' + JSON.stringify(mu));
  await frqChecks(p, L);
  await p.reload(); await p.waitForTimeout(1200);
  await p.evaluate(() => Lab.pages.go('analyze')); await p.waitForTimeout(2200);
  const o1b = await ownText(p, 'own-tip'); ok(/mitotic index of/.test(o1b), 'personal prompt quotes values after reload: ' + o1b.slice(0, 60));
  ok((await keyres(p, L, 'map-units')).value === mu.value, 'key results survive reload');
  await frqReload(p, L);
  await c1.close(); await c2.close();
};
