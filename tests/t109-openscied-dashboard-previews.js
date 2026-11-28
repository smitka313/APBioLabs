/* OpenSciEd dashboard previews: published unit and activity order, the registry order in the script,
   published WebP previews, HTML captions below each picture, stable 8:5 boxes, no layout shift, and axe clean in light and dark.
   Run: NODE_PATH=$(npm root -g) AXE=<path>/axe.min.js node tests/t109-openscied-dashboard-previews.js */
const T = require('./_h');
const fs = require('fs'), path = require('path');
const stub = pg => pg.route(/gc\.zgo\.at|fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, contentType: /gc\.zgo\.at/.test(r.request().url()) ? 'application/javascript' : 'text/css', body: '' }));
const UNIT1 = ['openscied-b1-field-notebook.html', 'openscied-b1-migration.html', 'openscied-b1-carrying-capacity.html', 'openscied-b1-serengeti.html', 'openscied-b1-ripple.html'];
const FIELD_PREVIEW = 'assets/openscied-atlas-b1-field-notebook-preview.webp';
const MIGRATION_PREVIEW = 'assets/openscied-activity-b1-migration.webp';
const CARRYING_PREVIEW = 'assets/openscied-activity-b1-carrying-capacity.webp';
const SERENGETI_PREVIEW = 'assets/openscied-activity-b1-serengeti.webp';
const UNIT2 = ['openscied-b2-burn-lab.html', 'openscied-b2-fires.html', 'openscied-b2-peat-bog-lab.html', 'openscied-b2-carbon-journey.html'];
const UNIT3 = ['openscied-b3-cancer-rates.html', 'openscied-b3-screening.html', 'openscied-b3-cell-cycle.html', 'openscied-b3-dna-workshop.html', 'openscied-b3-dna-p53.html', 'openscied-b3-inheritance-environment.html'];
const UNIT4 = ['openscied-b4-hawksbeard.html','openscied-b4-rat-generations.html','openscied-b4-junco.html','openscied-b4-wildlife-corridor.html'];
const HAWKSBEARD_PREVIEW = 'assets/openscied-activity-b4-hawksbeard.webp';
const CORRIDOR_PREVIEW='assets/openscied-activity-b4-wildlife-corridor.webp';
const previewFile = key => key === 'b1-field-notebook'
  ? 'openscied-atlas-b1-field-notebook-preview.webp'
  : 'openscied-activity-'+key+'.webp';
(async () => {
  // order in the script registry matches the page
  const js = fs.readFileSync(path.join(__dirname, '../openscied-dashboard.js'), 'utf8');
  const files = [...js.matchAll(/file: '([^']+)'/g)].map(m => m[1]);
  const originalActivities=UNIT1.concat(UNIT2,UNIT3,UNIT4,['openscied-b5-wapusk.html','openscied-b5-thermoregulation.html','openscied-b5-ancestry.html','openscied-b5-speciation.html','openscied-b5-hybrid.html']);
  T.ok(JSON.stringify(files.slice(0,originalActivities.length)) === JSON.stringify(originalActivities), 'openscied-dashboard.js preserves the published activity order through Unit 5');
  for (const activity of originalActivities) {
    const key = activity.replace(/^openscied-|\.html$/g,'');
    const art = fs.readFileSync(path.join(__dirname,'../assets',previewFile(key)));
    T.ok(art.subarray(0,4).toString() === 'RIFF' && art.subarray(8,12).toString() === 'WEBP',
      activity+' preview is WebP');
  }
  const b = await T.launch(), srv = await T.serve();
  try {
    for (const width of [375, 768, 1366, 1920]) {
      const ctx = await T.ctxFor(b, { width, height: 900 });
      const p = await ctx.newPage(); await stub(p); const errs = []; p.on('pageerror', e => errs.push(e.message));
      await p.addInitScript(() => { window.__cls = 0; new PerformanceObserver(l => l.getEntries().forEach(e => { if (!e.hadRecentInput) window.__cls += e.value; })).observe({ type: 'layout-shift', buffered: true }); });
      await p.goto(srv.url + 'openscied-dashboard.html'); await p.waitForSelector('#b2-burn-progress'); await p.waitForTimeout(600);
      const hrefs = sel => p.$$eval(sel + ' .dashboard-preview', as => as.map(a => a.getAttribute('href')));
      const units = await p.$$eval('.dashboard-units > section.dashboard-unit.current', sections=>sections.map(s=>s.getAttribute('aria-labelledby')));
      T.ok(JSON.stringify(units) === JSON.stringify(['unit1','unit2','unit3','unit4','unit5']), width + ' px: all published units appear in curriculum order');
      T.ok(JSON.stringify(await hrefs('section[aria-labelledby="unit1"]')) === JSON.stringify(UNIT1), width + ' px: first unit opens with the Field Notebook, then links to Migration Explorer, Carrying Capacity Lab, Serengeti Board Game, and Ripple Effects');
      T.ok(JSON.stringify(await hrefs('section[aria-labelledby="unit2"]')) === JSON.stringify(UNIT2), width + ' px: Unit 2 cards are Burning Fuels, Fires, Peat Bog Carbon Lab, Carbon Atom Journey');
      T.ok(JSON.stringify(await hrefs('section[aria-labelledby="unit3"]')) === JSON.stringify(UNIT3), width + ' px: Unit 3 starts with the data dive, and DNA Workshop immediately precedes DNA Copying and p53');
      T.ok(JSON.stringify(await hrefs('section[aria-labelledby="unit4"]')) === JSON.stringify(UNIT4), width + ' px: Unit 4 links to Hawksbeard, Rat Generations, Junco, and Wildlife Corridor in lesson order');
      const fieldImage=p.locator('.dashboard-preview[href="'+UNIT1[0]+'"] img');
      await fieldImage.scrollIntoViewIfNeeded();
      await fieldImage.evaluate(img=>img.decode());
      const serengetiImage = p.locator('img[src="'+SERENGETI_PREVIEW+'"]');
      await serengetiImage.scrollIntoViewIfNeeded(); // Trigger lazy loading below the fold.
      await p.waitForFunction(path=>{const img = document.querySelector('img[src="'+path+'"]');return img?.complete&&img.naturalWidth>0;},SERENGETI_PREVIEW,{timeout:10000});
      await p.locator('img[src="'+MIGRATION_PREVIEW+'"]').scrollIntoViewIfNeeded();
      await p.waitForFunction(path=>{const img=document.querySelector('img[src="'+path+'"]');return img?.complete&&img.naturalWidth===960;},MIGRATION_PREVIEW,{timeout:10000});
      await p.locator('img[src="'+CARRYING_PREVIEW+'"]').scrollIntoViewIfNeeded();
      await p.waitForFunction(path=>{const img=document.querySelector('img[src="'+path+'"]');return img?.complete&&img.naturalWidth===960;},CARRYING_PREVIEW,{timeout:10000});
      await p.locator('img[src="'+HAWKSBEARD_PREVIEW+'"]').scrollIntoViewIfNeeded();
      await p.waitForFunction(path=>{const img=document.querySelector('img[src="'+path+'"]');return img?.complete&&img.naturalWidth===960;},HAWKSBEARD_PREVIEW,{timeout:10000});
      const cancerImage=p.locator('img[src="assets/openscied-activity-b3-cancer-rates.webp"]');
      await cancerImage.scrollIntoViewIfNeeded();
      await cancerImage.evaluate(img=>img.decode());
      const workshopImage=p.locator('img[src="assets/openscied-activity-b3-dna-workshop.webp"]');
      await workshopImage.scrollIntoViewIfNeeded();
      await workshopImage.evaluate(img=>img.decode());
      const ratImage = p.locator('img[src="assets/openscied-activity-b4-rat-generations.webp"]');
      await ratImage.scrollIntoViewIfNeeded();
      await ratImage.evaluate(img => img.decode());
      const juncoImage = p.locator('img[src="assets/openscied-activity-b4-junco.webp"]');
      await juncoImage.scrollIntoViewIfNeeded();
      await juncoImage.evaluate(img => img.decode());
      const corridorImage=p.locator('img[src="'+CORRIDOR_PREVIEW+'"]');
      await corridorImage.scrollIntoViewIfNeeded();
      await corridorImage.evaluate(img=>img.decode());
      const rippleImage=p.locator('img[src="assets/openscied-activity-b1-ripple.webp"]');
      await rippleImage.scrollIntoViewIfNeeded();
      await rippleImage.evaluate(img=>img.decode());
      const m = await p.$$eval('.dashboard-activity', cards => cards.map(c => {
        const a = c.querySelector('.dashboard-preview'), img = a && a.querySelector('img'), media = img, cap = c.querySelector('.dashboard-caption'), fig = c.querySelector('.dashboard-figure');
        const ar = a.getBoundingClientRect(), cr = cap.getBoundingClientRect(), fr = fig.getBoundingClientRect();
        const kids = [...cap.children].map(k => k.getBoundingClientRect());
        const action = c.querySelector('.dashboard-open');
        return {
          label: action?.getAttribute('aria-label') || '',
          previewHidden: a.getAttribute('aria-hidden') === 'true' && a.tabIndex === -1,
          pill: !!c.querySelector('.dashboard-preview-label'),
          ratio: ar.width / ar.height, capBelow: cr.top >= ar.bottom - 0.5, capInside: cr.left >= fr.left - 0.5 && cr.right <= fr.right + 0.5,
          kidsInside: kids.every(k => k.left >= fr.left - 0.5 && k.right <= fr.right + 0.5), capText: cap.innerText.trim(), capH: cr.height, w: ar.width,
          sim: !!cap.querySelector('.dashboard-sim'), simText: cap.querySelector('.dashboard-sim')?.textContent.trim(),
          mediaW: media?.getBoundingClientRect().width,
          img: img ? {src: img.getAttribute('src'), alt: img.getAttribute('alt'), w: img.naturalWidth, h: img.naturalHeight,
            complete: img.complete, widthAttr: img.getAttribute('width'), heightAttr: img.getAttribute('height')} : null
        };
      }));
      T.ok(m.length===files.length && m.every(x=>/\.(svg|webp)$/.test(x.img?.src||'') && x.img.alt===''),
        width + ' px: all published activities have their own decorative illustration');
      const actionCounts = await Promise.all((await p.locator('.dashboard-activity').all()).map(card => card.getByRole('link').count()));
      T.ok(m.every(x => x.previewHidden && /^Open activity: .+/.test(x.label)) &&
        new Set(m.map(x => x.label)).size === files.length && actionCounts.every(n => n === 1),
        width + ' px: pointer artwork remains linked without duplicating the one named keyboard action for each activity');
      T.ok(m.every(x=>!x.pill), width + ' px: data-type pills are HTML and sit outside the artwork');
      const field = m[0];
      T.ok(field?.img?.complete && field.img.src===FIELD_PREVIEW && field.img.w===960 && field.img.h===600 &&
        field.label==='Open activity: Serengeti Field Notebook',width+' px: field notebook opens Unit 1 with its illustrated card');
      const first = m[1], poster = first?.img;
      T.ok(poster?.complete && poster.src===MIGRATION_PREVIEW && poster.w===960 && poster.h===600 &&
        poster.widthAttr==='960' && poster.heightAttr==='600' && Math.abs(poster.w/poster.h-1.6)<0.001,
        width + ' px: Migration illustration loads and has reserved 960×600 proportions');
      T.ok(poster?.alt==='' && first.label === 'Open activity: Migration Map Explorer',
        width + ' px: the decorative Migration image has a named primary activity link alongside');
      const carrying = m[2];
      T.ok(carrying?.img?.complete && carrying.img.src===CARRYING_PREVIEW &&
        carrying.img.w===960 && carrying.img.h===600 && carrying.img.alt==='' &&
        carrying.label === 'Open activity: Carrying Capacity',
        width + ' px: Carrying Capacity card has the revised carrying capacity illustration and a named link');
      const wapusk = m.find(x=>x.img?.src==='assets/openscied-activity-b5-wapusk.webp');
      T.ok(wapusk?.img?.complete && wapusk.img.w===960 && wapusk.img.h===600 &&
        wapusk.img.widthAttr==='960' && wapusk.img.heightAttr==='600' &&
        wapusk.label==='Open activity: Three Bears in Wapusk',
        width + ' px: Wapusk uses the dedicated 8:5 preview of the detailed field-profile bears');
      const hawksbeard = m.find(x=>x.img?.src===HAWKSBEARD_PREVIEW);
      T.ok(hawksbeard?.img?.complete && hawksbeard.img.src===HAWKSBEARD_PREVIEW &&
        hawksbeard.img.w===960 && hawksbeard.img.h===600 && hawksbeard.img.alt==='' &&
        hawksbeard.img.widthAttr==='960' && hawksbeard.img.heightAttr==='600' &&
        hawksbeard.label === 'Open activity: Hawksbeard Wind Lab',
        width + ' px: the Hawksbeard illustration loads at the reserved size and its primary link has a descriptive accessible name');
      const rats = m.find(x=>x.img?.src==='assets/openscied-activity-b4-rat-generations.webp');
      T.ok(rats?.img?.complete && rats.img.src === 'assets/openscied-activity-b4-rat-generations.webp' &&
        rats.img.w === 960 && rats.img.h === 600 && rats.img.alt === '' &&
        rats.label === 'Open activity: Rat Generations',
        width + ' px: Rat Generations shows its revised illustration and a named primary link');
      const cancer=m.find(x=>x.img?.src==='assets/openscied-activity-b3-cancer-rates.webp');
      T.ok(cancer?.img?.complete && cancer.img.w===960 && cancer.img.h===600 &&
        cancer.img.alt==='' && cancer.label === 'Open activity: Cancer Rates Data Dive' && /Real data/.test(cancer.capText),
        width + ' px: Cancer Rates Data Dive has a named primary link and accurate real-data descriptor');
      const junco=m.find(x=>x.img?.src==='assets/openscied-activity-b4-junco.webp');
      T.ok(junco?.img?.complete && junco.img.w===960 && junco.img.h===600 && junco.img.alt==='' &&
        junco.label === 'Open activity: Junco Investigation' && junco.simText === 'Simulated + real data',
        width + ' px: Junco has a named primary link and a combined simulated/real-data descriptor');
      const corridor=m.find(x=>x.img?.src===CORRIDOR_PREVIEW);
      T.ok(corridor?.img?.complete && corridor.img.w===960 && corridor.img.h===600 && corridor.img.alt==='' &&
        corridor.img.widthAttr==='960' && corridor.img.heightAttr==='600' &&
        corridor.label==='Open activity: Wildlife Corridor Lab' && corridor.simText==='Simulated',
        width + ' px: Wildlife Corridor reserves its revised model artwork and describes it as simulated');
      const ripple=m.find(x=>x.img?.src==='assets/openscied-activity-b1-ripple.webp');
      T.ok(ripple?.img?.complete && ripple.img.w===960 && ripple.img.h===600 && ripple.img.alt==='' &&
        ripple.label==='Open activity: Serengeti Ripple Effects' && ripple.simText==='Simulated',
        width + ' px: Ripple Effects shows the revised illustration and simulated-data badge');
      const workshop=m.find(x=>x.img?.src==='assets/openscied-activity-b3-dna-workshop.webp');
      T.ok(workshop?.img?.complete && workshop.img.w===960 && workshop.img.h===600 &&
        workshop.img.alt==='' && workshop.label === 'Open activity: DNA Workshop: Build, Copy, Decode',
        width + ' px: DNA Workshop shows its revised illustration and a named primary link');
      T.ok(m.every(x => x.capBelow && x.capInside && x.kidsInside), width + ' px: every caption sits below the picture, inside the card column, without overlapping it');
      T.ok(m.every(x => x.sim && /Simulated|Illustrative map|Model \+ field data|Real data/.test(x.capText) && x.capText.length > 14), width + ' px: caption text and the accurate source/illustration tag are HTML text');
      T.ok(m.every(x => Math.abs(x.ratio - 1.6) < 0.02 && Math.abs(x.mediaW - x.w) < 3), width + ' px: preview keeps its 8:5 box and the art fills it');
      T.ok(m.every(x => x.capH < 60), width + ' px: caption never wraps past two lines');
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
    const fieldCard = p.locator('.dashboard-activity').first();
    T.ok((await fieldCard.locator('.dashboard-open').getAttribute('href')) === UNIT1[0], 'the first card opens the Field Notebook');
    const firstCard = p.locator('.dashboard-activity').filter({has:p.locator('#migration-open')});
    T.ok((await firstCard.locator('.dashboard-preview').getAttribute('href')) === UNIT1[1], 'Migration Explorer preview links to the exact activity URL');
    const migrationOpen = firstCard.locator('.dashboard-open');
    const migrationStart = UNIT1[1];
    T.ok((await migrationOpen.getAttribute('href')) === migrationStart, 'a fresh Migration card opens the activity without a scroll anchor');
    const burnCard = p.locator('section[aria-labelledby="unit2"] .dashboard-activity').first();
    T.ok((await burnCard.locator('.dashboard-preview').getAttribute('href')) === UNIT2[0], 'first Unit 2 card (Burning Fuels) preview still links to its activity');
    T.ok((await burnCard.locator('.dashboard-open').getAttribute('href')).startsWith(UNIT2[0]), 'first Unit 2 card button still opens Burning Fuels');
    const hawksbeardCard = p.locator('section[aria-labelledby="unit4"] .dashboard-activity').first();
    T.ok((await hawksbeardCard.locator('.dashboard-preview').getAttribute('href')) === UNIT4[0]
      && (await hawksbeardCard.locator('.dashboard-open').getAttribute('href')) === UNIT4[0],
      'the new card and its default button open the exact Hawksbeard Wind Lab URL');
    await Promise.all([p.waitForURL(url => url.pathname === '/' + migrationStart), migrationOpen.click()]);
    await p.locator('#explore #month-buttons button').first().waitFor({state:'visible'});
    const migrationHeading = p.getByRole('heading', { level: 1, name: 'Migration Map Explorer', exact: true });
    const landing = await p.evaluate(() => ({ y: scrollY, hash: location.hash }));
    const headingBox = await migrationHeading.boundingBox();
    T.ok(landing.y < 4 && !landing.hash && !!headingBox && headingBox.y >= 0 && headingBox.y + headingBox.height <= 900,
      'a fresh Migration visit begins at the activity title without an anchor: ' + JSON.stringify(landing));
    T.ok(await p.locator('#explore #migration-map').isVisible()
      && (await p.locator('[data-page="explore"]').getAttribute('aria-current')) === 'page',
      'first card button opens the live Migration Explorer on Explore the year');
    await p.locator('[data-page="evidence"]').click();
    T.ok(await p.evaluate(() => location.hash === '#evidence') && await p.locator('#evidence').isVisible(),
      'choosing another section still adds its shareable fragment');
    await p.reload();
    await p.locator('#evidence .mx-card').first().waitFor({ state: 'visible' });
    T.ok(await p.evaluate(() => location.hash === '#evidence') &&
      (await p.locator('[data-page="evidence"]').getAttribute('aria-current')) === 'page',
      'reloading an explicit fragment keeps that section selected');
    await ctx.close();
  } finally { await b.close(); srv.close(); }
  T.done('t109-openscied-dashboard-previews');
})();
