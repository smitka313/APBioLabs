/* Usability item 9: on touch sizes (390 px phone here) the controls listed in the audit are at least 44 px tall:
   theme toggle, dashboard "Open activity" buttons, companion step tabs, activity bar links, header and lab toolbar links,
   teacher-page part links and buttons, and checkbox labels (the checkbox itself is not resized).
   Inline links inside running prose are not in scope. Layout is also checked at 390, 768, 1366 and 1920 px, light and dark.
   Run: NODE_PATH=$(npm root -g) node tests/t117-usability-touch-targets.js */
const T = require('./_h');
const TARGETS = [
  ['index.html', ['.bench-portal-theme button', '.bench-choice-links a', '.bench-quick-choose a']],
  ['ap-biology.html', ['.theme-opt', '[data-bench-theme]', '.bench-brandbar a']],
  ['openscied-dashboard.html', ['.theme-opt', '.dashboard-open', '.bench-brandbar a', '.bench-logo']],
  ['openscied-b3-cell-cycle.html', ['.theme-opt', '.step-nav a', '.bench-activity-home', '.bench-activity-course']],
  ['lab01.html', ['.theme-opt', '.linkbtn', '.bench-activity-home', '.bench-activity-course']],
  ['teachers.html', ['.theme-opt', '.labs-table td.parts a']],
  ['teacher-hub.html', ['.theme-opt', '[data-bench-theme]']],
  ['projector.html', ['.crumbs a']],
];
(async () => {
  const browser = await T.launch(), server = await T.serve();
  try {
    for (const [pg, sels] of TARGETS) {
      const ctx = await T.ctxFor(browser, { width: 390, height: 844, dark: true }), p = await ctx.newPage();
      await p.route(/gc\.zgo\.at|fonts\./, r => r.fulfill({ status: 200, body: '' }));
      await p.goto(server.url + pg); await p.waitForTimeout(600);
      const short = await p.evaluate(sels => {
        const out = []; let n = 0;
        sels.forEach(sel => document.querySelectorAll(sel).forEach(el => {
          const cs = getComputedStyle(el), r = el.getBoundingClientRect();
          if (cs.display === 'none' || r.width === 0 || r.height === 0) return;
          n++;
          if (r.height < 43.5) out.push(sel + ' "' + el.textContent.trim().slice(0, 30) + '" ' + Math.round(r.height) + 'px');
        }));
        // Checkbox label: widened clickable area, checkbox untouched.
        const probe = document.createElement('label'); probe.className = 'check';
        const cb = document.createElement('input'); cb.type = 'checkbox'; probe.append(cb, ' probe'); document.body.append(probe);
        const lh = probe.getBoundingClientRect().height, cbh = cb.getBoundingClientRect().height; probe.remove();
        if (lh < 43.5) out.push('label.check (checkbox label) ' + Math.round(lh) + 'px');
        return { n, short: out, cbh: Math.round(cbh) };
      }, sels);
      T.ok(short.n > 0, pg + ': target elements found (' + short.n + ')');
      T.ok(short.short.length === 0, pg + ' at 390 px: every listed control is 44 px tall' + (short.short.length ? ' — short: ' + short.short.join('; ') : ''));
      await ctx.close();
    }
    for (const pg of ['index.html', 'ap-biology.html', 'openscied-dashboard.html', 'openscied-b3-cell-cycle.html', 'lab01.html', 'projector.html', 'teacher-hub.html', 'teachers.html']) {
      for (const [width, dark] of [[390, true], [768, false], [1366, false], [1920, true]]) {
        const ctx = await T.ctxFor(browser, { width, height: 900, dark }), p = await ctx.newPage();
        await p.route(/gc\.zgo\.at|fonts\./, r => r.fulfill({ status: 200, body: '' }));
        await p.goto(server.url + pg); await p.waitForTimeout(500);
        const over = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        T.ok(over <= 0, pg + ' at ' + width + (dark ? ' dark' : ' light') + ': no sideways scroll (overflow ' + over + 'px)');
        await ctx.close();
      }
    }
  } finally { await browser.close(); server.close(); }
  T.done('t117-usability-touch-targets');
})().catch(e => { console.error(e); process.exitCode = 1; });
