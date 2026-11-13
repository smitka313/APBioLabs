/* Lab 6 gas sensors: the Slope / O2-used tiles must not show the previous run while a new run is in progress.
   Reviewer's steps: run the O2 sensor to the end, switch to CO2, press Collect data, look at the tiles part-way through.
   Run: NODE_PATH=$(npm root -g) node tests/t53-lab6-sensor-tiles.js */
const { ok, done, launch, ctxFor, open } = require('./_h');
(async () => {
  const b = await launch(), ctx = await ctxFor(b), p = await open(ctx, 'lab06.html', 'gas-sensors');
  await p.evaluate(() => { const t = document.getElementById('p-predict-gas'); t.value = 'The O2 reading will fall and CO2 will rise.'; t.dispatchEvent(new Event('input', { bubbles: true })); t.dispatchEvent(new Event('change', { bubbles: true })); });
  await p.evaluate(() => Lab.pages.go(document.getElementById('g-sim'))); await p.waitForTimeout(400);
  const tiles = () => p.evaluate(() => Object.fromEntries(['g-time', 'g-read', 'g-slope', 'g-o2'].map(i => [i, document.getElementById(i).textContent])));
  await p.selectOption('#g-sensor', 'o2');
  await p.click('#g-run');
  await p.waitForFunction(() => /\/min/.test(document.getElementById('g-slope').textContent), null, { timeout: 30000 });
  const t1 = await tiles(); console.log('after O2 run', JSON.stringify(t1));
  ok(/\/min/.test(t1['g-slope']) && t1['g-o2'] !== '—', 'O2 run finished and filled the Slope and O2-used tiles');
  await p.selectOption('#g-sensor', 'co2'); await p.waitForTimeout(300);
  const t2 = await tiles(); console.log('after switching to CO2', JSON.stringify(t2));
  ok(t2['g-slope'] === '—' && t2['g-o2'] === '—', 'switching sensor clears the old Slope / O2-used tiles');
  await p.click('#g-run'); await p.waitForTimeout(2500);
  const t3 = await tiles(); console.log('mid CO2 run', JSON.stringify(t3));
  ok(!/\/min/.test(t3['g-slope']), 'mid-run: Slope tile does not show the previous run (' + t3['g-slope'] + ')');
  ok(t3['g-o2'] === '—', 'mid-run: O2-used tile does not show the previous run (' + t3['g-o2'] + ')');
  ok(/ppm/.test(t3['g-read']), 'mid-run: Reading tile is in the new sensor\'s units (' + t3['g-read'] + ')');
  await p.waitForFunction(() => /\/min/.test(document.getElementById('g-slope').textContent), null, { timeout: 30000 });
  const t4 = await tiles();
  ok(/ppm\/min/.test(t4['g-slope']), 'after the CO2 run the Slope tile shows the CO2 slope (' + t4['g-slope'] + ')');
  ok(p.errors.length === 0, 'no page errors ' + p.errors.join('|'));
  await b.close(); done('t53-lab6-sensor-tiles');
})();
