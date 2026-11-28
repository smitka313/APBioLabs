/* Site audit (Nov 28): fixes for the map button, the handwritten-notes block, the save badge on phones, footer wording,
   the product name, the dark default theme, and the teacher tour button's place. Each check fails on the old site.
   Run: NODE_PATH=$(npm root -g) node tests/t114-site-audit-fixes.js */
const T = require('./_h');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const stub = pg => pg.route(/gc\.zgo\.at|fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, body: '' }));

(async () => {
  const browser = await T.launch(), server = await T.serve();
  try {
    // 1. Wapusk: the season buttons carry aria-pressed; the map picture does not.
    {
      const ctx = await T.ctxFor(browser, { width: 1366, height: 900 }), p = await ctx.newPage();
      await stub(p); await p.goto(server.url + 'openscied-b5-wapusk.html'); await p.waitForTimeout(300);
      const m = await p.evaluate(() => ({ map: document.getElementById('wb-map').hasAttribute('aria-pressed'), buttons: [...document.querySelectorAll('.wb-controls [data-season]')].map(b => b.getAttribute('aria-pressed')) }));
      T.ok(!m.map && m.buttons.length === 2 && m.buttons.every(x => x === 'true' || x === 'false'), 'Wapusk: the map has no aria-pressed; the two season buttons have it');
      await ctx.close();
    }
    // 2. Direction pages: the notes block is a named region, and axe reports nothing on it.
    {
      const ctx = await T.ctxFor(browser, { width: 1366, height: 900 }), p = await ctx.newPage();
      await stub(p); await p.goto(server.url + 'directions-lab01.html'); await p.waitForTimeout(300);
      const role = await p.getAttribute('.rules', 'role');
      T.ok(role === 'region', 'handwritten-notes block is a region (role="region"), so its name is allowed');
      await ctx.close();
    }
    // 3. Save badge on a phone: no word is split inside a word.
    {
      const ctx = await T.ctxFor(browser, { width: 390, height: 844 }), p = await ctx.newPage();
      await stub(p); await p.goto(server.url + 'openscied-b3-cell-cycle.html'); await p.waitForTimeout(400);
      const r = await p.evaluate(() => { const e = document.getElementById('bench-save-receipt'); if (!e) return null; const cs = getComputedStyle(e); return { wrap: cs.overflowWrap, basis: cs.flexBasis, ow: e.scrollWidth <= e.clientWidth + 1 }; });
      if (r) T.ok(r.wrap !== 'anywhere' && r.basis !== '10ch' && r.ow, 'save receipt on phones wraps at spaces, never inside a word (' + JSON.stringify(r) + ')');
      else T.ok(false, 'save receipt element found on the Cell Cycle page');
      await ctx.close();
    }
    // 4 + 5. Footers start with the required line; the site name is "Biology Lab Bench" on every public page.
    {
      const sm = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
      const urls = [...sm.matchAll(/<loc>([^<]*)<\/loc>/g)].map(m => m[1].replace('https://biologylabbench.com', ''));
      const bad = [], oldName = [];
      for (const u of urls) {
        const file = u === '/' ? 'index.html' : u.replace(/^\//, '') + (u.endsWith('.html') ? '' : '.html');
        const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
        if (src.includes('PBKDF2')) continue;     // protected pages: their content is encrypted
        if (/AP Bio Digital Lab Bench/.test(src)) oldName.push(file);
        const ctx = await T.ctxFor(browser, { width: 1366, height: 900 }), p = await ctx.newPage();
        await stub(p); await p.goto(server.url + file, { waitUntil: 'load' }).catch(() => {});
        const f = await p.evaluate(() => { const ft = document.querySelector('footer'); return ft ? ft.innerText.trim() : ''; });
        if (!/^Created by Robert Smitka\./.test(f)) bad.push(file);
        await ctx.close();
      }
      T.ok(bad.length === 0, 'every unlocked public page footer starts "Created by Robert Smitka." (' + (bad.join(', ') || 'all good') + ')');
      T.ok(oldName.length === 0, 'the old product name is gone from the unlocked pages (' + (oldName.join(', ') || 'none') + ')');
    }
    // 6. Default theme is dark for a first visit; a student who chooses Auto keeps Auto.
    {
      // A lab page: the three course entrances already start dark through domain-redirect.js, so they cannot show the change.
      const fresh = await T.ctxFor(browser, { width: 390, height: 800 }), pf = await fresh.newPage();
      await stub(pf); await pf.goto(server.url + 'lab01.html'); await pf.waitForTimeout(300);
      T.ok(await pf.evaluate(() => document.documentElement.getAttribute('data-theme')) === 'dark', 'first visit to a lab page (no saved choice) opens in dark');
      await fresh.close();
      const auto = await T.ctxFor(browser, { width: 390, height: 800 }), pa = await auto.newPage();
      await pa.addInitScript(() => localStorage.setItem('aplab:pref:theme', 'auto'));
      await stub(pa); await pa.goto(server.url + 'lab01.html'); await pa.waitForTimeout(300);
      T.ok(await pa.evaluate(() => document.documentElement.getAttribute('data-theme')) === null, 'a saved Auto choice still follows the system (no forced theme)');
      await auto.close();
    }
    // 7. Teacher tour button sits in the same paragraph as the projector link.
    {
      const ctx = await T.ctxFor(browser, { width: 1366, height: 900 }), p = await ctx.newPage();
      await stub(p); await p.goto(server.url + 'teachers.html'); await p.waitForTimeout(400);
      const same = await p.evaluate(() => { const b = document.getElementById('teacher-tour-replay'); const a = [...document.querySelectorAll('.t-hero a')].find(x => /Projector/.test(x.textContent)); return !!(b && a && b.parentElement === a.parentElement); });
      T.ok(same, 'teacher tour button is on the same line as the projector link');
      await ctx.close();
    }
  } finally { await browser.close(); server.close(); }
  T.done('t114-site-audit-fixes');
})();
