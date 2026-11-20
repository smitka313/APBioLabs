/* Play-test Nov 20, items 6 and 14.
   6: the growth model could only replay a whole set, and the rare magenta (cancer-state) cell was hard to find. A Trial
   picker now replays one trial on its own, and "Jump to a trial with a cancer-state cell" (shown only when one exists)
   loads that trial at the age the first cancer-state cell appeared, with that cell selected in the inspector.
   14: the inspector tip could cover the model's header strip and, enlarged, the close button. It now sits inside the
   drawing below the header, in both views. */
const T = require('./_h');
const KEY = 'aplab:openscied:b3-cell-cycle:v1';
const N = 20;
const row = (year, cumulative, cells, masks, cancer, fresh) => ({year, cumulative, cells, changes:masks, cancerCells:cancer, newCancerCells:fresh, cancerCount:cancer.length});
// A 25-year small-body trial. With `cancerAt`, unit 5 (index 4) gains all three control changes at that age.
function trial(divs, cancerAt) {
  const tl = [], masks = Array(N).fill(0); let cum = 0, cancer = [];
  for (let y = 20; y <= 25; y++) {
    const fresh = [];
    if (cancerAt && y === cancerAt) { masks[4] = 7; cancer = [4]; fresh.push(4); }
    const cells = y === 20 ? [] : [4, 7]; cum += cells.length;
    tl.push(row(y, cum, cells, masks.slice(), cancer.slice(), fresh));
  }
  return {modelVersion:2, age:25, size:'small', tissue:'colon', divisions:cum, opportunities:cum, cancerCount:cancer.length, firstCancerAge:cancerAt||null, timeline:tl};
}
(async () => {
  const browser = await T.launch(), server = await T.serve();
  const ctx = await T.ctxFor(browser, {width:1919,height:1000,reduced:true});
  const p = await T.open(ctx,'openscied-b3-cell-cycle.html','overview',server.url);
  const seed = async trials => { await p.evaluate(({key,trials}) => localStorage.setItem(key, JSON.stringify({v:1,trials,fields:{}})), {key:KEY,trials}); await p.reload(); await p.locator('.step-nav a[href="#growth-model"]').click(); await p.waitForTimeout(200); };
  const clear = (a, b) => a.y >= b.y + b.height - 1 || b.y >= a.y + a.height - 1 || a.x >= b.x + b.width - 1 || b.x >= a.x + a.width - 1;
  try {
    // No cancer-state cell anywhere: no jump button.
    await seed([trial(),trial(),trial()]);
    T.ok(await p.locator('#jump-cancer').isHidden(), 'no cancer-state cell recorded: the jump button is hidden');
    // Set 1 without, Set 2 with a cancer-state cell in trial 2 at age 23.
    await seed([trial(),trial(),trial(),trial(),trial(0,23),trial()]);
    const opts = await p.locator('#replay-trial option').allTextContents();
    T.ok(opts.length === 4 && opts[0] === 'All three trials' && /^Trial 2 · 10 divisions · 1 cancer-state cell$/.test(opts[2]), 'the Trial picker lists all trials or one trial, with counts (' + opts.join(' | ') + ')');
    await p.locator('#replay-set').selectOption('0');
    T.ok(!/cancer-state/.test((await p.locator('#replay-trial option').allTextContents()).join()), 'changing the set refreshes the Trial picker');
    await p.locator('#replay-trial').selectOption('2'); await p.locator('#replay-growth').click(); await p.waitForTimeout(150);
    T.ok(/Playback of trial 3 complete/.test(await p.locator('#growth-status').textContent()), 'replaying one trial plays only that trial ("' + await p.locator('#growth-status').textContent() + '")');
    await p.locator('#growth-scrub').evaluate(el => { el.value = 22; el.dispatchEvent(new Event('input', {bubbles:true})); });
    T.ok(/^Trial 3 at age 22/.test(await p.locator('#growth-status').textContent()), 'scrubbing inspects that same trial');
    // Jump to the cancer-state cell.
    const btn = p.locator('#jump-cancer');
    T.ok(await btn.isVisible() && /Set 2, trial 2, age 23/.test(await btn.textContent()), 'the jump button appears and says where: ' + await btn.textContent());
    await btn.click(); await p.waitForTimeout(150);
    T.ok(await p.locator('#replay-set').inputValue() === '1' && await p.locator('#replay-trial').inputValue() === '1', 'the jump selects Set 2, trial 2 in the pickers');
    T.ok((await p.locator('#growth-age').textContent()) === '23', 'the model is at age 23, when the first cancer-state cell appeared');
    const tip = await p.locator('#growth-tip').textContent();
    T.ok(await p.locator('#growth-tip').isVisible() && /unit 5/.test(tip) && /Cancerous state in this teaching model/.test(tip), 'the cancer-state cell (unit 5) is selected in the inspector: ' + tip.slice(0, 80));
    T.ok(/first cancer-state cell \(unit 5\)/.test(await p.locator('#growth-status').textContent()), 'the status line explains what was selected');
    T.ok(await p.evaluate(() => document.activeElement && document.activeElement.id) === 'growth-scene', 'focus moves to the model so the arrow keys keep inspecting');
    // Item 14: the tip stays below the canvas header strip and clear of the Enlarge / Close button.
    for (const [label, enlarge] of [['inline', false], ['enlarged', true]]) {
      if (enlarge) { await p.locator('#enlarge-growth').click(); await p.waitForTimeout(200); await p.locator('#jump-cancer').evaluate(b => b.click()); await p.waitForTimeout(150); }
      const t = await p.locator('#growth-tip').boundingBox(), c = await p.locator('#growth-scene').boundingBox(), b = await p.locator('#enlarge-growth').boundingBox();
      T.ok(t.y >= c.y + c.height * 47 / 650 - 1, `${label}: the tip starts below the model's header strip (tip top ${Math.round(t.y)}, header ends ${Math.round(c.y + c.height * 47 / 650)})`);
      T.ok(clear(t, b), `${label}: the tip does not cover the ${enlarge ? 'close' : 'enlarge'} button`);
      T.ok(t.x >= c.x - 1 && t.x + t.width <= c.x + c.width + 1, `${label}: the tip stays inside the drawing`);
    }
    await p.keyboard.press('Escape');
    // Narrow screens.
    await p.setViewportSize({width:390, height:844}); await p.waitForTimeout(200);
    await p.locator('#jump-cancer').click(); await p.waitForTimeout(150);
    const t = await p.locator('#growth-tip').boundingBox(), c = await p.locator('#growth-scene').boundingBox(), b = await p.locator('#enlarge-growth').boundingBox();
    T.ok(t.y >= c.y + c.height * 47 / 650 - 1 && clear(t, b) && t.x >= 0 && t.x + t.width <= 390, '390px: the tip is below the header, clear of the button and on screen');
    T.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), '390px: the new controls cause no horizontal scroll');
    T.ok(p.errors.length === 0, 'no page errors: ' + p.errors.join('; '));
  } catch (e) { T.ok(false, 'unexpected error: ' + e.message.split('\n')[0]); }
  await browser.close(); server.close(); T.done('t89-growth-trial-picker');
})();
