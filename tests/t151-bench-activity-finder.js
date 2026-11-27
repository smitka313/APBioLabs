/* The course finder uses the original cards, not a second inventory. Exercise its
   matching rules without a browser via --logic-only; otherwise also test both dashboards. */
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { tokens, numberedLessons, queryFor, matches } = require('../bench-activity-finder');

const variants = [true, false];
const files = ['ap-biology.html', 'openscied-dashboard.html'];
const fixture = (group, lab, lessons, text) => ({ group, lab, lessons: numberedLessons(lessons), words: tokens(text) });
const lab2 = fixture('bi1', 2, '', 'Evolution Mathematical Modeling: Hardy–Weinberg');
const lab12 = fixture('bi4', 12, '', 'Fruit Fly Behavior');
const migration = fixture('unit1', null, 'Lessons 3–4 companion · 40–50 min', 'Migration Map Explorer Wildebeest');
const corridor = fixture('unit4', null, 'Lessons 7–9 companion · 25–35 min', 'Wildlife Corridor Lab Gene flow');
const fires = fixture('unit2', null, 'Lessons 3 and 5 companion', 'Fires and peat');
assert.deepEqual([...numberedLessons('Primer for Lessons 5–6 · No prior DNA knowledge needed · 20–30 minutes')], [5, 6]);
assert.deepEqual([...numberedLessons('Lessons 7–9, 11 and 13')], [7, 8, 9, 11, 13]);
assert.deepEqual([...numberedLessons('Unit B.2 companion · 45–60 minutes')], []);
assert.equal(matches(lab2, queryFor('hardy wein', true), ''), true);
assert.equal(matches(lab2, queryFor('LAB #02', true), ''), true);
assert.equal(matches(lab12, queryFor('lab 2', true), ''), false);
assert.equal(matches(lab2, queryFor('02', true), ''), true);
assert.equal(matches(lab2, queryFor('AP Biology lab 2', true), ''), true);
assert.equal(matches(lab2, queryFor('Big idea 1', true), ''), true);
assert.equal(matches(lab2, queryFor('hardy wein', true), 'bi4'), false);
assert.equal(matches(migration, queryFor('B.1 lesson 4 wilde', false), ''), true);
assert.equal(matches(migration, queryFor('OpenSciEd lesson 4 wilde', false), ''), true);
assert.equal(matches(migration, queryFor('unit 2 lesson 4', false), ''), false);
assert.equal(matches(corridor, queryFor('lesson 8', false), ''), true);
assert.equal(matches(corridor, queryFor('lesson 8 gene flow', false), 'unit4'), true);
assert.equal(matches(corridor, queryFor('lesson 8 gene flow', false), 'unit2'), false);
assert.equal(matches(fires, queryFor('lesson 5', false), ''), true);
assert.equal(matches(fires, queryFor('lesson 4', false), ''), false);

for (const [index, file] of files.entries()) {
  const html = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const ap = variants[index];
  const form = html.match(/<form class="activity-finder-form"[^]*?<\/form>/)?.[0];
  assert.ok(form, file + ' has finder');
  for (const [, id] of form.matchAll(/<option value="((?:bi|unit)\d+)">/g)) {
    assert.ok(html.includes('aria-labelledby="' + id + '"'), file + ' filter targets an existing group');
  }
  assert.equal([...html.matchAll(ap ? /<a class="card" href="lab\d+\.html">/g : /<article class="dashboard-activity">/g)].length, ap ? 13 : 24);
  assert.match(html, /<script src="bench-activity-finder\.js"><\/script>/);
}

if (process.argv.includes('--logic-only')) {
  console.log('Finder matching rules and dashboard wiring passed.');
} else {
  const T = require('./_h');
  (async () => {
    const browser = await T.launch();
    const server = await T.serve();
    try {
      for (const [layout, width] of [['desktop', 1366], ['phone', 390]]) {
        const ctx = await T.ctxFor(browser, { width, dark: width === 390, reduced: true });
        try {
          for (const [index, file] of files.entries()) {
            const ap = variants[index], total = ap ? 13 : 24;
            const p = await T.open(ctx, file, '', server.url);
            const prefix = layout + ' ' + file + ': ';
            const finder = p.getByRole('search', { name: ap ? 'AP Biology investigations' : 'OpenSciEd activities' });
            const search = finder.getByRole('searchbox', { name: 'Find an activity' });
            const select = finder.getByRole('combobox', { name: ap ? 'Big idea' : 'Unit' });
            const status = finder.getByRole('status');
            const selector = ap ? '#labs .cards .card' : '#activities .dashboard-activity';
            const cards = p.locator(selector + ':visible');
            T.ok(await cards.count() === total, prefix + 'all cards initially visible');
            T.ok((await status.textContent()) === total + ' activities', prefix + 'initial count');
            T.ok(await finder.evaluate(node => node.getBoundingClientRect().right <= innerWidth + 1 && node.scrollWidth <= node.clientWidth + 1), prefix + 'finder fits viewport');
            await search.fill(ap ? 'lab 2' : 'lesson 4 migration');
            T.ok(await cards.count() === 1, prefix + 'numbered search identifies one card');
            T.ok(await cards.first().getByRole('heading', { name: ap ? /Hardy/ : /Migration Map/ }).isVisible(), prefix + 'the right card stays visible');
            T.ok((await status.textContent()) === '1 of ' + total + ' activities', prefix + 'result count updates');
            await select.selectOption(ap ? 'bi4' : 'unit2');
            T.ok(await cards.count() === 0, prefix + 'search and filter combine');
            T.ok(/No matches/.test(await status.textContent()), prefix + 'empty search explains recovery');
            await finder.getByRole('button', { name: 'Clear filters' }).click();
            T.ok(await search.evaluate(el => document.activeElement === el), prefix + 'focus returns to search');
            T.ok(await cards.count() === total, prefix + 'clear restores all original cards');
            await select.selectOption(ap ? 'bi2' : 'unit4');
            T.ok(await cards.count() === (ap ? 3 : 4), prefix + 'select can filter on its own');
            await p.emulateMedia({ media: 'print' });
            T.ok(!(await finder.isVisible()) && await cards.count() === total, prefix + 'printing still shows the complete catalog');
            await p.emulateMedia({ media: 'screen' });
            if (!ap) {
              await p.getByRole('navigation', { name: 'Jump to a unit' }).getByRole('link', { name: /Unit 1/ }).click();
              T.ok(await p.locator('#unit1').isVisible() && await cards.count() === total && p.url().endsWith('#unit1'), prefix + 'unit jump clears filters hiding the destination');
            }
            await p.close();
          }
        } finally { await ctx.close(); }
      }
      const noJs = await browser.newContext({ javaScriptEnabled: false });
      try {
        for (const [index, file] of files.entries()) {
          const p = await noJs.newPage();
          await p.goto(server.url + file);
          T.ok(!(await p.locator('.activity-finder').isVisible()), file + ' hides inactive finder without JavaScript');
          const cards = p.locator((index ? '#activities .dashboard-activity' : '#labs .cards .card') + ':visible');
          T.ok(await cards.count() === (index ? 24 : 13), file + ' keeps all course cards available without JavaScript');
          await p.close();
        }
      } finally { await noJs.close(); }
    } finally { await browser.close(); server.close(); }
    T.done('t151-bench-activity-finder');
  })().catch(err => { console.error(err); process.exitCode = 1; });
}
