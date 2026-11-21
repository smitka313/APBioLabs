/* DNA fork scene (openscied-b3-dna-p53.html): layout at 390, 768 and 1366 px, no overflow or clipping, text and target sizes,
   canvas height stays put between steps, pointer and drag input on the canvas (phone board), dark-mode pixels.
   Run: NODE_PATH=$(npm root -g) node tests/t94-dna-fork-layout.js */
const T = require('./_h');
const PAGE = 'openscied-b3-dna-p53.html';
const PARTNER = { A: 'T', T: 'A', G: 'C', C: 'G' };
const S = '#dna-fork-scene';
const stub = ctx => ctx.route(/gc\.zgo\.at|fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, contentType: /gc\.zgo\.at/.test(r.request().url()) ? 'application/javascript' : 'text/css', body: '' }));
async function open(browser, server, o) {
  const ctx = await T.ctxFor(browser, { width: o.w, height: o.h, reduced: true, dark: o.dark });
  await stub(ctx);
  const p = await ctx.newPage(); p.problems = [];
  p.on('pageerror', e => p.problems.push('pageerror: ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !/gc\.zgo\.at|net::|Failed to load resource|fonts\.g/.test(m.text())) p.problems.push('console: ' + m.text()); });
  await p.goto(server.url + PAGE + '#fork');
  await p.waitForFunction(() => window.B3DnaP53 && document.querySelector('#fork.is-current') && window.B3DnaForkScene);
  await p.waitForTimeout(300);
  return { ctx, p };
}
const st = p => p.evaluate(() => B3DnaForkScene.state());
// logical canvas point -> page coordinates
async function pt(p, lx, ly) { await p.evaluate(sel => document.querySelector(sel + ' canvas').scrollIntoView({ block: 'center' }), S); const lay = await p.evaluate(() => B3DnaForkScene.layout()), r = await p.locator(S + ' canvas').boundingBox(); return { x: r.x + lx / lay.W * r.width, y: r.y + ly / lay.H * r.height }; }
async function hit(p, kind, v) { const h = (await p.evaluate(() => B3DnaForkScene.hits())).find(x => x.kind === kind && (!v || x.v === v)); if (!h) throw new Error('no hit ' + kind + v); return h; }
async function checkFit(p, tag, w) {
  const m = await p.evaluate(sel => {
    const host = document.querySelector(sel), hr = host.getBoundingClientRect(), c = host.querySelector('canvas').getBoundingClientRect();
    const small = [];
    host.querySelectorAll('.fork-ui *').forEach(e => { if (e.closest('[hidden]') || e.closest('dialog:not([open])')) return; if (Array.from(e.childNodes).some(n => n.nodeType === 3 && n.textContent.trim())) { const fs = parseFloat(getComputedStyle(e).fontSize); if (fs < 11) small.push(e.tagName + ':' + fs); } });
    const tiny = [];
    host.querySelectorAll('.fork-ui button').forEach(b => { if (b.closest('[hidden]') || b.closest('dialog:not([open])')) return; const r = b.getBoundingClientRect(); if (r.width < 24 || r.height < 24) tiny.push(b.textContent + ' ' + Math.round(r.width) + 'x' + Math.round(r.height)); });
    const wide = []; host.querySelectorAll('.fork-ui *').forEach(e => { if (e.closest('[hidden]') || e.closest('.table-wrap') || e.closest('dialog')) return; const r = e.getBoundingClientRect(); if (r.width && r.right > hr.right + 1) wide.push(e.tagName + ' ' + Math.round(r.right - hr.right)); });
    const lay = B3DnaForkScene.layout();
    return { docW: document.documentElement.scrollWidth, winW: innerWidth, cRight: c.right, cLeft: c.left, hRight: hr.right, hLeft: hr.left, cW: c.width, cH: c.height, small, tiny, wide, lay, ratio: c.width / c.height };
  }, S);
  T.ok(m.docW <= m.winW + 1, `${tag}: no sideways page scroll (${m.docW} <= ${m.winW})`);
  T.ok(m.cLeft >= m.hLeft - 1 && m.cRight <= m.hRight + 1, `${tag}: canvas fits inside its container`);
  T.ok(m.small.length === 0, `${tag}: all DOM text is at least 11 px ${m.small.join(',')}`);
  T.ok(m.tiny.length === 0, `${tag}: all buttons are at least 24 px ${m.tiny.join(',')}`);
  T.ok(m.wide.length === 0, `${tag}: no control sticks out of the container ${m.wide.join(',')}`);
  T.ok(m.lay.font * m.lay.s >= 11 && m.lay.lab * m.lay.s >= 11, `${tag}: canvas letters (${(m.lay.font * m.lay.s).toFixed(1)} px) and labels (${(m.lay.lab * m.lay.s).toFixed(1)} px) are at least 11 px`);
  T.ok(Math.abs(m.ratio - m.lay.W / m.lay.H) < 0.02, `${tag}: canvas keeps its aspect ratio (no stretching)`);
  return m;
}
async function finishPairing(p) {
  const m = await st(p);
  for (const k of ['top', 'bottom']) for (let i = 0; i < 5; i++) await p.click(`${S} button[data-strand="${k}"][data-letter="${PARTNER[(k === 'top' ? m.plan.top : m.plan.bottom)[i]]}"]`);
}
(async () => {
  const browser = await T.launch(); const server = await T.serve();
  try {
    for (const [w, h, dark, tag] of [[1366, 900, false, '1366 light'], [768, 1000, false, '768 light'], [390, 844, true, '390 dark'], [375, 800, false, '375 light']]) {
      const { ctx, p } = await open(browser, server, { w, h, dark });
      const lay0 = await checkFit(p, tag + ' start', w);
      T.ok((w >= 700) === lay0.lay.wide, `${tag}: ${lay0.lay.wide ? 'wide' : 'phone'} board chosen for this width`);
      const h0 = lay0.cH;
      await p.click(S + ' button[data-act="unwind"]'); await p.click(S + ' button[data-act="helicase"]');
      await checkFit(p, tag + ' unzipped', w);
      await finishPairing(p);
      const mid = await checkFit(p, tag + ' paired', w);
      T.ok(Math.abs(mid.cH - h0) < 1.5, `${tag}: canvas height does not change between steps (${Math.round(h0)} -> ${Math.round(mid.cH)}), so nothing jumps`);
      // finish with p53 (a)
      for (let g = 0; g < 30; g++) {
        const s = await st(p); if (s.stage === 'complete') break;
        let done = false;
        for (const k of ['top', 'bottom']) {
          const gi = s.sites[k].indexOf('x'), bi = s.sites[k].indexOf('b');
          if (gi >= 0) { await p.click(`${S} button[data-strand="${k}"][data-letter="${PARTNER[(k === 'top' ? s.plan.top : s.plan.bottom)[gi]]}"]`); done = true; break; }
          if (bi >= 0) { await p.click(`${S} button[data-p53="a"][data-strand="${k}"]`); done = true; break; }
        }
        if (!done) break;
      }
      const end = await checkFit(p, tag + ' complete', w);
      T.ok(Math.abs(end.cH - h0) < 1.5, `${tag}: canvas height unchanged at the end`);
      T.ok(p.problems.length === 0, `${tag}: no page errors ${p.problems.join(' | ')}`);
      await ctx.close();
    }

    // layout shift while the scene mounts, and axe on the scene in its busiest state (counts, p53 cards, canvas)
    for (const [w, h, dark] of [[1366, 900, false], [390, 844, true]]) {
      const ctx = await T.ctxFor(browser, { width: w, height: h, reduced: true, dark }); await stub(ctx);
      await ctx.addInitScript(() => { window.__cls = 0; try { new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput && (e.sources || []).some(x => x.node && x.node.closest && x.node.closest('#dna-fork-scene'))) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true }); } catch (e) { /* not supported */ } });
      const p = await ctx.newPage();
      await p.goto(server.url + PAGE + '#fork'); await p.waitForFunction(() => window.B3DnaForkScene && document.querySelector('#fork.is-current')); await p.waitForTimeout(1200);
      T.ok(await p.evaluate(() => window.__cls) <= 0.1, `${w} px: layout shift caused by the scene (its canvas and controls) is at most 0.1 (${await p.evaluate(() => window.__cls)})`);
      const axeFile = [process.env.AXE, '../node_modules/axe-core/axe.min.js'].filter(Boolean).map(f => require('path').resolve(__dirname, f)).find(f => require('fs').existsSync(f));
      if (axeFile) {
        await p.click(S + ' button[data-act="unwind"]'); await p.click(S + ' button[data-act="helicase"]'); await finishPairing(p);
        await p.click(S + ' button[data-p53="a"][data-strand="top"]');
        await p.addScriptTag({ content: require('fs').readFileSync(axeFile, 'utf8') });
        const bad = await p.evaluate(async sel => (await axe.run(document.querySelector(sel), { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] }, resultTypes: ['violations'] })).violations.map(v => v.id + ': ' + v.nodes.slice(0, 2).map(n => n.target.join(' ')).join(' ; ')), S);
        T.ok(bad.length === 0, `${w} px ${dark ? 'dark' : 'light'}: axe finds nothing in the scene ${bad.join(' | ')}`);
      } else console.log('  (axe-core not found: set AXE to run the in-scene axe check)');
      await ctx.close();
    }

    // dark mode pixels (red and green cells visible against the dark board)
    {
      const { ctx, p } = await open(browser, server, { w: 390, h: 844, dark: true });
      await p.click(S + ' button[data-act="unwind"]'); await p.click(S + ' button[data-act="helicase"]'); await finishPairing(p);
      const px = await p.evaluate(sel => {
        const c = document.querySelector(sel + ' canvas'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let red = 0, green = 0, dark = 0;
        for (let i = 0; i < d.length; i += 4) { if (Math.abs(d[i] - 242) < 30 && Math.abs(d[i + 1] - 134) < 30 && Math.abs(d[i + 2] - 127) < 30) red++; if (Math.abs(d[i] - 111) < 30 && Math.abs(d[i + 1] - 208) < 30 && Math.abs(d[i + 2] - 143) < 30) green++; if (d[i] < 60 && d[i + 1] < 60 && d[i + 2] < 60) dark++; }
        return { red, green, dark, n: d.length / 4 };
      }, S);
      T.ok(px.dark / px.n > 0.4, 'dark mode: the board background is dark');
      T.ok(px.red > 60 && px.green > 300, `dark mode: red (${px.red}) and green (${px.green}) cells are drawn in the dark palette`);
      await ctx.close();
    }

    // pointer input on the phone board: tap the bundle, tap helicase, tap-then-tap a letter, drag a letter, tap and drag p53
    {
      const { ctx, p } = await open(browser, server, { w: 390, h: 844 });
      let h = await hit(p, 'bundle'); let q = await pt(p, h.x, h.y); await p.mouse.click(q.x, q.y);
      T.ok((await st(p)).steps.unwound, 'phone: tapping the bundle center unwinds the DNA');
      h = await hit(p, 'helicase'); q = await pt(p, h.x, h.y); await p.mouse.click(q.x, q.y);
      T.ok((await st(p)).steps.unzipped, 'phone: tapping the helicase unzips the DNA');
      let s = await st(p);
      const needTop = PARTNER[s.plan.top[0]];
      h = await hit(p, 'letter', needTop); q = await pt(p, h.x, h.y); await p.mouse.click(q.x, q.y);
      T.ok(/selected/.test(await p.locator('.fork-next').innerText()) || /Selected/.test(await p.locator('.fork-hint').innerText()), 'phone: tapping a letter selects it');
      const site = await p.evaluate(() => B3DnaForkScene.sitePoint('top', 0)); q = await pt(p, site.x, site.y); await p.mouse.click(q.x, q.y);
      s = await st(p); T.ok(s.sites.top[0] === 'g', 'phone: then tapping the top strand places the letter');
      const needBot = PARTNER[s.plan.bottom[0]];
      h = await hit(p, 'letter', needBot); const a = await pt(p, h.x, h.y);
      const bsite = await p.evaluate(() => B3DnaForkScene.sitePoint('bottom', 0)); const b = await pt(p, bsite.x, bsite.y);
      await p.mouse.move(a.x, a.y); await p.mouse.down(); await p.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 4 }); await p.mouse.move(b.x, b.y, { steps: 4 }); await p.mouse.up();
      s = await st(p); T.ok(s.sites.bottom[0] === 'g', 'phone: dragging a letter onto the bottom strand places it');
      // wrong letter dragged: bounces back
      const wrong = 'ACGT'.split('').find(l => l !== PARTNER[s.plan.bottom[1]]);
      h = await hit(p, 'letter', wrong); const c1 = await pt(p, h.x, h.y); const b1 = await pt(p, (await p.evaluate(() => B3DnaForkScene.sitePoint('bottom', 1))).x, (await p.evaluate(() => B3DnaForkScene.sitePoint('bottom', 1))).y);
      await p.mouse.move(c1.x, c1.y); await p.mouse.down(); await p.mouse.move(b1.x, b1.y, { steps: 6 }); await p.mouse.up();
      T.ok((await st(p)).sites.bottom[1] === 'e', 'phone: a letter that does not pair is not placed');
      // finish the hand pairs with buttons, then p53 by pointer
      for (const k of ['top', 'bottom']) for (let i = 0; i < 5; i++) { const t = (await st(p)).sites[k]; if (t[i] === 'e') await p.click(`${S} button[data-strand="${k}"][data-letter="${PARTNER[(k === 'top' ? s.plan.top : s.plan.bottom)[i]]}"]`); }
      s = await st(p); T.ok(s.stage === 'p53', 'phone: pairing finished');
      h = await hit(p, 'p53', 'c'); q = await pt(p, h.x, h.y); await p.mouse.click(q.x, q.y);
      const zone = await pt(p, 170, 60); await p.mouse.click(zone.x, zone.y);
      s = await st(p); T.ok(s.p53.c.tried === 1 && s.p53.c.removed === 0, 'phone: tap p53 (c) then the top strand: tried, nothing removed');
      h = await hit(p, 'p53', 'a'); const pa = await pt(p, h.x, h.y); const ts = await pt(p, 170, 80);
      await p.mouse.move(pa.x, pa.y); await p.mouse.down(); await p.mouse.move(ts.x, ts.y, { steps: 6 }); await p.mouse.up();
      s = await st(p); T.ok(s.p53.a.tried === 1 && s.p53.a.removed === 1 && s.sites.top.includes('x'), 'phone: dragging p53 (a) onto the top strand removes the substitution');
      // Escape clears a selection
      h = await hit(p, 'p53', 'b'); q = await pt(p, h.x, h.y); await p.mouse.click(q.x, q.y); await p.keyboard.press('Escape');
      T.ok(await p.locator('.fork-hint').innerText() === '', 'Escape clears a selected piece');
      T.ok(p.problems.length === 0, 'phone pointer run: no page errors ' + p.problems.join(' | '));
      await ctx.close();
    }
  } finally { await browser.close(); server.close(); }
  T.done('t94-dna-fork-layout');
})();
