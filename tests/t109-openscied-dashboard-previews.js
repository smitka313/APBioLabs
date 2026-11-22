/* OpenSciEd dashboard previews: Unit 2 order (Burning Fuels, Fires, Peat Bog Carbon Lab), the registry order in the script,
   HTML captions under (never inside) each picture, a stable 8:5 preview box, no layout shift, axe clean in light and dark.
   Run: NODE_PATH=$(npm root -g) AXE=<path>/axe.min.js node tests/t109-openscied-dashboard-previews.js */
const T = require('./_h');
const fs = require('fs'), path = require('path');
const stub = pg => pg.route(/gc\.zgo\.at|fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, contentType: /gc\.zgo\.at/.test(r.request().url()) ? 'application/javascript' : 'text/css', body: '' }));
const UNIT2 = ['openscied-b2-burn-lab.html', 'openscied-b2-fires.html', 'openscied-b2-peat-bog-lab.html'];
const UNIT3 = ['openscied-b3-cell-cycle.html', 'openscied-b3-dna-p53.html', 'openscied-b3-inheritance-environment.html'];
(async () => {
  // order in the script registry matches the page
  const js = fs.readFileSync(path.join(__dirname, '../openscied-dashboard.js'), 'utf8');
  const files = [...js.matchAll(/file: '([^']+)'/g)].map(m => m[1]);
  T.ok(JSON.stringify(files) === JSON.stringify(UNIT2.concat(UNIT3)), 'openscied-dashboard.js lists activities in page order (Unit 2: burn, fires, peat bog; then Unit 3)');
  const b = await T.launch(), srv = await T.serve();
  try {
    for (const width of [375, 768, 1366, 1920]) {
      const ctx = await T.ctxFor(b, { width, height: 900 });
      const p = await ctx.newPage(); await stub(p); const errs = []; p.on('pageerror', e => errs.push(e.message));
      await p.addInitScript(() => { window.__cls = 0; new PerformanceObserver(l => l.getEntries().forEach(e => { if (!e.hadRecentInput) window.__cls += e.value; })).observe({ type: 'layout-shift', buffered: true }); });
      await p.goto(srv.url + 'openscied-dashboard.html'); await p.waitForSelector('#b2-burn-progress'); await p.waitForTimeout(600);
      const hrefs = sel => p.$$eval(sel + ' .dashboard-preview', as => as.map(a => a.getAttribute('href')));
      T.ok(JSON.stringify(await hrefs('section[aria-labelledby="unit2"]')) === JSON.stringify(UNIT2), width + ' px: Unit 2 cards are Burning Fuels, Fires, Peat Bog Carbon Lab');
      T.ok(JSON.stringify(await hrefs('section[aria-labelledby="unit3"]')) === JSON.stringify(UNIT3), width + ' px: Unit 3 order unchanged');
      const m = await p.$$eval('.dashboard-activity', cards => cards.map(c => {
        const a = c.querySelector('.dashboard-preview'), svg = a && a.querySelector('svg'), cap = c.querySelector('.dashboard-caption'), fig = c.querySelector('.dashboard-figure');
        const ar = a.getBoundingClientRect(), cr = cap.getBoundingClientRect(), fr = fig.getBoundingClientRect();
        const kids = [...cap.children].map(k => k.getBoundingClientRect());
        return {
          label: a.getAttribute('aria-label') || '', hidden: svg && svg.getAttribute('aria-hidden'), role: svg && svg.getAttribute('role'),
          svgText: svg ? [...svg.querySelectorAll('text')].map(t => t.textContent.trim()) : [], pill: !!c.querySelector('.dashboard-preview-label'),
          ratio: ar.width / ar.height, capBelow: cr.top >= ar.bottom - 0.5, capInside: cr.left >= fr.left - 0.5 && cr.right <= fr.right + 0.5,
          kidsInside: kids.every(k => k.left >= fr.left - 0.5 && k.right <= fr.right + 0.5), capText: cap.innerText.trim(), capH: cr.height, w: ar.width,
          sim: !!cap.querySelector('.dashboard-sim'), svgW: svg.getBoundingClientRect().width, shapes: svg.querySelectorAll('path,circle,ellipse,rect').length
        };
      }));
      T.ok(m.length === 6, width + ' px: six cards');
      T.ok(m.every(x => x.hidden === 'true' && !x.role && x.label.length > 40 && /^Open /.test(x.label)), width + ' px: SVG decorative (aria-hidden, no role) and the link names the activity');
      T.ok(m.every(x => !x.pill && x.shapes > 40), width + ' px: no pill inside the picture, and each picture is real art');
      T.ok(m.every(x => x.capBelow && x.capInside && x.kidsInside), width + ' px: every caption sits below the picture, inside the card column, without overlapping it');
      T.ok(m.every(x => x.sim && /Simulated/.test(x.capText) && x.capText.length > 14), width + ' px: caption text and the Simulated tag are HTML text');
      T.ok(m.every(x => Math.abs(x.ratio - 1.6) < 0.02 && Math.abs(x.svgW - x.w) < 3), width + ' px: preview keeps its 8:5 box and the art fills it');
      T.ok(m.every(x => x.capH < 60), width + ' px: caption never wraps past two lines');
      // art text must stay inside the picture and never be a long caption
      T.ok(m.every(x => x.svgText.every(t => t.length <= 12)), width + ' px: text drawn inside the pictures is only short labels (' + [...new Set(m.flatMap(x => x.svgText))].join(' | ') + ')');
      T.ok(await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth) <= 0, width + ' px: no horizontal overflow');
      const cls = await p.evaluate(() => window.__cls);
      T.ok(cls <= 0.1, width + ' px: CLS ' + cls.toFixed(3) + ' <= 0.1');
      T.ok(errs.length === 0, width + ' px: no script errors ' + errs.join('; '));
      await ctx.close();
    }
    // axe in light and dark
    const c = [process.env.AXE, (() => { try { return require.resolve('axe-core/axe.min.js'); } catch (e) { return null; } })(), path.join(__dirname, '../node_modules/axe-core/axe.min.js')].filter(Boolean);
    const axeFile = c.find(f => fs.existsSync(f));
    if (!axeFile) T.ok(false, 'axe-core not found (set AXE=<path>/axe.min.js)');
    else for (const dark of [false, true]) for (const width of [390, 1366]) {
      const ctx = await T.ctxFor(b, { width, height: 900, dark });
      const p = await ctx.newPage(); await stub(p);
      await p.goto(srv.url + 'openscied-dashboard.html'); await p.waitForSelector('#b2-burn-progress'); await p.addScriptTag({ path: axeFile });
      const res = await p.evaluate(async () => (await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] }, resultTypes: ['violations'] })).violations.map(v => v.id + ' x' + v.nodes.length));
      T.ok(res.length === 0, 'axe ' + (dark ? 'dark' : 'light') + ' ' + width + ' px: ' + (res.join(', ') || 'clean'));
      await ctx.close();
    }
    // the picture link still opens its activity
    const ctx = await T.ctxFor(b, { width: 1366, height: 900 });
    const p = await ctx.newPage(); await stub(p);
    await p.goto(srv.url + 'openscied-dashboard.html'); await p.waitForSelector('#b2-burn-progress');
    T.ok((await p.locator('.dashboard-activity').first().locator('.dashboard-preview').getAttribute('href')) === 'openscied-b2-burn-lab.html', 'first card (Burning Fuels) links to its activity');
    T.ok((await p.locator('.dashboard-activity').first().locator('.dashboard-open').getAttribute('href')).startsWith('openscied-b2-burn-lab.html'), 'first card button opens Burning Fuels');
    await ctx.close();
  } finally { await b.close(); srv.close(); }
  T.done('t109-openscied-dashboard-previews');
})();
