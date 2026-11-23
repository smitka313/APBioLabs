/* Dashboard Unit 2 card for the B.2 Fires companion: card, "Coming soon" note, progress, Resume, download and restart, other cards untouched.
   Run: NODE_PATH=$(npm root -g) node tests/t102-b2-fires-dashboard.js */
const T = require('./_h');
const fs = require('fs');
const B2 = 'aplab:openscied:b2-fires:v1', INH = 'aplab:openscied:b3-inheritance-environment:v1';
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
      T.ok(await p.evaluate(() => { const a = document.getElementById('unit2'), b = document.getElementById('unit3'); return !!(a && b && (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)); }), width + ' px: Unit 2 is listed before Unit 3');
      T.ok(await p.locator('section[aria-labelledby="unit2"] .dashboard-activity').count() === 4 && /4 activities available/.test(await p.locator('section[aria-labelledby="unit2"] .dashboard-tag').innerText()), width + ' px: Unit 2 has four activities (Burning Fuels, Fires, Peat Bog Carbon Lab, Carbon Atom Journey)');
      T.ok(/Fires/.test(await p.locator('#unit2').innerText()) && /Lessons 3 and 5/.test(await p.locator('section[aria-labelledby="unit2"]').innerText()), 'Unit 2 card names the lessons');
      T.ok((await p.locator('.dashboard-coming-soon summary').innerText()) === 'Coming soon: Units 4–5'
        && await p.locator('.dashboard-coming-soon :is(#unit1,#unit2)').count() === 0,
        'Coming soon lists only Units 4–5, not the published Units 1 and 2');
      T.ok(await p.locator('#b2-fires-open').getAttribute('href') === 'openscied-b2-fires.html#overview' && /Not started/.test(await p.locator('#b2-fires-progress').innerText()) && await p.locator('#b2-fires-reset').isDisabled(), 'card opens its page, not started, restart disabled');
      T.ok(await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth) <= 0, width + ' px: no horizontal overflow');
      const t = Date.now();
      await p.evaluate(([b2, inh, t]) => {
        localStorage.setItem(inh, JSON.stringify({ v: 1, pedigree: { guesses: {} }, fields: { 'exit-q1': 'b' }, responseIds: ['exit-q1', 'exit-q2'], lastSection: 'exit8', lastVisitedAt: t - 9000 }));
        localStorage.setItem(b2, JSON.stringify({ v: 1, cards: { placed: {}, solved: false }, decomp: { seed: 5, startedAt: t, temps: [18, 27, 43], recorded: [0] }, fields: { 'plan-iv': 'temp', 'plan-dv': 'foam', 'ideas-because': '  ', 'poll-peat': 'a' }, responseIds: ['plan-iv', 'plan-dv', 'ideas-because', 'poll-peat', 'sense-past'], lastSection: 'cards', lastVisitedAt: t }));
      }, [B2, INH, t]);
      await p.reload();
      const text = await p.locator('#b2-fires-progress').innerText();
      T.ok(/2 of 3 interactive models used/.test(text) && /3 of 5 answers saved/.test(text), 'card counts models and answers: ' + text);
      T.ok(/1 of 6 interactive models used|interactive models used/.test(await p.locator('#inh-env-progress').innerText()), 'the inheritance card still reads its own save');
      T.ok(await p.locator('#openscied-resume-link').getAttribute('href') === 'openscied-b2-fires.html#cards' && /Resume Fires/.test(await p.locator('#openscied-resume-link').innerText()), 'Resume points at the newest activity and section');
      await p.locator('#openscied-resume-link').click();
      await p.waitForFunction(() => document.querySelector('#cards.is-current'));
      await p.evaluate(() => { location.hash = 'plan'; });
      await p.waitForFunction(() => document.querySelector('#plan.is-current'));
      T.ok(await p.inputValue('#plan-iv') === 'temp', 'Resume opens the activity with saved picks');
      await p.goto(server.url + 'openscied-dashboard.html');
      const [dl] = await Promise.all([p.waitForEvent('download'), p.locator('#download-openscied-results').click()]);
      const payload = JSON.parse(fs.readFileSync(await dl.path(), 'utf8'));
      T.ok(payload.work[B2] && payload.responses['b2-fires'] && payload.responses['b2-fires']['plan-iv'] === 'temp' && payload.responses['inh-env'], 'download has this activity’s responses');
      await p.locator('#b2-fires-reset').click();
      T.ok(/Restart Fires/.test(await p.locator('#clear-openscied-title').innerText()), 'restart dialog names the activity');
      await p.locator('#openscied-erase-confirmation').fill('ERASE');
      await p.locator('#confirm-openscied-clear').click();
      T.ok(await p.evaluate(k => localStorage.getItem(k), B2) === null && await p.evaluate(k => !!localStorage.getItem(k), INH), 'restart clears only this activity');
      await p.evaluate(k => localStorage.setItem(k, '{broken'), B2);
      await p.reload();
      T.ok(/could not be read/.test(await p.locator('#b2-fires-progress').innerText()), 'a damaged save is reported');
      await ctx.close();
    }
  } finally { await browser.close(); server.close(); }
  T.done('t102-b2-fires-dashboard');
})().catch(e => { console.error(e); process.exit(1); });


