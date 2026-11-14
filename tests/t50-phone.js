/* Phone pass (Playwright device emulation: iPhone 13, Pixel 7; light and dark). Every part of every lab, plus the other pages:
   no sideways page scroll, the sticky nav never covers a part's heading, and every shared control (step nav, header, theme switch,
   link buttons, "Show me", buttons, selects, disclosures) is at least 40 px tall. Lab-specific controls are reported, not failed. */
const { chromium, devices } = require('playwright');
const { ok, done, ROOT, LABS, routeLibs } = require('./_h.js');
const SHARED = '.step-nav a, .theme-opt, .sound-toggle, .project-link, .lab-header .crumbs a, .linkbtn, .link-btn, button.si-show, .sim-tab, .btn:not(.tube), summary, .pager button, .pager a, .parts-toggle, .pause-btn';
const probe = () => {
  const vis = e => { const r = e.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return false; for (let a = e; a && a !== document.documentElement; a = a.parentElement) { const cs = getComputedStyle(a); if (cs.display === 'none' || cs.visibility === 'hidden' || a.hidden) return false; } return true; };
  return { overflow: document.documentElement.scrollWidth - innerWidth,
    small: [...document.querySelectorAll(arguments[0] || '')].length };
};
(async () => {
  const b = await chromium.launch();
  const combos = [['iPhone 13', 'light', LABS], ['Pixel 7', 'dark', LABS], ['iPhone 13', 'dark', ['lab05', 'lab09']], ['Pixel 7', 'light', ['lab05', 'lab09']]];
  const extra = ['index.html', 'teachers.html', 'teacher-dashboard.html', 'projector.html'];
  const labSpecific = new Set();
  for (const [dev, scheme, labs] of combos) {
    const ctx = await b.newContext({ ...devices[dev], colorScheme: scheme }); await routeLibs(ctx);
    await ctx.addInitScript(() => { try { localStorage.setItem('aplab:student', JSON.stringify({ name: 'T S', period: '3' })); localStorage.setItem('aplab:tour', JSON.stringify({ seen: true, v: 1 })); } catch (e) { /* ignore */ } });
    const p = await ctx.newPage();
    const check = async (id) => {
      const r = await p.evaluate(SHARED => {
        const W = innerWidth, vis = e => { const r = e.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return false; for (let a = e; a && a !== document.documentElement; a = a.parentElement) { const cs = getComputedStyle(a); if (cs.display === 'none' || cs.visibility === 'hidden' || a.hidden) return false; } return true; };
        const small = [...document.querySelectorAll(SHARED)].filter(e => vis(e) && !e.closest('.tour, .toasts') && e.getBoundingClientRect().height < 39.5).map(e => (e.className || e.tagName) + ' ' + Math.round(e.getBoundingClientRect().height) + 'px');
        const all = [...document.querySelectorAll('button, input:not([type=hidden]):not([type=checkbox]):not([type=radio]), select, label.check')].filter(e => vis(e) && !e.closest('.tour, .toasts') && !e.matches(SHARED) && e.getBoundingClientRect().height < 39.5).map(e => (e.id ? '#' + e.id : e.className || e.tagName) + ' ' + Math.round(e.getBoundingClientRect().height) + 'px');
        const nav = document.querySelector('.step-nav'), cur = document.querySelector('section.step.is-current'), h2 = cur && cur.querySelector('h2');
        return { overflow: document.documentElement.scrollWidth - W, small, all, covered: nav && h2 ? h2.getBoundingClientRect().top < nav.getBoundingClientRect().bottom - 1 : false };
      }, SHARED);
      ok(r.overflow <= 0, `${dev} ${scheme} ${id}: no sideways page scroll`);
      ok(!r.covered, `${dev} ${scheme} ${id}: sticky nav does not cover the heading`);
      ok(r.small.length === 0, `${dev} ${scheme} ${id}: shared controls >= 40 px${r.small.length ? ' (' + [...new Set(r.small)].join('; ') + ')' : ''}`);
      r.all.forEach(s => labSpecific.add(id.split('#')[0] + ' ' + s));
    };
    for (const lab of labs) {
      await p.goto('file://' + ROOT + '/' + lab + '.html'); await p.waitForTimeout(600);
      const slugs = await p.evaluate(() => Lab.pages.list().map(s => s.id));
      for (const s of slugs) { await p.evaluate(s => Lab.pages.go(s), s); await p.waitForTimeout(300); await check(lab + '#' + s); }
    }
    if (labs.length === LABS.length) for (const f of extra) { await p.goto('file://' + ROOT + '/' + f); await p.waitForTimeout(700); await check(f); }
    await ctx.close();
  }
  console.log('\nLab-specific small controls (not failed):\n  ' + [...labSpecific].sort().join('\n  '));
  await b.close();
  done('t50-phone');
})();
