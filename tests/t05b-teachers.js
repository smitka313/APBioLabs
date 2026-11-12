/* #5 teachers.html table matches each lab's live progress count ("10 parts (7 with work)") */
const T = require('./_h');
(async () => {
  const b = await T.launch(), ctx = await T.ctxFor(b);
  const t = await T.open(ctx, 'teachers.html');
  const rows = await t.evaluate(() => Array.from(document.querySelectorAll('.labs-table tbody tr')).map(r => ({ href: r.querySelector('th a').getAttribute('href'), cnt: r.querySelector('td.num').textContent.trim(), links: r.querySelectorAll('td.parts a').length })));
  T.ok(rows.length === 13, '13 rows');
  for (const r of rows) {
    const lab = r.href.replace('.html', '');
    const p = await T.open(ctx, r.href); await p.waitForTimeout(800);
    const nav = await p.evaluate(() => ({ u: Lab.progress.update(), text: (document.querySelector('.nav-progress .np-long') || {}).textContent, links: document.querySelectorAll('.step-nav ol a').length }));
    T.ok(r.cnt === `${nav.u.sections} parts (${nav.u.total} with work)`, `${lab}: teachers says "${r.cnt}", lab says ${nav.u.sections} parts, ${nav.u.total} with work (nav "${nav.text}")`);
    T.ok(r.links === nav.links && nav.links === nav.u.sections, `${lab}: part links in the table (${r.links}) = nav (${nav.links})`);
    await p.close();
  }
  T.ok(t.errors.length === 0, 'no page errors');
  await b.close();
  T.done('t05b-teachers');
})();
