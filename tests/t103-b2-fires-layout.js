/* B.2 Fires: layout at 390 px dark, 768, 1366 light and 1920, in several scene states (before, mid-run, finished, starch). Checks no sideways
   scroll, the canvases fit their container, nothing important is under the sticky step bar, the canvases are drawn, and no CLS on load.
   Screenshots go to SHOTS (default test-artifacts/). Run: NODE_PATH=$(npm root -g) node tests/t103-b2-fires-layout.js */
const T = require('./_h');
const fs = require('fs'), path = require('path');
const OUT = process.env.SHOTS || path.join(T.ROOT, 'test-artifacts'); fs.mkdirSync(OUT, { recursive: true });
const PAGE = 'openscied-b2-fires.html';
const stub = pg => pg.route(/gc\.zgo\.at|fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, contentType: /gc\.zgo\.at/.test(r.request().url()) ? 'application/javascript' : 'text/css', body: '' }));
const go = async (p, id) => { await p.evaluate(h => { location.hash = h; }, id); await p.waitForFunction(h => document.querySelector('#' + h + '.is-current'), id); await p.waitForTimeout(250); };
const check = async (p, label) => {
  const r = await p.evaluate(() => {
    const out = { over: document.documentElement.scrollWidth - document.documentElement.clientWidth, canvas: [], clip: [] };
    const sec = document.querySelector('.step.is-current'), sr = sec.getBoundingClientRect();
    sec.querySelectorAll('canvas').forEach(c => { const r = c.getBoundingClientRect(), pr = c.parentElement.getBoundingClientRect(); out.canvas.push({ w: Math.round(r.width), fits: r.left >= pr.left - 1 && r.right <= pr.right + 1, drawn: c.width > 0 }); });
    sec.querySelectorAll('button, select, .table-wrap, figure, svg').forEach(e => { const r = e.getBoundingClientRect(); if (r.width && r.right > innerWidth + 1) out.clip.push(e.tagName + '.' + e.className); });
    return out;
  });
  T.ok(r.over <= 0 && r.canvas.every(c => c.fits && c.drawn) && r.clip.length === 0, label + ': fits (' + JSON.stringify(r.canvas) + ' ' + r.clip.join(',') + ' over ' + r.over + ')');
};
(async () => {
  const browser = await T.launch(), server = await T.serve();
  try {
    for (const [w, h, dark, tag] of [[390, 844, true, '390-dark'], [768, 1024, false, '768'], [1366, 900, false, '1366-light'], [1920, 1080, false, '1920']]) {
      const ctx = await T.ctxFor(browser, { width: w, height: h, dark });
      const p = await ctx.newPage(); await stub(p);
      await p.addInitScript(() => { window.__cls = 0; new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true }); });
      await p.goto(server.url + PAGE); await p.waitForFunction(() => window.B2Fires && document.querySelector('.step.is-current')); await p.waitForTimeout(500);
      T.ok(await p.evaluate(() => window.__cls) <= 0.1, tag + ': CLS on load at most 0.1 (' + (await p.evaluate(() => window.__cls)).toFixed(3) + ')');
      const shot = async n => p.screenshot({ path: path.join(OUT, 'b2-' + tag + '-' + n + '.png'), fullPage: true });
      await go(p, 'cards'); await check(p, tag + ' cards empty'); await shot('cards-empty');
      for (const [c, z] of [['sugar', 'in'], ['oxygen', 'in'], ['carbon-dioxide', 'out'], ['water', 'in'], ['energy', 'out']]) await p.locator('.mc-card[data-card="' + c + '"] [data-zone="' + z + '"]').click();
      await check(p, tag + ' cards one wrong'); await shot('cards-wrong');
      await p.locator('.mc-card[data-card="water"] [data-zone="out"]').click(); await check(p, tag + ' cards solved'); await shot('cards-solved');
      await go(p, 'yeast'); await check(p, tag + ' yeast setup'); await shot('yeast-setup');
      await p.selectOption('#dc-temp-0', '5'); await p.selectOption('#dc-temp-2', '55'); await p.locator('[data-dc="start"]').click(); await p.waitForTimeout(18000);
      await p.locator('[data-dc="record-all"]').click(); await check(p, tag + ' yeast mid-run (5, 27, 55 C)'); await shot('yeast-mid');
      await p.locator('[data-dc="skip"]').click(); await p.locator('[data-dc="record-all"]').click(); await check(p, tag + ' yeast finished'); await shot('yeast-done');
      await p.locator('[data-dc="reset"]').click(); await p.locator('[data-dc="reset-yes"]').click();
      await p.selectOption('#dc-temp-0', '18'); await p.selectOption('#dc-temp-1', '27'); await p.selectOption('#dc-temp-2', '43');
      await p.locator('[data-dc="start"]').click(); await p.locator('[data-dc="skip"]').click(); await p.locator('[data-dc="record-all"]').click(); await shot('yeast-done-class');
      await go(p, 'tilt'); await check(p, tag + ' tilt setup'); await shot('tilt-setup');
      await p.selectOption('#tl-light-0', 'tilt70'); await p.selectOption('#tl-light-1', 'direct'); await p.selectOption('#tl-light-2', 'foil'); await p.locator('[data-tl="start"]').click(); await p.waitForTimeout(25000);
      await check(p, tag + ' tilt mid-night'); await shot('tilt-mid');
      await p.locator('[data-tl="skip"]').click(); await check(p, tag + ' tilt morning, foil still on'); await shot('tilt-morning');
      await p.locator('[data-tl="unwrap"]').click(); await p.locator('[data-tl="starch"]').click(); await check(p, tag + ' tilt results and starch'); await shot('tilt-done');
      for (const id of ['overview', 'sense5', 'peat']) { await go(p, id); await check(p, tag + ' ' + id); }
      await p.locator('#cer-model-data summary').click();
      const visibleEvidenceFits = await p.evaluate(() => {
        const inner = document.querySelector('#cer-model-data[open] > .inner');
        const tables = [...(inner?.querySelectorAll('.table-wrap') || [])];
        if (tables.length !== 2) return false;
        return tables.every(table => {
          const bounds = table.getBoundingClientRect(), parent = table.parentElement.getBoundingClientRect();
          return bounds.width > 0 && bounds.left >= parent.left - 1 && bounds.right <= parent.right + 1;
        });
      });
      T.ok(visibleEvidenceFits, tag + ' peat: both opened evidence tables stay within their own panel');
      await check(p, tag + ' peat: evidence disclosure open'); await shot('peat-evidence');
      await go(p, 'wrapup'); await check(p, tag + ' wrapup'); await shot('wrapup');
      await ctx.close();
    }
  } finally { await browser.close(); server.close(); }
  T.done('t103-b2-fires-layout');
})().catch(e => { console.error(e); process.exit(1); });
