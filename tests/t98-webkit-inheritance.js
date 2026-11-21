/* openscied-b3-inheritance-environment.html (Lessons 8-9) on an iPhone-sized screen in dark mode, in the engine picked by
   BROWSER=chromium|firefox|webkit. Same purpose as t98-webkit-dna-p53.js: catch Safari-only failures (a scene that mounts but
   draws nothing or loses its controls, choice cards that lose their styling). Checks per scene: it mounted, controls are visible,
   its drawing (SVG or canvas) is present and not blank, and the page's choice cards are separate, styled tap targets.
   Prints errors and computed styles so CI logs show the cause; saves screenshots to test-artifacts/.
   Run: BROWSER=webkit NODE_PATH=./node_modules node tests/t98-webkit-inheritance.js */
const T = require('./_h');
const playwright = require('playwright');
const fs = require('fs'), path = require('path');
const PAGE = 'openscied-b3-inheritance-environment.html';
const OUT = path.join(T.ROOT, 'test-artifacts'); fs.mkdirSync(OUT, { recursive: true });
const stub = ctx => ctx.route(/gc\.zgo\.at|fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, contentType: /gc\.zgo\.at/.test(r.request().url()) ? 'application/javascript' : 'text/css', body: '' }));
const SCENES = [['lakita', '#pedigree-scene'], ['twogene', '#two-gene-scene'], ['passing', '#meiosis-scene'], ['skindata', '#skin-data-scene'], ['plan', '#planner-scene'], ['yeast', '#yeast-uv-scene']];

// Share of canvas pixels that differ from the most common colour (0 = blank).
const canvasInk = (p, sel) => p.evaluate(s => {
  const c = document.querySelector(s + ' canvas'); if (!c) return null;
  const w = c.width, h = c.height; if (!w || !h) return { w, h, ink: 0, colours: 0 };
  let d; try { d = c.getContext('2d').getImageData(0, 0, w, h).data; } catch (e) { return { err: String(e), ink: 0, colours: 0 }; }
  const counts = new Map(); let n = 0;
  for (let i = 0; i < d.length; i += 16) { const k = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2] | (d[i + 3] << 24); counts.set(k, (counts.get(k) || 0) + 1); n++; }
  let top = 0; counts.forEach(v => { if (v > top) top = v; });
  return { w, h, colours: counts.size, ink: 1 - top / n };
}, sel);

(async () => {
  console.log('Engine: ' + T.BROWSER);
  const b = await T.launch(); console.log('Version: ' + b.version());
  const srv = await T.serve();
  const dev = T.BROWSER === 'firefox' ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true } : playwright.devices['iPhone 15'];
  const ctx = await b.newContext({ ...dev, colorScheme: 'dark' });
  await T.routeLibs(ctx); await stub(ctx);
  await ctx.addInitScript(() => { try { localStorage.setItem('aplab:student', JSON.stringify({ name: 'Test Student', period: '3' })); localStorage.setItem('aplab:tour', JSON.stringify('done')); } catch (e) {} });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push('pageerror: ' + e.message + '\n' + (e.stack || '')));
  p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push('console.' + m.type() + ': ' + m.text()); });
  await p.goto(srv.url + PAGE + '#overview'); await p.waitForTimeout(2500);
  console.log('UA: ' + await p.evaluate(() => navigator.userAgent));
  const go = async id => { await p.evaluate(h => { location.hash = h; }, id); await p.waitForTimeout(1500); };
  const shot = async n => p.screenshot({ path: path.join(OUT, `t98-inh-${T.BROWSER}-${n}.png`), fullPage: true }).catch(e => console.log('screenshot failed: ' + e.message));

  for (const [sec, host] of SCENES) {
    await go(sec); await shot(sec);
    const r = await p.evaluate(h => {
      const el = document.querySelector(h); if (!el) return { missing: true };
      const vis = e => { const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
      const svgs = [...el.querySelectorAll('svg')].filter(vis), canv = [...el.querySelectorAll('canvas')].filter(vis);
      const notice = document.querySelector(h.replace('-scene', '-notice')) || el.parentElement.querySelector('.scene-notice');
      return { mounted: el.dataset.mounted || '', controls: [...el.querySelectorAll('button, select, [role=button]')].filter(vis).length,
        svgShapes: svgs.reduce((n, s) => n + s.querySelectorAll('path, rect, circle, ellipse, line, text, polygon, g').length, 0), svgs: svgs.length, canvases: canv.length,
        noticeShown: !!(notice && !notice.hidden && getComputedStyle(notice).display !== 'none' && notice.getBoundingClientRect().height > 0), width: Math.round(el.getBoundingClientRect().width) };
    }, host);
    const ink = await canvasInk(p, host);
    console.log(sec + ': ' + JSON.stringify(r) + ' ' + JSON.stringify(ink));
    T.ok(!r.missing && r.mounted === '1', `${sec}: scene mounted`);
    T.ok(!r.noticeShown, `${sec}: the "coming soon" notice is hidden`);
    T.ok(r.controls >= 1, `${sec}: controls are visible (${r.controls})`);
    T.ok(r.svgShapes >= 8 || (ink && ink.ink > 0.01 && ink.colours > 5), `${sec}: the drawing is present, not blank (svg shapes ${r.svgShapes}, canvas ink ${ink ? ink.ink.toFixed(3) : 'n/a'})`);
  }

  // The page's own choice cards must be separate, styled tap targets.
  for (const id of ['families', 'reader', 'passing', 'exit8', 'envideas', 'skindata', 'wrapup']) {
    await go(id);
    const r = await p.evaluate(sec => {
      const S = document.getElementById(sec), out = { n: 0, problems: [], sample: null };
      if (!S) { out.problems.push('section missing'); return out; }
      S.querySelectorAll('.choice').forEach(o => {
        const r = o.getBoundingClientRect(); if (!r.width || !r.height) return; out.n++;
        const cs = getComputedStyle(o);
        if (!out.sample) out.sample = { display: cs.display, border: cs.borderTopWidth + ' ' + cs.borderTopStyle, bg: cs.backgroundColor, padding: cs.paddingTop + ' ' + cs.paddingLeft, h: Math.round(r.height) };
        if (!(parseFloat(cs.borderTopWidth) > 0 || cs.backgroundColor !== 'rgba(0, 0, 0, 0)')) out.problems.push('no border/background: ' + o.textContent.trim().slice(0, 30));
        if (!(parseFloat(cs.paddingTop) > 0 && parseFloat(cs.paddingLeft) > 0)) out.problems.push('no padding: ' + o.textContent.trim().slice(0, 30));
        if (r.height < 24) out.problems.push('small target ' + Math.round(r.width) + 'x' + Math.round(r.height));
        const sib = o.nextElementSibling;
        if (sib && sib.classList.contains('choice')) { const q = sib.getBoundingClientRect(); if (r.left < q.right - 0.5 && q.left < r.right - 0.5 && r.top < q.bottom - 0.5 && q.top < r.bottom - 0.5) out.problems.push('options overlap'); }
      });
      return out;
    }, id);
    console.log(id + ': ' + JSON.stringify(r));
    T.ok(r.problems.length === 0, `${id}: ${r.n} visible choices are separate styled tap targets ${r.problems.slice(0, 3).join('; ')}`);
  }

  console.log('--- page errors / console (' + errs.length + ') ---'); errs.forEach(e => console.log('  ' + e));
  T.ok(errs.filter(e => !/^console\.warning/.test(e)).length === 0, 'no page errors or console errors');
  await b.close(); srv.close();
  T.done('t98-webkit-inheritance [' + T.BROWSER + ']');
})().catch(e => { console.error(e); process.exit(1); });
