/* Lessons 8-9 yeast planner: Start from / I change / I measure / Yeast are dropdowns, not wrapped pill buttons
   (the Lessons 5-6 page got the same change after an iPhone report). Run: NODE_PATH=$(npm root -g) node tests/t100-planner-dropdowns.js */
const T = require('./_h');
const PAGE = 'openscied-b3-inheritance-environment.html';
(async () => {
  const browser = await T.launch(), server = await T.serve();
  try {
    for (const [w, h, dark] of [[1366, 900, false], [360, 740, true]]) {
      const ctx = await T.ctxFor(browser, { width: w, height: h, dark }), p = await ctx.newPage(), tag = ' @' + w, errs = [];
      p.on('pageerror', e => errs.push(e.message));
      await p.route(/gc\.zgo\.at|fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, body: '' }));
      await p.goto(server.url + PAGE);
      await p.waitForFunction(() => document.querySelector('.step.is-current'));
      await p.evaluate(() => { location.hash = 'plan'; }); await p.waitForSelector('#plan.is-current');
      await p.waitForSelector('#planner-scene [data-sel="iv"]');
      const keys = ['starter', 'iv', 'dv', 'strain'];
      T.ok(await p.locator(keys.map(k => '#planner-scene select[data-sel="' + k + '"]').join(',')).count() === 4, 'four dropdowns: start from, change, measure, yeast' + tag);
      T.ok(await p.locator('#planner-scene .pl-chip[data-k="spf"], #planner-scene [data-starter]').count() === 0, 'the old pill buttons for these are gone' + tag);
      T.ok(await p.evaluate(() => [...document.querySelectorAll('#planner-scene .pl-ui > .pl-group > label')].every(l => document.getElementById(l.htmlFor))), 'each dropdown has a visible label tied to it' + tag);
      await p.selectOption('#pl-sel-starter', 'class');
      T.ok(await p.locator('#pl-sel-iv').inputValue() === 'spf' && await p.locator('#planner-scene .pl-selwrap .pl-tick').first().innerText() === '', 'a starter fills the plan; the starter menu goes back to its prompt' + tag);
      await p.selectOption('#pl-sel-iv', 'time');
      T.ok(await p.locator('#pl-sel-iv').inputValue() === 'time' && await p.evaluate(() => document.activeElement && document.activeElement.id === 'pl-sel-iv'), 'changing a dropdown keeps focus on it' + tag);
      await p.selectOption('#pl-sel-dv', 'growth').catch(() => {});
      const o = await p.evaluate(() => ({ page: document.documentElement.scrollWidth - innerWidth, bad: [...document.querySelectorAll('#planner-scene .pl-select')].filter(s => { const r = s.getBoundingClientRect(); return r.width < 140 || r.height < 24 || r.right > innerWidth + 1; }).length }));
      T.ok(o.page <= 0 && o.bad === 0, 'dropdowns fit, at least 140 px wide, no sideways scroll' + tag);
      await p.reload(); await p.waitForSelector('#planner-scene [data-sel="iv"]');
      await p.evaluate(() => { location.hash = 'plan'; }); await p.waitForSelector('#pl-sel-iv');
      T.ok(await p.locator('#pl-sel-iv').inputValue() === 'time', 'the choice is saved across a reload' + tag);
      T.ok(errs.length === 0, 'no page errors ' + errs.join('|') + tag);
      if (process.env.SHOT_DIR) await p.locator('#planner-scene .pl-ui').first().screenshot({ path: process.env.SHOT_DIR + '/planner-' + w + '.png' });
      await ctx.close();
    }
  } finally { await browser.close(); server.close(); }
  T.done('t100-planner-dropdowns');
})();
