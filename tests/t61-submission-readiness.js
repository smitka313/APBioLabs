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
      T.ok(/Your progress: \d+ of \d+ sections with all tracked activities complete/.test(text), lab + ': readiness count visible');
      T.ok(/you can download a report before finishing every activity/i.test(text), lab + ': explicitly non-blocking');
      T.ok(/To hand in, upload or share the saved report where your teacher directs\. Downloading does not submit it\./.test(await p.locator('.report-bar').innerText()), lab + ': report download names the separate hand-in action');
      const transferHelp = await p.locator('details.move-work .inner').textContent();
      T.ok(/answers and Dataset ID/.test(transferHelp) && /cannot restore editable lab progress/.test(transferHelp), lab + ': transfer instructions distinguish progress backups from reports');

      const toolbar = p.locator('#submit .report-bar');
      const word = toolbar.locator('#lab-report-download-word').and(toolbar.getByRole('button', { name: 'Download Word (.docx)', exact: true }));
      const pdf = toolbar.locator('#lab-report-print-pdf').and(toolbar.getByRole('button', { name: 'Print or save as PDF', exact: true }));
      T.ok(await word.isVisible() && await word.isEnabled(), lab + ': labeled Word download visible and enabled with incomplete work');
      T.ok(await pdf.isVisible() && await pdf.isEnabled(), lab + ': labeled PDF action visible and enabled with incomplete work');
      T.ok(/saved in this browser; it has not been sent to your teacher/i.test(text), lab + ': saved work is not represented as submitted');
      T.ok(/activities remaining/i.test(text), lab + ': unfinished activity counts visible');
      const resume = ready.getByRole('button', { name: 'Continue unfinished work' });
      T.ok(await resume.count() === 1, lab + ': resume button appears when work remains');
      if (await resume.count()) {
        const expected = await p.evaluate(() => {
          const link = document.querySelector('[aria-label="Submission readiness"] a[href^="#"]');
          return link?.getAttribute('href')?.slice(1);
        });
        await resume.click();
        const actual = await p.evaluate(() => Lab.pages.current()?.id);
        T.ok(actual === expected, lab + ': resume opens first unfinished section (' + actual + ')');
        await p.evaluate(() => Lab.pages.go('submit'));
      }
      // Progress can be repainted after restoring the current section.
      // Wait for the accessibility descriptions to match the visible status.
      await p.waitForFunction(() => {
        const links = [...document.querySelectorAll('.step-nav ol a.has-work')];
        return links.length > 0 && links.every(a =>
          /(?:\d+ activit(?:y|ies) remaining|All tracked activities complete)/.test(a.getAttribute('aria-description') || ''));
      }, null, { timeout: 3000 }).catch(() => {});
      const navDescriptions = await p.locator('.step-nav ol a.has-work').evaluateAll(links =>
        links.map(a => ({ section: a.getAttribute('href'), description: a.getAttribute('aria-description') })));
      T.ok(navDescriptions.length > 0 && navDescriptions.every(x => /(?:\d+ activit(?:y|ies) remaining|All tracked activities complete)/.test(x.description || '')),
        lab + ': navigation exposes remaining counts to assistive technology ' + JSON.stringify(navDescriptions));
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
    const field = await p.locator('#reflect textarea[data-save]').first().getAttribute('data-save');
    const answer = 'Evidence supports the claim because the model data changed.';
    await p.waitForFunction(({ field, answer }) => Lab.store.get('field:' + field) === answer,
      { field, answer }, { timeout: 5000 });
    T.ok(await p.evaluate(({ field, answer }) => Lab.store.get('field:' + field) === answer,
      { field, answer }), 'lab02: response saved before reload');
    await p.evaluate(() => Lab.pages.go('submit'));
    const after = await ready.innerText();
    T.ok(before !== after, 'lab02: readiness updates after student work');
    await p.reload();
    await p.waitForTimeout(800);
    const restored = await p.getByRole('region', { name: 'Submission readiness' }).innerText();
    const restoredAnswer = await p.evaluate(field => {
      const el = [...document.querySelectorAll('#reflect textarea[data-save]')].find(t => t.dataset.save === field);
      return el && el.value;
    }, field);
    T.ok(restoredAnswer === answer, 'lab02: saved response restored (' + JSON.stringify(restoredAnswer) + ')');
    T.ok(restored === after, 'lab02: readiness survives reload' +
      (restored !== after ? '\\nExpected: ' + after + '\\nRestored: ' + restored : ''));
    T.ok(p.errors.length === 0, 'lab02: no errors after progress update/reload ' + p.errors.join('; '));
    await p.close();
  } finally { await b.close(); }
  T.done('t61-submission-readiness');
})();
