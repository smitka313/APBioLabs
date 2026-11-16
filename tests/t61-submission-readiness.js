/* PR22: Submission readiness is informative, navigable, and never blocks reports. */
const T = require('./_h');
(async () => {
  const b = await T.launch(), ctx = await T.ctxFor(b, { width: 390, height: 844, touch: true });
  try {
    for (const lab of T.LABS) {
      const p = await T.open(ctx, lab + '.html', 'submit');
      const ready = p.getByRole('region', { name: 'Submission readiness' });
      T.ok(await ready.count() === 1, lab + ': readiness region exists');
      const text = await ready.innerText();
      T.ok(/Before you submit: \d+ of \d+ sections with saved activities complete/.test(text), lab + ': readiness count visible');
      T.ok(/you can download your report even if some work is unfinished/i.test(text), lab + ': explicitly non-blocking');
      T.ok(await p.getByRole('button', { name: 'Download .docx' }).isEnabled(), lab + ': Word download enabled with incomplete work');
      T.ok(await p.getByRole('button', { name: 'Save as PDF' }).isEnabled(), lab + ': PDF enabled with incomplete work');
      const links = ready.locator('a[href^="#"]');
      T.ok(await links.count() > 0, lab + ': unfinished sections linked');
      if (await links.count()) {
        const target = await links.first().getAttribute('href');
        await links.first().click();
        await p.waitForFunction(id => Lab.pages.current() && Lab.pages.current().id === id, target.slice(1), { timeout: 5000 }).catch(() => {});
        const current = await p.evaluate(() => Lab.pages.current() && Lab.pages.current().id);
        T.ok(current === target.slice(1), lab + ': readiness link navigates to unfinished section (expected ' + target + ', got ' + current + ')');
        await p.evaluate(() => Lab.pages.go('submit'));
      }
      T.ok(p.errors.length === 0, lab + ': no page errors ' + p.errors.join('; '));
      await p.close();
    }
    const p = await T.open(ctx, 'lab02.html', 'submit');
    const ready = p.getByRole('region', { name: 'Submission readiness' });
    const before = await ready.innerText();
    await p.evaluate(() => Lab.pages.go('reflect'));
    await p.locator('#reflect textarea[data-save]').first().fill('Evidence supports the claim because the model data changed.');
    await p.waitForTimeout(500);
    await p.evaluate(() => Lab.pages.go('submit'));
    const after = await ready.innerText();
    T.ok(before !== after, 'lab02: readiness updates after student work');
    await p.reload();
    await p.waitForTimeout(800);
    const restored = await p.getByRole('region', { name: 'Submission readiness' }).innerText();
    T.ok(restored === after, 'lab02: readiness survives reload');
    T.ok(p.errors.length === 0, 'lab02: no errors after progress update/reload ' + p.errors.join('; '));
    await p.close();
  } finally { await b.close(); }
  T.done('t61-submission-readiness');
})();
