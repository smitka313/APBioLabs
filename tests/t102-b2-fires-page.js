/* Fires: Peat, Decomposition and Earth's Tilt companion (OpenSciEd B.2 Lessons 3 and 5): page load, attribution, 11 sections, writing and
   word budget, safety and "simulated" labels, dropdown and tap feedback, hypothesis builder, claim check against the student's own data,
   saving and Resume, download labeled simulated, Clear dialog, layouts.
   Run: NODE_PATH=$(npm root -g) node tests/t102-b2-fires-page.js */
const T = require('./_h');
const fs = require('fs');
const PAGE = 'openscied-b2-fires.html', KEY = 'aplab:openscied:b2-fires:v1';
const stub = pg => pg.route(/gc\.zgo\.at|fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, contentType: /gc\.zgo\.at/.test(r.request().url()) ? 'application/javascript' : 'text/css', body: '' }));
const SECTIONS = ['overview', 'ideas', 'plan', 'yeast', 'cards', 'sense3', 'hypothesis', 'tilt', 'sense5', 'peat', 'wrapup'];
const go = async (p, id) => { await p.evaluate(h => { location.hash = h; }, id); await p.waitForFunction(h => document.querySelector('#' + h + '.is-current'), id); };
const fb = (p, id) => p.locator('#feedback-' + id).innerText();
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
    await p.waitForFunction(() => window.B2Fires && document.querySelector('.step.is-current'));
    T.ok(problems.length === 0, 'page loads without console errors or failed requests ' + problems.join(' | '));
    const title = await p.title();
    T.ok(/^Fires: Peat, Decomposition and Earth’s Tilt/.test(title) && !/^OpenSciEd/i.test(title) && /companion for OpenSciEd Biology B\.2/.test(title), 'title does not lead with the OpenSciEd mark: ' + title);
    T.ok(await p.locator('h1').innerText() === 'Fires: Peat, Decomposition and Earth’s Tilt', 'visible title');
    T.ok(await p.locator('script[type="application/ld+json"]').count() === 1, 'JSON-LD present');
    const foot = await p.locator('.site-footer').innerText();
    T.ok(/^Created by Robert Smitka\./.test(foot), 'footer starts "Created by Robert Smitka."');
    T.ok(/Lessons 3 and 5 of OpenSciEd Biology Unit B\.2: Ecosystems Matter & Energy: Fires \(OpenSciEd Unit B\.2\)/.test(foot), 'footer credits Unit B.2 Lessons 3 and 5');
    T.ok(await p.locator('.site-footer a[href="https://creativecommons.org/licenses/by-nc/4.0/"]').count() === 1 && await p.locator('.site-footer a[href="https://www.openscied.org/"]').count() >= 1, 'footer links CC BY-NC 4.0 and openscied.org');
    T.ok(/Adapted and reorganized as an interactive web companion with simulated data/.test(foot) && /Not affiliated with, endorsed by, or sponsored by OpenSciEd/.test(foot), 'footer states what changed and the non-endorsement');
    T.ok(/GoatCounter/.test(foot) && /Nothing you type/.test(foot), 'privacy line');
    T.ok(await p.locator('.attribution a[href="https://creativecommons.org/licenses/by-nc/4.0/"]').count() === 1, 'attribution block links the license');

    T.ok(await p.locator('.step-nav a[href^="#"]').count() === 11 && await p.locator('main > section.step').count() === 11, 'eleven sections in the nav and the page');
    for (const id of SECTIONS) await go(p, id);
    await p.locator('.step-nav a[href="#ideas"]').click();
    await p.waitForFunction(() => document.querySelector('#ideas.is-current'));
    await p.locator('#ideas .pager-next').click();
    await p.waitForFunction(() => document.querySelector('#plan.is-current'));
    T.ok(await p.locator('[aria-live], [role=status], [role=alert]').count() === 1, 'exactly one live region');

    // writing budget: three short text boxes; word budget
    const boxes = await p.evaluate(() => Array.from(document.querySelectorAll('main textarea, main input[type=text]')).map(t => t.id + ':' + t.maxLength));
    T.ok(boxes.length === 3 && boxes.every(b => /:240$/.test(b)), 'exactly three short text boxes (limit 240): ' + boxes.join(','));
    const sels = await p.locator('main select').count();
    T.ok(sels >= 25, 'answers are mostly dropdowns: ' + sels + ' selects');
    const wordsBy = await p.evaluate(() => Object.fromEntries(Array.from(document.querySelectorAll('main > section.step')).map(s => {
      const c = s.cloneNode(true);
      c.querySelectorAll('.scene-host, .attribution, .pager, script, .your-data, #investigation-report, details:not([open]) > :not(summary)').forEach(n => n.remove());
      c.querySelectorAll('select').forEach(sel => { const o = sel.querySelector('option'); sel.replaceChildren(); if (o) sel.appendChild(o); });
      return [s.id, (c.textContent.match(/\S+/g) || []).length];
    })));
    const total = Object.values(wordsBy).reduce((a, b) => a + b, 0);
    console.log('  words by section: ' + JSON.stringify(wordsBy) + ' total ' + total);
    T.ok(total <= 1400, 'visible text (no scenes, attribution, hidden details; dropdown options not counted beyond the first) stays light: ' + total + ' words');

    // labeling: simulated and safety
    const body = await p.locator('main').textContent();
    T.ok(/replace the real yeast, BTB and lamp work/.test(body) && /goggles, apron, gloves/.test(body), 'safety note: replaces no wet lab');
    T.ok((body.match(/SIMULATED/g) || []).length >= 2, 'simulated tag on both scenes');
    T.ok(await p.locator('details.teacher-note').count() === 1, 'collapsible teacher note');
    T.ok(await p.locator('.background').count() >= 5 && await p.evaluate(() => Array.from(document.querySelectorAll('.background')).every(b => b.querySelectorAll('li').length <= 5 && b.querySelectorAll('input, select, textarea').length === 0)), 'Background cards have 5 or fewer bullets and no inputs');

    // tap and dropdown feedback
    await go(p, 'ideas');
    await p.check('input[name="poll-peat"][value="a"]');
    T.ok(/test how temperature/.test(await fb(p, 'poll-peat')), 'poll gives a reply, not a grade');
    await go(p, 'plan');
    await p.selectOption('#plan-iv', 'sugar');
    T.ok(/^Try again\. Why not/.test(await fb(p, 'plan-iv')), 'wrong variable has a reason');
    await p.selectOption('#plan-iv', 'temp');
    T.ok(/^Yes\./.test(await fb(p, 'plan-iv')) && await p.locator('#feedback-plan-iv').getAttribute('data-state') === 'correct', 'right variable is marked');
    await p.selectOption('#plan-dv', 'foam');
    for (const k of ['a', 'b', 'c', 'e']) await p.check('#ctrl-yeast-' + k);
    T.ok(/^Try again/.test(await fb(p, 'ctrl-yeast')), 'the changed variable is not a control');
    await p.uncheck('#ctrl-yeast-e'); await p.check('#ctrl-yeast-d');
    T.ok(/^Yes\./.test(await fb(p, 'ctrl-yeast')), 'controls chips correct');
    await go(p, 'cards');
    await p.selectOption('#cards-rate-hot', 'slower');
    T.ok(/^Try again\. Why not/.test(await fb(p, 'cards-rate-hot')), 'rate row wrong has a reason');
    await p.selectOption('#cards-rate-hot', 'faster');
    T.ok(/^Yes\./.test(await fb(p, 'cards-rate-hot')), 'rate row right');
    await go(p, 'sense3');
    await p.selectOption('#sense-amount', 'more'); await p.selectOption('#sense-temp', 'lower');
    T.ok(/^Try again/.test(await fb(p, 'sugar')), 'More/lower is wrong');
    await p.selectOption('#sense-temp', 'higher');
    T.ok(/^Yes\./.test(await fb(p, 'sugar')), 'More/higher is right');
    await p.check('input[name="sense-account"][value="a"]');
    T.ok(/^Try again/.test(await fb(p, 'sense-account')), 'carbon dioxide is not everything');
    await p.selectOption('#sense-past', 'cold'); await p.selectOption('#sense-present', 'warm'); await p.selectOption('#sense-future', 'room');
    T.ok(/^Yes/.test(await fb(p, 'sense-past')) && /^Yes/.test(await fb(p, 'sense-present')) && /^Close/.test(await fb(p, 'sense-future')), 'past, present, future rows');
    await go(p, 'hypothesis');
    await p.selectOption('#hyp-light', 'more'); await p.selectOption('#hyp-co2', 'less'); await p.selectOption('#hyp-why', 'energy');
    T.ok(await p.locator('#feedback-hyp').getAttribute('data-state') === 'wrong', 'more light, less carbon dioxide is not the hypothesis');
    await p.selectOption('#hyp-co2', 'more');
    T.ok(await p.locator('#feedback-hyp').getAttribute('data-state') === 'correct' && /directional hypothesis/.test(await fb(p, 'hyp')), 'directional hypothesis accepted');
    await p.selectOption('#hyp-why', 'warm');
    T.ok(await p.locator('#feedback-hyp').getAttribute('data-state') === 'partial', 'right direction, wrong reason');
    await p.selectOption('#hyp-why', 'energy');

    // data-based rows and claim check: nothing recorded yet
    await go(p, 'sense5');
    await p.selectOption('#sense-bluest', 'direct');
    T.ok(/Run the tilt test/.test(await fb(p, 'sense-bluest')), 'bluest-tube row waits for data');
    await go(p, 'peat');
    await p.check('input[name="cer-claim"][value="a"]');
    T.ok(await p.locator('#cer-ev-1').isDisabled() && await p.locator('#cer-ev-3').isDisabled() &&
      /Record a foam reading.*Read and record a direct-light and a foil comparison/.test(await p.locator('#cer-model-note').innerText()), 'missing model data is explained and cannot be cited');
    T.ok(await p.locator('#cer-level').getAttribute('data-level') === 'foundational', 'level is foundational with an unchecked evidence chip');

    // inject honest data through the scene API and watch every derived thing recompute
    await p.evaluate(() => {
      const seed = B2Fires.seed('check');
      B2Fires.saveState('decomp', { seed, startedAt: Date.now() - 1e6, skipped: true, temps: [18, 27, 43], recorded: [0, 2, 20] });
      B2Fires.saveState('tilt', { seed, startedAt: Date.now() - 1e6, skipped: true, settings: ['direct', 'tilt45', 'foil'], recorded: true, starchDone: false });
    });
    await p.check('#cer-ev-1'); await p.check('#cer-ev-3');
    T.ok(/^✓ Your data show this: Beaker 3 \(43 °C\) had the most foam/.test(await p.locator('#cer-ev-1-note').innerText()), 'warm evidence verified: ' + await p.locator('#cer-ev-1-note').innerText());
    T.ok(/^✓ Your data show this: Tube A/.test(await p.locator('#cer-ev-3-note').innerText()), 'direct bluest verified');
    await p.check('#cer-ev-4');
    T.ok(/Tube C/.test(await p.locator('#cer-ev-4-note').innerText()), 'foil yellowest verified');
    await p.check('#cer-ev-5'); await p.check('input[name="cer-reason"][value="a"]'); await p.check('#cer-caveat');
    T.ok(await p.locator('#cer-level').getAttribute('data-level') === 'organized', 'organized with data-backed evidence');
    // a statement the data do not show earns no credit and loses it when the data change
    await p.evaluate(() => { const s = B2Fires.getState().decomp; s.temps = [18, 27, 55]; B2Fires.saveState('decomp', s); });
    T.ok(/^✕ Your data do not show this/.test(await p.locator('#cer-ev-1-note').innerText()), 'a 55 C beaker makes the warmest-most-foam claim false');
    await p.evaluate(() => { const s = B2Fires.getState().decomp; s.temps = [18, 27, 43]; B2Fires.saveState('decomp', s); });
    await go(p, 'sense5');
    T.ok(/^Yes\. Your bluest tube was Tube A/.test(await fb(p, 'sense-bluest')), 'bluest-tube row now checks against the data');
    await p.selectOption('#sense-yellowest', 'direct');
    T.ok(/^Try again/.test(await fb(p, 'sense-yellowest')) && /Tube C/.test(await fb(p, 'sense-yellowest')), 'yellowest row wrong names the right tube');
    await p.selectOption('#sense-yellowest', 'foil');

    // saving, Resume, download, clear
    await go(p, 'wrapup');
    await p.fill('#wrap-sentence', 'Peat stayed because it was cold.');
    await p.waitForTimeout(200);
    const saved = await p.evaluate(k => JSON.parse(localStorage.getItem(k)), KEY);
    T.ok(saved.v === 1 && saved.decomp.seed && saved.tilt.recorded && saved.fields['wrap-sentence'] && saved.responseIds.includes('sense-past') && saved.responseIds.includes('wrap-sentence') && saved.responseIds.includes('cer-claim'), 'one saved record with scenes, fields and response ids');
    T.ok(saved.responseIds.every(id => !/^(dc-|tl-)/.test(id)), 'scene controls are not page fields');
    const [dl] = await Promise.all([p.waitForEvent('download'), p.locator('#download-work').click()]);
    const payload = JSON.parse(fs.readFileSync(await dl.path(), 'utf8'));
    T.ok(payload.format === 'openscied-b2-fires-progress-v1' && /SIMULATED/.test(payload.dataNote) && payload.simulatedData.foam.length === 3 && payload.simulatedData.tubes.length === 3 && payload.dropdowns.length >= 25, 'download is labeled simulated and carries the data');
    T.ok(payload.simulatedData.foam[2].minutes === 20 && payload.simulatedData.foamTemperaturesC.join() === '18,27,43' && payload.simulatedData.tubes[2].btbColor && payload.student && payload.student.name === 'Test Student', 'download numbers and student');
    T.ok(/Simulated foam height/.test(await p.locator('#investigation-report').innerText()) && /SIMULATED/.test(await p.locator('#investigation-report').innerText()), 'report shows simulated data');
    await p.reload();
    await p.waitForFunction(() => window.B2Fires && document.querySelector('.step.is-current'));
    await go(p, 'peat');
    T.ok(await p.isChecked('input[name="cer-claim"][value="a"]') && await p.locator('#cer-level').getAttribute('data-level') === 'organized', 'picks and the data-based level survive a reload');
    await go(p, 'sense3');
    T.ok(await p.inputValue('#sense-past') === 'cold' && /^Yes/.test(await fb(p, 'sense-past')), 'dropdowns and feedback survive a reload');
    await go(p, 'wrapup');
    await p.locator('#reset-work').click();
    T.ok(await p.locator('#reset-dialog').evaluate(d => d.open), 'Clear dialog opens');
    await p.locator('#cancel-reset').click();
    T.ok(await p.evaluate(k => !!localStorage.getItem(k), KEY), 'Cancel keeps the work');
    await p.locator('#reset-work').click();
    await Promise.all([p.waitForNavigation(), p.locator('#confirm-reset').click()]);
    await p.waitForFunction(() => window.B2Fires && document.querySelector('.step.is-current'));
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
  T.done('t102-b2-fires-page');
})().catch(e => { console.error(e); process.exit(1); });
