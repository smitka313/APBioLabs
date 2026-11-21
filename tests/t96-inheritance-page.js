/* Inheritance, Environment and Cancer Risk companion (OpenSciEd B.3 Lessons 8-9): page load, 14 sections, light-writing budget,
   content note, no personal-health inputs, videos linked only, choices with instant feedback, exit ticket, tap-order, Question Tool,
   claim check, C-to-T example, saving and Resume, scene placeholders and registration contract, download, Clear dialog, layouts.
   Run: NODE_PATH=$(npm root -g) node tests/t96-inheritance-page.js */
const T = require('./_h');
const fs = require('fs');
const PAGE = 'openscied-b3-inheritance-environment.html', KEY = 'aplab:openscied:b3-inheritance-environment:v1';
const stub = pg => pg.route(/gc\.zgo\.at|fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, contentType: /gc\.zgo\.at/.test(r.request().url()) ? 'application/javascript' : 'text/css', body: '' }));
const SECTIONS = ['overview', 'ideas', 'families', 'reader', 'lakita', 'twogene', 'passing', 'exit8', 'envideas', 'skindata', 'plan', 'yeast', 'uvdna', 'wrapup'];
const go = async (p, id) => { await p.evaluate(h => { location.hash = h; }, id); await p.waitForFunction(h => document.querySelector('#' + h + '.is-current'), id); };
const pick = async (p, name, value) => { await p.check('input[name="' + name + '"][value="' + value + '"]'); };
const fb = (p, name) => p.locator('#feedback-' + name).innerText();
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
    // This test is about the page contract with no scene present: serve the scene scripts empty.
    await p.route(/(pedigree|two-gene|meiosis|skin-data|investigation-planner|yeast-uv)-scene\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
    await p.goto(server.url + PAGE);
    await p.waitForFunction(() => window.B3Inh && document.querySelector('.step.is-current'));

    // --- load, title rule, attribution ---
    T.ok(problems.length === 0, 'page loads without console errors or failed requests ' + problems.join(' | '));
    const title = await p.title();
    T.ok(/^Inheritance, Environment and Cancer Risk/.test(title) && !/^OpenSciEd/i.test(title) && /companion for OpenSciEd Biology B\.3/.test(title), 'title does not lead with the OpenSciEd mark: ' + title);
    T.ok(await p.locator('script[type="application/ld+json"]').count() === 1, 'JSON-LD present');
    const foot = await p.locator('.site-footer').innerText();
    T.ok(/^Created by Robert Smitka\./.test(foot), 'footer starts "Created by Robert Smitka."');
    T.ok(/Lessons 8–9 of OpenSciEd Biology Unit B\.3: Inheritance & Variation of Traits/.test(foot), 'footer credits OpenSciEd Biology B.3 Lessons 8-9');
    T.ok(await p.locator('.site-footer a[href="https://creativecommons.org/licenses/by-nc/4.0/"]').count() === 1 && await p.locator('.site-footer a[href="https://www.openscied.org/"]').count() >= 1, 'footer links CC BY-NC 4.0 and openscied.org');
    T.ok(/Adapted and reorganized as an interactive companion; the models, reading summaries and questions are new/.test(foot) && /Not affiliated with, endorsed by, or sponsored by OpenSciEd/.test(foot), 'footer states what changed and the non-endorsement');
    T.ok(/GoatCounter/.test(foot) && /Nothing you type/.test(foot), 'privacy line');
    T.ok(await p.locator('.attribution a[href="https://creativecommons.org/licenses/by-nc/4.0/"]').count() === 1, 'attribution block links the license');

    // --- sections and navigation ---
    T.ok(await p.locator('.step-nav a[href^="#"]').count() === 14 && await p.locator('main > section.step').count() === 14, 'fourteen sections in the nav and the page');
    for (const id of SECTIONS) await go(p, id);
    T.ok(await p.locator('#wrapup.is-current').count() === 1, 'hash navigation reaches the last section');
    await p.locator('.step-nav a[href="#ideas"]').click();
    await p.waitForFunction(() => document.querySelector('#ideas.is-current'));
    await p.locator('#ideas .pager-next').click();
    await p.waitForFunction(() => document.querySelector('#families.is-current'));
    const vidLabels = await p.locator('#families a[href*="youtu.be"]').evaluateAll(a => a.map(x => x.href.split('/').pop() + '|' + x.textContent.replace(/\(opens in a new tab\)/, '').trim()));
    T.ok(vidLabels.join(';') === 'U1Zifbvvl0Q|Video A: Lauren’s family history;ux7obpTlkbU|Video B: Lakita’s family history;-NhqJRIJJsw|Video C: Lauren talks about surgery (about 1 minute)', 'video links are labeled with what each video is (C is the surgery video, not "why one syndrome leads to many cancers"): ' + vidLabels.join(' ; '));
    T.ok(true, 'pager Next works');
    T.ok(await p.locator('[aria-live], [role=status], [role=alert]').count() === 1, 'exactly one live region');

    // --- light writing budget and word budget ---
    const boxes = await p.evaluate(() => document.querySelectorAll('main textarea, main input[type=text]').length);
    T.ok(boxes <= 10, 'at most 10 free-text boxes: ' + boxes);
    T.ok(await p.evaluate(() => Array.from(document.querySelectorAll('main textarea, main input[type=text]')).every(t => t.maxLength > 0 && t.maxLength <= 240 || t.id === 'write-more')), 'text boxes are short (length limit), except the optional Write more');
    const words = await p.evaluate(() => {
      const c = document.querySelector('main').cloneNode(true);
      c.querySelectorAll('.scene-host, .attribution, .pager, script, .your-data, #investigation-report, details:not([open]) > :not(summary)').forEach(n => n.remove());
      return (c.textContent.match(/\S+/g) || []).length;
    });
    T.ok(words <= 1750, 'visible page text (no scenes, attribution, hidden details) stays light (1650 plus four short Background cards): ' + words + ' words');

    // --- sensitivity: content note, teacher note, links only, no personal-health inputs ---
    T.ok(/pause, skip a part, or step away/.test(await p.locator('#content-note').innerText()) && /Nobody is asked to share anything about their own family/.test(await p.locator('#content-note').innerText()), 'content note at the top');
    await go(p, 'ideas');
    T.ok(/do not need to write about any real family/.test(await p.locator('#ideas').innerText()) && /Pause whenever you like/.test(await p.locator('#ideas').innerText()), 'reminder before Part A');
    T.ok(await p.locator('details.teacher-note').count() === 1, 'collapsible teacher note');
    T.ok(await p.locator('iframe, video, embed, object').count() === 0, 'no embedded video');
    const vids = await p.$$eval('.video-links a', as => as.map(a => a.href + '|' + a.rel + '|' + a.target));
    T.ok(vids.length === 3 && vids.every(v => /^https:\/\/youtu\.be\/.+\|noopener noreferrer\|_blank$/.test(v)), 'three video links, new tab, noopener');
    const labels = await p.evaluate(() => Array.from(document.querySelectorAll('main textarea, main input, main select')).map(e => { const l = document.querySelector('label[for="' + e.id + '"]'); return (l ? l.textContent : '') + ' ' + (e.placeholder || '') + ' ' + (e.closest('fieldset') && e.closest('fieldset').querySelector('legend') ? e.closest('fieldset').querySelector('legend').textContent : ''); }));
    T.ok(!labels.some(t => /(your|my|their) (own )?(family|mother|father|parents?|grand|relatives?|health|medical|diagnos|cancer history)|have you (or|ever)|does anyone in your|do you know anyone/i.test(t)), 'no input asks for personal or family health information');
    const bodyText = await p.locator('main').textContent();
    T.ok(!/bad gene|defective gene|inevitable cancer|you will get cancer/i.test(bodyText) && /not inevitable/.test(bodyText) && /not a prediction|Nothing here predicts/.test(bodyText), 'careful, non-stigmatizing wording');
    T.ok(!/mortality|deaths? rate/i.test(await p.locator('#skindata').innerText()), 'skin data section carries no mortality numbers');
    T.ok(/not a biological split/.test(await p.locator('#skindata').innerText()), 'framing note on group labels');

    // --- choices: instant feedback, stale marks removed ---
    await go(p, 'reader');
    await pick(p, 'key-shaded', 'a');
    T.ok(/^Yes|slash/.test(await fb(p, 'key-shaded')) && await p.locator('#feedback-key-shaded').getAttribute('data-state') === 'wrong', 'wrong choice gets a reason');
    await pick(p, 'key-shaded', 'b');
    T.ok(/^Yes\./.test(await fb(p, 'key-shaded')) && await p.locator('#feedback-key-shaded').getAttribute('data-state') === 'correct', 'right choice is confirmed, and the old reason is replaced');
    await go(p, 'ideas');
    await pick(p, 'poll-why', 'c');
    T.ok(await p.locator('#feedback-poll-why').getAttribute('data-state') === 'poll' && (await fb(p, 'poll-why')).length > 10, 'poll answer gets friendly feedback without a right or wrong mark');

    // --- exit ticket (checkable choices from the logic module) ---
    await go(p, 'exit8');
    await pick(p, 'exit-q1', 'a');
    T.ok(/^Try again\. Why not/.test(await fb(p, 'exit-q1')), 'Q1 wrong answer says why not');
    await pick(p, 'exit-q1', 'b');
    T.ok(/^Yes\./.test(await fb(p, 'exit-q1')), 'Q1 Population B is correct');
    await pick(p, 'exit-q2', 'ab'); T.ok(/^Yes\./.test(await fb(p, 'exit-q2')), 'Q2 "ab" is correct');
    await pick(p, 'exit-q2', 'ad'); T.ok(/^Try again/.test(await fb(p, 'exit-q2')), 'Q2 "ad" is not');
    await pick(p, 'exit-q4', 'environment'); T.ok(/^Yes\./.test(await fb(p, 'exit-q4')), 'Q4 Environment is correct');
    await pick(p, 'exit-q2', 'ab');

    // --- tap to order ---
    await go(p, 'passing');
    T.ok(await p.locator('#order-meiosis .order-choices button').count() === 4, 'four steps to tap');
    for (const s of ['cross', 'copy']) await p.locator('#order-meiosis button[data-step="' + s + '"]').click();
    T.ok(/Not quite in order/.test(await fb(p, 'order-meiosis')), 'wrong first steps are noticed');
    await p.locator('[data-order-reset]').click();
    T.ok(await fb(p, 'order-meiosis') === '', 'Start over clears feedback');
    for (const s of ['copy', 'cross', 'divide', 'join']) await p.locator('#order-meiosis button[data-step="' + s + '"]').click();
    T.ok(/^Yes\./.test(await fb(p, 'order-meiosis')) && await p.locator('#feedback-order-meiosis').getAttribute('data-state') === 'correct', 'correct order is confirmed');

    // --- Question Tool ---
    await go(p, 'plan');
    T.ok(/Choose both/.test(await p.locator('#qt-question').innerText()), 'Question Tool starts empty');
    await p.selectOption('#qt-iv', 'the time under UV light');
    await p.selectOption('#qt-dv', 'the number of yeast colonies');
    T.ok(await p.locator('#qt-question').innerText() === 'How does the time under UV light affect the number of yeast colonies?', 'frame 1 builds the question');
    T.ok((await p.locator('#qt-criteria li').allInnerTexts()).slice(0, 2).every(t => t.startsWith('✓')), 'criteria 1 and 2 pass with text marks');
    await p.selectOption('#qt-frame', '1');
    T.ok(/^What is the effect of the time under UV light on the number of yeast colonies\?/.test(await p.locator('#qt-question').innerText()), 'frame 2 builds the question');
    await p.selectOption('#qt-dv', 'how healthy the yeast seems');
    T.ok((await p.locator('#qt-criteria li').nth(1).innerText()).startsWith('○') && /measure/.test(await p.locator('#qt-criteria li').nth(1).innerText()), 'a vague measure fails the specific check with a hint');
    await p.fill('#qt-own', 'Is yeast nice?');
    T.ok((await p.locator('#qt-criteria li').nth(0).innerText()).startsWith('○'), 'an own question that skips the variables fails the first check');
    await p.fill('#qt-own', '');
    await p.selectOption('#qt-dv', 'the number of yeast colonies');
    await pick(p, 'qt-new', 'yes');
    T.ok((await p.locator('#qt-criteria li').nth(2).innerText()).startsWith('✓'), 'third check is the student\'s own call');
    T.ok(await p.evaluate(() => B3Inh.getQuestion().ok === true && /colonies/.test(B3Inh.getQuestion().text)), 'api.getQuestion returns the result');
    // controls chips
    await p.check('#ctrl-a'); await p.check('#ctrl-e');
    T.ok(/^Try again/.test(await fb(p, 'ctrl')), 'a wrong chip is noticed');
    await p.uncheck('#ctrl-e'); for (const k of 'bcd') await p.check('#ctrl-' + k);
    T.ok(/^Yes\./.test(await fb(p, 'ctrl')), 'all the right chips confirm');

    // --- claim check, C to T ---
    await go(p, 'yeast');
    T.ok(/Pick a claim/.test(await p.locator('#cer-level').innerText()) && await p.locator('#cer-level').getAttribute('data-level') === 'none', 'claim builder starts empty');
    // Evidence about "my dishes" is checked against the student's own yeast table (counted dishes): seed a plausible one.
    await p.evaluate(() => B3Inh.saveState('yeast', { dishes: [
      { group: 1, strain: 'sensitive', dark: true, minutes: 0, dose: 0, colonies: 201 }, { group: 2, strain: 'sensitive', minutes: 15, dose: 15, colonies: 1 },
      { group: 3, strain: 'sensitive', spf: 15, minutes: 15, dose: 1, colonies: 140 }, { group: 4, strain: 'sensitive', spf: 30, minutes: 15, dose: 0.5, colonies: 172 },
      { group: 5, strain: 'sensitive', spf: 50, minutes: 15, dose: 0.3, colonies: 190 }, { group: 6, strain: 'sensitive', foil: true, minutes: 15, dose: 0, colonies: 198 }] }));
    await pick(p, 'cer-claim', 'c'); await p.check('#cer-ev-1'); await pick(p, 'cer-reason', 'b'); await p.check('#cer-caveat');
    T.ok(await p.locator('#cer-level').getAttribute('data-level') !== 'organized' && /does not fit/.test(await p.locator('#cer-level').innerText()), 'a claim the dishes contradict (UV has no effect) cannot reach Organized and says why');
    await p.check('#cer-ev-3');
    T.ok(/✕/.test(await p.locator('#cer-ev-3-note').innerText()) || /✓/.test(await p.locator('#cer-ev-3-note').innerText()), 'a statement about SPF gets a text mark (✓ or ✕) from the student\'s own table');
    await p.uncheck('#cer-ev-3'); await pick(p, 'cer-claim', 'a'); await pick(p, 'cer-reason', 'a');
    await p.uncheck('#cer-caveat'); await p.evaluate(() => B3Inh.saveState('yeast', null));
    await p.uncheck('#cer-ev-1'); await p.check('#cer-ev-1');
    T.ok(/Count your dishes first/.test(await p.locator('#cer-ev-1-note').innerText()), 'evidence about my dishes asks for counted dishes first');
    await p.evaluate(() => B3Inh.saveState('yeast', { dishes: [
      { group: 1, strain: 'sensitive', dark: true, minutes: 0, dose: 0, colonies: 201 }, { group: 2, strain: 'sensitive', minutes: 15, dose: 15, colonies: 1 },
      { group: 3, strain: 'sensitive', spf: 15, minutes: 15, dose: 1, colonies: 140 }, { group: 4, strain: 'sensitive', spf: 30, minutes: 15, dose: 0.5, colonies: 172 },
      { group: 5, strain: 'sensitive', spf: 50, minutes: 15, dose: 0.3, colonies: 190 }, { group: 6, strain: 'sensitive', foil: true, minutes: 15, dose: 0, colonies: 198 }] }));
    T.ok(/✓/.test(await p.locator('#cer-ev-1-note').innerText()), 'the mark updates when the dishes are counted (no stale text)');
    await p.check('#cer-ev-4');
    T.ok(await p.locator('#cer-level').getAttribute('data-level') === 'linked', 'claim, evidence and reasoning gives Linked');
    await p.check('#cer-caveat');
    T.ok(await p.locator('#cer-level').getAttribute('data-level') === 'organized', 'adding a limit gives Organized');
    await p.uncheck('#cer-ev-1');
    T.ok(await p.locator('#cer-level').getAttribute('data-level') !== 'organized', 'removing evidence removes the Organized mark');
    await go(p, 'uvdna');
    await p.selectOption('#cto-codon', 'CCA'); await p.selectOption('#cto-pos', '1');
    T.ok(/CCA \(Pro\) → CTA \(Leu\)/.test(await p.locator('#cto-result').innerText()), 'C-to-T example uses the codon table');
    await p.selectOption('#cto-pos', '2');
    T.ok(/not a C/.test(await p.locator('#cto-result').innerText()), 'a non-C letter is explained');
    await p.selectOption('#cto-codon', 'CGA'); await p.selectOption('#cto-pos', '0');
    T.ok(/Stop/.test(await p.locator('#cto-result').innerText()), 'a Stop change is explained');
    await pick(p, 'uv-kind', 'b'); T.ok(/^Try again/.test(await fb(p, 'uv-kind')), 'evidence-kind wrong pick says why');
    for (const k of 'abc') await p.check('#uv-new-' + k);
    T.ok(/^Yes/.test(await fb(p, 'uv-new')), 'true-ideas chips confirm');

    // --- skin data table (the data alternative works without the scene) ---
    await go(p, 'skindata');
    await p.locator('#skindata details.disclose summary').click();
    T.ok(await p.locator('#skin-table tbody tr').count() === 11 && /Hawaii/.test(await p.locator('#skin-table').innerText()), 'data table lists the 11 sites');
    T.ok(/Approximate/.test(await p.locator('#skindata').innerText()), 'approximate values are labelled');

    // --- placeholders and the registration contract ---
    const hosts = [['pedigree-scene', 'pedigree', 'lakita'], ['two-gene-scene', 'two-gene', 'twogene'], ['meiosis-scene', 'meiosis', 'passing'], ['skin-data-scene', 'skin-data', 'skindata'], ['planner-scene', 'planner', 'plan'], ['yeast-uv-scene', 'yeast-uv', 'yeast']];
    for (const [id, base, sec] of hosts) {
      await go(p, sec);
      T.ok(await p.locator('#' + id + ' canvas[role="img"][aria-label]').count() === 1 && (await p.locator('#' + base + '-desc').innerText()).length > 30, id + ': canvas with role and label, and a text description');
      T.ok(await p.locator('#' + base + '-notice').isVisible() && /coming in the next update/.test(await p.locator('#' + base + '-notice').innerText()), id + ': coming-soon notice while no scene is registered');
    }
    T.ok(await p.evaluate(() => { const c = document.querySelector('#yeast-uv-scene canvas'); return c.width > 0 && c.height > 0; }), 'placeholder preview is drawn');
    await go(p, 'lakita');
    T.ok(/Run the model first/.test(await p.locator('#data-pedigree-body').innerText()), 'Your data box says "Run the model first"');
    await p.evaluate(() => {
      window.__m = 0;
      B3Inh.registerScene({ id: 'pedigree', mount(host, api) { window.__m++; api.saveState('pedigree', { guesses: { lakita: ['AB'], aunt1: ['AA'], father: ['AA', 'AB'] } }); } });
    });
    T.ok(await p.evaluate(() => window.__m) === 1 && await p.locator('#pedigree-notice').isHidden(), 'registerScene mounts once and hides the notice');
    const pt = await p.locator('#data-pedigree-body').innerText();
    T.ok(/✓ Matches the model/.test(pt) && /Could also be: AB/.test(pt) && /✕ Not possible: AA/.test(pt) && /1 of 3 people match/.test(pt), 'pedigree data box checks every pick against the model: ' + pt.replace(/\s+/g, ' ').slice(0, 160));
    await p.evaluate(() => B3Inh.update('pedigree', { guesses: { lakita: ['AB'], aunt1: ['AA', 'AB'], father: ['AB'] } }));
    T.ok(/3 of 3 people match/.test(await p.locator('#data-pedigree-body').innerText()), 'changing picks recomputes the marks');
    await p.evaluate(() => { B3Inh.saveState('twoGene', { genotypes: { father: { p53: 'AB', brca1: 'CD' }, child2: { p53: 'AB', brca1: 'CC' } } }); B3Inh.saveState('meiosis', { runs: [{ crossing: false, gametes: ['AC', 'BD'] }, { crossing: true, gametes: ['AC', 'AD', 'BC', 'BD'] }] }); B3Inh.saveState('skin', { viewed: { white: true } }); B3Inh.saveState('planner', { conditions: [{ group: 1, label: 'No sunscreen', minutes: 15, spf: null }] }); B3Inh.saveState('yeast', { dishes: [{ group: 1, label: 'No sunscreen', colonies: 12, rating: 'few' }, { group: 2, colonies: -3 }] }); });
    T.ok(/Higher/.test(await p.locator('#data-twogene-body').innerText()) && /Medium/.test(await p.locator('#data-twogene-body').innerText()), 'two-gene box shows the risk text');
    T.ok(/AC, AD, BC, BD/.test(await p.locator('#data-meiosis-body').textContent()) && /Without crossing over\s*AC, BD\s*2/.test(await p.locator('#data-meiosis-body').textContent()), 'meiosis box shows 2 kinds and 4 kinds');
    T.ok(/White-labeled graph/.test(await p.locator('#data-skin-body').innerText()), 'skin box shows what was viewed');
    T.ok(/No sunscreen/.test(await p.locator('#data-planner-body').innerText()) && /SIMULATED/.test(await p.locator('#data-yeast-body').innerText()) && !/NaN|-3/.test(await p.locator('#data-yeast-body').innerText()), 'planner and yeast boxes show data, labelled simulated, with no impossible numbers');
    T.ok(await p.evaluate(k => { const d = JSON.parse(localStorage.getItem(k)); return d.v === 1 && d.pedigree.guesses.lakita[0] === 'AB' && Array.isArray(d.responseIds) && d.question && d.question.ok; }, KEY), 'scene data and question are saved in the activity record');
    T.ok(await p.evaluate(() => localStorage.getItem('aplab:openscied:b3-dna-p53:v1') === null && localStorage.getItem('aplab:openscied:b3-cell-cycle:v1') === null), 'other activities\' keys are untouched');

    // --- text boxes save, reload, Resume ---
    await go(p, 'ideas');
    await p.fill('#ideas-a', 'Maybe an inherited allele.');
    await go(p, 'wrapup');
    await p.fill('#wrap-sentence', 'Risk comes from genes, environment and chance.');
    await p.check('#tr-b2');
    await p.reload();
    await p.waitForFunction(() => window.B3Inh && document.querySelector('.step.is-current'));
    T.ok(await p.inputValue('#ideas-a') === 'Maybe an inherited allele.' && await p.inputValue('#wrap-sentence') !== '' && await p.isChecked('#tr-b2'), 'text and chips survive a reload');
    T.ok(await p.isChecked('input[name="exit-q1"][value="b"]') && /^Yes\./.test(await fb(p, 'exit-q1')) && /Higher/.test(await p.locator('#data-twogene-body').innerText()), 'choices, their feedback and scene data survive a reload');
    T.ok(await p.locator('#qt-question').innerText() === 'What is the effect of the time under UV light on the number of yeast colonies?', 'Question Tool survives a reload');
    T.ok((await p.locator('#order-meiosis .order-picked li').allInnerTexts()).length === 4, 'tap order survives a reload');
    T.ok(await p.evaluate(k => JSON.parse(localStorage.getItem(k)).lastSection, KEY) === 'wrapup', 'last section saved');
    await p.goto(server.url + PAGE);
    await p.waitForFunction(() => window.B3Inh && document.querySelector('.step.is-current'));
    T.ok(await p.locator('#resume-bar').isVisible(), 'Resume bar appears without a hash');
    await p.locator('#resume-bar a').click();
    await p.waitForFunction(() => document.querySelector('#wrapup.is-current'));
    T.ok(/choice questions answered/.test(await p.locator('#investigation-report').innerText()) && /Risk comes from genes/.test(await p.locator('#investigation-report').innerText()), 'report shows picks and written answers');

    // --- download ---
    const [dl] = await Promise.all([p.waitForEvent('download'), p.locator('#download-work').click()]);
    const payload = JSON.parse(fs.readFileSync(await dl.path(), 'utf8'));
    T.ok(payload.format === 'openscied-b3-inheritance-environment-progress-v1' && payload.student && payload.student.name === 'Test Student' && /SIMULATED/.test(payload.dataNote), 'download has format, student, and the simulated label');
    T.ok(payload.choices.find(c => c.id === 'exit-q1').result === 'correct' && payload.chips.length >= 4 && payload.written.find(w => w.id === 'wrap-sentence').answer !== '' && payload.question.ok, 'download captures what students picked');
    T.ok(Object.keys(payload).every(k => !/health|family|diagnos/i.test(k)), 'download has no personal-health fields');

    // --- clear this activity ---
    await p.locator('#reset-work').click();
    T.ok(await p.locator('#reset-dialog[open]').count() === 1, 'Clear opens the dialog');
    await p.locator('#cancel-reset').click();
    T.ok(await p.evaluate(k => !!localStorage.getItem(k), KEY), 'Cancel keeps the work');
    await p.locator('#reset-work').click();
    await Promise.all([p.waitForNavigation().catch(() => {}), p.locator('#confirm-reset').click()]);
    await p.waitForFunction(() => window.B3Inh && document.querySelector('.step.is-current'));
    T.ok(await p.evaluate(k => localStorage.getItem(k), KEY) === null, 'confirming clears the record and the page does not re-save it');
    T.ok(await p.inputValue('#ideas-a') === '' && !(await p.isChecked('input[name="exit-q1"][value="b"]')) && (await fb(p, 'exit-q1')) === '' && await p.locator('#order-meiosis .order-picked li').count() === 0, 'cleared page is blank, with no stale marks');
    T.ok(await p.evaluate(() => !!localStorage.getItem('aplab:student')), 'name and class period stay saved');
    await p.close(); await ctx.close();

    // --- layouts and controls ---
    for (const [w, h, dark] of [[390, 844, true], [1366, 900, false]]) {
      const c = await T.ctxFor(browser, { width: w, height: h, dark });
      const q = await c.newPage();
      await stub(q);
      await q.goto(server.url + PAGE);
      await q.waitForFunction(() => document.querySelector('.step.is-current'));
      let bad = [];
      for (const id of SECTIONS) {
        await go(q, id);
        const over = await q.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        if (over > 0) bad.push(id + ' +' + over);
        const small = await q.evaluate(() => Array.from(document.querySelectorAll('.step.is-current button, .step.is-current a.btn, .step.is-current input[type=checkbox], .step.is-current input[type=radio]')).filter(e => { const r = e.getBoundingClientRect(); return r.width && (r.width < 24 || r.height < 24); }).length);
        if (small) bad.push(id + ' has ' + small + ' small controls');
      }
      T.ok(bad.length === 0, w + ' px: no sideways scroll and controls at least 24 px ' + bad.join(', '));
      await c.close();
    }
  } finally { await browser.close(); server.close(); }
  T.done('t96-inheritance-page');
})().catch(e => { console.error(e); process.exit(1); });
