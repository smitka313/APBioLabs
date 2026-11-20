/* Quick-check and mechanism feedback (review L8) clears when the student picks a different answer. Before the fix the
   old "Yes…" feedback stayed on screen, and in storage, next to a different (wrong) choice. */
const T = require('./_h');
const KEY = 'aplab:openscied:b3-cell-cycle:v1';
(async () => {
  const browser = await T.launch(), server = await T.serve();
  const ctx = await T.ctxFor(browser, {width:1440,height:900,reduced:true});
  const p = await T.open(ctx,'openscied-b3-cell-cycle.html','background',server.url);
  const stored = () => p.evaluate(key => { const s = JSON.parse(localStorage.getItem(key) || '{}'); return {quick: s.quick || '', mechanism: s.mechanism || ''}; }, KEY);
  try {
    await p.locator('input[name="quick-check"][value="b"]').check();
    await p.locator('#check-background').click();
    T.ok(/^Yes/.test(await p.locator('#background-feedback').textContent()), 'setup: correct quick-check feedback shows');
    await p.locator('input[name="quick-check"][value="a"]').check();
    T.ok((await p.locator('#background-feedback').textContent()) === '', 'changing the quick-check answer clears the feedback');
    T.ok((await stored()).quick === '', 'the cleared quick-check feedback is not kept in storage');
    await p.reload();
    T.ok((await p.locator('#background-feedback').textContent()) === '', 'after reload, no stale quick-check feedback');
    await p.locator('.step-nav a[href="#cell-game"]').click();
    await p.waitForFunction(() => document.getElementById('cell-game').classList.contains('is-current'));
    await p.locator('#start-round1').click();
    await p.locator('input[name="mechanism-check"][value="a"]').check();
    await p.locator('#check-mechanism').click();
    T.ok(/^Yes/.test(await p.locator('#mechanism-feedback').textContent()), 'setup: correct mechanism feedback shows');
    await p.locator('input[name="mechanism-check"][value="b"]').check();
    T.ok((await p.locator('#mechanism-feedback').textContent()) === '', 'changing the mechanism answer clears the feedback');
    T.ok((await stored()).mechanism === '', 'the cleared mechanism feedback is not kept in storage');
    T.ok(p.errors.length === 0, 'no page errors: ' + p.errors.join('; '));
  } catch (e) { T.ok(false, 'unexpected error: ' + e.message.split('\n')[0]); }
  await browser.close(); server.close(); T.done('t81-feedback-clears');
})();
