/* Browser smoke test for the draft openscied-b1-serengeti activity.
   Set SERENGETI_SCREENSHOTS to save page captures. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const T = require('./_h');

(async () => {
  const browser = await T.launch(), server = await T.serve();
  const shotDir = process.env.SERENGETI_SCREENSHOTS;
  if (shotDir) fs.mkdirSync(shotDir, { recursive: true });
  async function shot(page, label) { if (shotDir) await page.screenshot({ path: path.join(shotDir, label + '.png') }); }
  async function fit(page) { return page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1); }
  try {
    for (const [width, height, dark] of [[390, 844, true],[768, 960, false],[1366, 900, false],[1920, 1080, false]]) {
      const context = await T.ctxFor(browser, { width, height, dark, reduced: true });
      try {
        await context.addInitScript(() => {
          const original = crypto.getRandomValues.bind(crypto);
          crypto.getRandomValues = (array) => {
            if (array instanceof Uint32Array && array.length === 1) { array[0] = 32737; return array; }
            return original(array);
          };
        });
        const page = await context.newPage(), errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(server.url + 'openscied-b1-serengeti.html');
        await page.locator('#sg-start').waitFor();
        T.ok(await fit(page), width + ' px: no horizontal overflow before play');
        T.ok((await page.locator('meta[name="robots"]').getAttribute('content')).includes('noindex'), 'draft is not indexed');
        await shot(page, width + '-setup');
        await page.locator('#sg-start').click();
        const next = page.locator('#sg-next');
        await next.waitFor();
        T.ok(await fit(page), width + ' px: game fits the page');
        T.ok(await page.locator('#sg-phase').isVisible(), 'season phase is visible');
        await shot(page, width + '-game');
        if (width === 390 || width === 1366) {
          const actions = new Set();
          let draws = 0;
          for (let attempt = 0; attempt < 500; attempt++) {
            if (!await next.isVisible() || !await next.isEnabled()) break;
            const action = await next.getAttribute('data-action');
            if (!action) break;
            actions.add(action);
            if (action === 'draw') draws++;
            await next.click();
            if (attempt === 4) {
              await shot(page, width + '-early');
              const phase = await page.locator('#sg-phase').textContent();
              await page.reload();
              T.ok(await page.locator('#sg-phase').textContent() === phase, 'reload resumes the current phase');
            }
          }
          T.ok(draws === 12, 'three cards are drawn in each of four seasons (got ' + draws + ')');
          T.ok(actions.has('nextSeason'), 'later seasons can be reached');
          T.ok(/year complete/i.test(await page.locator('#sg-phase').textContent()), 'fall ends the four-season model');
          await page.locator('.sg-tabs [data-page="evidence"]').click();
          const evidence = page.locator('#sg-evidence-body');
          await evidence.waitFor();
          T.ok((await evidence.innerText()).trim().length > 0, 'data log has generated results');
          await shot(page, width + '-evidence');
          await page.locator('.sg-tabs [data-page="analyze"]').click();
          await page.locator('#sg-analysis-data').waitFor();
          T.ok(await page.locator('#sg-analysis-data').isVisible(), 'analysis references game data');
          T.ok(await fit(page), width + ' px: analysis fits the page');
          await shot(page, width + '-analysis');
          if (width === 390) {
            const key = 'aplab:openscied-b1-serengeti:preview-v1';
            const unreadable = ' {"v":99,"fictional":"exact original"} ';
            await page.evaluate(([k,raw]) => localStorage.setItem(k,raw), [key,unreadable]);
            await page.reload();
            await page.locator('#sg-recover').waitFor();
            const download = page.waitForEvent('download');
            await page.locator('#sg-recover').click();
            const saved = await download;
            T.ok(fs.readFileSync(await saved.path(), 'utf8') === unreadable, 'recovery downloads the original bytes');
            await page.locator('.sg-tabs [data-page="evidence"]').click();
            T.ok(await page.evaluate(k => localStorage.getItem(k),key) === unreadable, 'changing sections leaves unreadable saved work untouched');
          }
        }
        assert.deepEqual(errors, [], 'no page errors at ' + width + ' px');
      } finally { await context.close(); }
    }
  } finally { await browser.close(); server.close(); }
  T.done('t107-serengeti');
})().catch(e => { console.error(e); process.exitCode = 1; });
