'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { launch, serve, ok, done } = require('./_h');

const CASES = [
  { width: 390, height: 844, os: 'dark' },
  { width: 768, height: 1024, os: 'light' },
  { width: 1366, height: 768, os: 'dark', theme: 'light' },
  { width: 1920, height: 1080, os: 'light', theme: 'dark' }
];
const CARRYING = 'openscied-b1-carrying-capacity.html';
const HAWKSBEARD = 'openscied-b4-hawksbeard.html';

async function buttonStyle(button) {
  return button.evaluate(el => {
    const style = getComputedStyle(el);
    function luminance(color) {
      return color.match(/[0-9.]+/g).slice(0, 3).map(n => Number(n) / 255)
        .map(n => n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4)
        .reduce((sum, n, i) => sum + n * [.2126, .7152, .0722][i], 0);
    }
    const colors = [luminance(style.color), luminance(style.backgroundColor)];
    return {
      opacity: Number(style.opacity), background: style.backgroundColor, cursor: style.cursor, border: style.borderTopStyle,
      contrast: (Math.max(...colors) + .05) / (Math.min(...colors) + .05)
    };
  });
}

async function screenshot(page, width, label) {
  const out = process.env.POLISH_SCREENSHOTS;
  if (!out) return;
  fs.mkdirSync(out, { recursive: true });
  await page.screenshot({ path: path.join(out, `${width}-${label}.png`), animations: 'disabled' });
}

async function fits(page) {
  return page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
}

(async () => {
  const server = await serve();
  let browser;
  try {
    browser = await launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
    for (const { width, height, os, theme } of CASES) {
      const context = await browser.newContext({
        viewport: { width, height }, colorScheme: os, reducedMotion: 'reduce'
      });
      try {
        await context.route('**/*', route => route.request().url().startsWith(server.url)
          ? route.continue() : route.abort());
        await context.addInitScript(theme => {
          if (theme) localStorage.setItem('aplab:pref:theme', theme);
        }, theme);
        const page = await context.newPage();
        await page.goto(server.url + CARRYING);
        const next = page.locator('#cc-next');
        const enabledStyle = await buttonStyle(next);
        ok(await page.locator('#cc-run .cc-station').getByText(/only limiting resource/i).isVisible() &&
          await page.locator('#cc-run .cc-station').getByText(/does not estimate.*real herd/i).isVisible(),
          `${width} carrying model limit is visible beside the board before running it`);
        await screenshot(page, width, 'carrying-start');
        await next.click();
        await page.waitForFunction(() => document.querySelector('#cc-round').textContent.includes('Round 1 of 12'));
        await screenshot(page, width, 'carrying-round-one');
        await page.locator('#cc-finish').click();
        await page.locator('#cc-next:disabled').waitFor();
        const finish = page.locator('#cc-finish');
        for (const [label, button] of [['next', next], ['finish', finish]]) {
          const style = await buttonStyle(button);
          ok(await button.isDisabled() && style.opacity === 1 && style.contrast >= 4.5 &&
            style.background !== enabledStyle.background && style.cursor === 'not-allowed' && style.border === 'solid',
          `${width} carrying ${label} control reads as disabled after round 12 without fading text`);
        }
        ok(await page.locator('#cc-range-jump').isVisible() && await page.locator('#cc-range-jump').isEnabled() && await fits(page),
          `${width} carrying still offers the next task and does not overflow`);
        await next.scrollIntoViewIfNeeded();
        await screenshot(page, width, 'carrying-complete');
        const baselineScale = await page.locator('#cc-range-plot').getAttribute('data-y-max');
        await page.locator('#cc-compare').click();
        await page.locator('#cc-finish').click();
        await page.locator('#cc-range-trial').selectOption('comparison');
        ok(baselineScale === '20' && await page.locator('#cc-range-plot').getAttribute('data-y-max') === baselineScale,
          `${width} both range plots use the same 0–20 population scale`);
        await page.locator('.cc-nav [data-cc-go="explain"]').click();
        ok(/five required questions.*habitat question at the end is optional/.test(await page.locator('#cc-explain-help').textContent()),
          `${width} Explain distinguishes five required questions from the optional sixth prompt`);
        await page.locator('#cc-explain-question').selectOption('long-run');
        ok(/rounds 7–12.*rounds 13–18.*do not need to run more/i.test(await page.locator('#cc-hint-long-run').textContent()),
          `${width} prediction prompt uses six known rounds to extrapolate the next six`);
        await page.locator('#cc-explain-question').selectOption('habitat-claim');
        ok(/optional/i.test(await page.locator('#cc-explain-position').textContent()),
          `${width} pager also marks the optional habitat prompt`);

        await page.goto(server.url + HAWKSBEARD);
        // With no saved choice the site now opens dark (the system setting no longer decides).
        const dark = (theme || 'dark') === 'dark';
        // The hero artwork (day and dusk pictures) left the page with the shared companion header, so the
        // header carries the title and no picture. The dusk-only rule is no longer checked here.
        ok(await page.locator('header.companion-header h1').isVisible() && await page.locator('.hb-hero img').count() === 0,
          `${width} Hawksbeard header shows the shared title with no hero picture`);
        ok(await fits(page), `${width} Hawksbeard page fits in ${dark ? 'dark' : 'light'} mode`);
        const testNote = page.locator('#hb-predict .hb-tip');
        const testNoteText = await testNote.textContent();
        ok(await testNote.isVisible() && /same wind paths/i.test(testNoteText) &&
          /both the amount and layout of soil/i.test(testNoteText) &&
          /can(?:not|[’']t) tell which change mattered more/i.test(testNoteText),
          `${width} Hawksbeard explains what is matched and what cannot be isolated before students predict`);
        await screenshot(page, width, 'hawksbeard-hero');
        await page.getByRole('radio', { name: /City with separate soil patches/ }).check();
        await page.getByRole('button', { name: 'Save prediction' }).click();
        const release = page.locator('#hb-release');
        await release.waitFor({ state: 'visible' });
        ok(/does not measure germination/i.test(await release.locator('.hb-lede').textContent()),
          `${width} Hawksbeard landing limit is visible alongside the releases`);
        await screenshot(page, width, 'hawksbeard-release');
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser?.close();
    server.close();
  }
  done('Carrying Capacity and Hawksbeard polish');
})().catch(error => { console.error(error); process.exitCode = 1; });
