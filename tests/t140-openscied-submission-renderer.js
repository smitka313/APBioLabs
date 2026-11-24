/* The shared OpenSciEd report contract, native print/PDF, and native Word download.
   Uses only synthetic evidence and the local docx route from the standard harness. */
'use strict';
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const T = require('./_h');

const FIXTURE = '<!doctype html><html lang="en"><meta charset="utf-8"><title>OpenSciEd report test</title>'
  + '<link rel="stylesheet" href="openscied-submission-report.css"><script src="openscied-submission-report.js" defer></script>'
  + '<style>.fixture-off { display:none }</style><body><main><p id="existing-status" aria-live="polite">Original activity content</p>'
  + '<section id="final-phase" class="fixture-off"><div data-ose-report-final></div></section><div id="submit"></div></main></body></html>';

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'openscied-report-'));
  let server, browser;
  try {
    server = await T.serve();
    browser = await T.launch();
    const ctx = await T.ctxFor(browser, { width: 390, height: 840, dark: true });
    const page = await ctx.newPage();
    await page.route(server.url + 'openscied-report-fixture.html', r => r.fulfill({ contentType: 'text/html', body: FIXTURE }));
    await page.goto(server.url + 'openscied-report-fixture.html');
    await page.evaluate(() => {
      const pixel = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+T0ioAAAAASUVORK5CYII=';
      window.stamps = [];
      window.Lab = {
        stamp: { png({ datasetId }) { stamps.push(datasetId); return { dataUrl: 'data:image/png;base64,' + pixel, bytes: Uint8Array.from(atob(pixel), c => c.charCodeAt(0)) }; } },
        report: { docxUrls: ['https://cdn.jsdelivr.net/npm/docx@9.0.2/build/index.umd.js'] },
      };
      window.synthetic = {
        title: 'Recorded ecosystem observations', unit: 'Unit 1', source: 'Student entries plus simulated data',
        status: 'draft', missing: ['Finish the final trial'], student: { name: 'Test Report Student', period: '3' }, datasetId: 'TEST-RPT',
        keyResults: [{ label: 'Wildebeest lost', value: 0, unit: 'tokens' }],
        sections: [{ title: 'Book of evidence', items: [
          { type: 'answer', prompt: 'What did you observe?', value: '<img src=x onerror="window.injected=1">\nEvidence persists.' },
          { type: 'table', title: 'Field measurements', columns: ['Season header', 'Token count'],
            rows: Array.from({ length: 120 }, (_, i) => ['Season ' + i, i]) },
        ] }],
      };
      window.collectionCalls = 0;
      OpenSciEdSubmission.mount({ target: '#submit', collect() { collectionCalls++; return synthetic; } });
    });
    assert.equal(await page.evaluate(() => collectionCalls), 0, 'mount does not read any saved work');
    assert.equal(await page.locator('[aria-live], [role="status"]').count(), 1, 'does not add a duplicate live region');
    assert.equal(await page.locator('#submit button').count(), 1, 'one launcher in ordinary phases');
    assert.equal(await page.getByRole('button', { name: 'Download .docx' }).count(), 0, 'no direct Word shortcut');
    await page.evaluate(() => {
      window.initialLauncher = document.querySelector('#submit button');
      document.querySelector('#final-phase').classList.remove('fixture-off');
    });
    await page.waitForFunction(() => document.querySelector('[data-ose-report-final] button') === window.initialLauncher);
    assert.equal(await page.getByRole('button', { name: 'Preview report' }).count(), 1);
    await page.evaluate(() => { document.querySelector('#final-phase').hidden = true; });
    await page.waitForFunction(() => document.querySelector('#submit button') === window.initialLauncher);
    await page.evaluate(() => { document.querySelector('#final-phase').hidden = false; });
    await page.waitForFunction(() => document.querySelector('[data-ose-report-final] button') === window.initialLauncher);
    await page.evaluate(() => { document.querySelector('#final-phase').setAttribute('aria-hidden', 'true'); });
    await page.waitForFunction(() => document.querySelector('#submit button') === window.initialLauncher);
    assert.equal(await page.evaluate(() => collectionCalls), 0, 'step changes do not collect or export anything');
    await page.getByRole('button', { name: 'Preview report' }).click();
    const dialog = page.getByRole('dialog');
    assert.match(await dialog.innerText(), /In progress/i);
    assert.ok(await dialog.getByRole('button', { name: 'Print or save as PDF' }).isVisible());
    assert.ok(await dialog.getByRole('button', { name: 'Close report' }).isVisible());
    assert.equal(await dialog.getByRole('button', { name: 'Download .docx' }).count(), 0, 'Word starts inside a closed disclosure');
    assert.match(await dialog.innerText(), /Finish the final trial/);
    assert.match(await dialog.innerText(), /<img src=x/);
    assert.equal(await dialog.getByRole('img').count(), 0);
    assert.ok(await dialog.locator('article').evaluate(n => n.getBoundingClientRect().right <= innerWidth), 'narrow report fits the viewport');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.activeElement.textContent === 'Preview report');
    await page.evaluate(() => { synthetic.status = 'final'; synthetic.missing = []; });
    await page.getByRole('button', { name: 'Preview report' }).click();
    assert.match(await dialog.innerText(), /Activity complete/i);
    assert.equal(await dialog.locator('.osr-stamp').count(), 1);
    assert.deepEqual(await page.evaluate(() => stamps), ['TEST-RPT']);
    const shots = process.env.POLISH_SCREENSHOTS;
    if (shots) {
      fs.mkdirSync(shots, { recursive:true });
      await page.screenshot({ path:path.join(shots, 'submission-preview-390-dark.png') });
      await page.setViewportSize({ width:1366, height:900 });
      await page.screenshot({ path:path.join(shots, 'submission-preview-1366.png') });
    }

    // Hold the original preview snapshot even if the activity state changes before download/print.
    await page.evaluate(() => { synthetic.student.name = 'Wrong Next Student'; });
    await dialog.getByText('More formats', { exact: true }).click();
    assert.ok(await dialog.getByRole('button', { name: 'Download .docx' }).isVisible());
    const download = page.waitForEvent('download');
    await dialog.getByRole('button', { name: 'Download .docx' }).click();
    const d = await download;
    const file = path.join(dir, 'report.docx');
    assert.equal(d.suggestedFilename(), 'recorded-ecosystem-observations-submission.docx');
    await d.saveAs(file);
    const xml = execFileSync('unzip', ['-p', file, 'word/document.xml'], { encoding: 'utf8' });
    assert.match(xml, /Test Report Student/);
    assert.match(xml, /ACTIVITY COMPLETE/);
    assert.match(xml, /Student entries plus simulated data/);
    assert.match(xml, /Season header/);
    assert.match(xml, /Season 119/);
    assert.match(xml, /w:tblHeader/);
    assert.match(xml, /&lt;img src=x/);
    assert.doesNotMatch(xml, /Wrong Next Student|aplab_payload/);
    if (T.BROWSER === 'chromium') {
      const pdf = path.join(dir, 'report.pdf');
      await page.emulateMedia({ media: 'print' });
      await page.pdf({ path: pdf, format: 'Letter', printBackground: true, preferCSSPageSize: true });
      assert.equal(fs.readFileSync(pdf).subarray(0,5).toString(), '%PDF-');
      let printed;
      try { printed = execFileSync('pdftotext', [pdf, '-'], { encoding:'utf8' }); }
      catch(error) {
        if (error.code !== 'ENOENT') throw error;
        console.log('PDF generated; textual check needs Poppler (pdftotext).');
      }
      if (printed !== undefined) {
        assert.match(printed, /Test Report Student/);
        assert.match(printed, /Season 119/);
        assert.ok((printed.match(/Season header/g) || []).length > 1, 'printed table headers repeat on later pages');
        assert.doesNotMatch(printed, /Wrong Next Student|Original activity content|Print or save as PDF/);
      }
      await page.emulateMedia({ media: 'screen' });
    }
    await dialog.getByRole('button', { name: 'Close report' }).click();
    await page.evaluate(() => { synthetic.status = 'recovery'; synthetic.student = null; synthetic.datasetId = ''; });
    await page.getByRole('button', { name: 'Preview report' }).click();
    assert.match(await dialog.innerText(), /Recovered work/i);
    assert.match(await dialog.innerText(), /Not entered/);
    assert.doesNotMatch(await dialog.innerText(), /Wrong Next Student|Dataset ID/);
    assert.equal(await dialog.locator('.osr-stamp').count(), 0);
    console.log('OpenSciEd report: one launcher, draft, final, recovery, secondary DOCX, and print workflows passed.');
  } finally {
    if (browser) await browser.close();
    if (server) server.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
