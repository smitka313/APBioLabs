/* Download and narrow-screen checks; no native print dialog is opened. */
const T = require('./_h');
const fs = require('node:fs');
const path = require('node:path');
(async () => {
  const server = await T.serve();
  let b;
  try {
    b = await T.launch();
    for (const javaScriptEnabled of [true, false]) {
      const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, javaScriptEnabled });
      if (javaScriptEnabled) await ctx.addInitScript(() => {
        window.__prints = 0;
        window.print = () => { window.__prints++; };
      });
      const p = await ctx.newPage(), errors = [];
      p.on('pageerror', e => errors.push(e.message));
      for (let number = 1; number <= 13; number++) {
        const id = String(number).padStart(2, '0');
        await p.goto(server.url + 'directions-lab' + id + '.html');
        const state = await p.evaluate(() => {
          const a = document.querySelector('.pdf-download'), r = a.getBoundingClientRect();
          return { overflow: document.documentElement.scrollWidth - innerWidth,
            height: r.height, fits: r.left >= 0 && r.right <= innerWidth,
            printHidden: document.getElementById('print-directions').hidden,
            prints: window.__prints || 0 };
        });
        const label = `Lab ${number}, JavaScript ${javaScriptEnabled ? 'on' : 'off'}`;
        T.ok(state.overflow <= 1 && state.fits && state.height >= 44, label + ': PDF control fits a 390px screen with a 44px touch target');
        T.ok(state.printHidden === !javaScriptEnabled && state.prints === 0, label + ': print UI is progressive and does not auto-print');
        const downloading = p.waitForEvent('download');
        await p.locator('.pdf-download').click();
        const download = await downloading;
        const bytes = fs.readFileSync(await download.path());
        T.ok(download.suggestedFilename() === 'directions-lab' + id + '.pdf' &&
          bytes.equals(fs.readFileSync(path.join(T.ROOT, 'student-pdfs', 'directions-lab' + id + '.pdf'))),
          label + ': downloads the matching complete PDF');
        T.ok(await p.evaluate(() => (window.__prints || 0) === 0), label + ': PDF download does not invoke window.print');
      }
      await p.goto(server.url + 'student-directions.html');
      T.ok(await p.locator('.catalog-pdf').count() === 13, 'index: all 13 PDF links exist with JavaScript ' + javaScriptEnabled);
      T.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'index: no sideways page scrolling with JavaScript ' + javaScriptEnabled);
      T.ok(errors.length === 0, 'guides: no page errors ' + errors.join('; '));
      await ctx.close();
    }
    T.done('student PDF downloads and mobile guides');
  } finally {
    if (b) await b.close();
    await server.close();
  }
})();
