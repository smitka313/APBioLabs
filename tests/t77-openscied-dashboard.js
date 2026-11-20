const T = require('./_h');
const assert = require('node:assert/strict');
(async () => {
  const browser = await T.launch();
  try {
    for (const width of [1440, 390]) {
      const ctx = await T.ctxFor(browser, { width, height: 1000 });
      await ctx.addInitScript(() => {
        if (!sessionStorage.getItem('openscied-guest-test')) {
          localStorage.removeItem('aplab:student');
          sessionStorage.setItem('openscied-guest-test', '1');
        }
      });
      const p = await T.open(ctx, 'openscied-dashboard.html');
      const identity = p.locator('#openscied-student-identity');
      await identity.getByLabel('Enter your name as your teacher knows it').fill('Casey Student');
      await identity.getByLabel('Class period').selectOption('3');
      await identity.getByRole('button', { name: 'Save', exact: true }).click();
      assert.match(await identity.textContent(), /Signed in as Casey Student/);
      await p.evaluate(() => {
        localStorage.setItem('aplab:openscied:b3-cell-cycle:v1', JSON.stringify({v: 1, trials: [], fields: {'analysis-design': 'My evidence'}}));
        localStorage.setItem('aplab:lab05:sim:test', JSON.stringify({rate: 4}));
        localStorage.setItem('aplab:pref:theme', '"dark"');
      });
      await p.reload();
      assert.match(await identity.textContent(), /Casey Student/);
      const clear = p.locator('#clear-openscied-results');
      await clear.click();
      const dialog = p.locator('#clear-openscied-dialog');
      assert.equal(await dialog.isVisible(), true);
      assert.equal(await p.locator('#confirm-openscied-clear').isDisabled(), true);
      await p.locator('#cancel-openscied-clear').click();
      assert.ok(await p.evaluate(() => localStorage.getItem('aplab:openscied:b3-cell-cycle:v1')));
      await clear.click();
      await p.keyboard.press('Escape');
      assert.equal(await dialog.isVisible(), false);
      await clear.click();
      const download = p.waitForEvent('download');
      await p.locator('#backup-before-openscied-clear').click();
      assert.equal((await download).suggestedFilename(), 'openscied-saved-work.json');
      await p.locator('#openscied-erase-confirmation').fill('ERASE');
      await p.locator('#confirm-openscied-clear').click();
      assert.equal(await dialog.isVisible(), false);
      const saved = await p.evaluate(() => ({ identity: JSON.parse(localStorage.getItem('aplab:student')),
        activity: localStorage.getItem('aplab:openscied:b3-cell-cycle:v1'),
        ap: localStorage.getItem('aplab:lab05:sim:test'), theme: localStorage.getItem('aplab:pref:theme') }));
      assert.equal(saved.identity.name, 'Casey Student');
      assert.equal(saved.identity.period, '3');
      assert.equal(saved.activity, null);
      assert.equal(saved.ap, '{"rate":4}');
      assert.equal(saved.theme, '"dark"');
      assert.equal(await clear.isDisabled(), true);
      await p.reload();
      assert.equal(await clear.isDisabled(), true, 'cleared results stay cleared after reload');
      await identity.getByRole('button', { name: 'Change name or class period', exact: true }).click();
      await identity.getByLabel('Class period').selectOption('4');
      await identity.getByRole('button', { name: 'Save', exact: true }).click();
      assert.match(await identity.textContent(), /Period 4/);
      await identity.getByRole('button', { name: 'Sign out', exact: true }).click();
      assert.equal(await p.getByRole('alertdialog').isVisible(), true);
      await p.getByRole('alertdialog').getByRole('button', { name: 'Cancel', exact: true }).click();
      assert.equal(await p.locator('.dashboard-hero-art').evaluate(el => el.complete && el.naturalWidth === 2048), true);
      assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      assert.deepEqual(p.errors, []);
      T.ok(true, width + 'px: sign-in, change, backup, cancel, clear, reload, and AP work preservation');
      await ctx.close();
    }
  } finally { await browser.close(); }
  T.done('openscied-dashboard');
})().catch(e => { console.error(e); process.exitCode = 1; });
