/* Peat Bog Carbon Lab (openscied-b2-peat-bog-lab.html): axe-core (WCAG 2.x A/AA, critical and serious) on every section in light and dark at
   1366 and 390 px with data in place, no sideways scrolling at 390 dark / 768 / 1366 / 1920, text contrast of the page's own colors,
   layout shift on load, controls and pictures that fit, and a screenshot set in test-artifacts/. Needs axe-core (npm ci, or AXE=<path>).
   Run: NODE_PATH=$(npm root -g) AXE=... node tests/t105-openscied-b2-peat-bog-a11y-layout.js */
const T = require('./_h');
const fs = require('fs'), path = require('path');
const PAGE = 'openscied-b2-peat-bog-lab.html';
const SECTIONS = ['overview', 'bog', 'graph', 'zombie', 'warming', 'trials', 'model'];
const OUT = process.env.SHOTS || path.join(T.ROOT, 'test-artifacts'); fs.mkdirSync(OUT, { recursive: true });
const stub = pg => pg.route(/gc\.zgo\.at|fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, contentType: /gc\.zgo\.at/.test(r.request().url()) ? 'application/javascript' : 'text/css', body: '' }));
function axePath() {
  const c = [process.env.AXE, (() => { try { return require.resolve('axe-core/axe.min.js'); } catch (e) { return null; } })(), path.join(__dirname, '../node_modules/axe-core/axe.min.js')].filter(Boolean);
  return c.find(f => fs.existsSync(f));
}
const go = async (p, id) => { await p.evaluate(h => { location.hash = h; }, id); await p.waitForFunction(h => document.querySelector('#' + h + '.is-current'), id); await p.waitForTimeout(150); };
const lum = c => { const [r, g, b] = c.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
async function fill(p) {   // put data in every box
  await p.evaluate(() => {
    B2Peat.setState({ wet: 20, temp: 17, burn: 65 });
    B2Peat.record('bog'); B2Peat.setState({ wet: 70, burn: 0 }); B2Peat.record('bog');
  });
}
(async () => {
  const file = axePath();
  const browser = await T.launch(), server = await T.serve();
  try {
    if (!file) T.ok(false, 'axe-core not found: set AXE=<path>/node_modules/axe-core/axe.min.js');
    else {
      const src = fs.readFileSync(file, 'utf8');
      for (const [w, h] of [[1366, 900], [390, 844]]) for (const dark of [false, true]) {
        const ctx = await T.ctxFor(browser, { width: w, height: h, dark, reduced: true });
        const p = await ctx.newPage(); await stub(p);
        await p.goto(server.url + PAGE); await p.waitForFunction(() => window.B2Peat && document.querySelector('.step.is-current'));
        await p.addScriptTag({ content: src });
        await fill(p);
        const found = [];
        for (const id of SECTIONS) {
          for (const st of id === 'zombie' ? [0, 2] : [0]) {
            await go(p, id);
            if (id === 'zombie') await p.evaluate(s => document.querySelector('[data-season="' + s + '"]').click(), st);
            if (id === 'graph') await p.evaluate(() => document.querySelector('#graph details').open = true);
            if (id === 'warming') await p.evaluate(() => document.querySelector('#warming details').open = true);
            if (id === 'overview') await p.evaluate(() => document.querySelector('#overview details').open = true);
            const res = await p.evaluate(async () => (await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] }, resultTypes: ['violations'] }))
              .violations.filter(v => v.impact === 'critical' || v.impact === 'serious').map(v => v.id + ': ' + v.nodes.slice(0, 3).map(n => n.target.join(' ') + ' [' + (n.any[0] ? n.any[0].message : '').slice(0, 90) + ']').join(' ; ')));
            res.forEach(r => found.push(id + ' ' + r));
          }
        }
        T.ok(found.length === 0, `axe clean at ${w}px ${dark ? 'dark' : 'light'} ${found.join(' | ')}`);
        await ctx.close();
      }
    }

    // --- layout at four sizes, in several states; screenshots to look at ---
    const STATES = { start: {}, lowtilt: { tilt: 22.1 }, hightilt: { tilt: 24.5, co2: 260 }, fire: { wet: 15, temp: 16, burn: 70 }, zombie: { temp: 19, wet: 22, burn: 55 }, extreme: { tilt: 22.1, temp: 30, co2: 2000, o2: 35, wet: 0, burn: 100 } };
    for (const [w, h, dark] of [[390, 844, true], [768, 1024, false], [1366, 768, false], [1920, 1080, false]]) {
      const ctx = await T.ctxFor(browser, { width: w, height: h, dark });
      const p = await ctx.newPage(); await stub(p); const errs = []; p.on('pageerror', e => errs.push(e.message));
      await p.goto(server.url + PAGE); await p.waitForFunction(() => window.B2Peat && document.querySelector('.step.is-current'));
      const problems = [];
      for (const [name, st] of Object.entries(STATES)) {
        await p.evaluate(s => B2Peat.setState(s), Object.assign({ tilt: 23.44, temp: 10, co2: 420, o2: 21, wet: 75, burn: 0 }, st));
        for (const id of SECTIONS) {
          if (id === 'trials' && name !== 'start' && name !== 'extreme') continue;
          if (id === 'model' && name !== 'start') continue;
          await go(p, id);
          if (id === 'zombie') await p.evaluate(() => document.querySelector('[data-season="2"]').click());
          if (id === 'warming') await p.evaluate(() => { const r = document.getElementById('fossil'); r.value = name === 'extreme' ? 20 : 10; r.dispatchEvent(new Event('input', { bubbles: true })); });
          if (id === 'trials' && name === 'start') await p.evaluate(() => { B2Peat.record('bog'); });
          await p.waitForTimeout(120);
          const r = await p.evaluate(() => {
            const de = document.documentElement, out = { over: de.scrollWidth - innerWidth, clipped: [] };
            const sec = document.querySelector('.step.is-current');
            sec.querySelectorAll('svg.chart, .diagram svg, .tiltbox svg, .meter, .panel, .chart-box, .note, .flowbar, .mrow, .legend').forEach(e => {
              if (e.closest('.pic-scroll') && !e.matches('svg')) return;
              const b = e.getBoundingClientRect(); if (!b.width) return;
              const par = e.closest('.pic-scroll, .mgrid, .table-wrap, .stage, .panel, .diagram');
              const pb = (par && par !== e ? par : sec).getBoundingClientRect();
              if (!(e.closest('.pic-scroll') || e.closest('.mgrid')) && (b.right > innerWidth + 1 || b.left < -1)) out.clipped.push((e.id || e.className.baseVal || e.className).toString().slice(0, 30) + ' ' + Math.round(b.left) + '..' + Math.round(b.right));
              void pb;
            });
            // text must not spill out of its own box (buttons, chips, meters)
            sec.querySelectorAll('.btn, .chip2, .meter, .cell, .flowbar').forEach(e => { const b = e.getBoundingClientRect(); if (b.width && e.scrollWidth > e.clientWidth + 2 && getComputedStyle(e).overflow === 'visible' && !e.closest('.mgrid')) out.clipped.push('text spills: ' + e.textContent.trim().slice(0, 30)); });
            return out;
          });
          if (r.over > 1) problems.push(`${name}/${id} sideways scroll ${r.over}px`);
          if (r.clipped.length) problems.push(`${name}/${id} ${r.clipped.slice(0, 3).join('; ')}`);
          if (['start', 'fire', 'extreme', 'lowtilt', 'hightilt'].includes(name) && ['bog', 'zombie', 'warming', 'graph', 'trials'].includes(id) || (id === 'overview' && name === 'start')) {
            if (process.env.NOSHOTS !== '1') await p.screenshot({ path: path.join(OUT, `b2-peat-${name}-${id}-${w}${dark ? 'd' : ''}.png`), fullPage: false });
          }
        }
      }
      T.ok(problems.length === 0 && errs.length === 0, `${w}px: no sideways scroll, nothing clipped, no errors in ${Object.keys(STATES).length} states ${problems.slice(0, 4).join(' | ')} ${errs.join()}`);
      // the whole bog picture and the numbers are on screen together on a laptop
      if (w === 1366) {
        await go(p, 'bog'); await p.evaluate(() => B2Peat.setState({ tilt: 23.44, temp: 10, co2: 420, o2: 21, wet: 75, burn: 0 }));
        const fit = await p.evaluate(() => { const s = document.getElementById('bog-svg').getBoundingClientRect(), m = document.getElementById('meters').getBoundingClientRect(); return { svgBottom: s.bottom, metersTop: m.top, h: innerHeight, svgTop: s.top }; });
        T.ok(fit.svgTop >= 0 && fit.metersTop < fit.h, 'at 1366x768 the bog picture and the number boxes are on screen together ' + JSON.stringify(fit));
      }
      await ctx.close();
    }

    // --- contrast of the page's own text colors on their backgrounds (computed styles, both themes) ---
    for (const dark of [false, true]) {
      const ctx = await T.ctxFor(browser, { width: 1366, height: 900, dark, reduced: true });
      const p = await ctx.newPage(); await stub(p);
      await p.goto(server.url + PAGE); await p.waitForFunction(() => window.B2Peat);
      const bad = [];
      for (const id of ['overview', 'bog', 'zombie', 'trials']) {
        await go(p, id);
        if (id === 'bog') await p.evaluate(() => B2Peat.setState({ wet: 10, temp: 25, burn: 60 }));
        const items = await p.evaluate(() => {
          const out = [], sec = document.querySelector('.step.is-current');
          const parse = s => (s.match(/[\d.]+/g) || []).map(Number);
          function bgOf(e) { for (let n = e; n; n = n.parentElement) { const c = parse(getComputedStyle(n).backgroundColor); if (c.length >= 3 && (c.length < 4 || c[3] > 0.9)) return c.slice(0, 3); } return [255, 255, 255]; }
          sec.querySelectorAll('.val, .chance, .rl, .netkey b, .meter .sub, .rec-status, .note, .tip, .hint, .numunit, #nVal, .legend li, .flowbar span, .info, td.p, td.r, td.b, .facts dt, .facts dd').forEach(e => {
            if (!e.getBoundingClientRect().width || !e.textContent.trim()) return;
            const cs = getComputedStyle(e), fg = parse(cs.color).slice(0, 3), bg = bgOf(e);
            out.push({ t: (e.className.toString() || e.tagName) + ': ' + e.textContent.trim().slice(0, 24), fg, bg, big: parseFloat(cs.fontSize) >= 24 || (parseFloat(cs.fontSize) >= 18.66 && +cs.fontWeight >= 700) });
          });
          return out;
        });
        items.forEach(i => { const r = ratio(i.fg, i.bg); if (r < (i.big ? 3 : 4.5)) bad.push(`${id} ${i.t} ${r.toFixed(2)}`); });
      }
      T.ok(bad.length === 0, `text contrast >= 4.5:1 (3:1 large) in ${dark ? 'dark' : 'light'} ${bad.slice(0, 6).join(' | ')}`);
      await ctx.close();
    }

    // --- no layout shift on load ---
    {
      const ctx = await T.ctxFor(browser, { width: 1366, height: 768 });
      const p = await ctx.newPage(); await stub(p);
      await p.addInitScript(() => { window.__cls = 0; try { new PerformanceObserver(l => l.getEntries().forEach(e => { if (!e.hadRecentInput) window.__cls += e.value; })).observe({ type: 'layout-shift', buffered: true }); } catch (e) { /* unsupported */ } });
      for (const hash of ['', '#bog', '#warming']) {
        await p.goto(server.url + PAGE + hash); await p.waitForFunction(() => window.B2Peat); await p.waitForTimeout(1200);
        const cls = await p.evaluate(() => window.__cls);
        T.ok(cls <= 0.1, `CLS ${cls.toFixed(3)} <= 0.1 on load ${hash || '(overview)'}`);
      }
      await ctx.close();
    }
  } finally { await browser.close(); server.close(); }
  T.done('t105-openscied-b2-peat-bog-a11y-layout');
})().catch(e => { console.error(e); process.exit(1); });
