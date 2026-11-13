/* Audit 3 (Lab 5 pattern, Labs 8-13): derived key results are dropped or rewritten when the data behind them is cleared or re-run.
   FILES_DIR overrides where the pages are read from (to run the same test on the old pages). */
const T = require('./_h');
(async () => {
  const b = await T.launch();
  const mk = async (file, hash) => { const ctx = await T.ctxFor(b); const p = await T.open(ctx, (process.env.OLD_PREFIX || '') + file, hash); return p; };
  const krs = p => p.evaluate(() => Lab.keyResults().map(r => r.id));
  const setv = (p, sel, v) => p.evaluate(([s, v]) => { const e = document.querySelector(s); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, [sel, v]);

  // Lab 12: trials table cleared -> chi2 / pct-a key results go
  {
    const p = await mk('lab12.html', 'choice-chamber');
    await p.evaluate(() => { Lab.store.set('trials', [{ n: 1, choice: 'A vs B', setup: 's', A: 20, B: 10, chi2: 3.33, sig: 'No' }]); });
    await p.reload(); await p.waitForTimeout(900);
    T.ok((await krs(p)).includes('chi2'), 'lab12: a trial gives a chi2 key result');
    await p.evaluate(() => { const c = [...document.querySelectorAll('button')].find(x => /clear/i.test(x.textContent) && x.closest('#trials-table, #t-table, .table-wrap, section') && x.offsetParent !== null); });
    await p.evaluate(() => { Lab.store.set('trials', []); });
    await p.reload(); await p.waitForTimeout(900);
    await p.evaluate(() => {/* the page recomputes on load */ });
    T.ok(!(await krs(p)).includes('chi2'), 'lab12: emptied trials table drops the chi2 key result (' + (await krs(p)).join(',') + ')');
    await p.context().close();
  }
  // Lab 13: design cleared -> design-fastest goes
  {
    const p = await mk('lab13.html', 'design');
    await p.evaluate(() => { Lab.store.set('d-res', { iv: 'temp', levels: [{ x: 25, mean: 0.1, se: 0.01, reps: [{ read: [0, 0.1, 0.2, 0.3, 0.4, 0.5], rate: 0.1 }] }, { x: 43, mean: 0.2, se: 0.01, reps: [{ read: [0, 0.1, 0.2, 0.3, 0.4, 0.5], rate: 0.2 }] }] }); });
    await p.reload(); await p.waitForTimeout(900);
    T.ok((await krs(p)).includes('design-fastest'), 'lab13: a design result gives a design-fastest key result');
    await p.evaluate(() => document.querySelector('#d-clear').click()); await p.waitForTimeout(400);
    T.ok(!(await krs(p)).includes('design-fastest'), 'lab13: Clear drops the design-fastest key result');
    await p.context().close();
  }
  // Lab 10: reset flat -> npp / avg-daily-gain go
  {
    const p = await mk('lab10.html', 'part-1-npp');
    await p.evaluate(() => { Lab.store.set('p1sum', [{ age: 7, n: 10, wet: 2, dry: 0.4, se: 0.02, pct: null, energy: null, npp: null }, { age: 14, n: 10, wet: 5, dry: 0.9, se: 0.03, pct: null, energy: null, npp: null }]); });
    await p.reload(); await p.waitForTimeout(900);
    T.ok((await krs(p)).includes('npp'), 'lab10: two harvests give an npp key result');
    await p.evaluate(() => document.querySelector('#p1-reset').click()); await p.waitForTimeout(500);
    T.ok(!(await krs(p)).some(k => k === 'npp' || k === 'avg-daily-gain'), 'lab10: resetting the flat drops npp and avg-daily-gain (' + (await krs(p)).join(',') + ')');
    await p.context().close();
  }
  // Lab 11: Clear data -> tr-rate-* go
  {
    const p = await mk('lab11.html', 'water-loss');
    await setv(p, '#p-predict-water', 'fan fastest'); await setv(p, '#tr-n', '2');
    await p.click('#tr-run'); await p.waitForFunction(() => document.querySelectorAll('#tr-table tbody tr').length >= 2, null, { timeout: 60000 }); await p.waitForTimeout(800);
    T.ok((await krs(p)).some(k => /^tr-rate-/.test(k)), 'lab11: a run gives a tr-rate key result');
    await p.waitForTimeout(5000);
    await p.evaluate(() => document.querySelector('#tr-clear').click()); await p.waitForTimeout(500);
    T.ok(!(await krs(p)).some(k => /^tr-rate-/.test(k)), 'lab11: Clear data drops the tr-rate key results (' + (await krs(p)).join(',') + ')');
    await p.context().close();
  }
  // Lab 8: runs table emptied -> efficiency key results go
  {
    const p = await mk('lab08.html', 'transform');
    await p.evaluate(() => { Lab.store.set('runs', [{ run: 1, cond: 'x', amp: 100, ara: 80, dna: 0.0004, eff: 250000, sci: '2.5 × 10^5' }]); });
    await p.reload(); await p.waitForTimeout(900);
    await p.evaluate(() => { const t = document.querySelector('#runs-table'); });
    T.ok((await krs(p)).includes('transformation-efficiency'), 'lab8: a saved run gives an efficiency key result');
    await p.evaluate(() => Lab.store.set('runs', []));
    await p.reload(); await p.waitForTimeout(1200);
    T.ok(!(await krs(p)).includes('transformation-efficiency'), 'lab8: an emptied runs table drops the efficiency key result (' + (await krs(p)).join(',') + ')');
    await p.context().close();
  }
  await b.close(); T.done('stale key results labs 8-13');
})();
