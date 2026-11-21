/* Meiosis and skin-data scenes (openscied-b3-inheritance-environment.html): axe-core (WCAG 2.x A/AA, critical and serious) on the two
   sections with the scenes in several states, light and dark, 1366 and 390 px, plus checks that the drawings have a role and label.
   Run: NODE_PATH=$(npm root -g) AXE=<path>/axe.min.js node tests/t97-meiosis-skin-a11y.js */
const T = require('./_h');
const fs = require('fs'), path = require('path');
function axePath() {
  const c = [process.env.AXE, (() => { try { return require.resolve('axe-core/axe.min.js'); } catch (e) { return null; } })(), path.join(__dirname, '../node_modules/axe-core/axe.min.js')].filter(Boolean);
  return c.find(f => fs.existsSync(f));
}
(async () => {
  const file = axePath();
  if (!file) { T.ok(false, 'axe-core not found: set AXE=<path>/node_modules/axe-core/axe.min.js'); T.done('t97-meiosis-skin-a11y'); return; }
  const src = fs.readFileSync(file, 'utf8');
  const browser = await T.launch(), server = await T.serve();
  try {
    for (const [w, h] of [[1366, 900], [390, 844]]) for (const dark of [false, true]) {
      const ctx = await T.ctxFor(browser, { width: w, height: h, dark, reduced: true });
      await ctx.route(/gc\.zgo\.at|fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, contentType: /gc\.zgo\.at/.test(r.request().url()) ? 'application/javascript' : 'text/css', body: '' }));
      const p = await ctx.newPage();
      await p.goto(server.url + 'openscied-b3-inheritance-environment.html#passing');
      await p.waitForSelector('#meiosis-scene[data-ms]');
      await p.addScriptTag({ content: src });
      const run = () => p.evaluate(async () => (await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] }, resultTypes: ['violations'] }))
        .violations.filter(v => v.impact === 'critical' || v.impact === 'serious').map(v => v.id + ': ' + v.nodes.slice(0, 2).map(n => n.target.join(' ')).join(' ; ')));
      const found = [];
      (await run()).forEach(r => found.push('meiosis start ' + r));
      await p.click('#meiosis-scene [data-step="5"]'); await p.click('#meiosis-scene .ms-switch'); await p.click('#meiosis-scene >> text=Make 10 gametes');
      await p.click('#meiosis-scene [data-pick="AC"]'); await p.click('#meiosis-scene >> text=Check');
      (await run()).forEach(r => found.push('meiosis used ' + r));
      T.ok(await p.locator('#meiosis-scene svg[role="img"][aria-label]').count() === 1, 'meiosis drawing has role and label');
      await p.evaluate(() => { location.hash = 'skindata'; });
      await p.waitForSelector('#skin-data-scene[data-sk]');
      (await run()).forEach(r => found.push('skin start ' + r));
      await p.click('#skin-data-scene .sk-fig:not([hidden]) .sk-pt[data-site="Hawaii"]'); await p.click('#skin-data-scene [data-toggle="table"]');
      await p.click('#skin-data-scene [data-toggle="trend"]'); await p.click('#skin-data-scene [data-scale="same"]'); await p.selectOption('#skin-data-scene [data-poll-select="top-both"]', 'Hawaii');
      (await run()).forEach(r => found.push('skin used ' + r));
      T.ok(await p.locator('#skin-data-scene .sk-fig svg[role="group"][aria-label]').count() === 3, 'skin graphs have a role and label');
      T.ok(found.length === 0, `axe clean at ${w}px ${dark ? 'dark' : 'light'} ${found.join(' | ')}`);
      await ctx.close();
    }
  } finally { await browser.close(); server.close(); }
  T.done('t97-meiosis-skin-a11y');
})();
