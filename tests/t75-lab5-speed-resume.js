/* Lab 5: an active float run resumes at its saved pace after reload and locks that pace until completion. */
const { ok, done, launch, ctxFor, open } = require('./_h');
(async () => {
  const b = await launch(), ctx = await ctxFor(b, { width: 390, height: 844 });
  try {
    const p = await open(ctx, 'lab05.html');
    await p.evaluate(() => {
      const t = document.getElementById('p-predict-floatassay');
      t.value = 'I predict they float because O2 builds up.';
      t.dispatchEvent(new Event('input', { bubbles: true }));
      t.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await p.evaluate(() => Lab.pages.go('sink-disks')); await p.waitForTimeout(400);
    await p.evaluate(() => document.getElementById('inf-pull').click()); await p.waitForTimeout(5000);
    await p.evaluate(() => document.getElementById('inf-pour').click()); await p.waitForTimeout(400);
    await p.evaluate(() => Lab.pages.go('float-assay')); await p.waitForTimeout(400);
    await p.evaluate(() => {
      const speed = document.getElementById('cup-speed'); speed.value = '0.5'; speed.dispatchEvent(new Event('change', { bubbles: true }));
      const length = document.getElementById('cup-len'); length.value = '10'; length.dispatchEvent(new Event('input', { bubbles: true }));
      document.getElementById('cup-run').click();
    });
    const state = () => p.evaluate(() => ({
      speed: document.getElementById('cup-speed').value,
      locked: document.getElementById('cup-speed').disabled,
      minutes: Array.from(document.querySelectorAll('#cup-table tbody tr')).map(tr => +tr.cells[0].textContent)
    }));
    await p.waitForFunction(() => document.querySelectorAll('#cup-table tbody tr').length >= 2, null, { timeout: 10000 });
    ok((await state()).locked, 'the selected pace is locked during the run');
    await p.reload({ waitUntil: 'commit' }); await p.waitForTimeout(700);
    const resumed = await state();
    ok(resumed.speed === '0.5' && resumed.locked, 'reload restores the saved pace and keeps it locked');
    ok(resumed.minutes.length >= 2 && resumed.minutes.every((m, i) => i === 0 || m > resumed.minutes[i - 1]), 'resume keeps minute rows in order without duplicates');
    await p.waitForFunction(() => document.querySelectorAll('#cup-table tbody tr').length === 11, null, { timeout: 15000 });
    const finished = await state();
    ok(finished.minutes.every((m, i) => m === i), 'the resumed run records every minute from 0 through 10');
    ok(!finished.locked, 'the pace control unlocks after the run finishes');
    ok(p.errors.length === 0, 'no page errors ' + p.errors.join('|'));
  } finally {
    await ctx.close(); await b.close();
  }
  done('t75-lab5-speed-resume');
})().catch(e => { console.error(e); process.exitCode = 1; });
