/* Audit 5, item 4: every lab has one "What this simulation models" disclosure (details.sim-model) in its Background part,
   with three short bullets (process, what is included, what is simplified), that opens without overflow on a 400 px dark phone.
   Run: NODE_PATH=$(npm root -g) node tests/t58-sim-model.js */
const { ok, done, launch, ctxFor, open, LABS } = require('./_h');
(async () => {
  const b = await launch();
  const desk = await ctxFor(b, { reduced: true }), phone = await ctxFor(b, { width: 400, height: 800, dark: true, reduced: true });
  for (const lab of LABS) {
    for (const [ctx, tag] of [[desk, '1366'], [phone, '400 dark']]) {
      const p = await open(ctx, lab + '.html');
      const r = await p.evaluate(() => {
        const all = document.querySelectorAll('details.sim-model');
        const d = all[0]; if (!d) return { n: 0 };
        if (window.Lab && Lab.pages && Lab.pages.go) { try { Lab.pages.go('background'); } catch (e) { /* single-page layout */ } }
        d.open = true;
        const lis = d.querySelectorAll(':scope > .inner > ul > li');
        const words = d.textContent.replace(/\s+/g, ' ').trim().split(' ').length;
        const rect = d.getBoundingClientRect();
        const bg = d.closest('[data-step="Background"]');
        const ink = getComputedStyle(d.querySelector('li')).color, bgc = getComputedStyle(d).backgroundColor;
        return { n: all.length, summary: d.querySelector('summary').textContent.trim(), lis: lis.length, labels: Array.from(lis).map(li => (li.querySelector('strong') || {}).textContent), words, inBg: !!bg,
          over: document.documentElement.scrollWidth - document.documentElement.clientWidth, right: rect.right, w: rect.width, vw: innerWidth, ink, bgc };
      });
      if (tag === '1366') {
        ok(r.n === 1, `${lab}: exactly one details.sim-model (found ${r.n})`);
        if (!r.n) { await p.close(); continue; }
        ok(r.summary === 'What this simulation models', `${lab}: summary reads "What this simulation models"`);
        ok(r.lis === 3 && r.labels.join('|') === 'Process:|Included:|Simplified or left out:', `${lab}: three bullets (process, included, simplified) — ${r.lis}: ${r.labels.join(' / ')}`);
        ok(r.inBg, `${lab}: sits in the Background part`);
        ok(r.words >= 60 && r.words <= 115, `${lab}: about 60–110 words (${r.words})`);
      } else if (r.n) {
        ok(r.w > 200 && r.over <= 0 && r.right <= r.vw + 0.5, `${lab} @400 dark: open disclosure fits (width ${Math.round(r.w)}, overflow ${r.over}, right ${Math.round(r.right)} of ${r.vw})`);
        ok(r.ink !== r.bgc, `${lab} @400 dark: text color differs from its background (${r.ink} on ${r.bgc})`);
      }
      ok(p.errors.length === 0, `${lab} @${tag}: no page errors ${p.errors.join('|')}`);
      await p.close();
    }
  }
  await b.close(); done('t58-sim-model');
})();
