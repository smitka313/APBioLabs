/* Dashboard with two Unit 3 activities: cards, per-activity progress, Resume, download and restart for the DNA/p53 companion.
   Run: NODE_PATH=$(npm root -g) node tests/t93-dna-p53-dashboard.js */
const T = require('./_h');
const fs = require('fs');
const DNA = 'aplab:openscied:b3-dna-p53:v1', CELL = 'aplab:openscied:b3-cell-cycle:v1';
(async () => {
  const browser = await T.launch();
  const server = await T.serve();
  try {
    for (const width of [1366, 390]) {
      const ctx = await T.ctxFor(browser, { width, height: 900 });
      const p = await ctx.newPage();
      await p.goto(server.url + 'openscied-dashboard.html');
      await p.evaluate(() => localStorage.removeItem('aplab:student'));
      await p.reload();
      T.ok(await p.locator('.dashboard-activity').count() === 3, width + ' px: three activity cards under Unit 3');
      T.ok(/3 activities available/.test(await p.locator('.dashboard-unit.current .dashboard-tag').innerText()), width + ' px: unit tag counts three activities');
      T.ok(await p.locator('#dna-p53-open').getAttribute('href') === 'openscied-b3-dna-p53.html#overview', 'DNA card opens its page');
      T.ok(/Not started/.test(await p.locator('#dna-p53-progress').innerText()) && /Not started/.test(await p.locator('#cell-cycle-progress').innerText()), 'both cards start as Not started');
      T.ok(await p.locator('#dna-p53-reset').isDisabled(), 'restart disabled with nothing saved');
      const over = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      T.ok(over <= 0, width + ' px: dashboard has no horizontal overflow');

      const t = Date.now();
      await p.evaluate(([dna, cell, t]) => {
        localStorage.setItem(cell, JSON.stringify({ v: 1, trials: [], fields: { 'analysis-design': 'My evidence' }, lastSection: 'analyze', lastVisitedAt: t - 5000 }));
        localStorage.setItem(dna, JSON.stringify({ v: 1, fork: { before: { top: { correct: 11, substitutions: 1 } } }, expression: { runs: [{ strand: 'A' }, { strand: 'B' }] },
          fields: { 'ideas-chromosomes': 'DNA', 'ms5-q1': 'Because', 'ms5-q2': '  ', 'ms5-summary': 'Kept', 'ex-el-0': true, 'exit-q2': 'e' }, responseIds: ['ideas-chromosomes', 'ms5-q1', 'ms5-q2', 'exit-q2'], lastSection: 'sense6', lastVisitedAt: t }));
      }, [DNA, CELL, t]);
      await p.reload();
      const dnaText = await p.locator('#dna-p53-progress').innerText();
      T.ok(/DNA fork results saved/.test(dnaText) && /2 gene expression runs/.test(dnaText) && /3 of 4 responses written/.test(dnaText), 'DNA card progress counts saved responses: ' + dnaText);
      T.ok(/1 of 31 responses/.test(await p.locator('#cell-cycle-progress').innerText()), 'cell-cycle progress is unchanged (1 of 31)');
      T.ok(await p.locator('#openscied-resume-link').getAttribute('href') === 'openscied-b3-dna-p53.html#sense6', 'Resume points at the most recent activity and section');
      T.ok(/Resume DNA Copying/.test(await p.locator('#openscied-resume-link').innerText()), 'Resume names the activity');
      T.ok(await p.locator('#dna-p53-open').getAttribute('href') === 'openscied-b3-dna-p53.html#sense6' && /Continue activity/.test(await p.locator('#dna-p53-open').innerText()), 'DNA card says Continue and links to the last section');
      await p.locator('#openscied-resume-link').click();
      await p.waitForFunction(() => document.querySelector('#sense6.is-current'));
      T.ok(await p.inputValue('#ms5-summary') === 'Kept' && await p.inputValue('#exit-q2') === 'e', 'Resume opens the activity with the saved answers that still exist');
      T.ok(await p.evaluate(k => { const f = JSON.parse(localStorage.getItem(k)).fields; return f['ms5-q1'] === 'Because' && f['ideas-chromosomes'] === 'DNA'; }, DNA), 'answers from the older, longer page are kept in the saved record');
      T.ok(/Because/.test(await p.locator('#earlier-answers-body').textContent()), 'older answers are shown under Earlier answers');
      T.ok(await p.evaluate(k => { const d = JSON.parse(localStorage.getItem(k)); return Array.isArray(d.responseIds) && d.responseIds.length > 20 && d.responseIds.length < 60; }, DNA), 'the page rewrites its response id list for the new design');
      T.ok(await p.evaluate(() => document.querySelector('#data-fork-body').textContent.includes('8.3%')), 'saved model data shows on the opened page');

      // download includes the DNA responses
      await p.goto(server.url + 'openscied-dashboard.html');
      const [dl] = await Promise.all([p.waitForEvent('download'), p.locator('#download-openscied-results').click()]);
      const payload = JSON.parse(fs.readFileSync(await dl.path(), 'utf8'));
      T.ok(payload.work[DNA] && payload.responses['dna-p53'] && payload.responses['dna-p53']['ideas-chromosomes'] === 'DNA' && payload.responses['dna-p53']['ms5-q2'] === '  ' && payload.responses['cell-cycle'], 'download has responses for both activities');

      // restart only the DNA activity
      await p.locator('#dna-p53-reset').click();
      T.ok(/Restart DNA Copying/.test(await p.locator('#clear-openscied-title').innerText()) && /model results and answers/.test(await p.locator('#clear-openscied-description').innerText()), 'restart dialog names the DNA activity');
      await p.locator('#openscied-erase-confirmation').fill('ERASE');
      await p.locator('#confirm-openscied-clear').click();
      T.ok(await p.evaluate(k => localStorage.getItem(k), DNA) === null && await p.evaluate(k => !!localStorage.getItem(k), CELL), 'restart clears only the DNA activity');
      T.ok(/Not started/.test(await p.locator('#dna-p53-progress').innerText()), 'DNA card back to Not started');
      T.ok(await p.locator('#openscied-resume-link').getAttribute('href') === 'openscied-b3-cell-cycle.html#analyze', 'Resume falls back to the other activity');

      // a damaged save does not break the page
      await p.evaluate(k => localStorage.setItem(k, '{broken'), DNA);
      await p.reload();
      T.ok(/could not be read/.test(await p.locator('#dna-p53-progress').innerText()) && /1 of 31/.test(await p.locator('#cell-cycle-progress').innerText()), 'unreadable DNA save is reported without affecting the other card');
      await ctx.close();
    }
  } finally { await browser.close(); server.close(); }
  T.done('t93-dna-p53-dashboard');
})().catch(e => { console.error(e); process.exit(1); });
