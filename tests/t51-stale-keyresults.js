/* Labs 3, 4, 6: a key result whose table was cleared / restarted must be withdrawn, not left from the old run.
   We seed key results that have no data behind them (what is left after a re-run clears the table) and expect them gone.
   Run: NODE_PATH=$(npm root -g) node tests/t51-stale-keyresults.js */
const { ok, done, launch, ctxFor, open } = require('./_h');
const CASES = [
  ['lab03', ['top-ident-A', 'clock-slope']],
  ['lab04', ['isotonic-point', 'psi-tissue', 'incipient-psi']],
  ['lab06', ['rate-microresp', 'q10']],
];
(async () => {
  const b = await launch();
  for (const [lab, ids] of CASES) {
    const ctx = await ctxFor(b);
    await ctx.addInitScript(([l, ids]) => { try { if (!sessionStorage.getItem('__k')) { ids.forEach(i => localStorage.setItem(`aplab:${l}:keyres:${i}`, JSON.stringify({ label: 'old ' + i, value: 9.5, unit: 'x', part: 'p', t: 1 }))); sessionStorage.setItem('__k', '1'); } } catch (e) { /* */ } }, [lab, ids]);
    const p = await open(ctx, lab + '.html');
    await p.waitForTimeout(2200);
    const left = await p.evaluate(() => Lab.keyResults().map(r => r.id));
    ok(ids.every(i => !left.includes(i)), `${lab}: stale key results with no data are withdrawn (left: ${left.join(',') || 'none'})`);
    ok(p.errors.length === 0, `${lab}: no page errors ${p.errors.join('|')}`);
    await ctx.close();
  }
  await b.close(); done('t51-stale-keyresults');
})();
