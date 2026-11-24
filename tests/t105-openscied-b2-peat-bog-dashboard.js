/* Dashboard card for the Peat Bog Carbon Lab (openscied-dashboard.html): progress text from the saved record, resume link, reset, and the
   other cards untouched. Run: NODE_PATH=$(npm root -g) node tests/t105-openscied-b2-peat-bog-dashboard.js */
const T = require('./_h');
const KEY = 'aplab:openscied:b2-peat-bog:v1';
const stub = pg => pg.route(/gc\.zgo\.at|fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, contentType: /gc\.zgo\.at/.test(r.request().url()) ? 'application/javascript' : 'text/css', body: '' }));
(async () => {
  const b = await T.launch(), srv = await T.serve();
  try {
    const ctx = await T.ctxFor(b, { width: 1366, height: 900 });
    const p = await ctx.newPage(); await stub(p); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(srv.url + 'openscied-dashboard.html'); await p.waitForSelector('#peat-bog-progress');
    T.ok(/Not started/.test(await p.locator('#peat-bog-progress').innerText()) && await p.locator('#peat-bog-reset').isDisabled(), 'new visit: Not started, restart disabled');
    T.ok((await p.locator('#peat-bog-open').getAttribute('href')).startsWith('openscied-b2-peat-bog-lab.html'), 'card links to the page');
    const unit2 = p.locator('section[aria-labelledby="unit2"]'), unit3 = p.locator('section[aria-labelledby="unit3"]');
    T.ok(await unit2.locator('.dashboard-activity').count() === 4 && await unit3.locator('.dashboard-activity').count() === 5 &&
      (await unit2.locator('.dashboard-tag').textContent()).trim() === '4 activities available' &&
      (await unit3.locator('.dashboard-tag').textContent()).trim() === '5 activities available',
    'Unit 2 stays at four activities and Unit 3 has five including Cancer Rates Data Dive and DNA Workshop');
    const coming = p.locator('.dashboard-coming-soon');
    T.ok(/Unit 5.*No companion activities yet/.test(await coming.innerText()) && /openscied\.org.*b-5-common-ancestry-speciation/.test(await coming.locator('a').getAttribute('href')),
      'unpublished Unit 5 links to the official unit, not an empty activity');
    // work the real page, then come back
    const q = await ctx.newPage(); await stub(q);
    await q.goto(srv.url + 'openscied-b2-peat-bog-lab.html#bog'); await q.waitForFunction(() => window.B2Peat);
    await q.evaluate(() => { B2Peat.setState({ wet: 30 }); B2Peat.record('bog'); B2Peat.record('bog'); });
    await q.close();
    await p.reload(); await p.waitForSelector('#peat-bog-progress');
    const txt = await p.locator('#peat-bog-progress').innerText();
    T.ok(/2 simulated trials recorded/.test(txt) && /bog settings changed/.test(txt) && /warming not explored/.test(txt), 'progress text: ' + txt);
    T.ok(/^Continue/.test(await p.locator('#peat-bog-open').innerText()) && /openscied-b2-peat-bog-lab\.html#(bog|trials)/.test(await p.locator('#peat-bog-open').getAttribute('href')), 'Continue link returns to the last section');
    T.ok(/Resume Peat Bog Carbon Lab/.test(await p.locator('#openscied-resume-link').innerText()), 'resume card names the activity');
    await p.evaluate(k => localStorage.setItem(k, '{broken'), KEY); await p.reload(); await p.waitForSelector('#peat-bog-progress');
    T.ok(/could not be read/.test(await p.locator('#peat-bog-progress').innerText()), 'unreadable save is reported, not hidden');
    await p.evaluate(k => localStorage.setItem(k, JSON.stringify({ v: 1, settings: { wet: 75 }, trials: [{}] })), KEY); await p.reload(); await p.waitForSelector('#peat-bog-progress');
    T.ok(/1 simulated trial recorded/.test(await p.locator('#peat-bog-progress').innerText()), 'singular "trial"');
    await p.click('#peat-bog-reset'); await p.fill('#openscied-erase-confirmation', 'ERASE'); await p.click('#confirm-openscied-clear');
    T.ok(await p.evaluate(k => localStorage.getItem(k), KEY) === null && /Not started/.test(await p.locator('#peat-bog-progress').innerText()), 'Restart clears only this activity');
    T.ok(errs.length === 0, 'no page errors ' + errs.join());
    await ctx.close();
  } finally { await b.close(); srv.close(); }
  T.done('t105-openscied-b2-peat-bog-dashboard');
})().catch(e => { console.error(e); process.exit(1); });
