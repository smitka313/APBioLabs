/* Usability item 4: printable directions honor the saved theme (aplab:pref:theme) like the other pages, and print black on white.
   Missing value = dark (site default); auto follows the computer.
   Run: NODE_PATH=$(npm root -g) node tests/t117-usability-directions-theme.js */
const T = require('./_h');
const lum = rgb => { const m = rgb.match(/[\d.]+/g).slice(0, 3).map(Number).map(c => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }); return 0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]; };
(async () => {
  const browser = await T.launch(), server = await T.serve();
  try {
    const pages = ['directions-lab01.html', 'student-directions.html'];
    const cases = [['dark', 'dark', false], ['light', 'light', true], ['auto', null, false], [null, 'dark', false]];
    for (const page of pages) {
      for (const [pref, expectAttr, osDark] of cases) {
        const ctx = await T.ctxFor(browser, { width: 1024, height: 800, dark: osDark }), p = await ctx.newPage();
        await p.route(/gc\.zgo\.at|fonts\./, r => r.fulfill({ status: 200, body: '' }));
        if (pref) await p.addInitScript(v => { try { if (!sessionStorage.getItem('__pref')) { localStorage.setItem('aplab:pref:theme', v); sessionStorage.setItem('__pref', '1'); } } catch (e) { /* storage blocked */ } }, pref);
        else await p.addInitScript(() => { try { if (!sessionStorage.getItem('__pref')) { localStorage.removeItem('aplab:pref:theme'); sessionStorage.setItem('__pref', '1'); } } catch (e) { /* storage blocked */ } });
        await p.goto(server.url + page); await p.waitForTimeout(400);
        const m = await p.evaluate(() => ({ attr: document.documentElement.getAttribute('data-theme'), bg: getComputedStyle(document.documentElement).backgroundColor, paper: getComputedStyle(document.querySelector('main')).backgroundColor, ink: getComputedStyle(document.querySelector('h1')).color }));
        const tag = page + ' pref=' + (pref || 'missing') + (osDark ? ' OS dark' : '');
        T.ok((m.attr === expectAttr) || (expectAttr === null && m.attr === null), tag + ': data-theme is ' + JSON.stringify(m.attr) + ' (expected ' + JSON.stringify(expectAttr) + ')');
        const isDark = lum(m.bg) < 0.05;
        const wantDark = pref === 'dark' || (pref === null) || (pref === 'auto' && osDark);
        T.ok(isDark === wantDark, tag + ': page background is ' + (isDark ? 'dark' : 'light') + ' (' + m.bg + ')');
        if (pref === 'dark') {
          await p.emulateMedia({ media: 'print' }); await p.waitForTimeout(200);
          const pr = await p.evaluate(() => ({ bg: getComputedStyle(document.documentElement).backgroundColor, body: getComputedStyle(document.body).backgroundColor, main: getComputedStyle(document.querySelector('main')).backgroundColor, ink: getComputedStyle(document.querySelector('h1')).color, para: getComputedStyle(document.querySelector('main p') || document.querySelector('p')).color }));
          T.ok([pr.bg, pr.body, pr.main].every(c => /255, 255, 255|transparent|rgba\(0, 0, 0, 0\)/.test(c) || lum(c) > 0.95), tag + ': print background is white (' + pr.bg + ' / ' + pr.main + ')');
          T.ok(lum(pr.ink) < 0.02 && lum(pr.para) < 0.05, tag + ': print text is black (' + pr.ink + ', ' + pr.para + ')');
        }
        await ctx.close();
      }
    }
  } finally { await browser.close(); server.close(); }
  T.done('t117-usability-directions-theme');
})().catch(e => { console.error(e); process.exitCode = 1; });
