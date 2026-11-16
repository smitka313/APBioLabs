/* Targeted PR24 smoke: all labs initialize, first-visit tour opens and its controls work. */
const T = require('./_h');
(async () => {
  const b = await T.launch();
  try {
    for (const lab of T.LABS) {
      const ctx = await T.ctxFor(b, { width: 390, height: 844, touch: true });
      const p = await T.open(ctx, lab + '.html');
      await p.evaluate(() => { Lab.tour.close(); Lab.tour.reset(); Lab.tour.start({ force: true }); });
      const tour = p.locator('#lab-tour');
      T.ok(await tour.isVisible(), lab + ': tour opens');
      T.ok((await tour.locator('.tour-title').innerText()).length > 5, lab + ': tour has a title');
      await tour.locator('.tour-next').click();
      const nextCount = await tour.locator('.tour-count').innerText();
      T.ok(/Step 2 of/.test(nextCount), lab + ': Next advances (' + JSON.stringify(nextCount) + ')');
      await tour.locator('.tour-back').click();
      const backCount = await tour.locator('.tour-count').innerText();
      T.ok(/Step 1 of/.test(backCount), lab + ': Back returns (' + JSON.stringify(backCount) + ')');
      await tour.locator('.tour-skip').click();
      T.ok(await tour.count() === 0, lab + ': Skip closes');
      T.ok(p.errors.length === 0, lab + ': no page errors ' + p.errors.join('; '));
      await ctx.close();
    }
  } finally { await b.close(); }
  T.done('t62-onboarding-quick');
})();
