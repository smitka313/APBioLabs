/* End-of-period nudge: 40+ minutes open, meaningful unsaved work, once per session, never during an animation (fake clock). */
const T = require('./_h');
const MIN = 60 * 1000;
(async () => {
  const b = await T.launch();
  async function lab05(ctx, o = {}) {
    const p = await ctx.newPage(); p.errors = [];
    p.on('pageerror', e => p.errors.push(e.message));
    await p.clock.install({ time: new Date('2026-11-13T09:00:00') });
    await p.goto('file://' + T.ROOT + '/lab05.html'); await p.waitForTimeout(700);
    if (o.work !== false) {
      await p.evaluate(() => Lab.pages.go('pre-lab')); await p.waitForTimeout(300);
      const ids = await p.evaluate(() => Array.from(document.querySelectorAll('textarea[data-save]')).filter(t => !t.closest('.id-box')).slice(0, 3).map(t => t.id));
      await p.evaluate(() => Lab.pages.go('evaluate')); await p.waitForTimeout(300);
      const tas = await p.$$('section.step.is-current textarea[data-save]');
      for (let i = 0; i < 3; i++) await tas[i].fill('Some real thinking ' + i);
    }
    return p;
  }
  const bar = p => p.evaluate(() => { const e = document.querySelector('.nudge-bar'); return e ? e.innerText.replace(/\s+/g, ' ') : null; });
  const tick = async (p, ms) => { await p.clock.fastForward(ms); await p.clock.runFor(4000); await p.waitForTimeout(250); };

  // 1. Work + 40 min -> banner with the words and both buttons; not before 40 min
  let ctx = await T.ctxFor(b);
  let p = await lab05(ctx);
  T.ok((await p.evaluate(() => Lab.backup.state())).unsaved, 'three answers count as meaningful unsaved work');
  await tick(p, 5 * MIN);
  // dismiss the ordinary "save a progress file" reminder first, if it came
  if (await p.locator('.backup-bar:not(.nudge-bar) .bb-close').count()) await p.click('.backup-bar:not(.nudge-bar) .bb-close');
  await tick(p, 33 * MIN);   // 38 min
  T.ok(await bar(p) === null, 'no nudge at 38 minutes');
  await tick(p, 3 * MIN);    // 41 min
  const txt = await bar(p);
  T.ok(txt && txt.includes('Period ending soon? Download your report or get a transfer code.'), 'nudge at 41 minutes: ' + txt);
  T.ok(await p.locator('.nudge-bar button', { hasText: 'Download .docx' }).count() === 1 && await p.locator('.nudge-bar button', { hasText: 'Transfer code' }).count() === 1, 'has Download .docx and Transfer code buttons');
  T.ok(await p.locator('.nudge-bar .bb-close').getAttribute('aria-label') === 'Dismiss this reminder', 'dismissible');
  // the buttons work
  const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 15000 }), p.locator('.nudge-bar .nudge-docx').click()]);
  T.ok(/\.docx$/.test(dl.suggestedFilename()), 'Download .docx downloads ' + dl.suggestedFilename());
  T.ok(await bar(p) === null, 'banner closes after the download');
  // dismissed or used: never again this session, even later and after a reload
  await tick(p, 20 * MIN);
  T.ok(await bar(p) === null, 'not shown again later in the session');
  await p.reload(); await p.waitForTimeout(500);
  await tick(p, 45 * MIN);
  T.ok(await bar(p) === null, 'not shown again after a reload in the same session');
  await ctx.close();

  // 2. Transfer code button opens the code
  ctx = await T.ctxFor(b); p = await lab05(ctx);
  await tick(p, 5 * MIN); if (await p.locator('.backup-bar:not(.nudge-bar) .bb-close').count()) await p.click('.backup-bar:not(.nudge-bar) .bb-close');
  await tick(p, 36 * MIN);
  T.ok(await bar(p) !== null, 'nudge shown');
  await p.locator('.nudge-bar .nudge-code').click(); await p.waitForTimeout(1500);
  T.ok(await p.locator('.pause-screen .transfer-code').count() === 1 && /^LB1/.test(await p.locator('.pause-screen .transfer-code').innerText()), 'Transfer code button shows a transfer code');
  await ctx.close();

  // 3. Dismiss with the x: once only
  ctx = await T.ctxFor(b); p = await lab05(ctx);
  await tick(p, 5 * MIN); if (await p.locator('.backup-bar:not(.nudge-bar) .bb-close').count()) await p.click('.backup-bar:not(.nudge-bar) .bb-close');
  await tick(p, 36 * MIN);
  await p.click('.nudge-bar .bb-close'); await p.waitForTimeout(200);
  await tick(p, 30 * MIN);
  T.ok(await bar(p) === null, 'after dismissing, it does not come back');
  await ctx.close();

  // 4. Never during an animation; appears once it ends
  ctx = await T.ctxFor(b); p = await lab05(ctx);
  await tick(p, 5 * MIN); if (await p.locator('.backup-bar:not(.nudge-bar) .bb-close').count()) await p.click('.backup-bar:not(.nudge-bar) .bb-close');
  await p.evaluate(() => { window.__loop = Lab.loop(() => {}); window.__loop.start(); });
  await tick(p, 40 * MIN);
  T.ok(await bar(p) === null, 'not shown while an animation loop is running');
  await tick(p, 10 * MIN);
  T.ok(await bar(p) === null, 'still not shown 10 minutes later while it runs');
  await p.evaluate(() => window.__loop.stop());
  await tick(p, 1 * MIN);
  T.ok(await bar(p) !== null, 'shown once the animation has ended');
  await ctx.close();

  // 5. Already backed up, or no work: nothing
  ctx = await T.ctxFor(b); p = await lab05(ctx);
  await tick(p, 5 * MIN); if (await p.locator('.backup-bar:not(.nudge-bar) .bb-close').count()) await p.click('.backup-bar:not(.nudge-bar) .bb-close');
  await p.evaluate(() => Lab.backup.markSaved('file'));
  await tick(p, 45 * MIN);
  T.ok(await bar(p) === null, 'work already backed up: no nudge');
  await ctx.close();
  ctx = await T.ctxFor(b); p = await lab05(ctx, { work: false });
  await tick(p, 50 * MIN);
  T.ok(await bar(p) === null, 'no meaningful work: no nudge');
  T.ok(p.errors.length === 0, 'no errors ' + p.errors.join(';'));
  await b.close(); T.done('t35-nudge');
})();
