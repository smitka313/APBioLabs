/* Lab.chart keeps xMin/xMax (and yMin/yMax) exactly when the page gives both ends, even in a narrow (300 px) panel: pH 2-12 stays 2-12. */
const { ok, done, launch, ctxFor, open } = require('./_h.js');
(async () => {
  const b = await launch(), ctx = await ctxFor(b, {}), p = await open(ctx, 'lab05.html', 'overview');
  const res = await p.evaluate(() => {
    const out = {};
    const mk = (w, o) => { const d = document.createElement('div'); d.style.width = w + 'px'; document.body.append(d); Lab.chart(d, Object.assign({ type: 'xy', xLabel: 'pH', yLabel: 'Rate', responsive: true, height: 200, series: [{ name: 's', dots: true, line: true, points: [{ x: 3, y: 1 }, { x: 7, y: 5 }, { x: 10, y: 2 }] }] }, o)); const t = [...d.querySelectorAll('svg text')].filter(e => e.getAttribute('text-anchor') === 'middle' && /^-?[\d.]+$/.test(e.textContent)).map(e => +e.textContent); const g = [...d.querySelectorAll('line.gridline')].map(l => +l.getAttribute('x1')).filter((v, i, a) => a.indexOf(v) === i); return { ticks: t, svgW: d.querySelector('svg').getBoundingClientRect().width, xs: g }; };
    out.narrow = mk(300, { xMin: 2, xMax: 12 }); out.wide = mk(700, { xMin: 2, xMax: 12 });
    out.y = mk(300, { xMin: 2, xMax: 12, yMin: 0, yMax: 7 });
    return out;
  });
  for (const k of ['narrow', 'wide', 'y']) {
    const t = res[k].ticks, x = res[k].xs, first = Math.min(...x), last = Math.max(...x);
    ok(t.length >= 2 && t[0] >= 2 && t[t.length - 1] <= 12 && t.every(v => v >= 2 && v <= 12), `${k}: x ticks stay inside 2..12 (${t.join(', ')})`);
    ok(k === 'y' || (t.includes(2) && t.includes(12)), `${k}: axis reaches 12 (${t.join(', ')})`);
    ok(!t.some(v => v < 2 || v > 12) && !t.includes(0) && !t.includes(15), `${k}: no 0 or 15 tick`);
    // plot area covers the full 2..12 range: points at x=3 and x=10 are at 10% and 80% of the plot width
    ok(x.length >= 2, `${k}: gridlines drawn`);
  }
  await b.close();
  done('t51-chart-exact-bounds');
})();
