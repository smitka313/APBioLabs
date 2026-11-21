/* Lesson 4 alignment: "more divisions -> more mutations" is observable. Every trial shows its control changes
   (mutations), counted from the timeline's last row; sets show a mean; the evidence panel, the report and the JSON carry
   them; a divisions-against-changes view (with a text alternative) shows the pattern; old trials without the count degrade.
   T92_ROOT=<dir> runs the checks against another copy of the site. */
const T = require('./_h');
const fs = require('node:fs');
const KEY = 'aplab:openscied:b3-cell-cycle:v1';
(async () => {
  const browser = await T.launch(), server = await T.serve(process.env.T92_ROOT || undefined);
  try {
    const ctx = await T.ctxFor(browser, { width: 1366, height: 900, reduced: true });
    const p = await T.open(ctx, 'openscied-b3-cell-cycle.html', 'growth-model', server.url);
    // Seeded trials (deterministic), plus one older trial with no timeline and no count.
    const trials = await p.evaluate(() => {
      let seed = 7; const rng = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
      const G = window.GrowthCellTypes, out = [];
      [[50, 'average', 'colon'], [80, 'large', 'colon'], [50, 'average', 'skin']].forEach(a => { for (let i = 0; i < 3; i++) out.push(G.simulate(a[0], a[1], a[2], rng)); });
      [55, 61, 49].forEach(d => out.push({ age: 40, size: 'average', tissue: 'slow', divisions: d, opportunities: d }));
      return out;
    });
    const bits = n => { let c = 0; while (n) { c += n & 1; n >>= 1; } return c; };
    const expected = trials.map(t => t.timeline ? t.timeline[t.timeline.length - 1].changes.reduce((s, m) => s + bits(m), 0) : null);
    T.ok(expected.slice(0, 9).every(n => n > 0) && new Set(expected.slice(0, 9)).size > 3, 'the seeded trials have varied, non-zero control-change counts ' + expected.join(','));
    await p.evaluate(({ k, trials }) => localStorage.setItem(k, JSON.stringify({ v: 1, trials, fields: {}, lastSection: 'growth-model' })), { k: KEY, trials });
    await p.reload(); await p.waitForTimeout(600);
    const head = await p.locator('#trial-table thead th').allTextContents();
    const col = head.findIndex(h => /Control changes \(mutations\)/.test(h));
    T.ok(col >= 0, 'the trial table has a "Control changes (mutations)" column');
    const cells = await p.locator('#trial-rows tr').evaluateAll((rows, c) => rows.map(r => r.children[c] && r.children[c].textContent), col);
    T.ok(col >= 0 && expected.slice(0, 9).every((n, i) => cells[i] === String(n)), 'each trial\'s count matches the timeline (' + cells.slice(0, 9).join(',') + ')');
    T.ok(cells[9] === 'not recorded', 'an older trial without a timeline shows "not recorded" (' + cells[9] + ')');
    const mean = i => (expected.slice(i * 3, i * 3 + 3).reduce((a, b) => a + b, 0) / 3).toFixed(1);
    const summary = await p.locator('#set-summary').textContent();
    T.ok(/not recorded/.test(summary) || /Control changes \(mutations\)/.test(summary), 'the set summary mentions control changes');
    const ev = await p.evaluate(() => { const e = document.getElementById('analysis-reference-data'); return e ? e.innerText : ''; });
    T.ok([0, 1, 2].every(i => ev.includes('Mean: ' + mean(i))) && ev.includes('Control changes (mutations): ' + expected.slice(0, 3).join(' · ')), 'the evidence panel lists each set\'s changes and mean (' + [0, 1, 2].map(mean).join(', ') + ')');
    T.ok(/Control changes \(mutations\)/.test(await p.locator('#investigation-report').innerText()), 'the report table has the column');
    // A real run stores the count with the trial and the summary gives the set mean.
    await p.evaluate(() => { document.getElementById('run-trials').click(); });
    await p.waitForTimeout(400);
    const stored = await p.evaluate(k => JSON.parse(localStorage.getItem(k)).trials.slice(-3), KEY);
    T.ok(stored.length === 3 && stored.every(t => Number.isFinite(t.controlChanges) && t.controlChanges === t.timeline[t.timeline.length - 1].changes.reduce((s, m) => s + bits(m), 0)), 'new trials save controlChanges equal to the timeline count');
    const s2 = await p.locator('#set-summary').textContent();
    const m = s2.match(/Control changes \(mutations\) by trial: (\d+), (\d+), (\d+); mean (\d+\.\d)/);
    T.ok(m && Number(m[4]) === Number(((Number(m[1]) + Number(m[2]) + Number(m[3])) / 3).toFixed(1)), 'the set summary gives per-trial counts and their mean: ' + (m && m[0]));
    // The divisions-against-changes view.
    T.ok(await p.locator('#changes-chart-wrap').isHidden() && await p.locator('#chart-view-divisions').getAttribute('aria-pressed') === 'true', 'the original chart is the default view');
    await p.locator('#chart-view-changes').click();
    T.ok(await p.locator('#changes-chart-wrap').isVisible() && await p.locator('#trial-chart').isHidden() && await p.locator('#chart-view-changes').getAttribute('aria-pressed') === 'true', 'the toggle shows the divisions-vs-changes chart');
    const text = await p.locator('#changes-chart-text').textContent();
    T.ok(/Set 1 .*mean [\d.]+ divisions and [\d.]+ control changes \(mutations\)/.test(text) && /correlation/.test(text) && /left out because control changes were not recorded/.test(text), 'its text alternative gives each set and the trend, and says what was left out');
    const label = await p.locator('#growth-chart-changes').getAttribute('aria-label');
    T.ok(label.includes('Set 1') && /Exact counts are in the data table/.test(label), 'the canvas label carries the same description');
    T.ok(/a control change is a mutation/i.test(await p.locator('#changes-chart-wrap .chart-caption').textContent()), 'the caption says a control change is a mutation');
    const painted = await p.evaluate(() => { const c = document.getElementById('growth-chart-changes'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 4 * 97) if (d[i] > 120) n++; return n; });
    T.ok(painted > 20, 'the chart is drawn (' + painted + ' light samples)');
    await p.locator('#chart-view-divisions').click();
    T.ok(await p.locator('#trial-chart').isVisible() && await p.locator('#changes-chart-wrap').isHidden(), 'the toggle returns to the original chart');
    const dl = p.waitForEvent('download');
    await p.evaluate(() => document.getElementById('download-work').click());
    const payload = JSON.parse(fs.readFileSync(await (await dl).path(), 'utf8'));
    const sim = payload.simulationTrials;
    T.ok(expected.slice(0, 9).every((n, i) => sim[i].controlChanges === n) && sim[9].controlChanges === null && sim[0].timeline && sim[0].setNumber === 1, 'the JSON adds controlChanges per trial (null if not recorded) and keeps earlier fields');
    T.ok(p.errors.length === 0, 'no page errors ' + p.errors.join('; '));
  } catch (e) { T.ok(false, 'unexpected error: ' + e.message.split('\n')[0]); }
  await browser.close(); server.close(); T.done('t92-control-changes');
})();
