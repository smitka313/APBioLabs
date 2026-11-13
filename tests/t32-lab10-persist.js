/* Lab 10: NPP is the gain between two harvests; nothing plots before drying finishes; GPP waits for respiration;
   calculators start empty with a worked-example mode; readouts and a feeding barn survive a reload. */
const T = require('./_h');
(async () => {
  const b = await T.launch(), ctx = await T.ctxFor(b);
  let p = await T.open(ctx, 'lab10.html', 'part-1-npp');
  const pred = async () => { await p.evaluate(() => { const t = document.querySelector('#p-p1-diagram'); t.value = 'energy in from light, out as respiration and biomass'; t.dispatchEvent(new Event('input', { bubbles: true })); }); };
  await pred();
  T.ok(await p.evaluate(() => document.querySelector('#ratio-plant').value === '' && document.querySelector('#ratio-larva').value === ''), 'ratio calculators start empty');
  await p.click('#p1-plus7'); await p.waitForTimeout(900);
  await p.click('#p1-harvest'); await p.waitForTimeout(500);
  const pts = () => p.evaluate(() => document.querySelectorAll('#p1-chart circle, #p1-chart .dot, #p1-chart .pt').length);
  T.ok(await p.evaluate(() => document.querySelector('#p1-rd').textContent.includes('drying')), 'tile says drying');
  T.ok((await pts()) === 0, 'no point plotted while drying (' + (await pts()) + ')');
  await p.click('#p1-dry'); await p.waitForFunction(() => !document.querySelector('#p1-rd').textContent.includes('drying'), null, { timeout: 15000 });
  await p.waitForTimeout(300);
  T.ok((await pts()) > 0, 'points appear after the oven finishes');
  // sankey with one harvest: no NPP yet
  await p.click('#p1-plus7'); await p.waitForTimeout(900); await p.click('#p1-harvest'); await p.waitForTimeout(400);
  await p.click('#p1-dry'); await p.waitForFunction(() => !document.querySelector('#p1-rd').textContent.includes('drying'), null, { timeout: 15000 });
  await p.waitForTimeout(400);
  const sk = await p.evaluate(() => document.querySelector('#sankey-plant').textContent);
  T.ok(/measure respiration first/.test(sk), 'GPP says measure respiration first: ' + sk.slice(0, 80));
  const hasNpp = await p.evaluate(() => { const k = Object.keys(localStorage).find(k => /keyres:npp$/.test(k)); return k ? JSON.parse(localStorage[k]) : null; });
  T.ok(hasNpp && /between your day/.test(hasNpp.label), 'key result npp is between harvests: ' + (hasNpp && hasNpp.label));
  T.ok(await p.evaluate(() => /Average daily gain/.test(document.querySelector('#p1-sum').textContent)), 'table column renamed Average daily gain');
  // reload: readouts back
  await p.reload(); await p.waitForTimeout(900);
  T.ok(await p.evaluate(() => /^\d/.test(document.querySelector('#p1-rd').textContent.trim())), 'dry-mass readout restored');
  // example mode
  await p.evaluate(() => document.querySelector('#p1-calc-example').click());
  T.ok(await p.evaluate(() => !document.querySelector('.example-banner').hidden && /EXAMPLE/.test(document.querySelector('.example-banner').textContent) && document.querySelector('#calc-c1-gpd').value !== ''), 'worked example shows banner and values');
  await p.reload(); await p.waitForTimeout(900);
  T.ok(await p.evaluate(() => document.querySelector('#calc-c1-gpd').value === ''), 'example not saved');
  T.ok(p.errors.length === 0, 'no page errors ' + p.errors.join(';'));
  await b.close(); T.done('lab10');
})();
