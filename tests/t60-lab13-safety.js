/* Lab 13 safety and disposal (audit 5 re-audit, item 1): no "can go down the drain" for guaiacol; guaiacol waste goes in the
   labeled container; dilute H2O2 without guaiacol only if local rules allow; SDS, goggles and gloves, hand washing, glass rule.
   The projector copy of the safety callout matches.   Run: NODE_PATH=$(npm root -g) node tests/t60-lab13-safety.js */
const { ok, done, launch, ctxFor, open, ROOT } = require('./_h');
const fs = require('fs'), path = require('path');
(async () => {
  const src = fs.readFileSync(path.join(ROOT, 'lab13.html'), 'utf8');
  ok(!/guaiacol[^<]{0,40}can go down the drain/i.test(src), 'source no longer says guaiacol can go down the drain');
  const b = await launch(), ctx = await ctxFor(b, { reduced: true });
  await ctx.route(/gc\.zgo\.at/, r => r.abort());
  const p = await open(ctx, 'lab13.html');
  const items = await p.evaluate(() => Array.from(document.querySelectorAll('.callout--safety li')).map(li => li.textContent.replace(/\s+/g, ' ').trim()));
  const all = items.join(' | ');
  ok(items.length >= 5, 'safety callout has the full list (' + items.length + ' items)');
  ok(/school'?s chemical disposal rules/i.test(all) && /\bSDS\b/.test(all), 'follow teacher/school disposal rules and the SDS');
  ok(items.some(t => /guaiacol/i.test(t) && /labeled waste container/i.test(t) && /stock/i.test(t) && /used tubes/i.test(t)), 'used tubes, guaiacol solutions and stock go in the labeled waste container');
  ok(items.some(t => /never pour guaiacol/i.test(t)), 'never pour guaiacol down the drain');
  const h2o2 = items.find(t => /hydrogen peroxide/i.test(t) && /drain/i.test(t)) || '';
  ok(/no guaiacol/i.test(h2o2) && /plenty of water/i.test(h2o2) && /only if/i.test(h2o2) && /0\.1–1%/.test(h2o2), 'dilute H2O2 without guaiacol only if local rules allow: ' + h2o2);
  ok(items.some(t => /goggles/i.test(t) && /gloves/i.test(t) && /harmful if swallowed/i.test(t) && /eyes and skin/i.test(t)), 'goggles and gloves; guaiacol harmful if swallowed, irritates eyes and skin');
  ok(/wash your hands/i.test(all), 'wash hands');
  ok(/broken glass goes in the glass container/i.test(all), 'glass rule kept');
  ok(!items.some(t => /drain/i.test(t) && /guaiacol/i.test(t) && !/never/i.test(t) && !/no guaiacol/i.test(t)), 'no item allows guaiacol down the drain');
  /* projector mode reads the same safety text */
  global.window = {}; eval(fs.readFileSync(path.join(ROOT, 'projector-data.js'), 'utf8'));
  const ps = JSON.stringify(window.PROJECTOR_LABS.find(l => l.id === 'lab13'));
  ok(/Never pour guaiacol down the drain/.test(ps) && !/dilute guaiacol used here can go down the drain/.test(ps), 'projector copy of the safety callout is regenerated');
  ok(p.errors.length === 0, 'no page errors ' + p.errors.join('|'));
  await b.close(); done('t60-lab13-safety');
})();
