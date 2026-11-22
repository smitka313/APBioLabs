/* The OpenSciEd dashboard must not jump while it loads on a phone. The theme switch is added by script after the first paint; at 375 px it wraps onto its own row,
   so without reserved space the whole page dropped 37 px (CLS 0.28) on about 2 of 3 loads. Measured over repeated loads because the shift depends on timing.
   Run: NODE_PATH=$(npm root -g) node tests/t111-openscied-dashboard-cls.js */
const T = require('./_h');
(async () => {
  const browser = await T.launch(), server = await T.serve();
  try {
    for (const width of [360, 375, 390, 430]) {
      let worst = 0;
      for (let i = 0; i < 8; i++) {
        const ctx = await T.ctxFor(browser, { width, height: 812 }), p = await ctx.newPage();
        await p.route(/gc\.zgo\.at|fonts\./, r => r.fulfill({ status: 200, body: '' }));
        await p.addInitScript(() => { window.__cls = 0; new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true }); });
        await p.goto(server.url + 'openscied-dashboard.html'); await p.waitForTimeout(1200);
        worst = Math.max(worst, await p.evaluate(() => window.__cls)); await ctx.close();
      }
      T.ok(worst <= 0.05, width + ' px: worst layout shift over 8 loads is ' + worst.toFixed(3) + ' (limit 0.05)');
    }
  } finally { await browser.close(); server.close(); }
  T.done('t111-openscied-dashboard-cls');
})();
