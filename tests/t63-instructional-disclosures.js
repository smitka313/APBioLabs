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
      // Nested disclosures can be inside a closed parent <details>. Such a
      // summary is not keyboard-focusable until its ancestors are expanded.
      // Open those ancestors through their own summary controls first.
      const ancestors = await d.evaluate(e => {
        const result = []; let parent = e.parentElement;
        while (parent) {
          if (parent.tagName === 'DETAILS' && !parent.open) {
            const all = [...document.querySelectorAll('details')];
            result.unshift(all.indexOf(parent));
          }
          parent = parent.parentElement;
        }
        return result;
      });
      for (const index of ancestors) {
        const parent = p.locator('details').nth(index);
        await parent.locator(':scope > summary').focus();
        await p.keyboard.press('Enter');
        await p.waitForFunction(idx => document.querySelectorAll('details')[idx]?.open, index, { timeout: 2000 });
      }
      const summary = d.locator(':scope > summary');
      await summary.focus();
      const focused = await summary.evaluate(e => document.activeElement === e);
      const before = await d.evaluate(e => e.open);
      if (focused) {
        await p.keyboard.press('Enter');
        await p.waitForFunction(([index, initial]) => {
          const el = document.querySelectorAll('section.step details.disclose')[index];
          return !!el && el.open !== initial;
        }, [i, before], { timeout: 2000 }).catch(() => {});
      }
      const after = await d.evaluate(e => e.open);
      T.ok(focused && before !== after, lab + ': disclosure ' + i + ' keyboard accessible (section ' + info.section + ', focused=' + focused + ', before=' + before + ', after=' + after + ')');
    }
    T.ok(p.errors.length === 0, lab + ': no page errors');
    await ctx.close();
  }
  await b.close(); T.done('instructional disclosures');
})().catch(e => { console.error(e); process.exitCode = 1; });
