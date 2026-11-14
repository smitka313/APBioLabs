/* Performance: LCP, CLS, long tasks (PerformanceObserver) and total script / task time (CDP Performance.getMetrics)
   for index and all 13 labs at 1366 px and 375 px, plus 375 px with 4× CPU throttling.
   Served over a local http server. Thresholds are informational (LCP ≤ 2.5 s, CLS ≤ 0.1): they are printed, not failed.
   The test fails only on page errors or if a page never paints.
   Run: NODE_PATH=$(npm root -g) node tests/t59-perf.js */
const T = require('./_h');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const PAGES = ['index.html', ...T.LABS.map(l => l + '.html')];
const CONFIGS = [{ name: '1366', width: 1366, height: 768, cpu: 1 }, { name: '375', width: 375, height: 812, cpu: 1, mobile: true }, { name: '375 cpu×4', width: 375, height: 812, cpu: 4, mobile: true }];

(async () => {
  const srv = await T.serve(), b = await T.launch(), rows = [];
  for (const c of CONFIGS) {
    for (const pg of PAGES) {
      const ctx = await T.ctxFor(b, { width: c.width, height: c.height, mobile: c.mobile, touch: c.mobile });
      await ctx.route(/gc\.zgo\.at/, r => r.abort());
      await ctx.addInitScript(() => {
        window.__perf = { lcp: 0, cls: 0, long: 0, longMax: 0, longN: 0 };
        try {
          new PerformanceObserver(l => l.getEntries().forEach(e => { window.__perf.lcp = e.renderTime || e.startTime; })).observe({ type: 'largest-contentful-paint', buffered: true });
          new PerformanceObserver(l => l.getEntries().forEach(e => { if (!e.hadRecentInput) window.__perf.cls += e.value; })).observe({ type: 'layout-shift', buffered: true });
          new PerformanceObserver(l => l.getEntries().forEach(e => { window.__perf.long += e.duration; window.__perf.longN++; window.__perf.longMax = Math.max(window.__perf.longMax, e.duration); })).observe({ type: 'longtask', buffered: true });
        } catch (e) { /* ignore */ }
      });
      const p = await ctx.newPage(); const errs = [];
      p.on('pageerror', e => errs.push(e.message));
      const cdp = await ctx.newCDPSession(p);
      await cdp.send('Performance.enable');
      if (c.cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: c.cpu });
      const t0 = Date.now();
      await p.goto(srv.url + pg, { waitUntil: 'load' });
      const load = Date.now() - t0;
      await sleep(3000 * (c.cpu > 1 ? 1.5 : 1));
      await p.mouse.click(5, 5).catch(() => {});   // LCP stops at the first input
      const perf = await p.evaluate(() => window.__perf);
      const m = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(x => [x.name, x.value]));
      rows.push({ cfg: c.name, pg, load, lcp: perf.lcp, cls: perf.cls, longN: perf.longN, long: perf.long, longMax: perf.longMax, script: m.ScriptDuration * 1000, task: m.TaskDuration * 1000, heap: m.JSHeapUsedSize / 1048576 });
      T.ok(perf.lcp > 0 && errs.length === 0, `${pg} @ ${c.name}: painted (LCP ${Math.round(perf.lcp)} ms), no page errors ${errs.join(' | ')}`);
      await ctx.close();
    }
  }
  const f = (x, d = 0) => x.toFixed(d).padStart(7);
  console.log('\n| config | page | load ms | LCP ms | CLS | long tasks (n / total ms / max ms) | script ms | task ms | heap MB | LCP ≤ 2.5 s | CLS ≤ 0.1 |');
  console.log('|---|---|---|---|---|---|---|---|---|---|---|');
  rows.forEach(r => console.log(`| ${r.cfg} | ${r.pg} | ${f(r.load)} | ${f(r.lcp)} | ${r.cls.toFixed(3)} | ${r.longN} / ${Math.round(r.long)} / ${Math.round(r.longMax)} | ${f(r.script)} | ${f(r.task)} | ${r.heap.toFixed(1)} | ${r.lcp <= 2500 ? 'yes' : 'NO'} | ${r.cls <= 0.1 ? 'yes' : 'NO'} |`));
  const bad = rows.filter(r => r.lcp > 2500 || r.cls > 0.1);
  console.log(`\n  informational: ${bad.length} of ${rows.length} page loads miss LCP ≤ 2.5 s or CLS ≤ 0.1` + (bad.length ? ': ' + bad.map(r => `${r.pg}@${r.cfg} (LCP ${Math.round(r.lcp)}, CLS ${r.cls.toFixed(3)})`).join(', ') : ''));
  await b.close(); srv.close();
  T.done('t59-perf');
})();
