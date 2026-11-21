/* DNA Copying, p53 and Gene Expression companion: axe-core (WCAG 2.x A/AA, critical and serious) on every section in light and dark,
   at 1366 and 390 px, with reduced motion. Needs axe-core (npm ci, or AXE=<path>/axe.min.js).
   Run: NODE_PATH=$(npm root -g) AXE=... node tests/t93-dna-p53-a11y.js */
const T = require('./_h');
const fs = require('fs'), path = require('path');
const SECTIONS = ['overview', 'ideas', 'fork', 'sense5', 'checklist', 'explain', 'expression', 'sense6', 'wrapup'];
function axePath() {
  const c = [process.env.AXE, (() => { try { return require.resolve('axe-core/axe.min.js'); } catch (e) { return null; } })(), path.join(__dirname, '../node_modules/axe-core/axe.min.js')].filter(Boolean);
  return c.find(f => fs.existsSync(f));
}
(async () => {
  const file = axePath();
  if (!file) { T.ok(false, 'axe-core not found: set AXE=<path>/node_modules/axe-core/axe.min.js'); T.done('t93-dna-p53-a11y'); return; }
  const src = fs.readFileSync(file, 'utf8');
  const browser = await T.launch();
  const server = await T.serve();
  try {
    for (const [w, h] of [[1366, 900], [390, 844]]) for (const dark of [false, true]) {
      const ctx = await T.ctxFor(browser, { width: w, height: h, dark, reduced: true });
      await ctx.route(/gc\.zgo\.at|fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, contentType: /gc\.zgo\.at/.test(r.request().url()) ? 'application/javascript' : 'text/css', body: '' }));
      const p = await ctx.newPage();
      await p.goto(server.url + 'openscied-b3-dna-p53.html');
      await p.waitForFunction(() => window.B3DnaP53 && document.querySelector('.step.is-current'));
      await p.addScriptTag({ content: src });
      // Put data in the boxes so the tables are scanned too.
      await p.evaluate(() => { B3DnaP53.saveFork({ before: { top: { correct: 11, substitutions: 1 }, bottom: { correct: 10, substitutions: 2 } }, p53: { a: { tried: 1, removed: 3 } }, after: { top: { correct: 12, substitutions: 0 }, bottom: { correct: 12, substitutions: 0 } } });
        B3DnaP53.addExpressionRun({ strand: 'B', sentence: 'I am a p53 protein missing a piece.', matchesKey: true, aminoAcids: ['Phe'] }); });
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
  T.done('t93-dna-p53-a11y');
})().catch(e => { console.error(e); process.exit(1); });
