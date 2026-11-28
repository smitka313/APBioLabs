/* Usability item 3: on phones the home page has a two-button course chooser directly under the hero intro, above the fold
   at 390 x 844. On desktop the two course cards already show, so the chooser is hidden there. The hero and cards are unchanged.
   Run: NODE_PATH=$(npm root -g) node tests/t117-usability-home-chooser.js */
const T = require('./_h');
(async () => {
  const browser = await T.launch(), server = await T.serve();
  try {
    for (const [width, height, dark] of [[390, 844, false], [390, 844, true], [768, 1024, false], [1366, 768, false]]) {
      const ctx = await T.ctxFor(browser, { width, height, dark }), p = await ctx.newPage();
      await p.route(/gc\.zgo\.at|fonts\./, r => r.fulfill({ status: 200, body: '' }));
      await p.goto(server.url + 'index.html'); await p.waitForTimeout(700);
      const m = await p.evaluate(() => {
        const nav = document.querySelector('.bench-quick-choose');
        const shown = !!nav && getComputedStyle(nav).display !== 'none';
        const links = nav ? Array.from(nav.querySelectorAll('a')).map(a => { const r = a.getBoundingClientRect(); return { text: a.textContent.trim(), href: a.getAttribute('href'), top: r.top, bottom: r.bottom, h: r.height }; }) : [];
        const lede = document.querySelector('.bench-hook');
        return { shown, links, ledeBottom: lede ? lede.getBoundingClientRect().bottom : 0,
          cards: document.querySelectorAll('.bench-choice').length, over: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          vh: window.innerHeight, choiceTop: Math.round(document.querySelector('.bench-choice').getBoundingClientRect().top),
          intro: document.querySelector('.bench-intro').textContent.replace(/\s+/g, ' ').trim().length };
      });
      const tag = width + 'x' + height + (dark ? ' dark' : ' light');
      T.ok(m.cards === 2 && m.over <= 0, 'course cards still present and no sideways scroll (' + tag + ')');
      T.ok(m.intro <= 160, 'hero intro copy is unchanged in length (' + m.intro + ' characters, ' + tag + ')');
      if (width <= 900) {
        const ap = m.links.find(l => l.text === 'AP Biology') || { top: NaN, bottom: NaN, href: '' };
        const os = m.links.find(l => l.text === 'OpenSciEd') || { top: NaN, bottom: NaN, href: '' };
        T.ok(m.shown && m.links.length === 2 && isFinite(ap.top) && isFinite(os.top), 'phone chooser has exactly two buttons, AP Biology and OpenSciEd (' + tag + ')');
        T.ok(ap.href === 'ap-biology.html' && os.href === 'openscied-dashboard.html', 'chooser links go to ap-biology.html and openscied-dashboard.html (' + tag + ')');
        T.ok(ap.top >= m.ledeBottom - 1 && Math.abs(ap.top - os.top) < 2, 'chooser sits directly under the hero intro (' + tag + ')');
        T.ok(ap.h >= 44 && os.h >= 44, 'chooser buttons are at least 44 px tall (' + tag + ')');
        if (width === 390) T.ok(Math.max(ap.bottom, os.bottom) <= m.vh, 'both chooser buttons are above the fold at 390 x 844 (' + tag + ', bottom ' + Math.round(Math.max(ap.bottom, os.bottom)) + ')');
      } else {
        T.ok(!m.shown, 'desktop: chooser hidden because both course cards show at once (' + tag + ')');
        T.ok(m.choiceTop < 520 || width < 1200, 'desktop: first course card still starts high (' + m.choiceTop + ' px, ' + tag + ')');
      }
      await ctx.close();
    }
  } finally { await browser.close(); server.close(); }
  T.done('t117-usability-home-chooser');
})().catch(e => { console.error(e); process.exitCode = 1; });
