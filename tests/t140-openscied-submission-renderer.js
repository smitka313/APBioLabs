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
      // No Lab canvas/mock: exercise the actual self-contained stamp and Word fallback.
      delete window.Lab;
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
    async function sealPng(dialog) {
      const seal = dialog.locator('.osr-stamp');
      await seal.evaluate(img => img.decode());
      const pixels = await seal.evaluate(img => {
        const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
        const x = c.getContext('2d'); x.drawImage(img, 0, 0);
        const d = x.getImageData(0, 0, c.width, c.height).data;
        let ink = 0;
        for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 160 && d[i + 2] > 120 && d[i] < 50) ink++;
        return { width: c.width, height: c.height, ink };
      });
      assert.equal(pixels.width, 480);
      assert.equal(pixels.height, 480);
      assert.ok(pixels.ink > 10000, 'real engraved blue stamp; not a placeholder');
      return (await seal.getAttribute('src')).split(',')[1];
    }
    assert.equal(await page.evaluate(() => collectionCalls), 0, 'mount does not read any saved work');
    assert.equal(await page.locator('[aria-live], [role="status"]').count(), 1, 'does not add a duplicate live region');
    assert.equal(await page.locator('#submit button').count(), 1, 'one launcher in ordinary phases');
    assert.equal(await page.getByRole('button', { name: 'Download Word (.docx)' }).count(), 0, 'no direct Word shortcut');
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
    const paperColor = () => dialog.locator('.osr-paper').evaluate(e => getComputedStyle(e).backgroundColor);
    const setPreviewTheme = mode => page.evaluate(mode => {
      if (mode) document.documentElement.dataset.theme = mode;
      else document.documentElement.removeAttribute('data-theme');
    }, mode);
    assert.equal(await paperColor(), 'rgb(25, 47, 58)', 'auto follows the dark system theme');
    await setPreviewTheme('light');
    assert.equal(await paperColor(), 'rgb(255, 255, 255)', 'explicit Light overrides the dark system');
    await page.emulateMedia({ colorScheme: 'light' });
    await setPreviewTheme('dark');
    assert.equal(await paperColor(), 'rgb(25, 47, 58)', 'explicit Dark overrides the light system');
    assert.equal(await page.evaluate(() => localStorage.getItem('aplab:pref:theme')), null,
      'preview does not persist a theme choice');
    assert.match(await dialog.innerText(), /In progress/i);
    assert.ok(await dialog.getByRole('button', { name: 'Print or save as PDF' }).isVisible());
    assert.ok(await dialog.getByRole('button', { name: 'Close report' }).isVisible());
    assert.equal(await dialog.getByRole('button', { name: 'Download Word (.docx)' }).count(), 0, 'Word starts inside a closed disclosure');
    assert.match(await dialog.innerText(), /Finish the final trial/);
    assert.match(await dialog.innerText(), /<img src=x/);
    assert.equal(await dialog.getByRole('img').count(), 0);
    assert.ok(await dialog.locator('article').evaluate(n => n.getBoundingClientRect().right <= innerWidth), 'narrow report fits the viewport');
    const editIdentity = dialog.locator('.osr-identity-editor');
    await dialog.getByText('Edit name or period', { exact: true }).click();
    await editIdentity.getByLabel('Name', { exact: true }).fill('Draft Correction');
    await editIdentity.getByLabel('Class period', { exact: true }).fill('6');
    await editIdentity.getByRole('button', { name: 'Apply to this report' }).click();
    assert.match(await dialog.locator('.osr-meta').innerText(), /Draft Correction/);
    assert.match(await dialog.locator('.osr-meta').innerText(), /Class period\s*6/);
    assert.equal(await page.evaluate(() => synthetic.student.name), 'Test Report Student', 'metadata correction does not change stored identity');
    assert.equal(await dialog.locator('.osr-stamp').count(), 0, 'a draft correction does not earn a seal');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.activeElement.textContent === 'Preview report');
    await page.evaluate(() => { synthetic.status = 'final'; synthetic.missing = []; });
    await page.getByRole('button', { name: 'Preview report' }).click();
    assert.match(await dialog.innerText(), /Activity complete/i);
    const previewSeal = await sealPng(dialog);
    const shots = process.env.POLISH_SCREENSHOTS;
    if (shots) {
      fs.mkdirSync(shots, { recursive:true });
      await page.screenshot({ path:path.join(shots, 'submission-preview-390-dark.png') });
      await page.setViewportSize({ width:1366, height:900 });
      await page.screenshot({ path:path.join(shots, 'submission-preview-1366.png') });
    }

    // Hold the original preview snapshot even if the activity state changes before download/print.
    await page.evaluate(() => { synthetic.sections[0].items[0].value = 'Evidence edited in another step'; });
    await dialog.getByText('More formats', { exact: true }).click();
    assert.ok(await dialog.getByRole('button', { name: 'Download Word (.docx)' }).isVisible());
    const download = page.waitForEvent('download');
    await dialog.getByRole('button', { name: 'Download Word (.docx)' }).click();
    const d = await download;
    const file = path.join(dir, 'report.docx');
    assert.equal(d.suggestedFilename(), 'recorded-ecosystem-observations-submission.docx');
    await d.saveAs(file);
    const xml = execFileSync('unzip', ['-p', file, 'word/document.xml'], { encoding: 'utf8' });
    const header = execFileSync('unzip', ['-p', file, 'word/header1.xml'], { encoding: 'utf8' });
    const footer = execFileSync('unzip', ['-p', file, 'word/footer1.xml'], { encoding: 'utf8' });
    const wordStamp = execFileSync('unzip', ['-Z1', file], { encoding: 'utf8' }).split('\n').find(p => /^word\/media\/.+\.png$/.test(p));
    assert.ok(wordStamp, 'Word has a real PNG seal');
    assert.equal(execFileSync('unzip', ['-p', file, wordStamp]).toString('base64'), previewSeal, 'Word embeds the same pixels as the printable preview');
    assert.match(header, /Test Report Student · Class 3/);
    assert.match(header, /Recorded ecosystem observations/);
    assert.match(footer, /Dataset ID: TEST-RPT/);
    assert.match(footer, /NUMPAGES/);
    assert.match(xml, /Test Report Student/);
    assert.match(xml, /ACTIVITY COMPLETE/);
    assert.match(xml, /Student entries plus simulated data/);
    assert.match(xml, /Season header/);
    assert.match(xml, /Season 119/);
    assert.match(xml, /w:tblHeader/);
    assert.match(xml, /&lt;img src=x/);
    assert.doesNotMatch(xml, /Evidence edited in another step|aplab_payload/);
    if (T.BROWSER === 'chromium') {
      const pdf = path.join(dir, 'report.pdf');
      await page.emulateMedia({ media: 'print' });
      assert.equal(await paperColor(), 'rgb(255, 255, 255)', 'printing remains white paper in Dark');
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
        assert.ok((printed.match(/Test Report Student · Class 3/g) || []).length > 1, 'identity repeats in PDF running headers');
        assert.ok((printed.match(/Dataset ID: TEST-RPT/g) || []).length > 1, 'Dataset ID repeats in PDF running footers');
        assert.match(printed, /Page 2 of /);
        assert.ok((printed.match(/Season header/g) || []).length > 1, 'printed table headers repeat on later pages');
        assert.doesNotMatch(printed, /Wrong Next Student|Original activity content|Print or save as PDF|Edit name or period/);
      }
      if (printed !== undefined) {
        const images = execFileSync('pdfimages', ['-list', pdf], { encoding: 'utf8' });
        assert.match(images, /image\s+480\s+480\s+(?:rgb|icc)/i, 'PDF contains the same printable seal image');
      }
      await page.emulateMedia({ media: 'screen' });
    }
    await dialog.getByRole('button', { name: 'Close report' }).click();
    await page.evaluate(() => { synthetic.datasetId = ''; synthetic.student = null; });
    await page.getByRole('button', { name: 'Preview report' }).click();
    assert.match(await dialog.innerText(), /Activity complete/i);
    assert.equal(await dialog.locator('.osr-stamp').count(), 0, 'completion without a name is not stamped');
    await dialog.getByText('Edit name or period', { exact: true }).click();
    await editIdentity.getByLabel('Name', { exact: true }).fill('Example No-Id Student');
    await editIdentity.getByLabel('Class period', { exact: true }).fill('3');
    await editIdentity.getByRole('button', { name: 'Apply to this report' }).click();
    assert.doesNotMatch(await dialog.innerText(), /Dataset ID/);
    assert.notEqual(await sealPng(dialog), previewSeal, 'named completion without an ID has a genuine no-ID stamp');
    if (shots) await page.screenshot({ path:path.join(shots, 'submission-preview-complete-without-id.png') });
    await dialog.getByText('More formats', { exact: true }).click();
    const editedDownload = page.waitForEvent('download');
    await dialog.getByRole('button', { name: 'Download Word (.docx)' }).click();
    const editedFile = path.join(dir, 'corrected.docx');
    await (await editedDownload).saveAs(editedFile);
    assert.match(execFileSync('unzip', ['-p', editedFile, 'word/header1.xml'], { encoding: 'utf8' }), /Example No-Id Student · Class 3/);
    await page.evaluate(() => { synthetic.status = 'recovery'; window.print = () => { window.printedUnexpectedly = true; }; });
    await dialog.getByRole('button', { name: 'Print or save as PDF' }).click();
    assert.match(await dialog.innerText(), /now marked Recovered work/);
    assert.equal(await page.evaluate(() => window.printedUnexpectedly), undefined, 'an edited copy cannot be exported after the save is retired');
    assert.equal(await dialog.locator('.osr-stamp').count(), 0);
    assert.doesNotMatch(await dialog.innerText(), /Example No-Id Student/);
    await dialog.getByRole('button', { name: 'Close report' }).click();
    await page.evaluate(() => { synthetic.status = 'final'; synthetic.student = { name:'Original student', period:'1' }; });
    await page.getByRole('button', { name: 'Preview report' }).click();
    await page.evaluate(() => {
      synthetic.student = { name:'Wrong Next Student', period:'2' };
      window.dispatchEvent(new Event('beforeprint'));
    });
    assert.match(await dialog.locator('.osr-label').innerText(), /Recovered work/i, 'native print revalidates an unedited preview');
    assert.match(await dialog.locator('.osr-meta').innerText(), /Original student/);
    assert.doesNotMatch(await dialog.innerText(), /Wrong Next Student/);
    assert.equal(await dialog.locator('.osr-stamp').count(), 0);
    await dialog.getByText('More formats', { exact: true }).click();
    const recoveredDownload = page.waitForEvent('download');
    await dialog.getByRole('button', { name:'Download Word (.docx)' }).click();
    const recovery = await recoveredDownload;
    assert.match(recovery.suggestedFilename(), /-recovery\.docx$/);
    const recoveredFile = path.join(dir, 'recovered.docx');
    await recovery.saveAs(recoveredFile);
    const recoveredXML = execFileSync('unzip', ['-p', recoveredFile, 'word/document.xml'], { encoding:'utf8' });
    assert.match(recoveredXML, /RECOVERED WORK/i);
    assert.match(recoveredXML, /Original student/);
    assert.doesNotMatch(recoveredXML, /Wrong Next Student|Activity complete/i);
    await dialog.getByRole('button', { name: 'Close report' }).click();
    await page.evaluate(() => { synthetic.status = 'final'; synthetic.allowIdentityEdit = false; });
    await page.getByRole('button', { name: 'Preview report' }).click();
    assert.equal(await editIdentity.count(), 0, 'a shared report cannot gain an individual name');
    await dialog.getByRole('button', { name: 'Close report' }).click();
    await page.evaluate(() => { synthetic.status = 'recovery'; synthetic.student = null; synthetic.datasetId = ''; delete synthetic.allowIdentityEdit; });
    await page.getByRole('button', { name: 'Preview report' }).click();
    assert.match(await dialog.innerText(), /Recovered work/i);
    assert.equal(await editIdentity.count(), 0, 'a recovery copy cannot be renamed');
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
