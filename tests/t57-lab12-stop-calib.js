/* Audit 4 #5/#6, Lab 12, from a fully erased state:
   (a) stopping a trial midway says "Trial stopped — not recorded", clears the partial counts, and adds nothing to All trials;
   (b) after each recorded minute the sim's actual A/B counts show beside the student's count (calibration feedback).
   LAB12_FILE overrides the page. */
const T = require('./_h');
(async () => {
  const b = await T.launch(), ctx = await T.ctxFor(b);
  const p = await T.open(ctx, process.env.LAB12_FILE || 'lab12.html', 'choice-chamber');
  const setv = (sel, v) => p.evaluate(([s, v]) => { const e = document.querySelector(s); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); }, [sel, v]);
  await setv('#p-predict', 'The flies will prefer banana.');
  await p.evaluate(() => { const s = document.querySelector('#c-speed button[data-v="40"]'); if (s) s.click(); });
  const rows = () => p.evaluate(() => [...document.querySelectorAll('#int-table tbody tr')].filter(r => r.querySelector('input')).map(r => [...r.children].map(c => (c.querySelector('input') ? c.querySelector('input').value : c.textContent).trim()).join('|')));
  const msg = () => p.evaluate(() => { const m = document.querySelector('#ch-msg'); return m && !m.hidden ? m.textContent : ''; });
  await p.click('#c-run');
  await p.waitForFunction(() => !document.querySelector('#count-panel').hidden, null, { timeout: 30000 });
  const n = await p.evaluate(() => +document.querySelector('#c-n').value);
  // (b) count minute 1 by hand (deliberately a plausible but possibly wrong count), then see the sim's actual counts
  await setv('#cnt-a', String(Math.floor(n / 2))); await setv('#cnt-b', String(n - Math.floor(n / 2)));
  await p.click('#cnt-rec'); await p.waitForTimeout(400);
  const m1 = await msg(); console.log('calibration:', m1);
  T.ok(/simulation had \d+ at A and \d+ at B/.test(m1), 'after a recorded minute the sim\'s actual counts are shown beside the student\'s');
  const r1 = await rows(); console.log('rows:', JSON.stringify(r1));
  T.ok(r1.length === 1 && !/—|^$/.test((r1[0].split('|')[3] || '—')), 'the Actual A/B cells are filled for that minute: ' + r1[0]);
  // (a) wait for the second pause, then stop
  await p.waitForFunction(() => !document.querySelector('#count-panel').hidden, null, { timeout: 30000 });
  T.ok((await rows()).length === 1, 'one partial row before stopping');
  await p.click('#c-stop'); await p.waitForTimeout(400);
  const m2 = await msg(); console.log('stop:', m2);
  T.ok(/Trial stopped — not recorded/.test(m2), 'stopping shows "Trial stopped — not recorded"');
  T.ok((await rows()).length === 0, 'the partial counts are cleared from the table');
  T.ok(await p.evaluate(() => document.querySelectorAll('#trials-table tbody tr').length === 0 || /No |^\s*$/.test(document.querySelector('#trials-table').textContent)), 'nothing was added to All trials');
  T.ok(await p.evaluate(() => !document.querySelector('#c-run').disabled && document.querySelector('#count-panel').hidden), 'Run trial is available again');
  await p.click('#c-run'); await p.waitForTimeout(300);
  T.ok((await msg()) === '', 'the message clears when a new trial starts');
  T.ok(p.errors.length === 0, 'no page errors ' + p.errors.join(';'));
  await b.close(); T.done('lab12 stop + calibration');
})();
