/* Lab 4: a check verdict belongs to the entries it was made for. Editing an entry (or an assignment) must remove it at once, not leave
   "All six correct" / "OK" pills next to changed values. Starts from an erased lab.
   Run: NODE_PATH=$(npm root -g) node tests/t57-lab4-stale.js */
const { ok, done, launch, ctxFor, open } = require('./_h');
(async () => {
  const b = await launch(), ctx = await ctxFor(b, { reduced: true }), p = await open(ctx, 'lab04.html');
  const go = async id => { await p.evaluate(i => Lab.pages.go(i), id); await p.waitForTimeout(350); };
  const txt = sel => p.evaluate(s => (document.querySelector(s) || {}).textContent || '', sel);
  await p.evaluate(() => document.querySelectorAll('textarea[id^="p-predict-"]').forEach(t => { t.value = 'Smaller blocks fill faster.'; t.dispatchEvent(new Event('input', { bubbles: true })); t.dispatchEvent(new Event('change', { bubbles: true })); }));
  await p.waitForTimeout(1200);

  /* identify the cups */
  await go('water-potential');
  await p.evaluate(() => document.getElementById('p3b-id').click()); await p.waitForTimeout(1200);
  await p.evaluate(() => document.getElementById('p3b-reveal').click()); await p.waitForTimeout(200);
  await p.evaluate(() => document.getElementById('p3b-idcheck').click()); await p.waitForTimeout(200);
  ok(/All six correct/.test(await txt('#p3b-idfb')), 'cups identified: "' + (await txt('#p3b-idfb')).slice(0, 40) + '"');
  await p.evaluate(() => { const s = document.getElementById('p3b-as0'); s.value = Array.from(s.options).map(o => o.value).find(v => v !== s.value && v !== ''); s.dispatchEvent(new Event('change', { bubbles: true })); });
  await p.waitForTimeout(150);
  ok((await txt('#p3b-idfb')).trim() === '', 'changing one assignment withdraws "All six correct" at once (now "' + (await txt('#p3b-idfb')).trim().slice(0, 40) + '")');

  /* soak calculation */
  await p.evaluate(() => document.getElementById('p3b-run').click()); await p.waitForTimeout(1200);
  await p.fill('#p3b-c', '0.3'); await p.fill('#p3b-psis', '-7.4'); await p.fill('#p3b-psi', '-7.4');
  await p.evaluate(() => document.getElementById('p3b-check').click()); await p.waitForTimeout(200);
  ok((await txt('#p3b-fb')).trim().length > 5, 'soak calculation checked: "' + (await txt('#p3b-fb')).trim().slice(0, 50) + '"');
  await p.fill('#p3b-psi', '-7.5'); await p.waitForTimeout(150);
  ok((await txt('#p3b-fb')).trim() === '', 'editing a value withdraws the verdict at once');
  await p.evaluate(() => document.getElementById('p3b-check').click()); await p.waitForTimeout(200);
  await p.reload(); await p.waitForTimeout(900); await go('water-potential'); await p.waitForTimeout(500);
  ok((await txt('#p3b-fb')).trim().length > 5, 'a verdict for unchanged values comes back after a reload');
  await p.fill('#p3b-c', '0.31'); await p.waitForTimeout(150);
  ok((await txt('#p3b-fb')).trim() === '', 'and is withdrawn when the restored value is edited');

  /* SA:V calculations */
  await go('sa-v');
  await p.evaluate(() => document.getElementById('p1-run').click()); await p.waitForTimeout(1200);
  await p.evaluate(() => document.getElementById('p1-check').click()); await p.waitForTimeout(200);
  ok((await txt('#p1-fb')).trim().length > 5, 'SA:V calculations checked: "' + (await txt('#p1-fb')).trim().slice(0, 50) + '"');
  await p.evaluate(() => document.getElementById('p1-run').click()); await p.waitForTimeout(250);
  ok((await txt('#p1-fb')).trim() === '', 'a new soak withdraws the old verdict at once');
  ok(p.errors.length === 0, 'no page errors ' + p.errors.join('|'));
  await b.close(); done('t57-lab4-stale');
})();
