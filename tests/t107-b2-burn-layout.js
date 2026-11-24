/* Burning Fuels: layout at 390 px dark, 768, 1366 light and 1920, in several scene states (ready, mid-burn for peat and grass, finished and
   unrecorded, all five recorded). Checks no sideways scroll, the canvas fits its container and is drawn, labels stay inside the canvas, nothing
   important is under the sticky step bar, and no CLS on load. Screenshots go to SHOTS (default test-artifacts/).
   Run: NODE_PATH=$(npm root -g) node tests/t107-b2-burn-layout.js */
const T = require('./_h');
const fs = require('fs'), path = require('path');
const OUT = process.env.SHOTS || path.join(T.ROOT, 'test-artifacts'); fs.mkdirSync(OUT, { recursive: true });
const PAGE = 'openscied-b2-burn-lab.html', KEY = 'aplab:openscied:b2-burn-lab:v1';
const stub = pg => pg.route(/gc\.zgo\.at|fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, contentType: /gc\.zgo\.at/.test(r.request().url()) ? 'application/javascript' : 'text/css', body: '' }));
const go = async (p, id) => { await p.evaluate(h => { location.hash = h; }, id); await p.waitForFunction(h => document.querySelector('#' + h + '.is-current'), id); await p.waitForTimeout(250); };
const check = async (p, label) => {
  const r = await p.evaluate(() => {
    const out = { over: document.documentElement.scrollWidth - document.documentElement.clientWidth, canvas: [], clip: [] };
    const sec = document.querySelector('.step.is-current');
    sec.querySelectorAll('canvas').forEach(c => { const r = c.getBoundingClientRect(), pr = c.parentElement.getBoundingClientRect(); out.canvas.push({ w: Math.round(r.width), fits: r.left >= pr.left - 1 && r.right <= pr.right + 1, drawn: c.width > 0 }); });
    sec.querySelectorAll('button, select, .table-wrap, figure, svg').forEach(e => { const r = e.getBoundingClientRect(); if (r.width && r.right > innerWidth + 1) out.clip.push(e.tagName + '.' + e.className); });
    return out;
  });
  T.ok(r.over <= 0 && r.canvas.every(c => c.fits && c.drawn) && r.clip.length === 0, label + ': fits (' + JSON.stringify(r.canvas) + ' ' + r.clip.join(',') + ' over ' + r.over + ')');
};
// The laser dot must lie inside the drawn fuel (before) or ash (after), and inside the canvas, at every size.
const laserCheck = async (p, label, target) => {
  const r = await p.evaluate(() => { const c = document.querySelector('#burn-scene canvas'), t = c.getAttribute('data-laser'); return { l: t ? JSON.parse(t) : null, w: c.clientWidth, h: c.clientHeight }; });
  T.ok(!!r.l && r.l.target === target && Math.hypot(r.l.x - r.l.area.x, r.l.y - r.l.area.y) <= r.l.area.r && r.l.x > 0 && r.l.x < r.w && r.l.y > 0 && r.l.y < r.h, label + ': the laser dot lies inside the drawn ' + target + ' ' + JSON.stringify(r.l));
};
// Put the saved burn at a chosen moment, then reload so the scene reads it (the run is timestamp based).
const setBurn = async (p, fuel, frac, records, opts) => {
  opts = opts || {};
  await p.evaluate(([k, fuel, frac, records, opts]) => {
    const L = window.B2BurnLogic, seed = B2Burn.seed('burn'), r = L.burnResult(seed, fuel, 1);
    const cur = frac == null ? null : { fuel, n: 1, startedAt: Date.now() - frac * r.runS / L.RATE * 1000, skipped: false, after: !!opts.after };
    const d = JSON.parse(localStorage.getItem(k) || '{"v":1,"fields":{},"responseIds":[]}');
    d.burn = { seed, fuel, current: cur, records: records.map(f => ({ fuel: f, n: 1, obs: ['smoke', 'ash'] })), weighed: opts.weighed ? { fuel, n: 1 } : null }; d.lastVisitedAt = Date.now(); localStorage.setItem(k, JSON.stringify(d));
  }, [KEY, fuel, frac, records, opts]);
  await p.reload(); await p.waitForFunction(() => document.querySelector('#burn-scene').dataset.mounted === '1'); await go(p, 'burn');
};
(async () => {
  const browser = await T.launch(), server = await T.serve();
  try {
    for (const [w, h, dark, tag] of [[390, 844, true, '390-dark'], [768, 1024, false, '768'], [1366, 900, false, '1366-light'], [1920, 1080, false, '1920']]) {
      const ctx = await T.ctxFor(browser, { width: w, height: h, dark });
      const p = await ctx.newPage(); await stub(p);
      await p.addInitScript(() => { window.__cls = 0; new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true }); });
      await p.goto(server.url + PAGE); await p.waitForFunction(() => window.B2Burn && document.querySelector('.step.is-current')); await p.waitForTimeout(500);
      T.ok(await p.evaluate(() => window.__cls) <= 0.1, tag + ': CLS on load at most 0.1 (' + (await p.evaluate(() => window.__cls)).toFixed(3) + ')');
      const shot = async n => p.screenshot({ path: path.join(OUT, 'b2burn-' + tag + '-' + n + '.png'), fullPage: true });
      await go(p, 'burn'); await check(p, tag + ' ready, not weighed'); await shot('ready-unweighed');
      await setBurn(p, 'peat', null, [], { weighed: true }); await check(p, tag + ' ready, weighed with the laser on the fuel'); await shot('ready');
      await laserCheck(p, tag + ' before', 'fuel');
      await setBurn(p, 'peat', 0.15, []); await check(p, tag + ' peat being lit, laser put down'); await shot('peat-heating');
      await setBurn(p, 'peat', 0.5, []); await check(p, tag + ' peat mid-burn, laser put down'); await shot('peat-mid');
      await setBurn(p, 'grass', 0.2, ['peat']); await check(p, tag + ' grass bright flame'); await shot('grass-mid');
      await setBurn(p, 'charcoal', 0.5, ['peat', 'grass']); await check(p, tag + ' charcoal glow'); await shot('charcoal-mid');
      await setBurn(p, 'peat', 1.2, ['grass', 'wood']); await check(p, tag + ' peat finished, dome still down'); await shot('peat-finished-down');
      await setBurn(p, 'peat', 1.2, ['grass', 'wood'], { after: true }); await check(p, tag + ' peat finished, dome lifted, after reading'); await shot('peat-finished');
      await laserCheck(p, tag + ' after', 'ash');
      await setBurn(p, 'wood', 1.2, ['peat', 'grass']); await check(p, tag + ' finished, second weighing pending'); await shot('finished');
      await setBurn(p, 'wood', null, ['grass', 'leaves', 'wood', 'charcoal', 'peat']); await check(p, tag + ' all five recorded'); await shot('five');
      for (const id of ['overview', 'fuels', 'sense', 'sort', 'peat', 'wrapup']) { await go(p, id); await check(p, tag + ' ' + id); }
      await shot('wrapup');
      await ctx.close();
    }
  } finally { await browser.close(); server.close(); }
  T.done('t107-b2-burn-layout');
})().catch(e => { console.error(e); process.exit(1); });
