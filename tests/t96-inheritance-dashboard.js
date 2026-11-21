/* Dashboard with three Unit 3 activities: the Lessons 8-9 card, its progress, Resume, download and restart, with the other two untouched.
   Run: NODE_PATH=$(npm root -g) node tests/t96-inheritance-dashboard.js */
const T = require('./_h');
const fs = require('fs');
const INH = 'aplab:openscied:b3-inheritance-environment:v1', DNA = 'aplab:openscied:b3-dna-p53:v1', CELL = 'aplab:openscied:b3-cell-cycle:v1';
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
      T.ok(await p.locator('.dashboard-activity').count() === 5, width + ' px: five activity cards (two Unit 2, three Unit 3)');
      T.ok(/3 activities available/.test(await p.locator('section[aria-labelledby="unit3"] .dashboard-tag').innerText()), width + ' px: tag says 3 activities available');
      T.ok(/Inheritance, Environment/.test(await p.locator('.dashboard-activity').nth(4).innerText()) && /Lessons 8–9/.test(await p.locator('.dashboard-activity').nth(4).innerText()), 'third card is the Lessons 8-9 companion');
      T.ok(await p.locator('#inh-env-open').getAttribute('href') === 'openscied-b3-inheritance-environment.html#overview', 'card opens its page');
      for (const id of ['inh-env', 'dna-p53', 'cell-cycle']) T.ok(/Not started/.test(await p.locator('#' + id + '-progress').innerText()), id + ' starts as Not started');
      T.ok(await p.locator('#inh-env-reset').isDisabled(), 'restart disabled with nothing saved');
      T.ok(await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth) <= 0, width + ' px: no horizontal overflow');

      const t = Date.now();
      await p.evaluate(([inh, dna, cell, t]) => {
        localStorage.setItem(cell, JSON.stringify({ v: 1, trials: [], fields: { 'analysis-design': 'My evidence' }, lastSection: 'analyze', lastVisitedAt: t - 9000 }));
        localStorage.setItem(dna, JSON.stringify({ v: 1, fork: { before: { top: { correct: 11, substitutions: 1 } } }, expression: { runs: [] }, fields: { 'ideas-chromosomes': 'DNA' }, responseIds: ['ideas-chromosomes', 'ms5-q1'], lastSection: 'sense5', lastVisitedAt: t - 5000 }));
        localStorage.setItem(inh, JSON.stringify({ v: 1, pedigree: { guesses: { lakita: ['AB'] } }, meiosis: { runs: [] }, fields: { 'exit-q1': 'b', 'poll-why': 'a', 'ideas-a': '  ', 'qt-iv': 'x' }, responseIds: ['exit-q1', 'poll-why', 'ideas-a', 'exit-q2'], lastSection: 'exit8', lastVisitedAt: t }));
      }, [INH, DNA, CELL, t]);
      await p.reload();
      const text = await p.locator('#inh-env-progress').innerText();
      T.ok(/2 of 6 interactive models used/.test(text) && /2 of 4 answers saved/.test(text), 'card counts models and answers: ' + text);
      T.ok(/1 of 2 responses written/.test(await p.locator('#dna-p53-progress').innerText()) && /1 of 31 responses/.test(await p.locator('#cell-cycle-progress').innerText()), 'the other two cards are unchanged');
      T.ok(await p.locator('#openscied-resume-link').getAttribute('href') === 'openscied-b3-inheritance-environment.html#exit8' && /Resume Inheritance/.test(await p.locator('#openscied-resume-link').innerText()), 'Resume points at the newest activity and section');
      await p.locator('#openscied-resume-link').click();
      await p.waitForFunction(() => document.querySelector('#exit8.is-current'));
      T.ok(await p.isChecked('input[name="exit-q1"][value="b"]'), 'Resume opens the activity with saved picks');

      await p.goto(server.url + 'openscied-dashboard.html');
      const [dl] = await Promise.all([p.waitForEvent('download'), p.locator('#download-openscied-results').click()]);
      const payload = JSON.parse(fs.readFileSync(await dl.path(), 'utf8'));
      T.ok(payload.work[INH] && payload.responses['inh-env'] && payload.responses['inh-env']['exit-q1'] === 'b' && payload.responses['dna-p53'] && payload.responses['cell-cycle'], 'download has responses for all three activities');

      await p.locator('#inh-env-reset').click();
      T.ok(/Restart Inheritance, Environment/.test(await p.locator('#clear-openscied-title').innerText()), 'restart dialog names the activity');
      await p.locator('#openscied-erase-confirmation').fill('ERASE');
      await p.locator('#confirm-openscied-clear').click();
      T.ok(await p.evaluate(k => localStorage.getItem(k), INH) === null && await p.evaluate(([a, b]) => !!localStorage.getItem(a) && !!localStorage.getItem(b), [DNA, CELL]), 'restart clears only this activity');
      T.ok(/Not started/.test(await p.locator('#inh-env-progress').innerText()), 'card back to Not started');
      await p.evaluate(k => localStorage.setItem(k, '{broken'), INH);
      await p.reload();
      T.ok(/could not be read/.test(await p.locator('#inh-env-progress').innerText()) && /1 of 31/.test(await p.locator('#cell-cycle-progress').innerText()), 'a damaged save is reported without affecting other cards');
      await ctx.close();
    }
  } finally { await browser.close(); server.close(); }
  T.done('t96-inheritance-dashboard');
})().catch(e => { console.error(e); process.exit(1); });
