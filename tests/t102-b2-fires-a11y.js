/* Fires (B.2 Lessons 3 and 5) companion: axe-core (WCAG 2.x A/AA, critical and serious) on every section in light and dark,
   at 1366 and 390 px, with reduced motion. Needs axe-core (npm ci, or AXE=<path>/axe.min.js).
   Run: NODE_PATH=$(npm root -g) AXE=... node tests/t102-b2-fires-a11y.js */
const T = require('./_h');
const fs = require('fs'), path = require('path');
const SECTIONS = ['overview', 'ideas', 'plan', 'yeast', 'cards', 'sense3', 'hypothesis', 'tilt', 'sense5', 'peat', 'wrapup'];
function axePath() {
  const c = [process.env.AXE, (() => { try { return require.resolve('axe-core/axe.min.js'); } catch (e) { return null; } })(), path.join(__dirname, '../node_modules/axe-core/axe.min.js')].filter(Boolean);
  return c.find(f => fs.existsSync(f));
}
(async () => {
  const file = axePath();
  if (!file) { T.ok(false, 'axe-core not found: set AXE=<path>/node_modules/axe-core/axe.min.js'); T.done('t102-b2-fires-a11y'); return; }
  const src = fs.readFileSync(file, 'utf8');
  const browser = await T.launch();
  const server = await T.serve();
  try {
    for (const [w, h] of [[1366, 900], [390, 844]]) for (const dark of [false, true]) {
      const ctx = await T.ctxFor(browser, { width: w, height: h, dark, reduced: true });
      await ctx.route(/gc\.zgo\.at|fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, contentType: /gc\.zgo\.at/.test(r.request().url()) ? 'application/javascript' : 'text/css', body: '' }));
      const p = await ctx.newPage();
      await p.goto(server.url + 'openscied-b2-fires.html');
      await p.waitForFunction(() => window.B2Fires && document.querySelector('.step.is-current'));
      await p.addScriptTag({ content: src });
      // Run both timed scenes to their end so every table, chart and drawing is scanned too.
      const nav = id => p.evaluate(x => { location.hash = x; }, id).then(() => p.waitForFunction(x => document.querySelector('#' + x + '.is-current'), id));
      await nav('yeast'); await p.locator('[data-dc="start"]').click(); await p.locator('[data-dc="skip"]').click(); await p.locator('[data-dc="record-all"]').click();
      await nav('tilt'); await p.locator('[data-tl="plan"]').click(); await p.locator('[data-tl="start"]').click(); await p.locator('[data-tl="skip"]').click(); await p.locator('[data-tl="unwrap"]').click(); await p.locator('[data-tl="starch"]').click();
      await nav('cards'); for (const [c, z] of [['sugar', 'in'], ['oxygen', 'in'], ['carbon-dioxide', 'out'], ['water', 'in']]) await p.locator('.mc-card[data-card="' + c + '"] [data-zone="' + z + '"]').click();
      await p.evaluate(() => { document.querySelectorAll('input[name="cer-claim"][value="a"], #cer-ev-1, input[name="poll-peat"][value="a"]').forEach(r => { r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); }); document.querySelectorAll('select').forEach(s => { if (!s.closest('.scene-host') && s.options.length > 1) { s.selectedIndex = 1; s.dispatchEvent(new Event('change', { bubbles: true })); } }); });
      await p.evaluate(() => { location.hash = 'overview'; }); await p.waitForTimeout(300);
      const found = [];
      for (const id of SECTIONS) {
        await p.evaluate(x => { location.hash = x; }, id);
        await p.waitForFunction(x => document.querySelector('#' + x + '.is-current'), id);
        const res = await p.evaluate(async () => (await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] }, resultTypes: ['violations'] }))
          .violations.filter(v => v.impact === 'critical' || v.impact === 'serious').map(v => v.id + ': ' + v.nodes.slice(0, 2).map(n => n.target.join(' ')).join(' ; ')));
        res.forEach(r => found.push(id + ' ' + r));
      }
      T.ok(found.length === 0, `axe clean at ${w}px ${dark ? 'dark' : 'light'} ${found.join(' | ')}`);
      await ctx.close();
    }
  } finally { await browser.close(); server.close(); }
  T.done('t102-b2-fires-a11y');
})().catch(e => { console.error(e); process.exit(1); });
