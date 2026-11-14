/* Audit 5 #1: each lab's dataset record keeps its owner (name, period, created, ID, number). A different student who
   uses "change" on a shared computer sees "This lab's work was started by … Is this your work?" with three choices;
   reports and progress files name the owner when it is someone else. One typo apart is worded gently, shown once.
   A legacy record (no owner) is "owner not recorded", not adopted (Audit 5 #3; see t60-legacy-owner.js).
   Run: NODE_PATH=$(npm root -g) node tests/t58-dataset-owner.js */
const T = require('./_h');
const path = require('path');
const LAB = 'lab05';
async function changeTo(p, name, period) {
  await p.click('.id-change'); await p.waitForTimeout(150);
  await p.fill('.id-box input[type=text]', name);
  await p.selectOption('.id-box select', period);
  await p.click('.id-box button[type=submit]'); await p.waitForTimeout(500);
}
const rec = p => p.evaluate(l => JSON.parse(localStorage.getItem(`aplab:${l}:dataset`)), LAB);
(async () => {
  const b = await T.launch(), ctx = await T.ctxFor(b, { reduced: true });
  const p = await T.open(ctx, LAB + '.html');
  const id1 = await p.evaluate(() => Lab.identity.seed.datasetId);

  // Owner metadata is stored with the record.
  let r = await rec(p);
  T.ok(r && r.owner && r.owner.name === 'Test Student' && r.owner.period === '3', 'record stores the owner name and period');
  T.ok(r && r.created > 0 && r.datasetId === id1 && r.datasetNumber === 1, 'record stores created time, Dataset ID and number');
  T.ok(await p.locator('.id-owner').count() === 0, 'no notice for the owner');

  // An old record without owner metadata is marked "owner not recorded" (Audit 5 #3), with no notice. More in t60-legacy-owner.js.
  const orig = await rec(p);
  await p.evaluate(l => { const v = JSON.parse(localStorage.getItem(`aplab:${l}:dataset`)); delete v.owner; delete v.created; localStorage.setItem(`aplab:${l}:dataset`, JSON.stringify(v)); }, LAB);
  await p.reload(); await p.waitForTimeout(800);
  r = await rec(p);
  T.ok(r.owner === null && r.ownerUnverified === true, 'old record is marked owner: null, ownerUnverified: true (not adopted)');
  T.ok(await p.locator('.id-owner').count() === 0 && await p.evaluate(() => Lab.identity.seed.datasetId) === id1, 'no notice, same Dataset ID');
  await p.evaluate(([l, v]) => localStorage.setItem(`aplab:${l}:dataset`, JSON.stringify(v)), [LAB, orig]);   // back to an owned record for the rest
  await p.reload(); await p.waitForTimeout(800);

  // Some work in the lab, then a different student signs in with "change".
  const ta = await p.evaluate(() => { const t = Array.from(document.querySelectorAll('textarea[data-save]')).find(x => !x.closest('.id-box')); return t && t.id; });
  await p.evaluate(() => Lab.pages && Lab.pages.showAll && Lab.pages.showAll(true));
  await p.fill('#' + ta, 'Student A wrote this'); await p.waitForTimeout(300);
  await changeTo(p, 'Jordan Lee', '3');
  const msg = await p.textContent('.id-owner').catch(() => '');
  T.ok(/This lab’s work was started by Test Student \(Period 3\)\. Is this your work\?/.test(msg), 'notice names the owner: ' + msg.slice(0, 90));
  T.ok(await p.locator('.id-owner button:has-text("Yes — I fixed my name")').count() === 1 && await p.locator('.id-owner button:has-text("Start my own dataset")').count() === 1 && await p.locator('.id-owner button:has-text("Sign out")').count() === 1, 'three choices offered');
  T.ok(await p.evaluate(() => Lab.identity.seed.datasetId) === id1 && await p.inputValue('#' + ta) === 'Student A wrote this', 'nothing changed or deleted');

  // Reports and the progress file name the owner.
  const rep = await p.evaluate(() => Lab.report.collect());
  T.ok(rep.name === 'Jordan Lee' && rep.datasetOwner && rep.datasetOwner.name === 'Test Student' && rep.datasetOwner.period === '3', 'report data includes the dataset owner');
  const pay = await p.evaluate(() => Lab.progressFile.payload(true));
  T.ok(pay.datasetOwner && pay.datasetOwner.name === 'Test Student' && pay.student.name === 'Jordan Lee', 'progress file includes datasetOwner');
  await p.addScriptTag({ path: path.join(__dirname, 'fixtures/jszip-3.10.1.min.js') });
  const docXml = await p.evaluate(async () => { const blob = await Lab.report.docx({ timelapse: false }); const z = await JSZip.loadAsync(await blob.arrayBuffer()); return z.file('word/document.xml').async('string'); });
  T.ok(/Dataset started by/.test(docXml) && /Test Student \(Period 3\)/.test(docXml), '.docx says "Dataset started by: Test Student (Period 3)"');
  const html = await p.evaluate(async () => { await Lab.report.open(); const t = document.querySelector('#lab-report .rv-info').textContent; Lab.report.close(); return t; });
  T.ok(/Dataset started by\s*Test Student \(Period 3\)/.test(html), 'PDF/preview header names the owner');

  // Sign out choice opens the existing dialog.
  await p.click('.id-owner button:has-text("Sign out")'); await p.waitForTimeout(300);
  T.ok(await p.locator('[role=alertdialog]').count() === 1, '"Sign out" opens the sign-out dialog');
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);

  // "Yes — I fixed my name": owner updated, data kept.
  await p.click('.id-owner button:has-text("Yes — I fixed my name")'); await p.waitForTimeout(300);
  r = await rec(p);
  T.ok(r.owner.name === 'Jordan Lee' && Array.isArray(r.ownerHistory) && r.ownerHistory[0].name === 'Test Student', 'fixed my name: owner updated, old owner kept in history');
  T.ok(await p.locator('.id-owner').count() === 0 && await p.evaluate(() => Lab.identity.seed.datasetId) === id1, 'notice gone, same Dataset ID');
  T.ok(!(await p.evaluate(() => Lab.progressFile.payload(true))).datasetOwner, 'no datasetOwner in the file once it is theirs');
  await p.reload(); await p.waitForTimeout(800);
  T.ok(await p.locator('.id-owner').count() === 0, 'still no notice after reload');

  // Another student: "Start my own dataset" gives a new ID and owner, existing data stays.
  await changeTo(p, 'Sam Ortiz', '4');
  T.ok(await p.locator('.id-owner').count() === 1, 'notice for a student in another period');
  await Promise.all([p.waitForEvent('load'), p.click('.id-owner button:has-text("Start my own dataset")')]); await p.waitForTimeout(900);
  r = await rec(p);
  const id2 = await p.evaluate(() => Lab.identity.seed.datasetId);
  T.ok(id2 !== id1 && r.datasetId === id2 && r.owner.name === 'Sam Ortiz' && r.owner.period === '4', 'own dataset: new ID ' + id2 + ', owner Sam Ortiz');
  T.ok(await p.evaluate(id => document.getElementById(id).value, ta) === 'Student A wrote this', 'existing data stays as is');
  T.ok(await p.locator('.id-owner').count() === 0, 'no notice for the new owner');

  // One typo apart: gentle notice shown once, then treated as the same person.
  await changeTo(p, 'Sam Ortzi', '4');
  T.ok(await p.locator('.id-owner.id-owner--close').count() === 1, 'one-typo change shows the gentle notice');
  T.ok(await p.locator('.id-owner .btn--primary:has-text("Yes — I fixed my name")').count() === 1, '"Yes — I fixed my name" is the main choice');
  await p.reload(); await p.waitForTimeout(800);
  r = await rec(p);
  T.ok(await p.locator('.id-owner').count() === 0 && r.owner.name === 'Sam Ortzi', 'shown once: on the next load the typo fix is adopted');
  T.ok(await p.evaluate(() => Lab.identity.seed.datasetId) === id2, 'Dataset ID unchanged by the typo fix');

  // The class dashboard flags a file whose dataset was started by someone else.
  const d = await T.open(ctx, 'teacher-dashboard.html');
  const flags = await d.evaluate(async pl => { await Dash.addFiles([new File([JSON.stringify(pl)], 'jordan.json')]); return Dash.state.recs.map(r => r.flags).flat(); }, pay);
  T.ok(flags.some(f => /Dataset started by Test Student \(Period 3\)/.test(f)), 'dashboard flags "Dataset started by Test Student (Period 3)"');

  T.ok(p.errors.length === 0, 'no page errors ' + p.errors.join(' | '));
  await b.close(); T.done('t58-dataset-owner');
})();
