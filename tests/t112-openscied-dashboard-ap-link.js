/* OpenSciEd has a visible AP Lab Bench return in the masthead and an explanatory
   reciprocal AP card after the activity grid.
   Run: NODE_PATH=$(npm root -g) node tests/t112-openscied-dashboard-ap-link.js */
const T = require('./_h');
(async () => {
  const browser = await T.launch(), server = await T.serve();
  try {
    for (const [width, dark] of [[375, true], [768, false], [1366, false], [1920, false]]) {
      const ctx = await T.ctxFor(browser, { width, height: 900, dark });
      try {
        const p = await ctx.newPage();
        await p.route(/gc\.zgo\.at|fonts\./, r => r.fulfill({ status: 200, body: '' }));
        await p.goto(server.url + 'openscied-dashboard.html');
        const back = p.locator('.dashboard-masthead a.bench-cross-route');
        await back.waitFor();
        await p.locator('.skip-link').focus();
        await p.keyboard.press('Tab');
        await p.keyboard.press('Tab');
        const m = await back.evaluate(link => {
          const card = document.querySelector('.dashboard-aplink'), btn = card?.querySelector('a.btn--primary');
          const ws = document.querySelector('.dashboard-student'), activities = document.querySelector('#activities');
          const r = e => e.getBoundingClientRect(), style = getComputedStyle(link);
          const lum = rgb => {
            const n = rgb.match(/[\d.]+/g)?.map(Number) || [];
            if (n.length < 3 || (n.length === 4 && n[3] < 1)) return null;
            return n.slice(0,3).map(v=>v/255).map(v=>v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4))
              .reduce((total,v,i)=>total+v*[.2126,.7152,.0722][i],0);
          };
          // The non-current course is an ordinary link on the masthead background.
          const current = link.closest('nav').querySelector('[aria-current="page"]');
          const masthead = link.closest('.dashboard-masthead');
          const a=lum(style.backgroundColor) ?? lum(getComputedStyle(masthead).backgroundColor), b=lum(style.color);
          const contrast = a===null||b===null ? 0 : (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
          return {
            activeTreatment:current && current.textContent==='OpenSciEd' &&
              lum(style.backgroundColor)===null && lum(getComputedStyle(current).backgroundColor)!==null,
            backHref:link.getAttribute('href'), backH:r(link).height, contrast, focused:document.activeElement===link,
            backInView:r(link).top>=0 && r(link).bottom<=innerHeight,
            beforeWorkspace:!!(ws && (link.compareDocumentPosition(ws)&Node.DOCUMENT_POSITION_FOLLOWING)),
            cardHref:btn?.getAttribute('href'), cardText:card?.innerText || '', btnH:btn&&r(btn).height,
            belowActivities:!!(card && activities && r(card).top >= r(activities).bottom-1),
            heading:!!card?.querySelector('h2'), over:document.documentElement.scrollWidth-document.documentElement.clientWidth
          };
        });
        T.ok(m.backHref === 'ap-biology.html' && m.backH >= 38 && m.contrast >= 4.5 && m.backInView,
          width + ' px: AP return is visible in the masthead (' + Math.round(m.backH) + ' px, ' + m.contrast.toFixed(2) + ':1 contrast)');
        T.ok(m.activeTreatment, width + ' px: only the current course has a filled pill');
        T.ok(m.focused && m.beforeWorkspace, width + ' px: Tab reaches the AP return before the student workspace');
        T.ok(m.cardHref === 'ap-biology.html' && /AP Bio/.test(m.cardText) && /13/.test(m.cardText) && m.heading && m.btnH >= 40 && m.belowActivities,
          width + ' px: below the activity grid, a dedicated card explains there are 13 AP labs and links to them');
        T.ok(m.over <= 0, width + ' px: no sideways scroll');
      } finally { await ctx.close(); }
    }
  } finally { await browser.close(); server.close(); }
  T.done('t112-openscied-dashboard-ap-link');
})().catch(error => { console.error(error); process.exitCode = 1; });
