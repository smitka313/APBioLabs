const assert = require('node:assert/strict');
const fs = require('node:fs');
const { ROOT, launch, serve, ctxFor } = require('./_h');

async function setUp(page, file) {
  if (file === 'openscied-b1-migration.html') {
    await page.locator('[data-page="evidence"]').click();
    return () => page.locator('[data-page="explore"]').click();
  }
  if (file === 'openscied-b1-serengeti.html') {
    await page.locator('#sg-help').click();
    return () => page.getByRole('button', {name:'Close instructions'}).click();
  }
  await page.locator('.step-nav a[href="#families"]').click();
  return () => page.locator('.step-nav a[href="#ideas"]').click();
}

(async () => {
  const server = await serve(), browser = await launch();
  try {
    for (const width of [390, 768, 1366, 1920]) {
      const context = await ctxFor(browser, { width, dark: width === 390 });
      const requests = [];
      await context.route('https://www.youtube-nocookie.com/**', route => {
        requests.push(new URL(route.request().url()).pathname);
        return route.fulfill({ contentType: 'text/html',
          body: '<!doctype html><html lang="en"><title>Player test stand-in</title><body style="margin:0;background:#141719;color:#fff;font:20px system-ui;display:grid;min-height:100vh;place-items:center"><button>Play video</button></body></html>' });
      });
      try {
        const page = await context.newPage();
        for (const [file, ids] of [
          ['openscied-b1-migration.html', ['PGGslSmDlCI']],
          ['openscied-b1-serengeti.html', ['6-ooaGN1lSk']],
          ['openscied-b3-inheritance-environment.html', ['U1Zifbvvl0Q','ux7obpTlkbU','-NhqJRIJJsw']],
        ]) {
          await page.goto(server.url + file, {waitUntil:'domcontentloaded'});
          const leave = await setUp(page, file);
          const cards = page.locator('details.ose-video');
          assert.equal(await cards.count(), ids.length);
          assert.equal(await cards.locator('iframe').count(), 0, 'no player loads without choosing a clip');
          for (const [i, id] of ids.entries()) {
            const card = cards.nth(i), summary = card.locator('summary'), oldRequests = requests.length;
            await summary.scrollIntoViewIfNeeded();
            const keyboard = file === 'openscied-b1-migration.html';
            if (keyboard) await summary.press('Enter');
            else await summary.click();
            const frame = card.locator('iframe');
            try { await frame.waitFor({ timeout: 8000 }); }
            catch (error) {
              const state=await card.evaluate(node=>({ open:node.open, hidden:!!node.closest('[hidden],[inert],dialog:not([open])'), rects:node.getClientRects().length, active:document.activeElement?.tagName }));
              throw new Error(width+'px '+file+' clip '+id+' did not open: '+JSON.stringify(state),{cause:error});
            }
            await card.frameLocator('iframe').getByRole('button', {name:'Play video'}).waitFor();
            assert.equal(requests.length, oldRequests + 1);
            assert.equal(requests.at(-1), '/embed/' + id);
            const box = await frame.boundingBox();
            assert.ok(box && box.x >= 0 && box.x + box.width <= width + 1 && box.height >= 200, 'player fits viewport');
            assert.ok(await card.locator('a[target="_blank"]').isVisible(), 'fallback is visible');
            if (i + 1 < ids.length) {
              await summary.click();
              await frame.waitFor({state:'detached'});
            }
          }
          fs.mkdirSync(ROOT + '/test-artifacts/ose-video', {recursive:true});
          await page.screenshot({path:ROOT + '/test-artifacts/ose-video/' + width + '-' + file.replace('.html','.png')});
          await leave();
          await cards.locator('iframe').waitFor({state:'detached'});
          assert.equal(await cards.locator('iframe').count(), 0, 'leaving the section or dialog stops playback');
        }
      } finally { await context.close(); }
    }
    console.log('OpenSciEd videos: all five original clips, keyboard, fallback, teardown and fit at four viewport widths verified with a stubbed provider.');
  } finally { await browser.close(); await server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
