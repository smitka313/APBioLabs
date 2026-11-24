'use strict';

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const FIRST_LINE = 'First line: my explanation starts here.';
const LAST_LINE = 'Last line: my explanation ends here.';

// Exercise a long, scrollable response, not only a short string that fits in its field.
async function verifyLongResponse(page, field, { name, touch, screenshot }) {
  const response = [
    FIRST_LINE,
    'I can compare the evidence in the investigation.',
    'I can name a limit of the comparison.',
    'I can say what the numbers support.',
    'I can explain what is still uncertain.',
    LAST_LINE
  ].join('\n');
  assert.equal(await page.getByRole('textbox', { name }).count(), 1, 'the answer has one accessible textbox label');
  if (touch) await field.tap(); // Playwright emulation; not a real device or screen reader.
  await field.fill(response);
  assert.equal(await field.inputValue(), response, 'the complete multiline answer remains editable');

  // Navigate from the end to the first line with the keyboard. It should be fully inside the
  // viewport of the textbox, rather than opening with a truncated first line.
  await field.press('Control+End');
  assert.equal(await field.evaluate(el => el.selectionStart), response.length);
  await field.press('Control+Home');
  // Allow the browser to finish its caret-driven scroll before reading the line box.
  await field.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const geometry = await field.evaluate(el => {
    const style = getComputedStyle(el);
    const firstLineTop = parseFloat(style.paddingTop) - el.scrollTop;
    const firstLineEnd = firstLineTop + parseFloat(style.lineHeight);
    return { caret:el.selectionStart, firstLineTop, firstLineEnd, height:el.clientHeight };
  });
  await field.screenshot({ path:screenshot, animations:'disabled', timeout:12000 });
  assert.equal(geometry.caret, 0);
  // A textarea's scrollTop/clientHeight round to pixels in Chromium, but its
  // computed em padding can be fractional (Junco uses 5.6 px at 16 px type).
  const roundingTolerance = 0.5;
  assert.ok(geometry.firstLineTop >= -roundingTolerance &&
    geometry.firstLineEnd <= geometry.height + roundingTolerance,
    'returning to the start exposes the entire first line: ' + JSON.stringify(geometry));
}

async function writePrintPreview(page, selector, path) {
  // Generate a real Chromium print PDF for artifact inspection, not just a screen screenshot.
  await page.emulateMedia({ media:'print' });
  try {
    assert.ok(await page.locator(selector).isVisible(), 'current explanation remains visible under print CSS');
    const pdf = await page.pdf({ path, format:'Letter', tagged:true });
    assert.equal(pdf.subarray(0,5).toString(), '%PDF-');
    assert.ok(pdf.length > 1024, 'print output is not empty');
    const extracted = spawnSync('pdftotext', ['-layout', path, '-'], { encoding:'utf8' });
    if (extracted.error?.code === 'ENOENT') {
      console.log('note: pdftotext is unavailable; inspect the generated PDF for text clipping and duplicates');
    } else {
      assert.ifError(extracted.error);
      assert.equal(extracted.status, 0, extracted.stderr);
      const readable = extracted.stdout.replace(/\s+/g, ' ');
      for (const line of [FIRST_LINE, LAST_LINE]) {
        assert.equal(readable.split(line).length - 1, 1,
          'the printed response includes this line exactly once: ' + line);
      }
    }
  } finally {
    await page.emulateMedia({ media:null });
  }
}

module.exports = { verifyLongResponse, writePrintPreview };
