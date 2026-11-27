'use strict';
/* Use made-up fixtures. The published encrypted exemplar payloads never enter CI logs. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const T = require('./_h');

(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'exemplar-print-'));
  let server, browser;
  try {
    const src = path.join(tmp, 'src'), out = path.join(tmp, 'out');
    fs.mkdirSync(src);
    const example = (name, dataset) => `<details class="grade-report"><summary>Complete exemplar</summary>
      <p>Sample lab · ${name} · Period 3 · Complete. Dataset ${dataset}.</p>
      <section><h4>Evidence</h4><div><table><caption>Recorded comparison</caption><thead><tr><th>Trial</th><th>Value</th></tr></thead>
      <tbody><tr><td>A</td><td>12</td></tr></tbody></table></div><h5>What changed?</h5><p>Fictional evidence and reasoning.</p></section>
      <section><h4>Teacher grading notes</h4><p>PRIVATE-GRADING-GUIDANCE</p></section></details>`;
    const layout = (title, markup, scripts = '') => `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${title}</title>
      <link rel="stylesheet" href="style.css"></head><body><main><h1>${title}</h1>
      <details class="grading-rubric"><summary>Rubric</summary><p>PRIVATE-RUBRIC</p></details>${markup}</main>${scripts}</body></html>`;
    fs.writeFileSync(path.join(src, 'teacher-lab01.html'), layout('Sample AP lab', example('Sample Student', 'ABC-XYZ'), '<script src="lab.js"></script>'));
    fs.writeFileSync(path.join(src, 'openscied-teacher-notes.html'), layout('Companion notes',
      `<article class="ose-teacher-card" id="guide-b1-migration"><h3>Migration Map Explorer</h3>${example('Sample Explorer', 'ME-A123')}</article>
       <article class="ose-teacher-card" id="guide-b1-serengeti"><h3>Serengeti Board Game</h3>${example('Group Recorder', 'SB-A123')}</article>`));
    execFileSync(process.execPath, [path.join(T.ROOT, 'tools/encrypt-notes.js'), src, out],
      { env: { ...process.env, NOTES_PASSWORD: 'fixture-teacher-password' } });
    for (const name of ['domain-redirect.js', 'style.css', 'lab.js', 'openscied-submission-report.css',
      'openscied-submission-report.js', 'teacher-exemplar-print.js']) fs.copyFileSync(path.join(T.ROOT, name), path.join(out, name));
    for (const name of ['teacher-lab01.html', 'openscied-teacher-notes.html']) {
      const locked = fs.readFileSync(path.join(out, name), 'utf8');
      assert.doesNotMatch(locked, /PRIVATE-RUBRIC|Fictional evidence and reasoning|Sample Student/);
    }
    server = await T.serve(out);
    browser = await T.launch();
    const context = await browser.newContext({ viewport: { width: 1000, height: 800 }, colorScheme: 'dark' });
    await context.route(url => !url.href.startsWith(server.url) && !url.href.startsWith('about:'), route => route.abort());
    const page = await context.newPage();
    for (const route of ['teacher-lab01.html', 'openscied-teacher-notes.html']) {
      const ap = route.startsWith('teacher-lab');
      await page.goto(server.url + route);
      assert.equal(await page.locator('.tn-exemplar-actions').count(), 0, 'No exemplar controls while locked');
      await page.fill('#pw', 'wrong-fixture-password');
      await page.click('#f button');
      await page.waitForFunction(() => document.querySelector('#err')?.textContent === 'That password is not correct.');
      assert.equal(await page.locator('.tn-exemplar-actions').count(), 0, 'Wrong password cannot show exemplar');
      await page.fill('#pw', 'fixture-teacher-password');
      await page.click('#f button');
      await page.locator('.tn-exemplar-actions').first().waitFor({ state: 'attached' });
      const examples = page.locator('details.grade-report');
      assert.equal(await examples.count(), ap ? 1 : 2);
      for (let n = 0; n < await examples.count(); n++) {
        const specimen = examples.nth(n);
        await specimen.locator('summary').click();
        const [printView] = await Promise.all([page.waitForEvent('popup'), specimen.getByRole('button', { name: 'Print or save as PDF' }).click()]);
        await printView.getByRole('button', { name: 'Print or save as PDF' }).waitFor();
        const paper = printView.locator(ap ? '.rv-paper' : '.osr-paper');
        assert.match(await paper.innerText(), /Teacher exemplar.*fictional/i);
        assert.match(await paper.innerText(), /Fictional evidence and reasoning/);
        assert.match(await paper.innerText(), /Recorded comparison/);
        assert.doesNotMatch(await paper.innerText(), /PRIVATE-GRADING-GUIDANCE|PRIVATE-RUBRIC/);
        assert.equal(await paper.locator(ap ? 'img.rv-stamp' : 'img.osr-stamp').count(), n === 1 ? 0 : 1);
        if (n === 1) assert.match(await paper.innerText(), /Recorded by/);
        const printButton = printView.getByRole('button', { name: 'Print or save as PDF' });
        await printView.evaluate(() => { window.print = () => { document.documentElement.dataset.printCalled = 'yes'; }; });
        await printButton.click();
        assert.equal(await printView.locator('html').getAttribute('data-print-called'), 'yes');
        await printView.emulateMedia({ media: 'print' });
        assert.equal(await printButton.isVisible(), false, 'Export does not contain the print controls');
        if (!process.env.BROWSER || process.env.BROWSER === 'chromium') {
          const pdf = await printView.pdf({ preferCSSPageSize: true, printBackground: true });
          assert.ok(pdf.subarray(0, 5).equals(Buffer.from('%PDF-')));
          assert.ok(pdf.length > 10000, 'Printed paper contains a real PDF, not a blank page');
        }
        await printView.close();
      }
      await page.locator('#tn-lock').click();
      await page.locator('#pw').waitFor();
      assert.equal(await page.locator('.tn-exemplar-actions').count(), 0);
      assert.match(await page.locator('main').innerText(), /password/i);
    }
    console.log('Protected AP, named OpenSciEd, and group OpenSciEd exemplars use student-style PDF previews.');
  } finally {
    await browser?.close();
    server?.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
