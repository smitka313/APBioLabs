/* OpenSciEd dashboard previews: published unit and activity order, the registry order in the script,
   external Unit 1 illustrations plus the seven inline SVG previews, HTML captions below each picture, stable 8:5 boxes, no layout shift, and axe clean in light and dark.
   Run: NODE_PATH=$(npm root -g) AXE=<path>/axe.min.js node tests/t109-openscied-dashboard-previews.js */
const T = require('./_h');
const fs = require('fs'), path = require('path');
const stub = pg => pg.route(/gc\.zgo\.at|fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, contentType: /gc\.zgo\.at/.test(r.request().url()) ? 'application/javascript' : 'text/css', body: '' }));
const UNIT1 = ['openscied-b1-migration.html', 'openscied-b1-carrying-capacity.html', 'openscied-b1-serengeti.html'];
const MIGRATION_PREVIEW = 'assets/migration-explorer-preview.svg';
const CARRYING_PREVIEW = 'assets/carrying-capacity-preview.svg';
const SERENGETI_PREVIEW = 'assets/openscied-serengeti-preview.svg';
const UNIT2 = ['openscied-b2-burn-lab.html', 'openscied-b2-fires.html', 'openscied-b2-peat-bog-lab.html', 'openscied-b2-carbon-journey.html'];
const UNIT3 = ['openscied-b3-cell-cycle.html', 'openscied-b3-dna-p53.html', 'openscied-b3-inheritance-environment.html'];
(async () => {
  // order in the script registry matches the page
  const js = fs.readFileSync(path.join(__dirname, '../openscied-dashboard.js'), 'utf8');
  const files = [...js.matchAll(/file: '([^']+)'/g)].map(m => m[1]);
  T.ok(JSON.stringify(files) === JSON.stringify(UNIT1.concat(UNIT2,UNIT3)), 'openscied-dashboard.js lists activities in page order: migration, carrying capacity, and Serengeti, then Units 2 and 3');
  const b = await T.launch(), srv = await T.serve();
  try {
    for (const width of [375, 768, 1366, 1920]) {
      const ctx = await T.ctxFor(b, { width, height: 900 });
      const p = await ctx.newPage(); await stub(p); const errs = []; p.on('pageerror', e => errs.push(e.message));
      await p.addInitScript(() => { window.__cls = 0; new PerformanceObserver(l => l.getEntries().forEach(e => { if (!e.hadRecentInput) window.__cls += e.value; })).observe({ type: 'layout-shift', buffered: true }); });
      await p.goto(srv.url + 'openscied-dashboard.html'); await p.waitForSelector('#b2-burn-progress'); await p.waitForTimeout(600);
      const hrefs = sel => p.$$eval(sel + ' .dashboard-preview', as => as.map(a => a.getAttribute('href')));
      const units = await p.$$eval('.dashboard-units > section.dashboard-unit.current', sections=>sections.map(s=>s.getAttribute('aria-labelledby')));
      T.ok(JSON.stringify(units.slice(0,3)) === JSON.stringify(['unit1','unit2','unit3']), width + ' px: Unit 1 is above Units 2 and 3');
      T.ok(JSON.stringify(await hrefs('section[aria-labelledby="unit1"]')) === JSON.stringify(UNIT1), width + ' px: first unit links to Migration Explorer, Carrying Capacity Lab, and Serengeti Board Game');
      T.ok(JSON.stringify(await hrefs('section[aria-labelledby="unit2"]')) === JSON.stringify(UNIT2), width + ' px: Unit 2 cards are Burning Fuels, Fires, Peat Bog Carbon Lab, Carbon Atom Journey');
      T.ok(JSON.stringify(await hrefs('section[aria-labelledby="unit3"]')) === JSON.stringify(UNIT3), width + ' px: Unit 3 order unchanged');
      const serengetiImage = p.locator('img[src="'+SERENGETI_PREVIEW+'"]');
      await serengetiImage.scrollIntoViewIfNeeded(); // Trigger lazy loading below the fold.
      await p.waitForFunction(path=>{const img = document.querySelector('img[src="'+path+'"]');return img?.complete&&img.naturalWidth>0;},SERENGETI_PREVIEW,{timeout:10000});
      await p.locator('img[src="'+MIGRATION_PREVIEW+'"]').scrollIntoViewIfNeeded();
      await p.waitForFunction(path=>{const img=document.querySelector('img[src="'+path+'"]');return img?.complete&&img.naturalWidth===960;},MIGRATION_PREVIEW,{timeout:10000});
      await p.locator('img[src="'+CARRYING_PREVIEW+'"]').scrollIntoViewIfNeeded();
      await p.waitForFunction(path=>{const img=document.querySelector('img[src="'+path+'"]');return img?.complete&&img.naturalWidth===960;},CARRYING_PREVIEW,{timeout:10000});
      const m = await p.$$eval('.dashboard-activity', cards => cards.map(c => {
        const a = c.querySelector('.dashboard-preview'), svg = a && a.querySelector('svg'), img = a && a.querySelector('img'), media = svg || img, cap = c.querySelector('.dashboard-caption'), fig = c.querySelector('.dashboard-figure');
        const ar = a.getBoundingClientRect(), cr = cap.getBoundingClientRect(), fr = fig.getBoundingClientRect();
        const kids = [...cap.children].map(k => k.getBoundingClientRect());
        return {
          label: a.getAttribute('aria-label') || '', hidden: svg && svg.getAttribute('aria-hidden'), role: svg && svg.getAttribute('role'),
          svgText: svg ? [...svg.querySelectorAll('text')].map(t => t.textContent.trim()) : [], pill: !!c.querySelector('.dashboard-preview-label'),
          ratio: ar.width / ar.height, capBelow: cr.top >= ar.bottom - 0.5, capInside: cr.left >= fr.left - 0.5 && cr.right <= fr.right + 0.5,
          kidsInside: kids.every(k => k.left >= fr.left - 0.5 && k.right <= fr.right + 0.5), capText: cap.innerText.trim(), capH: cr.height, w: ar.width,
          sim: !!cap.querySelector('.dashboard-sim'), mediaW: media?.getBoundingClientRect().width,
          svg: !!svg, shapes: svg?.querySelectorAll('path,circle,ellipse,rect').length || 0,
          img: img ? {src: img.getAttribute('src'), alt: img.getAttribute('alt'), w: img.naturalWidth, h: img.naturalHeight,
            complete: img.complete, widthAttr: img.getAttribute('width'), heightAttr: img.getAttribute('height')} : null
        };
      }));
      const svgCards = m.filter(x=>x.svg);
      T.ok(m.length === 10 && svgCards.length === 7 && m.filter(x=>x.img).length === 3, width + ' px: ten cards: seven inline illustrations and three linked SVG illustrations');
      T.ok(svgCards.every(x => x.hidden === 'true' && !x.role && x.label.length > 40 && /^Open /.test(x.label)), width + ' px: SVG decorative (aria-hidden, no role) and the link names the activity');
      T.ok(m.every(x=>!x.pill) && svgCards.every(x=>x.shapes>40), width + ' px: no pill inside any picture, and every SVG has real art');
      const first = m[0], poster = first?.img;
      T.ok(poster?.complete && poster.src===MIGRATION_PREVIEW && poster.w===960 && poster.h===600 &&
        poster.widthAttr==='960' && poster.heightAttr==='600' && Math.abs(poster.w/poster.h-1.6)<0.001,
        width + ' px: first card illustration loads and has reserved 960×600 proportions');
      T.ok(poster?.alt==='' && /^Open Migration Map Explorer/.test(first.label) && first.label.length>40,
        width + ' px: the illustrated preview link has a descriptive accessible name');
      const carrying = m[1];
      T.ok(carrying?.img?.complete && carrying.img.src===CARRYING_PREVIEW &&
        carrying.img.w===960 && carrying.img.h===600 && carrying.img.alt==='' &&
        /^Open Carrying Capacity/.test(carrying.label),
        width + ' px: second card has the original carrying capacity illustration and a named link');
      T.ok(m.every(x => x.capBelow && x.capInside && x.kidsInside), width + ' px: every caption sits below the picture, inside the card column, without overlapping it');
      T.ok(m.every(x => x.sim && /Simulated|Illustrative map|Model \+ field data/.test(x.capText) && x.capText.length > 14), width + ' px: caption text and the accurate source/illustration tag are HTML text');
      T.ok(m.every(x => Math.abs(x.ratio - 1.6) < 0.02 && Math.abs(x.mediaW - x.w) < 3), width + ' px: preview keeps its 8:5 box and the art fills it');
      T.ok(m.every(x => x.capH < 60), width + ' px: caption never wraps past two lines');
      // art text must stay inside the picture and never be a long caption
      T.ok(svgCards.every(x => x.svgText.every(t => t.length <= 12)), width + ' px: text drawn inside the pictures is only short labels (' + [...new Set(m.flatMap(x => x.svgText))].join(' | ') + ')');
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
    // Preview links keep their activity paths; the regular link opens the default section.
    const ctx = await T.ctxFor(b, { width: 1366, height: 900 });
    const p = await ctx.newPage(); await stub(p);
    await p.goto(srv.url + 'openscied-dashboard.html'); await p.waitForSelector('#b2-burn-progress');
    const firstCard = p.locator('.dashboard-activity').first();
    T.ok((await firstCard.locator('.dashboard-preview').getAttribute('href')) === UNIT1[0], 'first card (Migration Explorer) preview links to the exact activity URL');
    const migrationOpen = firstCard.locator('.dashboard-open');
    const migrationStart = UNIT1[0] + '#explore';
    T.ok((await migrationOpen.getAttribute('href')) === migrationStart, 'first card button links to the Migration Explorer default section');
    const burnCard = p.locator('section[aria-labelledby="unit2"] .dashboard-activity').first();
    T.ok((await burnCard.locator('.dashboard-preview').getAttribute('href')) === UNIT2[0], 'first Unit 2 card (Burning Fuels) preview still links to its activity');
    T.ok((await burnCard.locator('.dashboard-open').getAttribute('href')).startsWith(UNIT2[0]), 'first Unit 2 card button still opens Burning Fuels');
    await Promise.all([p.waitForURL(srv.url + migrationStart), migrationOpen.click()]);
    await p.locator('#explore #month-buttons button').first().waitFor({state:'visible'});
    T.ok(await p.locator('#explore #migration-map').isVisible()
      && (await p.locator('[data-page="explore"]').getAttribute('aria-current')) === 'page',
      'first card button opens the live Migration Explorer on Explore the year');
    await ctx.close();
  } finally { await b.close(); srv.close(); }
  T.done('t109-openscied-dashboard-previews');
})();
