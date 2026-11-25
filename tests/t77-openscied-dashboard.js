const T = require('./_h');
const assert = require('node:assert/strict');
const fs = require('node:fs');
(async () => {
  const browser = await T.launch();
  const server = await T.serve();
  try {
    for (const width of [1440, 390]) {
      const ctx = await T.ctxFor(browser, { width, height: 1000 });
      const p = await T.open(ctx, 'openscied-dashboard.html', '', server.url);
      // Start as a guest after the shared helper has seeded its tour flags.
      // Do this once, rather than removing identity from a page-init script on reload.
      await p.evaluate(() => localStorage.removeItem('aplab:student'));
      await p.reload();
      assert.deepEqual(await p.locator('.dashboard-units > section.dashboard-unit.current').evaluateAll(units=>units.map(unit=>unit.getAttribute('aria-labelledby'))),
        ['unit1','unit2','unit3','unit4','unit5'], 'published units are listed in curriculum order');
      assert.equal(await p.locator('.dashboard-activity').first().locator('.dashboard-preview').getAttribute('href'), 'openscied-b1-migration.html');
      assert.equal(await p.locator('#wapusk-open').getAttribute('href'),'openscied-b5-wapusk.html');
      const meta = await p.locator('.dashboard-meta').allTextContents();
      assert.equal(meta.length, 22);
      assert.ok(meta.every(label=>/\bmin(?:utes)?\b|class periods/.test(label)), 'every entry has a pacing estimate');
      const theme = p.getByRole('group', { name: 'Color theme', exact: true });
      assert.equal(await theme.count(), 1);
      const palette = () => p.evaluate(() => ({
        background: getComputedStyle(document.body).backgroundColor,
        card: getComputedStyle(document.querySelector('.dashboard-unit')).backgroundColor
      }));
      for (const system of ['light', 'dark']) {
        await p.emulateMedia({ colorScheme: system });
        await theme.getByRole('button', { name: 'Light', exact: true }).click();
        const light = await palette();
        assert.equal(light.background, 'rgb(243, 246, 244)');
        assert.equal(light.card, 'rgb(255, 255, 255)');
        await theme.getByRole('button', { name: 'Dark', exact: true }).click();
        const dark = await palette();
        assert.equal(dark.background, 'rgb(15, 22, 19)');
        assert.notEqual(dark.card, light.card);
        await theme.getByRole('button', { name: 'Auto', exact: true }).click();
        assert.equal(await theme.getByRole('button', { name: 'Auto', exact: true }).getAttribute('aria-pressed'), 'true');
        assert.deepEqual(await palette(), system === 'light' ? light : dark);
        assert.equal(await p.evaluate(() => localStorage.getItem('aplab:pref:theme')), null);
      }
      await p.emulateMedia({ colorScheme: 'light' });
      await theme.getByRole('button', { name: 'Dark', exact: true }).click();
      await p.reload();
      assert.equal((await palette()).background, 'rgb(15, 22, 19)', 'manual theme survives reload');
      assert.equal(await theme.getByRole('button', { name: 'Dark', exact: true }).getAttribute('aria-pressed'), 'true');
      const identity = p.locator('#openscied-student-identity');
      await identity.getByLabel('Enter your name as your teacher knows it').fill('Casey Student');
      await identity.getByLabel('Class period', { exact: true }).selectOption('3');
      await identity.getByRole('button', { name: 'Save', exact: true }).click();
      assert.match(await identity.textContent(), /Signed in as Casey Student/);
      await p.evaluate(() => {
        localStorage.setItem('aplab:openscied:b3-cell-cycle:v1', JSON.stringify({v: 1, trials: [], fields: {'analysis-design': 'My evidence'}, lastSection: 'analyze', lastVisitedAt: Date.now()}));
        localStorage.setItem('aplab:openscied:other-activity:v1', '{"keep":"other activity"}');
        localStorage.setItem('aplab:lab05:sim:test', JSON.stringify({rate: 4}));
        localStorage.setItem('aplab:pref:theme', 'dark');
      });
      await p.reload();
      assert.match(await identity.textContent(), /Casey Student/);
      assert.match(await p.locator('#cell-cycle-progress').textContent(), /1 of 31 responses/);
      assert.equal(await p.locator('#openscied-resume-link').getAttribute('href'), 'openscied-b3-cell-cycle.html#analyze');
      // Open the actual activity using Resume and verify its section and saved answer.
      await p.locator('#openscied-resume-link').click();
      await p.waitForFunction(() => document.querySelector('#analyze.is-current'));
      assert.equal(await p.locator('#analysis-design').inputValue(), 'My evidence');
      await p.goto(server.url + 'openscied-dashboard.html');
      await p.locator('#cell-cycle-reset').click();
      await p.locator('#cancel-openscied-clear').click();
      assert.ok(await p.evaluate(() => localStorage.getItem('aplab:openscied:b3-cell-cycle:v1')));
      await p.locator('#cell-cycle-reset').click();
      await p.locator('#openscied-erase-confirmation').fill('ERASE');
      await p.locator('#confirm-openscied-clear').click();
      assert.equal(await p.evaluate(() => localStorage.getItem('aplab:openscied:b3-cell-cycle:v1')), null);
      assert.equal(await p.evaluate(() => localStorage.getItem('aplab:openscied:other-activity:v1')), '{"keep":"other activity"}');
      assert.equal(await p.locator('#openscied-resume').isVisible(), false);
      assert.equal(await p.locator('#cell-cycle-progress').textContent(), 'Not started');
      // Restore only the synthetic fixture to exercise the all-OpenSciEd clear path too.
      await p.evaluate(() => localStorage.setItem('aplab:openscied:b3-cell-cycle:v1', '{"v":1,"fields":{"analysis-design":"My evidence"}}'));
      await p.reload();
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
      const backup = await download;
      assert.equal(backup.suggestedFilename(), 'openscied-saved-work.json');
      assert.equal(JSON.parse(fs.readFileSync(await backup.path(), 'utf8')).student, null);
      assert.match(await dialog.locator('#openscied-backup-status').textContent(), /Backup download started/);
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
      assert.equal(saved.theme, 'dark');
      assert.equal(await clear.isDisabled(), true);
      await p.reload();
      assert.equal(await clear.isDisabled(), true, 'cleared results stay cleared after reload');
      await identity.getByRole('button', { name: 'Edit my name or class period', exact: true }).click();
      await identity.getByLabel('Class period', { exact: true }).selectOption('4');
      await identity.getByRole('button', { name: 'Save', exact: true }).click();
      assert.match(await identity.textContent(), /Period 4/);
      const juncoKey = 'aplab:openscied:b4-junco:v1';
      const fictional = JSON.stringify({ prediction:'city', claim:'Example evidence for this test' });
      await p.evaluate(({key, raw}) => localStorage.setItem(key, raw), { key:juncoKey, raw:fictional });
      await p.reload();
      const unitNav = p.getByRole('navigation', { name:'Jump to a unit' });
      await unitNav.getByRole('link', { name:'Unit 4 Natural selection' }).press('Enter');
      await p.waitForFunction(() => location.hash === '#unit4');
      assert.equal(await p.locator('#unit4').evaluate(el => el === document.activeElement), true);
      assert.equal(await p.locator('.dashboard-activity').last().getByRole('link').count(), 1);
      assert.equal(await p.getByRole('link', { name:'Continue activity: Junco Investigation' }).isVisible(), true);
      const switchStudent = identity.getByRole('button', { name: 'Switch student', exact: true });
      await switchStudent.click();
      const switchDialog = p.getByRole('alertdialog');
      assert.equal(await switchDialog.isVisible(), true);
      const transfer = p.waitForEvent('download');
      await switchDialog.getByRole('button', { name:'Download OpenSciEd backup', exact:true }).click();
      const beforeSwitch = JSON.parse(fs.readFileSync(await (await transfer).path(), 'utf8'));
      assert.equal(beforeSwitch.student, null);
      assert.equal(beforeSwitch.work[juncoKey], fictional);
      assert.equal(beforeSwitch.responses.junco.claim, 'Example evidence for this test');
      await switchDialog.getByRole('button', { name: 'Cancel', exact: true }).click();
      assert.equal(await p.evaluate(key=>localStorage.getItem(key), juncoKey), fictional);
      assert.equal(await p.locator('.dashboard-hero-art').evaluate(el => el.complete && el.naturalWidth === 2048), true);
      assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      assert.deepEqual(p.errors, []);
      T.ok(true, width + 'px: Light/Dark/Auto, theme persistence, sign-in, backup, clear, and AP work preservation');
      await ctx.close();
    }
  } finally { await browser.close(); server.close(); }
  T.done('openscied-dashboard');
})().catch(e => { console.error(e); process.exitCode = 1; });


