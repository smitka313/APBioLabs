/* Lab 8: the transformation (steps, timed heat shock, plates, predictions, marks), calculator inputs, design settings and
   satellite test survive a reload; timed steps show a countdown + progress and keep running by the clock. */
const T = require('./_h');
(async () => {
  const b = await T.launch(), ctx = await T.ctxFor(b);
  let p = await T.open(ctx, 'lab08.html', 'transform');
  const state = () => p.evaluate(() => ({ btn: document.querySelector('#do-step').textContent.trim(), dis: document.querySelector('#do-step').disabled, st: document.querySelector('#ro-status').textContent, steps: [...document.querySelectorAll('#proto-list li.done,#proto-list li.skipped')].length, cur: (document.querySelector('#proto-list li.cur') || {}).textContent }));
  // steps 1-5 quickly (skip-able ones are done normally)
  for (let i = 0; i < 5; i++) { await p.click('#do-step'); await p.waitForFunction(() => !document.querySelector('#do-step').disabled, null, { timeout: 30000 }); }
  const before = await state();
  T.ok(before.steps === 5, 'five steps done: ' + before.steps);
  // heat shock: countdown on the button, progress bar, repeated clicks ignored
  await p.click('#do-step'); await p.waitForTimeout(1500);
  const mid = await state();
  T.ok(/^Heat shock… \d+ s$/.test(mid.btn) && mid.dis, 'countdown on button: ' + mid.btn);
  T.ok(await p.evaluate(() => !document.querySelector('#step-prog').hidden && +document.querySelector('#step-prog').value > 0), 'progress bar visible');
  await p.evaluate(() => document.querySelector('#do-step').click());
  T.ok((await state()).steps === 5, 'repeat click does nothing');
  // reload mid-step: it keeps counting; after the time passes it is finished
  await p.reload(); await p.waitForTimeout(900);
  const rel = await state();
  T.ok(/Heat shock… \d+ s/.test(rel.btn), 'resumed countdown after reload: ' + rel.btn);
  await p.waitForFunction(() => !document.querySelector('#do-step').disabled, null, { timeout: 30000 });
  T.ok((await state()).steps === 6, 'heat shock finished');
  // reload after the timer ended while closed
  await p.click('#do-step'); await p.waitForTimeout(500);
  await p.evaluate(() => { const s = JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k => /sim-state/.test(k)))); });
  const key = await p.evaluate(() => Object.keys(localStorage).find(k => /sim-state/.test(k)));
  await p.evaluate(k => { const s = JSON.parse(localStorage.getItem(k)); s.pending.t0 -= 120000; localStorage.setItem(k, JSON.stringify(s)); }, key);
  await p.reload(); await p.waitForTimeout(900);
  const fin = await state();
  T.ok(fin.steps === 7 && !fin.dis, 'step finished while the page was closed: ' + fin.steps);
  // finish the protocol, predict, incubate
  for (let i = 0; i < 2; i++) { await p.click('#do-step'); await p.waitForFunction(() => !document.querySelector('#do-step').disabled, null, { timeout: 30000 }); }
  await p.evaluate(() => { document.querySelectorAll('#pred-grid select').forEach(s => { s.value = 'none'; s.dispatchEvent(new Event('change', { bubbles: true })); }); });
  await p.click('#do-step'); await p.waitForFunction(() => document.querySelector('#plate-readouts').textContent.includes('Colonies') || document.querySelector('#plate-readouts').textContent.includes('Lawn'), null, { timeout: 40000 });
  await p.waitForTimeout(500);
  const plates = () => p.evaluate(() => document.querySelector('#plate-readouts').innerText);
  const pl = await plates();
  // count + calculator
  await p.evaluate(() => { document.querySelector('#zoom-plate').value = 'p-amp'; document.querySelector('#zoom-plate').dispatchEvent(new Event('change')); });
  const box = await p.locator('#zoom').boundingBox();
  await p.mouse.click(box.x + box.width / 2, box.y + box.height / 2); await p.waitForTimeout(200);
  await p.fill('#c-count', '33'); await p.fill('#c-mass', '0.05');
  await p.reload(); await p.waitForTimeout(1200);
  T.ok((await plates()) === pl, 'plates restored: ' + pl.replace(/\n/g, ' ').slice(0, 60));
  T.ok(await p.evaluate(() => [...document.querySelectorAll('#pred-grid select')].every(s => s.value === 'none' && s.disabled)), 'predictions restored and locked');
  T.ok(await p.evaluate(() => document.querySelector('#c-count').value === '33' && document.querySelector('#c-mass').value === '0.05'), 'calculator inputs restored');
  T.ok(await p.evaluate(() => /Incubated/.test(document.querySelector('#ro-status').textContent)), 'status restored');
  T.ok(await p.evaluate(() => /Checking|✓|✗|correct|Not graded/i.test(document.querySelector('#calc-fb').textContent)), 'calculator feedback recomputed');
  // worked example never saved
  await p.click('#calc-example'); await p.waitForTimeout(200);
  T.ok(await p.evaluate(() => !document.querySelector('#calc-banner').hidden && /EXAMPLE/.test(document.querySelector('#calc-banner').textContent) && document.querySelector('#c-count').value === '40'), 'example shown with banner');
  await p.reload(); await p.waitForTimeout(900);
  T.ok(await p.evaluate(() => document.querySelector('#c-count').value === '33'), 'example not saved; own value back');
  await p.click('#calc-example'); await p.click('#calc-example-clear'); await p.waitForTimeout(200);
  T.ok(await p.evaluate(() => document.querySelector('#calc-banner').hidden && document.querySelector('#c-count').value === '33'), 'clear example returns own inputs');
  T.ok(p.errors.length === 0, 'no page errors ' + p.errors.join(';'));
  await b.close(); T.done('lab8 persist');
})();
