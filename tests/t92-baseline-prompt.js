/* Lesson 4 alignment: a "Before you run the model" baseline. It saves with the activity, survives a reload, is shown
   again as "Your starting idea" at Question 7, counts in the dashboard and the download, and old saves without it work.
   T92_ROOT=<dir> runs the same checks against another copy of the site (used to prove the test fails on old code). */
const T = require('./_h');
const fs = require('node:fs');
const KEY = 'aplab:openscied:b3-cell-cycle:v1';
const TEXT = 'I think cells that divide more often get more mistakes because they copy DNA more.';
(async () => {
  const browser = await T.launch(), server = await T.serve(process.env.T92_ROOT || undefined);
  try {
    const ctx = await T.ctxFor(browser, { width: 1366, height: 900, reduced: true });
    const p = await T.open(ctx, 'openscied-b3-cell-cycle.html', 'growth-model', server.url);
    const ta = p.locator('#model-baseline');
    T.ok(await ta.count() === 1, 'the baseline textarea exists');
    T.ok(await ta.count() === 1 && await ta.evaluate(el => { const s = document.getElementById('growth-model'), c = document.getElementById('run-trials'); return s.contains(el) && !!(el.compareDocumentPosition(c) & Node.DOCUMENT_POSITION_FOLLOWING); }), 'it sits in the Growth model section, before the controls');
    T.ok(/Before you run the model/.test(await p.locator('label[for="model-baseline"]').textContent().catch(() => '')), 'its label says "Before you run the model"');
    T.ok(/I think cells that divide more often/.test((await ta.getAttribute('placeholder', { timeout: 1000 }).catch(() => '')) || '') && /on paper|sketch/i.test(await p.locator('#hint-baseline').textContent().catch(() => '')), 'sentence starter and a paper-sketch invitation');
    await ta.fill(TEXT, { timeout: 2000 });
    await p.waitForFunction(k => /divide more often get more/.test(localStorage.getItem(k) || ''), KEY);
    const saved = await p.evaluate(k => JSON.parse(localStorage.getItem(k)), KEY);
    T.ok(saved.fields['model-baseline'] === TEXT && saved.responseIds.includes('model-baseline'), 'saved in fields and in the response-id list');
    await p.reload(); await p.waitForTimeout(500);
    T.ok(await p.locator('#model-baseline').inputValue() === TEXT, 'it is restored after a reload');
    const echo = await p.evaluate(() => { const e = document.getElementById('baseline-echo'), q = document.getElementById('model-revision'); return e ? { text: e.innerText, before: e.parentNode === q.parentNode && !!(e.compareDocumentPosition(q) & Node.DOCUMENT_POSITION_FOLLOWING) } : null; });
    T.ok(echo && /Your starting idea/i.test(echo.text) && echo.text.includes(TEXT) && echo.before, 'Question 7 shows "Your starting idea" with the text, above its answer box');
    await p.locator('#model-baseline').fill('');
    await p.waitForTimeout(200);
    T.ok(await p.evaluate(() => /did not write a starting idea/.test((document.getElementById('baseline-echo') || { innerText: '' }).innerText)), 'with no baseline, Question 7 says so kindly');
    await p.locator('#model-baseline').fill(TEXT);
    await p.waitForFunction(k => /divide more often get more/.test(localStorage.getItem(k) || ''), KEY);
    const rep = await p.locator('#investigation-report').innerText();
    T.ok(rep.includes('My starting idea') && rep.includes(TEXT), 'the report on the Wrap up page includes it');
    const dl = p.waitForEvent('download');
    await p.evaluate(() => document.getElementById('download-work').click());
    const payload = JSON.parse(fs.readFileSync(await (await dl).path(), 'utf8'));
    T.ok(payload.answers['model-baseline'] === TEXT, 'the downloaded JSON carries it');
    const d = await T.open(ctx, 'openscied-dashboard.html', '', server.url);
    T.ok(/1 of \d+ responses written/.test(await d.locator('#cell-cycle-progress').textContent()), 'the dashboard counts it as a response');
    // An old save (no baseline field, no responseIds entry for it) still loads.
    await p.evaluate(k => localStorage.setItem(k, JSON.stringify({ v: 1, trials: [], fields: { 'analysis-design': 'x' }, responseIds: ['analysis-design'], lastSection: 'analyze' })), KEY);
    await p.reload(); await p.waitForTimeout(500);
    T.ok(await p.locator('#model-baseline').count() === 1 && await p.locator('#model-baseline').inputValue() === '' && p.errors.length === 0, 'an old save without the field loads with it empty and no errors ' + p.errors.join(';'));
  } catch (e) { T.ok(false, 'unexpected error: ' + e.message.split('\n')[0]); }
  await browser.close(); server.close(); T.done('t92-baseline-prompt');
})();
