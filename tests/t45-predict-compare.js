/* Lab.predictCompare: the student's saved prediction beside a live snapshot of their chart, and a highlighted "What happened" line.
   Run: NODE_PATH=$(npm root -g) node tests/t45-predict-compare.js  (OUT=dir keeps screenshots) */
const T = require('./_h');
const OUT = process.env.OUT || '';
const FIX = 'tests/fixtures/lab97.html';

(async () => {
  const srv = await T.serve(), b = await T.launch();
  let ctx = await T.ctxFor(b);
  let p = await T.open(ctx, FIX, '', srv.url);
  const go = async id => { await p.evaluate(i => Lab.pages.go(i), id); await p.waitForTimeout(350); };

  console.log('Nothing yet');
  await go('reflect');
  const card = p.locator('#cmp .pvc');
  T.ok(await card.count() === 1 && await card.getAttribute('aria-labelledby') !== null, 'the card renders in Reflect, labelled by its heading');
  T.ok(/you predicted/i.test(await card.innerText()) && /what your bench showed/i.test(await card.innerText()), 'left "You predicted", right "What your bench showed"');
  T.ok(await card.locator('.pvc-what').innerText().then(t => /^What happened: Finish Float assay first$/.test(t.trim())), 'no result: "Finish Float assay first"');
  T.ok(await card.locator('.pvc-what a[href="#float-assay"]').count() === 1, 'the part name is a link back to the part');
  T.ok(await card.locator('.pvc-none').isVisible() && await card.locator('.pvc-quote').isHidden(), 'no prediction yet: a gentle "predict first" note');
  T.ok(await p.locator('#cmp2 .pvc-what').innerText().then(t => /Finish Part 1 first/.test(t)), 'the text-only card also waits: "Finish Part 1 first"');

  console.log('Prediction saved, then a result');
  await go('float-assay');
  await p.fill('#p-predict-float', 'The treated cup will float first because it has more CO2.');
  await p.click('#add'); await p.click('#add'); await p.click('#add');
  await p.waitForTimeout(500);
  await go('reflect');
  T.ok((await card.locator('.pvc-quote').innerText()).includes('The treated cup will float first'), 'the left side quotes the saved prediction');
  T.ok(await card.locator('.pvc-quote').isVisible() && await card.locator('.pvc-none').isHidden(), 'and hides the note');
  T.ok(await card.locator('.pvc-snap svg:not(.lg-sw)').count() === 1 && await card.locator('.pvc-snap svg:not(.lg-sw) circle').count() >= 3, 'the right side holds a snapshot of the chart, with its plotted data');
  T.ok(await card.locator('.pvc-snap').evaluate(e => e.classList.contains('chart') && e.getBoundingClientRect().height > 120), 'drawn at a readable size');
  T.ok(/At minute 6, 6 treated disks and 3 control disks/.test(await card.locator('.pvc-sum').innerText()), 'summarize(result) text: ' + await card.locator('.pvc-sum').innerText());
  const what = await card.locator('.pvc-what').innerText();
  T.ok(/^What happened: The treated cup floated first, as you predicted\.$/.test(what.trim()), 'delta(result, prediction): "' + what.trim() + '"');
  T.ok(await card.locator('.pvc-what').evaluate(e => getComputedStyle(e).backgroundColor !== 'rgba(0, 0, 0, 0)' && getComputedStyle(e).borderLeftWidth === '5px'), '"What happened" is a highlighted line');
  T.ok(await card.locator('.pvc-wait').isHidden(), '"Finish … first" is gone');
  T.ok(/You recorded 3 trials/.test(await p.locator('#cmp2 .pvc-what').innerText()), 'with delta absent, the line falls back to the summary');
  if (OUT) await p.locator('#cmp').screenshot({ path: OUT + '/t45-card-light.png' });

  console.log('Live');
  await go('float-assay'); await p.click('#add'); await p.waitForTimeout(500); await go('reflect');
  T.ok(/At minute 8/.test(await card.locator('.pvc-sum').innerText()), 'a new trial updates the snapshot and the summary without reloading');
  await go('float-assay'); await p.fill('#p-predict-float', 'The control will float first.'); await p.waitForTimeout(400); await go('reflect');
  T.ok((await card.locator('.pvc-quote').innerText()).includes('The control will float first') && /^What happened: At minute 8/.test((await card.locator('.pvc-what').innerText()).trim()), 'editing the prediction updates the quote and delta returns null → the summary shows');

  console.log('Reload, theme, phone');
  await p.reload(); await p.waitForTimeout(900); await go('reflect');
  T.ok((await card.locator('.pvc-quote').innerText()).includes('control will float first') && await card.locator('.pvc-snap svg:not(.lg-sw)').count() === 1, 'after a reload the saved prediction and the chart are back');
  await p.evaluate(() => Lab.theme.set('dark')); await p.waitForTimeout(500);
  T.ok(await card.locator('.pvc-snap svg:not(.lg-sw)').count() === 1, 'dark theme: snapshot redrawn');
  if (OUT) await p.locator('#cmp').screenshot({ path: OUT + '/t45-card-dark.png' });
  await p.evaluate(() => Lab.theme.set('light'));
  T.ok(p.errors.length === 0, 'no console errors ' + p.errors.join('|'));
  await ctx.close();
  ctx = await T.ctxFor(b, { width: 400, height: 800, seed: {} });
  p = await T.open(ctx, FIX, '', srv.url);
  await p.evaluate(() => Lab.pages.go('float-assay')); await p.waitForTimeout(350);
  await p.fill('#p-predict-float', 'A long prediction that must wrap on a narrow phone screen without any horizontal scrolling at all.');
  await p.click('#add'); await p.click('#add'); await p.waitForTimeout(400);
  await p.evaluate(() => Lab.pages.go('reflect')); await p.waitForTimeout(500);
  T.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'no sideways scroll at 400 px');
  T.ok(await p.evaluate(() => { const c = document.querySelector('#cmp .pvc-grid'); return getComputedStyle(c).gridTemplateColumns.split(' ').length === 1; }), 'one column on a phone');
  if (OUT) await p.locator('#cmp').screenshot({ path: OUT + '/t45-card-400.png' });
  await ctx.close();

  await b.close(); srv.close();
  T.done('t45-predict-compare');
})();
