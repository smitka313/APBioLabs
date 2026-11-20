/* Play-test Nov 20, item 12: the Analyze comparison computed the difference from unrounded means, so it could differ
   by 0.1 from the two means it shows. Set A = 1, 1, 2 (mean 1.333, shown 1.3); Set B = 2, 3, 3 (mean 2.667, shown 2.7).
   Before: "1.3 divisions higher" (2.667 - 1.333). After: "1.4 divisions higher" (2.7 - 1.3), matching the display. */
const T = require('./_h');
const KEY = 'aplab:openscied:b3-cell-cycle:v1';
const t = (age, divisions) => ({modelVersion:2, age, size:'average', tissue:'skin', divisions, opportunities:divisions, cancerCount:0, firstCancerAge:null});
(async () => {
  const browser = await T.launch(), server = await T.serve();
  const ctx = await T.ctxFor(browser, {width:1919,height:1000,reduced:true});
  const p = await T.open(ctx,'openscied-b3-cell-cycle.html','overview',server.url);
  try {
    const trials = [t(30,1),t(30,1),t(30,2),t(60,2),t(60,3),t(60,3)];
    await p.evaluate(({key,trials}) => localStorage.setItem(key, JSON.stringify({v:1,trials,fields:{}})), {key:KEY,trials});
    await p.reload(); await p.locator('.step-nav a[href="#analyze"]').click(); await p.waitForTimeout(150);
    await p.locator('#compare-a').selectOption('0'); await p.locator('#compare-b').selectOption('1');
    const means = await p.locator('.comparison-means strong').allTextContents();
    const diff = await p.locator('.comparison-difference').textContent();
    T.ok(means.join() === '1.3,2.7', `displayed means 1.3 and 2.7 (got ${means.join(', ')})`);
    T.ok(/1\.4 divisions higher/.test(diff), `the difference matches the displayed means: 2.7 − 1.3 = 1.4 ("${diff}")`);
    await p.locator('#compare-a').selectOption('1'); await p.locator('#compare-b').selectOption('0');
    T.ok(/1\.4 divisions lower/.test(await p.locator('.comparison-difference').textContent()), 'reversed: "1.4 divisions lower"');
    T.ok(p.errors.length === 0, 'no page errors: ' + p.errors.join('; '));
  } catch (e) { T.ok(false, 'unexpected error: ' + e.message.split('\n')[0]); }
  await browser.close(); server.close(); T.done('t89-mean-difference');
})();
