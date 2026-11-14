/* Lab 6: the verdicts under the microrespirometer table ("n of m entries correct", "Yes / Not quite" for the rate) belong to the values
   they were made for. Editing a cell or the rate, or starting a new run, must remove them at once. Starts from an erased lab.
   Run: NODE_PATH=$(npm root -g) node tests/t57-lab6-stale.js */
const { ok, done, launch, ctxFor, open } = require('./_h');
(async () => {
  const b = await launch(), ctx = await ctxFor(b, { reduced: true }), p = await open(ctx, 'lab06.html');
  const go = async id => { await p.evaluate(i => Lab.pages.go(i), id); await p.waitForTimeout(350); };
  const txt = sel => p.evaluate(s => (document.querySelector(s) || {}).textContent || '', sel);
  await p.evaluate(() => document.querySelectorAll('textarea[id^="p-predict-"]').forEach(t => { t.value = 'Seeds will use more oxygen.'; t.dispatchEvent(new Event('input', { bubbles: true })); t.dispatchEvent(new Event('change', { bubbles: true })); }));
  await p.waitForTimeout(1200);
  await go('microrespirometer');
  await p.evaluate(() => document.getElementById('p-run').click()); await p.waitForTimeout(1500);
  const n = await p.evaluate(() => document.querySelectorAll('#p-table tbody tr').length);
  ok(n >= 3, 'run finished with ' + n + ' rows');
  /* type a number into every editable cell (wrong on purpose) */
  await p.evaluate(() => document.querySelectorAll('#p-table input').forEach(i => { i.value = '0.5'; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); }));
  await p.evaluate(() => document.getElementById('p-check').click()); await p.waitForTimeout(200);
  ok(/entries correct|are correct/.test(await txt('#p-check-msg')), 'calculations checked: "' + (await txt('#p-check-msg')).slice(0, 50) + '"');
  await p.evaluate(() => { const i = document.querySelector('#p-table input'); i.value = '0.6'; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); });
  await p.waitForTimeout(150);
  ok((await txt('#p-check-msg')).trim() === '', 'editing one cell withdraws the "n of m correct" verdict at once (now "' + (await txt('#p-check-msg')).trim().slice(0, 40) + '")');
  await p.evaluate(() => document.getElementById('p-check').click()); await p.waitForTimeout(200);

  await p.fill('#p-rate-in', '1.5');
  await p.evaluate(() => document.getElementById('p-rate-check').click()); await p.waitForTimeout(200);
  ok(/Yes|Not quite/.test(await txt('#p-rate-msg')), 'rate checked: "' + (await txt('#p-rate-msg')).slice(0, 40) + '"');
  await p.fill('#p-rate-in', '1.6'); await p.waitForTimeout(150);
  ok((await txt('#p-rate-msg')).trim() === '', 'editing the rate withdraws its verdict at once');
  await p.evaluate(() => document.getElementById('p-rate-check').click()); await p.waitForTimeout(200);

  await p.reload(); await p.waitForTimeout(900); await go('microrespirometer'); await p.waitForTimeout(400);
  ok(/entries correct|are correct/.test(await txt('#p-check-msg')) && /Yes|Not quite/.test(await txt('#p-rate-msg')), 'verdicts for unchanged values come back after a reload');

  await p.evaluate(() => document.getElementById('p-run').click()); await p.waitForTimeout(300);
  ok((await txt('#p-check-msg')).trim() === '' && (await txt('#p-rate-msg')).trim() === '', 'a new run withdraws both verdicts (now "' + (await txt('#p-check-msg')).trim().slice(0, 30) + '" / "' + (await txt('#p-rate-msg')).trim().slice(0, 30) + '")');
  ok(p.errors.length === 0, 'no page errors ' + p.errors.join('|'));
  await b.close(); done('t57-lab6-stale');
})();
