/* Lab 1: derived text (verdicts, calculator results, key results) must not outlive the data it was made from.
   Starts from an erased lab, scores generation 2, checks the numbers, then edits an answer / plants a new class population.
   Run: NODE_PATH=$(npm root -g) node tests/t57-lab1-stale.js */
const { ok, done, launch, ctxFor, open } = require('./_h');
(async () => {
  const b = await launch(), ctx = await ctxFor(b, { reduced: true }), p = await open(ctx, 'lab01.html');
  const go = async id => { await p.evaluate(i => Lab.pages.go(i), id); await p.waitForTimeout(350); };
  const txt = sel => p.evaluate(s => (document.querySelector(s) || {}).textContent || '', sel);
  const key = id => p.evaluate(i => { const e = Lab.store.get('keyres:' + i); return e ? e.value : null; }, id);
  await go('grow-and-score'); await p.click('#autocount'); await p.waitForTimeout(400);
  await go('select-and-pollinate'); await p.fill('#p-predict-selection', 'Higher, because heritable.');
  await p.click('#select-btn'); await p.waitForTimeout(300); await p.click('#pollinate');
  await p.waitForFunction(() => /seed|pollinat/i.test(document.querySelector('#sel-status').textContent) && !/Brushing/.test(document.querySelector('#sel-status').textContent), null, { timeout: 60000 }).catch(() => {});
  await p.waitForTimeout(800); await p.click('#grow'); await p.waitForTimeout(400);
  await go('generation-2'); await p.click('#score2'); await p.waitForTimeout(1800);
  ok(await key('gen2-mean') != null && await key('realized-h2') != null, 'generation 2 scored: key results exist (' + await key('gen2-mean') + ', ' + await key('realized-h2') + ')');
  await p.fill('#in-S', '8'); await p.fill('#in-R', '3'); await p.fill('#in-h2', '0.4'); await p.click('#check-calc'); await p.waitForTimeout(200);
  ok(/S|R/.test(await txt('#calc-status')) && (await txt('#calc-status')).length > 5, 'check my numbers shows a verdict: ' + (await txt('#calc-status')).slice(0, 50));
  await p.fill('#in-R', '4'); await p.waitForTimeout(250);
  ok((await txt('#calc-status')).trim() === '', 'editing an answer withdraws the old verdict');
  await p.click('#check-calc'); await p.waitForTimeout(200);
  ok((await txt('#calc-status')).length > 5, 'checked again');

  await go('analyze'); await p.click('#tt-fill'); await p.waitForTimeout(400);
  ok(/\d/.test(await txt('#tt-t')) && await key('welch-t') != null, 't-test calculated from my data: t = ' + await txt('#tt-t'));
  await p.fill('#tb-m', '1'); await p.waitForTimeout(300);
  ok((await txt('#tt-t')).trim() === '—' && (await txt('#tt-status')).trim() === '' && await key('welch-t') == null, 'editing a t-test input clears the old t, the status line and its key result');
  await p.click('#tt-fill'); await p.waitForTimeout(300);

  await go('grow-and-score'); await p.evaluate(() => document.getElementById('new-pop').click()); await p.waitForTimeout(2200);
  ok((await txt('#calc-status')).trim() === '', 'new class population: the old "check my numbers" verdict is gone (now "' + (await txt('#calc-status')).trim().slice(0, 40) + '")');
  ok(await key('gen2-mean') == null && await key('realized-h2') == null, 'new class population: gen2-mean / realized-h2 key results are withdrawn');
  await p.reload(); await p.waitForTimeout(2200);
  ok((await txt('#calc-status')).trim() === '' && await key('gen2-mean') == null, 'and they stay gone after a reload');
  ok(p.errors.length === 0, 'no page errors ' + p.errors.join('|'));
  await b.close(); done('t57-lab1-stale');
})();
