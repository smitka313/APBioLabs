/* End-to-end student workflow for all 13 labs, the way a student does it:
   home page → sign in (name + class period) → open the lab → answer a pre-lab question → run the simulation (data rows) →
   type a written response → reload (everything persists) → download the .docx report (student, Dataset ID, response, data) →
   save a progress file → load it in a fresh browser (identical data) → import the .docx and progress file into
   teacher-dashboard.html (right student, lab, Dataset ID). No page errors anywhere.
   Run: NODE_PATH=$(npm root -g) node tests/t59-e2e.js [lab01 lab05 ...]   (E2E_JOBS=4 sets how many labs run at once) */
const T = require('./_h'), D = require('./t59-drive');
const fs = require('fs'), os = require('os'), path = require('path');
const JSZip = require(path.join(__dirname, 'fixtures/jszip-3.10.1.min.js'));
const only = process.argv.slice(2), labs = T.LABS.filter(n => !only.length || only.includes(n));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const JOBS = +process.env.E2E_JOBS || 4;

async function freshCtx(b) {
  const ctx = await b.newContext({ viewport: { width: 1366, height: 900 }, acceptDownloads: true });
  await T.routeLibs(ctx); await ctx.route(/gc\.zgo\.at/, r => r.abort());
  await ctx.addInitScript(() => { try { if (!localStorage.getItem('aplab:tour')) localStorage.setItem('aplab:tour', JSON.stringify({ seen: true, v: 1 })); } catch (e) { /* ignore */ } });
  return ctx;
}
function watch(p, errors) {
  p.on('pageerror', e => errors.push(p.url().split('/').pop() + ' pageerror: ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !/gc\.zgo\.at|net::|Failed to load resource|fonts\.g/.test(m.text())) errors.push(p.url().split('/').pop() + ' console: ' + m.text()); });
  return p;
}
/* everything a student made on this lab, for before/after comparisons */
const snapshot = p => p.evaluate(() => {
  const ls = {}; Object.keys(localStorage).filter(k => k.startsWith('aplab:' + Lab.page.id + ':') && !/:(ui|tl|nudge|seen|pref|last-?seen|visited|backup)/.test(k)).sort().forEach(k => { ls[k] = localStorage.getItem(k); });
  return {
    tables: Lab._reg.tables.filter(t => t.opts.save).map(t => ({ id: t.el.id || t.opts.save, rows: JSON.stringify(t.getRows()) })),
    keyres: JSON.stringify(Lab.keyResults().map(k => [k.id, k.value]).sort((a, c) => a[0] < c[0] ? -1 : 1)), id: Lab.identity.get(), ds: Lab.identity.seed.datasetId,
    quizzes: JSON.stringify(Lab._reg.quizzes.map(q => q.state())), fields: Object.keys(ls).length,
  };
});

async function runLab(b, srv, lab, dir) {
  const ok = (c, m) => T.ok(c, lab + ': ' + m), errors = [];
  const name = 'Robin E2E-' + lab.slice(3), period = '5';
  // 1. home page sign-in
  const ctx = await freshCtx(b);
  const home = watch(await ctx.newPage(), errors);
  await home.goto(srv.url + 'index.html'); await sleep(700);
  if (!(await home.locator('.id-box form.id-panel').count())) await home.locator('.id-box .id-change').first().click();
  await home.locator('.id-box form.id-panel input[type=text]').first().fill(name);
  await home.locator('.id-box form.id-panel select').first().selectOption(period);
  await home.locator('.id-box form.id-panel button[type=submit]').first().click(); await sleep(400);
  const who = await home.evaluate(() => JSON.parse(localStorage.getItem('aplab:student') || 'null'));
  ok(who && who.name === name && String(who.period) === period, 'signed in on the home page: ' + JSON.stringify(who));
  // 2. open the lab from the home page card
  const link = home.locator(`a[href$="${lab}.html"]`).first();
  if (await link.count()) { await Promise.all([home.waitForNavigation(), link.click()]); } else await home.goto(srv.url + lab + '.html');
  await sleep(1000); const p = home;
  ok((await p.evaluate(() => Lab.identity.get())).name === name, 'lab page knows the student: ' + name);
  // 3. pre-lab question (first quiz, first question)
  const q = await p.evaluate(() => { const qz = Lab._reg.quizzes[0]; if (!qz) return null; Lab.pages.go(qz.el); return { id: qz.id }; });
  ok(!!q, 'has a pre-lab quiz');
  if (q) {
    await sleep(400);
    const first = p.locator('.quiz .q').first();
    if (await first.locator('input[type=radio], input[type=checkbox]').count()) await first.locator('input[type=radio], input[type=checkbox]').first().check({ force: true });
    else await first.locator('input[type=number]').fill('1');
    await first.getByRole('button', { name: 'Check answer' }).click(); await sleep(300);
    ok(await p.evaluate(() => Object.keys(Lab._reg.quizzes[0].state()).length > 0), 'pre-lab answer saved');
  }
  // 4. simulation
  await D.RUN[lab](p);
  if (D.SAVE_ROWS[lab]) await D.SAVE_ROWS[lab](p);
  const ran = await p.evaluate(() => Lab._reg.tables.filter(t => t.opts.save).reduce((s, t) => s + t.getRows().filter(r => !r._setup).length, 0));
  ok(ran > 0, 'simulation produced data rows: ' + ran);
  // 5. written response (first prompt in the Reflect / Analyze / Evaluate part)
  const resp = 'E2E written response for ' + lab + ': the data support my claim because the trend is clear.';
  const taId = await p.evaluate(() => {
    const secs = [...document.querySelectorAll('section.step')].reverse(), sec = secs.find(s => /^(Reflect|Analyze|Evaluate)$/.test(s.dataset.step) && s.querySelector('textarea[data-save]'));
    const ta = (sec || document).querySelector('textarea[data-save]'); Lab.pages.go(ta); return ta.id;
  });
  await sleep(500);
  await p.locator('#' + taId).fill(resp); await sleep(1300);
  const before = await snapshot(p);
  // 6. reload: everything persists
  await p.reload(); await sleep(2500);
  const after = await snapshot(p);
  ok(await p.evaluate(id => document.getElementById(id).value, taId) === resp, 'written response persists after reload');
  ok(after.quizzes === before.quizzes, 'pre-lab answer persists after reload');
  const diff = before.tables.filter((t, i) => !after.tables[i] || after.tables[i].rows !== t.rows).map(t => t.id);
  ok(diff.length === 0, 'every data table is identical after reload ' + diff.join(', '));
  ok(after.keyres === before.keyres || console.log('    ' + lab + ' keyres before ' + before.keyres + '\n    after  ' + after.keyres), 'key results persist');
  ok(after.ds === before.ds && after.id.name === name, 'key results, Dataset ID and identity persist: ' + after.ds);
  // 7. .docx report from the Submit part
  await p.evaluate(() => Lab.pages.go('submit')); await sleep(600);
  const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 30000 }), p.locator('section.step.is-current').getByRole('button', { name: 'Download .docx' }).first().click()]);
  const docx = path.join(dir, lab + '-report.docx'); await dl.saveAs(docx);
  const zip = await JSZip.loadAsync(fs.readFileSync(docx));
  const xml = (await zip.file('word/document.xml').async('string')).replace(/<w:tab\/>/g, ' ').replace(/<\/w:p>/g, '\n').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
  ok(xml.includes(name), '.docx names the student');
  ok(xml.includes(after.ds), '.docx carries the Dataset ID ' + after.ds);
  ok(xml.includes(resp), '.docx contains the written response');
  const cell = await p.evaluate(() => {   // one numeric cell of the biggest data table, formatted the way tables show it
    const t = Lab._reg.tables.filter(x => x.opts.save).map(x => ({ x, rows: x.getRows().filter(r => !r._setup) })).sort((a, c) => c.rows.length - a.rows.length)[0];
    if (!t || !t.rows.length) return null;
    const r = t.rows[t.rows.length - 1], c = t.x.opts.columns.find(cc => cc.num && typeof r[cc.key] === 'number' && !cc.editable) || t.x.opts.columns.find(cc => typeof r[cc.key] === 'string' && r[cc.key]);
    return c ? { label: c.label, v: c.num ? Lab.fmt(r[c.key], c.digits != null ? c.digits : 2) : r[c.key] } : null;
  });
  ok(cell && xml.includes(cell.label) && xml.includes(cell.v), `.docx contains the data table ("${cell && cell.label}" = ${cell && cell.v})`);
  ok(/aplab_payload_000/.test(await zip.file('docProps/custom.xml').async('string')), '.docx embeds the dashboard payload');
  // 8. progress file → fresh browser
  await p.locator('details.move-work summary').first().click();
  const [dl2] = await Promise.all([p.waitForEvent('download'), p.locator('details.move-work').getByRole('button', { name: 'Save progress file' }).first().click()]);
  const prog = path.join(dir, lab + '-progress.json'); await dl2.saveAs(prog);
  const pj = JSON.parse(fs.readFileSync(prog, 'utf8'));
  ok(pj.app === 'aplab' && pj.lab === lab && pj.student && pj.student.name === name && pj.datasetId === after.ds, 'progress file: lab, student and Dataset ID');
  const ctx2 = await freshCtx(b);
  const p2 = watch(await ctx2.newPage(), errors);
  await p2.goto(srv.url + lab + '.html#submit'); await sleep(1000);
  await p2.locator('details.move-work summary').first().click();
  await p2.locator('details.move-work input[type=file]').first().setInputFiles(prog); await sleep(300);
  await Promise.all([p2.waitForNavigation({ timeout: 15000 }).catch(() => {}), p2.locator('details.move-work').getByRole('button', { name: 'Replace my work' }).first().click()]);
  await sleep(3000);
  const restored = await snapshot(p2);
  const rdiff = after.tables.filter((t, i) => !restored.tables[i] || restored.tables[i].rows !== t.rows).map(t => t.id);
  ok(rdiff.length === 0, 'restored in a fresh browser: every data table identical ' + rdiff.join(', '));
  ok(restored.keyres === after.keyres && restored.quizzes === after.quizzes && restored.ds === after.ds && restored.id && restored.id.name === name, 'restored: key results, pre-lab, identity and Dataset ID identical');
  ok(await p2.evaluate(id => (document.getElementById(id) || {}).value, taId) === resp, 'restored: written response');
  // 9. teacher dashboard
  const ctx3 = await freshCtx(b); const dsh = watch(await ctx3.newPage(), errors);
  await dsh.goto(srv.url + 'teacher-dashboard.html'); await sleep(600);
  const no = +lab.slice(3);
  for (const [kind, file] of [['.docx', docx], ['progress file', prog]]) {   // each file on its own (together, the newer one replaces the older copy, by design)
    if (await dsh.locator('#clear').isVisible().catch(() => false)) await dsh.click('#clear');
    await dsh.setInputFiles('#files', [file]); await dsh.waitForSelector('table.grid', { timeout: 10000 }).catch(() => {}); await sleep(500);
    const g = await dsh.evaluate(() => ({ titles: [...document.querySelectorAll('.labblock h2')].map(x => x.textContent), rows: [...document.querySelectorAll('table.grid tbody tr')].map(tr => [...tr.children].map(c => c.textContent.replace(/\s+/g, ' ').trim())), skipped: [...document.querySelectorAll('#skipped li')].map(l => l.textContent) }));
    ok(g.titles.length === 1 && new RegExp('Lab ' + no + '\\b').test(g.titles[0]), `dashboard (${kind}) groups it under Lab ${no}: ` + g.titles.join(' | '));
    ok(g.rows.length === 1 && g.rows[0][0].startsWith(name) && g.rows[0][1] === period && g.rows[0].includes(after.ds), `dashboard (${kind}) shows ${name}, period ${period}, Dataset ID ${after.ds}: ${g.rows.map(r => r.slice(0, 4).join(' / ')).join(' ; ')}`);
    ok(g.skipped.length === 0, `dashboard (${kind}) skipped nothing ` + g.skipped.join(' | '));
  }
  ok(errors.length === 0, 'no page errors ' + errors.join(' | '));
  await ctx.close(); await ctx2.close(); await ctx3.close();
}

(async () => {
  const srv = await T.serve(), b = await T.launch();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 't59-e2e-'));
  const queue = labs.slice();
  await Promise.all(Array.from({ length: JOBS }, async () => { while (queue.length) { const lab = queue.shift(); console.log('== ' + lab); try { await runLab(b, srv, lab, dir); } catch (e) { T.ok(false, lab + ': workflow crashed: ' + e.message.split('\n')[0]); } } }));
  await b.close(); srv.close();
  T.done('t59-e2e');
})();
