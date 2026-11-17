/* Phase 3: data feedback reads registered numeric evidence locally. */
const T = require('./_h');
(async () => {
  const b = await T.launch();
  try {
    for (const [lab, table, field] of [['01','d-table','mean'],['02','ss-table','p1'],['03','blast-table','ident'],['04','p1-table','pct'],['05','cup-table','a'],['06','p-table','e'],['07','rt-table-t','ci'],['08','runs-table','eff'],['09','#meas1 .mtable','dist'],['10','p1-raw','dry'],['11','tr-table','rate'],['12','trials-table','A'],['13','p2-table','dA']]) {
      const ctx = await T.ctxFor(b);
      const p = await T.open(ctx, 'lab' + lab + '.html', 'analyze');
      const btn = p.getByRole('button', { name: 'Check my recorded evidence' });
      T.ok(await btn.count() === 1, 'lab' + lab + ': feedback control available');
      await btn.click();
      const area = p.locator('#data-feedback-' + lab + ' [role=status]');
      T.ok(/No recorded trial rows yet/.test(await area.innerText()), 'lab' + lab + ': empty-data feedback');
      await p.evaluate(([id, key]) => {
        const table = Lab._reg.tables.find(t => t.el.id === id || (id.startsWith('#') && t.el.matches(id)));
        if (!table) throw new Error('Missing registered table ' + id); table.api.addRow({ [key]: 12 }, { setup: false });
      }, [table, field]);
      await btn.click();
      T.ok(/recorded rows contain numeric measurements/.test(await area.innerText()), 'lab' + lab + ': numeric evidence recognized');
      T.ok(p.errors.length === 0, 'lab' + lab + ': no page errors');
      await ctx.close();
    }
  } finally { await b.close(); }
  T.done('phase3-data-feedback');
})().catch(e => { console.error(e); process.exitCode = 1; });
