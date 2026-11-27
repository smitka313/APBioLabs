/* Layout and accessibility of the pedigree and two-gene scenes in openscied-b3-inheritance-environment.html: fit from 375 to 1920 px,
   no sideways scroll, readable text (11 CSS px or more), 24 px targets, light and dark, reduced motion, and axe-core (WCAG 2 A/AA,
   critical and serious) on both scenes in several states. Needs axe-core (npm ci, or AXE=<path>/axe.min.js).
   Run: NODE_PATH=$(npm root -g) AXE=... node tests/t97-pedigree-layout.js */
const T = require('./_h');
const fs = require('fs'), path = require('path');
const PAGE = 'openscied-b3-inheritance-environment.html';
const P = '#pedigree-scene', G = '#two-gene-scene';
function axePath() {
  const c = [process.env.AXE, (() => { try { return require.resolve('axe-core/axe.min.js'); } catch (e) { return null; } })(), path.join(__dirname, '../node_modules/axe-core/axe.min.js')].filter(Boolean);
  return c.find(f => fs.existsSync(f));
}
const go = async (p, id) => { await p.evaluate(h => { location.hash = h; }, id); await p.waitForFunction(h => document.querySelector('#' + h + '.is-current'), id); };
const stub = pg => pg.route(/gc\.zgo\.at|fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, contentType: /gc\.zgo\.at/.test(r.request().url()) ? 'application/javascript' : 'text/css', body: '' }));
async function fit(p, sel, label, w) {
  const r = await p.evaluate(s => {
    const host = document.querySelector(s), hb = host.getBoundingClientRect(), svg = host.querySelector('svg.ped-svg, svg.tg-svg'), sb = svg.getBoundingClientRect();
    const k = sb.width / svg.viewBox.baseVal.width, texts = Array.from(svg.querySelectorAll('text')).filter(t => t.textContent.trim() && !t.closest('[aria-hidden]') || t.textContent.trim());
    const small = texts.map(t => parseFloat(getComputedStyle(t).fontSize) * k).filter(x => x < 10.6).length;
    const targets = Array.from(host.querySelectorAll('.ped-person .ped-sym, .tg-person .tg-sym')).map(e => Math.min(e.getBoundingClientRect().width, e.getBoundingClientRect().height));
    const btns = Array.from(host.querySelectorAll('button')).map(b => { const x = b.getBoundingClientRect(); return Math.min(x.width, x.height); });
    const pageWidth = document.documentElement.clientWidth;
    const offenders = [host, svg, ...document.querySelectorAll('.bench-activity-inner, .bench-activity-inner > *')]
      .map(el => ({name:el.id||el.getAttribute('class')||el.tagName,right:Math.round(el.getBoundingClientRect().right*10)/10,
        scroll:el.scrollWidth,client:el.clientWidth}))
      .filter(o => o.right > pageWidth + 1 || o.scroll > o.client + 1);
    return { offenders, over: document.documentElement.scrollWidth - pageWidth, inside: sb.left >= hb.left - 1 && sb.right <= hb.right + 1, hostOver: host.scrollWidth - host.clientWidth, small, minTarget: Math.min.apply(null, targets), minBtn: Math.min.apply(null, btns), minFont: Math.min.apply(null, texts.map(t => parseFloat(getComputedStyle(t).fontSize) * k)) };
  }, sel);
  T.ok(r.over <= 0 && r.hostOver <= 0 && r.inside, label + ' ' + w + ' px: fits, no sideways scroll' + (r.over > 0 || r.hostOver > 0 || !r.inside ? ' ' + JSON.stringify(r) : ''));
  T.ok(r.minFont >= 10.6, label + ' ' + w + ' px: smallest drawing text ' + r.minFont.toFixed(1) + ' px (about 11 CSS px or more)');
  T.ok(r.minTarget >= 24 && r.minBtn >= 24, label + ' ' + w + ' px: targets at least 24 px (symbol ' + r.minTarget.toFixed(0) + ', button ' + r.minBtn.toFixed(0) + ')');
}
(async () => {
  const file = axePath();
  const src = file ? fs.readFileSync(file, 'utf8') : '';
  const browser = await T.launch();
  const server = await T.serve();
  try {
    for (const [w, h] of [[375, 740], [390, 844], [768, 1024], [1366, 900], [1920, 1080]]) for (const dark of w === 1366 || w === 390 ? [false, true] : [false]) {
      const ctx = await T.ctxFor(browser, { width: w, height: h, dark, reduced: true });
      const p = await ctx.newPage(); await stub(p);
      const problems = []; p.on('pageerror', e => problems.push(e.message));
      await p.goto(server.url + PAGE);
      await p.waitForFunction(() => window.B3Inh && document.querySelector('.step.is-current'));
      const tag = w + (dark ? ' dark' : '');
      // pedigree: empty, then a busy state with every kind of mark and the chromosome view
      await go(p, 'lakita');
      await fit(p, P, 'pedigree empty', tag);
      await p.evaluate(() => B3Inh.saveState('pedigree', { view: 'chromosome', guesses: { lakita: ['AB'], aunt1: ['AA', 'AB'], aunt3: ['BB'], father: ['AA'], grandmother: ['AB', 'BB'], mother: ['AA'], uncle: ['AA', 'AB', 'BB'], grandfather: ['AA'], aunt2: ['AB'] } }));
      await p.reload(); await p.waitForFunction(() => window.B3Inh && document.querySelector('.step.is-current')); await go(p, 'lakita');
      await fit(p, P, 'pedigree busy (chromosome view)', tag);
      T.ok(await p.locator(P + ' .ped-chr').count() === 18, tag + ': chromosome view restored from saved state');
      await p.click(P + ' [data-person="lakita"]');
      await p.getByRole('button', { name: 'Show how Lakita got her alleles' }).click();
      await fit(p, P, 'pedigree step-through', tag);
      // two-gene: empty, then every activity
      await go(p, 'twogene');
      await fit(p, G, 'two-gene empty', tag);
      await p.click(G + ' [data-person="child2"]'); await p.click(G + ' .tg-chip[data-gene="p53"][data-genotype="AB"]');
      await p.getByRole('button', { name: '3 New mixes' }).click(); await p.click(G + ' [data-person="child3"]');
      await p.getByRole('button', { name: '4 Trace the chromosomes' }).click(); await p.click(G + ' [data-person="child2"]'); await p.getByRole('button', { name: 'Next' }).click();
      await fit(p, G, 'two-gene trace', tag);
      T.ok(await p.evaluate(s => { const h = document.querySelector(s), sv = h.querySelector('svg.tg-trace').getBoundingClientRect(), hb = h.getBoundingClientRect(); return sv.left >= hb.left - 1 && sv.right <= hb.right + 1; }, G), tag + ': trace picture fits');
      // axe on both scenes, in the states above (1366 and 390 only, as in the page test)
      if (src && (w === 1366 || w === 390)) {
        await p.addScriptTag({ content: src });
        const found = [];
        for (const [id, host, prep] of [['lakita', P, async () => { await p.getByRole('button', { name: 'Close' }).click(); await p.click(P + ' [data-person="aunt3"]'); await p.click(P + ' .ped-chip[data-genotype="BB"]'); }], ['twogene', G, async () => { await p.getByRole('button', { name: '1 Read the chromosomes' }).click(); await p.click(G + ' [data-person="father"]'); await p.click(G + ' .tg-chip[data-gene="p53"][data-genotype="AB"]'); await p.click(G + ' .tg-chip[data-gene="brca1"][data-genotype="CC"]'); }]]) {
          for (const state of ['first', 'second']) {
            if (state === 'second') { await go(p, id); await prep(); } else await go(p, id);
            const res = await p.evaluate(async s => (await axe.run(document.querySelector(s), { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] }, resultTypes: ['violations'] }))
              .violations.filter(v => v.impact === 'critical' || v.impact === 'serious').map(v => v.id + ': ' + v.nodes.slice(0, 2).map(n => n.target.join(' ')).join(' ; ')), host);
            res.forEach(r => found.push(host + ' ' + state + ' ' + r));
          }
        }
        T.ok(found.length === 0, 'axe clean on both scenes at ' + tag + ' ' + found.join(' | '));
      } else if (!src) T.ok(false, 'axe-core not found: set AXE=<path>/node_modules/axe-core/axe.min.js');
      T.ok(problems.length === 0, tag + ': no page errors ' + problems.join(' | '));
      await ctx.close();
    }
  } finally { await browser.close(); server.close(); }
  T.done('t97-pedigree-layout');
})().catch(e => { console.error(e); process.exit(1); });
