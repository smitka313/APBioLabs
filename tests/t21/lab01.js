module.exports = async ({ b, ok, ctxAs, open, keyres, ownText, frqChecks, frqReload }) => {
  const L = 'lab01';
  const tt = async p => p.evaluate(() => ['#ta-m', '#ta-s', '#ta-n', '#tb-m', '#tb-s', '#tb-n'].map(s => document.querySelector(s).value).join(','));
  const c1 = await ctxAs(b, 'Ada Lovelace', '3');
  const p = await open(c1, 'lab01.html');
  const a1 = await tt(p);
  ok(a1 === ',,,,,', 'the t-test calculator starts empty (no pre-filled sample numbers): ' + a1);
  await p.reload(); await p.waitForTimeout(900);
  ok((await tt(p)) === a1, 'still empty after reload when the student has not calculated anything');

  // personal prompts wait for data
  await p.evaluate(() => Lab.pages.go('analyze')); await p.waitForTimeout(300);
  ok(/Finish Generation 2 first/.test(await ownText(p, 'own-response')), 'own-response asks to finish Generation 2 first');
  ok(await p.locator('[data-own="own-response"] a[href="#generation-2"]').count() === 1, 'Show me link present');

  // drive the simulation
  await p.evaluate(() => Lab.pages.go('grow-and-score')); await p.waitForTimeout(300);
  await p.click('#autocount'); await p.waitForTimeout(500);
  await p.evaluate(() => Lab.pages.go('select-and-pollinate')); await p.waitForTimeout(300);
  const det = p.locator('#predict-box-predict-selection'); await p.fill('#p-predict-selection', 'Generation 2 will be higher because heritable.');
  await p.click('#select-btn'); await p.waitForTimeout(300);
  await p.click('#pollinate');
  await p.waitForFunction(() => /seed|pollinat/i.test(document.querySelector('#sel-status').textContent) && !/Brushing/.test(document.querySelector('#sel-status').textContent), null, { timeout: 60000 }).catch(() => {});
  await p.waitForTimeout(1000);
  await p.click('#grow'); await p.waitForTimeout(500);
  await p.evaluate(() => Lab.pages.go('generation-2')); await p.waitForTimeout(300);
  await p.click('#score2'); await p.waitForTimeout(800);
  await p.evaluate(() => Lab.pages.go('analyze')); await p.waitForTimeout(2000);
  const o1 = await ownText(p, 'own-response'), o2 = await ownText(p, 'own-extreme');
  ok(/realized h² = -?\d\.\d\d/.test(o1), 'own-response quotes real values: ' + o1.slice(0, 120));
  ok(/had \d+ hairs/.test(o2), 'own-extreme quotes real values: ' + o2.slice(0, 120));
  const g2 = await keyres(p, L, 'gen2-mean'), h2 = await keyres(p, L, 'realized-h2');
  ok(g2 && g2.value > 0 && g2.unit === 'hairs', 'gen2-mean key result stored: ' + JSON.stringify(g2));
  ok(h2 && isFinite(h2.value), 'realized-h2 key result stored: ' + JSON.stringify(h2));
  ok(o1.includes(String(g2.value)), 'quoted Gen 2 mean matches key result');
  await p.click('#tt-fill'); await p.waitForTimeout(300);
  const t = await keyres(p, L, 'welch-t');
  ok(t && t.value > 0, 'welch-t key result stored: ' + JSON.stringify(t));

  await frqChecks(p, L);
  await p.reload(); await p.waitForTimeout(1200);
  await p.evaluate(() => Lab.pages.go('analyze')); await p.waitForTimeout(1800);
  ok(/realized h² = -?\d\.\d\d/.test(await ownText(p, 'own-response')), 'personal prompt still quotes values after reload');
  ok((await keyres(p, L, 'welch-t')).value === t.value, 'key results survive reload');
  await frqReload(p, L);
  await c1.close();
};
