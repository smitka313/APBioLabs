'use strict';

// These are real same-origin tabs and real UI writes. No preloaded identity,
// saved answers, or mock storage events may mask a cross-tab regression.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { serve } = require('./_h');
const DASHBOARD = 'openscied-dashboard.html';
const MIGRATION = 'openscied-b1-migration.html';
const JUNCO = 'openscied-b4-junco.html';
const MIGRATION_KEY = 'aplab:openscied:b1-migration:v1';
const JUNCO_KEY = 'aplab:openscied:b4-junco:v1';
const FIRST = 'The map shows this group on the southern plains.';
const SECOND = 'In the field chart, the city birds let the observer get closer.';
const REVISED = 'The labels put this group on the southern plains in January.';

async function setup(page) {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.setDefaultTimeout(8000);
  return errors;
}
const read = (page, key) => page.evaluate(key => JSON.parse(localStorage.getItem(key) || 'null'), key);
const destination = (page, activity) => page.waitForFunction(({ activity }) => {
  const section = document.querySelector('#openscied-resume');
  const link = document.querySelector('#openscied-resume-link');
  return section && !section.hidden && new URL(link.href).pathname.endsWith('/' + activity);
}, { activity });

(async () => {
  const server = await serve();
  let browser;
  let checks = 0;
  const pass = message => { checks++; console.log('ok: ' + message); };
  try {
    const executablePath = process.env.CHROMIUM_PATH || process.env.CHROMIUM_EXECUTABLE;
    browser = await chromium.launch(executablePath ? { executablePath } : {});
    const context = await browser.newContext({ viewport:{ width:1366, height:768 }, reducedMotion:'reduce' });
    const origin = new URL(server.url).origin;
    await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    const dashboard = await context.newPage();
    const edit = await context.newPage();
    const errors = await setup(dashboard), editErrors = await setup(edit);
    const go = (page, file) => page.goto(new URL(file, server.url).href);
    const section = dashboard.locator('#openscied-resume');
    await go(dashboard, DASHBOARD);
    await dashboard.waitForFunction(() => typeof window.OpenSciEdResume?.connect === 'function' &&
      document.querySelector('#openscied-results-status')?.textContent.includes('No saved work yet'));
    assert.equal(await section.isHidden(), true);
    assert.equal(await read(dashboard, 'aplab:student'), null);
    pass('clean guest profile has no Resume destination and is not signed in');

    // Simulate slow delivery of the asynchronously loaded tracker, with the
    // actual activity code and two real same-origin tabs running normally.
    let release;
    const trackerDelay=new Promise(resolve=>{release=resolve;});
    const delayed='**/openscied-resume.js*';
    await edit.route(delayed,async route=>{await trackerDelay;await route.continue();});
    await edit.goto(new URL(MIGRATION,server.url).href,{waitUntil:'domcontentloaded'});
    const note = edit.locator('#observation');
    const weather = edit.locator('#weather');
    await note.waitFor({ state:'visible' });
    await weather.uncheck();
    await edit.waitForFunction(key => localStorage.getItem(key) !== null, MIGRATION_KEY);
    await dashboard.reload();
    assert.equal(await section.isHidden(), true);
    pass('a display setting writes storage but does not create a Resume destination');

    await note.fill(FIRST);
    await edit.locator('#record').click();
    await destination(dashboard, MIGRATION);
    assert.equal((await read(dashboard, MIGRATION_KEY)).notes.some(n => n.observation === FIRST), true);
    const saved=(await read(edit,MIGRATION_KEY)).lastVisitedAt;
    await edit.waitForFunction(stamp=>Date.now()>stamp+25,saved);
    await weather.check();
    const nav=(await read(edit,MIGRATION_KEY)).lastVisitedAt;
    assert.ok(nav>saved);
    release();
    await edit.waitForFunction(()=>typeof window.OpenSciEdResume?.recordSave==='function');
    await edit.unroute(delayed);
    const receipt=await read(dashboard,'aplab:pref:openscied-resume:v1:b1-migration');
    assert.ok(receipt.changed>=saved && receipt.changed<nav,'late tracker keeps a real edit above a subsequent display write');
    assert.match(await dashboard.locator('#openscied-resume-link').textContent(), /continue my saved/i);
    await dashboard.reload();
    await destination(dashboard, MIGRATION);
    pass('another tab promotes a real notebook entry; dashboard reload retains it');

    // Reuse the dashboard's tab to create genuinely newer work in another activity,
    // leaving the old activity open. A subsequent view change must not outrank Junco.
    await dashboard.locator('#junco-open').click();
    await dashboard.locator('#ju-field-entry').fill(SECOND);
    assert.equal((await read(dashboard, JUNCO_KEY)).observation, SECOND);
    await go(dashboard, DASHBOARD);
    await destination(dashboard, JUNCO);
    await weather.uncheck();
    await dashboard.reload();
    await destination(dashboard, JUNCO);
    pass('new observation outranks an older activity even when the older tab changes a setting');

    const restart = dashboard.locator('#migration-reset');
    const dialog = dashboard.locator('#clear-openscied-dialog');
    const confirm = dashboard.locator('#confirm-openscied-clear');
    const typed = dashboard.locator('#openscied-erase-confirmation');
    await restart.click();
    await dialog.waitFor({ state:'visible' });
    await typed.fill('erase');
    assert.equal(await confirm.isDisabled(), true);
    await typed.fill('ERASE');
    await note.fill(REVISED);
    await edit.locator('#record').click();
    assert.equal((await read(edit, MIGRATION_KEY)).notes.some(n => n.observation === REVISED), true);
    await confirm.click();
    await dashboard.waitForFunction(() => document.querySelector('#openscied-clear-error')?.textContent.includes('changed while this dialog was open'));
    assert.equal((await read(dashboard, MIGRATION_KEY)).notes.some(n => n.observation === REVISED), true);
    pass('confirmation rejects lowercase and does not erase a note changed by another tab while open');

    await dashboard.locator('#cancel-openscied-clear').click();
    await dialog.waitFor({ state:'hidden' });
    await restart.click();
    await typed.fill('ERASE');
    await confirm.click();
    await dialog.waitFor({ state:'hidden' });
    assert.equal(await read(dashboard, MIGRATION_KEY), null);
    assert.equal((await read(dashboard, JUNCO_KEY)).observation, SECOND);
    await destination(dashboard, JUNCO);
    pass('fresh confirmation clears only the selected activity and retains real work elsewhere');

    const conflict = edit.locator('#save-conflict');
    await conflict.waitFor({ state:'visible' });
    assert.match(await conflict.textContent(), /cleared in another tab/i);
    await note.fill('This old tab must not resurrect an erased note.');
    assert.equal(await read(dashboard, MIGRATION_KEY), null);
    await edit.reload();
    await edit.locator('#observation').waitFor({ state:'visible' });
    assert.equal(await edit.locator('#observation').inputValue(), '');
    await dashboard.reload();
    await destination(dashboard, JUNCO);
    assert.equal(await restart.isDisabled(), true);
    assert.deepEqual([...errors, ...editErrors], []);
    pass('the old tab cannot resurrect cleared work; reloading opens a blank and reusable activity');
    console.log('t148-openscied-resume-tabs: ' + checks + '/' + checks + ' checks passed');
  } finally {
    if (browser) await browser.close();
    server.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
