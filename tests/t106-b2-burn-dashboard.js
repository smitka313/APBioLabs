/* Dashboard card for Burning Fuels (openscied-dashboard.html): card, tag count, progress text from the saved record, Resume, restart, other cards untouched.
   Run: NODE_PATH=$(npm root -g) node tests/t106-b2-burn-dashboard.js */
const T = require('./_h');
const KEY = 'aplab:openscied:b2-burn-lab:v1';
const stub = pg => pg.route(/gc\.zgo\.at|fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, contentType: /gc\.zgo\.at/.test(r.request().url()) ? 'application/javascript' : 'text/css', body: '' }));
(async () => {
  const b = await T.launch(), srv = await T.serve();
  try {
    for (const width of [1366, 390]) {
      const ctx = await T.ctxFor(b, { width, height: 900 });
      const p = await ctx.newPage(); await stub(p); const errs = []; p.on('pageerror', e => errs.push(e.message));
      await p.goto(srv.url + 'openscied-dashboard.html'); await p.waitForSelector('#b2-burn-progress');
      T.ok(/Not started/.test(await p.locator('#b2-burn-progress').innerText()) && await p.locator('#b2-burn-reset').isDisabled(), width + ' px: new visit: Not started, restart disabled');
      T.ok((await p.locator('#b2-burn-open').getAttribute('href')).startsWith('openscied-b2-burn-lab.html'), 'card links to the page');
      T.ok(await p.locator('section[aria-labelledby="unit2"] .dashboard-activity').count() === 4 && /4 activities available/.test(await p.locator('section[aria-labelledby="unit2"] .dashboard-tag').innerText()), 'Unit 2 lists three activities');
      T.ok(/Lesson 2/.test(await p.locator('#b2-burn-open').evaluate(a => a.closest('.dashboard-activity').innerText)), 'card names the lesson');
      T.ok(await p.evaluate(() => { const a = document.getElementById('unit2'), c = document.getElementById('unit3'); return !!(a.compareDocumentPosition(c) & Node.DOCUMENT_POSITION_FOLLOWING); }), 'Unit 2 stays before Unit 3');
      T.ok(await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth) <= 0, width + ' px: no horizontal overflow');
      await ctx.close();
    }
    const ctx = await T.ctxFor(b, { width: 1366, height: 900 });
    const p = await ctx.newPage(); await stub(p); const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    await p.goto(srv.url + 'openscied-dashboard.html'); await p.waitForSelector('#b2-burn-progress');
    // work the real page, then come back
    const q = await ctx.newPage(); await stub(q);
    await q.goto(srv.url + 'openscied-b2-burn-lab.html#burn'); await q.waitForFunction(() => window.B2Burn && document.querySelector('#burn-scene').dataset.mounted === '1');
    await q.evaluate(() => { B2Burn.saveState('burn', { seed: B2Burn.seed('burn'), fuel: 'peat', current: null, records: [{ fuel: 'grass', n: 1, obs: [] }, { fuel: 'peat', n: 1, obs: [] }] }); });
    await q.selectOption('#bn-fuel', 'wood').catch(() => {});
    await q.evaluate(() => { location.hash = 'sense'; }); await q.waitForFunction(() => document.querySelector('#sense.is-current'));
    await q.selectOption('#sense-btb', 'co2'); await q.waitForTimeout(200);
    await q.close();
    await p.reload(); await p.waitForSelector('#b2-burn-progress');
    const txt = await p.locator('#b2-burn-progress').innerText();
    T.ok(/2 simulated burns recorded/.test(txt) && /1 of \d+ answers saved/.test(txt), 'progress text: ' + txt);
    T.ok(/^Continue/.test(await p.locator('#b2-burn-open').innerText()) && /openscied-b2-burn-lab\.html#sense/.test(await p.locator('#b2-burn-open').getAttribute('href')), 'Continue link returns to the last section');
    T.ok(/Resume Burning Fuels/.test(await p.locator('#openscied-resume-link').innerText()), 'resume card names the activity');
    await p.evaluate(k => localStorage.setItem(k, '{broken'), KEY); await p.reload(); await p.waitForSelector('#b2-burn-progress');
    T.ok(/could not be read/.test(await p.locator('#b2-burn-progress').innerText()), 'unreadable save is reported, not hidden');
    await p.evaluate(k => localStorage.setItem(k, JSON.stringify({ v: 1, burn: { records: [{}] }, fields: {}, responseIds: [] })), KEY); await p.reload(); await p.waitForSelector('#b2-burn-progress');
    T.ok(/1 simulated burn recorded/.test(await p.locator('#b2-burn-progress').innerText()), 'singular "burn"');
    await p.click('#b2-burn-reset'); await p.fill('#openscied-erase-confirmation', 'ERASE'); await p.click('#confirm-openscied-clear');
    T.ok(await p.evaluate(k => localStorage.getItem(k), KEY) === null && /Not started/.test(await p.locator('#b2-burn-progress').innerText()), 'Restart clears only this activity');
    T.ok(errs.length === 0, 'no page errors ' + errs.join());
    await ctx.close();
  } finally { await b.close(); srv.close(); }
  T.done('t106-b2-burn-dashboard');
})().catch(e => { console.error(e); process.exit(1); });

