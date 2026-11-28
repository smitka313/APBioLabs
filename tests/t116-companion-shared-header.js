/* Shared header on every OpenSciEd companion page (openscied-b1 to openscied-b5).
   For each page: one header.companion-header with the shared parts (crumbs, eyebrow, page-title h1);
   the title is visible inside the first phone screen (390 x 844); the header is no taller than HEADER_MAX
   at 390 px; no sideways scroll on the page or inside the header at 390, 768, 1366 and 1920 px; the header's
   parts do not overlap; axe finds nothing in the header (WCAG 2.x A/AA); the theme control is in the header;
   the step rail (if the page has one) is still there, links to real sections, and its links are 44 px tall at
   390 px; the page's own save-status element and the site's save receipt are still there; the footer and its
   attribution still start with "Created by Robert Smitka.".
   Run: NODE_PATH=$(npm root -g) AXE=/path/to/axe.min.js node tests/t116-companion-shared-header.js
   Before the change (origin/main) this fails on the old per-page headers; the counts are reported at the end. */
const T = require('./_h');
const fs = require('fs');
const path = require('path');

const HEADER_MAX = 420;              // px tall at 390 px wide: about half of an 844 px phone screen (the owner may want tighter; see the PR)
const PHONE = { width: 390, height: 844 };
const WIDTHS = [390, 768, 1366, 1920];
const STEP_RAIL_TARGET = 44;         // px, step links at phone width
const SAVE_STATUS = {                // the page's own save-status element (ids kept from before the change)
  'openscied-b1-carrying-capacity.html': 'cc-save-status',
  'openscied-b2-burn-lab.html': 'save-status',
  'openscied-b2-fires.html': 'save-status',
  'openscied-b2-peat-bog-lab.html': 'save-status',
  'openscied-b3-cell-cycle.html': 'save-status',
  'openscied-b3-dna-p53.html': 'save-status',
  'openscied-b3-inheritance-environment.html': 'save-status',
  'openscied-b4-hawksbeard.html': 'hb-save-status',
};
const AXE = process.env.AXE || (() => { try { return require.resolve('axe-core/axe.min.js'); } catch (e) { return null; } })();

const FILES = fs.readdirSync(T.ROOT).filter(f => /^openscied-b[1-5]-.*\.html$/.test(f) && !/PBKDF2/.test(fs.readFileSync(path.join(T.ROOT, f), 'utf8'))).sort();

(async () => {
  const browser = await T.launch();
  const server = await T.serve();
  const stub = async p => p.route(/gc\.zgo\.at|fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, contentType: /gc\.zgo\.at/.test(r.request().url()) ? 'application/javascript' : 'text/css', body: '' }));
  try {
    if (!AXE) T.ok(false, 'axe-core not found: set AXE=<path>/node_modules/axe-core/axe.min.js');
    T.ok(FILES.length === 24, `24 companion pages found (${FILES.length})`);
    for (const file of FILES) {
      const label = file.replace('.html', '');
      // ---- phone: structure, height, title position, overlap, axe, step rail, save status, footer
      {
        const ctx = await T.ctxFor(browser, { ...PHONE, mobile: true });
        const p = await ctx.newPage();
        const errors = [];
        p.on('pageerror', e => errors.push(e.message));
        await stub(p);
        await p.goto(server.url + file);
        await p.waitForFunction(() => document.readyState === 'complete');
        await p.waitForTimeout(600);
        // Some b5 pages load scrolled part way down (a pre-existing load-time scroll, also on origin/main).
        // The title rule is about the header's position on the page, so measure from the top of the page.
        await p.evaluate(() => window.scrollTo(0, 0));
        await p.waitForTimeout(100);
        const m = await p.evaluate(() => {
          const hs = Array.from(document.querySelectorAll('header.companion-header'));
          const h = hs[0];
          if (!h) return { count: hs.length };
          const r = h.getBoundingClientRect();
          const h1 = h.querySelector('h1.page-title');
          const h1r = h1 ? h1.getBoundingClientRect() : null;
          const parts = Array.from(h.querySelectorAll(':scope > .wrap > *')).map(el => el.getBoundingClientRect());
          let overlap = false;
          for (let i = 1; i < parts.length; i++) if (parts[i - 1].bottom > parts[i].top + 1) overlap = true;
          const inside = Array.from(h.querySelectorAll('*')).filter(el => { const b = el.getBoundingClientRect(); return b.width && b.height && (b.right > r.right + 0.5 || b.left < r.left - 0.5); }).length;
          const rail = document.querySelector('nav.step-nav, nav.sf-steps, nav.rp-steps');
          const items = rail ? Array.from(rail.querySelectorAll('a, button')).filter(x => x.getClientRects().length) : [];
          const links = items.filter(x => x.tagName === 'A' && x.getAttribute('href') && x.getAttribute('href').startsWith('#'));
          const stepTargets = links.map(a => ({ href: a.getAttribute('href'), ok: !!document.getElementById(decodeURIComponent(a.getAttribute('href').slice(1))) }));
          return {
            count: hs.length,
            structure: !!(h.querySelector(':scope > .wrap > nav.crumbs[aria-label="Breadcrumb"]') && h.querySelector(':scope > .wrap > .eyebrow') && h1),
            h: r.height, top: r.top,
            title: h1 ? (h1.textContent || '').trim() : '',
            h1Top: h1r ? h1r.top : -1, h1Bottom: h1r ? h1r.bottom : -1,
            overlap, inside,
            theme: !!h.querySelector('.theme-switch, #sg-theme'),
            steps: items.length, stepTargets, rail: !!rail,
            railH: items.length ? Math.min(...items.map(x => x.getBoundingClientRect().height)) : 0,
            scrollW: document.documentElement.scrollWidth, clientW: document.documentElement.clientWidth,
            hScrollW: h.scrollWidth, hClientW: h.clientWidth,
            footer: ((document.querySelector('.site-footer') || Array.from(document.querySelectorAll('footer')).pop()) || { textContent: '' }).textContent.trim().slice(0, 60),
            activityBar: !!document.querySelector('body > .bench-activity-bar'),
            receipt: !!document.getElementById('bench-save-receipt'),
          };
        });
        T.ok(m.count === 1 && m.structure, `${label}: one shared header with the crumbs, eyebrow and page title`);
        T.ok(m.count === 1 && m.title.length > 0 && m.h1Top >= 0 && m.h1Bottom <= PHONE.height, `${label}: the title is visible in the first 390 x 844 screen (${Math.round(m.h1Top)} to ${Math.round(m.h1Bottom)} px)`);
        T.ok(m.count === 1 && m.h <= HEADER_MAX, `${label}: header is ${Math.round(m.h)} px tall at 390 px (limit ${HEADER_MAX})`);
        T.ok(m.count === 1 && !m.overlap && m.inside === 0, `${label}: header parts do not overlap or spill out of the header`);
        T.ok(m.count === 1 && m.theme, `${label}: the theme control is in the header`);
        if (AXE) {
          await p.addScriptTag({ path: AXE });
          const v = await p.evaluate(async () => {
            const el = document.querySelector('header.companion-header') || document.querySelector('main header');
            if (!el) return ['no header found'];
            const res = await window.axe.run(el, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } });
            return res.violations.map(x => x.id + ': ' + x.help);
          });
          T.ok(v.length === 0, `${label}: axe finds nothing in the header ${v.join(' | ')}`);
        }
        if (m.rail) {
          T.ok(m.steps >= 2 && m.stepTargets.every(s => s.ok), `${label}: step rail has ${m.steps} items; every #link goes to a real section`);
          T.ok(m.railH >= STEP_RAIL_TARGET, `${label}: step rail targets are ${Math.round(m.railH)} px tall (min ${STEP_RAIL_TARGET})`);
        }
        const save = SAVE_STATUS[file];
        if (save) T.ok(await p.locator('#' + save).count() === 1, `${label}: save status #${save} is kept`);
        T.ok(m.activityBar && m.receipt, `${label}: site activity bar and save receipt are kept`);
        T.ok(/^Created by Robert Smitka\./.test(m.footer), `${label}: footer starts "Created by Robert Smitka."`);
        T.ok(errors.length === 0, `${label}: no page errors ${errors.join(' | ')}`);
        await ctx.close();
      }
      // ---- every width: no sideways scroll on the page or inside the header
      for (const width of WIDTHS) {
        const ctx = await T.ctxFor(browser, { width, height: 900, dark: width === 1920 });
        const p = await ctx.newPage();
        await stub(p);
        await p.goto(server.url + file);
        await p.waitForTimeout(400);
        const s = await p.evaluate(() => {
          const h = document.querySelector('header.companion-header');
          return { page: document.documentElement.scrollWidth - document.documentElement.clientWidth, header: h ? h.scrollWidth - h.clientWidth : 0 };
        });
        T.ok(s.page <= 0 && s.header <= 0, `${label}: no sideways scroll at ${width} px (page ${s.page}, header ${s.header})`);
        await ctx.close();
      }
    }
  } finally {
    await browser.close();
    server.close();
  }
})().then(() => T.done('t116-companion-shared-header'), e => { console.error(e); process.exitCode = 1; });
