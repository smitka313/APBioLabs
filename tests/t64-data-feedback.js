/* Phase 3: data feedback reads registered numeric evidence locally. */
const T = require('./_h');
(async () => {
  const b = await T.launch();
  try {
    for (const [lab, table, field] of [['04','p1-table','pct'],['05','cup-table','a'],['06','p-table','e']]) {
      const ctx = await T.ctxFor(b);
      const p = await T.open(ctx, 'lab' + lab + '.html', 'analyze');
      const btn = p.getByRole('button', { name: 'Check my recorded evidence' });
      T.ok(await btn.count() === 1, 'lab' + lab + ': feedback control available');
      await btn.click();
      const area = p.locator('#data-feedback-' + lab + ' [role=status]');
      T.ok(/No recorded trial rows yet/.test(await area.innerText()), 'lab' + lab + ': empty-data feedback');
      await p.evaluate(([id, key]) => {
        const table = Lab._reg.tables.find(t => t.el.id === id);
        table.addRow({ [key]: 12 });
      }, [table, field]);
      await btn.click();
      T.ok(/recorded rows contain numeric measurements/.test(await area.innerText()), 'lab' + lab + ': numeric evidence recognized');
      T.ok(p.errors.length === 0, 'lab' + lab + ': no page errors');
      await ctx.close();
    }
  } finally { await b.close(); }
  T.done('phase3-data-feedback');
})().catch(e => { console.error(e); process.exitCode = 1; });
