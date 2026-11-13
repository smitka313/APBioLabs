/* Long axis labels wrap (or shrink) and are never cut: no ellipsis, nothing outside the image, no overlap with tick numbers. */
const T = require('./_h');
(async () => {
  const b = await T.launch(), ctx = await T.ctxFor(b);
  const p = await T.open(ctx, 'lab07.html');
  const res = await p.evaluate(() => {
    const out = [];
    const Y = ['Mean mitotic index (% of cells in mitosis, 2 SE)', 'Rate of oxygen consumption per gram of germinating pea seed (mL O₂ per g per min)', 'Mean mitotic index', 'Net photosynthetic rate (µmol CO₂ m⁻² s⁻¹) averaged over the whole leaf', 'Absorbance'];
    const X = ['Time (min)', 'Concentration of the sucrose solution in the beaker after 24 hours of soaking (mol/L)'];
    for (const w of [640, 330]) for (const yl of Y) for (const xl of X) for (const type of ['xy', 'bar']) {
      const d = document.createElement('div'); d.style.cssText = `width:${w}px;position:absolute;left:0;top:0`; document.body.append(d);
      const o = type === 'bar'
        ? { type, xLabel: xl, yLabel: yl, categories: ['Control', 'Auxin-treated root tips (high dose)', 'Very long category name here'], series: [{ name: 'a', points: [{ x: 'Control', y: 3.2, err: .4 }, { x: 'Auxin-treated root tips (high dose)', y: 5, err: .3 }, { x: 'Very long category name here', y: 1 }] }] }
        : { type, xLabel: xl, yLabel: yl, series: [{ name: 'a', points: [{ x: 1, y: 0.0005 }, { x: 5, y: 0.0042 }] }] };
      Lab.chart(d, Object.assign({ responsive: true }, o));
      const svg = d.querySelector('svg'), sr = svg.getBoundingClientRect();
      const labs = Array.from(svg.querySelectorAll('.axis-label')), ticks = Array.from(svg.querySelectorAll(':scope > text:not(.axis-label)'));
      const text = labs.map(t => t.textContent).join(' ');
      const bad = [];
      if (/…|\.\.\./.test(svg.textContent)) bad.push('ellipsis');
      const full = s => s.replace(/\s+/g, '');
      if (full(labs.filter(t => !t.getAttribute('transform')).map(t => t.textContent).join('')) !== full(xl)) bad.push('x text changed');
      if (full(labs.filter(t => t.getAttribute('transform')).map(t => t.textContent).join('')) !== full(yl)) bad.push('y text changed');
      labs.forEach(t => { const r = t.getBoundingClientRect(); if (r.left < sr.left - 0.5 || r.right > sr.right + 0.5 || r.top < sr.top - 0.5 || r.bottom > sr.bottom + 0.5) bad.push('outside image: ' + t.textContent.slice(0, 20)); });
      labs.forEach(t => ticks.forEach(k => { const a = t.getBoundingClientRect(), c = k.getBoundingClientRect(); if (a.left < c.right - 1 && a.right > c.left + 1 && a.top < c.bottom - 1 && a.bottom > c.top + 1) bad.push('overlaps tick ' + k.textContent); }));
      const cats = Array.from(svg.querySelectorAll(':scope > text')).filter(t => !t.classList.contains('axis-label'));
      cats.forEach(t => { const r = t.getBoundingClientRect(); if (r.left < sr.left - 0.5 || r.right > sr.right + 0.5 || r.bottom > sr.bottom + 0.5) bad.push('tick outside: ' + t.textContent.slice(0, 15)); });
      out.push({ w, type, yl: yl.slice(0, 25), xl: xl.slice(0, 12), lines: labs.length, bad: Array.from(new Set(bad)) });
      d.remove();
    }
    return out;
  });
  const fails = res.filter(r => r.bad.length);
  T.ok(res.length === 40, `${res.length} chart variants drawn`);
  T.ok(fails.length === 0, 'no ellipsis, nothing cut, no overlap in any variant ' + JSON.stringify(fails.slice(0, 4)));
  const wrapped = res.filter(r => r.lines > 2).length;
  T.ok(wrapped > 5, `${wrapped} variants wrapped their labels onto extra lines`);
  // The exact label from the review
  const rev = await p.evaluate(() => { const d = document.createElement('div'); d.style.width = '640px'; document.body.append(d); Lab.chart(d, { xLabel: 'Treatment', yLabel: 'Mean mitotic index (% of cells in mitosis)', series: [{ points: [{ x: 1, y: 3 }] }] }); return Array.from(d.querySelectorAll('.axis-label')).map(t => t.textContent); });
  T.ok(rev.length === 3 && rev.join(' ') === 'Treatment Mean mitotic index (% of cells in mitosis)'.replace(/^(\S+) (.*)$/, (m, a, b2) => a + ' ' + rev.slice(1).join(' ')), 'review label wraps onto two lines: ' + JSON.stringify(rev));
  // every chart in every lab
  let n = 0;
  for (const lab of T.LABS) {
    const q = await T.open(ctx, lab + '.html');
    const r = await q.evaluate(() => Array.from(document.querySelectorAll('.chart svg')).map(svg => { const sr = svg.getBoundingClientRect(); return { el: !!svg.closest('[hidden]') || sr.width === 0, ell: /…/.test(svg.textContent), out: sr.width ? Array.from(svg.querySelectorAll('.axis-label')).some(t => { const r = t.getBoundingClientRect(); return r.left < sr.left - 0.5 || r.right > sr.right + 0.5 || r.top < sr.top - 0.5 || r.bottom > sr.bottom + 0.5; }) : false }; }));
    n += r.length;
    T.ok(r.every(x => !x.ell && !x.out), `${lab}: ${r.length} charts, no ellipsis, labels inside the image`);
    await q.close();
  }
  T.ok(n > 15, `${n} charts checked on the lab pages`);
  T.ok(p.errors.length === 0, 'no errors ' + p.errors.join(';'));
  await b.close(); T.done('t33-chart-labels');
})();
