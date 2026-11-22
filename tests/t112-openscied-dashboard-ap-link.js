/* The OpenSciEd dashboard points visitors back to the AP Bio Digital Lab Bench in two prominent places: a button in the top bar and a card near the top.
   Run: NODE_PATH=$(npm root -g) node tests/t112-openscied-dashboard-ap-link.js */
const T = require('./_h');
(async () => {
  const browser = await T.launch(), server = await T.serve();
  try {
    for (const [width, dark] of [[375, true], [768, false], [1366, false], [1920, false]]) {
      const ctx = await T.ctxFor(browser, { width, height: 900, dark }), p = await ctx.newPage();
      await p.route(/gc\.zgo\.at|fonts\./, r => r.fulfill({ status: 200, body: '' }));
      await p.goto(server.url + 'openscied-dashboard.html'); await p.waitForTimeout(600);
      const m = await p.evaluate(() => {
        const back = document.querySelector('.dashboard-back'), card = document.querySelector('.dashboard-aplink'), btn = card && card.querySelector('a.btn--primary'), ws = document.querySelector('.dashboard-student');
        const r = e => e.getBoundingClientRect(), bg = e => getComputedStyle(e).backgroundColor, fg = e => getComputedStyle(e).color;
        return { backHref: back && back.getAttribute('href'), backH: back && r(back).height, backBg: back && bg(back), backFg: back && fg(back),
          cardHref: btn && btn.getAttribute('href'), cardText: card ? card.innerText : '', btnH: btn && r(btn).height, cardTop: card && r(card).top + scrollY, wsTop: ws && r(ws).top + scrollY,
          heading: !!(card && card.querySelector('h2')), over: document.documentElement.scrollWidth - document.documentElement.clientWidth };
      });
      T.ok(m.backHref === 'index.html' && m.backH >= 38 && m.backBg !== 'rgba(0, 0, 0, 0)', width + ' px: the top-bar link is a filled button at least 38 px tall (' + Math.round(m.backH) + ' px)');
      T.ok(m.cardHref === 'index.html' && /AP Bio/.test(m.cardText) && /13/.test(m.cardText) && m.heading && m.btnH >= 40, width + ' px: a card near the top says there are 13 AP Bio labs and links to the lab bench');
      T.ok(m.cardTop < m.wsTop && m.cardTop < 900, width + ' px: the card comes before the student workspace and shows within the first screen height');
      T.ok(m.over <= 0, width + ' px: no sideways scroll');
      await ctx.close();
    }
  } finally { await browser.close(); server.close(); }
  T.done('t112-openscied-dashboard-ap-link');
})();
