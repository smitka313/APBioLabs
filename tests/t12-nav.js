/* #12 / #14 Step nav: no truncation on wide screens, readable on phones, "0 of 6 done" spaced */
const T = require('./_h');
(async () => {
  const b = await T.launch();
  for (const w of [1366, 1440]) {
    console.log('Width ' + w);
    const ctx = await T.ctxFor(b, { width: w, height: 768 });
    for (const lab of T.LABS) {
      const p = await T.open(ctx, lab + '.html');
      const r = await p.evaluate(() => {
        const links = Array.from(document.querySelectorAll('.step-nav ol a'));
        return { n: links.length,
          clipped: links.filter(a => { const nl = a.querySelector('.nl'); return nl.scrollWidth > nl.clientWidth + 1 || getComputedStyle(nl).textOverflow === 'ellipsis' && nl.scrollWidth > nl.clientWidth; }).map(a => a.textContent),
          offscreen: links.filter(a => { const r = a.getBoundingClientRect(); return r.left < 0 || r.right > innerWidth + 0.5; }).map(a => a.textContent),
          rows: new Set(links.map(a => Math.round(a.getBoundingClientRect().top))).size,
          height: document.querySelector('.step-nav').getBoundingClientRect().height,
          ovf: document.documentElement.scrollWidth - innerWidth };
      });
      T.ok(r.clipped.length === 0 && r.offscreen.length === 0, `${lab}@${w}: all ${r.n} parts fully visible in ${r.rows} row(s), nav ${Math.round(r.height)}px${r.clipped.concat(r.offscreen)}`);
      T.ok(r.ovf <= 0, `${lab}@${w}: no page overflow`);
      if (lab === 'lab07') {
        const last = await p.$('.step-nav ol li:last-child a'); const bb = await last.boundingBox();
        T.ok(bb && bb.x + bb.width <= w, 'Lab 7: Submit is visible (not behind an arrow)');
        await p.screenshot({ path: process.env.SHOT7 ? process.env.SHOT7 + w + '.png' : undefined, clip: { x: 0, y: 0, width: w, height: 120 } });
      }
      await p.close();
    }
    await ctx.close();
  }
  console.log('Phone 400');
  const ctx = await T.ctxFor(b, { width: 400, height: 800, dark: true });
  for (const lab of T.LABS) {
    const p = await T.open(ctx, lab + '.html');
    const r = await p.evaluate(() => {
      const links = Array.from(document.querySelectorAll('.step-nav ol a'));
      const cur = links.find(a => a.getAttribute('aria-current') === 'true'), ol = document.querySelector('.step-nav ol');
      const cr = cur.getBoundingClientRect(), or = ol.getBoundingClientRect();
      return { clipped: links.filter(a => { const nl = a.querySelector('.nl'); return nl.scrollWidth > nl.clientWidth + 1; }).length,
        curVisible: cr.left >= or.left - 1 && cr.right <= or.right + 1, prog: (document.querySelector('.nav-progress') || {}).innerText || '', ovf: document.documentElement.scrollWidth - innerWidth, curLabel: cur.textContent };
    });
    T.ok(r.clipped === 0, `${lab}@400: no label is clipped (full labels, strip scrolls)`);
    T.ok(r.curVisible, `${lab}@400: current part "${r.curLabel}" is in view`);
    T.ok(/^\d+ of \d+ done$/.test(r.prog.trim()) || r.prog === '', `${lab}@400: progress text spaced: "${r.prog.trim()}"`);
    T.ok(r.ovf <= 0, `${lab}@400: no page overflow`);
    await p.close();
  }
  await b.close();
  T.done('t12-nav');
})();
