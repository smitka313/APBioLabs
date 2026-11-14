/* Audit 5: layout shift on load (CLS). Before the fix, lab.js built the step nav, the nav's right end (ring, Pause, All parts),
   the header buttons and the identity line after first paint, pushing <main> down ~100 px (CLS 0.26–0.81 at 1366 px).
   Lab pages now ship that chrome in their static markup and lab.js swaps it in the same task.
   This test forces a paint of the static page first: lab.js is held back for 600 ms, so whatever lab.js changes above the fold
   afterwards shows up as layout shift. Every lab must stay at CLS ≤ 0.1 (it should be ~0) at 1920, 1366, 1024, 768, 400 and 375 px.
   It also checks the page with scripts blocked: no inert copies visible, part links reach their parts.
   Run: NODE_PATH=$(npm root -g) node tests/t58-cls.js [lab01 ...] */
const T = require('./_h');
const fs = require('fs'), path = require('path');
const only = process.argv.slice(2);
const LABS = only.length ? T.LABS.filter(l => only.includes(l)) : T.LABS;
const SIZES = [{ w: 1920, h: 1080 }, { w: 1366, h: 768 }, { w: 1024, h: 768 }, { w: 768, h: 1024, touch: true }, { w: 400, h: 800, touch: true, mobile: true, dark: true }, { w: 375, h: 812, touch: true, mobile: true }];

(async () => {
  const srv = await T.serve(), b = await T.launch();
  const worst = [];
  for (const lab of LABS) {
    const res = [];
    for (const s of SIZES) {
      const ctx = await T.ctxFor(b, { width: s.w, height: s.h, touch: s.touch, mobile: s.mobile, dark: s.dark });
      await ctx.route(/gc\.zgo\.at|fonts\.g/, r => r.abort());
      await ctx.route(/\/lab\.js$/, async r => { await new Promise(z => setTimeout(z, 600)); r.continue(); });
      await ctx.addInitScript(() => {
        window.__cls = 0; window.__src = [];
        new PerformanceObserver(l => l.getEntries().forEach(e => { if (e.hadRecentInput) return; window.__cls += e.value;
          (e.sources || []).forEach(x => { const n = x.node; window.__src.push(`${n ? n.nodeName + (n.className && typeof n.className === 'string' ? '.' + n.className.split(' ')[0] : '') : '?'} y ${Math.round(x.previousRect.y)}→${Math.round(x.currentRect.y)} h ${Math.round(x.previousRect.height)}→${Math.round(x.currentRect.height)}`); }); })).observe({ type: 'layout-shift', buffered: true });
      });
      const p = await ctx.newPage(); const errs = [];
      p.on('pageerror', e => errs.push(e.message));
      await p.goto(srv.url + lab + '.html', { waitUntil: 'load' });
      await p.waitForTimeout(1200);
      const r = await p.evaluate(() => ({ cls: window.__cls, src: window.__src.slice(0, 4), ph: document.querySelectorAll('[data-ph]').length, will: document.documentElement.classList.contains('will-page'),
        navN: document.querySelectorAll('.step-nav ol > li').length, steps: document.querySelectorAll('section.step').length, ends: document.querySelectorAll('.nav-end').length,
        themes: document.querySelectorAll('.theme-switch').length, sounds: document.querySelectorAll('.sound-toggle').length, prints: document.querySelectorAll('.ws-print-btn').length, idBoxes: document.querySelectorAll('.id-box').length, times: document.querySelectorAll('.lab-header .tag--time').length }));
      res.push(`${s.w}: ${r.cls.toFixed(3)}`);
      worst.push([lab, s.w, r.cls]);
      T.ok(r.cls <= 0.1, `${lab} @ ${s.w}${s.dark ? ' dark' : ''}: CLS ${r.cls.toFixed(3)} ≤ 0.1 with first paint before lab.js ${r.cls > 0.01 ? r.src.join(' | ') : ''}`);
      if (s.w === 1366) {
        T.ok(errs.length === 0, `${lab}: no page errors ${errs.join(' | ')}`);
        T.ok(r.ph === 0 && !r.will, `${lab}: every static stand-in was swapped for the live control (left: ${r.ph}, will-page: ${r.will})`);
        T.ok(r.navN === r.steps && r.ends === 1 && r.themes === 1 && r.sounds === 1 && r.prints === 1 && r.idBoxes === 1 && r.times === 1,
          `${lab}: one of each control, nav lists every part (${r.navN}/${r.steps} parts, nav-end ${r.ends}, theme ${r.themes}, sound ${r.sounds}, print ${r.prints}, id ${r.idBoxes}, time tag ${r.times})`);
        // The baked nav matches what lab.js builds (a renamed part would otherwise make the page jump again).
        const src = fs.readFileSync(path.join(T.ROOT, lab + '.html'), 'utf8');
        const baked = [...src.replace(/^[\s\S]*?<nav class="step-nav"[\s\S]*?<ol>/, '').replace(/<\/ol>[\s\S]*$/, '').matchAll(/href="#([^"]+)"><span class="n">\d+<\/span><span class="nl">([^<]*)</g)].map(m => m[1] + '=' + m[2].replace(/&amp;/g, '&'));
        const live = await p.evaluate(() => [...document.querySelectorAll('.step-nav ol a')].map(a => a.getAttribute('href').slice(1) + '=' + a.querySelector('.nl').textContent));
        T.ok(JSON.stringify(baked) === JSON.stringify(live), `${lab}: the nav in the HTML matches the live nav ${JSON.stringify(baked) === JSON.stringify(live) ? '' : JSON.stringify({ baked, live })}`);
        const tt = await p.evaluate(() => document.querySelector('.lab-header .tag--time').textContent);
        const bakedT = (/<span class="tag tag--time"><span aria-hidden="true">([^<]*)</.exec(src) || [])[1];
        T.ok(bakedT && tt.startsWith(bakedT), `${lab}: the time tag in the HTML (${bakedT}) matches the live one (${tt.slice(0, 20)})`);
      }
      await ctx.close();
    }
    console.log('  ' + lab + ' CLS ' + res.join('  '));
  }
  // Scripts blocked: the page still reads correctly, with no inert copies of controls that would do nothing.
  for (const lab of LABS.slice(0, only.length ? LABS.length : 3)) {
    const ctx = await b.newContext({ viewport: { width: 1366, height: 768 }, javaScriptEnabled: false });
    await ctx.route(/gc\.zgo\.at|fonts\.g/, r => r.abort());
    const p = await ctx.newPage();
    await p.goto(srv.url + lab + '.html', { waitUntil: 'load' });
    const r = await p.evaluate(() => ({
      phShown: [...document.querySelectorAll('[data-ph]')].filter(e => e.getClientRects().length).length,
      sections: document.querySelectorAll('section.step').length,
      shown: [...document.querySelectorAll('section.step')].filter(e => e.getClientRects().length).length,
      links: [...document.querySelectorAll('.step-nav ol a')].filter(a => document.getElementById(a.getAttribute('href').slice(1))).length,
      nav: document.querySelectorAll('.step-nav ol a').length, project: !!document.querySelector('.crumbs .project-link'),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth }));
    T.ok(r.phShown === 0 && r.sections === r.shown && r.nav === r.sections && r.links === r.nav && r.project && r.overflow <= 0,
      `${lab} with scripts blocked: no stand-ins shown (${r.phShown}), every part shown (${r.shown}/${r.sections}), nav links reach their parts (${r.links}/${r.nav}), overflow ${r.overflow}`);
    await ctx.close();
  }
  worst.sort((x, y) => y[2] - x[2]);
  console.log('  worst: ' + worst.slice(0, 5).map(w => `${w[0]}@${w[1]} ${w[2].toFixed(3)}`).join(', '));
  await b.close(); srv.close();
  T.done('t58-cls');
})();
