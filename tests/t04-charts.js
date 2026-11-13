/* #4 Empty graphs and axis scaling (Lab.chart) */
const T = require('./_h');
(async () => {
  const b = await T.launch(), ctx = await T.ctxFor(b);

  // 1. every chart on every lab that starts empty shows the designed empty state, not a bare 0-1 axis
  console.log('Empty charts on all 13 labs');
  let seen = 0;
  for (const lab of T.LABS) {
    const p = await T.open(ctx, lab + '.html');
    const r = await p.evaluate(() => Array.from(document.querySelectorAll('.chart')).filter(c => c.querySelector('svg')).map(c => ({
      id: c.id, empty: c.classList.contains('is-empty'), note: !!c.querySelector('.chart-empty'),
      ticks: Array.from(c.querySelectorAll('svg > text:not(.axis-label)')).map(t => t.textContent),
      label: Array.from(c.querySelectorAll('.axis-label')).map(t => t.textContent).join('|'),
    })));
    r.filter(c => c.empty).forEach(c => {
      seen++;
      T.ok(c.note, `${lab} #${c.id}: has the empty-state note`);
      T.ok(!(c.ticks.join() === '0.0,0.5,1.0,0.0,0.5,1.0'), `${lab} #${c.id}: no bare 0 / 0.5 / 1.0 axes`);
    });
    T.ok(p.errors.length === 0, `${lab}: no page errors ${p.errors.join(';')}`);
    await p.close();
  }
  T.ok(seen >= 10, `found ${seen} empty charts across the labs`);

  // 2. scaling with data (single point, tiny values, NaN error bar), and an empty chart gets real labels
  console.log('Scaling');
  const p = await T.open(ctx, 'lab13.html');
  const res = await p.evaluate(() => {
    const out = {};
    const mk = opts => { const d = document.createElement('div'); d.style.width = '640px'; document.body.append(d); const c = Lab.chart(d, opts); return { d, c }; };
    const info = d => { const svg = d.querySelector('svg'), vb = svg.viewBox.baseVal;
      const ticks = Array.from(svg.querySelectorAll(':scope > text:not(.axis-label)')).map(t => t.textContent);
      const circ = Array.from(svg.querySelectorAll('circle')).map(c => [+c.getAttribute('cx'), +c.getAttribute('cy')]);
      return { ticks, circ, vbH: vb.height, vbW: vb.width, empty: d.classList.contains('is-empty'), note: (d.querySelector('.chart-empty') || {}).textContent || '', labels: Array.from(svg.querySelectorAll('.axis-label')).map(t => t.textContent) }; };
    let a = mk({ xLabel: 'Time (min)', yLabel: 'Absorbance', series: [] }); out.empty = info(a.d);
    a = mk({ xLabel: 'Day', yLabel: 'Mass (g)', series: [{ points: [{ x: 7, y: 0.0042 }] }] }); out.single = info(a.d);
    a = mk({ xLabel: 'x', yLabel: 'y', series: [{ points: [{ x: 11, y: 3.1, err: NaN }, { x: 7, y: 2.2, err: undefined }] }] }); out.nan = info(a.d);
    a = mk({ xLabel: 'x', yLabel: 'y', series: [{ points: [{ x: 1, y: 0.00031 }, { x: 2, y: 0.00052 }] }] }); out.small = info(a.d);
    a = mk({ xLabel: 'x', yLabel: 'y', series: [{ points: [{ x: 0, y: 0 }] }] }); out.zero = info(a.d);
    a = mk({ type: 'bar', yLabel: 'Energy', xLabel: 'Pathway', categories: ['A', 'B'], series: [] }); out.bar = info(a.d);
    return out;
  });
  T.ok(res.empty.empty && /Run a trial to see your results here/.test(res.empty.note), 'empty chart shows "Run a trial to see your results here"');
  T.ok(res.empty.labels.join() === 'Time (min),Absorbance' || res.empty.labels.join() === 'Time (min),Absorbance', 'empty chart keeps the real axis labels: ' + res.empty.labels);
  T.ok(res.empty.ticks.length === 0, 'empty chart has no invented tick numbers');
  T.ok(res.single.circ.length === 1 && res.single.ticks.some(t => /^0\.00[4-9]/.test(t)), 'single tiny point: axis scales to it, ticks ' + res.single.ticks);
  T.ok(res.nan.circ.length === 2 && res.nan.ticks.some(t => t === '4' || t === '3.5' || t === '5'), 'NaN or missing error bar does not reset the axis to 0-1: ' + res.nan.ticks);
  T.ok(res.small.ticks.some(t => /^0\.0005|^0\.0006/.test(t)), 'values near 0.0005 get a sensible scale: ' + res.small.ticks);
  T.ok(res.zero.circ.length === 1, 'a single point at (0, 0) still draws');
  T.ok(res.bar.empty && res.bar.labels.length === 2 && /Run a trial/.test(res.bar.note), 'empty bar chart: labels + note');
  await p.close();

  // 3. a chart built while its panel is hidden redraws at the real width when shown
  console.log('Hidden panel');
  const q = await T.open(ctx, 'lab13.html');
  const hid = await q.evaluate(async () => {
    const sim = document.createElement('div'); sim.className = 'sim-panel'; sim.style.cssText = 'width:420px'; sim.hidden = true;
    const d = document.createElement('div'); sim.append(d); document.body.append(sim);
    Lab.chart(d, { xLabel: 'x', yLabel: 'y', series: [{ points: [{ x: 1, y: 2 }, { x: 2, y: 4 }] }] });
    const before = d.querySelector('svg').viewBox.baseVal.width;
    sim.hidden = false;
    await new Promise(r => setTimeout(r, 400));
    return { before, after: d.querySelector('svg').viewBox.baseVal.width, cw: d.clientWidth };
  });
  T.ok(hid.before === 640 && Math.abs(hid.after - hid.cw) <= 1, `hidden chart redraws at its real width when shown (hidden ${hid.before}, shown ${hid.after}, element ${hid.cw})`);
  await q.close();

  // 4. Lab 10: harvest only gives the empty note; after drying, points appear (the page feeds the chart from the summary table)
  console.log('Lab 10 flow');
  const r = await T.open(ctx, 'lab10.html', 'part-1-npp');
  await r.evaluate(() => Lab.pages.go(document.querySelector('#p-p1-diagram'))); await r.fill('#p-p1-diagram', 'Prediction first'); await r.waitForTimeout(900); await r.click('#p1-plus7'); await r.waitForTimeout(300);
  await r.click('#p1-harvest'); await r.waitForTimeout(1200);
  const afterHarvest = await r.evaluate(() => ({ circles: document.querySelectorAll('#p1-chart circle').length, note: !!document.querySelector('#p1-chart .chart-empty') }));
  T.ok(afterHarvest.circles >= 1 && !afterHarvest.note, 'Lab 10 after harvest: the chart already plots a point (no empty-state note once there is data)');
  await r.click('#p1-dry'); await r.waitForTimeout(6500);
  const afterDry = await r.evaluate(() => ({ circles: document.querySelectorAll('#p1-chart circle').length, ticks: Array.from(document.querySelectorAll('#p1-chart svg > text:not(.axis-label)')).map(t => t.textContent) }));
  T.ok(afterDry.circles >= 2, 'Lab 10 after drying: points appear ' + afterDry.ticks);
  await r.close();

  await b.close();
  T.done('t04-charts');
})();
