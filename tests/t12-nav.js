/* #12 / #14 Step nav: full labels on wide screens, scrollable labels and expandable status on narrow screens. */
const T = require('./_h');
(async () => {
  const b = await T.launch();
  const desktop = [[1366, 768], [1440, 900]];
  for (const [w, h] of desktop) {
    console.log('Desktop viewport ' + w + 'x' + h);
    const ctx = await T.ctxFor(b, { width: w, height: h });
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
      T.ok(r.clipped.length === 0 && r.offscreen.length === 0, `${lab}@${w}x${h}: all ${r.n} parts fully visible in ${r.rows} row(s), nav ${Math.round(r.height)}px${r.clipped.concat(r.offscreen)}`);
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
  const compact = [[375, 812], [390, 844], [430, 932], [768, 1024], [683, 384]];
  for (const [w, h] of compact) {
    console.log('Compact viewport ' + w + 'x' + h + (w === 683 ? ' (200% zoom-equivalent CSS width)' : ''));
    const ctx = await T.ctxFor(b, { width: w, height: h, dark: true });
    for (const lab of T.LABS) {
      const p = await T.open(ctx, lab + '.html');
      const r = await p.evaluate(() => {
        const links = Array.from(document.querySelectorAll('.step-nav ol a'));
        const cur = links.find(a => a.getAttribute('aria-current') === 'true'), ol = document.querySelector('.step-nav ol');
        const cr = cur.getBoundingClientRect(), or = ol.getBoundingClientRect();
        return { clipped: links.filter(a => { const nl = a.querySelector('.nl'); return nl.scrollWidth > nl.clientWidth + 1; }).length,
          curVisible: cr.left >= or.left - 1 && cr.right <= or.right + 1,
          progress: (document.querySelector('.nav-progress') || {}).innerText || '',
          overflow: document.documentElement.scrollWidth - innerWidth,
          covered: (() => { const nav = document.querySelector('.step-nav'), heading = document.querySelector('section.step.is-current h2'); return nav && heading ? heading.getBoundingClientRect().top < nav.getBoundingClientRect().bottom - 1 : false; })() };
      });
      T.ok(r.clipped === 0, `${lab}@${w}: no step label is clipped (the strip scrolls)`);
      T.ok(r.curVisible, `${lab}@${w}: current step is in view`);
      T.ok(/^\d+ of \d+ (parts )?done$/.test(r.progress.trim()) || r.progress === '', `${lab}@${w}: progress text is readable: "${r.progress.trim()}"`);
      T.ok(r.overflow <= 0, `${lab}@${w}: no page overflow`);
      T.ok(!r.covered, `${lab}@${w}: sticky nav does not cover the current heading`);
      if (lab === 'lab05' && w === 375) {
        const status = p.locator('.nav-progress');
        const label = await status.getAttribute('aria-label');
        T.ok(/Activate to view full details\./.test(label || ''), 'truncated progress status advertises its full-detail action');
        await status.click();
        const expanded = await status.getAttribute('aria-expanded');
        const detail = p.locator('.nav-progress-detail');
        const full = await detail.locator('.nav-progress-full').textContent();
        const box = await detail.boundingBox();
        T.ok(expanded === 'true' && !!full && full === label.replace(/^Progress status: /, '').replace(/\. Activate to view full details\.$/, ''), 'tap opens the complete status text');
        T.ok(box && box.x >= 0 && box.x + box.width <= w + 1, 'full status panel fits the narrow viewport');
        await status.focus(); await p.keyboard.press('Enter');
        T.ok(await status.getAttribute('aria-expanded') === 'false', 'Enter closes the full status panel');
        await p.keyboard.press('Space');
        T.ok(await status.getAttribute('aria-expanded') === 'true', 'Space opens the full status panel');
      }
      await p.close();
    }
    await ctx.close();
  }
  await b.close();
  T.done('t12-nav');
})();
