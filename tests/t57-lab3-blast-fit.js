/* Lab 3: the BLAST "Descriptions" table and the "Recorded hits" table must fit their panel at desktop width: no sideways scroll, so the
   Alignment column (View links) and the "Where is it on your cladogram?" column are never clipped. Starts from an erased lab.
   Run: NODE_PATH=$(npm root -g) node tests/t57-lab3-blast-fit.js */
const { ok, done, launch, ctxFor, open } = require('./_h');
(async () => {
  const b = await launch();
  for (const w of [1366, 1920]) {
    const ctx = await ctxFor(b, { width: w, height: 900 }), p = await open(ctx, 'lab03.html');
    await p.evaluate(() => Lab.pages.go('blast-the-genes')); await p.waitForTimeout(500);
    await p.evaluate(() => { document.querySelectorAll('textarea[id^="p-predict-"]').forEach(t => { t.value = 'I predict gene A matches birds.'; t.dispatchEvent(new Event('input', { bubbles: true })); t.dispatchEvent(new Event('change', { bubbles: true })); }); });
    await p.waitForTimeout(1200);
    await p.evaluate(() => document.getElementById('run-blast').click()); await p.waitForTimeout(1000);
    await p.evaluate(() => document.getElementById('log-blast').click()); await p.waitForTimeout(1500);
    const m = await p.evaluate(() => ['#blast-hits', '#blast-table'].map(sel => {
      const tw = document.querySelector(sel + ' .table-wrap'), t = tw.querySelector('table'), last = t.querySelector('thead th:last-child').getBoundingClientRect(), r = tw.getBoundingClientRect();
      const visibleHeads = Array.from(t.querySelectorAll('thead th')).filter(h => h.getBoundingClientRect().width > 0).map(h => h.textContent.trim());
      return { sel, wrap: tw.clientWidth, scroll: tw.scrollWidth, lastRight: Math.round(last.right), wrapRight: Math.round(r.right), scrollable: tw.classList.contains('is-scrollable'), hint: !!(tw.parentNode.querySelector('.scroll-hint') && tw.parentNode.querySelector('.scroll-hint').offsetParent), visibleHeads };
    }));
    m.forEach(x => {
      console.log('   ', w, JSON.stringify(x));
      ok(x.scroll <= x.wrap + 1 && x.lastRight <= x.wrapRight + 1, `${w}px ${x.sel}: last column inside the panel (scroll ${x.scroll} > wrap ${x.wrap}? last column right ${x.lastRight}, panel ${x.wrapRight})`);
    });
    ok(m[0].visibleHeads.includes('Alignment'), `${w}px: Alignment column is visible in Descriptions`);
    ok(m[1].visibleHeads.some(h => /Where is it/.test(h)), `${w}px: "Where is it on your cladogram?" column is visible in Recorded hits`);
    ok(p.errors.length === 0, `${w}px: no page errors ${p.errors.join('|')}`);
    await ctx.close();
  }
  await b.close(); done('t57-lab3-blast-fit');
})();
