'use strict';

// Fast check of the student experience on a fresh repository checkout. No production
// traffic or fixture storage. Word uses the same pinned offline library as the other tests.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const { chromium } = require('playwright');
const JSZip = require('./fixtures/jszip-3.10.1.min.js');
const { routeLibs, serve } = require('./_h');

const AP = 'lab01.html';
const MIGRATION = 'openscied-b1-migration.html';
const apName = 'Classroom Smoke AP';
const apAnswer = 'Selection can shift the population average when variation is heritable.';
const oseName = 'Classroom Smoke Explorer';
const oseNote = 'The modeled herd starts near the southern plains in January.';
const href = file => new RegExp('/' + file.replace(/\./g, '\\.') + '(?:#|$)');

async function wordDocument(page, button, name, work) {
  const [file] = await Promise.all([
    page.waitForEvent('download', { timeout: 15_000 }),
    button.click()
  ]);
  assert.match(file.suggestedFilename(), /\.docx$/i);
  assert.equal(await file.failure(), null, 'Word download completed');
  const archive = await JSZip.loadAsync(await fs.readFile(await file.path()));
  const document = archive.file('word/document.xml');
  assert.ok(document, 'download contains the Word document');
  const xml = await document.async('string');
  const printedText = [...xml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map(match => match[1]).join(' ');
  assert.ok(printedText.includes(name), 'the Word report contains this profile’s name');
  assert.ok(printedText.includes(work), 'the Word report contains the work saved by this profile');
}

async function newStudent(page, host, name, period) {
  const form = page.locator(host).locator('form.id-panel');
  await form.waitFor();
  assert.equal(await form.locator('input').inputValue(), '', 'there is no prior student in a fresh profile');
  await form.locator('input').fill(name);
  await form.locator('select').selectOption(period);
  await form.locator('button[type=submit]').click();
  await page.locator(host).locator('.id-line strong').filter({ hasText: name }).waitFor();
}

async function verifyAP(page, go) {
  await go(AP);
  await newStudent(page, '.id-host', apName, '2');
  await page.locator('.tour-skip').click();
  const navigate = step => page.locator('.step-nav a[href="#' + step + '"]').click();

  await navigate('analyze');
  const response = page.locator('#p-cer-reasoning');
  assert.equal(await response.inputValue(), '', 'there is no prior answer in a fresh profile');
  await response.fill(apAnswer);
  // Blurring uses the regular autosave path; do not inject a key or force a save.
  await response.press('Tab');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await response.waitFor();
  assert.equal(await response.inputValue(), apAnswer, 'AP answer restored after reload');

  await page.locator('.lab-header a[href="ap-biology.html"]').click();
  const resume = page.locator('#resume a.resume-link');
  await resume.click();
  await page.waitForURL(href(AP));
  assert.equal(new URL(page.url()).hash, '#analyze');
  await response.waitFor();
  assert.equal(await response.inputValue(), apAnswer, 'AP dashboard resumes the saved part and answer');

  await navigate('submit');
  await wordDocument(page, page.locator('#lab-report-download-word'), apName, apAnswer);
}

async function verifyOpenSciEd(page, go) {
  await go(MIGRATION);
  await page.locator('details.mx-identity > summary').click();
  await newStudent(page, '#migration-identity', oseName, '3');
  const observation = page.locator('#observation');
  assert.equal(await observation.inputValue(), '', 'there is no prior note in a fresh profile');
  await observation.fill(oseNote);
  await page.locator('#record').click();
  await page.locator('#note-count').filter({ hasText: /^1$/ }).waitFor({ state: 'attached' });

  await page.reload({ waitUntil: 'domcontentloaded' });
  await observation.waitFor();
  assert.equal(await observation.inputValue(), oseNote, 'OpenSciEd note restored after reload');

  await page.locator('.mx-top a[href="openscied-dashboard.html"]').click();
  await page.locator('#openscied-resume-link').click();
  await page.waitForURL(href(MIGRATION));
  await observation.waitFor();
  assert.equal(await observation.inputValue(), oseNote, 'OpenSciEd dashboard resumes the saved note');

  await page.locator('button[data-page="explain"]').click();
  await page.locator('[data-ose-report-final] .osr-actions').getByRole('button', { name: 'Preview report', exact: true }).click();
  const report = page.locator('dialog.osr-dialog[open]');
  await report.getByText(oseNote, { exact: false }).waitFor();
  await wordDocument(page, report.getByRole('button', { name: 'Download Word (.docx)', exact: true }), oseName, oseNote);
}

async function inFreshProfile(browser, server, label, fn) {
  const profile = await browser.newContext({ reducedMotion: 'reduce', acceptDownloads: true });
  try {
    const origin = new URL(server.url).origin;
    await profile.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await routeLibs(profile); // specific routes registered last override the block for pinned libraries only
    const page = await profile.newPage();
    page.setDefaultTimeout(9_000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const go = async file => {
      const response = await page.goto(new URL(file, server.url).href, { waitUntil: 'domcontentloaded' });
      assert.ok(response?.ok(), 'assignment route loads: ' + file);
    };
    await fn(page, go);
    assert.deepEqual(errors, [], label + ': no uncaught page errors');
    console.log('PASS ' + label + ': assignment, work, reload, resume and Word contents');
  } finally { await profile.close(); }
}

(async () => {
  const server = await serve();
  let browser;
  try {
    const executablePath = process.env.CHROMIUM_PATH || process.env.CHROMIUM_EXECUTABLE;
    browser = await chromium.launch(executablePath ? { executablePath } : {});
    await inFreshProfile(browser, server, 'AP Biology', verifyAP);
    await inFreshProfile(browser, server, 'OpenSciEd', verifyOpenSciEd);
  } finally {
    if (browser) await browser.close();
    server.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
