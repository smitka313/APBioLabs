/* Audit 5 #2: the encrypted teacher-notes template (tools/encrypt-notes.js). Encrypts a tiny sample folder with a dummy
   password into a temp folder (never the real notes), then checks: an honest note on the form; "Keep unlocked in this tab"
   is off by default and is the only way the password is remembered; a visible "Lock notes" button forgets it, and a
   reload after locking shows the password form again.
   Run: NODE_PATH=$(npm root -g) node tests/t58-notes-lock.js */
const T = require('./_h');
const fs = require('fs'), os = require('os'), path = require('path'), { execFileSync } = require('child_process');
const PW = 'dummy-test-password';
(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'notes-')), src = path.join(tmp, 'src'), out = path.join(tmp, 'out');
  fs.mkdirSync(src);
  const page = (title, body) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${title}</title></head><body><main><h1>${title}</h1>${body}</main></body></html>`;
  fs.writeFileSync(path.join(src, 'teacher-notes.html'), page('Teacher notes', '<p id="secret">INDEX-SECRET</p><a id="go" href="teacher-lab01.html">Lab 1 notes</a>'));
  fs.writeFileSync(path.join(src, 'teacher-lab01.html'), page('Lab 1 Teacher Notes', '<p id="secret">LAB1-SECRET</p><a id="go" href="teacher-notes.html">All notes</a>'));
  execFileSync(process.execPath, [path.join(T.ROOT, 'tools/encrypt-notes.js'), src, out], { env: Object.assign({}, process.env, { NOTES_PASSWORD: PW }) });
  T.ok(!fs.readFileSync(path.join(out, 'teacher-lab01.html'), 'utf8').includes('LAB1-SECRET'), 'output holds no plaintext');

  const b = await T.launch(), ctx = await b.newContext();
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  const url = f => 'file://' + path.join(out, f);
  const tnpw = () => p.evaluate(() => sessionStorage.getItem('tn-pw'));
  const unlocked = async () => (await p.locator('#secret').count()) === 1;
  const unlock = async keep => { await p.fill('#pw', PW); if (keep) await p.check('#keep'); await p.click('button[type=submit]'); await p.waitForSelector('#secret', { timeout: 15000 }); };

  await p.goto(url('teacher-notes.html'));
  T.ok(/These notes are encrypted in the page, not behind a school login\. Anyone with the password can open them\./.test(await p.textContent('main')), 'honest line on the form');
  T.ok(await p.locator('#keep').count() === 1 && !(await p.isChecked('#keep')), '"Keep unlocked in this tab" exists and is off by default');
  T.ok(/Keep unlocked in this tab/.test(await p.textContent('label[for=keep]')), 'checkbox is labelled');

  // Default: not remembered.
  await unlock(false);
  T.ok(await unlocked(), 'unlocks with the password');
  T.ok(await tnpw() === null, 'password not stored when the box is off');
  T.ok(await p.locator('#tn-lock').isVisible() && (await p.textContent('#tn-lock')) === 'Lock notes', '"Lock notes" button is visible on the unlocked page');
  await p.click('#go'); await p.waitForLoadState('load'); await p.waitForTimeout(400);
  T.ok(!(await unlocked()) && await p.locator('#pw').count() === 1, 'moving to another notes page asks again when not kept');

  // Opt in: moving between pages stays unlocked.
  await unlock(true);
  T.ok(await tnpw() === PW, 'password kept in this tab when the box is ticked');
  await p.click('#go'); await p.waitForLoadState('load'); await p.waitForSelector('#secret', { timeout: 15000 }).catch(() => {});
  T.ok(await unlocked() && /INDEX-SECRET/.test(await p.textContent('#secret')), 'linked notes page opens without the password');
  T.ok(await p.locator('#tn-lock').isVisible(), 'lock button on that page too');

  // Lock: forgets the password, shows the form, and a reload does not reopen the notes.
  await Promise.all([p.waitForLoadState('load'), p.click('#tn-lock')]); await p.waitForTimeout(1200);
  T.ok(await p.locator('#pw').count() === 1 && !(await unlocked()), 'Lock notes returns to the password form');
  T.ok(await tnpw() === null, 'Lock notes clears tn-pw');
  await p.reload(); await p.waitForTimeout(1200);
  T.ok(await p.locator('#pw').count() === 1 && !(await unlocked()), 'reload after locking stays locked');
  await p.goto(url('teacher-lab01.html')); await p.waitForTimeout(1200);
  T.ok(!(await unlocked()), 'other notes pages stay locked too');

  // A stored password that no longer works is dropped.
  await unlock(true); await p.goto(url('teacher-notes.html')); await p.waitForTimeout(400);
  await p.waitForSelector('#secret', { timeout: 15000 });
  await p.evaluate(() => sessionStorage.setItem('tn-pw', 'stale')); await p.reload(); await p.waitForTimeout(1500);
  T.ok(await p.locator('#pw').count() === 1 && await tnpw() === null, 'a wrong stored password is dropped and the form shows');
  T.ok(errs.length === 0, 'no page errors ' + errs.join(' | '));
  await b.close(); fs.rmSync(tmp, { recursive: true, force: true }); T.done('t58-notes-lock');
})();
