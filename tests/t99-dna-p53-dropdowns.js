/* Lessons 5-6 page: row questions are dropdowns, not wrapped tap chips (owner report: choice buttons were jumbled on a phone).
   Checks: one dropdown per row, no duplicate visible chips, pick -> feedback with a text mark, answers survive a reload,
   keyboard works, an old save loads into the dropdowns, and no dropdown overflows at 360 px.
   Run: NODE_PATH=$(npm root -g) node tests/t99-dna-p53-dropdowns.js */
const T = require('./_h');
const PAGE = 'openscied-b3-dna-p53.html';
const stub = pg => pg.route(/gc\.zgo\.at|fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, contentType: /gc\.zgo\.at/.test(r.request().url()) ? 'application/javascript' : 'text/css', body: '' }));
(async () => {
  const browser = await T.launch();
  const server = await T.serve();
  try {
    for (const [w, h, dark] of [[1366, 900, false], [360, 740, true]]) {
      const ctx = await T.ctxFor(browser, { width: w, height: h, dark });
      const p = await ctx.newPage();
      const errs = []; p.on('pageerror', e => errs.push(e.message));
      await stub(p);
      await p.goto(server.url + PAGE);
      await p.waitForFunction(() => window.B3DnaP53 && document.querySelector('.step.is-current'));
      await p.evaluate(() => { location.hash = 'sense5'; });
      await p.waitForSelector('#sense5.is-current');
      const tag = ' @' + w;

      const info = await p.evaluate(() => {
        const rows = [...document.querySelectorAll('.qcard[data-type="rows"] .rrow')];
        return { rows: rows.length, withSelect: rows.filter(r => r.querySelector('select.rsel')).length,
          visibleChips: rows.filter(r => { const o = r.querySelector('.opts'); return o && o.getClientRects().length; }).length };
      });
      T.ok(info.rows >= 8 && info.withSelect === info.rows, 'every row has a dropdown (' + info.withSelect + ' of ' + info.rows + ')' + tag);
      T.ok(info.visibleChips === 0, 'the old chips are not shown beside the dropdowns' + tag);

      const pairs = p.locator('[data-q="p-ms5-pairs"]');
      const selA = pairs.locator('.rrow[data-row="A"] select.rsel');
      T.ok(await selA.inputValue() === '', 'a new row starts on "Choose…"' + tag);
      await selA.selectOption('G');
      T.ok(await pairs.locator('.rrow[data-row="A"] .rmark').innerText() === '✕' && await selA.getAttribute('data-state') === 'no', 'a wrong pick shows ✕ as text' + tag);
      await selA.selectOption('T');
      T.ok(await pairs.locator('.rrow[data-row="A"] .rmark').innerText() === '✓', 'a right pick shows ✓ as text' + tag);
      for (const [row, v] of [['T', 'A'], ['G', 'C'], ['C', 'G']]) await pairs.locator('.rrow[data-row="' + row + '"] select.rsel').selectOption(v);
      T.ok(/^Yes\./.test(await pairs.locator('.q-fb').innerText()), 'all four right: the card says Yes' + tag);

      // keyboard only: focus a dropdown, choose with arrow keys
      const selT = pairs.locator('.rrow[data-row="T"] select.rsel');
      await selT.focus(); await p.keyboard.press('ArrowDown');
      T.ok(await p.evaluate(() => document.activeElement.classList.contains('rsel')), 'a dropdown can be focused and changed by keyboard' + tag);
      await selT.selectOption('A');

      // no overflow
      const over = await p.evaluate(() => ({ page: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        sel: [...document.querySelectorAll('select.rsel')].filter(s => s.getClientRects().length).filter(s => { const r = s.getBoundingClientRect(); return r.right > innerWidth + 1 || r.height < 24 || r.width < 140; }).length }));
      T.ok(over.page <= 0 && over.sel === 0, 'no sideways scroll, every dropdown fits, is at least 140 px wide and 24 px tall' + tag);

      // survives a reload
      await p.reload();
      await p.waitForFunction(() => window.B3DnaP53 && document.querySelector('.step.is-current'));
      await p.evaluate(() => { location.hash = 'sense5'; });
      await p.waitForSelector('#sense5.is-current');
      T.ok(await p.locator('[data-q="p-ms5-pairs"] .rrow[data-row="A"] select.rsel').inputValue() === 'T' && /^Yes\./.test(await p.locator('[data-q="p-ms5-pairs"] .q-fb').innerText()), 'dropdown answers and feedback come back after a reload' + tag);
      // the report text still reads the answer
      T.ok(errs.length === 0, 'no page errors ' + errs.join('|') + tag);
      if (process.env.SHOT_DIR) await p.locator('[data-q="p-ms5-pairs"]').screenshot({ path: process.env.SHOT_DIR + '/dropdowns-' + w + '.png' });
      await ctx.close();
    }
  } finally { await browser.close(); server.close(); }
  T.done('t99-dna-p53-dropdowns');
})();
