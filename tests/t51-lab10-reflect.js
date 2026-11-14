/* Audit 3 round 2, Lab 10, each scenario from a fully erased state (fresh browser context): after every harvest is dried, the Reflect prose and the
   Analyze personal prompt are regenerated from the harvests in the table (= the graph) within 200 ms, with no lag and no stale "one harvest" text.
   A: harvests on different days. B: three harvests on the same day (the reviewer's "still says one harvest so far"). LAB10_FILE overrides the page. */
const T = require('./_h');
(async () => {
  const b = await T.launch();
  const run = async (name, plus7Each) => {
    const ctx = await T.ctxFor(b, { width: 1366, height: 900 });
    const p = await T.open(ctx, process.env.LAB10_FILE || 'lab10.html', 'part-1-npp');
    T.ok(await p.evaluate(() => !Object.keys(localStorage).some(k => /p1sum/.test(k))), name + ': erased start');
    const read = () => p.evaluate(() => {
      const ch = document.querySelector('#p1-chart'), first = document.querySelector('#reflect-compare .pvc');
      const k = Object.keys(localStorage).find(k => /p1sum$/.test(k)), sum = k ? JSON.parse(localStorage.getItem(k)) : [];
      const q = s => { const e = first.querySelector(s); return e ? e.textContent.replace(/\s+/g, ' ').trim() : ''; };
      const my = [...document.querySelectorAll('label')].map(m => m.textContent.replace(/\s+/g, ' ').trim()).filter(t => /^(Between your day|You have \d+ harvests|Your day-\d+ plants|Compare your own NPP)/.test(t));
      return { pts: ch.querySelectorAll('circle').length, ages: sum.map(r => r.age), dry: sum.map(r => r.dry.toFixed(3)), sumTxt: q('.pvc-sum'), what: q('.pvc-what'), my: my[0] || '' };
    });
    await p.evaluate(() => { const t = document.querySelector('#p-p1-diagram'); t.value = 'energy in from light, out as respiration and biomass'; t.dispatchEvent(new Event('input', { bubbles: true })); });
    if (!plus7Each) { await p.click('#p1-plus7'); await p.waitForTimeout(600); }
    for (let k = 1; k <= 3; k++) {
      if (plus7Each) { await p.click('#p1-plus7'); await p.waitForTimeout(600); }
      await p.click('#p1-harvest'); await p.waitForTimeout(400); await p.click('#p1-dry');
      await p.waitForFunction(() => !document.querySelector('#p1-rd').textContent.includes('drying'), null, { timeout: 30000 });
      await p.waitForTimeout(200);   // far below the 1.5 s poll: the text must already be current
      const s = await read(), tag = name + ' harvest ' + k + ': ';
      T.ok(s.ages.length === k && s.pts === k, tag + s.ages.length + ' saved, ' + s.pts + ' on the graph');
      T.ok((s.sumTxt.match(/ g on day/g) || []).length === k && s.dry.every(d => s.sumTxt.includes(d)), tag + 'mean-dry-mass line lists all ' + k);
      if (k === 1) T.ok(/one harvest so far/.test(s.what), tag + 'says one harvest');
      else {
        T.ok(!/one harvest so far/.test(s.what), tag + 'no stale one-harvest text (' + s.what.slice(0, 100) + ')');
        const lo = Math.min(...s.ages), hi = Math.max(...s.ages);
        if (hi > lo) T.ok(new RegExp('day-' + lo + ' and day-' + hi).test(s.what) && new RegExp('day-' + lo + ' and day-' + hi).test(s.my), tag + 'Reflect and Analyze name the first and last harvest days');
        else T.ok(new RegExp(k + ' harvests').test(s.what) && s.dry.every(d => s.what.includes(d)) && new RegExp(k + ' harvests').test(s.my), tag + 'Reflect and Analyze say ' + k + ' harvests on one day (' + s.my.slice(0, 90) + ')');
      }
    }
    T.ok(p.errors.length === 0, name + ': no page errors ' + p.errors.join(';'));
    await ctx.close();
  };
  await run('A different days', true);
  await run('B same day', false);
  await b.close(); T.done('lab10 reflect');
})();
