/* Data management: Sign out, Start over (all labs), Start over (one lab).
   Run: NODE_PATH=$(npm root -g) node tests/t24-signout.js  (set OUT=dir to keep screenshots) */
const T = require('./_h');
const OUT = process.env.OUT || require('os').tmpdir();
const ME = { name: 'Jordan Lee', period: '3' };

/* Fresh context that seeds ONCE (a marker in localStorage that sign-out does not touch), so a sign-out really leaves the browser empty. */
async function ctxFor(b, o = {}) {
  const ctx = await b.newContext({ viewport: { width: o.width || 1366, height: o.height || 800 }, colorScheme: o.dark ? 'dark' : 'light' });
  await T.routeLibs(ctx);
  await ctx.addInitScript(seed => { try {
    if (localStorage.getItem('__seeded')) return;
    localStorage.setItem('__seeded', '1');
    Object.entries(seed).forEach(([k, v]) => localStorage.setItem(k, JSON.stringify(v)));
  } catch (e) { /* ignore */ } }, o.seed || {});
  return ctx;
}
const base = () => ({
  'aplab:student': ME, 'aplab:tour': { seen: true, v: 1 },
  'aplab:ui:allParts': true, 'aplab:pref:theme': 'dark',
  'aplab:lab05:field:zz-test': 'my answer', 'aplab:lab05:keyres:x': { label: 'x', value: 1 },
  'aplab:progress:lab05': { done: 4, total: 6, sections: 8, t: Date.now() },
  'aplab:hint:lab05': { 'float-assay': { hint: 'Do the thing', done: '', t: Date.now() } },
  'aplab:backup:lab05': { t: Date.now(), sig: 1 },
  'aplab:lab02:field:zz-test': 'hardy', 'aplab:progress:lab02': { done: 1, total: 5, sections: 7, t: Date.now() },
  'aplab:hint:lab02': { model: { hint: 'Try it', done: '', t: Date.now() } },
  'aplab:bookmark': { lab: 'lab05', step: 'float-assay', name: 'Float assay', title: 'Lab 5', hint: 'Do the thing', done: '', t: Date.now() },
  'aplab:last': { lab: 'lab05', step: 'old-step', name: 'Float assay', title: 'Lab 5 · Photosynthesis — AP Bio Lab Bench', t: Date.now() },
});
const dump = p => p.evaluate(() => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith('aplab:')) o[k] = localStorage.getItem(k).replace(/"t":\d+/g, '"t":0'); } return o; });
const ALLOWED = k => k.startsWith('aplab:ui:') || k.startsWith('aplab:pref:');

(async () => {
  const srv = await T.serve(), b = await T.launch();

  /* ---------- 1. Sign out: cancel + gating, keyboard-only, then erase ---------- */
  console.log('Sign out');
  let ctx = await ctxFor(b, { seed: base() });
  let p = await T.open(ctx, 'lab05.html', '', srv.url);
  let beforeUnloadPrompts = 0; p.on('dialog', d => { beforeUnloadPrompts++; d.dismiss().catch(() => {}); });
  const line = (await p.locator('.id-line').first().innerText()).replace(/\s+/g, ' ');
  T.ok(/Signed in as Jordan Lee · Period 3 · Dataset ID \S+ · change · New dataset · Help · Sign out/.test(line), 'identity line ends with Sign out: ' + line);
  const snap = await dump(p);
  T.ok(Object.keys(snap).length >= 10, 'seeded work is in storage');

  const opener = p.locator('.id-signout');
  await opener.click();
  const dlg = p.locator('.dm-card');
  T.ok(await dlg.count() === 1 && await dlg.getAttribute('role') === 'alertdialog' && await dlg.getAttribute('aria-modal') === 'true', 'role=alertdialog, aria-modal');
  const lid = await dlg.getAttribute('aria-labelledby'), did = await dlg.getAttribute('aria-describedby');
  T.ok(!!(await p.locator('#' + lid).count()) && !!(await p.locator('#' + did).count()), 'labelled and described');
  const txt = await dlg.innerText();
  T.ok(/This removes Jordan Lee and ALL of their saved work in every lab from this computer\. It can't be undone\./.test(txt), 'explains what is erased');
  T.ok(/Save your work first:/.test(txt), '"Save your work first:" present');
  for (const n of ['Download report (.docx)', 'Download progress file', 'Get my transfer code']) T.ok(await dlg.getByRole('button', { name: n }).count() >= 1, 'lab page offers "' + n + '"');
  T.ok(await dlg.getByRole('button', { name: 'Download progress file for Lab 2' }).count() === 1, 'other labs with work get their own progress-file button');
  T.ok(await p.evaluate(() => document.activeElement.classList.contains('dm-title')), 'focus moves into the dialog');
  T.ok(await p.evaluate(() => document.querySelector('main').hasAttribute('inert')), 'page behind is inert');
  const confirm = dlg.getByRole('button', { name: 'Sign out and erase' });
  T.ok(await confirm.isDisabled(), 'Sign out and erase starts disabled');
  await p.screenshot({ path: OUT + '/t24-signout-1366.png' });

  // Tab never leaves the dialog
  let leaked = false;
  for (let i = 0; i < 25; i++) { await p.keyboard.press('Tab'); if (!await p.evaluate(() => !!document.activeElement.closest('.dm-card'))) leaked = true; }
  for (let i = 0; i < 25; i++) { await p.keyboard.press('Shift+Tab'); if (!await p.evaluate(() => !!document.activeElement.closest('.dm-card'))) leaked = true; }
  T.ok(!leaked, 'focus stays trapped in the dialog (Tab and Shift+Tab)');

  // Esc cancels
  await p.keyboard.press('Escape');
  T.ok(await p.locator('.dm-card').count() === 0, 'Esc closes the dialog');
  T.ok(await p.evaluate(() => document.activeElement.classList.contains('id-signout')), 'focus returns to Sign out');
  T.ok(JSON.stringify(await dump(p)) === JSON.stringify(snap), 'Esc changed nothing');
  T.ok(!await p.evaluate(() => document.querySelector('main').hasAttribute('inert')), 'page is no longer inert');

  // Cancel button
  await opener.click();
  await p.locator('.dm-card').getByRole('button', { name: 'Cancel' }).click();
  T.ok(await p.locator('.dm-card').count() === 0 && JSON.stringify(await dump(p)) === JSON.stringify(snap), 'Cancel changed nothing');
  T.ok(await p.evaluate(() => document.activeElement.classList.contains('id-signout')), 'focus returns after Cancel');

  // Keyboard-only: Enter opens, type the first name, Tab to the button, Enter confirms
  await opener.focus(); await p.keyboard.press('Enter');
  T.ok(await p.locator('.dm-card').count() === 1, 'Enter on Sign out opens the dialog');
  await p.locator('.dm-text').focus();
  await p.keyboard.type('Jord');
  T.ok(await confirm.isDisabled(), 'still disabled with "Jord"');
  await p.keyboard.type('an');
  T.ok(await confirm.isEnabled(), 'enabled once the first name matches (any capitalization)');
  await p.keyboard.press('Control+A'); await p.keyboard.type('Lee');
  T.ok(await confirm.isDisabled(), 'last name alone does not enable it');
  await p.keyboard.press('Control+A'); await p.keyboard.type('jordan');
  await p.keyboard.press('Tab');
  T.ok(await p.evaluate(() => document.activeElement.classList.contains('dm-confirm')), 'Tab reaches the enabled confirm button');
  const nav = p.waitForNavigation({ waitUntil: 'load' }).catch(() => {});
  await p.keyboard.press('Enter');
  await nav; await p.waitForTimeout(1200);

  const after = await dump(p);
  const gone = Object.keys(snap).filter(k => !ALLOWED(k) && k in after);
  T.ok(gone.length === 0, 'every personal aplab key was removed' + (gone.length ? ': ' + gone.join(', ') : ''));
  T.ok(after['aplab:ui:allParts'] === snap['aplab:ui:allParts'] && after['aplab:pref:theme'] === snap['aplab:pref:theme'], 'site-wide preferences (ui, theme) are kept');
  const extra = Object.keys(after).filter(k => !ALLOWED(k) && k !== 'aplab:anon');
  T.ok(extra.length === 0, 'nothing else left behind' + (extra.length ? ': ' + extra.join(', ') : ''));
  T.ok(/index\.html$/.test(p.url()), 'lands on the home page: ' + p.url());
  T.ok(beforeUnloadPrompts === 0 && !(await p.evaluate(() => Lab.backup.guardActive())), 'no leave-page prompt, no backup guard');
  T.ok(await p.locator('.backup-bar').count() === 0, 'no backup bar');
  T.ok(/Not signed in yet/.test(await p.locator('.id-line').first().innerText()), 'home shows the signed-out sign-in prompt');
  T.ok(await p.locator('#resume').isHidden(), 'home "Pick up where you left off" card is gone');
  T.ok((await p.locator('[data-lab-progress]').allInnerTexts()).every(x => /Not started/.test(x)), 'home cards read Not started');
  T.ok(/Signed out\. This computer is ready for the next student\./.test(await p.locator('.toasts').innerText()), 'toast: Signed out. This computer is ready for the next student.');
  await p.screenshot({ path: OUT + '/t24-after-signout.png' });

  // next student: sign in, open a lab, the tour comes back
  await p.click('.id-change');
  T.ok(await p.locator('.id-panel').count() === 1, 'the sign-in panel opens');
  await p.fill('.id-panel input[type=text]', 'Sam Next');
  await p.selectOption('.id-panel select', '4');
  await p.click('.id-panel button[type=submit]');
  await p.waitForTimeout(500);
  await p.goto(srv.url + 'lab05.html'); await p.waitForTimeout(2500);
  T.ok(await p.locator('.tour').count() === 1, 'tour shows for the next student (tour flag was removed)');
  T.ok(await p.locator('.backup-bar').count() === 0, 'still no backup prompt');

  await p.close();
  ctx = await ctxFor(b, { seed: base() });
  p = await T.open(ctx, 'index.html', '', srv.url);
  T.ok(await p.locator('#resume').isVisible(), '(control) the pick-up card shows before sign-out');
  await p.locator('#home-identity .id-signout').click();
  const homeTxt = await p.locator('.dm-card').innerText();
  T.ok(/Lab 5 · 4 of 6 parts/.test(homeTxt) && /Lab 2 · 1 of 5 parts/.test(homeTxt), 'home dialog lists a progress-file button per lab with work');
  T.ok(await p.locator('.dm-card').getByRole('button', { name: 'Download progress file for Lab 5' }).count() === 1, 'home: progress-file button for Lab 5');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.locator('.dm-card').getByRole('button', { name: 'Download progress file for Lab 5' }).click()]);
  T.ok(/^Lab05_Lee_Jordan_progress\.json$/.test(dl.suggestedFilename()), 'progress file name: ' + dl.suggestedFilename());
  const pj = JSON.parse(require('fs').readFileSync(await dl.path(), 'utf8'));
  T.ok(pj.app === 'aplab' && pj.lab === 'lab05' && pj.student.name === 'Jordan Lee' && pj.data['field:zz-test'] === 'my answer', 'progress file holds the lab data');
  await p.locator('.dm-text').fill('Jordan');
  const nav2 = p.waitForNavigation({ waitUntil: 'load' }).catch(() => {});
  await p.locator('.dm-confirm').click(); await nav2; await p.waitForTimeout(900);
  T.ok(await p.locator('#resume').isHidden() && /Not signed in yet/.test(await p.locator('.id-line').first().innerText()), 'home after sign-out: no pick-up card, sign-in prompt');
  T.ok(/Signed out\./.test(await p.locator('.toasts').innerText()), 'home shows the signed-out message');
  T.ok(Object.keys(await dump(p)).filter(k => !ALLOWED(k) && k !== 'aplab:anon').length === 0, 'home sign-out leaves no personal keys');
  await ctx.close();

  /* ---------- 2. Start over with all labs (home) ---------- */
  console.log('Start over (all labs)');
  ctx = await ctxFor(b, { seed: base() });
  p = await T.open(ctx, 'lab05.html', '', srv.url);
  const ds1 = (await p.locator('.ds-id').first().innerText()).trim();
  await p.evaluate(() => localStorage.setItem('aplab:progress:lab05', JSON.stringify({ done: 4, total: 6, sections: 8, t: Date.now() })));
  await p.goto(srv.url + 'index.html'); await p.waitForTimeout(900);
  T.ok(/4 of 6 parts/.test(await p.locator('[data-lab-progress="lab05"]').innerText()), 'home card shows Lab 5 progress before');
  const snap2 = await dump(p);
  await p.locator('.manage-data summary').click();
  const so = p.locator('#md-startover'); await so.click();
  const d2 = p.locator('.dm-card'); const t2 = await d2.innerText();
  T.ok(/Lab 5: 4 of 6 parts/.test(t2) && /Lab 2: 1 of 5 parts/.test(t2), 'dialog lists labs with progress ("Lab 5: 4 of 6 parts")');
  const c2 = d2.getByRole('button', { name: 'Erase all my lab work' });
  T.ok(await c2.isDisabled(), 'Erase all my lab work starts disabled');
  await p.locator('.dm-text').fill('erase'); T.ok(await c2.isDisabled(), 'lower-case "erase" does not enable it');
  await p.locator('.dm-text').fill('ERAS'); T.ok(await c2.isDisabled(), '"ERAS" does not enable it');
  await p.screenshot({ path: OUT + '/t24-startover-1366.png' });
  await p.keyboard.press('Escape');
  T.ok(await p.locator('.dm-card').count() === 0 && JSON.stringify(await dump(p)) === JSON.stringify(snap2), 'Esc changed nothing');
  T.ok(await p.evaluate(() => document.activeElement.id === 'md-startover'), 'focus returns to the button');
  await so.click(); await d2.getByRole('button', { name: 'Cancel' }).click();
  T.ok(JSON.stringify(await dump(p)) === JSON.stringify(snap2), 'Cancel changed nothing');
  await so.click(); await p.locator('.dm-text').fill('ERASE'); T.ok(await c2.isEnabled(), 'typing ERASE enables it');
  const nav3 = p.waitForNavigation({ waitUntil: 'load' }).catch(() => {});
  await c2.click(); await nav3; await p.waitForTimeout(900);
  const a2 = await dump(p);
  T.ok(a2['aplab:student'] === snap2['aplab:student'], 'name and class kept');
  T.ok(a2['aplab:tour'] === snap2['aplab:tour'] && a2['aplab:ui:allParts'] === snap2['aplab:ui:allParts'] && a2['aplab:pref:theme'] === snap2['aplab:pref:theme'], 'tour flag and preferences kept');
  const work = Object.keys(a2).filter(k => /^aplab:(lab\d\d:|progress:|hint:|backup:|bookmark|last)/.test(k));
  T.ok(work.length === 0, 'all lab work, progress, hints, bookmark and last-visited cleared' + (work.length ? ': ' + work.join(', ') : ''));
  T.ok(await p.locator('#resume').isHidden(), 'pick-up card gone');
  const cards = await p.locator('[data-lab-progress]').allInnerTexts();
  T.ok(cards.length === 13 && cards.every(t => /Not started/.test(t)), 'all 13 home cards read "Not started"');
  T.ok(/All your lab work was erased/.test(await p.locator('.toasts').innerText()), 'confirmation toast');
  T.ok(await p.locator('.id-line').first().innerText().then(t => /Jordan Lee/.test(t)), 'still signed in as Jordan Lee');
  await p.goto(srv.url + 'lab05.html'); await p.waitForTimeout(900);
  const ds2 = (await p.locator('.ds-id').first().innerText()).trim();
  T.ok(ds1 && ds2 && ds1 !== ds2, `Dataset ID changed (${ds1} → ${ds2})`);
  await ctx.close();

  /* ---------- 3. Start over, one lab ---------- */
  console.log('Start over (one lab)');
  ctx = await ctxFor(b, { seed: base() });
  p = await T.open(ctx, 'lab05.html', '', srv.url);
  const snap3 = await dump(p);
  const ds3 = (await p.locator('.ds-id').first().innerText()).trim();
  T.ok(await p.locator('.responses-bar .btn-startover').count() === 1, 'Submit tools has Start over');
  await p.evaluate(() => document.querySelector('.btn-startover').click());
  const d3 = p.locator('.dm-card');
  T.ok(await d3.getAttribute('role') === 'alertdialog' && /Start Lab 5 over\?/.test(await d3.innerText()), 'same dialog style, names the lab');
  const c3 = d3.getByRole('button', { name: /Erase Lab 5 work/ });
  T.ok(await c3.isDisabled(), 'confirm disabled until the box is ticked');
  await p.screenshot({ path: OUT + '/t24-startlab-1366.png' });
  await p.keyboard.press('Escape');
  T.ok(await p.locator('.dm-card').count() === 0 && JSON.stringify(await dump(p)) === JSON.stringify(snap3), 'Esc changed nothing');
  await p.evaluate(() => document.querySelector('.btn-startover').click());
  await d3.getByRole('button', { name: 'Cancel' }).click();
  { const now = await dump(p), diff = Object.keys({ ...snap3, ...now }).filter(k => k !== 'aplab:last' && snap3[k] !== now[k]); T.ok(diff.length === 0, 'Cancel changed nothing' + (diff.length ? ': ' + diff.map(k => k + ' ' + snap3[k] + ' -> ' + now[k]).join(' | ') : '')); }
  await p.evaluate(() => document.querySelector('.btn-startover').click());
  await d3.getByRole('checkbox').focus(); await p.keyboard.press('Space');
  T.ok(await c3.isEnabled(), 'ticking the box (keyboard: Space) enables it');
  await p.keyboard.press('Space'); T.ok(await c3.isDisabled(), 'unticking disables it again');
  await p.keyboard.press('Space');
  const nav4 = p.waitForNavigation({ waitUntil: 'load' }).catch(() => {});
  await c3.click(); await nav4; await p.waitForTimeout(1000);
  const a3 = await dump(p);
  T.ok(!('aplab:lab05:field:zz-test' in a3) && !('aplab:lab05:keyres:x' in a3), 'Lab 5 answers and key results cleared');
  T.ok(!(a3['aplab:hint:lab05'] || '').includes('Do the thing') && !('aplab:bookmark' in a3) && !(a3['aplab:last'] || '').includes('old-step'), 'Lab 5 hint, bookmark and old last-visited cleared');
  T.ok(!a3['aplab:progress:lab05'] || JSON.parse(a3['aplab:progress:lab05']).done === 0, 'Lab 5 progress cleared');
  T.ok(a3['aplab:lab02:field:zz-test'] === snap3['aplab:lab02:field:zz-test'] && a3['aplab:hint:lab02'] === snap3['aplab:hint:lab02'] && a3['aplab:progress:lab02'] === snap3['aplab:progress:lab02'], 'Lab 2 work, hint and progress untouched');
  T.ok(a3['aplab:student'] === snap3['aplab:student'] && a3['aplab:ui:allParts'] === snap3['aplab:ui:allParts'], 'identity and preferences untouched');
  T.ok((await p.locator('.ds-id').first().innerText()).trim() === ds3, 'dataset unchanged');
  T.ok(/This lab was erased/.test(await p.locator('.toasts').innerText()), 'confirmation toast');
  T.ok(p.errors.length === 0, 'no page errors' + (p.errors.length ? ': ' + p.errors.join(' | ') : ''));
  await ctx.close();

  await b.close(); srv.close();
  T.done('t24-signout');
})();
