/* "Enlarge model" must scale the cell-cycle board and the growth model to fit the window: no part of the canvas
   off screen and no scrolling inside the enlarged view, on desktop, laptop, tablet and phones in both orientations. */
const T = require('./_h');
(async () => {
  const b = await T.launch(), server = await T.serve();
  for (const [w, h] of [[1920, 1000], [1366, 768], [1024, 768], [844, 390], [390, 844]]) {
    const ctx = await T.ctxFor(b, {width:w, height:h, reduced:true});
    const p = await T.open(ctx, 'openscied-b3-cell-cycle.html', 'cell-game', server.url);
    for (const [btn, stage, part] of [['#enlarge-scene', '#cell-board', 'cell-game'], ['#enlarge-growth', '#growth-stage', 'growth-model']]) {
      await p.locator('.step-nav a[href="#' + part + '"]').click(); await p.waitForTimeout(300);
      await p.locator(btn).click(); await p.waitForTimeout(300);
      const r = await p.evaluate(s => { const c = document.querySelector(s + ' canvas').getBoundingClientRect(), st = document.querySelector(s);
        return { l: c.left, t: c.top, r: c.right, b: c.bottom, w: Math.round(c.width), h: Math.round(c.height), scroll: st.scrollWidth > st.clientWidth + 1 || st.scrollHeight > st.clientHeight + 1 }; }, stage);
      T.ok(r.l >= 0 && r.t >= 0 && r.r <= w + .5 && r.b <= h + .5 && !r.scroll, `${w}×${h} ${part}: enlarged model fits the window (${r.w}×${r.h})`);
      T.ok(await p.locator(btn).isVisible(), `${w}×${h} ${part}: the close button stays visible`);
      await p.locator(btn).click(); await p.waitForTimeout(150);
    }
    await ctx.close();
  }
  await b.close(); server.close(); T.done('t83-enlarge-fits');
})();
