/* Audit 3, Lab 13: every pH chart (Procedure 2 and the design chart with pH as the variable) has an x axis of 2-12, at 1366, 1920 and 400 px.
   LAB13_FILE overrides the page under test. */
const T = require('./_h');
(async () => {
  const b = await T.launch();
  for (const w of [1366, 1920, 400]) {
    const ctx = await T.ctxFor(b, { width: w, height: 900 });
    const p = await T.open(ctx, process.env.LAB13_FILE || 'lab13.html', 'procedure-2-ph');
    const ticks = sel => p.evaluate(s => [...document.querySelectorAll(s + ' svg text')].map(t => t.textContent.trim()).filter(t => /^\d+(\.\d+)?$/.test(t)).map(Number), sel);
    // Procedure 2: run all buffers with the predict gate satisfied
    await p.evaluate(() => { const t = document.querySelector('#p-p2-pred'); if (t) { t.value = 'optimum near pH 5-6'; t.dispatchEvent(new Event('input', { bubbles: true })); } });
    await p.click('#p2-run').catch(e => console.log('run click', e.message.split('\n')[0]));
    await p.waitForFunction(() => /done/i.test(document.querySelector('#p2-status').textContent), null, { timeout: 40000 });
    await p.waitForTimeout(500);
    // the chart may sit in a hidden Graph tab: show it
    await p.evaluate(() => { const t = [...document.querySelectorAll('[role=tab]')].find(x => /graph/i.test(x.textContent) && x.offsetParent); if (t) t.click(); });
    await p.waitForTimeout(400);
    let tk = await ticks('#p2-chart');
    console.log(w, 'procedure 2 x ticks', tk.join(','));
    T.ok(Math.min(...tk.slice(0, 0), ...xTicks(tk)) === 2 && Math.max(...xTicks(tk)) === 12, w + ' px: Procedure 2 axis is pH 2 to 12');
    // design chart with pH
    await p.evaluate(() => { location.hash = '#design'; });
    await p.waitForTimeout(500);
    await p.evaluate(() => { const s = document.querySelector('#d-iv'); s.value = 'ph'; s.dispatchEvent(new Event('change', { bubbles: true })); });
    for (const id of ['d-h']) await p.evaluate(i => { const t = document.querySelector('#p-' + i); if (t) { t.value = 'x x x x'; t.dispatchEvent(new Event('input', { bubbles: true })); } }, id);
    await p.click('#d-run').catch(e => console.log('d-run', e.message.split('\n')[0]));
    await p.waitForFunction(() => /^Done/.test(document.querySelector('#d-status').textContent), null, { timeout: 40000 });
    await p.waitForTimeout(500);
    await p.evaluate(() => { const t = [...document.querySelectorAll('[role=tab]')].find(x => /graph/i.test(x.textContent) && x.offsetParent); if (t) t.click(); });
    await p.waitForTimeout(400);
    tk = await p.evaluate(() => { const c = document.querySelector('#d-chart2'); return [...c.querySelectorAll('svg text')].map(t => t.textContent.trim()); });
    console.log(w, 'design chart texts', tk.join(','));
    const xs = tk.filter(t => /^\d+$/.test(t)).map(Number);
    T.ok(xs.includes(2) && xs.includes(12) && !xs.includes(0) && !xs.includes(15), w + ' px: design chart pH axis is 2 to 12');
    await ctx.close();
  }
  await b.close(); T.done('lab13 ph axis');
  function xTicks(all) { // x ticks are the last ticks drawn; y ticks come first. Take the run that ends the list.
    const out = []; for (let i = all.length - 1; i >= 0; i--) { if (out.length && all[i] >= out[0]) break; out.unshift(all[i]); } return out;
  }
})();
