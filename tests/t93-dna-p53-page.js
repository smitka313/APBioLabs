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
    T.ok(/GoatCounter/.test(foot) && /Nothing you type/.test(foot), 'privacy line');
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
      T.ok(await p.locator(notice).isVisible() && /Interactive model coming in the next update/.test(await p.locator(notice).innerText()), id + ' shows the coming-soon notice while no scene script is registered');
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

    // --- fields save and restore across reload; last section ---
    await p.evaluate(h => { location.hash = h; }, 'ideas');
    await p.fill('#ideas-chromosomes', 'Chromosomes hold DNA.');
    await p.evaluate(h => { location.hash = h; }, 'sense5');
    await p.fill('#ms5-q1', 'So the letters can be reached.');
    await p.evaluate(h => { location.hash = h; }, 'checklist');
    await p.fill('#cl-process-have', 'Unwind, unzip, pair A-T and G-C.');
    T.ok(/0 of 7|1 of 7/.test(await p.locator('#checklist-count').innerText()) && /1 of 7 rows/.test(await p.locator('#checklist-count').innerText()), 'checklist count updates');
    T.ok(/Add where it came from/.test(await p.locator('#cl-status-process').innerText()), 'row asks for a source (text, not color)');
    await p.check('#cl-process-src-sim');
    T.ok(/✓ Evidence and source/.test(await p.locator('#cl-status-process').innerText()), 'row shows a check once evidence and source are given');
    T.ok(await p.locator('#cl-row-process.is-done').count() === 1, 'row marked complete');
    await p.evaluate(h => { location.hash = h; }, 'explain');
    T.ok(/Chromosomes hold DNA\./.test(await p.locator('#first-ideas-text').innerText()), 'first ideas appear in the explanation section');
    await p.reload();
    await p.waitForFunction(() => window.B3DnaP53 && document.querySelector('.step.is-current'));
    T.ok(await p.inputValue('#ideas-chromosomes') === 'Chromosomes hold DNA.' && await p.inputValue('#ms5-q1') === 'So the letters can be reached.', 'written answers survive a reload');
    T.ok(await p.isChecked('#cl-process-src-sim') && await p.inputValue('#cl-process-have') !== '', 'checklist row survives a reload');
    T.ok(/8\.3%/.test(await p.locator('#data-fork-body').innerText()), 'model data survives a reload');
    T.ok(await p.evaluate(k => JSON.parse(localStorage.getItem(k)).lastSection, KEY) === 'explain', 'last section saved');
    await p.goto(server.url + PAGE);
    await p.waitForFunction(() => window.B3DnaP53 && document.querySelector('.step.is-current'));
    T.ok(await p.locator('#resume-bar').isVisible(), 'Resume bar appears when reopening without a hash');
    await p.locator('#resume-bar a').click();
    await p.waitForFunction(() => document.querySelector('#explain.is-current'));
    T.ok(true, 'Resume returns to the last section');

    // --- explanation self-check ---
    for (let i = 0; i < 6; i++) await p.check('#ex-el-' + i);
    T.ok(/^✓ ?Organized|Organized:/.test(await p.locator('#self-level').innerText()) && await p.locator('#self-level').getAttribute('data-level') === 'organized', 'all six ideas gives the Organized message');
    await p.uncheck('#ex-el-0'); await p.uncheck('#ex-el-5');
    T.ok(await p.locator('#self-level').getAttribute('data-level') === 'linked', 'fewer ideas drops to Linked (stale Organized mark removed)');
    for (let i = 1; i < 6; i++) await p.uncheck('#ex-el-' + i);
    T.ok(await p.locator('#self-level').getAttribute('data-level') === 'none', 'no ideas gives the starting message');

    // --- sentence check ---
    await p.evaluate(h => { location.hash = h; }, 'expression');
    await p.locator('#check-sentence').click();
    T.ok(/Choose a strand/.test(await p.locator('#sentence-feedback').innerText()), 'sentence check asks for input');
    await p.selectOption('#expr-strand', 'B');
    await p.fill('#expr-sentence', 'i am a p53 protein missing a piece');
    await p.locator('#check-sentence').click();
    T.ok(/✓ Match/.test(await p.locator('#sentence-feedback').innerText()), 'strand B sentence matches the key');
    await p.fill('#expr-sentence', 'I am a p53 protein with a butterfly shape.');
    T.ok(await p.locator('#sentence-feedback').innerText() === '', 'feedback clears when the sentence changes');
    await p.locator('#check-sentence').click();
    T.ok(/key sentence for Strand A/.test(await p.locator('#sentence-feedback').innerText()), 'a sentence that fits another strand says so');

    // --- exit ticket ---
    await p.evaluate(h => { location.hash = h; }, 'wrapup');
    await p.locator('[data-check="exit-q2"]').click();
    T.ok(/Choose one answer first/.test(await p.locator('#feedback-exit-q2').innerText()), 'exit check asks for a choice');
    await p.check('input[name="exit-q2"][value="a"]');
    await p.locator('[data-check="exit-q2"]').click();
    T.ok(/Try again\. Why not/.test(await p.locator('#feedback-exit-q2').innerText()), 'a partial answer is not marked correct and says why');
    await p.check('input[name="exit-q2"][value="e"]');
    T.ok(await p.locator('#feedback-exit-q2').innerText() === '', 'feedback clears when the choice changes');
    await p.locator('[data-check="exit-q2"]').click();
    T.ok(/^Yes\./.test(await p.locator('#feedback-exit-q2').innerText()), 'Q2 "all of the above" is correct');
    await p.check('input[name="exit-q1"][value="a"]'); await p.locator('[data-check="exit-q1"]').click();
    T.ok(/^Yes\./.test(await p.locator('#feedback-exit-q1').innerText()), 'Q1 correct answer accepted');
    await p.check('input[name="exit-q1"][value="c"]'); await p.locator('[data-check="exit-q1"]').click();
    T.ok(/leaves out/.test(await p.locator('#feedback-exit-q1').innerText()), 'Q1 wrong answer explains what it leaves out');
    await p.check('input[name="exit-q4"][value="d"]'); await p.locator('[data-check="exit-q4"]').click();
    T.ok(/^Yes\./.test(await p.locator('#feedback-exit-q4').innerText()), 'Q4 all of the above is correct');
    await p.reload();
    await p.waitForFunction(() => window.B3DnaP53);
    T.ok(await p.isChecked('input[name="exit-q2"][value="e"]') && /^Yes\./.test(await p.locator('#feedback-exit-q2').innerText()), 'exit answers and their feedback survive a reload');

    // --- download ---
    await p.evaluate(h => { location.hash = h; }, 'wrapup');
    const [dl] = await Promise.all([p.waitForEvent('download'), p.locator('#download-work').click()]);
    const file = await dl.path();
    const payload = JSON.parse(fs.readFileSync(file, 'utf8'));
    T.ok(payload.format === 'openscied-b3-dna-p53-progress-v1' && payload.student && payload.student.name === 'Test Student', 'download has format and student');
    T.ok(payload.fork && payload.forkSummary.before.top.rate === 8.3 && payload.expression.runs.length === 1, 'download carries fork and expression data');
    T.ok(/simulated/i.test(payload.dataNote), 'download labels the data as simulated');
    T.ok(payload.responses['ms5-q1'].answer === 'So the letters can be reached.' && /^[A-Za-z0-9]/.test(payload.responses['ms5-q1'].prompt), 'download lists responses with prompts');
    T.ok(payload.exitTicket['exit-q2'].correct === true && payload.checklist.length === 7 && payload.checklist.find(r => /process of replication/.test(r.row)).sources.includes('Simulation'), 'download has exit ticket and checklist');

    // --- clear this activity ---
    await p.locator('#reset-work').click();
    T.ok(await p.locator('#reset-dialog[open]').count() === 1, 'Clear this activity opens the page dialog');
    await p.locator('#cancel-reset').click();
    T.ok(await p.evaluate(k => !!localStorage.getItem(k), KEY), 'Cancel keeps the saved work');
    await p.locator('#reset-work').click();
    await Promise.all([p.waitForNavigation().catch(() => {}), p.locator('#confirm-reset').click()]);
    await p.waitForFunction(() => window.B3DnaP53 && document.querySelector('.step.is-current'));
    T.ok(await p.evaluate(k => localStorage.getItem(k), KEY) === null, 'confirming clears the saved record and the page does not re-save it');
    T.ok(await p.inputValue('#ideas-chromosomes') === '' && /Run the model first/.test(await p.locator('#data-fork-body').innerText()), 'cleared page is blank');
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

    // --- keyboard reachability: every field in a section is reachable by Tab ---
    const c2 = await T.ctxFor(browser, { width: 1366, height: 900 });
    const k = await c2.newPage();
    await stub(k);
    await k.goto(server.url + PAGE + '#checklist');
    await k.waitForFunction(() => document.querySelector('#checklist.is-current'));
    const seen = new Set();
    for (let i = 0; i < 80; i++) { await k.keyboard.press('Tab'); const id = await k.evaluate(() => document.activeElement && document.activeElement.id); if (id) seen.add(id); }
    T.ok(['cl-relation-have', 'cl-relation-src-sim', 'cl-cancer-need', 'gotta-ideas'].every(x => seen.has(x)), 'checklist fields and source boxes are reachable with Tab');
    // reduced motion: page still renders complete
    await c2.close();
  } finally { await browser.close(); server.close(); }
  T.done('t93-dna-p53-page');
})().catch(e => { console.error(e); process.exit(1); });
