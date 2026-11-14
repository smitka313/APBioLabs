/* Audit 4 shared UI: #1 bar-chart labels never break inside a number/range; #5/#6 "Preview my report" is always in Submit;
   #5 the "Save progress file" bar reserves room at the page bottom; #7 a toast points at Replay / GIF after the first recorded run.
   Run: NODE_PATH=$(npm root -g) node tests/t57-audit4-shared.js */
const T = require('./_h');
(async () => {
  const b = await T.launch(), ctx = await T.ctxFor(b, { reduced: true });
  const p = await ctx.newPage(); p.errors = [];
  p.on('pageerror', e => p.errors.push(e.message));
  await p.clock.install({ time: new Date('2026-11-13T09:00:00') });
  await p.goto('file://' + T.ROOT + '/lab01.html'); await p.waitForTimeout(700);

  // #1 narrow chart with range labels
  const r = await p.evaluate(() => {
    const d = document.createElement('div'); d.style.width = '330px'; document.body.append(d);
    const cats = ['0–4', '5–9', '10–14', '15–19', '20–24', '25–29', '30–34', '35–39'];
    Lab.chart(d, { type: 'bar', responsive: true, xLabel: 'Hairs', yLabel: 'Plants', categories: cats, series: [{ name: 'n', points: cats.map((c, i) => ({ x: c, y: i + 1 })) }] });
    const tx = Array.from(d.querySelectorAll('svg text')).map(t => t.textContent);
    return { tx, hasAll: cats.every(c => tx.includes(c)), tspans: Array.from(d.querySelectorAll('svg tspan')).map(t => t.textContent).filter(t => /\d/.test(t)) };
  });
  console.log(JSON.stringify(r.tx.slice(0, 12)));
  T.ok(r.hasAll, '#1 every range label is drawn whole ("10–14" etc.), none split across lines');
  T.ok(!r.tspans.length, '#1 no multi-line tspans split a number');

  // #6 preview button in Submit
  await p.evaluate(() => Lab.pages.go('submit')); await p.waitForTimeout(400);
  T.ok(await p.locator('.report-bar .report-preview-btn').count() === 1, '#6 "Preview my report" is in the Submit tools');
  await p.click('.report-preview-btn'); await p.waitForTimeout(1200);
  T.ok(await p.locator('#lab-report .rv-paper').count() === 1, '#6 it opens the report preview');
  await p.click('#lab-report .rv-tools .btn >> text=Close report'); await p.waitForTimeout(300);
  await p.click('.transfer-btn'); await p.waitForTimeout(1500);
  T.ok(await p.locator('.report-preview-btn').isVisible(), '#5 preview button still there after opening the transfer panel');
  await p.click('.report-preview-btn'); await p.waitForTimeout(1000);
  T.ok(await p.locator('#lab-report .rv-paper').count() === 1, '#5 preview still opens after the transfer panel');
  await p.click('#lab-report .rv-tools .btn >> text=Close report');

  // #5 banner never covers the bottom of the page
  const ids = await p.evaluate(() => Array.from(document.querySelectorAll('textarea[data-save]')).filter(t => !t.closest('.id-box')).slice(0, 3).map(t => t.id));
  await p.evaluate(() => Lab.pages.showAll && Lab.pages.showAll(true)); await p.waitForTimeout(300);
  for (const id of ids) await p.fill('#' + id, 'Some real thinking');
  await p.clock.fastForward(10000); await p.clock.runFor(4000); await p.waitForTimeout(400);
  const bar = await p.evaluate(() => !!document.querySelector('.backup-bar:not(.nudge-bar)'));
  T.ok(bar, '#5 the Save progress file bar shows after unsaved work');
  await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); await p.waitForTimeout(300);
  const ov = await p.evaluate(() => {
    const bb = document.querySelector('.backup-bar').getBoundingClientRect();
    const els = Array.from(document.body.children).filter(e => !e.matches('.backup-bar,.toasts,script,.tour,.dm-scrim') && e.getBoundingClientRect().height);
    return { barTop: bb.top, contentBottom: Math.max(...els.map(e => e.getBoundingClientRect().bottom)), pad: getComputedStyle(document.body).paddingBottom };
  });
  T.ok(ov.contentBottom <= ov.barTop + 1, `#5 page content ends above the bar (content ${Math.round(ov.contentBottom)} <= bar top ${Math.round(ov.barTop)}, body padding ${ov.pad})`);

  // #7 toast after first recorded run
  await p.evaluate(async () => {
    const cv = document.createElement('canvas'); cv.width = 200; cv.height = 100; cv.id = 'tl-test'; const host = document.createElement('div'); host.id = 'tl-host'; document.body.append(cv, host);
    const c = cv.getContext('2d'); window.__rec = Lab.timelapse(cv, { key: 'tltest', label: 'Test run', fps: 20 }); window.__rec.mount(host);
    window.__rec.start(); let i = 0; window.__iv = setInterval(() => { c.fillStyle = 'hsl(' + (i++ * 30) + ',70%,50%)'; c.fillRect(0, 0, 200, 100); }, 20);
  });
  await p.clock.runFor(1500); await p.evaluate(async () => { clearInterval(window.__iv); await window.__rec.stop(); }); await p.waitForTimeout(500);
  const toast = await p.evaluate(() => Array.from(document.querySelectorAll('.toast')).map(t => t.textContent));
  T.ok(toast.some(t => /recorded/i.test(t) && /replay/i.test(t) && /GIF/i.test(t)), '#7 toast "Your run was recorded. Replay it or download a GIF" after the first recorded run');
  T.ok(await p.locator('.toast-action', { hasText: 'Show me' }).count() === 1, '#7 toast has a "Show me" action');
  T.ok(!p.errors.length, 'no page errors ' + p.errors.join('|'));
  await b.close(); T.done('t57');
})();
