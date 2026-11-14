/* Lab 3: the trait-table verdict ("Table complete", green/red cells) belongs to the ticks it was made for. Changing a tick must remove it.
   Starts from an erased lab. Run: NODE_PATH=$(npm root -g) node tests/t57-lab3-stale.js */
const { ok, done, launch, ctxFor, open } = require('./_h');
(async () => {
  const b = await launch(), ctx = await ctxFor(b), p = await open(ctx, 'lab03.html');
  await p.evaluate(() => Lab.pages.go('morphology')); await p.waitForTimeout(400);
  /* read the answer key out of the page the way the grader does: click "Check my table" with everything unticked, then tick what it flags */
  await p.evaluate(() => document.getElementById('check-matrix').click());
  const bad = await p.evaluate(() => Array.from(document.querySelectorAll('#matrix td.cell-bad input')).map(i => i.id));
  const ticked = await p.evaluate(() => Array.from(document.querySelectorAll('#matrix td.cell-bad input')).length);
  await p.evaluate(ids => ids.forEach(id => { const i = document.getElementById(id); i.checked = true; i.dispatchEvent(new Event('change', { bubbles: true })); }), bad);
  await p.evaluate(() => document.getElementById('check-matrix').click()); await p.waitForTimeout(200);
  const msg = () => p.evaluate(() => document.getElementById('matrix-msg').textContent.trim());
  const marks = () => p.evaluate(() => document.querySelectorAll('#matrix td.cell-ok, #matrix td.cell-bad').length);
  ok(/Table complete/.test(await msg()) && await marks() > 0, 'table checked: "' + (await msg()).slice(0, 40) + '", ' + await marks() + ' marked cells (' + ticked + ' were ticked from the key)');
  await p.evaluate(id => { const i = document.getElementById(id); i.checked = false; i.dispatchEvent(new Event('change', { bubbles: true })); }, bad[0]);
  await p.waitForTimeout(200);
  ok((await msg()) === '' && await marks() === 0, 'unticking one box removes "Table complete" and every green/red cell mark (now "' + await msg() + '", ' + await marks() + ' marks)');
  await p.reload(); await p.waitForTimeout(800); await p.evaluate(() => Lab.pages.go('morphology')); await p.waitForTimeout(300);
  ok((await msg()) === '' && await marks() === 0, 'and nothing comes back after a reload');
  ok(p.errors.length === 0, 'no page errors ' + p.errors.join('|'));
  await b.close(); done('t57-lab3-stale');
})();
