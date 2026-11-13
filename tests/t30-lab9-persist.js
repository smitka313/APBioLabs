/* Lab 9: the gel (wells, run time, stain, a run left on) survives a reload. */
const T = require('./_h');
(async () => {
  const b = await T.launch(), ctx = await T.ctxFor(b);
  const p = await T.open(ctx, 'lab09.html', 'run-a-gel');
  await p.evaluate(() => { document.querySelector('#g1-layout').click(); });
  await p.click('#g1-run'); await p.waitForTimeout(2500); await p.click('#g1-run');
  const rd = () => p.evaluate(() => ({ t: +document.querySelector('#g1-time').textContent, dye: document.querySelector('#g1-dye').textContent, leg: document.querySelector('#g1-legend').textContent, stain: document.querySelector('#g1-stain').textContent, run: document.querySelector('#g1-run').textContent }));
  await p.click('#g1-stain');
  const before = await rd();
  T.ok(before.t > 10, 'ran: ' + before.t + ' min');
  await p.reload(); await p.waitForTimeout(900);
  const after = await rd();
  T.ok(after.t === before.t, 'run time restored ' + after.t);
  T.ok(after.dye === before.dye, 'dye front restored ' + after.dye);
  T.ok(after.leg === before.leg && !/nothing loaded/.test(after.leg), 'wells restored: ' + after.leg);
  T.ok(after.stain === before.stain && after.stain !== 'Stain', 'stain stage restored: ' + after.stain);
  T.ok(/continue/.test(after.run), 'run button says continue');
  await p.evaluate(() => document.querySelector('#g1-new').click()); await p.evaluate(() => document.querySelector('#g1-layout').click());
  await p.click('#g1-run'); await p.waitForTimeout(600);
  const t1 = (await rd()).t;
  await p.reload(); await p.waitForTimeout(1500);
  const t2 = (await rd()).t;
  T.ok(t2 > t1, 'gel kept running by the clock: ' + t1 + ' -> ' + t2);
  T.ok(p.errors.length === 0, 'no page errors ' + p.errors.join(';'));
  await b.close(); T.done('lab9 persist');
})();
