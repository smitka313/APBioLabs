'use strict';

// Exercise the real public guide and encrypted lock shell. Only throwaway
// pages use a known password; the production credential stays out of CI.
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require('playwright');
const { serve, ROOT } = require('./_h');

const GUIDE = 'openscied-teacher-guide.html';
const NOTES = 'openscied-teacher-notes.html';
const AP_NOTES = 'teacher-notes.html';
const OUT = path.join(ROOT, 'artifacts', 'openscied-teacher-guide');
const AXE = require.resolve('axe-core/axe.min.js');
const VIEWPORTS = [
  { width: 390, height: 844, dark: true },
  { width: 768, height: 1024 },
  { width: 1366, height: 768 },
  { width: 1920, height: 1080 }
];
const EXAMPLE_HEADING = 'OpenSciEd worked examples';
const FIXTURE_HEADING = 'Synthetic OpenSciEd fixture unlocked';
const FIXTURE_AP_HEADING = 'Synthetic AP fixture unlocked';
let checks = 0;
function check(test, msg) {
  assert.ok(test, msg);
  console.log('ok: ' + msg);
  checks++;
}
function heading(page, name) {
  return page.getByRole('heading', { name, level: 1, exact: true });
}
function link(page, target) {
  return page.locator('a[href="' + target + '"]').filter({ visible: true }).first();
}
async function shot(page, label, fullPage = true) {
  await page.screenshot({ path: path.join(OUT, label + '.png'), fullPage, animations: 'disabled', timeout: 12000 });
}
async function loaded(page, name) {
  await heading(page, name).waitFor();
  check(await heading(page, name).count() === 1, 'one main heading: ' + name);
}
async function fits(page, selector, label) {
  const problems = await page.locator(selector).evaluateAll(nodes => {
    const boundary = document.documentElement.clientWidth;
    return nodes.filter(node => {
      const rect = node.getBoundingClientRect();
      return rect.width <= 0 || rect.left < -1 || rect.right > boundary + 1 ||
        document.documentElement.scrollWidth > boundary + 1;
    }).map(node => node.getAttribute('data-guide-for') || node.tagName);
  });
  check(problems.length === 0, label + ' fits the viewport: ' + problems.join(', '));
}
async function axe(page, label, scope) {
  if (!await page.evaluate(() => Boolean(window.axe))) await page.addScriptTag({ path: AXE });
  const violations = await page.evaluate(async target => {
    const result = await window.axe.run(target, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
      resultTypes: ['violations']
    });
    return result.violations.map(v => [v.id, v.nodes.map(n => n.target)]);
  }, scope);
  check(!violations.length, label + ' accessibility: ' + JSON.stringify(violations));
}
async function browserContext(browser, base, viewport) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    colorScheme: viewport.dark ? 'dark' : 'light', reducedMotion: 'reduce',
    hasTouch: viewport.width === 390
  });
  const origin = new URL(base).origin;
  // All exercised assets and fixtures are local; suppress remote counts/fonts.
  await context.route('**/*', route => new URL(route.request().url()).origin === origin
    ? route.continue() : route.abort());
  return context;
}
async function publicReading(page, viewport, label) {
  const inventory = await page.evaluate(() => {
    const index = document.querySelector('nav.teacher-guide-index');
    const cards = [...document.querySelectorAll('article[data-guide-for]')];
    const ids = new Set(cards.map(card => card.id));
    return {
      cards: cards.length,
      idCount: ids.size,
      anchors: [...(index?.querySelectorAll('a[href^="#guide-"]') || [])].map(a => a.hash.slice(1)),
      unitAnchors: [...(index?.querySelectorAll('a[href^="#unit"]') || [])].map(a => a.hash),
      unitSections: [...document.querySelectorAll('.ose-teacher-unit')].map(unit => '#' + unit.getAttribute('aria-labelledby')),
      ids: [...ids],
      summaries: cards.every(card => {
        const detail = card.querySelector(':scope > details.teacher-guide-detail');
        return detail && !detail.open &&
          detail.querySelector(':scope > summary')?.textContent.trim() === 'Classroom plan' &&
          card.querySelector('.teacher-guide-cue')?.textContent.trim() &&
          card.querySelector('.teacher-guide-cue a[href="' + card.dataset.guideFor + '"]');
      })
    };
  });
  check(inventory.idCount === inventory.cards && inventory.ids.every(id => id.startsWith('guide-')) &&
    new Set(inventory.anchors).size === inventory.anchors.length &&
    inventory.anchors.length === inventory.cards && inventory.anchors.every(id => inventory.ids.includes(id)),
    label + ' activity index links to every guide card exactly once');
  check(inventory.unitAnchors.length > 0 &&
    inventory.unitAnchors.join(',') === inventory.unitSections.join(','),
    label + ' index shortcuts match the displayed unit sequence');
  check(inventory.summaries, label + ' lesson details start closed while timing and the activity link remain visible');

  if (viewport.width !== 390) return;
  const article = page.locator('article[data-guide-for="openscied-b2-carbon-journey.html"]');
  const lessonId = await article.getAttribute('id');
  const jump = page.locator('nav.teacher-guide-index a[href="#' + lessonId + '"]');
  const details = article.locator('details.teacher-guide-detail');
  const summary = details.locator('summary');
  const plan = details.locator('.teacher-guide-detail-body dl');
  const openFromTop = await page.evaluate(() => document.documentElement.scrollHeight);

  await jump.press('Enter');
  await page.waitForURL(url => url.hash === '#' + lessonId);
  check(await article.evaluate(node => {
    const rect = node.getBoundingClientRect();
    return rect.top >= -1 && rect.top < innerHeight &&
      node.querySelector('summary').getBoundingClientRect().bottom < innerHeight;
  }), 'mobile index scrolls directly to the Carbon Atom Journey card and its summary');
  check(!await details.evaluate(el => el.open), 'jumping to a lesson does not force its details open');

  // Follow normal sequential focus from the fragment, then activate the native
  // summary with only the keyboard. Do not focus the summary programmatically.
  for (let i = 0; i < 5 && !await summary.evaluate(el => el === document.activeElement); i++) {
    await page.keyboard.press('Tab');
  }
  check(await summary.evaluate(el => el === document.activeElement),
    'keyboard focus proceeds from the activity shortcut to its classroom plan');
  await page.keyboard.press('Enter');
  check(await details.evaluate(el => el.open) && await plan.isVisible(),
    'Enter expands the classroom plan and reveals its directions');
  await fits(page, '#' + lessonId + ', #' + lessonId + ' .teacher-guide-detail-body',
    'mobile expanded activity card');
  await shot(page, label + '-expanded', false);
  await axe(page, 'mobile expanded activity', '#' + lessonId);
  const lastLine = plan.locator('dd').last();
  await lastLine.scrollIntoViewIfNeeded();
  check(await lastLine.evaluate(el => {
    const rect = el.getBoundingClientRect();
    return rect.top >= -1 && rect.bottom <= innerHeight + 1 &&
      el.scrollWidth <= el.clientWidth + 1 && el.scrollHeight <= el.clientHeight + 1;
  }), 'the mobile plan can be scrolled through its complete final paragraph');
  await page.keyboard.press('Space');
  check(!await details.evaluate(el => el.open) &&
    await page.evaluate(() => document.documentElement.scrollHeight) === openFromTop,
    'Space collapses the plan and returns the guide to its original compact length');
  await article.locator('xpath=ancestor::section[1]').locator('header a[href="#guide-index"]').press('Enter');
  await page.waitForURL(url => url.hash === '#guide-index');
  check(await page.locator('#guide-index').evaluate(el => el.getBoundingClientRect().top >= -1 &&
    el.getBoundingClientRect().top < innerHeight), 'unit shortcut returns to the activity index');
  await jump.tap();
  await page.waitForURL(url => url.hash === '#' + lessonId);
  check(await article.evaluate(el => el.getBoundingClientRect().top >= -1 &&
    el.getBoundingClientRect().top < innerHeight), 'touch also jumps directly to the indexed guide card');

  await summary.press('Enter');
  const printPlans = await page.evaluate(() => {
    const disclosures = [...document.querySelectorAll('details.teacher-guide-detail, details.teacher-guide-before')];
    const wasOpen = disclosures.map(el => el.open);
    window.dispatchEvent(new Event('beforeprint'));
    const allOpen = disclosures.every(el => el.open);
    window.dispatchEvent(new Event('afterprint'));
    return { allOpen, restored: disclosures.every((el, index) => el.open === wasOpen[index]) };
  });
  check(printPlans.allOpen && printPlans.restored,
    'print preparation includes every plan without changing the on-screen disclosure choices');
}
async function publicAndLock(browser, base, viewport, expectedCards) {
  const context = await browserContext(browser, base, viewport);
  try {
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    const at = viewport.width + (viewport.dark ? '-dark' : '-light');

    await page.goto(base + GUIDE);
    await loaded(page, 'OpenSciEd Teacher Guide');
    const count = await page.locator('article[data-guide-for]').count();
    check(count === expectedCards, at + ' loads a guide card for every dashboard activity');
    await fits(page, 'main, article[data-guide-for]', at + ' public guide');
    await shot(page, at + '-guide');
    if (viewport.width === 390 || viewport.width === 1366) await axe(page, at + ' guide', 'main');
    await publicReading(page, viewport, at);

    await link(page, NOTES).press('Enter');
    await loaded(page, 'OpenSciEd teacher notes');
    check(new URL(page.url()).pathname === '/' + NOTES, at + ' keyboard link opens the protected notes');
    check(await page.locator('meta[name="robots"]').getAttribute('content').then(s => /\bnoindex\b/.test(s || '')),
      at + ' notes instruct crawlers not to index');
    check(await heading(page, EXAMPLE_HEADING).count() === 0 && await page.locator('[data-guide-for]').count() === 0,
      at + ' locked page does not render examples or details');
    check(await link(page, GUIDE).isVisible() && await link(page, AP_NOTES).isVisible(),
      at + ' locked notes offer navigation back to the guide and to AP notes');
    await fits(page, 'main', at + ' locked shell');
    await shot(page, at + '-locked', false);
    if (viewport.width === 390 || viewport.width === 1366) await axe(page, at + ' lock form', 'main');

    if (viewport.width === 1366) {
      // A random value is not the production password and is never printed.
      const wrong = randomBytes(32).toString('hex');
      await page.getByLabel('Password', { exact: true }).fill(wrong);
      await page.getByRole('button', { name: 'Unlock', exact: true }).press('Enter');
      await page.waitForFunction(() => /password is not correct/i.test(
        document.querySelector('[role="alert"]')?.textContent || ''
      ));
      const field = page.getByLabel('Password', { exact: true });
      check(await heading(page, EXAMPLE_HEADING).count() === 0 &&
        !await page.evaluate(() => Boolean(sessionStorage.getItem('tn-pw'))),
        'incorrect credentials leave the real notes locked without retaining a password');
      check(await field.inputValue() === '' && await field.evaluate(el => document.activeElement === el),
        'rejected credentials are cleared and keyboard focus returns to the password field');

      await page.goto(base + 'openscied-dashboard.html');
      check(await link(page, GUIDE).count() === 0, 'student dashboard does not expose teacher navigation');
      await page.goto(base + 'teachers.html');
      await link(page, GUIDE).click();
      await loaded(page, 'OpenSciEd Teacher Guide');
      check(new URL(page.url()).pathname === '/' + GUIDE, 'teacher landing page links to the shared OpenSciEd Teacher Guide');
    }
    check(errors.length === 0, at + ' no uncaught browser errors: ' + errors.join(', '));
  } finally {
    await context.close();
  }
}

function fixturePage(name, other) {
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>' +
    name + '</title></head><body><main><h1>' + name + '</h1><p><a href="' + other +
    '?fixture=1">Other synthetic notes</a></p></main></body></html>';
}
async function fixtureSession(browser, base, dir) {
  const source = path.join(dir, 'source');
  const output = path.join(dir, 'output');
  await fs.mkdir(source);
  await fs.writeFile(path.join(source, NOTES), fixturePage(FIXTURE_HEADING, AP_NOTES));
  await fs.writeFile(path.join(source, AP_NOTES), fixturePage(FIXTURE_AP_HEADING, NOTES));
  const password = randomBytes(32).toString('hex');
  execFileSync(process.execPath, [path.join(ROOT, 'tools/encrypt-notes.js'), source, output], {
    env: { ...process.env, NOTES_PASSWORD: password }, stdio: 'ignore'
  });
  // Replace only the deployed AP lock shell's ciphertext with the synthetic
  // payload. This exercises the AP implementation already in use, not a
  // second copy of the new template, and never decrypts any real AP notes.
  const payloadLine = /^const P = \{[^\r\n]+\};$/m;
  const originalAp = await fs.readFile(path.join(ROOT, AP_NOTES), 'utf8');
  const encryptedApFixture = await fs.readFile(path.join(output, AP_NOTES), 'utf8');
  const fixturePayload = encryptedApFixture.match(payloadLine)?.[0];
  assert.ok(fixturePayload && payloadLine.test(originalAp), 'AP lock shells contain a replaceable payload');
  const apShell = originalAp.replace(payloadLine, () => fixturePayload);
  const context = await browserContext(browser, base, VIEWPORTS[2]);
  // These routes intercept only the two explicit synthetic query URLs.
  await context.route(base + NOTES + '?fixture=1', route => route.fulfill({
    path: path.join(output, NOTES), contentType: 'text/html'
  }));
  await context.route(base + AP_NOTES + '?fixture=1', route => route.fulfill({
    body: apShell, contentType: 'text/html'
  }));
  try {
    const page = await context.newPage();
    await page.goto(base + NOTES + '?fixture=1');
    await loaded(page, 'OpenSciEd teacher notes');
    const keep = page.getByRole('checkbox', { name: /Keep unlocked in this tab/i });
    check(!await keep.isChecked(), 'shared-device unlock is opt-in');
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Unlock', exact: true }).press('Enter');
    await loaded(page, FIXTURE_HEADING);
    check(!await page.evaluate(() => Boolean(sessionStorage.getItem('tn-pw'))),
      'valid password with opt-in off is not retained');
    await page.reload();
    await loaded(page, 'OpenSciEd teacher notes');

    // Unlock on AP first and then follow the same-tab link into OpenSciEd.
    await page.goto(base + AP_NOTES + '?fixture=1');
    await loaded(page, 'Teacher notes');
    await page.getByRole('checkbox', { name: /Keep unlocked in this tab/i }).check();
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Unlock', exact: true }).press('Enter');
    await loaded(page, FIXTURE_AP_HEADING);
    check(await page.evaluate(() => Boolean(sessionStorage.getItem('tn-pw'))),
      'opt-in retains the synthetic password in sessionStorage');
    await page.getByRole('link', { name: 'Other synthetic notes' }).click();
    await loaded(page, FIXTURE_HEADING);

    const newTab = await context.newPage();
    await newTab.goto(base + NOTES + '?fixture=1');
    await loaded(newTab, 'OpenSciEd teacher notes');
    await newTab.close();

    await page.getByRole('button', { name: 'Lock notes', exact: true }).press('Enter');
    await loaded(page, 'OpenSciEd teacher notes');
    check(!await page.evaluate(() => Boolean(sessionStorage.getItem('tn-pw'))),
      'locking the synthetic OpenSciEd notes clears the shared tab unlock');
    await page.goto(base + AP_NOTES + '?fixture=1');
    await loaded(page, 'Teacher notes');

    await page.getByRole('checkbox', { name: /Keep unlocked in this tab/i }).check();
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Unlock', exact: true }).press('Enter');
    await loaded(page, FIXTURE_AP_HEADING);
    await page.evaluate(() => sessionStorage.setItem('tn-last-active', String(Date.now() - 16 * 60 * 1000)));
    await page.goto(base + NOTES + '?fixture=1');
    await loaded(page, 'OpenSciEd teacher notes');
    check(!await page.evaluate(() => Boolean(sessionStorage.getItem('tn-pw'))),
      'a stale shared-tab session cannot unlock the OpenSciEd notes');
  } finally {
    await context.close();
  }
}

(async () => {
  const server = await serve();
  const fixture = await fs.mkdtemp(path.join(os.tmpdir(), 'openscied-guide-fixture-'));
  let browser;
  try {
    await fs.mkdir(OUT, { recursive: true });
    const executablePath = process.env.CHROMIUM_PATH || process.env.CHROMIUM_EXECUTABLE;
    browser = await chromium.launch(executablePath ? { executablePath } : {});
    const dashboard = await fs.readFile(path.join(ROOT, 'openscied-dashboard.html'), 'utf8');
    const expectedCards = [...dashboard.matchAll(/<article class="dashboard-activity">/g)].length;
    check(expectedCards > 0, 'dashboard provides an activity inventory');
    for (const viewport of VIEWPORTS) await publicAndLock(browser, server.url, viewport, expectedCards);
    await fixtureSession(browser, server.url, fixture);
    console.log('openscied-teacher-guide-browser: ' + checks + ' checks passed');
  } finally {
    if (browser) await browser.close();
    server.close();
    await fs.rm(fixture, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
