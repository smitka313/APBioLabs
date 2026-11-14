/* Audit 4 #5, Lab 13: a palette number outside 1-10 (11, 0, -2, 10.5?) is refused with a visible message at the field, never clamped,
   never plotted, and never counts as "recorded" for the part. Procedure 1 and Procedure 2, from a fully erased state. LAB13_FILE overrides the page. */
const T = require('./_h');
(async () => {
  const b = await T.launch(), ctx = await T.ctxFor(b);
  const p = await T.open(ctx, process.env.LAB13_FILE || 'lab13.html', 'procedure-1');
  await p.evaluate(() => { Object.keys(localStorage).filter(k => /^aplab:lab13/.test(k)).forEach(k => localStorage.removeItem(k)); });
  await p.reload(); await p.waitForTimeout(900);
  const idle = sel => p.waitForFunction(s => !document.querySelector(s).disabled, sel, { timeout: 60000 });
  const info = tbl => p.evaluate(t => {
    const inp = [...document.querySelectorAll(t + ' input')][0]; if (!inp) return null;
    const cell = inp.closest('td'); const msg = (cell && (cell.querySelector('.vmsg, .field-msg, [role=alert]') || {}).textContent) || (inp.getAttribute('aria-invalid') || '') ;
    return { value: inp.value, invalid: inp.getAttribute('aria-invalid'), msg: (cell ? cell.textContent : '').trim() + '|' + (inp.validationMessage || ''), vis: [...document.querySelectorAll('#p1-bad, #p2-bad')].filter(e => !e.hidden).map(e => e.textContent) };
  }, tbl);
  const typeIn = async (sel, v) => { const i = p.locator(sel).first(); await i.fill(v); await i.press('Tab'); await p.waitForTimeout(300); };
  // Procedure 1
  await p.fill('#p-predict-assay', 'The enzyme tube will darken faster.'); await p.waitForTimeout(300);
  await p.evaluate(() => { const b = document.querySelector('#sp1 button[data-v="40"]'); if (b) b.click(); });
  await p.click('#p1-run'); await p.waitForTimeout(500);
  await p.waitForFunction(() => document.querySelectorAll('#p1-table input').length > 0, null, { timeout: 60000 });
  await p.locator('#p1-table input').first().fill('11'); await p.waitForTimeout(400);   // typing only: no Tab, no blur
  let s = await info('#p1-table'); console.log('p1 after typing 11:', JSON.stringify(s));
  T.ok(s && s.value === '11', 'the typed value is left as typed (11), not silently clamped to 10: ' + (s && s.value));
  T.ok(s && s.vis.some(m => /1 to 10/.test(m)), 'a visible message at the table says palette numbers run from 1 to 10 while the student is still typing');
  T.ok(await p.evaluate(() => document.querySelector('#p1-table input[aria-invalid="true"]') != null), 'the cell itself is flagged');
  T.ok(await p.evaluate(() => { const r = Lab.store.get('p1') || []; return !r.some(x => x.cE === 10); }), 'nothing was stored as 10');
  await typeIn('#p1-table input', '7');
  s = await info('#p1-table'); T.ok(s && s.vis.length === 0, 'a valid 7 clears the message');
  await p.locator('#p1-table input').first().fill('0'); await p.waitForTimeout(400);
  s = await info('#p1-table'); T.ok(s && s.vis.some(m => /1 to 10/.test(m)), '0 is refused as well');
  // Procedure 2
  await p.evaluate(() => { location.hash = '#procedure-2-ph'; }); await p.waitForTimeout(600);
  await p.fill('#p-p2-pred', 'Neutral pH will be fastest.'); await p.waitForTimeout(300);
  await p.evaluate(() => { const b = document.querySelector('#sp2 button[data-v="40"]'); if (b) b.click(); });
  await p.click('#p2-run');
  await p.waitForFunction(() => document.querySelectorAll('#p2-table input').length > 0, null, { timeout: 60000 });
  await p.locator('#p2-table input').first().fill('11'); await p.waitForTimeout(400);
  T.ok(await p.evaluate(() => [...document.querySelectorAll('#p2-bad')].some(e => !e.hidden && /1 to 10/.test(e.textContent))), 'Procedure 2: the message appears while typing 11');
  await p.locator('#p2-table input').first().fill('4'); await p.waitForTimeout(400);
  T.ok(await p.evaluate(() => [...document.querySelectorAll('#p2-bad')].every(e => e.hidden)), 'Procedure 2: a valid 4 clears it');
  T.ok(p.errors.length === 0, 'no page errors ' + p.errors.join(';'));
  await b.close(); T.done('lab13 palette');
})();
