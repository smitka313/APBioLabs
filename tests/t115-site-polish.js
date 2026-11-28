/* Site polish batch (branch feat/site-polish-2026-11-28):
   1. one header style for both course links (AP Biology, OpenSciEd) on the course pages
   2. "Your work on this device": 14 px body text, status line visible, long notes in a disclosure, 44 px buttons
   3. activity finder search and unit select use site tokens with a visible focus ring
   4. unit links under the hero are chips with the unit name and activity count, 44 px targets
   5. no empty band above the dashboard masthead
   6. one heading scale defined as tokens and used on home, AP index, dashboard and a companion page
   7. shorter copy above the fold on the home page and the OpenSciEd dashboard
   8. dark mode: axe colour-contrast clean on the public pages
   plus guards that the footer, the not-official notice and the layout (no sideways scroll) still hold.
   Needs axe-core: AXE=<path>/node_modules/axe-core/axe.min.js (for item 8).
   Run: NODE_PATH=$(npm root -g) AXE=... node tests/t115-site-polish.js */
const fs = require('fs');
const path = require('path');
const T = require('./_h');

function axePath() {
  const c = [process.env.AXE, (() => { try { return require.resolve('axe-core/axe.min.js'); } catch (e) { return null; } })(),
    path.join(__dirname, '../node_modules/axe-core/axe.min.js')].filter(Boolean);
  return c.find(f => fs.existsSync(f)) || null;
}

async function page(browser, server, file, { width = 1366, height = 900, theme = 'light' } = {}) {
  const ctx = await T.ctxFor(browser, { width, height, dark: theme === 'dark' });
  await ctx.route(/gc\.zgo\.at|fonts\./, r => r.fulfill({ status: 200, body: '' }));
  await ctx.addInitScript(t => { try { localStorage.setItem('aplab:pref:theme', t); } catch (e) { /* private window */ } }, theme);
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(String(e && e.message)));
  await p.goto(server.url + file, { waitUntil: 'load' });
  await p.waitForTimeout(400);
  return { ctx, p, errors };
}

(async () => {
  const browser = await T.launch(), server = await T.serve();
  const axeFile = axePath();
  try {
    // 1. Header: both course links share one treatment on phone and desktop.
    for (const file of ['openscied-dashboard.html', 'ap-biology.html']) {
      for (const width of [390, 1366]) {
        const { ctx, p } = await page(browser, server, file, { width, height: 844 });
        try {
          const links = await p.evaluate(() => [...document.querySelectorAll('.bench-brandbar .bench-route-nav a')].map(a => {
            const s = getComputedStyle(a);
            return { text: a.textContent.trim(), h: a.getBoundingClientRect().height, weight: s.fontWeight, deco: s.textDecorationLine,
              border: s.borderTopWidth + ' ' + s.borderTopStyle + ' ' + s.borderTopColor, radius: s.borderTopLeftRadius, font: s.fontSize };
          }));
          const same = links.length === 2 && links.every(l => l.h >= 44 && l.weight === links[0].weight && l.font === links[0].font &&
            l.radius === links[0].radius && l.deco === 'none' && !/transparent|rgba\(0, 0, 0, 0\)/.test(l.border) && !/^0px/.test(l.border));
          T.ok(same, `${file} ${width} px: both course links share height (>=44 px), weight, size, border and no underline ${JSON.stringify(links.map(l => [l.text, Math.round(l.h), l.weight, l.deco]))}`);
        } finally { await ctx.close(); }
      }
    }

    // 2. Student panel on the dashboard.
    for (const width of [390, 1366]) {
      const { ctx, p } = await page(browser, server, 'openscied-dashboard.html', { width, height: 844 });
      try {
        const m = await p.evaluate(() => {
          const status = document.querySelector('#openscied-results-status');
          const panel = document.querySelector('.dashboard-student');
          const visibleBodyText = [...panel.querySelectorAll('p')].filter(el => {
            if (!el.textContent.trim() || el.closest('details:not([open])') || el.closest('[hidden],[inert]')) return false;
            const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0;
          });
          const small = visibleBodyText.filter(el => parseFloat(getComputedStyle(el).fontSize) < 14).map(el => el.textContent.trim().slice(0, 40));
          const btn = id => { const b = document.getElementById(id); return b ? b.getBoundingClientRect().height : 0; };
          return {
            statusVisible: !!status && status.getBoundingClientRect().height > 0 && parseFloat(getComputedStyle(status).fontSize) >= 14,
            hasDisclosure: !!panel.querySelector('details > summary') && !!panel.querySelector('details #openscied-backup-help'),
            small, smallCount: small.length,
            download: btn('download-openscied-results'), clear: btn('clear-openscied-results')
          };
        });
        T.ok(m.statusVisible, `${width} px: the saved-work status line is visible at 14 px or larger without opening anything`);
        T.ok(m.hasDisclosure, `${width} px: the long backup and saving notes sit inside a disclosure`);
        T.ok(m.smallCount === 0, `${width} px: every visible body line in "Your work on this device" is 14 px or larger ${m.smallCount ? JSON.stringify(m.small) : ''}`);
        T.ok(m.download >= 44 && m.clear >= 44, `${width} px: both backup buttons are at least 44 px tall (${Math.round(m.download)}, ${Math.round(m.clear)})`);
      } finally { await ctx.close(); }
    }

    // 3. Finder controls use the site's surfaces, borders and focus ring in both themes.
    for (const theme of ['light', 'dark']) {
      for (const width of [390, 1366]) {
        const { ctx, p } = await page(browser, server, 'openscied-dashboard.html', { width, height: 844, theme });
        try {
          const m = await p.evaluate(() => {
            const probe = (v) => { const d = document.createElement('div'); d.style.color = v; document.body.append(d); const c = getComputedStyle(d).color; d.remove(); return c; };
            const input = document.getElementById('activity-search'), select = document.getElementById('activity-group');
            const si = getComputedStyle(input), ss = getComputedStyle(select);
            const surfaceOk = c => c === probe('var(--surface)') || c === probe('var(--surface-2)');
            return {
              inputBg: surfaceOk(si.backgroundColor), inputBorder: si.borderTopColor === probe('var(--line)'),
              selectBg: surfaceOk(ss.backgroundColor), selectBorder: ss.borderTopColor === probe('var(--line)'),
              selectAppearance: ss.appearance, inkText: si.color === probe('var(--ink)') && ss.color === probe('var(--ink)')
            };
          });
          T.ok(m.inputBg && m.inputBorder, `${theme} ${width} px: search field uses the site surface and border tokens`);
          T.ok(m.selectBg && m.selectBorder && m.inkText && m.selectAppearance === 'none', `${theme} ${width} px: unit select is styled with site tokens (no browser default look)`);
        } finally { await ctx.close(); }
      }
    }
    {
      const { ctx, p } = await page(browser, server, 'openscied-dashboard.html', { width: 1366, height: 844 });
      try {
        await p.locator('#activity-group').focus();
        await p.keyboard.press('Shift+Tab'); await p.keyboard.press('Tab');
        const focus = await p.evaluate(() => {
          const el = document.activeElement, s = getComputedStyle(el);
          return { id: el.id, visible: el.matches(':focus-visible'), width: parseFloat(s.outlineWidth), style: s.outlineStyle };
        });
        T.ok(focus.id && focus.visible && focus.width >= 2 && focus.style !== 'none', `keyboard focus ring is visible on the finder controls (${focus.id || 'none'}, ${focus.width} px)`);
      } finally { await ctx.close(); }
    }

    // 4. Unit chips: name, activity count, anchor, 44 px target.
    for (const width of [390, 1366]) {
      for (const theme of ['light', 'dark']) {
        const { ctx, p } = await page(browser, server, 'openscied-dashboard.html', { width, height: 844, theme });
        try {
          const chips = await p.evaluate(() => [...document.querySelectorAll('.dashboard-unit-jumps a')].map(a => {
            const n = (a.getAttribute('href') || '').replace('#unit', '');
            const count = document.querySelectorAll(`section[aria-labelledby="unit${n}"] .dashboard-activity`).length;
            return { href: a.getAttribute('href'), text: a.textContent.replace(/\s+/g, ' ').trim(), h: a.getBoundingClientRect().height,
              count, target: !!document.querySelector('#unit' + n), bg: getComputedStyle(a).backgroundColor, border: getComputedStyle(a).borderTopWidth };
          }));
          const ok = chips.length === 5 && chips.every(c => c.h >= 44 && c.target && c.text.includes(String(c.count) + ' activities') && c.text.length > 12);
          T.ok(ok, `${theme} ${width} px: five unit chips, each at least 44 px, linking to its unit with its activity count ${JSON.stringify(chips.map(c => c.text))}`);
          const f = await p.evaluate(() => { const a = document.querySelector('.dashboard-unit-jumps a'); a.focus(); const s = getComputedStyle(a); return { vis: a.matches(':focus-visible'), w: parseFloat(s.outlineWidth) }; });
          T.ok(f.vis && f.w >= 2, `${theme} ${width} px: unit chips show a visible focus ring`);
        } finally { await ctx.close(); }
      }
    }

    // 5. No empty band above the dashboard masthead.
    {
      const { ctx, p } = await page(browser, server, 'openscied-dashboard.html', { width: 1366, height: 844 });
      try {
        const top = await p.evaluate(() => document.querySelector('.dashboard-masthead').getBoundingClientRect().top);
        T.ok(top <= 0.5, `1366 px: the dashboard masthead starts at the top of the page (top ${top.toFixed(1)} px)`);
      } finally { await ctx.close(); }
    }

    // 6. One heading scale, used on the public pages.
    const scaleFiles = ['index.html', 'ap-biology.html', 'openscied-dashboard.html', 'openscied-b3-cell-cycle.html'];
    for (const file of scaleFiles) {
      const { ctx, p } = await page(browser, server, file, { width: 390, height: 844 });
      try {
        const defined = await p.evaluate(() => ['--type-display', '--type-h2', '--type-h3', '--space-section'].every(v => getComputedStyle(document.documentElement).getPropertyValue(v).trim() !== ''));
        T.ok(defined, `${file}: heading and spacing scale is defined as tokens on :root`);
      } finally { await ctx.close(); }
    }
    for (const file of ['index.html', 'ap-biology.html', 'openscied-dashboard.html', 'openscied-b3-cell-cycle.html']) {
      for (const width of [390, 1366]) {
        const { ctx, p } = await page(browser, server, file, { width, height: 844 });
        try {
          const m = await p.evaluate(() => {
            const probe = v => { const d = document.createElement('div'); d.style.fontSize = v; document.body.append(d); const s = getComputedStyle(d).fontSize; d.remove(); return s; };
            const h1 = document.querySelector('h1');
            return { h1: getComputedStyle(h1).fontSize, want: probe('var(--type-display)') };
          });
          // The home title keeps its own larger size (owner request); other public titles use the shared display token.
          if (file === 'index.html') T.ok(parseFloat(m.h1) >= 48 && parseFloat(m.h1) >= (width >= 1200 ? 78 : 40), `${file} ${width} px: home h1 stays large (${m.h1})`);
          else T.ok(m.h1 === m.want && m.want !== '16px', `${file} ${width} px: h1 uses the display token (${m.h1}, token ${m.want})`);
        } finally { await ctx.close(); }
      }
    }

    // 7. Shorter first screens at 1366 x 768: the intro copy is short, and the course choice or the
    //    activity finder starts on screen or close to it.
    {
      const { ctx, p } = await page(browser, server, 'index.html', { width: 1366, height: 768 });
      try {
        const m = await p.evaluate(() => ({
          intro: document.querySelector('.bench-intro').textContent.replace(/\s+/g, ' ').trim().length,
          choiceTop: Math.round(document.querySelector('.bench-choice').getBoundingClientRect().top)
        }));
        T.ok(m.intro <= 160, `index.html: intro copy above the course choices is short (${m.intro} characters, was 183)`);
        T.ok(m.choiceTop < 520, `index.html at 1366 x 768: the first course choice starts high on the screen (top ${m.choiceTop} px)`);
      } finally { await ctx.close(); }
    }
    {
      const { ctx, p } = await page(browser, server, 'openscied-dashboard.html', { width: 1366, height: 768 });
      try {
        const chars = await p.evaluate(() => {
          let total = 0;
          for (const el of document.querySelectorAll('.dashboard-hero-copy .dashboard-eyebrow, .dashboard-hero-copy .dashboard-title, .dashboard-hero-copy .dashboard-intro, .dashboard-student h2, .dashboard-student p')) {
            if (el.closest('details:not([open])')) continue;
            const r = el.getBoundingClientRect();
            if (r.width === 0 || r.height === 0 || r.top >= innerHeight) continue;
            total += el.textContent.replace(/\s+/g, ' ').trim().length;
          }
          return total;
        });
        T.ok(chars <= 300, `openscied-dashboard at 1366 x 768: copy above the fold (title, intro and the work panel) is short (${chars} characters, was 976)`);
      } finally { await ctx.close(); }
    }

    // 8. Dark mode: axe colour-contrast clean on the public pages (and the other WCAG AA rules).
    if (!axeFile) {
      T.ok(false, 'axe-core not found: set AXE=<path>/node_modules/axe-core/axe.min.js');
    } else {
      const src = fs.readFileSync(axeFile, 'utf8');
      for (const file of ['index.html', 'ap-biology.html', 'openscied-dashboard.html']) {
        for (const width of [390, 1366]) {
          const { ctx, p } = await page(browser, server, file, { width, height: 844, theme: 'dark' });
          try {
            await p.addScriptTag({ content: src });
            const v = await p.evaluate(async () => (await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2aa', 'wcag21aa', 'wcag22aa'] }, resultTypes: ['violations'] })).violations
              .filter(x => x.id === 'color-contrast').map(x => x.nodes.map(n => n.target.join(' ')).slice(0, 6)).flat());
            T.ok(v.length === 0, `${file} dark ${width} px: no colour-contrast failures ${v.length ? JSON.stringify(v.slice(0, 4)) : ''}`);
          } finally { await ctx.close(); }
        }
      }
    }

    // 8b. Dark mode: cards, inputs, selects and buttons are painted with site tokens, not one-off colours.
    for (const file of ['index.html', 'ap-biology.html', 'openscied-dashboard.html']) {
      const { ctx, p } = await page(browser, server, file, { width: 1366, height: 844, theme: 'dark' });
      try {
        const m = await p.evaluate(() => {
          const probe = v => { const d = document.createElement('div'); d.style.backgroundColor = v; document.body.append(d); const c = getComputedStyle(d).backgroundColor; d.remove(); return c; };
          const allowed = new Set(['--surface', '--surface-2', '--bg', '--accent', '--accent-soft', '--hero-link'].map(v => probe('var(' + v + ')')));
          const sel = '.dashboard-activity, .dashboard-student, .dashboard-resume, .activity-finder-form, .dashboard-aplink, .dashboard-masthead, .dashboard-preview, .bench-choice, .card, .bi, input[type="search"], select, .btn:not(.btn--primary), .dashboard-browse, .bench-welcome-brand, .bench-brandbar, .hero .btn--primary';
          const bad = [];
          for (const el of document.querySelectorAll(sel)) {
            const r = el.getBoundingClientRect(); if (r.width === 0 || r.height === 0) continue;
            const bg = getComputedStyle(el).backgroundColor;
            if (/^rgba\(0, 0, 0, 0\)$/.test(bg) || allowed.has(bg)) continue;
            bad.push((el.className && String(el.className).split(' ')[0]) || el.tagName.toLowerCase());
          }
          return [...new Set(bad)];
        });
        T.ok(m.length === 0, `${file} dark: cards, inputs, selects and buttons use site surface and accent tokens ${m.length ? 'off-token: ' + m.join(', ') : ''}`);
      } finally { await ctx.close(); }
    }

    // 9. Guards: footer credit, the not-official notice, and no sideways scroll.
    for (const file of ['index.html', 'ap-biology.html', 'openscied-dashboard.html']) {
      for (const width of [390, 768, 1366, 1920]) {
        const { ctx, p } = await page(browser, server, file, { width, height: 844 });
        try {
          const m = await p.evaluate(() => ({
            footer: (document.querySelector('footer.site-footer .credit, footer.site-footer strong') || {}).textContent || '',
            over: document.documentElement.scrollWidth - document.documentElement.clientWidth,
            body: document.body.innerText
          }));
          if (width === 390) T.ok(/^Created by Robert Smitka\./.test(m.footer.trim()) && /Privacy|privacy|stay in this browser/.test(m.body), `${file}: footer credit and privacy line are present`);
          T.ok(m.over <= 0, `${file} ${width} px: no sideways scroll`);
        } finally { await ctx.close(); }
      }
    }
    {
      const { ctx, p } = await page(browser, server, 'openscied-dashboard.html', { width: 1366, height: 844 });
      try {
        const text = await p.evaluate(() => document.body.innerText);
        T.ok(/not official OpenSciEd materials/.test(text) && /not affiliated with, endorsed by, or sponsored by OpenSciEd/i.test(text),
          'openscied-dashboard: the not-official and not-affiliated notices are still shown');
      } finally { await ctx.close(); }
    }
  } finally { await browser.close(); server.close(); }
  T.done('t115-site-polish');
})().catch(error => { console.error(error); process.exitCode = 1; });
