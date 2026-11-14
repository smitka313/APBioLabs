/* Accessibility and responsive scan.
   A. axe-core, WCAG 2.0/2.1/2.2 A + AA rules, on index, teachers, teacher-dashboard and every part of all 13 labs, light and dark.
      Critical and serious violations are reported grouped by rule (pages + one example target each) and fail the test.
   B. Keyboard on all 13 labs: "Skip to content" is the first Tab stop and lands on the current part below the sticky nav;
      landmarks (header, one main, labelled step nav, one h1); the main run control is reachable with Tab, every stop on the
      way shows a focus indicator and is not hidden under the sticky nav; Enter / Space runs it; the result reaches a live
      region; no keyboard trap after the run. Also the skip link on index, teachers, dashboard and projector.
   C. Responsive for all 13 labs (every part) at 375, 430, 768, 1024, 1440 px, portrait tablets (768×1024, 1024×1366) and
      200% zoom of a 1366×768 laptop (683×384, WCAG 1.4.10 reflow): no horizontal page scroll, no control outside the
      viewport (unless inside a scrollable box), dialogs fit the viewport, no control smaller than 24×24 px without the
      WCAG 2.5.8 spacing exception, and at 200% zoom the sticky bars cover at most half the screen.
      RESP_VIEWS=683z,768t,1024t (z = zoom, t = tablet) runs only some views.
   Needs axe-core: `npm i axe-core` somewhere and set AXE=/path/to/axe.min.js (or have it resolvable through NODE_PATH).
   Run: NODE_PATH=$(npm root -g) AXE=... node tests/t59-a11y.js [axe] [keys] [resp] */
const T = require('./_h'), D = require('./t59-drive');
const fs = require('fs'), path = require('path');
const parts = process.argv.slice(2), want = n => !parts.length || parts.includes(n);
const sleep = ms => new Promise(r => setTimeout(r, ms));
function axePath() {
  const c = [process.env.AXE, (() => { try { return require.resolve('axe-core/axe.min.js'); } catch (e) { return null; } })(),
    path.join(__dirname, '../node_modules/axe-core/axe.min.js')].filter(Boolean);
  return c.find(f => fs.existsSync(f));
}
const PAGES = ['index.html', 'teachers.html', 'teacher-dashboard.html', ...T.LABS.map(l => l + '.html')];
const sectionIds = p => p.evaluate(() => [...document.querySelectorAll('section.step')].map(s => s.id).filter(Boolean));
const goPart = (p, id) => p.evaluate(i => { Lab.pages.go(i); window.scrollTo(0, 0); }, id);

async function axeScan(b, srv) {
  const file = axePath();
  if (!file) { T.ok(false, 'axe-core not found: npm i axe-core in a scratch folder and set AXE=<path>/node_modules/axe-core/axe.min.js'); return; }
  const src = fs.readFileSync(file, 'utf8'), byRule = {};
  for (const dark of [false, true]) {
    const ctx = await T.ctxFor(b, { dark, reduced: true }); await ctx.route(/gc\.zgo\.at/, r => r.abort());
    for (const pg of PAGES) {
      const p = await T.open(ctx, pg, '', srv.url); await p.addScriptTag({ content: src });
      const views = /^lab\d/.test(pg) ? await sectionIds(p) : [''];
      for (const view of views) {
        if (view) { await goPart(p, view); await sleep(250); }
        const res = await p.evaluate(async () => (await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] }, resultTypes: ['violations'] })).violations
          .filter(v => v.impact === 'critical' || v.impact === 'serious').map(v => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.map(n => ({ t: n.target.join(' '), s: (n.failureSummary || '').split('\n').slice(1, 2).join(' ').slice(0, 160) })) })));
        res.forEach(v => { const r = byRule[v.id] = byRule[v.id] || { impact: v.impact, help: v.help, where: {}, n: 0 }; v.nodes.forEach(n => { const k = pg + (view ? '#' + view : '') + (dark ? ' [dark]' : ''); (r.where[k] = r.where[k] || []).push(n.t + ' — ' + n.s); r.n++; }); });
      }
      T.ok(p.errors.length === 0, `axe ${pg}${dark ? ' dark' : ''}: no page errors ${p.errors.join(' | ')}`);
      await p.close();
    }
    await ctx.close();
  }
  const rules = Object.keys(byRule);
  console.log('\n  axe critical/serious violations by rule:');
  rules.forEach(id => {
    const r = byRule[id], pages = Object.keys(r.where);
    console.log(`  - ${id} (${r.impact}, ${r.n} nodes on ${pages.length} views): ${r.help}`);
    const uniq = {}; pages.forEach(pg => r.where[pg].forEach(t => { const k = t.split(' — ')[0]; (uniq[k] = uniq[k] || { ex: t, pages: [] }).pages.push(pg); }));
    Object.values(uniq).slice(0, 12).forEach(u => console.log(`      ${u.ex}\n        on ${u.pages.length} view(s): ${u.pages.slice(0, 4).join(', ')}${u.pages.length > 4 ? ', …' : ''}`));
  });
  T.ok(rules.length === 0, 'axe: no critical or serious WCAG 2.2 AA violations (' + (rules.join(', ') || 'none') + ')');
}

/* ---------- B. keyboard (all 13 labs) ----------
   For each lab's main run control: the skip link is the first Tab stop and lands on the current part (below the sticky nav);
   landmarks (banner header, one main, step nav, one h1); the control is reachable by Tab with a visible, unobscured focus on
   every stop on the way; Enter or Space runs it; the result reaches a live region; Tab and Shift+Tab move on from it (no trap). */
const PRED = 'I predict the value will change because of the biology we studied in class.';
const fillAll = (...keys) => async p => { for (const k of keys) await D.fillPred(p, k, PRED); };
const typePred = id => async p => { await D.go(p, '#' + id); await p.fill('#' + id, PRED); await sleep(1300); };
const KEYS = {
  lab01: { part: 'grow-and-score', pre: fillAll('predict-selection', 'predict-design'), btn: '#autocount', key: 'Enter', done: () => sleep(3000) },
  lab02: { part: 'card-model', pre: fillAll('predict-card', 'predict-spreadsheet', 'predict-drift', 'predict-design'), btn: '#card-run5', key: ' ', done: () => sleep(1500) },
  lab03: { part: 'blast-the-genes', pre: fillAll('predict-blast', 'predict-design'), btn: '#run-blast', key: 'Enter', done: () => sleep(2000) },
  lab04: { part: 'sa-v', pre: fillAll('predict-sav', 'predict-bags', 'predict-plasmo', 'predict-soak', 'predict-design'), btn: '#p1-run', key: ' ', done: p => D.tlDone(p, 'agar') },
  lab05: { part: 'sink-disks', pre: fillAll('predict-floatassay', 'predict-design'), btn: '#inf-pull', key: 'Enter', done: p => p.waitForFunction(() => !document.querySelector('#inf-pull').disabled && Lab.store.get('inf') != null || /sunk|sink/i.test((document.querySelector('#inf-fb') || {}).textContent || ''), null, { timeout: 25000 }) },
  lab06: { part: 'microrespirometer', pre: async p => { await fillAll('predict-microresp', 'predict-gas', 'predict-design')(p); await D.setv(p, '#p-speed', '6'); }, btn: '#p-run', key: ' ', done: p => D.tlDone(p, 'microresp') },
  lab07: { part: 'root-tips', pre: async p => { await fillAll('predict-roottips', 'predict-meiosis', 'predict-sordaria', 'predict-design')(p); await p.click('[data-treat="control"]'); }, btn: '#rt-prep', key: 'Enter', done: () => sleep(2000) },
  lab08: { part: 'transform', pre: async () => {}, btn: '#do-step', key: ' ', done: p => p.waitForFunction(() => !document.querySelector('#do-step').disabled, null, { timeout: 40000 }) },
  lab09: { part: 'run-a-gel', pre: async p => { await p.evaluate(() => document.querySelector('#g1-layout').click()); }, btn: '#g1-run', key: ' ', done: async p => { await sleep(3000); await p.focus('#g1-run'); await p.keyboard.press(' '); await sleep(800); } },
  lab10: { part: 'part-1-npp', pre: typePred('p-p1-diagram'), btn: '#p1-plus7', key: 'Enter', done: () => sleep(1500) },
  lab11: { part: 'water-loss', pre: typePred('p-predict-water'), btn: '#tr-run', key: ' ', done: p => D.tlReady(p, '#tr-timelapse', 30000) },
  lab12: { part: 'geotaxis-vial', pre: typePred('p-predict-vial'), btn: '#vial-run', key: 'Enter', done: p => D.tlReady(p, '#vial-timelapse', 40000) },
  lab13: { part: 'procedure-1', pre: async p => { await typePred('p-predict-assay')(p); await p.evaluate(() => { const b = document.querySelector('#m1 button[data-v="spec"]'); if (b) b.click(); }); }, btn: '#p1-run', key: 'Enter', done: p => D.tlReady(p, '#p1-timelapse', 40000) },
};
/* What has focus now: a name, whether the focus is visible (outline or box-shadow), and whether the sticky nav hides it. */
const focusInfo = p => p.evaluate(() => {
  const e = document.activeElement; if (!e || e === document.body) return { body: true };
  const cs = getComputedStyle(e), r = e.getBoundingClientRect();
  const visible = (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 1) || (cs.boxShadow && cs.boxShadow !== 'none');
  const nav = document.querySelector('.step-nav'), nb = nav ? nav.getBoundingClientRect().bottom : 0;
  const stickyNav = nav && getComputedStyle(nav).position === 'sticky' && !nav.contains(e) && !e.closest('.lab-header');
  return { name: (e.id ? '#' + e.id : e.tagName.toLowerCase() + (typeof e.className === 'string' && e.className ? '.' + e.className.trim().split(/\s+/)[0] : '')) + ' "' + (e.textContent || e.value || '').trim().slice(0, 20) + '"',
    visible, obscured: !!stickyNav && r.bottom <= nb + 1 && r.height > 0, fv: e.matches(':focus-visible') };
});
async function keyboard(b) {
  for (const [lab, k] of Object.entries(KEYS)) {
    const ctx = await T.ctxFor(b); await ctx.route(/gc\.zgo\.at/, r => r.abort());
    const p = await T.open(ctx, lab + '.html', k.part); await sleep(400);
    await k.pre(p); await goPart(p, k.part); await sleep(400);

    // Landmarks
    const lm = await p.evaluate(() => ({ mains: [...document.querySelectorAll('main')].filter(m => !m.hidden).length, banner: !!document.querySelector('body > header, header.lab-header'), nav: !!document.querySelector('nav.step-nav[aria-label]'), h1: document.querySelectorAll('h1').length, h2: !!document.querySelector('section.step.is-current > header h2') }));
    T.ok(lm.mains === 1 && lm.banner && lm.nav && lm.h1 === 1 && lm.h2, `${lab}: landmarks: header, one main, labelled step nav, one h1, part heading ${JSON.stringify(lm)}`);

    // Skip link: the first Tab stop on a fresh load, visible when focused, lands on the current part below the sticky nav
    await p.goto(p.url().split('#')[0]); await sleep(900);
    await p.keyboard.press('Tab');
    const sk = await p.evaluate(() => { const e = document.activeElement, r = e.getBoundingClientRect(), cs = getComputedStyle(e); return { skip: e.matches('a.skip-link'), text: e.textContent.trim(), onScreen: r.top >= 0 && r.left >= 0 && r.bottom <= innerHeight && r.width > 40, outline: cs.outlineStyle !== 'none' }; });
    T.ok(sk.skip && sk.text === 'Skip to content' && sk.onScreen && sk.outline, `${lab}: "Skip to content" is the first Tab stop and shows when focused ${JSON.stringify(sk)}`);
    await p.keyboard.press('Enter'); await sleep(300);
    const land = await p.evaluate(() => { const e = document.activeElement, sec = document.querySelector('section.step.is-current'), nav = document.querySelector('.step-nav'); const r = e.getBoundingClientRect(); return { inPart: !!sec && sec.contains(e), below: r.top >= (nav ? nav.getBoundingClientRect().bottom : 0) - 1 && r.top < innerHeight, hash: location.hash }; });
    T.ok(land.inPart && land.below, `${lab}: skip link lands on the current part, visible below the nav ${JSON.stringify(land)}`);
    await p.keyboard.press('Tab');
    T.ok(await p.evaluate(() => { const sec = document.querySelector('section.step.is-current'); return !!sec && sec.contains(document.activeElement); }), `${lab}: the next Tab stays in the current part`);
    await p.goto(p.url().split('#')[0] + '#' + k.part); await sleep(900); await goPart(p, k.part); await sleep(300);

    // Tab from the top to the run control, checking every stop on the way
    await p.evaluate(() => { document.activeElement && document.activeElement.blur(); window.scrollTo(0, 0); });
    await p.keyboard.press('Tab');
    let n = 0, hit = false; const noRing = new Set(), hidden = new Set();
    for (; n < 300; n++) {
      if (await p.evaluate(s => document.activeElement === document.querySelector(s), k.btn)) { hit = true; break; }
      const f = await focusInfo(p);
      if (!f.body) { if (!f.visible) noRing.add(f.name); if (f.obscured) hidden.add(f.name); }
      await p.keyboard.press('Tab');
    }
    T.ok(hit, `${lab}: ${k.btn} reachable by Tab (${n + 1} presses)`);
    T.ok(noRing.size === 0, `${lab}: every Tab stop on the way shows a focus indicator${noRing.size ? ': missing on ' + [...noRing].slice(0, 6).join(', ') : ''}`);
    T.ok(hidden.size === 0, `${lab}: no Tab stop is hidden under the sticky nav${hidden.size ? ': ' + [...hidden].slice(0, 6).join(', ') : ''}`);
    if (!hit) { await ctx.close(); continue; }
    const fv = await p.evaluate(s => { const e = document.querySelector(s), cs = getComputedStyle(e); return { fv: e.matches(':focus-visible'), outline: cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 1 ? cs.outlineWidth + ' ' + cs.outlineStyle + ' ' + cs.outlineColor : '', shadow: cs.boxShadow !== 'none' ? cs.boxShadow : '' }; }, k.btn);
    T.ok(fv.fv && (fv.outline || fv.shadow), `${lab}: focus is visible on ${k.btn} (${(fv.outline || fv.shadow).slice(0, 60)})`);
    // record what is announced through live regions
    await p.evaluate(() => {
      window.__said = [];
      const live = n => { for (let e = n.nodeType === 1 ? n : n.parentElement; e; e = e.parentElement) { if (e.getAttribute && e.getAttribute('aria-hidden') === 'true') return false; if (e.getAttribute && (/^(polite|assertive)$/.test(e.getAttribute('aria-live') || '') || /^(status|alert|log)$/.test(e.getAttribute('role') || ''))) return true; } return false; };
      new MutationObserver(ms => ms.forEach(m => { [...m.addedNodes, m.target].forEach(n => { if (live(n)) { const t = (n.textContent || '').trim(); if (t) window.__said.push(t.slice(0, 140)); } }); })).observe(document.body, { subtree: true, childList: true, characterData: true });
    });
    const sig = () => p.evaluate(() => { const sec = document.querySelector('section.step.is-current') || document; return document.querySelector('main').innerText.length + ':' + [...sec.querySelectorAll('canvas')].map(c => { try { return c.toDataURL().length; } catch (e) { return 0; } }).join(','); });
    const before = await sig();
    await p.keyboard.press(k.key === ' ' ? 'Space' : 'Enter'); await sleep(600);
    const started = await p.evaluate(s => document.querySelector(s).textContent, k.btn);
    await k.done(p).catch(() => {}); await sleep(1500);
    const after = await sig();
    T.ok(after !== before, `${lab}: ${k.key === ' ' ? 'Space' : 'Enter'} on ${k.btn} runs it (page text:canvas ${before.slice(0, 40)} → ${after.slice(0, 40)})`);
    const said = await p.evaluate(() => [...new Set(window.__said)]);
    T.ok(said.length > 0, `${lab}: the result is announced in a live region after a keyboard run (button now "${started.trim().slice(0, 30)}"): ${said.slice(-3).join(' | ').slice(0, 220)}`);
    // No keyboard trap: Tab onward reaches many different stops (or the end of the page), Shift+Tab goes back
    await p.focus(k.btn).catch(() => {});
    const seen = new Set(); let end = false;
    for (let i = 0; i < 40; i++) { await p.keyboard.press('Tab'); const f = await focusInfo(p); if (f.body) { end = true; break; } seen.add(f.name); }
    const back = new Set(); for (let i = 0; i < 6; i++) { await p.keyboard.press('Shift+Tab'); const f = await focusInfo(p); if (!f.body) back.add(f.name); }
    T.ok((seen.size >= 8 || end) && back.size >= 3, `${lab}: no keyboard trap after the run (${seen.size} stops forward${end ? ', reached the end' : ''}, ${back.size} back)`);
    T.ok(p.errors.length === 0, `${lab}: no page errors ${p.errors.join(' | ')}`);
    await ctx.close();
  }
  // The other pages: skip link first, and it lands in main
  for (const [pg, sel] of [['index.html', 'main#labs'], ['teachers.html', 'main#main'], ['teacher-dashboard.html', 'main#main'], ['projector.html', 'main#setup']]) {
    const ctx = await T.ctxFor(b); await ctx.route(/gc\.zgo\.at/, r => r.abort());
    const p = await T.open(ctx, pg); await sleep(300);
    await p.evaluate(() => { document.activeElement && document.activeElement.blur(); window.scrollTo(0, 0); });
    await p.keyboard.press('Tab');
    const first = await p.evaluate(() => { const e = document.activeElement, r = e.getBoundingClientRect(); return e.matches('a.skip-link') && r.top >= 0 && r.bottom <= innerHeight; });
    await p.keyboard.press('Enter'); await sleep(300); await p.keyboard.press('Tab');
    const inMain = await p.evaluate(s => { const m = document.querySelector(s); return !!m && (m.contains(document.activeElement) || document.activeElement === m); }, sel);
    T.ok(first && inMain, `${pg}: "Skip to content" is the first Tab stop and the next Tab is inside ${sel}`);
    T.ok(p.errors.length === 0, `${pg}: no page errors ${p.errors.join(' | ')}`);
    await ctx.close();
  }
}

/* ---------- C. responsive ---------- */
/* Phones, small laptops and desktops, portrait tablets (768×1024, 1024×1366), and 200% zoom of a 1366×768 laptop
   (a 683×384 CSS-pixel viewport, WCAG 1.4.10 reflow). Optional parts via env RESP_VIEWS="375,683z" etc. */
const ALL_VIEWS = [
  { w: 375, h: 800, touch: true, mobile: true }, { w: 430, h: 800, touch: true, mobile: true }, { w: 768, h: 800, touch: true, mobile: true },
  { w: 1024, h: 900 }, { w: 1440, h: 900 },
  { w: 768, h: 1024, touch: true, tag: 'tablet portrait' }, { w: 1024, h: 1366, touch: true, tag: 'tablet portrait' },
  { w: 683, h: 384, tag: '200% zoom', zoom: true },
];
const VIEWS = process.env.RESP_VIEWS ? ALL_VIEWS.filter(v => process.env.RESP_VIEWS.split(',').includes(v.w + (v.zoom ? 'z' : v.tag ? 't' : ''))) : ALL_VIEWS;
/* At 200% zoom the sticky/fixed bars must leave most of the screen for content (they may not cover more than half of it). */
const stickyShare = p => p.evaluate(() => {
  window.scrollTo(0, Math.min(600, document.documentElement.scrollHeight - innerHeight));
  const els = [...document.querySelectorAll('body *')].filter(e => { const cs = getComputedStyle(e); if (!/^(sticky|fixed)$/.test(cs.position) || cs.display === 'none' || cs.visibility === 'hidden') return false; const r = e.getBoundingClientRect(); return r.height > 4 && r.width > innerWidth * 0.5 && r.top < innerHeight && r.bottom > 0 && !e.closest('[hidden], .toasts, .tour, #lab-report'); });
  const top = Math.max(0, ...els.filter(e => e.getBoundingClientRect().top < innerHeight / 2).map(e => e.getBoundingClientRect().bottom));
  const bottom = Math.max(0, ...els.filter(e => e.getBoundingClientRect().top >= innerHeight / 2).map(e => innerHeight - e.getBoundingClientRect().top));
  window.scrollTo(0, 0);
  return { share: (top + bottom) / innerHeight, top: Math.round(top), bottom: Math.round(bottom), names: els.map(e => e.className && typeof e.className === 'string' ? e.className.split(' ')[0] : e.tagName) };
});
const layoutCheck = p => p.evaluate(() => {
  const W = innerWidth, out = { over: document.documentElement.scrollWidth - W, outside: [], small: [] };
  const sec = document.querySelector('section.step.is-current') || document.body;
  const vis = e => { const r = e.getBoundingClientRect(); if (!r.width || !r.height) return false; const cs = getComputedStyle(e); return cs.visibility !== 'hidden' && cs.display !== 'none'; };
  const scroller = e => { for (let a = e.parentElement; a && a !== document.body; a = a.parentElement) { const cs = getComputedStyle(a); if (/(auto|scroll)/.test(cs.overflowX) && a.scrollWidth > a.clientWidth + 1) return true; if (a.tagName === 'DETAILS' && !a.open) return true; } return false; };
  const name = e => (e.id ? '#' + e.id : e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/)[0] : '')) + (e.textContent ? ' "' + e.textContent.trim().slice(0, 24) + '"' : '');
  const ctl = [...sec.querySelectorAll('button, select, input:not([type=hidden]), summary, [role=button], [role=tab]')].filter(vis);
  ctl.forEach(e => { const r = e.getBoundingClientRect(); if ((r.right > W + 1 || r.left < -1) && !scroller(e)) out.outside.push(name(e) + ` [${Math.round(r.left)}–${Math.round(r.right)}]`); });
  // WCAG 2.5.8: under 24×24 is OK if a 24 px circle on its centre clears every other target
  const rects = ctl.map(e => { let t = e; if ((e.type === 'checkbox' || e.type === 'radio') && e.closest('label')) t = e.closest('label'); return { e, r: t.getBoundingClientRect() }; });
  rects.forEach(({ e, r }, i) => {
    if (r.width >= 24 && r.height >= 24) return;
    if (e.tagName === 'INPUT' && !/^(checkbox|radio|button|submit|reset|color|file)$/.test(e.type)) return;   // sliders (thumb is the target) and text fields: left to axe
    if (e.closest('p, li, td') && e.closest('p, li, td').textContent.trim().length > (e.textContent || '').trim().length + 20 && e.classList.contains('linkbtn')) return;   // inline in a sentence
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const clash = rects.some(({ r: o }, j) => { if (j === i) return false; const dx = Math.max(o.left - cx, 0, cx - o.right), dy = Math.max(o.top - cy, 0, cy - o.bottom); const oSmall = o.width < 24 || o.height < 24; return Math.hypot(dx, dy) < 12 || (oSmall && Math.hypot(cx - (o.left + o.width / 2), cy - (o.top + o.height / 2)) < 24); });
    if (clash) out.small.push(name(e) + ` ${Math.round(r.width)}×${Math.round(r.height)}`);
  });
  return out;
});
const dialogFits = p => p.evaluate(() => {
  const d = [...document.querySelectorAll('dialog[open], [role=dialog], [aria-modal=true], #lab-report')].filter(e => { const r = e.getBoundingClientRect(); return r.width && r.height; })[0];
  if (!d) return null;
  const r = d.getBoundingClientRect(), cs = getComputedStyle(d);
  if (cs.position !== 'fixed') return { w: Math.round(r.width), l: Math.round(r.left), r: Math.round(r.right), h: 0, t: 0, b: 0, scrolls: true, W: innerWidth, H: innerHeight };   // an in-page view: the page itself scrolls
  const scrolls = /(auto|scroll)/.test(cs.overflowY) || [...d.querySelectorAll('*')].some(x => /(auto|scroll)/.test(getComputedStyle(x).overflowY) && x.scrollHeight > x.clientHeight);
  return { w: Math.round(r.width), l: Math.round(r.left), r: Math.round(r.right), h: Math.round(r.height), t: Math.round(r.top), b: Math.round(r.bottom), scrolls, W: innerWidth, H: innerHeight };
});
async function responsive(b) {
  const agg = { over: {}, outside: {}, small: {}, dialog: {}, sticky: {} };
  const add = (k, key, where) => { (agg[k][key] = agg[k][key] || []).push(where); };
  for (const v of VIEWS) {
    const w = v.w + (v.tag ? 'x' + v.h + ' (' + v.tag + ')' : '');
    const ctx = await T.ctxFor(b, { width: v.w, height: v.h, reduced: true, touch: !!v.touch, mobile: !!v.mobile }); await ctx.route(/gc\.zgo\.at/, r => r.abort());
    for (const lab of T.LABS) {
      const p = await T.open(ctx, lab + '.html');
      for (const id of await sectionIds(p)) {
        await goPart(p, id); await sleep(150);
        const c = await layoutCheck(p), at = `${lab}#${id}@${w}`;
        if (c.over > 1) add('over', 'page scrolls sideways', at + ` (+${c.over}px)`);
        c.outside.forEach(x => add('outside', x, at));
        c.small.forEach(x => add('small', x.replace(/ \d+×\d+$/, ''), at + ' ' + x.match(/\d+×\d+$/)[0]));
        if (v.zoom) { const st = await stickyShare(p); if (st.share > 0.5) add('sticky', 'sticky bars cover over half the screen', at + ` (${Math.round(st.share * 100)}%: top ${st.top}px, bottom ${st.bottom}px of ${v.h}; ${st.names.join(', ')})`); }
      }
      // dialogs: start-over confirmation and the report preview
      for (const [nm, open] of [['start over', () => p.evaluate(() => Lab.data.startOverLab())], ['report preview', () => p.evaluate(() => Lab.report.open({ print: false }))]]) {
        await open().catch(() => {}); await sleep(700);
        const d = await dialogFits(p);
        if (!d) add('dialog', nm + ': did not open', lab + '@' + w);
        else if (d.l < -1 || d.r > d.W + 1 || (!d.scrolls && (d.t < -1 || d.b > d.H + 1))) add('dialog', nm + ' does not fit', `${lab}@${w} box ${d.l}–${d.r} × ${d.t}–${d.b} in ${d.W}×${d.H}`);
        await p.keyboard.press('Escape'); await sleep(200);
        await p.evaluate(() => { const c = [...document.querySelectorAll('#lab-report .rv-tools .btn')].find(x => /Close report/.test(x.textContent)); if (c) c.click(); });
      }
      T.ok(p.errors.length === 0, `responsive ${lab}@${w}: no page errors ${p.errors.join(' | ')}`);
      await p.close();
    }
    await ctx.close();
  }
  const show = (k, title) => { const keys = Object.keys(agg[k]); console.log(`\n  ${title}: ${keys.length}`); keys.slice(0, 40).forEach(x => console.log(`  - ${x}: ${agg[k][x].length} view(s), e.g. ${agg[k][x].slice(0, 4).join(', ')}`)); return keys.length; };
  T.ok(show('over', 'horizontal page scroll') === 0, 'no horizontal page scroll in any lab part at ' + VIEWS.map(v => v.w + '×' + v.h).join(', '));
  if (VIEWS.some(v => v.zoom)) T.ok(show('sticky', 'sticky bars at 200% zoom') === 0, '200% zoom (683×384): sticky bars leave at least half the screen for content');
  T.ok(show('outside', 'controls outside the viewport') === 0, 'no control outside the viewport');
  T.ok(show('dialog', 'dialogs that do not fit') === 0, 'dialogs fit the viewport');
  T.ok(show('small', 'controls under 24×24 px without spacing (WCAG 2.5.8)') === 0, 'no undersized, crowded touch targets in the lab parts');
}

(async () => {
  const b = await T.launch(), srv = await T.serve();
  if (want('axe')) await axeScan(b, srv);
  if (want('keys')) await keyboard(b);
  if (want('resp')) await responsive(b);
  await b.close(); srv.close();
  T.done('t59-a11y');
})();
