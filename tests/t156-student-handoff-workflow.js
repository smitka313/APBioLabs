'use strict';
// User-facing AP import and OpenSciEd save/report paths, in genuinely fresh profiles.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const T = require('./_h');

const ap = 'lab05.html';
const ose = 'openscied-b1-migration.html';
const oseKey = 'aplab:openscied:b1-migration:v1';
const apAnswer = 'The leaf disks with added carbon dioxide rose sooner in my run.';
const note = 'The modeled herd is on the southern plains in January.';

async function fresh(browser, origin, size, dark) {
  const context = await browser.newContext({ viewport: size, colorScheme: dark ? 'dark' : 'light',
    reducedMotion: 'reduce', acceptDownloads: true });
  await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  return { context, page, errors };
}

async function transfer(page) {
  const saved = page.getByRole('region', { name: 'Where your work is saved' });
  assert.match(await saved.innerText(), /browser only; it has not been sent to your teacher/);
  await saved.getByRole('button', { name: 'Show device transfer steps' }).press('Enter');
  const details = page.locator('details.move-work');
  assert.equal(await details.evaluate(node => node.open && node.querySelector('summary') === document.activeElement), true);
  assert.match(await details.innerText(), /same lab.*Submit/s);
  assert.match(await details.innerText(), /Word or PDF report cannot restore editable lab progress/);
  return details;
}

(async () => {
  const server = await T.serve();
  let browser;
  try {
    browser = await T.launch();
    const origin = new URL(server.url).origin;
    const desktop = await fresh(browser, origin, { width: 1366, height: 768 }, false);
    const phone = await fresh(browser, origin, { width: 390, height: 844 }, true);
    try {
      const a = desktop.page, b = phone.page;
      assert.deepEqual(await desktop.context.cookies(), []);
      assert.deepEqual(await phone.context.cookies(), []);
      await a.goto(server.url + ap + '#analyze');
      const prompt = a.locator('#analyze textarea[data-save]').first();
      await prompt.fill(apAnswer);
      const answerKey = await prompt.getAttribute('data-save');
      await a.waitForFunction(({ answerKey, apAnswer }) => Lab.store.get('field:' + answerKey) === apAnswer, { answerKey, apAnswer });

      await a.evaluate(() => Lab.pages.go('submit'));
      const ready = a.getByRole('region', { name: 'Submission readiness' });
      assert.match(await ready.innerText(), /activit(?:y|ies) remaining/);
      const details = await transfer(a);
      const download = a.waitForEvent('download');
      await details.getByRole('button', { name: 'Save progress file', exact: true }).click();
      const file = await download;
      assert.equal(await file.failure(), null);
      const bytes = fs.readFileSync(await file.path());
      const backup = JSON.parse(bytes);
      assert.equal(backup.data['field:' + answerKey], apAnswer);
      assert.ok(backup.datasetId);

      await b.goto(server.url + ap + '#submit');
      assert.equal(await b.evaluate(key => Lab.store.get('field:' + key), answerKey), null, 'new profile does not sync the answer');
      const incoming = await transfer(b);
      await incoming.locator('input[type=file]').setInputFiles({
        name: file.suggestedFilename(), mimeType: 'application/json', buffer: bytes
      });
      assert.equal(await b.evaluate(key => Lab.store.get('field:' + key), answerKey), null, 'file is not applied before consent');
      await Promise.all([b.waitForNavigation(), incoming.getByRole('button', { name: 'Replace my work', exact: true }).click()]);
      await b.waitForFunction(({ key, answer }) => globalThis.Lab?.store.get('field:' + key) === answer, { key: answerKey, answer: apAnswer });
      assert.equal(await b.evaluate(() => Lab.progressFile.payload(true).datasetId), backup.datasetId);
      assert.equal(await b.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), true);

      await a.goto(server.url + ose);
      await a.locator('#observation').fill(note);
      await a.locator('#record').click();
      await a.waitForFunction(({ oseKey, note }) => JSON.parse(localStorage.getItem(oseKey) || 'null')?.notes?.some(row => row.observation === note), { oseKey, note });
      await a.reload();
      await a.locator('[data-page="explain"]').click();
      await a.getByRole('button', { name:'Preview report', exact:true }).filter({ visible:true }).first().click();
      const dialog = a.locator('dialog.osr-dialog[open]');
      assert.match(await dialog.innerText(), /For a complete report, finish the items under “Still to do”/);
      assert.match(await dialog.innerText(), /same browser profile.*neither a report nor a dashboard backup can restore editable OpenSciEd work/);
      assert.ok((await dialog.innerText()).includes(note), 'reloaded report contains this profile’s saved note');
      assert.equal(await dialog.getByRole('button', { name:'Print or save as PDF', exact:true }).isEnabled(), true);

      await b.goto(server.url + ose);
      assert.equal(await b.evaluate(key => JSON.parse(localStorage.getItem(key) || 'null')?.notes?.length || 0, oseKey), 0);
      await b.goto(server.url + 'openscied-dashboard.html');
      assert.match(await b.locator('#openscied-backup-help').innerText(), /cannot be loaded back into an activity/);
      assert.ok(await b.locator('#download-openscied-results').isDisabled(), 'no work to archive in this other profile');
      assert.deepEqual([...desktop.errors, ...phone.errors], []);
      console.log('PASS: AP transfer keeps answers and Dataset ID; OpenSciEd edits stay local; draft and turn-in instructions are visible.');
    } finally {
      await desktop.context.close();
      await phone.context.close();
    }
  } finally {
    if (browser) await browser.close();
    server.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
