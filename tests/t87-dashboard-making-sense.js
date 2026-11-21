/* The OpenSciEd dashboard counts every written-response field the Cell Cycle activity has: the 8 analysis answers
   and the 21 Lesson 3 Making Sense fields (Round 1 table, Round 2 Q1–4, three model-limits prompts). The list comes
   from the ids the activity saves (responseIds); older saves without it fall back to the same 31 fields. Progress,
   Resume and the download include the Making Sense answers. */
const T = require('./_h');
const fs = require('node:fs');
const KEY = 'aplab:openscied:b3-cell-cycle:v1';
(async () => {
  const browser = await T.launch(), server = await T.serve();
  try {
    const ctx = await T.ctxFor(browser, { width: 1366, height: 900, reduced: true });
    // 1. The activity saves the ids of every response field it has, and they match its textareas.
    const a = await T.open(ctx, 'openscied-b3-cell-cycle.html', 'cell-game', server.url);
    await a.locator('#ms-r1-g1-happened').fill('We rolled for nutrients');
    await a.locator('#ms-r2-q4').fill('Broken p53 lets damaged cells divide');
    await a.locator('#ms-limits-progress').fill('Look at real data');
    await a.waitForFunction(key => /Look at real data/.test(localStorage.getItem(key) || ''), KEY);
    const stored = await a.evaluate(key => JSON.parse(localStorage.getItem(key)), KEY);
    const ids = stored.responseIds || [];
    const textareas = await a.evaluate(() => Array.from(document.querySelectorAll('textarea[id]')).map(t => t.id));
    T.ok(ids.length === 31, 'the activity saves 31 response ids (' + ids.length + ')');
    T.ok(ids.filter(id => /^ms-/.test(id)).length === 21, '21 of them are Lesson 3 Making Sense fields');
    T.ok(ids.every(id => textareas.includes(id)), 'every saved response id is a textarea on the page');
    T.ok(textareas.filter(id => /^(ms-|analysis-|explanation|model-)/.test(id)).every(id => ids.includes(id)), 'every Making Sense / analysis textarea is in the saved list');
    // 2. Dashboard: Making Sense answers count and Resume goes to the game section where they live.
    const d = await T.open(ctx, 'openscied-dashboard.html', '', server.url);
    let progress = await d.locator('#cell-cycle-progress').textContent();
    T.ok(/3 of 31 responses written/.test(progress), 'dashboard counts the Making Sense answers: ' + progress);
    T.ok(/3 of 31 responses/.test(await d.locator('#openscied-resume-description').textContent()), 'Resume summary carries the same count');
    T.ok((await d.locator('#openscied-resume-link').getAttribute('href')) === 'openscied-b3-cell-cycle.html#cell-game', 'Resume opens the Cell-cycle game section (where Making Sense is)');
    // 3. Download includes a readable copy of the Making Sense answers next to the raw saved work.
    const dl = d.waitForEvent('download');
    await d.locator('#download-openscied-results').click();
    const payload = JSON.parse(fs.readFileSync(await (await dl).path(), 'utf8'));
    const r = payload.responses && payload.responses['cell-cycle'] || {};
    T.ok(Object.keys(r).length === 31 && r['ms-r2-q4'] === 'Broken p53 lets damaged cells divide' && r['ms-r1-g1-happened'] === 'We rolled for nutrients' && r['analysis-design'] === '',
      'download lists all 31 responses with the Making Sense answers');
    T.ok(typeof payload.work[KEY] === 'string' && JSON.parse(payload.work[KEY]).fields['ms-limits-progress'] === 'Look at real data', 'raw saved work is still exported unchanged');
    // 4. An old save (no responseIds) still reads, against the full 31-field list.
    await d.evaluate(key => localStorage.setItem(key, JSON.stringify({ v: 1, trials: [{}], fields: { 'analysis-design': 'Fair', 'ms-r2-q1': 'More chance cards', 'ms-r2-q2': '  ' }, lastVisitedAt: 1 })), KEY);
    await d.reload();
    progress = await d.locator('#cell-cycle-progress').textContent();
    T.ok(/1 trial set saved · 2 of 31 responses written/.test(progress), 'an old save without responseIds counts against all 31 fields: ' + progress);
    T.ok((await d.locator('#openscied-resume-link').getAttribute('href')) === 'openscied-b3-cell-cycle.html#analyze', 'an old save with analysis answers resumes at Analyze');
    // 5. A save that lists its own ids is counted against that list.
    await d.evaluate(key => localStorage.setItem(key, JSON.stringify({ v: 1, fields: { a: 'x', b: '' }, responseIds: ['a', 'b'], lastSection: 'submit' })), KEY);
    await d.reload();
    T.ok(/1 of 2 responses written/.test(await d.locator('#cell-cycle-progress').textContent()), 'the count follows the saved responseIds list');
    T.ok(d.errors.length === 0 && a.errors.length === 0, 'no page errors ' + JSON.stringify(d.errors.concat(a.errors)));
    await ctx.close();
  } finally { await browser.close(); server.close(); }
  T.done('t87-dashboard-making-sense');
})().catch(e => { console.error(e); process.exitCode = 1; });
