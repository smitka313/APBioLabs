/* Real browser navigation with intercepted pages; no external site dependency. */
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const script = fs.readFileSync(path.join(__dirname, '../domain-redirect.js'), 'utf8');
    for (const saved of [false, true]) {
      const context = await browser.newContext();
      try {
        if (saved) await context.addInitScript(() => {
          if (location.hostname === 'smitka313.github.io') localStorage.setItem('aplab:lab09:field:cer', JSON.stringify('My answer'));
        });
        await context.route('**/*', route => {
          const old = new URL(route.request().url()).hostname === 'smitka313.github.io';
          return route.fulfill({ contentType: 'text/html', body: old
            ? '<html><head><script>' + script + '</script></head><body>Old lab</body></html>'
            : '<html><body>New lab</body></html>' });
        });
        const page = await context.newPage();
        await page.goto('https://smitka313.github.io/APBioLabs/lab09.html?mode=projector#analysis');
        if (saved) {
          await page.locator('#domain-move-notice').waitFor();
          assert.equal(new URL(page.url()).hostname, 'smitka313.github.io');
          assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('aplab:lab09:field:cer'))), 'My answer');
          await page.getByRole('link', { name: 'Go to biologylabbench.com' }).click();
        }
        await page.waitForURL('https://biologylabbench.com/lab09.html?mode=projector#analysis');
        assert.equal(await page.locator('#domain-move-notice').count(), 0);
        console.log(saved ? 'PASS: saved answer preserved and migration link works' : 'PASS: automatic redirect preserves lab, query and fragment');
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
