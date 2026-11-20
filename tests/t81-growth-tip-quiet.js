/* Growth model inspection tip (review L5): #growth-tip is a status region, so it must change only when a cell is
   inspected or playback pauses, not on every animation frame. Before the fix draw() rewrote it each frame. */
const T = require('./_h');
(async () => {
  const browser = await T.launch(), server = await T.serve();
  const ctx = await T.ctxFor(browser, {width:1366,height:900});
  const p = await T.open(ctx,'openscied-b3-cell-cycle.html','growth-model',server.url);
  try {
    await p.locator('#tissue-rate').selectOption('colon');
    await p.locator('#growth-scene').scrollIntoViewIfNeeded();
    await p.locator('#growth-scene').focus();
    await p.keyboard.press('ArrowRight');
    T.ok(await p.locator('#growth-tip').isVisible(), 'setup: inspecting a unit shows the tip');
    await p.evaluate(() => { window.__tipChanges = 0; new MutationObserver(m => { window.__tipChanges += m.length; }).observe(document.getElementById('growth-tip'), {childList:true, characterData:true, subtree:true}); });
    await p.locator('#run-trials').click();
    await p.waitForTimeout(1500);
    const during = await p.evaluate(() => window.__tipChanges);
    T.ok(during <= 2, `playback does not rewrite the status tip every frame (${during} changes in 1.5 s)`);
    await p.locator('#pause-growth').click();
    await p.waitForTimeout(150);
    const atPause = await p.evaluate(() => window.__tipChanges);
    T.ok(atPause > during, 'pausing updates the tip to the paused age');
    const tipAge = (await p.locator('#growth-tip').textContent()).match(/by age (\d+)/);
    const shown = await p.locator('#growth-age').textContent();
    T.ok(tipAge && tipAge[1] === shown.trim(), `the paused tip matches the displayed age (${tipAge && tipAge[1]} vs ${shown})`);
    await p.locator('#growth-scene').focus();
    await p.keyboard.press('ArrowRight');
    T.ok(/unit 3/.test(await p.locator('#growth-tip').textContent()), 'inspecting another unit updates the tip');
    T.ok(p.errors.length === 0, 'no page errors: ' + p.errors.join('; '));
  } catch (e) { T.ok(false, 'unexpected error: ' + e.message.split('\n')[0]); }
  await browser.close(); server.close(); T.done('t81-growth-tip-quiet');
})();
