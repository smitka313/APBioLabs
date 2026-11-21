/* openscied-b3-dna-p53.html on an iPhone-sized screen in dark mode, in the engine picked by BROWSER=chromium|firefox|webkit.
   Regression test for the owner's iOS Safari report: the DNA fork scene was a blank box without controls, and the choice cards
   lost their styling. Checks per section: no page errors, scene controls exist and are visible, scene canvases are not blank,
   choice options are separate, styled tap targets. Prints errors and computed styles so CI logs show the cause; saves screenshots
   to test-artifacts/. Run: BROWSER=webkit NODE_PATH=./node_modules node tests/t98-webkit-dna-p53.js */
const T = require('./_h');
const playwright = require('playwright');
const fs = require('fs'), path = require('path');
const PAGE = 'openscied-b3-dna-p53.html';
const OUT = path.join(T.ROOT, 'test-artifacts'); fs.mkdirSync(OUT, { recursive: true });
const stub = ctx => ctx.route(/gc\.zgo\.at|fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, contentType: /gc\.zgo\.at/.test(r.request().url()) ? 'application/javascript' : 'text/css', body: '' }));

// Number of distinct colours and share of pixels that differ from the most common one (0 = blank).
const canvasInk = (p, sel) => p.evaluate(s => {
  const c = document.querySelector(s + ' canvas'); if (!c) return { missing: true };
  const w = c.width, h = c.height; if (!w || !h) return { w, h, ink: 0 };
  let d; try { d = c.getContext('2d').getImageData(0, 0, w, h).data; } catch (e) { return { err: String(e) }; }
  const counts = new Map(); let n = 0;
  for (let i = 0; i < d.length; i += 16) { const k = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2] | (d[i + 3] << 24); counts.set(k, (counts.get(k) || 0) + 1); n++; }
  let top = 0; counts.forEach(v => { if (v > top) top = v; });
  return { w, h, colours: counts.size, ink: 1 - top / n };
}, sel);

(async () => {
  console.log('Engine: ' + T.BROWSER);
  const b = await T.launch();
  console.log('Version: ' + b.version());
  const srv = await T.serve();
  const dev = T.BROWSER === 'firefox' ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true } : playwright.devices['iPhone 15'];
  const ctx = await b.newContext({ ...dev, colorScheme: 'dark' });
  await T.routeLibs(ctx); await stub(ctx);
  await ctx.addInitScript(() => { try { localStorage.setItem('aplab:student', JSON.stringify({ name: 'Test Student', period: '3' })); localStorage.setItem('aplab:tour', JSON.stringify({ seen: true, v: 1 })); } catch (e) { /* ignore */ } });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => { errs.push('pageerror: ' + e.message + '\n' + (e.stack || '')); });
  p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push('console.' + m.type() + ': ' + m.text()); });
  await p.goto(srv.url + PAGE + '#fork');
  await p.waitForTimeout(2500);
  console.log('UA: ' + await p.evaluate(() => navigator.userAgent));
  const go = async id => { await p.evaluate(h => { location.hash = h; }, id); await p.waitForTimeout(1200); };
  const shot = async n => p.screenshot({ path: path.join(OUT, `t98-${T.BROWSER}-${n}.png`), fullPage: true }).catch(e => console.log('screenshot failed: ' + e.message));

  // Page-level state
  const st = await p.evaluate(() => ({ b3: !!window.B3DnaP53, scenes: Object.keys(window.B3DnaP53 || {}), fork: !!window.B3DnaForkScene, mounted: [...document.querySelectorAll('.scene-host')].map(h => h.id + ':' + (h.dataset.mounted || 'no')), notices: [...document.querySelectorAll('.scene-notice')].map(n => n.id + ':' + (n.hidden ? 'hidden' : n.textContent)) }));
  console.log('state: ' + JSON.stringify(st));

  // 1. Fork scene
  await go('fork'); await shot('fork');
  const fork = await p.evaluate(() => { const h = document.querySelector('#dna-fork-scene'), q = s => [...h.querySelectorAll(s)].filter(e => e.getBoundingClientRect().width > 0 && e.getBoundingClientRect().height > 0).length; return { ui: !!h.querySelector('.fork-ui'), buttons: q('.fork-ui button'), visibleButtons: [...h.querySelectorAll('.fork-ui button')].filter(e => e.getBoundingClientRect().height > 0).map(e => e.textContent.trim().slice(0, 20)), canvasRect: JSON.stringify(h.querySelector('canvas').getBoundingClientRect()), hostRect: JSON.stringify(h.getBoundingClientRect()), css: !!document.getElementById('fork-scene-css'), display: getComputedStyle(h.querySelector('.fork-ui') || h).display }; });
  console.log('fork: ' + JSON.stringify(fork));
  const forkInk = await canvasInk(p, '#dna-fork-scene'); console.log('fork canvas: ' + JSON.stringify(forkInk));
  T.ok(fork.ui, 'fork scene controls exist (.fork-ui)');
  T.ok(fork.buttons >= 1, 'fork controls are visible (' + fork.visibleButtons.join(', ') + ')');
  T.ok(forkInk.ink > 0.01 && forkInk.colours > 5, 'fork canvas is drawn, not blank (ink ' + (forkInk.ink || 0).toFixed(3) + ', ' + forkInk.colours + ' colours)');

  // 2. Cards in sections 4, 6, 8 (and the others that have them)
  for (const id of ['ideas', 'sense5', 'explain', 'sense6']) {
    await go(id); await shot(id);
    const r = await p.evaluate(sec => {
      const S = document.getElementById(sec), out = { cards: 0, problems: [], sample: null };
      S.querySelectorAll('.opts').forEach(g => {
        out.cards++;
        const opts = [...g.querySelectorAll('.opt')], rects = opts.map(o => o.getBoundingClientRect());
        opts.forEach((o, i) => {
          const cs = getComputedStyle(o), r = rects[i];
          if (!out.sample) out.sample = { display: cs.display, border: cs.borderTopWidth + ' ' + cs.borderTopStyle + ' ' + cs.borderTopColor, bg: cs.backgroundColor, padding: cs.paddingTop + ' ' + cs.paddingLeft, minHeight: cs.minHeight, h: r.height, w: r.width, radius: cs.borderTopLeftRadius, gridGap: getComputedStyle(g).display + '/' + getComputedStyle(g).gap, fieldset: getComputedStyle(o.closest('fieldset') || o).display + ' ' + getComputedStyle(o.closest('fieldset') || o).borderLeftWidth };
          if (!(parseFloat(cs.borderTopWidth) > 0 || cs.backgroundColor !== 'rgba(0, 0, 0, 0)')) out.problems.push('no border/background: ' + o.textContent.trim().slice(0, 30));
          if (!(parseFloat(cs.paddingTop) > 0 && parseFloat(cs.paddingLeft) > 0)) out.problems.push('no padding: ' + o.textContent.trim().slice(0, 30));
          if (r.height < 24 || r.width < 24) out.problems.push('small target ' + Math.round(r.width) + 'x' + Math.round(r.height));
          rects.forEach((q, j) => { if (j > i && r.left < q.right - 0.5 && q.left < r.right - 0.5 && r.top < q.bottom - 0.5 && q.top < r.bottom - 0.5) out.problems.push('options overlap: ' + i + ' & ' + j); });
        });
      });
      return out;
    }, id);
    console.log(id + ': ' + JSON.stringify(r));
    T.ok(r.cards > 0 && r.problems.length === 0, `${id}: ${r.cards} choice groups, options are separate styled tap targets ${r.problems.slice(0, 3).join('; ')}`);
  }

  // 3. Gene expression scene
  await go('expression'); await shot('expression');
  const ge = await p.evaluate(() => { const h = document.querySelector('#gene-expression-scene'); return { mounted: h.dataset.mounted, buttons: [...h.querySelectorAll('button')].filter(e => e.getBoundingClientRect().height > 0).length, canvasRect: JSON.stringify(h.querySelector('canvas').getBoundingClientRect()) }; });
  const geInk = await canvasInk(p, '#gene-expression-scene');
  console.log('expression: ' + JSON.stringify(ge) + ' ' + JSON.stringify(geInk));
  T.ok(ge.buttons >= 1, 'gene expression controls are visible');
  T.ok(geInk.ink > 0.01 && geInk.colours > 5, 'gene expression canvas is drawn, not blank (ink ' + (geInk.ink || 0).toFixed(3) + ')');

  console.log('--- page errors / console (' + errs.length + ') ---'); errs.forEach(e => console.log('  ' + e));
  T.ok(errs.filter(e => !/^console\.warning/.test(e)).length === 0, 'no page errors or console errors');
  await b.close(); srv.close();
  T.done('t98-webkit-dna-p53 [' + T.BROWSER + ']');
})().catch(e => { console.error(e); process.exit(1); });
