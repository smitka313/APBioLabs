/* Dataset ID stays fixed per student and lab, even when a hash input changes. */
const H = require('./_h');
(async () => {
  const b = await H.launch();
  const ctx = await H.ctxFor(b);
  const p = await H.open(ctx, 'lab13.html');
  const idOf = pg => pg.evaluate(() => Lab.identity.seed.datasetId);
  const id1 = await idOf(p);
  H.ok(/^[A-Z0-9]{3}-[A-Z0-9]{3}$/.test(id1), 'Dataset ID computed: ' + id1);
  const rec = await p.evaluate(() => JSON.parse(localStorage.getItem('aplab:lab13:dataset')));
  H.ok(rec && rec.datasetId === id1, 'ID stored in aplab:lab13:dataset');
  const seedA = await p.evaluate(() => Math.random());
  // Change a hash input: the class period and name case (this used to change the ID).
  await p.evaluate(() => localStorage.setItem('aplab:student', JSON.stringify({ name: 'Test Studnt', period: '5' })));
  await p.reload(); await p.waitForTimeout(700);
  H.ok(await idOf(p) === id1, 'ID unchanged after name/period changed (stored ID wins)');
  const seedB = await p.evaluate(() => Math.random());
  H.ok(typeof seedB === 'number', 'random works');
  H.ok((await p.textContent('.id-line')).includes(id1), 'ID shown in the sign-in line');
  // No stored ID: computed from current inputs, then stored.
  await p.evaluate(() => localStorage.removeItem('aplab:lab13:dataset'));
  await p.reload(); await p.waitForTimeout(700);
  const id3 = await idOf(p);
  H.ok(id3 !== id1, 'without a stored record the ID is computed from the changed inputs: ' + id3);
  H.ok(await p.evaluate(() => !!localStorage.getItem('aplab:lab13:dataset')), 'and stored again');
  // New dataset gives a different ID that then sticks.
  await p.click('.id-newds'); await p.click('.id-confirm .btn--primary'); await p.waitForLoadState('load'); await p.waitForTimeout(2000);
  const id4 = await idOf(p);
  H.ok(id4 !== id3, 'New dataset gives a new ID: ' + id4);
  await p.reload(); await p.waitForTimeout(700);
  H.ok(await idOf(p) === id4, 'new ID sticks across reload');
  // The stored record does not make a lab count as started.
  const ctx2 = await H.ctxFor(b);
  await H.open(ctx2, 'lab13.html');
  const p2 = await H.open(ctx2, 'index.html');
  H.ok(await p2.evaluate(() => !!localStorage.getItem('aplab:lab13:dataset') && Lab.data.labsWithWork().length === 0), 'a visited lab with no work is not "started"');
  H.ok(p.errors.length === 0, 'no console errors ' + p.errors.join(';'));
  await b.close(); H.done('t30-dataset-id');
})();
