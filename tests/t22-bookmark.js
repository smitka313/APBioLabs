/* "Pause & bookmark": the calm card, what it records, and the home page "Pick up where you left off" card using it */
const T = require('./_h');
const OUT = process.env.OUT || require('os').tmpdir();
(async () => {
  const srv = await T.serve(), b = await T.launch(), ctx = await T.ctxFor(b);
  const p = await T.open(ctx, 'lab05.html', 'float-assay', srv.url);
  await p.waitForTimeout(800);
  const ta = await p.evaluate(() => { const e = document.querySelector('section.step.is-current .steps-next'); const cur = document.querySelector('section.step.is-current li.si.is-current .si-n'); return { hint: e && e.textContent, no: cur && cur.textContent }; });
  T.ok(!!ta.hint && !!ta.no, `Float assay shows a Next hint (step ${ta.no}): ${ta.hint}`);

  T.ok(await p.locator('.pager-pause').count() >= 1 && await p.locator('.pause-btn').count() === 1, 'Pause & bookmark in the pager and in the nav');
  T.ok(await p.locator('section.step.is-current .pager-pause').innerText() === 'Pause & bookmark', 'pager button label');
  await p.locator('section.step.is-current .pager-pause').click();
  const card = p.locator('.pause-screen');
  T.ok(await card.count() === 1, 'card opens');
  const txt = await card.innerText();
  T.ok(new RegExp('You stopped at Float assay, step ' + ta.no + '\\.').test(txt), 'says where: ' + txt.split('\n').find(l => /stopped/.test(l)));
  T.ok(/Your work is saved in this browser\./.test(txt), 'work-is-saved line');
  T.ok(/Next:/.test(txt), 'shows the Next hint');
  for (const n of ['Get my transfer code', 'Save progress file', 'Keep working']) T.ok(await card.getByRole('button', { name: n }).count() === 1, 'offers "' + n + '"');
  T.ok(await p.evaluate(() => document.activeElement && document.activeElement.id === 'pause-title'), 'focus moves to the card heading');
  const bm = await p.evaluate(() => JSON.parse(localStorage.getItem('aplab:bookmark')));
  T.ok(bm && bm.lab === 'lab05' && bm.step === 'float-assay' && bm.name === 'Float assay' && String(bm.stepNo) === ta.no && !!bm.hint, 'bookmark recorded: ' + JSON.stringify(bm).slice(0, 110));
  await p.screenshot({ path: OUT + '/pause-1366.png' });

  // transfer code inside the card
  await card.getByRole('button', { name: 'Get my transfer code' }).click();
  await p.waitForSelector('.pause-screen .transfer-qr svg', { timeout: 5000 });
  T.ok(/#resume=LB1/.test(await p.evaluate(() => document.querySelector('.pause-screen .transfer-qr').dataset.url)), 'transfer code and QR inside the card');
  await p.evaluate(() => document.querySelector('.pause-screen').scrollTo(0, 400));
  await p.screenshot({ path: OUT + '/pause-transfer-1366.png' });
  // progress file
  const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 5000 }), card.getByRole('button', { name: 'Save progress file' }).click()]);
  T.ok(/_progress\.json$/.test(dl.suggestedFilename()), 'Save progress file downloads ' + dl.suggestedFilename());
  // Keep working
  await card.getByRole('button', { name: 'Keep working' }).click();
  T.ok(await p.locator('.pause-screen').count() === 0, 'Keep working closes the card');
  T.ok(await p.evaluate(() => !!document.activeElement.closest('.pager-pause, .pause-btn') || document.activeElement.classList.contains('pager-pause')), 'focus returns to the Pause button');
  // Escape, and tab trap
  await p.locator('.pause-btn').click(); await p.keyboard.press('Escape');
  T.ok(await p.locator('.pause-screen').count() === 0, 'Escape closes the card');
  await p.locator('.pause-btn').click();
  for (let i = 0; i < 12; i++) await p.keyboard.press('Tab');
  T.ok(await p.evaluate(() => !!document.activeElement.closest('.pause-screen')), 'Tab stays inside the card');
  await p.keyboard.press('Escape');

  // ---- phone, dark ----
  const m = await T.ctxFor(b, { width: 400, height: 800, dark: true });
  const pm = await T.open(m, 'lab05.html', 'float-assay', srv.url);
  await pm.locator('.pause-btn').click();
  T.ok(await pm.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no sideways scroll at 400px');
  await pm.screenshot({ path: OUT + '/pause-400-dark.png' });
  await m.close();

  // ---- home uses the bookmark ----
  await p.locator('.pause-btn').click(); await p.keyboard.press('Escape');
  const h = await T.open(ctx, 'index.html', '', srv.url);
  const hc = await h.evaluate(() => { const e = document.getElementById('resume'); return { hidden: e.hidden, text: e.innerText, href: e.querySelector('a.resume-link').getAttribute('href') }; });
  T.ok(!hc.hidden && /You paused at:\s*Float assay, step \d/.test(hc.text), 'home card names the bookmark: ' + hc.text.replace(/\n+/g, ' | ').slice(0, 130));
  T.ok(/Next:/.test(hc.text) && /lab05\.html#float-assay/.test(hc.href), 'home card has the Next hint and resumes at the part');
  await h.screenshot({ path: OUT + '/home-bookmark.png' });
  // moving on to another part afterwards: the card follows the newer part
  const p2 = await T.open(ctx, 'lab05.html', 'analyze', srv.url); await p2.waitForTimeout(500);
  const h2 = await T.open(ctx, 'index.html', '', srv.url);
  const t2 = await h2.evaluate(() => document.getElementById('resume').innerText);
  T.ok(/Part:\s*Analyze/.test(t2) && !/paused at/i.test(t2), 'a newer part overrides an older bookmark');
  T.ok(p.errors.length === 0 && h.errors.length === 0, 'no errors ' + p.errors.concat(h.errors).join('|'));
  await b.close(); srv.close();
  T.done('t22-bookmark');
})();
