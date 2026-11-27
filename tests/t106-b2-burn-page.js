/* Burning Fuels companion (OpenSciEd B.2 Lesson 2): page load, attribution, 8 sections, writing and word budget (at most 1,100 visible words),
   safety and "simulated" labels, dropdown and tap feedback, predictions checked against the student's own table, claim check against the data,
   saving and Resume, download labeled simulated, Clear dialog, phone layout.
   Run: NODE_PATH=$(npm root -g) node tests/t106-b2-burn-page.js */
const T = require('./_h');
const fs = require('fs');
const PAGE = 'openscied-b2-burn-lab.html', KEY = 'aplab:openscied:b2-burn-lab:v1';
const stub = pg => pg.route(/gc\.zgo\.at|fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, contentType: /gc\.zgo\.at/.test(r.request().url()) ? 'application/javascript' : 'text/css', body: '' }));
const SECTIONS = ['overview', 'ideas', 'fuels', 'burn', 'sense', 'sort', 'peat', 'wrapup'];
const go = async (p, id) => { await p.evaluate(h => { location.hash = h; }, id); await p.waitForFunction(h => document.querySelector('#' + h + '.is-current'), id); };
const fb = (p, id) => p.locator('#feedback-' + id).innerText();
const ALL = ['grass', 'leaves', 'wood', 'charcoal', 'peat'];
(async () => {
  const browser = await T.launch();
  const server = await T.serve();
  try {
    const ctx = await T.ctxFor(browser, { width: 1366, height: 900 });
    const p = await ctx.newPage();
    const problems = [];
    p.on('console', m => { if (m.type() === 'error') problems.push('console: ' + m.text()); });
    p.on('pageerror', e => problems.push('pageerror: ' + e.message));
    p.on('requestfailed', r => { if (!/goatcounter|gc\.zgo\.at|fonts\.g/.test(r.url())) problems.push('requestfailed: ' + r.url()); });
    p.on('response', r => { if (r.status() >= 400 && !/goatcounter|gc\.zgo\.at|fonts\.g/.test(r.url())) problems.push('http ' + r.status() + ': ' + r.url()); });
    await stub(p);
    await p.goto(server.url + PAGE);
    await p.waitForFunction(() => window.B2Burn && document.querySelector('.step.is-current'));
    T.ok(problems.length === 0, 'page loads without console errors or failed requests ' + problems.join(' | '));
    const title = await p.title();
    T.ok(/^Burning Fuels: What Burns and Why/.test(title) && !/^OpenSciEd/i.test(title) && /companion for OpenSciEd Biology B\.2/.test(title), 'title does not lead with the OpenSciEd mark: ' + title);
    T.ok(await p.locator('h1').innerText() === 'Burning Fuels: What Burns and Why', 'visible title');
    T.ok(await p.locator('script[type="application/ld+json"]').count() === 1, 'JSON-LD present');
    const foot = await p.locator('.site-footer').innerText();
    T.ok(/^Created by Robert Smitka\./.test(foot), 'footer starts "Created by Robert Smitka."');
    T.ok(/Lesson 2 of OpenSciEd Biology Unit B\.2: Ecosystems Matter & Energy: Fires \(OpenSciEd Unit B\.2\)/.test(foot), 'footer credits Unit B.2 Lesson 2');
    T.ok(await p.locator('.site-footer a[href="https://creativecommons.org/licenses/by-nc/4.0/"]').count() === 1 && await p.locator('.site-footer a[href="https://www.openscied.org/"]').count() >= 1, 'footer links CC BY-NC 4.0 and openscied.org');
    T.ok(/Adapted and reorganized as an interactive web companion with simulated data/.test(foot) && /Not affiliated with, endorsed by, or sponsored by OpenSciEd/.test(foot), 'footer states what changed and the non-endorsement');
    T.ok(/counts page visits without cookies/.test(foot) && /Student names and answers stay in this browser unless you choose to share them/.test(foot) && !/GoatCounter/i.test(foot), 'plain privacy line');
    T.ok(await p.locator('script[data-goatcounter]').count() === 1, 'one page-visit tracker remains');
    T.ok(await p.locator('.attribution a[href="https://creativecommons.org/licenses/by-nc/4.0/"]').count() === 1, 'attribution block links the license');

    T.ok(await p.locator('.step-nav a[href^="#"]').count() === 8 && await p.locator('main > section.step').count() === 8, 'eight sections in the nav and the page');
    for (const id of SECTIONS) await go(p, id);
    await p.locator('.step-nav a[href="#ideas"]').click();
    await p.waitForFunction(() => document.querySelector('#ideas.is-current'));
    await p.locator('#ideas .pager-next').click();
    await p.waitForFunction(() => document.querySelector('#fuels.is-current'));
    T.ok(await p.locator('[aria-live], [role=status], [role=alert]').count() === 1, 'exactly one live region');
    T.ok(await p.locator('a[href="openscied-b2-fires.html"]').count() >= 1 && await p.locator('a[href="openscied-b2-peat-bog-lab.html"]').count() >= 1, 'links to the other Unit B.2 pages');

    // writing budget: three short text boxes; word budget
    const boxes = await p.evaluate(() => Array.from(document.querySelectorAll('main textarea, main input[type=text]')).map(t => t.id + ':' + t.maxLength));
    T.ok(boxes.length === 3 && boxes.every(b => /:240$/.test(b)), 'exactly three short text boxes (limit 240): ' + boxes.join(','));
    const sels = await p.locator('main select').count();
    T.ok(sels >= 15, 'answers are mostly dropdowns: ' + sels + ' selects');
    const wordsBy = await p.evaluate(() => Object.fromEntries(Array.from(document.querySelectorAll('main > section.step')).map(s => {
      const c = s.cloneNode(true);
      c.querySelectorAll('.scene-host, .attribution, .pager, script, #investigation-report, details:not([open]) > :not(summary)').forEach(n => n.remove());
      c.querySelectorAll('select').forEach(sel => { const o = sel.querySelector('option'); sel.replaceChildren(); if (o) sel.appendChild(o); });
      return [s.id, (c.textContent.match(/\S+/g) || []).length];
    })));
    const total = Object.values(wordsBy).reduce((a, b) => a + b, 0);
    console.log('  words by section: ' + JSON.stringify(wordsBy) + ' total ' + total);
    T.ok(total <= 1100, 'visible text (no scene, attribution, hidden details; dropdown options not counted beyond the first) stays within the 1,100-word budget: ' + total + ' words');

    // labeling: simulated and safety
    const body = await p.locator('main').textContent();
    T.ok(/not equal \(4 g to 30 g\)/.test(body) && /lost/.test(body), 'the page says the handfuls are not equal and to compare grams lost');
    T.ok(/replaces nothing/.test(body) && /15 feet back/.test(body) && /Never burn materials at home/.test(body) && /goggles/.test(body) && /fresh air/.test(body), 'safety note: virtual, replaces nothing, 15 feet, goggles, fresh air, never at home');
    T.ok(/dome gets hot/.test(body) && /tongs and heat-safe surfaces/.test(body), 'safety note: the dome gets hot, a real lab uses tongs and heat-safe surfaces');
    T.ok(/glass dome/.test(await p.locator('#fuels-background').innerText()) && /dish of BTB sits inside the dome/.test(await p.locator('#fuels-background').innerText()) && /laser thermometer/.test(await p.locator('#fuels-background').innerText()) && /balance/.test(await p.locator('#fuels-background').innerText()), 'Background card shows the real setup: fuel, dome, BTB dish, laser thermometer, balance');
    T.ok(!/flask|held above the flame/i.test(await p.content()), 'the word flask (and "held above the flame") appears nowhere on the page');
    T.ok((body.match(/SIMULATED/g) || []).length >= 1 && await p.locator('details.teacher-note').count() === 1, 'simulated tag and a collapsible teacher note');
    T.ok(await p.locator('.background').count() >= 3 && await p.evaluate(() => Array.from(document.querySelectorAll('.background')).every(b => b.querySelectorAll('li').length <= 5 && b.querySelectorAll('input, select, textarea').length === 0)), 'Background cards have 5 or fewer bullets and no inputs');
    T.ok(await p.locator('.fuel-card').count() === 5 && await p.evaluate(() => Array.from(document.querySelectorAll('.fuel-card')).every(c => c.querySelectorAll('input, select, textarea').length === 0)), 'five fuel cards, no inputs');

    // tap and dropdown feedback
    await go(p, 'ideas');
    await p.check('input[name="poll-peat"][value="a"]');
    T.ok(/Good noticing/.test(await fb(p, 'poll-peat')), 'poll gives a reply, not a grade');
    await go(p, 'sense');
    await p.selectOption('#sense-btb', 'o2');
    T.ok(/^Try again\. Why not/.test(await fb(p, 'sense-btb')), 'wrong BTB answer has a reason');
    await p.selectOption('#sense-btb', 'co2');
    T.ok(/^Yes\./.test(await fb(p, 'sense-btb')) && await p.locator('#feedback-sense-btb').getAttribute('data-state') === 'correct', 'right BTB answer is marked');
    await p.selectOption('#sense-mass', 'vanish');
    T.ok(/^Try again/.test(await fb(p, 'sense-mass')), 'matter does not vanish');
    await p.selectOption('#sense-energy', 'heat'); await p.selectOption('#sense-slowest', 'dense');
    T.ok(/^Yes/.test(await fb(p, 'sense-energy')) && /^Yes/.test(await fb(p, 'sense-slowest')), 'energy and slowest rows');
    await p.selectOption('#sense-yellowest', 'peat');
    T.ok(/Burn and record at least two fuels/.test(await fb(p, 'sense-yellowest')), 'data row waits for data');
    await go(p, 'sort');
    await p.check('input[name="me-heat"][value="matter"]');
    T.ok(/^Try again\. Why not/.test(await fb(p, 'me-heat')), 'heat is not matter');
    await p.check('input[name="me-heat"][value="energy"]');
    T.ok(/^Yes\./.test(await fb(p, 'me-heat')) && await p.locator('#feedback-me-heat').getAttribute('data-state') === 'correct', 'heat is energy');
    await p.check('input[name="me-peat"][value="both"]'); await p.check('input[name="me-co2"][value="matter"]');
    T.ok(await p.locator('.me-item').count() === 7 && /^Yes/.test(await fb(p, 'me-peat')) && /^Yes/.test(await fb(p, 'me-co2')), 'seven sort items with feedback inside each card');
    await go(p, 'peat');
    await p.selectOption('#peat-fire', 'fast');
    T.ok(/^Try again/.test(await fb(p, 'peat-fire')), 'smoldering fire row');
    await p.selectOption('#peat-fire', 'slow');

    // predictions and claim check: nothing recorded yet
    await go(p, 'fuels');
    await p.selectOption('#pred-peat-ignite', 'slowly'); await p.selectOption('#pred-peat-energy', 'more'); await p.selectOption('#pred-grass-ignite', 'slowly');
    T.ok(/Burn and record peat to check/.test(await fb(p, 'pred-peat')) && await p.locator('#feedback-pred-peat').getAttribute('data-state') === 'partial', 'predictions wait for data');
    await go(p, 'peat');
    await p.check('input[name="cer-claim"][value="a"]');
    T.ok((await Promise.all([1, 2, 3, 4].map(i => p.locator('#cer-ev-' + i).isDisabled()))).every(Boolean) &&
      /Burn and record peat and at least one other fuel/.test(await p.locator('#cer-model-note').innerText()), 'missing data is explained and cannot be cited');
    T.ok(await p.locator('#cer-level').getAttribute('data-level') === 'foundational', 'level is foundational without data-backed evidence');

    // inject honest data through the scene API and watch everything derived recompute
    await p.evaluate(a => {
      const seed = B2Burn.seed('check');
      B2Burn.saveState('burn', { seed, fuel: 'peat', current: null, records: a.map(fuel => ({ fuel, n: 1, obs: [] })) });
    }, ALL);
    for (const i of [1, 2, 3, 4]) await p.check('#cer-ev-' + i);
    T.ok(/^✓ Your data show this: Most mass lost: Peat \(2\d\.\d g\)/.test(await p.locator('#cer-ev-1-note').innerText()), 'peat lost the most mass, verified and named: ' + await p.locator('#cer-ev-1-note').innerText());
    T.ok(/^✓ Your data show this: Biggest BTB change: Peat \(\+3\.\d\)/.test(await p.locator('#cer-ev-2-note').innerText()), 'peat made the biggest BTB change, verified: ' + await p.locator('#cer-ev-2-note').innerText());
    T.ok(/^✓ Your data show this: Temperature rose the most: Peat/.test(await p.locator('#cer-ev-3-note').innerText()) && /^✓ Your data show this: Longest burn: Peat/.test(await p.locator('#cer-ev-4-note').innerText()), 'peat warmest and longest burn verified');
    await p.check('#cer-ev-5'); await p.check('input[name="cer-reason"][value="a"]'); await p.check('#cer-caveat');
    T.ok(await p.locator('#cer-level').getAttribute('data-level') === 'organized', 'organized with data-backed evidence');
    // a statement the data do not show loses credit when the data change: drop peat from the table
    await p.evaluate(() => { const s = B2Burn.getState().burn; s.records = s.records.filter(r => r.fuel !== 'peat'); B2Burn.saveState('burn', s); });
    T.ok(/^Burn and record peat/.test(await p.locator('#cer-ev-1-note').innerText()) && /^Burn and record peat/.test(await p.locator('#cer-ev-3-note').innerText()), 'peat claims lose their mark when peat leaves the table');
    await p.evaluate(() => { const s = B2Burn.getState().burn; s.records = []; B2Burn.saveState('burn', s); });
    T.ok(await p.locator('#cer-level').getAttribute('data-level') !== 'organized', 'level drops when the table empties');
    await p.evaluate(a => { const s = B2Burn.getState().burn; s.records = a.map(fuel => ({ fuel, n: 1, obs: [] })); B2Burn.saveState('burn', s); }, ALL);
    await go(p, 'fuels');
    const peatFb = (await fb(p, 'pred-peat')).split('\n')[0], grassFb = await fb(p, 'pred-grass');
    T.ok(/^Yes\. In your data peat caught fire after \d+ s/.test(peatFb) && /^Not quite\. In your data dried grass caught fire after \d s, which is quick/.test(grassFb), 'predictions are checked against the table: ' + peatFb + ' / ' + grassFb);
    T.ok(/warmed up \d\d\.\d °C, more than the others/.test(await fb(p, 'pred-peat')), 'peat predicted to give more energy: checked against the table');
    await go(p, 'sense');
    await p.selectOption('#sense-yellowest', 'charcoal');
    T.ok(/^Try again/.test(await fb(p, 'sense-yellowest')) && /Peat/.test(await fb(p, 'sense-yellowest')), 'yellowest row names the right fuel');
    await p.selectOption('#sense-lostmost', 'wood');
    T.ok(/^Try again/.test(await fb(p, 'sense-lostmost')) && /Peat lost the most mass/.test(await fb(p, 'sense-lostmost')), 'lost-the-most row names the right fuel: ' + await fb(p, 'sense-lostmost'));
    await p.selectOption('#sense-yellowest', 'peat'); await p.selectOption('#sense-warmest', 'peat'); await p.selectOption('#sense-lostmost', 'peat');
    T.ok(/^Yes/.test(await fb(p, 'sense-yellowest')) && /^Yes/.test(await fb(p, 'sense-warmest')) && /^Yes/.test(await fb(p, 'sense-lostmost')), 'data rows verified');
    await p.selectOption('#sense-dish', 'cool');
    T.ok(/^Try again\. Why not/.test(await fb(p, 'sense-dish')), 'the BTB dish is not there to keep it cool'); await p.selectOption('#sense-dish', 'reach');
    T.ok(/^Yes\. The carbon dioxide from the fire collects under the dome/.test(await fb(p, 'sense-dish')) && /INSIDE the dome/.test(await p.locator('label[for="sense-dish"]').innerText()), 'dish INSIDE the dome so the carbon dioxide reaches it');
    await p.selectOption('#sense-water', 'air');
    T.ok(/^Try again/.test(await fb(p, 'sense-water')), 'droplet water is not from the air'); await p.selectOption('#sense-water', 'hydrogen');
    T.ok(/^Yes\. Fuels contain hydrogen/.test(await fb(p, 'sense-water')), 'droplet water comes from hydrogen in the fuel');
    await p.selectOption('#sense-massbtb', 'less');
    T.ok(/^Try again/.test(await fb(p, 'sense-massbtb')), 'more mass lost is more carbon dioxide'); await p.selectOption('#sense-massbtb', 'more');
    T.ok(/^Yes\. Mass lost leaves as gas/.test(await fb(p, 'sense-massbtb')) && /carbon dioxide and water vapor/.test(await p.locator('#sense-mass').evaluate(e => e.textContent)), 'mass and BTB link, mass leaves as carbon dioxide and water vapor');

    // saving, Resume, download, clear
    await go(p, 'wrapup');
    await p.fill('#wrap-sentence', 'Peat burns so much because it holds lots of plant carbon.');
    await p.waitForTimeout(200);
    const saved = await p.evaluate(k => JSON.parse(localStorage.getItem(k)), KEY);
    T.ok(saved.v === 1 && saved.burn.seed && saved.burn.records.length === 5 && saved.fields['wrap-sentence'] && saved.responseIds.includes('sense-btb') && saved.responseIds.includes('wrap-sentence') && saved.responseIds.includes('cer-claim') && saved.responseIds.includes('me-heat'), 'one saved record with the burn, fields and response ids');
    T.ok(saved.responseIds.every(id => !/^(bn-)/.test(id)), 'scene controls are not page fields');
    await p.locator('#legacy-report-tools > summary').click();
    const [dl] = await Promise.all([p.waitForEvent('download'), p.locator('#download-work').click()]);
    const payload = JSON.parse(fs.readFileSync(await dl.path(), 'utf8'));
    T.ok(payload.format === 'openscied-b2-burn-progress-v1' && /SIMULATED/.test(payload.dataNote) && payload.simulatedData.burns.length === 5 && payload.dropdowns.length >= 15 && payload.student && payload.student.name === 'Test Student', 'download is labeled simulated and carries the data');
    const peat = payload.simulatedData.burns.find(b => b.fuel === 'peat');
    T.ok(peat && peat.massAfterG < peat.massBeforeG && peat.btbAfter > peat.btbBefore && typeof peat.btbAfterColor === 'string' && peat.temperatureAfterC >= peat.temperatureBeforeC, 'download numbers are possible');
    const rep = await p.locator('#investigation-report').innerText();
    T.ok(/Simulated burn results/.test(rep) && /SIMULATED/.test(rep), 'report shows simulated data');
    await p.reload();
    await p.waitForFunction(() => window.B2Burn && document.querySelector('.step.is-current'));
    await go(p, 'peat');
    T.ok(await p.isChecked('input[name="cer-claim"][value="a"]') && await p.locator('#cer-level').getAttribute('data-level') === 'organized', 'picks and the data-based level survive a reload');
    await go(p, 'sense');
    T.ok(await p.inputValue('#sense-btb') === 'co2' && /^Yes/.test(await fb(p, 'sense-btb')) && /^Yes/.test(await fb(p, 'sense-warmest')), 'dropdowns and data feedback survive a reload');
    await go(p, 'wrapup');
    await p.locator('#reset-work').click();
    T.ok(await p.locator('#reset-dialog').evaluate(d => d.open), 'Clear dialog opens');
    await p.locator('#cancel-reset').click();
    T.ok(await p.evaluate(k => !!localStorage.getItem(k), KEY), 'Cancel keeps the work');
    await p.locator('#reset-work').click();
    await Promise.all([p.waitForNavigation(), p.locator('#confirm-reset').click()]);
    await p.waitForFunction(() => window.B2Burn && document.querySelector('.step.is-current'));
    T.ok(await p.evaluate(k => localStorage.getItem(k), KEY) === null, 'Clear removes the activity record and a fresh load does not re-save it');
    T.ok(await p.evaluate(() => !!localStorage.getItem('aplab:student')), 'name and class period stay saved');
    await p.close(); await ctx.close();

    for (const [w, h, dark] of [[390, 844, true], [1366, 900, false]]) {
      const c = await T.ctxFor(browser, { width: w, height: h, dark });
      const q = await c.newPage();
      await stub(q);
      await q.goto(server.url + PAGE);
      await q.waitForFunction(() => document.querySelector('.step.is-current'));
      const bad = [];
      for (const id of SECTIONS) {
        await go(q, id);
        const over = await q.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        if (over > 0) bad.push(id + ' +' + over);
        const small = await q.evaluate(() => Array.from(document.querySelectorAll('.step.is-current button, .step.is-current a.btn, .step.is-current select, .step.is-current input[type=checkbox], .step.is-current input[type=radio]')).filter(e => { const r = e.getBoundingClientRect(); return r.width && r.height && (r.width < 24 || r.height < 24); }).length);
        if (small) bad.push(id + ' has ' + small + ' small controls');
      }
      T.ok(bad.length === 0, w + ' px: no sideways scroll and controls at least 24 px ' + bad.join(', '));
      await c.close();
    }
  } finally { await browser.close(); server.close(); }
  T.done('t106-b2-burn-page');
})().catch(e => { console.error(e); process.exit(1); });
