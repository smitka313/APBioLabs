/* "Clear this activity" (review L2) leaves the activity not started on the dashboard. Before the fix the reload after
   clearing saved a fresh record with lastSection "submit", so the dashboard offered "Resume activity" for blank work. */
const T = require('./_h');
const KEY = 'aplab:openscied:b3-cell-cycle:v1';
(async () => {
  const browser = await T.launch(), server = await T.serve();
  const ctx = await T.ctxFor(browser, {width:1366,height:900,reduced:true});
  const p = await T.open(ctx,'openscied-b3-cell-cycle.html','analyze',server.url);
  try {
    await p.locator('#analysis-design').fill('I kept cell type and body size constant.');
    await p.locator('.step-nav a[href="#submit"]').click();
    await p.waitForFunction(() => document.getElementById('submit').classList.contains('is-current'));
    T.ok(await p.evaluate(key => !!localStorage.getItem(key), KEY), 'setup: work is saved');
    // The page's own confirm dialog (t89-wrapup-clear): window.confirm could be suppressed, so the button did nothing.
    await p.locator('#reset-work').click();
    await Promise.all([p.waitForEvent('load'), p.locator('#confirm-game-reset').click()]);
    await p.waitForTimeout(600);
    T.ok(await p.evaluate(key => localStorage.getItem(key), KEY) === null, 'after clearing and reloading, nothing is saved for the activity');
    T.ok(await p.locator('#analysis-design').inputValue() === '', 'the cleared answer is not shown again');
    const d = await T.open(ctx,'openscied-dashboard.html','',server.url);
    T.ok((await d.locator('#cell-cycle-progress').textContent()) === 'Not started', 'dashboard shows the activity as not started');
    T.ok(await d.locator('#openscied-resume').isHidden(), 'dashboard does not offer to resume a blank activity');
    T.ok((await d.locator('#cell-cycle-open').textContent()).startsWith('Open activity'), 'dashboard link reads "Open activity"');
    // Returning to the page with saved work still records the current section for Resume.
    const q = await T.open(ctx,'openscied-b3-cell-cycle.html','background',server.url);
    await q.locator('input[name="quick-check"][value="b"]').check();
    await q.locator('.step-nav a[href="#growth-model"]').click();
    await q.waitForTimeout(300);
    T.ok(await q.evaluate(key => JSON.parse(localStorage.getItem(key)).lastSection, KEY) === 'growth-model', 'once work exists, the current section is still saved for Resume');
    T.ok(p.errors.length === 0 && q.errors.length === 0, 'no page errors: ' + p.errors.concat(q.errors).join('; '));
  } catch (e) { T.ok(false, 'unexpected error: ' + e.message.split('\n')[0]); }
  await browser.close(); server.close(); T.done('t81-clear-activity');
})();
