/* The AP Bio home page advertises the OpenSciEd companions in two places: a prominent button in the hero and a band after the lab list.
   Run: NODE_PATH=$(npm root -g) AXE=<path>/axe.min.js node tests/t113-home-openscied-link.js */
const T = require('./_h');
const fs = require('fs');
(async () => {
  const browser = await T.launch(), server = await T.serve();
  try {
    for (const [width, dark] of [[375, true], [768, false], [1366, false], [1920, false]]) {
      const ctx = await T.ctxFor(browser, { width, height: 900, dark }), p = await ctx.newPage();
      await p.route(/gc\.zgo\.at|fonts\./, r => r.fulfill({ status: 200, body: '' }));
      await p.goto(server.url + 'index.html'); await p.waitForTimeout(700);
      const m = await p.evaluate(() => {
        const hero = document.querySelector('.hero .openscied-teaser'), band = document.querySelector('.os-band'), btn = band && band.querySelector('a.btn--primary');
        const r = e => e.getBoundingClientRect();
        return { heroHref: hero && hero.getAttribute('href'), heroText: hero ? hero.innerText : '', heroH: hero && r(hero).height, heroBg: hero && getComputedStyle(hero).backgroundColor,
          bandHref: btn && btn.getAttribute('href'), bandText: band ? band.innerText : '', bandH: btn && r(btn).height, h2: !!(band && band.querySelector('h2')),
          bandAfterLabs: !!(band && document.querySelector('.bi .cards') && (document.querySelector('.bi .cards').compareDocumentPosition(band) & Node.DOCUMENT_POSITION_FOLLOWING)),
          over: document.documentElement.scrollWidth - document.documentElement.clientWidth };
      });
      T.ok(m.heroHref === 'openscied-dashboard.html' && /OpenSciEd/.test(m.heroText) && m.heroH >= 44 && m.heroBg !== 'rgba(0, 0, 0, 0)', width + ' px: hero button is a solid 44 px+ button to the OpenSciEd dashboard (' + Math.round(m.heroH) + ' px)');
      T.ok(m.bandHref === 'openscied-dashboard.html' && /Units 2 and 3/.test(m.bandText) && /not official/.test(m.bandText) && m.h2 && m.bandH >= 44 && m.bandAfterLabs, width + ' px: a band after the lab list names Units 2 and 3, says it is not official, and links to the dashboard');
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
