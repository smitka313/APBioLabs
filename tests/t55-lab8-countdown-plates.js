/* Audit 3, Lab 8: (1) the recovery step shows a countdown in the Status tile and under the button, not only in the small button label;
   (2) the PLATES tile stops saying "Not yet plated" once the cells have been spread. LAB8_FILE overrides the page under test. */
const T = require('./_h');
(async () => {
  const b = await T.launch(), ctx = await T.ctxFor(b);
  const p = await T.open(ctx, process.env.LAB8_FILE || 'lab08.html', 'transform');
  const st = () => p.evaluate(() => ({ btn: document.querySelector('#do-step').textContent, card: document.querySelector('#step-card').textContent,
    status: document.querySelector('#ro-status').textContent, why: document.querySelector('#step-why').hidden ? '' : document.querySelector('#step-why').textContent,
    plates: [...document.querySelectorAll('#t-sim .readout')].filter(r => /^Plates/.test(r.textContent.trim())).map(r => r.textContent.replace(/\s+/g, ' ').trim()).join('') }));
  const idle = () => p.waitForFunction(() => !document.querySelector('#do-step').disabled && document.querySelector('#step-prog').hidden, null, { timeout: 60000 });
  for (let i = 0; i < 12; i++) {
    const s = await st();
    if (/Add LB/.test(s.card)) break;
    await p.evaluate(() => document.querySelector('#do-step').click()); await idle(); await p.waitForTimeout(150);
  }
  await p.evaluate(() => document.querySelector('#do-step').click());
  await p.waitForFunction(() => /Recovering… \d+ s/.test(document.querySelector('#do-step').textContent), null, { timeout: 20000 });
  await p.waitForTimeout(500);
  const a = await st(); await p.waitForTimeout(1500); const c = await st();
  console.log('recovery sample 1:', JSON.stringify([a.status, a.why.slice(0, 120)]));
  console.log('recovery sample 2:', JSON.stringify([c.status, c.why.slice(0, 120)]));
  T.ok(/\d.*left/.test(a.status) && /recover/i.test(a.status), 'Status tile shows a recovery countdown: "' + a.status + '"');
  T.ok(a.status !== c.status, 'the Status countdown changes as time passes');
  T.ok(/\d+ s|min/.test(a.why) && /left/.test(a.why), 'the line under the button carries the countdown');
  await idle(); await p.waitForTimeout(200);
  let s = await st();
  T.ok(!/left/.test(s.status), 'countdown clears when recovery ends: "' + s.status + '"');
  T.ok(/Not yet plated/.test(s.plates), 'before plating the tile says Not yet plated');
  await p.evaluate(() => document.querySelector('#do-step').click()); await idle(); await p.waitForTimeout(300);   // plate step
  s = await st();
  console.log('plates tile after plating:', s.plates);
  T.ok(!/Not yet plated/.test(s.plates) && /Spread/i.test(s.plates), 'after plating the PLATES tile no longer says Not yet plated');
  T.ok(p.errors.length === 0, 'no page errors ' + p.errors.join(';'));
  await b.close(); T.done('lab8 countdown + plates');
})();
