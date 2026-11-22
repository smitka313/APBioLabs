const { chromium } = require('playwright');
const http = require('node:http'), fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
(async () => {
  const root = path.resolve(__dirname, '..');
  const server = http.createServer((req, res) => {
    const p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
    if (!p.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); }
    fs.readFile(p, (e, b) => { if (e) { res.writeHead(404); return res.end(); } res.setHeader('Content-Type', p.endsWith('.js') ? 'application/javascript' : p.endsWith('.css') ? 'text/css' : 'text/html'); res.end(b); });
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  let browser;
  try {
    browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
    const url = `http://127.0.0.1:${server.address().port}/openscied-b2-carbon-journey.html`;
    fs.mkdirSync(path.join(root, 'artifacts/l9'), { recursive: true });
    for (const [width, height] of [[375,667],[390,844],[768,1024],[1366,768],[1920,1080]]) {
      const ctx = await browser.newContext({ viewport: { width, height }, colorScheme: width < 400 ? 'dark' : 'light', reducedMotion: 'reduce' });
      const p = await ctx.newPage(), errors = []; p.on('pageerror', e => errors.push(e.message));
      await p.goto(url);
      const shot = state => p.screenshot({ path: path.join(root, `artifacts/l9/${width}-${state}.png`), fullPage: true });
      const fits = async selector => { const b = await p.locator(selector).boundingBox(); assert.ok(b && b.y >= 0 && b.y + b.height <= height + 1, `${selector} within viewport at ${width}x${height}: ${JSON.stringify(b)}`); };
      await p.locator('#roll').waitFor();
      if (width < 851) { await fits('#roll'); await fits('#board'); assert.ok(await p.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1)); }
      await shot('start');
      await p.locator('#inspect-current').click();
      assert.ok(await p.locator('#inspect-dialog').isVisible());
      await p.locator('#inspect-options button').nth(1).click();
      assert.ok((await p.locator('#inspect-caption').textContent()).length > 60);
      await p.locator('[data-close="inspect-dialog"]').click();
      if (width < 851) {
        await p.locator('#map-toggle').click(); assert.equal(await p.locator('[data-station]').count(), 7);
        await p.locator('[data-station="soil"]').click(); assert.match(await p.locator('#inspect-title').textContent(), /Soil/);
        await p.locator('[data-close="inspect-dialog"]').click(); await p.locator('#map-toggle').click(); await fits('#roll');
      }
      await p.locator('#roll').click(); assert.equal(await p.locator('#prediction-options button').count(), 7);
      const pending = await p.locator('#die').getAttribute('aria-label'); await p.reload();
      assert.equal(await p.locator('#die').getAttribute('aria-label'), pending);
      for (let i = 0; i < 10; i++) {
        if (i) await p.locator('#roll').click();
        assert.equal(await p.locator('#prediction-options button').count(), 7);
        if (width < 851) await fits('#skip-prediction');
        if (i === 0) { await shot('predict'); await p.locator('[data-guess="ocean"]').click(); }
        else await p.locator('#skip-prediction').click();
        assert.ok((await p.locator('#official-card').textContent()).length > 70);
        assert.ok(await p.locator('#record').isVisible());
        if (width < 851) { await fits('#record'); assert.ok(await p.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1)); }
        const expected = await p.locator('#destination').textContent();
        if (i === 0) { await shot('card'); await p.reload(); assert.ok(await p.locator('#record').isVisible()); }
        await p.locator('#record').click(); assert.equal(await p.locator('#location').textContent(), expected);
        if (i === 4) await shot('middle');
      }
      assert.equal(await p.locator('#finish').isEnabled(), true); await p.locator('#finish').click();
      assert.equal(await p.locator('#complete-dialog').isVisible(), true); await p.locator('#analyze').click();
      assert.equal(await p.locator('#journal tr').count(), 10); await shot('evidence');
      if (width < 851) { await p.locator('[data-total-tab="matter"]').click(); assert.ok(await p.locator('[data-total="matter"]').isVisible()); }
      await p.getByRole('button', { name: '3 · Make sense' }).click();
      await p.locator('#question-next').click(); await p.locator('#question-next').click(); await p.locator('#q4').fill('My carbon atom followed the official cards.');
      await p.reload(); await p.getByRole('button', { name: '3 · Make sense' }).click();
      await p.locator('#question-next').click(); await p.locator('#question-next').click();
      assert.equal(await p.locator('#q4').inputValue(), 'My carbon atom followed the official cards.');
      assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      const dashboard = await ctx.newPage();
      await dashboard.goto(url.replace('openscied-b2-carbon-journey.html','openscied-dashboard.html'));
      assert.equal(await dashboard.locator('section[aria-labelledby="unit2"] .dashboard-activity').count(),4);
      assert.equal(await dashboard.locator('.dashboard-activity').count(),7);
      assert.match(await dashboard.locator('#carbon-journey-progress').textContent(),/10 rolls recorded/);
      await dashboard.screenshot({path:path.join(root,`artifacts/l9/${width}-dashboard.png`),fullPage:true});
      await dashboard.locator('#carbon-journey-open').click();
      assert.ok(await dashboard.locator('#sense').isVisible());await dashboard.close();
      const downloaded = p.waitForEvent('download'); await p.locator('#download').click(); const d = await downloaded;
      assert.match(d.suggestedFilename(), /carbon-atom-journey/);
      await p.locator('#restart').click(); await p.locator('#cancel-reset').click(); assert.equal(await p.locator('#q4').inputValue(), 'My carbon atom followed the official cards.');
      await p.locator('#restart').click(); await p.locator('#confirm-reset').click(); assert.equal(await p.locator('#roll').isEnabled(), true);
      assert.deepEqual(errors, []); console.log('PASS', width, height, 'viewport fit, inspect, map, prediction, official cards, reload, 10 rolls, totals, question paging, download, resets'); await ctx.close();
    }
  } finally { if (browser) await browser.close(); await new Promise(r => server.close(r)); }
})().catch(e => { console.error(e); process.exitCode = 1; });
