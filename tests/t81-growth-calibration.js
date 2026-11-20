/* Growth model calibration (review H2). Before the fix a 12% change chance per division put a cancer-state unit in
   ~98-100% of colon and red-cell trials at age 50, contradicting the page's "Cancer is not inevitable". This runs the
   page's own model 2,000 times per condition and checks the patterns the page teaches. */
const T = require('./_h');
(async () => {
  const browser = await T.launch(), server = await T.serve();
  const ctx = await T.ctxFor(browser, {width:1366,height:900,reduced:true});
  const p = await T.open(ctx,'openscied-b3-cell-cycle.html','growth-model',server.url);
  try {
    const r = await p.evaluate(() => {
      const G = window.GrowthCellTypes, N = 2000, out = {};
      for (const tissue of ['skin','colon','brain','bloodRed','bloodWhite']) for (const age of [50,80]) {
        let any = 0, divisions = 0;
        for (let i = 0; i < N; i++) { const t = G.simulate(age,'average',tissue); if (t.cancerCount) any++; divisions += t.divisions; }
        out[tissue+age] = {any:any/N, divisions:divisions/N};
      }
      let small = 0, large = 0;
      for (let i = 0; i < N; i++) { if (G.simulate(80,'small','colon').cancerCount) small++; if (G.simulate(80,'large','colon').cancerCount) large++; }
      out.small = small/N; out.large = large/N;
      return out;
    });
    const pct = x => (100*x).toFixed(1)+'%';
    for (const t of ['skin','colon','bloodRed','bloodWhite'])
      T.ok(r[t+50].any < 0.25, `${t}, age 50: most trials show no cancer-state unit (${pct(r[t+50].any)} with one)`);
    for (const t of ['skin','colon','bloodRed','bloodWhite'])
      T.ok(r[t+80].any > r[t+50].any, `${t}: risk rises with age (${pct(r[t+50].any)} at 50 -> ${pct(r[t+80].any)} at 80)`);
    T.ok(r.colon80.any >= 0.3, `colon, age 80: cancer-state units still appear often enough to inspect (${pct(r.colon80.any)})`);
    T.ok(r.colon80.any > r.skin80.any && r.skin80.any >= r.brain80.any, `more frequent division -> higher risk (colon ${pct(r.colon80.any)} > skin ${pct(r.skin80.any)} >= brain ${pct(r.brain80.any)})`);
    T.ok(r.bloodRed80.any <= r.colon80.any, `red-cell precursors are not the most cancer-prone setting (red ${pct(r.bloodRed80.any)} vs colon ${pct(r.colon80.any)})`);
    T.ok(r.large > r.small, `a larger body (more units) shows more risk (${pct(r.small)} small vs ${pct(r.large)} large)`);
    T.ok(r.colon50.divisions > r.skin50.divisions && r.colon80.divisions > r.colon50.divisions, 'division counts still rise with age and division frequency');
    const text = await p.locator('.model-assumptions').evaluate(el => el.textContent);
    const chance = await p.evaluate(() => window.GrowthCellTypes.changeChance);
    T.ok(typeof chance === 'number' && text.includes(Number((chance*100).toFixed(1))+'% chance'), `assumptions text quotes the model's change chance (${chance})`);
    const red = await p.evaluate(() => window.GrowthCellTypes.profile('bloodRed').rate);
    T.ok(text.includes(Math.round(red*100)+'% for red-cell precursors'), 'assumptions text quotes the red-cell division chance');
    T.ok(/repair/i.test(text) && /apoptosis/i.test(text) && /immune system/i.test(text), 'text says real cells repair DNA, undergo apoptosis and are cleared by the immune system');
    T.ok(/blood-forming stem cells/i.test(text), 'text notes the protections of blood-forming stem cells that the model leaves out');
  } catch (e) { T.ok(false, 'unexpected error: ' + e.message.split('\n')[0]); }
  await browser.close(); server.close(); T.done('t81-growth-calibration');
})();
