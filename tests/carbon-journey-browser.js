const { chromium } = require('playwright');
const Journey = require('../openscied-b2-carbon-journey-logic');
const http = require('node:http'), fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
(async () => {
  const root = path.resolve(__dirname, '..');
  const server = http.createServer((req, res) => {
    const p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
    if (!p.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); }
    fs.readFile(p, (e, b) => { if (e) { res.writeHead(404); return res.end(); } res.setHeader('Content-Type', p.endsWith('.js') ? 'application/javascript' : p.endsWith('.css') ? 'text/css' : 'text/html'); res.end(b); });
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  let browser;
  try {
    browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
    const url = `http://127.0.0.1:${server.address().port}/openscied-b2-carbon-journey.html`;
    fs.mkdirSync(path.join(root, 'artifacts/l9'), { recursive: true });
    for (const [width, height] of [[375,667],[390,844],[768,1024],[1366,768],[1920,1080]]) {
      const ctx = await browser.newContext({ viewport: { width, height }, colorScheme: width < 400 ? 'dark' : 'light', reducedMotion: 'reduce' });
      const p = await ctx.newPage(), errors = []; p.on('pageerror', e => errors.push(e.message));
      await p.goto(url);
      await p.goto(url + '#budget');
      assert.equal(await p.locator('script[src$="/student-step-nav.js"], link[href$="/student-step-nav.css"]').count(), 0, 'Journey keeps its native viewport-fitted navigation');
      assert.equal(await p.getByRole('button',{name:'Carbon & Energy Budget',exact:true}).isDisabled(),true);
      assert.equal(await p.locator('#budget').isHidden(),true);
      const shot = state => p.screenshot({ path: path.join(root, `artifacts/l9/${width}-${state}.png`), fullPage: true });
      const fits = async selector => { const b = await p.locator(selector).boundingBox(); assert.ok(b && b.y >= 0 && b.y + b.height <= height + 1, `${selector} within viewport at ${width}x${height}: ${JSON.stringify(b)}`); };
      await p.locator('#roll').waitFor();
      assert.equal(await p.locator('#restart').isDisabled(), true);
      if (width < 851) {
        await fits('#roll'); await fits('#board');
        const viewport = await p.evaluate(() => ({
          height: innerHeight,
          scrollHeight: document.documentElement.scrollHeight,
          shell: document.querySelector('.journey-shell').getBoundingClientRect().height,
          masthead: document.querySelector('.bench-activity-bar')?.getBoundingClientRect().height ?? null
        }));
        assert.ok(viewport.scrollHeight <= viewport.height + 1,
          `Journey play view fits ${width}×${height}: ${JSON.stringify(viewport)}`);
      }
      await shot('start');
      await p.locator('#inspect-current').click();
      assert.ok(await p.locator('#inspect-dialog').isVisible());
      await p.locator('#inspect-options button').nth(1).click();
      assert.ok((await p.locator('#inspect-caption').textContent()).length > 60);
      await p.locator('[data-close="inspect-dialog"]').click();
      if (width < 851) {
        await p.locator('#map-toggle').click(); assert.equal(await p.locator('[data-station]').count(), 7);
        await p.locator('[data-station="soil"]').click(); assert.match(await p.locator('#inspect-title').textContent(), /Soil/);
        await p.locator('[data-close="inspect-dialog"]').click(); await p.locator('#map-toggle').click(); await fits('#roll');
      }
      await p.locator('#roll').click(); assert.equal(await p.locator('#prediction-options button').count(), 7);
      assert.equal(await p.locator('#restart').isEnabled(), true);
      const pending = await p.locator('#die').getAttribute('aria-label'); await p.reload();
      assert.equal(await p.locator('#die').getAttribute('aria-label'), pending);
      for (let i = 0; i < 10; i++) {
        if (i) await p.locator('#roll').click();
        assert.equal(await p.locator('#prediction-options button').count(), 7);
        if (width < 851) await fits('#skip-prediction');
        if (i === 0) { await shot('predict'); await p.locator('[data-guess="ocean"]').click(); }
        else await p.locator('#skip-prediction').click();
        const raw = await p.evaluate(() => localStorage.getItem('aplab:openscied:b2-carbon-journey:v1'));
        const outcome = Journey.outcome(Journey.readSaved(raw));
        assert.equal(await p.locator('#official-card').textContent(), Journey.cardText(outcome.text));
        assert.equal(await p.locator('#energy').textContent(), Journey.energyMeaning(outcome.energy));
        assert.ok(await p.locator('#record').isVisible());
        if (width < 851) { await fits('#record'); assert.ok(await p.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1)); }
        const expected = await p.locator('#destination').textContent();
        if (i === 0) { await shot('card'); await p.reload(); assert.ok(await p.locator('#record').isVisible()); }
        await p.locator('#record').click(); assert.equal(await p.locator('#location').textContent(), expected);
        if (i === 4) await shot('middle');
        if(await p.locator('#coverage-continue').isVisible())await p.locator('#coverage-continue').click();
      }
      assert.equal(await p.locator('#finish').isEnabled(), true); await p.locator('#finish').click();
      while(await p.locator('#coverage-continue').isVisible())await p.locator('#coverage-continue').click();
      assert.equal(await p.locator('#complete-dialog').isVisible(), true); await p.locator('#analyze').click();
      assert.equal(await p.locator('#journal tr').count(), 10); await shot('evidence');
      if (width < 851) { await p.locator('[data-total-tab="matter"]').click(); assert.ok(await p.locator('[data-total="matter"]').isVisible()); }
      await p.getByRole('button', { name: '3 · Make sense' }).click();
      await p.locator('#q1').fill('Carbon started in the air.');
      await p.locator('#question-next').click();
      const panel = p.locator('#question-totals');
      assert.ok(await panel.isVisible());
      for (const group of ['systems','matter','energy']) {
        const values=await p.locator('#totals [data-total="'+group+'"] .total-line').evaluateAll(rows=>rows
          .map(row=>[row.firstChild.textContent,Number(row.lastChild.textContent)]).filter(([,count])=>count>0));
        const line=await panel.locator('dd').nth(['systems','matter','energy'].indexOf(group)).textContent();
        assert.equal(line,values.map(([label,count])=>label+': '+count).join(' · '));
      }
      await shot('question-totals');
      await p.locator('#question-next').click();
      await p.locator('#station-tour-select').selectOption('soil');
      assert.match(await p.locator('#station-tour-card').textContent(), /decomposer/);
      assert.match(await p.locator('#station-tour').textContent(), /not extra rolls/);
      await p.locator('#q3').fill('My carbon atom followed the official cards.');
      await shot('station-tour');
      await p.locator('#question-next').click();
      const readWork = () => p.evaluate(() => localStorage.getItem('aplab:openscied:b2-carbon-journey:v1'));
      const saved = await readWork();
      await p.getByText('Example journey for solo work', {exact:true}).click();
      assert.match(await p.locator('#q4').locator('..').innerText(), /Producers → Herbivores → Omnivores.*Atmosphere/s);
      assert.equal(await readWork(),saved,'the optional example does not modify student progress');
      assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await p.locator('#question-prev').click();
      await p.reload(); await p.getByRole('button', { name: '3 · Make sense' }).click();
      await p.locator('#question-next').click(); await p.locator('#question-next').click();
      assert.equal(await p.locator('#q3').inputValue(), 'My carbon atom followed the official cards.');
      assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      const dashboard = await ctx.newPage();
      await dashboard.goto(url.replace('openscied-b2-carbon-journey.html','openscied-dashboard.html'));
      const units = dashboard.locator('section.dashboard-unit[aria-labelledby^="unit"]');
      assert.deepEqual(await units.evaluateAll(sections=>sections.map(s=>s.getAttribute('aria-labelledby'))),
        ['unit1','unit2','unit3','unit4','unit5'], 'all five curriculum units remain visible in order');
      for (const unit of await units.all()) {
        const advertised = (await unit.locator('.dashboard-tag').first().textContent()).match(/^(\d+) activities? available$/);
        assert.ok(advertised, 'each unit advertises its activity count');
        assert.equal(await unit.locator('article.dashboard-activity').count(), Number(advertised[1]), 'visible count matches activity cards');
      }
      assert.deepEqual(await dashboard.locator('section[aria-labelledby="unit2"] .dashboard-open').evaluateAll(links=>links.map(link=>link.id)), [
        'b2-burn-open', 'b2-fires-open', 'peat-bog-open', 'carbon-journey-open'
      ], 'all Unit 2 activity links remain in the expected order');
      assert.match(await dashboard.locator('#carbon-journey-progress').textContent(),/10 rolls recorded/);
      await dashboard.screenshot({path:path.join(root,`artifacts/l9/${width}-dashboard.png`),fullPage:true});
      const resume = dashboard.locator('#carbon-journey-open');
      assert.equal(await resume.getAttribute('href'), 'openscied-b2-carbon-journey.html#sense');
      // Navigation alone can complete before deferred scripts restore the saved panel.
      await Promise.all([dashboard.waitForURL(new URL('openscied-b2-carbon-journey.html#sense', dashboard.url()).href), resume.click()]);
      await dashboard.locator('#sense').waitFor({state:'visible'});
      assert.ok(await dashboard.locator('#sense').isVisible());
      await dashboard.close();
      await p.locator('#legacy-report-tools > summary').click();
      const downloaded = p.waitForEvent('download'); await p.locator('#download').click(); const d = await downloaded;
      assert.match(d.suggestedFilename(), /carbon-atom-journey/);
      const payload = JSON.parse(await fs.promises.readFile(await d.path(), 'utf8'));
      assert.equal(payload.answers.q1, 'Carbon started in the air.');
      assert.equal(payload.rows[0].prediction, 'ocean');
      assert.equal(payload.rows[1].prediction, null);
      await p.locator('#restart').click(); await p.locator('#cancel-reset').click(); assert.equal(await p.locator('#q3').inputValue(), 'My carbon atom followed the official cards.');
      await p.locator('#restart').click(); await p.locator('#confirm-reset').click(); assert.equal(await p.locator('#roll').isEnabled(), true);
      assert.equal(await p.locator('#restart').isDisabled(), true);
      assert.deepEqual(errors, []); console.log('PASS', width, height, 'viewport fit, inspect, map, prediction, official cards, reload, 10 rolls, totals, question paging, download, resets'); await ctx.close();
    }
    const soilCtx = await browser.newContext({viewport:{width:390,height:844},colorScheme:'dark',reducedMotion:'reduce'});
    try {
      const p=await soilCtx.newPage();
      const state=Array.from({length:6},(_,i)=>Journey.die(1336800262,i)).reduce(
        (s,roll)=>Journey.record({...s,pending:roll}),Journey.initial(1336800262));
      await p.addInitScript(value=>localStorage.setItem('aplab:openscied:b2-carbon-journey:v1',JSON.stringify(value)),{...state,coverageCheckpoint:'repeat'});
      await p.goto(url);
      assert.equal(await p.locator('#roll').isVisible(),false);
      assert.match(await p.locator('#coverage-contrast').innerText(),/example, not your rolls/);
      assert.equal(await p.locator('#coverage-contrast-route').innerText(),'Producers → Herbivores → Omnivores → Atmosphere');
      assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
      await p.screenshot({path:path.join(root,'artifacts/l9/390-soil-streak-comparison.png'),fullPage:true});
      await p.locator('#coverage-continue').click();
      assert.equal(await p.locator('#roll').isVisible(),true);
      const saved=await p.evaluate(()=>JSON.parse(localStorage.getItem('aplab:openscied:b2-carbon-journey:v1')));
      assert.deepEqual(saved.rows,state.rows);
    } finally { await soilCtx.close(); }
    const auditCtx = await browser.newContext({viewport:{width:390,height:844},colorScheme:'dark',reducedMotion:'reduce'});
    try {
      const p = await auditCtx.newPage();
      const key='aplab:openscied:b2-carbon-journey:v1';
      await p.goto(url);
      await p.evaluate(key=>localStorage.setItem(key,JSON.stringify({version:2,seed:4177023592,rows:[],pending:null,answers:{q2:'Earlier first answer'},done:false})),key);
      await p.reload();
      for(let i=0;i<10;i++){
        await p.locator('#roll').click();
        await p.locator('#skip-prediction').click();
        await p.locator('#record').click();
        if(i===4){
          assert.equal(await p.locator('#coverage-continue').isVisible(),true);
          assert.equal(await p.locator('#roll').isVisible(),false);
          await p.reload();
          assert.equal(await p.locator('#coverage-continue').isVisible(),true,'reload does not bypass the card');
          await p.screenshot({path:path.join(root,'artifacts/l9/390-route-loop-checkpoint.png'),fullPage:true});
        }
        if(await p.locator('#coverage-continue').isVisible())await p.locator('#coverage-continue').click();
      }
      await p.locator('#finish').click();
      assert.match(await p.locator('#coverage-card').textContent(),/decomposer/);
      while(await p.locator('#coverage-continue').isVisible())await p.locator('#coverage-continue').click();
      await p.locator('#analyze').click();
      await p.getByRole('button',{name:'3 · Make sense'}).click();
      assert.equal(await p.locator('#q1').inputValue(),'Earlier first answer');
      await p.locator('#question-next').click();
      await p.locator('#question-next').click();
      for(const station of ['human','herbivores','omnivores','soil']){
        await p.locator('#station-tour-select').selectOption(station);
        assert.match(await p.locator('#station-tour-status').textContent(),/not in your (journey|rolls)/);
      }
      await p.getByRole('button',{name:'Carbon & Energy Budget',exact:true}).click();
      await p.locator('#cb-prediction').fill('There will be more carbon in the air.');
      await p.locator('#cb-start').click();
      while(await p.locator('#cb-next').isVisible()&&await p.locator('#cb-next').isEnabled()) await p.locator('#cb-next').click();
      await p.locator('#cb-explanation').fill('Four units moved from peat to the air.');
      await p.getByRole('button',{name:'3 · Make sense'}).click();
      await p.reload();
      await p.locator('#legacy-report-tools > summary').click();
      const downloaded=p.waitForEvent('download');
      await p.locator('#download').click();
      const d=await downloaded, payload=JSON.parse(await fs.promises.readFile(await d.path(),'utf8'));
      assert.deepEqual(payload.rows.map(row=>row.die),[6,6,5,6,5,5,6,3,4,6]);
      assert.equal(payload.done,true);
      assert.deepEqual(payload.referenceCardsReviewed.map(row=>row.from),['ocean','human','herbivores','omnivores','soil']);
      assert.equal(payload.budget.checkpoints.length,9);
      assert.equal(payload.budget.explanation,'Four units moved from peat to the air.');
      console.log('PASS looping audit seed, support separate from journey, old answers, full Budget after reload without reopening Budget');
    } finally { await auditCtx.close(); }
    const protectedCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    try {
      const page = await protectedCtx.newPage();
      const dashboardUrl = url.replace('openscied-b2-carbon-journey.html', 'openscied-dashboard.html');
      const key = 'aplab:openscied:b2-carbon-journey:v1';
      const unsupported = ' {"version":99,"seed":17,"rows":[],"answers":{"q4":"Fictional answer to keep."}} ';
      for (const [raw, viaDashboard] of [[unsupported, true], ['{unfinished fictional save', false]]) {
        await page.goto(dashboardUrl);
        await page.evaluate(([key, raw]) => localStorage.setItem(key, raw), [key, raw]);
        if (viaDashboard) {
          await page.reload();
          assert.match(await page.locator('#carbon-journey-progress').textContent(), /could not be read/);
          await page.locator('#carbon-journey-open').click();
        } else await page.goto(url);
        const readRaw = () => page.evaluate(key => localStorage.getItem(key), key);
        assert.equal(await readRaw(), raw);
        // A navigation click can resolve before the controller hydrates protected saved work.
        await page.waitForFunction(() => document.querySelector('#roll')?.disabled &&
          document.querySelector('#card-instruction')?.textContent.includes('Open Your evidence'));
        assert.ok(await page.locator('#roll').isDisabled());
        assert.match(await page.locator('#card-instruction').textContent(), /Open Your evidence/);
        await page.locator('[data-page="evidence"]').click();
        await page.reload();
        assert.equal(await readRaw(), raw);
        const downloaded = page.waitForEvent('download');
        await page.getByRole('button', { name: 'Download saved backup' }).click();
        const backup = await downloaded;
        assert.match(backup.suggestedFilename(), /saved-backup/);
        assert.equal(fs.readFileSync(await backup.path(), 'utf8'), raw);
        await page.locator('#restart').click();
        await page.locator('#cancel-reset').click();
        assert.equal(await readRaw(), raw);
        await page.locator('#restart').click();
        await page.locator('#confirm-reset').click();
        assert.equal(JSON.parse(await readRaw()).version, 3);
        assert.equal(JSON.parse(await readRaw()).lastSection, 'play');
      }
      console.log('PASS unreadable work stays downloadable and cannot be overwritten before confirmed restart');
    } finally { await protectedCtx.close(); }
    const multiCtx = await browser.newContext({viewport:{width:1366,height:768},reducedMotion:'reduce'});
    try {
      const writer=await multiCtx.newPage(), stale=await multiCtx.newPage(), dash=await multiCtx.newPage();
      const keys=['aplab:openscied:b2-carbon-journey:v1','aplab:openscied:b2-carbon-journey:budget:v1'];
      await writer.goto(url);
      await writer.evaluate(key=>localStorage.setItem(key,JSON.stringify({
        v:1, position:-1, furthest:-1, prediction:'Earlier test budget', explanation:''
      })),keys[1]);
      await writer.reload();
      const recordTurn=async()=>{
        await writer.locator('#roll').click();await writer.locator('#skip-prediction').click();await writer.locator('#record').click();
      };
      await recordTurn();
      await stale.goto(url);
      await recordTurn();
      await writer.getByRole('button',{name:'Carbon & Energy Budget',exact:true}).click();
      await writer.locator('#cb-prediction').fill('This test budget is only on this device.');
      await stale.locator('[data-page="evidence"]').click();
      const read=p=>p.evaluate(([journey,budget])=>[localStorage.getItem(journey),localStorage.getItem(budget)],keys);
      assert.equal(JSON.parse((await read(stale))[0]).rows.length,2);
      await dash.goto(url.replace('openscied-b2-carbon-journey.html','openscied-dashboard.html'));
      assert.match(await dash.locator('#carbon-journey-progress').textContent(),/2 rolls recorded/);
      await dash.locator('#clear-openscied-results').click();
      await dash.locator('#openscied-erase-confirmation').fill('ERASE');
      await dash.locator('#confirm-openscied-clear').click();
      assert.equal(await dash.locator('#openscied-resume').isVisible(),false);
      await stale.locator('[data-page="sense"]').click();
      assert.match(await stale.locator('#journey-save-conflict').textContent(),/cleared in another tab/);
      await writer.locator('#cb-prediction').fill('This late edit is not stored.');
      assert.match(await writer.locator('#cb-save-status').textContent(),/cleared in another tab/);
      assert.deepEqual(await read(dash),[null,null]);
      assert.equal(await dash.locator('#openscied-resume').isVisible(),false);
      // Budget has its own export; the combined download is under Journey/Evidence.
      await writer.locator('[data-page="evidence"]').click();
      assert.deepEqual(await read(dash),[null,null],'leaving Budget also cannot recreate erased work');
      const backups=writer.locator('#legacy-report-tools');
      if (!await backups.evaluate(el=>el.open)) await backups.locator('summary').click();
      const combined=writer.locator('#download');
      assert.equal(await combined.isVisible(),true);
      const [download]=await Promise.all([writer.waitForEvent('download'),combined.click()]);
      const payload=JSON.parse(fs.readFileSync(await download.path(),'utf8'));
      assert.equal(payload.rows.length,2);
      assert.equal(payload.budget.prediction,'This late edit is not stored.');
      await writer.reload();
      await writer.locator('[data-page="play"]').click();
      await writer.locator('#roll').click();
      assert.ok(JSON.parse((await read(writer))[0]).pending);
      console.log('PASS same-origin tabs: stale Journey cannot rewind current progress; dashboard ERASE stays erased; Budget download still works');
    } finally { await multiCtx.close(); }

  } finally { if (browser) await browser.close(); await new Promise(r => server.close(r)); }
})().catch(e => { console.error(e); process.exitCode = 1; });
