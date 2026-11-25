/* The AP Biology dashboard links to the OpenSciEd course in the masthead and in a dedicated band after the lab list.
   Run: NODE_PATH=$(npm root -g) AXE=<path>/axe.min.js node tests/t113-home-openscied-link.js */
const T = require('./_h');
const fs = require('fs');
(async () => {
  const browser = await T.launch(), server = await T.serve();
  try {
    for (const [width, dark] of [[375, true], [768, false], [1366, false], [1920, false]]) {
      const ctx = await T.ctxFor(browser, { width, height: 900, dark }), p = await ctx.newPage();
      await p.route(/gc\.zgo\.at|fonts\./, r => r.fulfill({ status: 200, body: '' }));
      await p.goto(server.url + 'ap-biology.html'); await p.waitForTimeout(700);
      const m = await p.evaluate(() => {
        const hero = document.querySelector('.bench-brandbar nav a.bench-cross-route'), band = document.querySelector('.os-band'), btn = band && band.querySelector('a.btn--primary');
        const r = e => e.getBoundingClientRect();
        const masthead = document.querySelector('.bench-brandbar');
        const active = document.querySelector('.bench-brandbar nav [aria-current="page"]');
        return { heroHref: hero && hero.getAttribute('href'), heroText: hero ? hero.innerText : '', heroH: hero && r(hero).height, heroBg: hero && getComputedStyle(hero).backgroundColor,
          heroColor: hero && getComputedStyle(hero).color, mastheadBg: getComputedStyle(masthead).backgroundColor,
          activeBg: active && getComputedStyle(active).backgroundColor, activeHref: active && active.getAttribute('href'),
          bandHref: btn && btn.getAttribute('href'), bandText: band ? band.innerText : '', bandH: btn && r(btn).height, h2: !!(band && band.querySelector('h2')),
          bandAfterLabs: !!(band && document.querySelector('.bi .cards') && (document.querySelector('.bi .cards').compareDocumentPosition(band) & Node.DOCUMENT_POSITION_FOLLOWING)),
          over: document.documentElement.scrollWidth - document.documentElement.clientWidth };
      });
      const luma = color => {
        const rgb = color.match(/[\d.]+/g).slice(0, 3).map(n => {
          const c = Number(n) / 255;
          return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
        });
        return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
      };
      const values = [luma(m.heroColor), luma(m.mastheadBg)].sort((a, b) => b - a);
      const contrast = (values[0] + 0.05) / (values[1] + 0.05);
      T.ok(m.heroHref === 'openscied-dashboard.html' && /OpenSciEd/.test(m.heroText) && m.heroH >= 40 && contrast >= 4.5, width + ' px: readable 40 px+ masthead link to OpenSciEd (' + Math.round(m.heroH) + ' px; ' + contrast.toFixed(2) + ':1)');
      T.ok(m.heroBg === 'rgba(0, 0, 0, 0)' && m.activeHref === 'ap-biology.html' && m.activeBg && m.activeBg !== 'rgba(0, 0, 0, 0)', width + ' px: only the current AP course has a filled pill');
      T.ok(m.bandHref === 'openscied-dashboard.html' && /Units 1–5/.test(m.bandText) && /not official/.test(m.bandText) && m.h2 && m.bandH >= 44 && m.bandAfterLabs, width + ' px: a band after the lab list names Units 1–5, says it is not official, and links to the dashboard');
      T.ok(m.over <= 0, width + ' px: no sideways scroll');
      if (process.env.AXE && width !== 768) {
        await p.addScriptTag({ content: fs.readFileSync(process.env.AXE, 'utf8') });
        const v = await p.evaluate(async () => (await axe.run(document, { runOnly: ['wcag2a', 'wcag2aa'] })).violations.map(x => x.id + ':' + x.nodes.length));
        T.ok(v.length === 0, width + ' px: axe clean on the home page ' + v.join(','));
      }
      await ctx.close();
    }
  } finally { await browser.close(); server.close(); }
  T.done('t113-home-openscied-link');
})();
