/* Audit 5 #3: a dataset record from before owners were kept (aplab:<lab>:dataset with no owner and no created time) is marked
   owner: null, ownerUnverified: true. No "Is this your work?" notice. The copied text, the .docx, the PDF view, the progress file
   and the class dashboard say "Dataset owner: not recorded (work started before the November 2026 update)". Page loads and
   plain edits do not claim it; "Use a new dataset" does. A record made before sign-in (it has a created time) is still adopted.
   Run: NODE_PATH=$(npm root -g) node tests/t60-legacy-owner.js */
const T = require('./_h');
const path = require('path');
const LAB = 'lab04';
const NOTE = /not recorded \(work started before the November 2026 update\)/;
const rec = p => p.evaluate(l => JSON.parse(localStorage.getItem(`aplab:${l}:dataset`)), LAB);
const strip = (p, keepCreated) => p.evaluate(([l, k]) => { const v = JSON.parse(localStorage.getItem(`aplab:${l}:dataset`)); delete v.owner; delete v.ownerUnverified; if (!k) delete v.created; localStorage.setItem(`aplab:${l}:dataset`, JSON.stringify(v)); }, [LAB, keepCreated]);
(async () => {
  const b = await T.launch(), ctx = await T.ctxFor(b, { reduced: true });
  await ctx.addInitScript(() => { window.__copied = ''; try { Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async t => { window.__copied = t; } } }); } catch (e) { /* ignore */ } });
  const p = await T.open(ctx, LAB + '.html');
  const id1 = await p.evaluate(() => Lab.identity.seed.datasetId);

  // A legacy record: owner and created time missing.
  await strip(p, false);
  await p.reload(); await p.waitForTimeout(800);
  let r = await rec(p);
  T.ok(r.owner === null && r.ownerUnverified === true, 'legacy record is marked owner: null, ownerUnverified: true ' + JSON.stringify({ owner: r.owner, u: r.ownerUnverified }));
  T.ok(await p.locator('.id-owner').count() === 0, 'no "Is this your work?" notice');
  T.ok(await p.evaluate(() => Lab.identity.seed.datasetId) === id1, 'same Dataset ID');

  // Plain edits and reloads do not claim it.
  const ta = await p.evaluate(() => { const t = Array.from(document.querySelectorAll('textarea[data-save]')).find(x => !x.closest('.id-box')); return t && t.id; });
  await p.evaluate(() => Lab.pages && Lab.pages.showAll && Lab.pages.showAll(true));
  await p.fill('#' + ta, 'Some legacy work'); await p.waitForTimeout(400);
  await p.reload(); await p.waitForTimeout(800);
  r = await rec(p);
  T.ok(r.owner === null && r.ownerUnverified === true, 'an edit and a reload do not claim it');

  // Reports, copied text and the progress file say so.
  const rep = await p.evaluate(() => Lab.report.collect());
  T.ok(rep.datasetOwnerUnverified === true && !rep.datasetOwner, 'report data: datasetOwnerUnverified, no datasetOwner');
  await p.evaluate(() => Lab.pages && Lab.pages.showAll && Lab.pages.showAll(true));
  await p.click('button:has-text("Copy all my responses")'); await p.waitForTimeout(300);
  const copied = await p.evaluate(() => window.__copied);
  T.ok(/Dataset owner: not recorded/.test(copied) && NOTE.test(copied), 'copied text: "Dataset owner: not recorded (…)"');
  await p.addScriptTag({ path: path.join(__dirname, 'fixtures/jszip-3.10.1.min.js') });
  const docXml = await p.evaluate(async () => { const blob = await Lab.report.docx({ timelapse: false }); const z = await JSZip.loadAsync(await blob.arrayBuffer()); return z.file('word/document.xml').async('string'); });
  T.ok(/Dataset owner: /.test(docXml) && NOTE.test(docXml), '.docx header block says the owner was not recorded');
  const html = await p.evaluate(async () => { await Lab.report.open(); const t = document.querySelector('#lab-report .rv-info').textContent; Lab.report.close(); return t; });
  T.ok(/Dataset owner/.test(html) && NOTE.test(html), 'PDF view header says the owner was not recorded');
  const pay = await p.evaluate(() => Lab.progressFile.payload(true));
  T.ok(pay.datasetOwnerUnverified === true && !pay.datasetOwner, 'progress file: datasetOwnerUnverified true');

  // Class dashboard: a quiet note under the Dataset ID, a CSV column, no copy flag. Older files without the field too.
  const old = JSON.parse(JSON.stringify(pay)); delete old.datasetOwnerUnverified; old.student = { name: 'Old File', period: '2' }; old.datasetId = 'ABC-DEF';
  delete old.data.dataset.ownerUnverified; delete old.data.dataset.owner;
  const d = await T.open(ctx, 'teacher-dashboard.html');
  const dash = await d.evaluate(async ([a, o]) => {
    await Dash.addFiles([new File([JSON.stringify(a)], 'legacy.json'), new File([JSON.stringify(o)], 'old.json')]);
    return { recs: Dash.state.recs.map(x => ({ name: x.name, u: x.ownerUnverified, flags: x.flags })), notes: Array.from(document.querySelectorAll('.ds-note')).map(e => e.textContent), csv: Dash.csv() };
  }, [pay, old]);
  T.ok(dash.recs.length === 2 && dash.recs.every(x => x.u === true), 'dashboard reads both files as owner-not-recorded');
  T.ok(dash.notes.length === 2 && dash.notes.every(n => NOTE.test(n)), 'dashboard shows the note under the Dataset ID');
  T.ok(dash.recs.every(x => !x.flags.some(f => /started by/i.test(f))), 'not shown as a copy flag');
  T.ok(/,Dataset owner\r\n/.test(dash.csv) && /Not recorded \(started before the November 2026 update\)/.test(dash.csv), 'CSV has a Dataset owner column');
  await d.close();

  // "Use a new dataset" claims it: a new record with this student as owner.
  await p.click('.id-newds'); await p.waitForTimeout(200);
  await Promise.all([p.waitForEvent('load'), p.click('.id-confirm button:has-text("Use a new dataset")')]); await p.waitForTimeout(900);
  r = await rec(p);
  T.ok(r.owner && r.owner.name === 'Test Student' && !r.ownerUnverified, 'after "Use a new dataset" the owner is recorded');
  T.ok(!(await p.evaluate(() => Lab.report.collect())).datasetOwnerUnverified, 'report no longer says not recorded');

  // A record made before sign-in (created time, no owner) is adopted silently, as before.
  await strip(p, true);
  await p.reload(); await p.waitForTimeout(800);
  r = await rec(p);
  T.ok(r.owner && r.owner.name === 'Test Student' && !r.ownerUnverified, 'a record with a created time adopts the signed-in student');

  T.ok(p.errors.length === 0, 'no page errors ' + p.errors.join(' | '));
  await b.close(); T.done('t60-legacy-owner');
})();
