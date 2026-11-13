/* The "new" badge on Graph/Data tabs: not raised by loading, restoring, showing a part or re-rendering; raised by a genuine later result. */
const T = require('./_h');
(async () => {
  const b = await T.launch(), ctx = await T.ctxFor(b);
  const p = await T.open(ctx, 'lab05.html');
  const badges = () => p.evaluate(() => Array.from(document.querySelectorAll('.tab-badge')).filter(x => !x.hidden && x.offsetParent !== null).length);
  await p.evaluate(() => Lab.pages.go('float-assay')); await p.waitForTimeout(1500);
  T.ok(await badges() === 0, 'no badge after load and showing the part');
  await p.evaluate(() => { Lab.theme.set('dark'); }); await p.waitForTimeout(1200);
  T.ok(await badges() === 0, 'no badge after a theme redraw');
  await p.evaluate(() => { Lab.pages.go('overview'); }); await p.waitForTimeout(300);
  await p.evaluate(() => { Lab.pages.go('float-assay'); }); await p.waitForTimeout(1500);
  T.ok(await badges() === 0, 'no badge after leaving and re-showing the part');
  await p.evaluate(() => Lab.theme.set('light'));
  await p.waitForTimeout(1500);
  // make Data the current tab, then a result arrives for the Graph
  await p.evaluate(() => document.querySelector('#cup-sim .sim-tab[data-tab="data"]').click()); await p.waitForTimeout(1200);
  await p.evaluate(() => Lab.results.quiet(() => document.querySelector('#cup-chart').append(document.createElement('i')))); await p.waitForTimeout(400);
  T.ok(await badges() === 0, 'Lab.results.quiet(fn): a restore is not badged');
  await p.waitForTimeout(1200);
  await p.evaluate(() => document.querySelector('#cup-chart').append(document.createElement('i'))); await p.waitForTimeout(400);
  T.ok(await badges() === 1, 'a genuine result on the other tab raises the badge');
  T.ok(p.errors.length === 0, 'no errors ' + p.errors.join(';'));
  await b.close(); T.done('t38-badge');
})();
