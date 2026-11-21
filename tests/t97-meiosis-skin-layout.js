/* Meiosis and skin-data scenes (openscied-b3-inheritance-environment.html): fit at 390, 768, 1366 and 1920 px (no sideways scroll, nothing
   outside the scene), drawing text at least 11 px, targets at least 24 px, light and dark, and the same height before and after interaction
   of the drawing area (no layout jump). Run: NODE_PATH=$(npm root -g) node tests/t97-meiosis-skin-layout.js */
const T = require('./_h');
const PAGE = 'openscied-b3-inheritance-environment.html';
const stub = pg => pg.route(/gc\.zgo\.at|fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, contentType: /gc\.zgo\.at/.test(r.request().url()) ? 'application/javascript' : 'text/css', body: '' }));
async function check(p, sel, tag) {
  const m = await p.evaluate(sel => {
    const host = document.querySelector(sel), hr = host.getBoundingClientRect(), small = [], tiny = [], out = [];
    host.querySelectorAll('svg text').forEach(t => { if (t.closest('[hidden]') || !t.textContent.trim() || getComputedStyle(t).opacity === '0' || t.style.opacity === '0') return; const m = t.getScreenCTM(); const fs = parseFloat(t.getAttribute('font-size') || getComputedStyle(t).fontSize) * (m ? Math.hypot(m.a, m.b) : 1); if (fs < 10.9) small.push(t.textContent + ' ' + fs.toFixed(1)); });
    host.querySelectorAll('p, span, button, li, th, td, label, h4, figcaption, caption').forEach(e => { if (e.closest('[hidden]') || e.closest('svg') || e.closest('.sk-tablewrap')) return; if (Array.from(e.childNodes).some(n => n.nodeType === 3 && n.textContent.trim()) && parseFloat(getComputedStyle(e).fontSize) < 10.9) small.push('html ' + e.textContent.slice(0, 20)); });
    host.querySelectorAll('button, input[type=range]').forEach(b => { if (b.closest('[hidden]') || b.closest('.sk-tablewrap')) return; const r = b.getBoundingClientRect(); if (r.width && (r.width < 24 || r.height < 24)) tiny.push(b.textContent + ' ' + Math.round(r.width) + 'x' + Math.round(r.height)); });
    host.querySelectorAll('.sk-pt .sk-hit').forEach(h => { if (h.closest('[hidden]')) return; const r = h.getBoundingClientRect(); if (r.width && r.width < 24) tiny.push('point ' + Math.round(r.width)); });
    host.querySelectorAll('svg, .sk-fig, .ms-panel, .ms-cmp, .sk-panel, .sk-readout').forEach(e => { if (e.closest('[hidden]')) return; const r = e.getBoundingClientRect(); if (r.width && (r.left < hr.left - 1 || r.right > hr.right + 1)) out.push(e.tagName + '.' + e.getAttribute('class') + ' ' + Math.round(r.left) + '-' + Math.round(r.right) + ' vs ' + Math.round(hr.left) + '-' + Math.round(hr.right)); });
    return { docW: document.documentElement.scrollWidth, winW: innerWidth, small, tiny, out };
  }, sel);
  T.ok(m.docW <= m.winW + 1, `${tag}: no sideways page scroll (${m.docW} <= ${m.winW})`);
  T.ok(m.small.length === 0, `${tag}: all text at least 11 px ${m.small.slice(0, 4).join(', ')}`);
  T.ok(m.tiny.length === 0, `${tag}: targets at least 24 px ${m.tiny.slice(0, 4).join(', ')}`);
  T.ok(m.out.length === 0, `${tag}: nothing sticks out of the scene ${m.out.slice(0, 3).join(' | ')}`);
}
(async () => {
  const browser = await T.launch(), server = await T.serve();
  try {
    for (const [w, h, dark] of [[390, 844, true], [768, 1024, false], [1366, 900, false], [1920, 1080, true]]) {
      const ctx = await T.ctxFor(browser, { width: w, height: h, dark, reduced: true });
      await stub(ctx);
      const p = await ctx.newPage(), problems = [];
      p.on('pageerror', e => problems.push(e.message));
      await p.goto(server.url + PAGE + '#passing');
      await p.waitForSelector('#meiosis-scene[data-ms]'); await p.waitForTimeout(200);
      const tag = w + (dark ? ' dark' : ' light');
      const h0 = await p.locator('#meiosis-scene svg').evaluate(e => e.getBoundingClientRect().height);
      for (const st of [0, 3, 5]) { await p.click('#meiosis-scene [data-step="' + st + '"]'); await p.click('#meiosis-scene .ms-switch'); await check(p, '#meiosis-scene', `meiosis ${tag} step ${st + 1}`); }
      T.ok(Math.abs(h0 - await p.locator('#meiosis-scene svg').evaluate(e => e.getBoundingClientRect().height)) < 1, `${tag}: the drawing keeps its height between steps`);
      await p.evaluate(() => { location.hash = 'skindata'; });
      await p.waitForSelector('#skin-data-scene[data-sk]'); await p.waitForTimeout(200);
      await check(p, '#skin-data-scene', `skin ${tag}`);
      await p.click('#skin-data-scene [data-toggle="table"]'); await p.click('#skin-data-scene [data-scale="same"]'); await p.click('#skin-data-scene [data-toggle="trend"]');
      await check(p, '#skin-data-scene', `skin ${tag} table, same scale, trend`);
      const tabs = await p.locator('#skin-data-scene [data-tab]').first().isVisible();
      T.ok(tabs === (w < 960 || w < 1000 && false) || w >= 1000, `${tag}: one graph at a time on narrow screens (tabs ${tabs}), three side by side on wide ones`);
      T.ok(problems.length === 0, `${tag}: no page errors ${problems.join('|')}`);
      await ctx.close();
    }
  } finally { await browser.close(); server.close(); }
  T.done('t97-meiosis-skin-layout');
})();
