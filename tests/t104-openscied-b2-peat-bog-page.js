/* Peat Bog Carbon Lab (openscied-b2-peat-bog-lab.html, OpenSciEd B.2 companion): load, attribution, one live region, every control
   changes the rates and the drawings, extremes, keyboard, saving across reload, trials, download, Clear dialog, enlarge, reduced motion.
   Run: NODE_PATH=$(npm root -g) node tests/t104-openscied-b2-peat-bog-page.js */
const T = require('./_h');
const fs = require('fs');
const { execFileSync } = require('node:child_process');
const PAGE = 'openscied-b2-peat-bog-lab.html', KEY = 'aplab:openscied:b2-peat-bog:v1';
const SECTIONS = ['overview', 'bog', 'graph', 'zombie', 'warming', 'trials', 'model'];
const stub = pg => pg.route(/gc\.zgo\.at|fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, contentType: /gc\.zgo\.at/.test(r.request().url()) ? 'application/javascript' : 'text/css', body: '' }));
const go = async (p, id) => { await p.evaluate(h => { location.hash = h; }, id); await p.waitForFunction(h => document.querySelector('#' + h + '.is-current'), id); };
const rates = p => p.evaluate(() => ['pVal', 'dVal', 'bVal', 'nVal'].map(i => document.getElementById(i).textContent.replace(/[✓✕\s]/g, '').replace('−', '-')));
const setRange = async (p, id, v) => { await p.evaluate(([i, x]) => { const r = document.getElementById(i); r.value = x; r.dispatchEvent(new Event('input', { bubbles: true })); }, [id, v]); };
(async () => {
  const browser = await T.launch(), server = await T.serve();
  try {
    const ctx = await T.ctxFor(browser, { width: 1366, height: 900 });
    const p = await ctx.newPage(); const problems = [];
    p.on('console', m => { if (m.type() === 'error') problems.push('console: ' + m.text()); });
    p.on('pageerror', e => problems.push('pageerror: ' + e.message));
    p.on('requestfailed', r => { if (!/goatcounter|gc\.zgo\.at|fonts\.g/.test(r.url())) problems.push('requestfailed: ' + r.url()); });
    p.on('response', r => { if (r.status() >= 400 && !/goatcounter|gc\.zgo\.at|fonts\.g/.test(r.url())) problems.push('http ' + r.status() + ': ' + r.url()); });
    await stub(p);
    await p.goto(server.url + PAGE);
    await p.waitForFunction(() => window.B2Peat && document.querySelector('.step.is-current'));

    // --- load, title, attribution, footer ---
    T.ok(problems.length === 0, 'loads without console errors or failed requests ' + problems.join(' | '));
    const title = await p.title();
    T.ok(/^Peat Bog Carbon Lab/.test(title) && /companion for OpenSciEd Biology B\.2/.test(title), 'title: ' + title);
    T.ok(await p.locator('script[type="application/ld+json"]').count() === 1, 'JSON-LD present');
    const foot = await p.locator('.site-footer').innerText();
    T.ok(/^Created by Robert Smitka\./.test(foot) && /CC BY-NC-SA 4\.0/.test(foot), 'footer starts "Created by Robert Smitka." and names the site license');
    T.ok(/Unit B\.2/.test(foot) && /not OpenSciEd material/.test(foot) && /Not affiliated with, endorsed by, or sponsored by OpenSciEd/.test(foot), 'footer: B.2 credit, "not OpenSciEd material", not affiliated');
    T.ok(await p.locator('.site-footer a[href="https://creativecommons.org/licenses/by-nc/4.0/"]').count() === 1 && await p.locator('.site-footer a[href="https://www.openscied.org/"]').count() >= 1, 'footer links CC BY-NC 4.0 and openscied.org');
    T.ok(/counts page visits without cookies/.test(foot) && /Student names and answers stay in this browser unless you choose to share them/.test(foot) && !/GoatCounter/i.test(foot), 'plain privacy line');
    T.ok(await p.locator('script[data-goatcounter]').count() === 1, 'one page-visit tracker remains');
    await go(p, 'model');
    const attr = await p.locator('.attribution').innerText();
    T.ok(/original interactive simulator by Robert Smitka/.test(attr) && /CC BY-NC 4\.0/.test(attr) && /What this site changed/.test(attr) && /Not affiliated with, endorsed by, or sponsored by OpenSciEd/.test(attr), 'attribution block');
    const model = await p.locator('#model').innerText();
    T.ok(/What is modeled/.test(model) && /What is simplified/.test(model) && /How real bogs differ/.test(model) && /0–100 scale is a teaching scale/.test(model), '"What this simulation models" section');
    T.ok(await p.locator('#model a[href$="student-worksheet.docx"]').count() === 1 && await p.locator('#model a[href$="student-worksheet.pdf"]').count() === 1, 'worksheet links');
    for (const a of await p.locator('#model a[href^="worksheets/"]').evaluateAll(l => l.map(x => x.getAttribute('href')))) T.ok(fs.existsSync(T.ROOT + '/' + a), 'worksheet file exists: ' + a);

    // --- sections, live region, simulated labels ---
    T.ok(await p.locator('.step-nav a[href^="#"]').count() === 7 && await p.locator('main > section.step').count() === 7, 'seven sections');
    for (const id of SECTIONS) await go(p, id);
    T.ok(await p.locator('[aria-live], [role=status], [role=alert]').count() === 1, 'exactly one live region');
    await go(p, 'bog');
    const scaleNote = await p.locator('.scale-note').innerText();
    T.ok(/Simulated rates/.test(scaleNote) && /0–100 teaching scale/.test(scaleNote), 'bog labels its simulated rates as a 0–100 teaching scale');
    T.ok(/peat carbon = photosynthesis − decomposition − burning/.test(scaleNote), 'bog explains peat carbon as the net difference between rates');
    T.ok(/not measured carbon amounts/.test(scaleNote), 'bog distinguishes teaching rates from measured carbon amounts');
    await go(p, 'trials');
    T.ok(/Simulated data/.test(await p.locator('#trials .sim-tag').innerText()), 'trials say simulated');
    T.ok(await p.locator('svg[role=img]:not([aria-label])').count() === 0, 'every svg picture has a label');

    // --- defaults match the reference values (worksheet key) ---
    await go(p, 'bog');
    T.ok((await rates(p)).join() === '29,16,0,+13', 'default rates 29, 16, 0, +13: ' + await rates(p));
    T.ok((await p.locator('#bog-svg').getAttribute('aria-label')).includes('Photosynthesis 29, decomposition 16, burning 0') && /carbon sink/.test(await p.locator('#bog-svg').getAttribute('aria-label')), 'bog picture label states the current numbers and verdict');
    T.ok(await p.locator('#n-tilt').inputValue() === '23.44', 'today\'s tilt shows 23.44 (not the slider-snapped 23.45)');
    T.ok(await p.locator('#presets .btn[aria-pressed=true]').innerText().then(t => /Arctic summer today/.test(t)), 'the matching quick scenario is marked pressed (with a check mark)');

    // --- every control changes the right rates and the right drawing ---
    await p.click('#presets .btn:has-text("Drained bog")');
    T.ok((await rates(p)).join() === '17,22,0,-5', 'Drained bog: 17, 22, 0, -5 got ' + await rates(p));
    const verdictText = await p.locator('#nText').innerText();
    T.ok(/Carbon released to atmosphere/.test(verdictText) && /✕/.test(await p.locator('#nVal').innerText()), 'negative peat carbon shows words and a cross, not only red');
    T.ok(+await p.locator('#s-wet').inputValue() === 12 && await p.locator('#n-wet').inputValue() === '12', 'water slider and box both move to 12');
    await setRange(p, 's-wet', 90);
    const w90 = await p.evaluate(() => +document.querySelector('#bog-svg .b2-water').getAttribute('y'));
    await setRange(p, 's-wet', 10);
    const w10 = await p.evaluate(() => +document.querySelector('#bog-svg .b2-water').getAttribute('y'));
    T.ok(w10 > w90, 'lower water level moves the water line down in the picture (' + w90 + ' -> ' + w10 + ')');
    T.ok(+await p.locator('#o2Peat').innerText().then(t => parseFloat(t)) > 18, 'oxygen in the peat rises as the water drops');
    await setRange(p, 's-wet', 75); await setRange(p, 's-temp', 25);
    T.ok((await rates(p)).join() === '24,53,0,-29', 'temp 25: 24, 53, 0, -29 got ' + await rates(p));
    await setRange(p, 's-temp', 0);
    T.ok(await p.locator('#bog-svg').evaluate(e => e.textContent).then(t => /Permafrost: 100% of peat frozen/.test(t)), 'temp 0 draws 100% permafrost');
    await p.click('#presets .btn:has-text("Reset")');
    T.ok((await rates(p)).join() === '29,16,0,+13', 'Reset restores the defaults');
    await setRange(p, 's-burn', 60); await setRange(p, 's-wet', 10);
    T.ok(+(await rates(p))[2] > 40, 'burning 60% on dry peat burns: ' + await rates(p));
    T.ok(await p.locator('#bog-svg').evaluate(s => [...s.querySelectorAll('g')].some(g => g.getAttribute('transform') && /translate\(625/.test(g.getAttribute('transform')) && g.style.display !== 'none')), 'a fire is drawn');
    const wetB = (await rates(p))[2]; await setRange(p, 's-wet', 90);
    T.ok(+(await rates(p))[2] < +wetB, 'a wet bog burns less than a dry one');
    await setRange(p, 's-o2', 10);
    T.ok((await rates(p))[2] === '0', 'no burning at 10% oxygen');
    await p.click('#presets .btn:has-text("Reset")');
    await p.click('#tiltPresets .btn:has-text("Highest")');
    T.ok((await rates(p)).slice(0, 2).join() === '36,21' && await p.locator('#fSun').innerText() === '49.5°' && await p.locator('#fQd').innerText() === '+3.7%', 'highest tilt: 36, 21; sun 49.5; +3.7% (matches reference)');
    await p.click('#tiltPresets .btn:has-text("Lowest")');
    T.ok((await rates(p)).slice(0, 2).join() === '21,10' && /40%/.test(await p.locator('#bog-svg').evaluate(e => e.textContent)), 'lowest tilt: 21, 10 and 40% permafrost');
    await p.fill('#n-tilt', '24.2'); await p.press('#n-tilt', 'Enter');
    T.ok((await rates(p)).slice(0, 2).join() === '34,20', 'typing 24.2 in the tilt box works');
    await p.fill('#n-co2', '99999'); await p.press('#n-co2', 'Enter');
    T.ok(await p.locator('#n-co2').inputValue() === '2000' && +await p.locator('#s-co2').inputValue() === 2000, 'a number box clamps to the slider maximum');
    await p.fill('#n-co2', ''); await p.keyboard.type('abc'); await p.press('#n-co2', 'Enter');
    T.ok(await p.locator('#n-co2').inputValue() === '2000', 'text in a number box is rejected');
    await p.click('#presets .btn:has-text("Reset")');

    // --- keyboard: the sliders work with arrow keys; targets are big enough ---
    await p.focus('#s-wet'); await p.keyboard.press('ArrowLeft'); await p.keyboard.press('ArrowLeft');
    T.ok(+await p.locator('#s-wet').inputValue() === 73 && (await rates(p))[0] !== '', 'arrow keys move the water slider by 1');
    T.ok(await p.locator('#s-wet').getAttribute('aria-valuetext') === '73 percent', 'slider has a spoken value');
    const small = await p.evaluate(() => [...document.querySelectorAll('#bog.is-current button, #bog.is-current input, #bog.is-current select')].filter(e => { const r = e.getBoundingClientRect(); return r.width && r.height && (r.width < 24 || r.height < 24); }).map(e => e.id || e.className));
    T.ok(small.length === 0, 'no control smaller than 24 px in The bog ' + small.join(','));

    // --- speech buttons use only the built-in voice (no network) ---
    T.ok(await p.locator('.note .speak').count() >= 3 && !(await fs.promises.readFile(T.ROOT + '/openscied-b2-peat-bog-lab.js', 'utf8')).match(/fetch\(|XMLHttpRequest|sendBeacon/), 'read-aloud buttons exist and the page never sends data anywhere');

    // --- pause motion ---
    await p.click('#motion-btn');
    T.ok(await p.locator('#motion-btn').getAttribute('aria-pressed') === 'true' && /Play motion/.test(await p.locator('#motion-btn').innerText()), 'Pause motion toggles');
    const dot = () => p.evaluate(() => [...document.querySelectorAll('#bog-svg path[stroke-width="0.9"]')].map(d => d.getAttribute('transform')).join('|'));
    const d1 = await dot(); await p.waitForTimeout(500); T.ok(d1 === await dot(), 'shapes stand still while paused');
    await p.click('#motion-btn'); await p.waitForTimeout(500); T.ok(d1 !== await dot(), 'shapes move again when played');

    // --- graph, zombie fires, global warming ---
    await go(p, 'graph');
    T.ok(await p.locator('#explore path[stroke-dasharray]').count() >= 2 && await p.locator('#explore-legend li').count() === 3, 'graph lines differ by dash pattern and marker, with a legend');
    T.ok(/Rate \(0–100, simulated\)/.test(await p.locator('#explore text.axis-title').allTextContents().then(a => a.join('|'))) && /Summer temperature \(°C\)/.test(await p.locator('#explore').evaluate(e => e.textContent)), 'axis titles with units');
    await p.selectOption('#xVar', 'wet');
    T.ok(/Water level in the bog \(%\)/.test(await p.locator('#explore').evaluate(e => e.textContent)), 'choosing a variable redraws the axis');
    await p.locator('#graph summary').click();
    T.ok(await p.locator('#explore-table tbody tr').count() === 13 && /Simulated rates/.test(await p.locator('#explore-table caption').innerText()), 'graph has a data table alternative (13 rows)');
    await go(p, 'zombie');
    await p.click('#zSetup');
    T.ok(await p.locator('#zChance').innerText() === '95%', 'zombie fire conditions: 95% chance');
    T.ok(await p.locator('#bog-svg').count() === 1 && +await p.locator('#s-burn').inputValue() === 55 && +await p.locator('#zBurn').inputValue() === 55, 'zombie sliders share the bog values');
    await p.click('[data-season="2"]');
    T.ok(/Fire smoldering underground/.test(await p.locator('#zombie-svg').evaluate(e => e.textContent)) && /smolders slowly/.test(await p.locator('#zCaption').innerText()), 'winter: fire smolders under the snow');
    await setRange(p, 'zWet', 75);
    T.ok(await p.locator('#zChance').innerText() === '10%' && /Water filled the air spaces/.test(await p.locator('#zCaption').innerText()) && !/Fire smoldering underground/.test(await p.locator('#zombie-svg').evaluate(e => e.textContent)), 'water puts the zombie fire out');
    T.ok(+await p.locator('#s-wet').inputValue() === 75, 'moving the zombie slider moves the bog slider');
    await go(p, 'warming');
    T.ok(/521 ppm/.test(await p.locator('#gh-svg').evaluate(e => e.textContent)) && /\+1\.8 °C/.test(await p.locator('#gh-svg').evaluate(e => e.textContent)), 'greenhouse picture: 521 ppm, +1.8 C in 2100');
    await setRange(p, 'fossil', 15);
    T.ok(/621 ppm/.test(await p.locator('#gh-svg').evaluate(e => e.textContent)) && /\+2\.3 °C/.test(await p.locator('#gh-svg').evaluate(e => e.textContent)), 'more fossil fuel: 621 ppm, +2.3 C');
    T.ok(await p.locator('#climate-table tbody tr').count() === 16, 'climate table alternative has 16 rows');
    T.ok((await p.locator('#projection-hint').innerText()).includes('projection through 2100'), 'chart note explains that the selected year is part of a projection');
    await setRange(p, 'year', 2050);
    await setRange(p, 'forest', 75);
    const resetClimate = p.getByRole('button', { name: 'Reset model settings', exact: true });
    await resetClimate.click();
    T.ok((await p.locator('#year').inputValue()) === '2100' &&
      +(await p.locator('#fossil').inputValue()) === 10 && +(await p.locator('#forest').inputValue()) === 100,
      'reset restores the original climate settings and selects the 2100 projection');
    await p.waitForFunction(() => document.getElementById('announcer').textContent.includes('Showing the projection for 2100.'));
    await p.click('#sendBog');
    await p.waitForFunction(() => document.querySelector('#bog.is-current'));
    T.ok(+await p.locator('#s-co2').inputValue() === 520 && +await p.locator('#s-temp').inputValue() === 11, 'Test the bog in 2100 sets CO2 520 ppm and 11 C');

    // --- trials: record, label, persist across reload, undo, download, copy ---
    await p.click('#presets .btn:has-text("Reset")');
    await p.click('#record-bog');
    await setRange(p, 's-wet', 50); await p.click('#record-bog');
    await go(p, 'trials');
    T.ok(await p.locator('#logWrap tbody tr').count() === 2 && await p.locator('#nav-count').innerText() === '2', 'two trials recorded, nav count 2');
    T.ok(/Starting values/.test(await p.locator('#logWrap tbody tr').first().innerText() + await p.locator('#logWrap .lbl-input').first().inputValue()) , 'automatic label');
    await p.fill('#logWrap .lbl-input >> nth=1', 'Experiment A: Water level'); await p.press('#logWrap .lbl-input >> nth=1', 'Tab');
    T.ok(await p.locator('#logWrap .lbl-input').nth(1).inputValue() === 'Experiment A: Water level', 'a trial label can be edited');
    const rec = await p.evaluate(k => JSON.parse(localStorage.getItem(k)), KEY);
    T.ok(rec && rec.v === 1 && rec.trials.length === 2 && rec.settings.wet === 50 && rec.trials[1].label === 'Experiment A: Water level' && !('P' in rec.trials[1]), 'one saved record under ' + KEY + ', trials hold inputs only');
    const peatStorage = await p.evaluate(() => ({
      records: Object.keys(localStorage).filter(k => k.startsWith('aplab:openscied:b2-peat')),
      resume: localStorage.getItem('aplab:pref:openscied-resume:v1:b2-peat-bog-lab')
    }));
    T.ok(peatStorage.records.length === 1 && peatStorage.records[0] === KEY, 'only one Peat Bog student-work record');
    T.ok(!peatStorage.resume || !peatStorage.resume.includes('Experiment A: Water level'), 'Resume metadata never duplicates the trial label');
    await p.reload(); await p.waitForFunction(() => window.B2Peat);
    T.ok(await p.evaluate(() => B2Peat.state.trials.length) === 2 && await p.evaluate(() => B2Peat.state.S.wet) === 50, 'trials and settings survive a reload');
    await go(p, 'bog');
    T.ok(+await p.locator('#s-wet').inputValue() === 50, 'slider restored after reload');
    await go(p, 'trials');
    const preview = p.locator('#trials [data-ose-report-final]').getByRole('button', { name: 'Preview report', exact: true });
    await preview.waitFor({ state: 'visible' });
    T.ok(await p.getByRole('button', { name: 'Preview report', exact: true }).count() === 1 &&
      !await p.locator('#download-work').isVisible() && !await p.locator('#download-csv').isVisible() &&
      !await p.locator('#copy').isVisible() && !await p.locator('#print-work').isVisible(),
      'My trials has one classroom preview; old backups and table tools start collapsed');
    await preview.click();
    const dialog = p.locator('dialog.osr-dialog');
    const wordDownload = p.waitForEvent('download');
    await dialog.getByRole('button', { name: 'Download Word (.docx)', exact: true }).click();
    const word = await wordDownload;
    const xml = execFileSync('unzip', ['-p', await word.path(), 'word/document.xml'], { encoding: 'utf8' });
    const tables = xml.match(/<w:tbl>[\s\S]*?<\/w:tbl>/g) || [];
    const climate = tables.find(x => x.includes('Warming since the 1800s'));
    const seriesRows = climate?.match(/<w:tr>[\s\S]*?<\/w:tr>/g) || [];
    T.ok(/Climate projection · simulated/.test(xml) && seriesRows.length === 17 &&
      seriesRows[1].includes('>2025<') &&
      ['2100', '521', '1.8'].every(value => seriesRows.at(-1).includes('>' + value + '<')),
      'Word has all sixteen climate projection rows and their on-screen 2100 values');
    T.ok(/Scenarios sent to the bog/.test(xml) && tables.some(x => x.includes('Bog summer temperature') && x.includes('>520<') && x.includes('>11<')),
      'Word distinguishes the rounded bog inputs from the atmospheric projection');
    await dialog.getByRole('button', { name: 'Close report', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
    await p.locator('#legacy-report-tools > summary').click();
    const dl = p.waitForEvent('download'); await p.click('#download-work'); const d = await dl;
    const j = JSON.parse(fs.readFileSync(await d.path(), 'utf8'));
    T.ok(/simulated/.test(d.suggestedFilename()) && j.format === 'openscied-b2-peat-bog-lab-progress-v1' && /SIMULATED/.test(j.dataNote) && j.student && j.student.name === 'Test Student' && j.student.period === '3', 'download is labeled simulated and carries the student name and period');
    T.ok(j.trials.length === 2 && j.trials[0].simulated === true && j.trials[0].outputs.P === 29 && j.trials[1].inputs.wet === 50 && j.settings.wet === 50, 'download has trials with inputs and recomputed outputs');
    const dl2 = p.waitForEvent('download'); await p.click('#download-csv'); const c = fs.readFileSync(await (await dl2).path(), 'utf8');
    T.ok(/Data source/.test(c) && /Simulated/.test(c) && c.split('\r\n').length === 3, 'CSV has the simulated column and 2 rows');
    await p.click('#undo');
    T.ok(await p.locator('#logWrap tbody tr').count() === 1, 'Undo removes the last trial');
    T.ok(/Student: Test Student · Class period: 3/.test(await p.locator('#trial-student').innerText()), 'student line');

    // --- Clear this activity ---
    await p.click('#reset-work');
    T.ok(await p.locator('#reset-dialog[open]').count() === 1, 'clear dialog opens');
    await p.click('#cancel-reset');
    T.ok(await p.evaluate(k => !!localStorage.getItem(k), KEY), 'Cancel keeps the work');
    await p.click('#reset-work'); await Promise.all([p.waitForNavigation(), p.click('#confirm-reset')]);
    await p.waitForFunction(() => window.B2Peat);
    T.ok(await p.evaluate(k => localStorage.getItem(k), KEY) === null, 'Clear removes the record and a fresh load does not write a blank one');
    T.ok(await p.evaluate(() => B2Peat.state.trials.length === 0 && B2Peat.state.S.wet === 75) && await p.evaluate(() => !!localStorage.getItem('aplab:student')), 'defaults again; name and period stay');

    // --- enlarge: the picture scales to the window, then goes back ---
    await go(p, 'bog');
    await p.click('[data-enlarge="bog"]');
    const big = await p.evaluate(() => { const s = document.querySelector('#enlarge-dialog #bog-svg'); if (!s) return null; const r = s.getBoundingClientRect(), d = document.getElementById('enlarge-dialog').getBoundingClientRect(); return { inside: r.right <= d.right + 1 && r.bottom <= d.bottom + 1 && r.left >= d.left - 1 && r.top >= d.top - 1, w: r.width, h: r.height }; });
    T.ok(big && big.inside && big.w > 900, 'enlarged bog fits inside the dialog ' + JSON.stringify(big));
    await p.keyboard.press('Escape');
    await p.waitForFunction(() => !document.querySelector('#enlarge-dialog[open]') && document.querySelector('.stage #bog-svg'), null, { timeout: 3000 }).catch(() => {});
    T.ok(await p.locator('.stage #bog-svg').count() === 1 && await p.locator('#enlarge-dialog[open]').count() === 0, 'picture returns to the page on Escape');

    // --- error-free through all of it ---
    T.ok(problems.length === 0, 'no console errors during the whole run ' + problems.join(' | '));
    await ctx.close();

    // --- reduced motion: the picture is complete and still ---
    const rctx = await T.ctxFor(browser, { width: 1366, height: 900, reduced: true });
    const rp = await rctx.newPage(); await stub(rp);
    await rp.goto(server.url + PAGE + '#bog'); await rp.waitForFunction(() => window.B2Peat && document.querySelector('#bog.is-current'));
    const s1 = await rp.evaluate(() => [...document.querySelectorAll('#bog-svg path[stroke-width="0.9"]')].map(d => d.getAttribute('transform')).join('|'));
    await rp.waitForTimeout(500);
    const s2 = await rp.evaluate(() => [...document.querySelectorAll('#bog-svg path[stroke-width="0.9"]')].map(d => d.getAttribute('transform')).join('|'));
    T.ok(s1.length > 20 && s1 === s2, 'reduced motion: shapes are drawn in place and do not move');
    T.ok(await rp.locator('#motion-btn').isDisabled(), 'reduced motion: the pause button explains and is disabled');
    await rctx.close();

    // --- hostile saved data is repaired, not trusted ---
    const hctx = await T.ctxFor(browser, { width: 1366, height: 900 });
    await hctx.addInitScript(k => { localStorage.setItem(k, JSON.stringify({ v: 1, settings: { wet: 'x', co2: 1e9, tilt: null, burn: -4 }, climate: { fossil: 'bad', year: 3000 }, explore: 'zzz', season: 9, trials: [{ wet: 500, label: 12 }, 'junk', null], lastSection: 'nope' })); }, KEY);
    const hp = await hctx.newPage(); const herr = []; hp.on('pageerror', e => herr.push(e.message)); await stub(hp);
    await hp.goto(server.url + PAGE); await hp.waitForFunction(() => window.B2Peat);
    const hs = await hp.evaluate(() => ({ S: B2Peat.state.S, c: B2Peat.state.climate, n: B2Peat.state.trials.length, e: B2Peat.state.explore, s: B2Peat.state.season }));
    T.ok(herr.length === 0 && hs.S.wet === 75 && hs.S.co2 === 2000 && hs.S.tilt === 23.44 && hs.S.burn === 0 && hs.c.year === 2100 && hs.c.fossil === 10 && hs.n === 1 && hs.e === 'temp' && hs.s === 0, 'bad saved values are clamped or defaulted: ' + JSON.stringify(hs) + herr.join());
    await hctx.close();
  } finally { await browser.close(); server.close(); }
  T.done('t104-openscied-b2-peat-bog-page');
})().catch(e => { console.error(e); process.exit(1); });
