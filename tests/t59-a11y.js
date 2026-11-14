/* Accessibility and responsive scan.
   A. axe-core, WCAG 2.0/2.1/2.2 A + AA rules, on index, teachers, teacher-dashboard and every part of all 13 labs, light and dark.
      Critical and serious violations are reported grouped by rule (pages + one example target each) and fail the test.
   B. Keyboard on Labs 5, 9, 13: the main run control is reachable with Tab, shows a visible focus indicator, works with
      Enter / Space, and the completion message reaches a live region.
   C. Responsive at 375, 430, 768, 1024, 1440 px for all 13 labs (every part): no horizontal page scroll, no control outside the
      viewport (unless inside a scrollable box), dialogs fit the viewport, and no control smaller than 24×24 px without the
      WCAG 2.5.8 spacing exception.
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

/* ---------- B. keyboard ---------- */
const KEYS = {
  lab05: { part: 'sink-disks', pre: async p => { await D.fillPred(p, 'predict-floatassay', 'I predict the disks float because of photosynthesis.'); await D.fillPred(p, 'predict-design', 'I predict the rate rises.'); }, btn: '#inf-pull', key: 'Enter', done: p => p.waitForFunction(() => !document.querySelector('#inf-pull').disabled && Lab.store.get('inf') != null || /sunk|sink/i.test((document.querySelector('#inf-fb') || {}).textContent || ''), null, { timeout: 25000 }) },
  lab09: { part: 'run-a-gel', pre: async p => { await p.evaluate(() => document.querySelector('#g1-layout').click()); }, btn: '#g1-run', key: ' ', done: async p => { await sleep(3000); await p.focus('#g1-run'); await p.keyboard.press(' '); await sleep(800); } },
  lab13: { part: 'procedure-1', pre: async p => { await D.go(p, '#p-predict-assay'); await p.fill('#p-predict-assay', 'Only the tube with enzyme will turn brown.'); await sleep(1300); await p.evaluate(() => { const b = document.querySelector('#m1 button[data-v="spec"]'); if (b) b.click(); }); }, btn: '#p1-run', key: 'Enter', done: p => D.tlReady(p, '#p1-timelapse', 40000) },
};
async function keyboard(b) {
  for (const [lab, k] of Object.entries(KEYS)) {
    const ctx = await T.ctxFor(b); await ctx.route(/gc\.zgo\.at/, r => r.abort());
    const p = await T.open(ctx, lab + '.html', k.part); await sleep(400);
    await k.pre(p); await goPart(p, k.part); await sleep(400);
    // Tab from the top of the page until the run control has focus
    await p.evaluate(() => { document.activeElement && document.activeElement.blur(); window.scrollTo(0, 0); });
    await p.keyboard.press('Tab');
    let n = 0, hit = false;
    for (; n < 250; n++) { if (await p.evaluate(s => document.activeElement === document.querySelector(s), k.btn)) { hit = true; break; } await p.keyboard.press('Tab'); }
    T.ok(hit, `${lab}: ${k.btn} reachable by Tab (${n + 1} presses)`);
    if (!hit) { await ctx.close(); continue; }
    const fv = await p.evaluate(s => { const e = document.querySelector(s), cs = getComputedStyle(e); return { fv: e.matches(':focus-visible'), outline: cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 1 ? cs.outlineWidth + ' ' + cs.outlineStyle + ' ' + cs.outlineColor : '', shadow: cs.boxShadow !== 'none' ? cs.boxShadow : '' }; }, k.btn);
    T.ok(fv.fv && (fv.outline || fv.shadow), `${lab}: focus is visible on ${k.btn} (${fv.outline || fv.shadow})`);
    // record what is announced through live regions
    await p.evaluate(() => {
      window.__said = [];
      const live = n => { for (let e = n.nodeType === 1 ? n : n.parentElement; e; e = e.parentElement) { if (e.getAttribute && e.getAttribute('aria-hidden') === 'true') return false; if (e.getAttribute && (/^(polite|assertive)$/.test(e.getAttribute('aria-live') || '') || /^(status|alert|log)$/.test(e.getAttribute('role') || ''))) return true; } return false; };
      new MutationObserver(ms => ms.forEach(m => { [...m.addedNodes, m.target].forEach(n => { if (live(n)) { const t = (n.textContent || '').trim(); if (t) window.__said.push(t.slice(0, 140)); } }); })).observe(document.body, { subtree: true, childList: true, characterData: true });
    });
    await p.keyboard.press(k.key === ' ' ? 'Space' : 'Enter'); await sleep(600);
    const started = await p.evaluate(s => document.querySelector(s).textContent, k.btn);
    await k.done(p).catch(() => {}); await sleep(1500);
    const said = await p.evaluate(() => [...new Set(window.__said)]);
    T.ok(said.length > 0, `${lab}: the result is announced in a live region after a keyboard run (button now "${started.trim().slice(0, 30)}"): ${said.slice(-3).join(' | ').slice(0, 220)}`);
    T.ok(p.errors.length === 0, `${lab}: no page errors ${p.errors.join(' | ')}`);
    await ctx.close();
  }
}

/* ---------- C. responsive ---------- */
const WIDTHS = [375, 430, 768, 1024, 1440];
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
  const agg = { over: {}, outside: {}, small: {}, dialog: {} };
  const add = (k, key, where) => { (agg[k][key] = agg[k][key] || []).push(where); };
  for (const w of WIDTHS) {
    const ctx = await T.ctxFor(b, { width: w, height: w < 800 ? 800 : 900, reduced: true, touch: w < 800, mobile: w < 800 }); await ctx.route(/gc\.zgo\.at/, r => r.abort());
    for (const lab of T.LABS) {
      const p = await T.open(ctx, lab + '.html');
      for (const id of await sectionIds(p)) {
        await goPart(p, id); await sleep(150);
        const c = await layoutCheck(p), at = `${lab}#${id}@${w}`;
        if (c.over > 1) add('over', 'page scrolls sideways', at + ` (+${c.over}px)`);
        c.outside.forEach(x => add('outside', x, at));
        c.small.forEach(x => add('small', x.replace(/ \d+×\d+$/, ''), at + ' ' + x.match(/\d+×\d+$/)[0]));
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
  T.ok(show('over', 'horizontal page scroll') === 0, 'no horizontal page scroll at 375–1440 px in any lab part');
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
