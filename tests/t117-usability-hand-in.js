/* Usability item 1: the Submit step opens with one numbered "Hand in" box, the progress note is secondary,
   Start over sits in its own section (same confirmation dialog), and the report buttons keep their ids.
   Run: NODE_PATH=$(npm root -g) node tests/t117-usability-hand-in.js */
const T = require('./_h');
(async () => {
  const browser = await T.launch(), server = await T.serve();
  try {
    for (const [width, dark] of [[1366, false], [390, true]]) {
      const ctx = await T.ctxFor(browser, { width, height: 900, dark }), p = await ctx.newPage();
      await p.route(/gc\.zgo\.at|fonts\./, r => r.fulfill({ status: 200, body: '' }));
      await p.goto(server.url + 'lab01.html#submit'); await p.waitForTimeout(700);
      await p.evaluate(() => document.querySelector('#submit').scrollIntoView());
      const m = await p.evaluate(() => {
        const sub = document.querySelector('#submit');
        const box = sub && sub.querySelector('.hand-in');
        const header = sub && sub.querySelector(':scope > header');
        const bar = sub && sub.querySelector('.report-bar');
        const startBtn = sub && sub.querySelector('.btn-startover');
        const prog = sub && sub.querySelector('.submit-progress');
        const follows = (a, b) => !!(a && b && (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING));
        return {
          hasBox: !!box,
          items: box ? Array.from(box.querySelectorAll('ol > li')).map(li => li.textContent.trim()) : [],
          boxIsNumbered: !!(box && box.querySelector('ol')),
          boxAfterHeader: follows(header, box),
          boxBeforeReportBar: follows(box, bar),
          wordBtn: !!sub.querySelector('#lab-report-download-word'),
          pdfBtn: !!sub.querySelector('#lab-report-print-pdf'),
          startText: startBtn ? startBtn.textContent.trim() : null,
          startInReportBar: !!(startBtn && startBtn.closest('.responses-bar, .report-bar')),
          startSection: !!(startBtn && startBtn.closest('.start-over-section')),
          progressAfterBar: follows(bar, prog),
          progressText: prog ? prog.textContent : '',
          startTop: startBtn ? startBtn.getBoundingClientRect().top : 0,
          barTop: bar ? bar.getBoundingClientRect().top : 0,
        };
      });
      const tag = width + 'px' + (dark ? ' dark' : ' light');
      T.ok(m.hasBox, 'Hand in box exists at the top of Submit (' + tag + ')');
      T.ok(m.boxIsNumbered && m.items.length === 2, 'Hand in box is a two-step numbered list (' + tag + ')');
      T.ok(m.items[0] === 'Download the Word report or save the PDF.', 'step 1 wording (' + tag + '): ' + m.items[0]);
      T.ok(m.items[1] === 'Upload or share it where your teacher directs. Downloading does not submit it.', 'step 2 wording (' + tag + ')');
      T.ok(m.boxAfterHeader && m.boxBeforeReportBar, 'Hand in box sits after the Submit heading and before the report buttons (' + tag + ')');
      T.ok(m.wordBtn && m.pdfBtn, 'report button ids #lab-report-download-word and #lab-report-print-pdf are kept (' + tag + ')');
      T.ok(m.progressAfterBar && /This count is not a grade/.test(m.progressText), 'progress count is kept and placed below the report buttons (' + tag + ')');
      T.ok(m.startText === 'Start over' && m.startSection && !m.startInReportBar, 'Start over is in its own section, not beside the report buttons (' + tag + ')');
      T.ok(m.startTop > m.barTop, 'Start over is below the report buttons (' + tag + ')');
      if (width === 1366) {
        await p.locator('#submit .btn-startover').click(); await p.waitForTimeout(400);
        T.ok(await p.locator('.dm-card').count() === 1, 'Start over still opens the existing confirmation dialog');
        await p.keyboard.press('Escape'); await p.waitForTimeout(200);
      }
      await ctx.close();
    }
  } finally { await browser.close(); server.close(); }
  T.done('t117-usability-hand-in');
})().catch(e => { console.error(e); process.exitCode = 1; });
