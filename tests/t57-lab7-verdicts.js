/* Lab 7: a verdict ("correct", "matches", a green/red mark) belongs to the data it was given for. The moment that data changes the verdict
   must go, and a key result that no longer has data behind it must be withdrawn. Every case starts from an erased lab.
   Run: NODE_PATH=$(npm root -g) node tests/t57-lab7-verdicts.js */
const { ok, done, launch, ctxFor, open } = require('./_h');
(async () => {
  const b = await launch(), ctx = await ctxFor(b, { reduced: true }), p = await open(ctx, 'lab07.html');
  const predict = () => p.evaluate(() => document.querySelectorAll('textarea[id^="p-predict-"]').forEach(t => { t.value = 'I predict the lectin will raise the count.'; t.dispatchEvent(new Event('input', { bubbles: true })); t.dispatchEvent(new Event('change', { bubbles: true })); }));
  await predict();
  const go = async id => { await p.evaluate(i => Lab.pages.go(i), id); await p.waitForTimeout(350); };
  const txt = sel => p.evaluate(s => (document.querySelector(s) || {}).textContent || '', sel);
  const key = id => p.evaluate(i => { const e = Lab.store.get('keyres:' + i); return e ? e.value : null; }, id);

  /* 1. Sordaria: "Check my calculations" verdicts vs a newly recorded field */
  await go('sordaria');
  await p.click('#s-auto'); await p.click('#s-record'); await p.waitForTimeout(200);
  const pct = await p.evaluate(() => { const r = Lab.table ? null : null; const t = Lab.store.get('sord') || []; const P = t.reduce((a, x) => a + x.p, 0), R = t.reduce((a, x) => a + x.r, 0); return 100 * R / (P + R); });
  await p.fill('#s-pct', pct.toFixed(2)); await p.fill('#s-mu', (pct / 2).toFixed(2));
  await p.click('#s-calc-check'); await p.waitForTimeout(200);
  ok(/correct/.test(await txt('#s-calc-msg')), 'Sordaria: calculations checked, verdict "correct" shown for ' + pct.toFixed(1) + '%');
  await p.click('#s-new'); await p.click('#s-auto'); await p.click('#s-record'); await p.waitForTimeout(300);
  const after = await txt('#s-calc-msg');
  ok(!/correct|recheck/.test(after), 'Sordaria: after recording a new field the old verdict is gone (now: "' + after.trim().slice(0, 60) + '")');
  await p.reload(); await p.waitForTimeout(800); await predict(); await go('sordaria');
  ok(!/correct|recheck/.test(await txt('#s-calc-msg')), 'Sordaria: and it does not come back after a reload');
  await p.fill('#s-pct', '10');
  await p.click('#s-calc-check'); await p.waitForTimeout(200);
  ok(/recheck/.test(await txt('#s-calc-msg')), 'Sordaria: wrong value is marked recheck');
  await p.fill('#s-pct', '11'); await p.waitForTimeout(200);
  ok(!/correct|recheck/.test(await txt('#s-calc-msg')), 'Sordaria: editing the answer withdraws its verdict');
  ok(await key('map-units') != null, 'Sordaria: map-units key result exists with data');
  await p.evaluate(() => { Lab.store.set('sord', []); });
  await p.reload(); await p.waitForTimeout(2200);
  ok(await key('map-units') == null, 'Sordaria: map-units key result is withdrawn once the fields are gone');

  /* 2. Mitosis DNA table: edit a checked cell */
  await go('mitosis-model');
  const ans = [[4, 4, 2], [4, 8, 4], [4, 8, 4], [8, 8, 4], [4, 4, 2]];
  await p.evaluate(a => { document.querySelectorAll('#mit-table input[data-k]').forEach(inp => { const ki = ['chr', 'mol', 'amt'].indexOf(inp.dataset.k); inp.value = a[+inp.dataset.r][ki]; inp.dispatchEvent(new Event('input', { bubbles: true })); inp.dispatchEvent(new Event('change', { bubbles: true })); }); }, ans);
  await p.click('#mit-check-table'); await p.waitForTimeout(200);
  ok(/5|15 of 15/.test(await txt('#mit-table-pill')) && (await p.locator('#mit-table input.is-right').count()) === 15, 'Mitosis: table checked, all 15 marked right (' + (await txt('#mit-table-pill')) + ')');
  const first = p.locator('#mit-table input[data-k]').first();
  await first.fill('9'); await p.waitForTimeout(200);
  ok((await txt('#mit-table-pill')) === 'not checked' && (await p.locator('#mit-table input.is-right, #mit-table input.is-wrong').count()) === 0, 'Mitosis: editing a cell clears every old mark and the "n of 15 correct" pill (' + (await txt('#mit-table-pill')) + ')');
  await p.reload(); await p.waitForTimeout(800); await predict(); await go('mitosis-model');
  ok((await p.locator('#mit-table input.is-right, #mit-table input.is-wrong').count()) === 0, 'Mitosis: the cleared marks stay cleared after reload');

  /* 3. Karyotype counts */
  await go('cancer-karyotypes');
  const kin = p.locator('#k-table input[type=number], #k-table input').first();
  await p.evaluate(() => { const ins = Array.from(document.querySelectorAll('#k-table input')).filter(i => i.type === 'number' || /^(n)$/.test(i.dataset.k || '')); ins.forEach((i, k) => { i.value = [46, 70, 46][k] || 46; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); }); });
  await p.click('#k-check'); await p.waitForTimeout(200);
  ok(/matches|recount/.test(await txt('#k-check-msg')), 'Karyotypes: counts checked');
  await p.evaluate(() => { const i = Array.from(document.querySelectorAll('#k-table input')).find(i => i.type === 'number' || i.dataset.k === 'n'); i.value = '47'; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); });
  await p.waitForTimeout(250);
  ok(!/matches|recount/.test(await txt('#k-check-msg')), 'Karyotypes: editing a count withdraws the old verdicts');

  /* 4. Root tips chi-square: expected-value verdicts and the result follow the observed counts */
  await go('root-tips');
  await p.click('#rt-sample'); await p.waitForTimeout(400);
  await p.evaluate(() => { const n = document.querySelectorAll('#chi-exp input').length; if (!n) throw new Error('no expected inputs'); });
  await p.evaluate(() => { document.querySelectorAll('#chi-exp input').forEach(i => { i.value = '1'; i.dispatchEvent(new Event('input', { bubbles: true })); }); });
  await p.click('#chi-checkexp'); await p.waitForTimeout(200);
  ok(/recheck/.test(await txt('#chi-exp')), 'Chi-square: a wrong expected value is marked recheck');
  await p.fill('#chi-e-0', '123'); await p.waitForTimeout(200);
  ok(!/recheck|correct/.test(await txt('#chi-e-0-fb')), 'Chi-square: editing an expected value withdraws its own verdict');
  await p.click('#chi-run'); await p.waitForTimeout(300);
  const k1 = await key('chi2-lectin');
  ok(k1 != null, 'Chi-square: result and key result exist (' + k1 + ')');
  await p.click('#rt-class'); await p.waitForTimeout(500);
  ok(/Table 4/.test(await txt('#chi-out')) === false && await key('chi2-lectin') == null, 'Chi-square: new class data withdraws the old result and its key result (key now ' + (await key('chi2-lectin')) + ')');

  ok(p.errors.length === 0, 'no page errors ' + p.errors.join('|'));
  await b.close(); done('t57-lab7-verdicts');
})();
