/* Burning Fuels chart: no bar-category label ever wraps onto a second line or splits inside a word, at 390 px dark and 360 px (narrow names) and at
   1366 px (full names), in all three chart views (temperature rise, mass lost, BTB change), with 1 to 5 fuels recorded.
   Run: NODE_PATH=$(npm root -g) node tests/t107-b2-burn-chart-labels.js */
const T = require('./_h');
const PAGE = 'openscied-b2-burn-lab.html', KEY = 'aplab:openscied:b2-burn-lab:v1';
const stub = pg => pg.route(/gc\.zgo\.at|fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, contentType: /gc\.zgo\.at/.test(r.request().url()) ? 'application/javascript' : 'text/css', body: '' }));
const go = async (p, id) => { await p.evaluate(h => { location.hash = h; }, id); await p.waitForFunction(h => document.querySelector('#' + h + '.is-current'), id); await p.waitForTimeout(200); };
const FUELS = ['grass', 'leaves', 'wood', 'charcoal', 'peat'];
const NARROW = ['Hay', 'Leaf', 'Wood', 'Char', 'Peat'], WIDE = ['Grass', 'Leaves', 'Wood', 'Charcoal', 'Peat'];
(async () => {
  const browser = await T.launch(), server = await T.serve();
  try {
    for (const [w, h, dark, narrow] of [[390, 844, true, true], [360, 800, false, true], [1366, 900, false, false]]) {
      const ctx = await T.ctxFor(browser, { width: w, height: h, dark });
      const p = await ctx.newPage(); await stub(p);
      await p.goto(server.url + PAGE); await p.waitForFunction(() => window.B2Burn && document.querySelector('#burn-scene').dataset.mounted === '1');
      const want = narrow ? NARROW : WIDE, bad = [];
      for (let n = 1; n <= 5; n++) {
        await p.evaluate(([k, fuels]) => {
          const seed = B2Burn.seed('burn'), d = JSON.parse(localStorage.getItem(k) || '{"v":1,"fields":{},"responseIds":[]}');
          d.burn = { seed, fuel: 'grass', current: null, records: fuels.map(f => ({ fuel: f, n: 1, obs: [] })) }; localStorage.setItem(k, JSON.stringify(d));
        }, [KEY, FUELS.slice(0, n)]);
        await p.reload(); await p.waitForFunction(() => document.querySelector('#burn-scene').dataset.mounted === '1'); await go(p, 'burn');
        for (const metric of ['Temperature rise', 'Mass lost', 'BTB change']) {
          await p.locator('.bn-chip', { hasText: metric }).click(); await p.waitForTimeout(120);
          const r = await p.evaluate(() => {
            const svg = document.querySelector('#burn-scene .bn-chart svg[role=img]'), out = { labels: [], widths: [] };
            svg.querySelectorAll('text').forEach(t => { if (t.classList.contains('axis-label')) return; const sp = t.querySelectorAll('tspan'); out.labels.push({ text: t.textContent, lines: sp.length || 1, tf: t.getAttribute('transform') || '' }); });
            const box = svg.getBoundingClientRect(); out.w = Math.round(box.width); out.over = document.documentElement.scrollWidth - document.documentElement.clientWidth;
            return out;
          });
          const cats = r.labels.filter(l => /^[A-Za-z]+$/.test(l.text) && l.text !== 'Fuel' && !/^Simulated|data$/.test(l.text));
          const names = cats.map(c => c.text);
          if (!want.every(x => names.includes(x))) bad.push(`${w}px n=${n} ${metric}: tick labels ${JSON.stringify(names)} are not exactly ${JSON.stringify(want)}`);
          if (cats.some(c => c.lines !== 1)) bad.push(`${w}px n=${n} ${metric}: a tick label wraps onto several lines ${JSON.stringify(cats.filter(c => c.lines !== 1))}`);
          if (names.some(x => !want.includes(x) && x !== 'Fuel')) bad.push(`${w}px n=${n} ${metric}: split or unknown tick text ${JSON.stringify(names.filter(x => !want.includes(x)))}`);
          if (r.over > 0) bad.push(`${w}px n=${n} ${metric}: page scrolls sideways by ${r.over}`);
        }
      }
      T.ok(bad.length === 0, `${w} px ${dark ? 'dark' : 'light'}: every bar label stays on one line and whole, in all three views with 1 to 5 fuels recorded ${bad.slice(0, 3).join(' | ')}`);
      const cap = await p.locator('#burn-scene figcaption').innerText();
      T.ok(narrow ? /Hay = dried grass/.test(cap) && /Char = charcoal/.test(cap) : !/Hay =/.test(cap), `${w} px: the caption explains the short names only when they are used`);
      await ctx.close();
    }
  } finally { await browser.close(); server.close(); }
  T.done('t107-b2-burn-chart-labels');
})().catch(e => { console.error(e); process.exit(1); });
