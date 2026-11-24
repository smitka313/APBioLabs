/* Play-test Nov 20, item 7: "Print / Save as PDF" stalled the tester's tab. Not reproduced in Chromium: the print path
   only rebuilds the report and calls window.print(); in print media the canvases are hidden once, with no resize or redraw
   loop, and the print pipeline (page.pdf) renders the report in well under a second. This test keeps it that way. */
const T = require('./_h');
(async () => {
  const browser = await T.launch(), server = await T.serve();
  try {
    for (const section of ['cell-game', 'growth-model', 'submit']) {
      const ctx = await T.ctxFor(browser, {width:1919,height:1000});
      const p = await T.open(ctx,'openscied-b3-cell-cycle.html','growth-model',server.url);
      for (let i = 0; i < 4; i++) { await p.locator('#run-trials').click(); await p.waitForTimeout(40); }
      await p.locator('.step-nav a[href="#cell-game"]').click(); await p.locator('#start-round1').click(); await p.waitForTimeout(100);
      await p.locator('.step-nav a[href="#' + section + '"]').click(); await p.waitForTimeout(300);
      if (section === 'growth-model') await p.locator('#replay-growth').click();
      await p.evaluate(() => {
        window.__w = 0; const d = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'width');
        Object.defineProperty(HTMLCanvasElement.prototype, 'width', {get(){return d.get.call(this);}, set(v){window.__w++; d.set.call(this, v);}, configurable:true});
        window.__printed = 0; const real = window.print; window.print = () => { window.__printed++; real.call(window); };
      });
      if (section === 'submit') {
        await p.locator('#submit details.ose-report-other > summary').click();
        await p.locator('#print-work').click();
        T.ok(await p.evaluate(() => window.__printed) === 1, 'Printing the activity summary calls window.print once');
      }
      await p.emulateMedia({media:'print'}); await p.waitForTimeout(800);
      const a = await p.evaluate(() => window.__w); await p.waitForTimeout(800); const b = await p.evaluate(() => window.__w);
      T.ok(a <= 4 && a === b, `${section}: in print media the canvases settle (width set ${a} times, then ${b - a} more)`);
      const t0 = Date.now(); const pdf = await p.pdf({format:'Letter'}); const ms = Date.now() - t0;
      T.ok(ms < 5000 && pdf.length > 10000, `${section}: the print pipeline renders the report (${ms} ms, ${pdf.length} bytes)`);
      T.ok(p.errors.length === 0, `${section}: no page errors: ` + p.errors.join('; '));
      await ctx.close();
    }
  } catch (e) { T.ok(false, 'unexpected error: ' + e.message.split('\n')[0]); }
  await browser.close(); server.close(); T.done('t89-print');
})();
