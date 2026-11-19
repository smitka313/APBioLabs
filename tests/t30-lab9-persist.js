/* Lab 9: the gel (wells, run time, stain, a run left on) survives a reload. */
const T = require('./_h');
(async () => {
  // Persistence needs a defined web origin. file:// localStorage behavior is
  // browser-dependent; exercise the same HTTP storage model as the deployed site.
  const server = await T.serve();
  let b;
  try {
    b = await T.launch();
    const ctx = await T.ctxFor(b);
    const p = await T.open(ctx, 'lab09.html', 'run-a-gel', server.url);
    await p.evaluate(() => { document.querySelector('#g1-layout').click(); });
    await p.click('#g1-run'); await p.waitForTimeout(2500); await p.click('#g1-run');
    const rd = () => p.evaluate(() => ({ t: +document.querySelector('#g1-time').textContent, dye: document.querySelector('#g1-dye').textContent, leg: document.querySelector('#g1-legend').textContent, stain: document.querySelector('#g1-stain').textContent, run: document.querySelector('#g1-run').textContent }));
    await p.click('#g1-stain');
    await p.click('#g1-mdye');
    const dyeNote = await p.evaluate(() => document.querySelector('#g1-msg').textContent);
    T.ok(/Notebook estimate: .* mm/.test(dyeNote) && /Power-supply readout: .* mm/.test(dyeNote) && /simulated measurement uncertainty/.test(dyeNote), 'dye-front estimate explains its difference from the power-supply readout');
    const before = await rd();
    T.ok(before.t > 10, 'ran: ' + before.t + ' min');
    // Verify that the completed gel was actually written before testing reload.
    // A missing record is a save failure, not a restore failure; report it separately.
    const saved = await p.evaluate(() => {
      const keys = Object.keys(localStorage).filter(k => k.includes('gelstate-g1'));
      return keys.map(k => ({ key: k, value: localStorage.getItem(k) }));
    });
    T.ok(saved.some(x => { try { const v = JSON.parse(x.value); return v && v.t > 10 && v.lanes?.some(l => l.length); } catch (_) { return false; } }),
      'gel state persisted before reload (' + saved.map(x => x.key).join(', ') + ')');
    await p.reload(); await p.waitForTimeout(900);
    const after = await rd();
    const restored = await p.evaluate(keys => keys.map(key => ({ key, value: localStorage.getItem(key) })), saved.map(x => x.key));
    // Distinguish lost/overwritten storage from a render/restore failure.
    // Staining may advance while reloading, so compare the saved gel and wells.
    T.ok(saved.length > 0 && saved.every((entry, i) => {
      try {
        const a = JSON.parse(entry.value), z = JSON.parse(restored[i].value);
        return a && z && a.gel === z.gel && a.t === z.t && a.dist === z.dist &&
          JSON.stringify(a.lanes) === JSON.stringify(z.lanes);
      } catch (_) { return false; }
    }), 'saved gel record retained after reload' + (after.t !== before.t ? ': ' + JSON.stringify({ saved, restored }) : ''));
    T.ok(after.t === before.t, 'run time restored ' + after.t);
    T.ok(after.dye === before.dye, 'dye front restored ' + after.dye);
    T.ok(after.leg === before.leg && !/nothing loaded/.test(after.leg), 'wells restored: ' + after.leg);
    T.ok(after.stain === before.stain && after.stain !== 'Stain', 'stain stage restored: ' + after.stain);
    T.ok(/continue/.test(after.run), 'run button says continue');
    const savedG1 = JSON.parse(saved.find(x => x.key.includes('gelstate-g1')).value);
    await p.evaluate(() => { const el = document.querySelector('#case-no'); el.value = '903'; el.dispatchEvent(new Event('change', { bubbles: true })); });
    await p.waitForTimeout(400);
    await p.evaluate(() => Lab.pages.go('design-crime-scene'));
    await p.waitForTimeout(400);
    await p.locator('#g2-new').evaluate(el => { const details = el.closest('details'); if (details && !details.open) details.querySelector('summary')?.click(); });
    await p.click('#g2-new');
    const gelStateAfterNewEvidenceGel = await p.evaluate(() => JSON.parse(localStorage.getItem('aplab:lab09:gelstate-g1')));
    const evidenceGelState = await p.evaluate(() => JSON.parse(localStorage.getItem('aplab:lab09:gelstate-g2-903')));
    T.ok(gelStateAfterNewEvidenceGel.gel === savedG1.gel && gelStateAfterNewEvidenceGel.t === savedG1.t && gelStateAfterNewEvidenceGel.dist === savedG1.dist && JSON.stringify(gelStateAfterNewEvidenceGel.lanes) === JSON.stringify(savedG1.lanes), 'pouring a new evidence gel preserves the saved standard-gel state');
    T.ok(evidenceGelState && evidenceGelState.t === 0 && evidenceGelState.lanes.every(l => l.length === 0), 'new evidence gel starts with its own empty state');
    await p.evaluate(() => Lab.pages.go('run-a-gel'));
    await p.waitForTimeout(400);
    await p.evaluate(() => document.querySelector('#g1-new').click()); await p.evaluate(() => document.querySelector('#g1-layout').click());
    await p.click('#g1-run'); await p.waitForTimeout(600);
    const t1 = (await rd()).t;
    await p.reload(); await p.waitForTimeout(1500);
    const t2 = (await rd()).t;
    T.ok(t2 > t1, 'gel kept running by the clock: ' + t1 + ' -> ' + t2);
    T.ok(p.errors.length === 0, 'no page errors ' + p.errors.join(';'));
    T.done('lab9 persist');
  } finally {
    if (b) await b.close();
    await server.close();
  }
})();
