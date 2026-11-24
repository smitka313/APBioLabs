'use strict';
const fs = require('node:fs/promises');

// Exercise two real editors sharing an origin without editing their in-memory records.
async function verifySaveConflict(browser, base, { file, key, warning, backup, edit, read, draft, check }) {
  const context = await browser.newContext({ acceptDownloads: true, reducedMotion: 'reduce' });
  const origin = new URL(base).origin;
  await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  const disk = page => page.evaluate(saveKey => JSON.parse(localStorage.getItem(saveKey) || 'null'), key);
  try {
    const old = await context.newPage(), newer = await context.newPage();
    await old.goto(base + file);
    await edit(old, 0);
    check(read(await disk(old)) === 0, file + ' saves normally in the first tab');
    await newer.goto(base + file);
    await edit(newer, 1);
    check(read(await disk(newer)) === 1, file + ' a freshly loaded editor can update saved work');
    await edit(old, 2);
    check(read(await disk(newer)) === 1 && await old.locator(warning).isVisible(),
      file + ' a stale editor cannot replace another tab’s saved work');
    const download = old.waitForEvent('download');
    await old.locator(backup).click();
    const fileDownload = await download;
    check(fileDownload.suggestedFilename().endsWith('.txt') && draft.test(await fs.readFile(await fileDownload.path(), 'utf8')),
      file + ' a stale editor can still download the actual in-memory draft');
    await newer.evaluate(saveKey => localStorage.removeItem(saveKey), key);
    await edit(newer, 2);
    check((await disk(old)) === null && await newer.locator(warning).isVisible(),
      file + ' an editor cannot restore an erased record');
  } finally { await context.close(); }
}

module.exports={verifySaveConflict};
