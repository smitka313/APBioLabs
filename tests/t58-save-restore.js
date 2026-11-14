/* Audit 5 #3: save visibility and backups.
   - "Saved hh:mm" in the identity line, updated on each successful save.
   - A persistent warning when localStorage is missing or a write throws.
   - Loading a progress file names the student, the lab and the file's saved date, warns when the work on this computer
     is newer, and a damaged, partial or wrong file gives a friendly error and changes nothing.
   Run: NODE_PATH=$(npm root -g) node tests/t58-save-restore.js */
const T = require('./_h');
const fs = require('fs'), os = require('os'), path = require('path');
const MSG = 'This browser isn’t saving your work — download a progress file before you leave.';
const snap = p => p.evaluate(() => { const o = {}; Object.keys(localStorage).filter(k => k.startsWith('aplab:lab01:') && !k.endsWith(':saved-at')).sort().forEach(k => { o[k] = localStorage.getItem(k); }); return JSON.stringify(o); });
(async () => {
  const b = await T.launch();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'restore-'));
  const file = (name, text) => { const f = path.join(tmp, name); fs.writeFileSync(f, text); return f; };

  /* ---- Saved hh:mm ---- */
  {
    const ctx = await T.ctxFor(b, { reduced: true });
    const p = await ctx.newPage(); p.errors = []; p.on('pageerror', e => p.errors.push(e.message));
    await p.clock.install({ time: new Date('2026-11-14T09:05:00') });
    await p.goto('file://' + T.ROOT + '/lab01.html'); await p.waitForTimeout(800);
    T.ok(await p.locator('.id-line .id-saved').count() === 1, 'saved indicator is in the identity line');
    await p.evaluate(() => Lab.pages && Lab.pages.showAll && Lab.pages.showAll(true));
    const ta = await p.evaluate(() => Array.from(document.querySelectorAll('textarea[data-save]')).find(x => !x.closest('.id-box')).id);
    await p.fill('#' + ta, 'first thought'); await p.waitForTimeout(1200);
    const t1 = await p.textContent('.id-saved');
    T.ok(await p.locator('.id-saved').isVisible() && /^Saved 9:05\s?AM$/.test(t1), 'shows "Saved 9:05 AM" after a save: ' + t1);
    await p.clock.fastForward(3 * 60000); await p.fill('#' + ta, 'second thought'); await p.waitForTimeout(1200);
    const t2 = await p.textContent('.id-saved');
    T.ok(/^Saved 9:08\s?AM$/.test(t2), 'updates on the next save: ' + t2);
    T.ok(await p.locator('.storage-warn').count() === 0, 'no storage warning while saving works');
    // A write that throws (quota, private mode) turns on the persistent warning.
    await p.evaluate(() => { const orig = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (String(k).startsWith('aplab:lab01:')) throw new DOMException('full', 'QuotaExceededError'); return orig.call(this, k, v); }; });
    await p.fill('#' + ta, 'third thought'); await p.waitForTimeout(1200);
    T.ok((await p.textContent('.storage-warn').catch(() => '')).includes(MSG), 'a failed write shows: ' + MSG);
    T.ok((await p.textContent('.id-saved')) === 'Not saved', 'the indicator says "Not saved"');
    await p.clock.fastForward(60000); await p.waitForTimeout(300);
    T.ok(await p.locator('.storage-warn').isVisible(), 'the warning stays');
    T.ok(p.errors.length === 0, 'no page errors ' + p.errors.join(' | '));
    await ctx.close();
  }

  /* ---- localStorage missing altogether ---- */
  {
    const ctx = await b.newContext({ viewport: { width: 1366, height: 768 } });
    await T.routeLibs(ctx);
    await ctx.addInitScript(() => { Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new DOMException('denied', 'SecurityError'); } }); });
    const p = await T.open(ctx, 'lab01.html');
    T.ok((await p.textContent('.storage-warn').catch(() => '')).includes(MSG), 'no localStorage: warning on load');
    T.ok(p.errors.filter(e => !/localStorage|SecurityError|denied/.test(e)).length === 0, 'page still works without storage ' + p.errors.join(' | '));
    await ctx.close();
  }

  /* ---- Restore from a progress file ---- */
  const ctx = await T.ctxFor(b, { reduced: true });
  const p = await T.open(ctx, 'lab01.html');
  await p.evaluate(() => Lab.pages && Lab.pages.showAll && Lab.pages.showAll(true));
  const ta = await p.evaluate(() => Array.from(document.querySelectorAll('textarea[data-save]')).find(x => !x.closest('.id-box')).id);
  await p.fill('#' + ta, 'work on this computer'); await p.waitForTimeout(800);
  const pay = await p.evaluate(() => Lab.progressFile.payload(true));
  const key = 'field:' + await p.evaluate(id => document.getElementById(id).dataset.save, ta);
  T.ok(pay.data[key] === 'work on this computer', 'progress file holds the answer under ' + key);
  const mk = (savedAt, val) => JSON.stringify(Object.assign({}, pay, { savedAt, data: Object.assign({}, pay.data, { [key]: val }) }));
  const input = '.move-work input[type=file]';
  await p.click('.move-work summary').catch(() => {});
  const status = () => p.textContent('.move-work .tool-status');
  const confirmVisible = () => p.locator('.move-work .id-confirm').isVisible();

  // Older file: names student, lab, date and warns.
  const before = await snap(p);
  await p.setInputFiles(input, file('old.json', mk(new Date(Date.now() - 3 * 3600e3).toISOString(), 'older file text'))); await p.waitForTimeout(400);
  const q1 = await p.textContent('.move-work .id-confirm');
  T.ok(/Test Student \(Period 3\)’s Lab 1 work, saved [A-Z][a-z]{2} \d+, \d{4}/.test(q1), 'confirmation names the student, the lab and the saved date: ' + q1.slice(0, 110));
  T.ok(/The work on this computer is newer than this file \(saved .+\)\. Replace it anyway\?/.test(q1), 'warns that the work here is newer');
  T.ok(await p.locator('.move-work .id-confirm .btn--primary').textContent() === 'Replace anyway', 'button says "Replace anyway"');
  T.ok(await p.evaluate(() => document.activeElement && document.activeElement.textContent) === 'Cancel', 'focus starts on Cancel when the work here is newer');
  await p.click('.move-work .id-confirm .restore-cancel');
  T.ok(await snap(p) === before && await p.inputValue('#' + ta) === 'work on this computer', 'Cancel changes nothing');

  // Damaged, partial and wrong files: friendly error, nothing changed.
  const bad = {
    'truncated.json': mk(new Date().toISOString(), 'x').slice(0, 300),
    'notjson.json': 'hello',
    'wronglab.json': JSON.stringify(Object.assign({}, pay, { lab: 'lab02' })),
    'nodata.json': JSON.stringify(Object.assign({}, pay, { data: undefined })),
    'emptydata.json': JSON.stringify(Object.assign({}, pay, { data: {} })),
    'other.json': JSON.stringify({ hello: 1 }),
    'nolab.json': JSON.stringify(Object.assign({}, pay, { lab: undefined })),
  };
  // A question left from an earlier file must not stay up beside a new error.
  await p.setInputFiles(input, file('ok.json', mk(new Date(Date.now() + 60e3).toISOString(), 'x'))); await p.waitForTimeout(300);
  for (const [name, text] of Object.entries(bad)) {
    await p.setInputFiles(input, file(name, text)); await p.waitForTimeout(300);
    const s = await status();
    T.ok(/Nothing on this computer was changed\./.test(s) && await p.locator('.move-work .tool-status.is-bad').count() === 1 && !(await confirmVisible()), `${name}: friendly error, no confirmation: ${s.slice(0, 80)}`);
  }
  T.ok(/for Lab 2\. Open Lab 2/.test(await (async () => { await p.setInputFiles(input, file('wronglab2.json', bad['wronglab.json'])); await p.waitForTimeout(300); return status(); })()), 'wrong lab names the right lab');
  T.ok(await snap(p) === before && await p.inputValue('#' + ta) === 'work on this computer', 'bad files changed nothing');

  // A write that fails part way through a restore puts everything back.
  const atomic = await p.evaluate(o => {
    const orig = Storage.prototype.setItem; let n = 0;
    Storage.prototype.setItem = function (k, v) { if (String(k).startsWith('aplab:lab01:') && ++n === 3) throw new DOMException('full', 'QuotaExceededError'); return orig.call(this, k, v); };
    let msg = ''; try { Lab.progressFile.apply(Lab.progressFile.parse(o)); } catch (e) { msg = e.message; }
    Storage.prototype.setItem = orig; return msg;
  }, JSON.parse(mk(new Date().toISOString(), 'should not land')));
  T.ok(/Nothing on this computer was changed/.test(atomic), 'a restore that fails part way reports it');
  T.ok(await snap(p) === before, 'and the saved work is exactly as before');

  // A newer file: no warning, and it loads.
  await p.setInputFiles(input, file('new.json', mk(new Date(Date.now() + 3600e3).toISOString(), 'newer file text'))); await p.waitForTimeout(300);
  const q2 = await p.textContent('.move-work .id-confirm');
  T.ok(!/newer than this file/.test(q2) && /Replace your work on this lab with it\?/.test(q2), 'newer file: plain confirmation');
  await Promise.all([p.waitForEvent('load'), p.click('.move-work .id-confirm .restore-apply')]); await p.waitForTimeout(900);
  T.ok(await p.evaluate(id => document.getElementById(id).value, ta) === 'newer file text', 'Replace my work loads the file');

  // Reloading (pages re-save their fields on load) does not make the work here look newer than a file just saved.
  const fresh = await p.evaluate(() => Lab.progressFile.payload(true));
  await p.reload(); await p.waitForTimeout(900);
  T.ok(!(await p.evaluate(o => Lab.progressFile.question(Lab.progressFile.parse(o)).newer, fresh)), 'a reload alone is not "newer work"');

  // Same check for a resume link's question.
  const q3 = await p.evaluate(o => Lab.progressFile.question(o, true), JSON.parse(mk(new Date(Date.now() - 864e5).toISOString(), 'y')));
  T.ok(/^This link holds Test Student \(Period 3\)’s Lab 1 work/.test(q3.text) && /newer than this file/.test(q3.newer), 'resume links use the same question and newer warning');
  T.ok(p.errors.length === 0, 'no page errors ' + p.errors.join(' | '));
  await b.close(); fs.rmSync(tmp, { recursive: true, force: true }); T.done('t58-save-restore');
})();
