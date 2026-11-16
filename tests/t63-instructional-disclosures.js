/* Focused accessibility check for static instructional disclosures across labs. */
const T = require('./_h');
(async () => {
  const b = await T.launch();
  for (const lab of T.LABS) {
    const ctx = await T.ctxFor(b);
    const p = await T.open(ctx, lab + '.html');
    const count = await p.locator('section.step details.disclose').count();
    for (let i = 0; i < count; i++) {
      const d = p.locator('section.step details.disclose').nth(i);
      const info = await d.evaluate(e => ({ section: e.closest('section.step')?.id, hasSummary: !!e.querySelector(':scope > summary') }));
      if (!info.section || !info.hasSummary) continue;
      await p.evaluate(id => Lab.pages.go(id), info.section);
      const summary = d.locator('summary').first();
      await summary.focus();
      const before = await d.evaluate(e => e.open);
      await p.keyboard.press('Enter');
      await p.waitForFunction(([index, initial]) => {
        const el = document.querySelectorAll('section.step details.disclose')[index];
        return !!el && el.open !== initial;
      }, [i, before], { timeout: 1500 }).catch(() => {});
      const after = await d.evaluate(e => e.open);
      T.ok(before !== after, lab + ': disclosure ' + i + ' toggles with Enter (section ' + info.section + ', before=' + before + ', after=' + after + ')');
    }
    T.ok(p.errors.length === 0, lab + ': no page errors');
    await ctx.close();
  }
  await b.close(); T.done('instructional disclosures');
})().catch(e => { console.error(e); process.exitCode = 1; });
