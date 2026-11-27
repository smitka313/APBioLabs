/* DNA Copying, p53 and Gene Expression companion (OpenSciEd B.3 Lessons 5-6): page load, navigation, saving, checklist,
   exit ticket, clear dialog, download, attribution and title, layouts, accessibility basics and the scene placeholders.
   Run: NODE_PATH=$(npm root -g) node tests/t93-dna-p53-page.js */
const T = require('./_h');
const fs = require('fs');
const path = require('path');
const PAGE = 'openscied-b3-dna-p53.html', KEY = 'aplab:openscied:b3-dna-p53:v1';
// The sandbox has no network: answer the web font and analytics requests with empty files so they do not log errors.
const stub = pg => pg.route(/gc\.zgo\.at|fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, contentType: /gc\.zgo\.at/.test(r.request().url()) ? 'application/javascript' : 'text/css', body: '' }));
const SECTIONS = ['overview', 'ideas', 'fork', 'sense5', 'checklist', 'explain', 'expression', 'sense6', 'wrapup'];
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
    // This test is about the page contract with no scene present: serve the scene scripts empty (the scenes have their own tests, t94-*).
    await p.route(/(dna-replication|gene-expression)-scene\.js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
    await p.goto(server.url + PAGE);
    await p.waitForFunction(() => window.B3DnaP53 && document.querySelector('.step.is-current'));

    // --- load and title rule ---
    T.ok(problems.length === 0, 'page loads without console errors or failed requests ' + problems.join(' | '));
    const title = await p.title();
    T.ok(/^DNA Copying, p53 and Gene Expression/.test(title) && !/^OpenSciEd/i.test(title), 'title does not lead with the OpenSciEd mark: ' + title);
    T.ok(/companion for OpenSciEd Biology B\.3/.test(title), 'title names the companion relationship');
    T.ok(await p.locator('script[type="application/ld+json"]').count() === 1, 'JSON-LD present');

    // --- attribution and footer ---
    const foot = await p.locator('.site-footer').innerText();
    T.ok(/^Created by Robert Smitka\./.test(foot), 'footer starts "Created by Robert Smitka."');
    T.ok(/Lessons 5–6 of OpenSciEd Biology Unit B\.3: Inheritance & Variation of Traits/.test(foot), 'footer credits OpenSciEd Biology B.3 Lessons 5-6');
    T.ok(await p.locator('.site-footer a[href="https://creativecommons.org/licenses/by-nc/4.0/"]').count() === 1, 'footer links CC BY-NC 4.0');
    T.ok(await p.locator('.site-footer a[href="https://www.openscied.org/"]').count() >= 1, 'footer links openscied.org');
    T.ok(/Adapted and reorganized as an interactive companion; the models, reading summaries and questions are new/.test(foot), 'footer states what was changed');
    T.ok(/Not affiliated with, endorsed by, or sponsored by OpenSciEd/.test(foot), 'non-endorsement line');
    T.ok(/counts page visits without cookies/.test(foot) && /Student names and answers stay in this browser unless you choose to share them/.test(foot) && !/GoatCounter/i.test(foot), 'plain privacy line');
    T.ok(await p.locator('script[data-goatcounter]').count() === 1, 'one page-visit tracker remains');
    T.ok(await p.locator('.attribution a[href="https://creativecommons.org/licenses/by-nc/4.0/"]').count() === 1, 'attribution block links the license');

    // --- section navigation ---
    const navCount = await p.locator('.step-nav a[href^="#"]').count();
    T.ok(navCount === 9, 'nine sections in the step nav');
    T.ok(await p.locator('main > section.step').count() === 9, 'nine section elements');
    for (const id of SECTIONS) {
      await p.evaluate(h => { location.hash = h; }, id);
      await p.waitForFunction(h => document.querySelector('#' + h + '.is-current'), id);
    }
    T.ok(await p.locator('#wrapup.is-current').count() === 1, 'hash navigation reaches the last section');
    await p.locator('.step-nav a[href="#ideas"]').click();
    await p.waitForFunction(() => document.querySelector('#ideas.is-current'));
    T.ok(await p.locator('#ideas.is-current .pager-next').count() === 1, 'pager Next button present');
    await p.locator('#ideas .pager-next').click();
    await p.waitForFunction(() => document.querySelector('#fork.is-current'));
    T.ok(true, 'pager Next moves to the DNA fork');

    // --- single live region, scene placeholders ---
    T.ok(await p.locator('[aria-live], [role=status], [role=alert]').count() === 1, 'exactly one live region on the page');
    for (const [id, notice] of [['dna-fork-scene', '#dna-fork-notice'], ['gene-expression-scene', '#gene-expression-notice']]) {
      T.ok(await p.locator('#' + id + ' canvas[role="img"][aria-label]').count() === 1, id + ' has a canvas with role and aria-label');
      T.ok((await p.locator('#' + id + ' .scene-desc').innerText()).length > 30, id + ' has a text description');
      await p.evaluate(h => { location.hash = h; }, id === 'dna-fork-scene' ? 'fork' : 'expression');
      const mounted = await p.locator('#' + id + '[data-mounted]').count() === 1;   // a registered scene hides the notice
      T.ok(mounted ? await p.locator(notice).isHidden() : await p.locator(notice).isVisible() && /Interactive model coming in the next update/.test(await p.locator(notice).innerText()), id + (mounted ? ' hides the coming-soon notice once its scene registers' : ' shows the coming-soon notice while no scene script is registered'));
    }
    T.ok(await p.evaluate(() => { const c = document.querySelector('#dna-fork-scene canvas'); return c.width > 0 && c.height > 0; }), 'placeholder canvas is drawn');

    // --- scene contract: a registered scene removes the notice and its data fills the boxes ---
    await p.evaluate(h => { location.hash = h; }, 'fork');
    T.ok(/Run the model first/.test(await p.locator('#data-fork-body').innerText()), 'Your data box says "Run the model first" before any data');
    await p.evaluate(() => {
      window.__mounted = 0;
      B3DnaP53.registerScene({ id: 'fork', mount(host, api) { window.__mounted++; api.saveFork({ before: { top: { correct: 11, substitutions: 1 }, bottom: { correct: 10, substitutions: 2 } }, p53: { a: { tried: 2, removed: 3 }, b: { tried: 1, removed: 0 }, c: { tried: 1, removed: 0 } }, after: { top: { correct: 12, substitutions: 0 }, bottom: { correct: 12, substitutions: 0 } } }); } });
    });
    T.ok(await p.evaluate(() => window.__mounted) === 1, 'registerScene mounts the scene once');
    T.ok(await p.locator('#dna-fork-notice').isHidden(), 'notice hides once a scene registers');
    const forkText = await p.locator('#data-fork-body').innerText();
    T.ok(/8\.3%/.test(forkText) && /16\.7%/.test(forkText) && /0\.0%/.test(forkText), 'fork data box shows substitution rates computed from counts (8.3, 16.7, 0.0)');
    T.ok(/p53 \(a\): applied 2 times, removed 3 substitutions/.test(forkText), 'p53 results listed');
    T.ok(/8\.3%/.test(await p.locator('#data-sense5-body').innerText()), 'Lesson 5 Making Sense data box shows the same data');
    await p.evaluate(() => B3DnaP53.addExpressionRun({ strand: 'A', sentence: 'I am a p53 protein with a butterfly shape.', matchesKey: true, aminoAcids: ['Phe', 'Ser'], injectedError: false }));
    T.ok(/butterfly shape/.test(await p.locator('#data-sense6-body').innerText()) && /✓ matches the key/.test(await p.locator('#data-expression-body').innerText()), 'expression data boxes show the run with a text mark');
    T.ok(await p.evaluate(k => { const d = JSON.parse(localStorage.getItem(k)); return d.v === 1 && d.fork.before.top.correct === 11 && d.expression.runs.length === 1 && Array.isArray(d.responseIds); }, KEY), 'scene data saved in the activity record');
    T.ok(await p.evaluate(() => localStorage.getItem('aplab:openscied:b3-cell-cycle:v1')) === null, 'cell-cycle key is untouched');

    // --- cards save and restore across reload; last section ---
    // Row cards are dropdowns (the radios stay hidden as stored state); the other cards are tap cards.
    const pick = async (name, value) => {
      const radio = p.locator('input[name="' + name + '"][value="' + value + '"]');
      if (await radio.isVisible()) return radio.check();
      const row = p.locator('.rrow:has(input[name="' + name + '"])');
      return row.locator('select.rsel').selectOption(value);
    };
    await p.evaluate(h => { location.hash = h; }, 'ideas');
    await pick('p-ideas-chrom-r', 'a');
    T.ok(/Saved/.test(await p.locator('[data-q="p-ideas-chrom"] .q-fb').innerText()), 'a poll card answers right away with a friendly note');
    await pick('p-ideas-game-r', 'b');
    T.ok(/did not match/.test(await p.locator('[data-q="p-ideas-game"] .q-fb').innerText()) && await p.locator('[data-q="p-ideas-game"] label[data-state="no"]').count() === 1, 'a wrong pick shows a reason and a text mark, not color alone');
    await pick('p-ideas-game-r', 'a');
    T.ok(/^Yes\./.test(await p.locator('[data-q="p-ideas-game"] .q-fb').innerText()) && await p.locator('[data-q="p-ideas-game"] label[data-state="ok"]').count() === 1, 'changing the pick replaces the feedback');
    await p.evaluate(h => { location.hash = h; }, 'sense5');
    await p.fill('#ms5-summary', 'A wrong letter stays, so the new cell differs.');
    await pick('p-ms5-p53-a', 'nofit');
    T.ok(!/^Yes\./.test(await p.locator('[data-q="p-ms5-p53"] .q-fb').innerText()), 'partial rows do not claim success');
    for (const l of ['A', 'T', 'G', 'C']) await pick('p-ms5-pairs-' + l, { A: 'T', T: 'A', G: 'C', C: 'G' }[l]);
    T.ok(/^Yes\./.test(await p.locator('[data-q="p-ms5-pairs"] .q-fb').innerText()), 'rows card is marked right once every row is right');
    await p.evaluate(h => { location.hash = h; }, 'checklist');
    await pick('cl-process-r', 'know');
    T.ok(/^1 of 7 ideas sorted\. 1 still needs a source/.test(await p.locator('#checklist-count').innerText()) && /Tap where you learned it/.test(await p.locator('#cl-status-process').innerText()), 'a "know" row asks for a source (text, not color)');
    T.ok(/You marked: ✓ I know it/.test(await p.locator('.key-list li:nth-child(3) .key-mine').textContent()) && /not sorted yet/.test(await p.locator('.key-list li:nth-child(1) .key-mine').textContent()), 'the key ideas list shows how each idea was sorted (item 3 known, item 1 not sorted yet)');
    await p.check('#cl-process-src-sim');
    T.ok(/✓ Know it, with a source/.test(await p.locator('#cl-status-process').innerText()) && /1 of 7/.test(await p.locator('#checklist-count').innerText()) && await p.locator('#cl-row-process.is-done').count() === 1, 'row is complete once it has a status and a source');
    await pick('cl-why-r', 'need');
    T.ok(await p.locator('#cl-row-why.is-done').count() === 1 && await p.locator('#cl-row-why fieldset.src').isHidden(), 'an "I need it" row is complete and hides the source chooser');
    T.ok(/2 of 7/.test(await p.locator('#checklist .sec-progress .txt').innerText()), 'section progress counts the sorted rows');
    await p.evaluate(h => { location.hash = h; }, 'explain');
    T.ok(/one long piece of DNA/.test(await p.locator('#first-ideas-text').innerText()), 'first ideas appear in the explanation section');
    await p.reload();
    await p.waitForFunction(() => window.B3DnaP53 && document.querySelector('.step.is-current'));
    T.ok(await p.inputValue('#ms5-summary') === 'A wrong letter stays, so the new cell differs.' && await p.isChecked('input[name="p-ideas-game-r"][value="a"]'), 'text and card answers survive a reload');
    T.ok(await p.isChecked('#cl-process-src-sim') && await p.isChecked('input[name="cl-process-r"][value="know"]'), 'checklist row survives a reload');
    T.ok(/8\.3%/.test(await p.locator('#data-fork-body').innerText()), 'model data survives a reload');
    T.ok(await p.evaluate(k => JSON.parse(localStorage.getItem(k)).lastSection, KEY) === 'explain', 'last section saved');
    await p.goto(server.url + PAGE);
    await p.waitForFunction(() => window.B3DnaP53 && document.querySelector('.step.is-current'));
    T.ok(await p.locator('#resume-bar').isVisible(), 'Resume bar appears when reopening without a hash');
    await p.locator('#resume-bar a').click();
    await p.waitForFunction(() => document.querySelector('#explain.is-current'));
    T.ok(true, 'Resume returns to the last section');

    // --- build your explanation (replaces the six self-check boxes) ---
    const BEST = { copy: 'a', mistake: 'a', p53: 'a', versions: 'a', fate: 'a', evidence: 'b' };
    for (const k of Object.keys(BEST)) await pick('p-explain-' + k, BEST[k]);
    T.ok(await p.locator('#self-level').getAttribute('data-level') === 'organized' && /^Organized/.test(await p.locator('#self-level').innerText()), 'all six best endings give the Organized message');
    T.ok(await p.locator('#built-explanation li').count() === 6, 'the picks are assembled into a readable explanation');
    await pick('p-explain-copy', 'b'); await pick('p-explain-evidence', 'a');
    T.ok(await p.locator('#self-level').getAttribute('data-level') === 'linked', 'a wrong ending drops to Linked (stale Organized mark removed)');
    T.ok(await p.evaluate(() => !document.getElementById('ex-el-0').checked && document.getElementById('ex-el-1').checked), 'the old self-check boxes still follow the picks');
    for (const k of ['mistake', 'p53', 'versions', 'fate']) await pick('p-explain-' + k, 'b');
    T.ok(['foundational', 'none'].includes(await p.locator('#self-level').getAttribute('data-level')), 'few right endings drops the level');

    // --- sentence builder and check ---
    await p.evaluate(h => { location.hash = h; }, 'expression');
    await p.locator('#check-sentence').click();
    T.ok(/Choose a strand/.test(await p.locator('#sentence-feedback').innerText()), 'sentence check asks for input');
    await pick('expr-strand-r', 'B');
    for (const w of 'I am a p53 protein missing a piece'.split(' ')) await p.locator('#sentence-check .word[data-word="' + w + '"]').click();
    T.ok(await p.locator('#built-sentence').evaluate(e => e.textContent) === 'I am a p53 protein missing a piece.', 'tapped words build a sentence with a capital and a full stop');
    await p.locator('#check-sentence').click();
    T.ok(/✓ Match/.test(await p.locator('#sentence-feedback').innerText()), 'strand B sentence matches the key');
    await p.locator('#undo-word').click();
    T.ok(await p.locator('#sentence-feedback').innerText() === '' && await p.locator('#built-sentence').evaluate(e => e.textContent) === 'I am a p53 protein missing a.', 'feedback clears and Undo removes the last word');
    await p.locator('#clear-sentence').click();
    for (const w of 'I am a p53 protein with a butterfly shape'.split(' ')) await p.locator('#sentence-check .word[data-word="' + w + '"]').click();
    await p.locator('#check-sentence').click();
    T.ok(/key sentence for Strand A/.test(await p.locator('#sentence-feedback').innerText()), 'a sentence that fits another strand says so');

    // --- exit ticket: immediate feedback, no Check button ---
    await p.evaluate(h => { location.hash = h; }, 'wrapup');
    T.ok(await p.locator('[data-check]').count() === 0, 'no Check buttons: feedback is immediate');
    await pick('exit-q2-r', 'a');
    T.ok(/Try again\. Why not/.test(await p.locator('[data-q="exit-q2"] .q-fb').innerText()), 'a partial answer is not marked correct and says why');
    await pick('exit-q2-r', 'e');
    T.ok(/^Yes\./.test(await p.locator('[data-q="exit-q2"] .q-fb').innerText()), 'Q2 complete sequence-to-function explanation is correct');
    await pick('exit-q1-r', 'a');
    T.ok(/^Yes\./.test(await p.locator('[data-q="exit-q1"] .q-fb').innerText()), 'Q1 correct answer accepted');
    await pick('exit-q1-r', 'c');
    T.ok(/leaves out/.test(await p.locator('[data-q="exit-q1"] .q-fb').innerText()), 'Q1 wrong answer explains what it leaves out');
    await pick('exit-q4-r', 'd');
    T.ok(/^Yes\./.test(await p.locator('[data-q="exit-q4"] .q-fb').innerText()), 'Q4 complete sequence comparison is correct');
    await p.check('[data-q="p-exit5"] input[value="model"]'); await p.check('[data-q="p-exit5"] input[value="people"]');
    T.ok(await p.evaluate(() => document.getElementById('p-exit5').value) === 'model,people', 'a multi-pick card stores the chosen values');
    await p.reload();
    await p.waitForFunction(() => window.B3DnaP53);
    T.ok(await p.isChecked('input[name="exit-q2-r"][value="e"]') && /^Yes\./.test(await p.locator('[data-q="exit-q2"] .q-fb').innerText()), 'exit answers and their feedback survive a reload');
    T.ok(await p.evaluate(k => JSON.parse(localStorage.getItem(k)).fields['exit-q2'], KEY) === 'e', 'the old exit-ticket field id still holds the answer');

    // --- download ---
    await p.evaluate(k => { const d = JSON.parse(localStorage.getItem(k)); d.fields['ms5-q1'] = 'Older long answer'; d.fields['cl-why-have'] = 'old evidence'; localStorage.setItem(k, JSON.stringify(d)); }, KEY);
    await p.reload();
    await p.waitForFunction(() => window.B3DnaP53);
    await p.evaluate(h => { location.hash = h; }, 'wrapup');
    await p.fill('#exit-q7', 'My partner helped.');
    await p.locator("details.ose-report-other > summary").click();
    const [dl] = await Promise.all([p.waitForEvent('download'), p.locator('#download-work').click()]);
    const file = await dl.path();
    const payload = JSON.parse(fs.readFileSync(file, 'utf8'));
    T.ok(payload.format === 'openscied-b3-dna-p53-progress-v1' && payload.student && payload.student.name === 'Test Student', 'download has format and student');
    T.ok(payload.fork && payload.forkSummary.before.top.rate === 8.3 && payload.expression.runs.length === 1, 'download carries fork and expression data');
    T.ok(/simulated/i.test(payload.dataNote), 'download labels the data as simulated');
    T.ok(payload.responses['ms5-summary'].answer === 'A wrong letter stays, so the new cell differs.' && /^[A-Za-z0-9]/.test(payload.responses['ms5-summary'].prompt), 'download lists responses with prompts');
    T.ok(payload.responses['p-ms5-pairs'].answerText.includes('A with: T') && payload.responses['p-ideas-game'].answerText.startsWith('different from the others'), 'download carries what was picked, in words');
    const clRow = re => payload.checklist.find(r => re.test(r.row));
    T.ok(payload.exitTicket['exit-q2'].correct === true && payload.checklist.length === 7 && clRow(/steps of copying/).sources.includes('Simulation') && clRow(/steps of copying/).status === 'know', 'download has exit ticket and checklist');
    T.ok(payload.earlierAnswers['ms5-q1'].answer === 'Older long answer' && payload.answers['ms5-q1'] === 'Older long answer' && clRow(/Why, how and when/).evidenceIHave === 'old evidence', 'answers from the older page stay in the download');
    const rep = await p.locator('#investigation-report').innerText();
    T.ok(/My partner helped/.test(rep) && /Older long answer/.test(rep), 'the on-page report shows typed text and older answers');

    // --- clear this activity ---
    await p.locator('#reset-work').click();
    T.ok(await p.locator('#reset-dialog[open]').count() === 1, 'Clear this activity opens the page dialog');
    await p.locator('#cancel-reset').click();
    T.ok(await p.evaluate(k => !!localStorage.getItem(k), KEY), 'Cancel keeps the saved work');
    await p.locator('#reset-work').click();
    await Promise.all([p.waitForNavigation().catch(() => {}), p.locator('#confirm-reset').click()]);
    await p.waitForFunction(() => window.B3DnaP53 && document.querySelector('.step.is-current'));
    T.ok(await p.evaluate(k => localStorage.getItem(k), KEY) === null, 'confirming clears the saved record and the page does not re-save it');
    T.ok(await p.inputValue('#ms5-summary') === '' && /Run the model first/.test(await p.locator('#data-fork-body').innerText()), 'cleared page is blank');
    T.ok(await p.evaluate(() => !!localStorage.getItem('aplab:student')), 'name and class period stay saved');
    await p.close();
    await ctx.close();

    // --- layouts: no sideways scroll at phone and desktop ---
    for (const [w, h, dark] of [[390, 844, true], [1366, 900, false]]) {
      const c = await T.ctxFor(browser, { width: w, height: h, dark });
      const q = await c.newPage();
      await stub(q);
      await q.goto(server.url + PAGE);
      await q.waitForFunction(() => document.querySelector('.step.is-current'));
      let worst = 0, bad = [];
      for (const id of SECTIONS) {
        await q.evaluate(x => { location.hash = x; }, id);
        await q.waitForFunction(x => document.querySelector('#' + x + '.is-current'), id);
        const over = await q.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        if (over > 0) bad.push(id + ' +' + over); worst = Math.max(worst, over);
        if (w < 600) { await q.waitForTimeout(150); const wide = await q.evaluate(() => document.querySelectorAll('.step.is-current .table-wrap.is-scrollable').length); if (wide) bad.push(id + ' has a table that scrolls sideways'); }
      }
      T.ok(bad.length === 0, w + ' px: no horizontal overflow in any section ' + bad.join(', '));
      const small = await q.evaluate(() => Array.from(document.querySelectorAll('.step.is-current button, .step.is-current a.btn, .step.is-current input[type=checkbox], .step.is-current input[type=radio]')).filter(e => { const r = e.getBoundingClientRect(); return r.width && (r.width < 24 || r.height < 24); }).length);
      T.ok(small === 0, w + ' px: controls in the current section are at least 24 px');
      await c.close();
    }

    // --- keyboard reachability: cards and chips are reachable by Tab ---
    const c2 = await T.ctxFor(browser, { width: 1366, height: 900 });
    const k = await c2.newPage();
    await stub(k);
    await k.goto(server.url + PAGE + '#checklist');
    await k.waitForFunction(() => document.querySelector('#checklist.is-current'));
    await k.check('input[name="cl-relation-r"][value="know"]');
    const seen = new Set();
    for (let i = 0; i < 60; i++) { await k.keyboard.press('Tab'); const id = await k.evaluate(() => document.activeElement && (document.activeElement.id || document.activeElement.name)); if (id) seen.add(id); }
    T.ok(['cl-relation-r', 'cl-relation-src-sim', 'cl-cancer-r'].every(x => seen.has(x)), 'checklist taps and source boxes are reachable with Tab');
    // reduced motion: page still renders complete
    await c2.close();
  } finally { await browser.close(); server.close(); }
  T.done('t93-dna-p53-page');
})().catch(e => { console.error(e); process.exit(1); });
