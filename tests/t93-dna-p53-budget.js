/* DNA Copying, p53 and Gene Expression companion: keeps the page light.
   Budget (counted in the browser, one section at a time, excluding the two scenes, the "Your data" boxes, the report and the footer):
     - words a student sees by default (not inside a closed "Show more" / "Write more" disclosure) <= 1500 on the whole page, <= 300 per section
     - words including closed disclosures <= 2400
     - free-text boxes a student sees by default <= 8, all free-text boxes (with "Write more") <= 12
   It also loads a save from the earlier, longer page (about 60 text boxes) and checks nothing is lost or broken.
   Run: NODE_PATH=$(npm root -g) node tests/t93-dna-p53-budget.js */
const T = require('./_h');
const PAGE = 'openscied-b3-dna-p53.html', KEY = 'aplab:openscied:b3-dna-p53:v1';
const SECTIONS = ['overview', 'ideas', 'fork', 'sense5', 'checklist', 'explain', 'expression', 'sense6', 'wrapup'];
const LIMITS = { visible: 1500, perSection: 300, all: 2400, boxesVisible: 8, boxesAll: 12 };
const stub = pg => pg.route(/gc\.zgo\.at|fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, contentType: /gc\.zgo\.at/.test(r.request().url()) ? 'application/javascript' : 'text/css', body: '' }));
(async () => {
  const browser = await T.launch();
  const server = await T.serve();
  try {
    const ctx = await T.ctxFor(browser, { width: 1366, height: 900 });
    const p = await ctx.newPage();
    const problems = [];
    p.on('pageerror', e => problems.push(e.message));
    await stub(p);
    await p.goto(server.url + PAGE);
    await p.waitForFunction(() => window.B3DnaP53 && document.querySelector('.step.is-current'));
    let vis = 0, all = 0, boxesVisible = 0, boxesAll = 0;
    for (const id of SECTIONS) {
      await p.evaluate(x => { location.hash = x; }, id);
      await p.waitForFunction(x => document.querySelector('#' + x + '.is-current'), id);
      const m = await p.evaluate(id => {
        const sec = document.getElementById(id), EX = '.scene-host,.your-data,.attribution,#investigation-report,.pager,.submit-card';
        let vis = 0, all = 0;
        const tw = document.createTreeWalker(sec, NodeFilter.SHOW_TEXT);
        for (let n; (n = tw.nextNode());) {
          const par = n.parentElement;
          if (!par || par.closest(EX) || par.closest('script,style')) continue;
          const c = (n.textContent.match(/\S+/g) || []).length; if (!c) continue;
          all += c;
          let d = par.closest('details'), closed = false;
          while (d) { const sm = par.closest('summary'); if (!d.open && !(sm && sm.parentElement === d)) closed = true; d = d.parentElement && d.parentElement.closest('details'); }
          if (par.getClientRects().length && !closed) vis += c;
        }
        const boxes = Array.from(sec.querySelectorAll('textarea:not([readonly]), input[type=text]'));
        return { vis, all, boxes: boxes.length, boxesVisible: boxes.filter(b => !b.closest('.write-more')).length };
      }, id);
      T.ok(m.vis <= LIMITS.perSection, id + ': ' + m.vis + ' words shown by default (limit ' + LIMITS.perSection + ')');
      vis += m.vis; all += m.all; boxesVisible += m.boxesVisible; boxesAll += m.boxes;
    }
    console.log('  info: ' + vis + ' words shown by default, ' + all + ' with disclosures, ' + boxesVisible + ' visible text boxes, ' + boxesAll + ' in all');
    T.ok(vis <= LIMITS.visible, 'page text shown by default: ' + vis + ' words (limit ' + LIMITS.visible + ')');
    T.ok(all <= LIMITS.all, 'page text including disclosures: ' + all + ' words (limit ' + LIMITS.all + ')');
    T.ok(boxesVisible <= LIMITS.boxesVisible, 'free-text boxes shown by default: ' + boxesVisible + ' (limit ' + LIMITS.boxesVisible + ')');
    T.ok(boxesAll <= LIMITS.boxesAll, 'free-text boxes in all: ' + boxesAll + ' (limit ' + LIMITS.boxesAll + ')');
    T.ok(await p.locator('main textarea:not([readonly])').evaluateAll(a => a.every(t => t.maxLength > 0 || t.closest('.write-more'))), 'every short writing box has a length limit; hints say how long to write');
    T.ok(await p.locator('.len-hint').count() >= 6, 'short boxes show a length hint');
    await ctx.close();

    // --- a save from the earlier, longer page ---
    const OLD = { 'ideas-chromosomes': 'Chromosomes hold genes.', 'ideas-compare': 'Cancer cells were different.', 'ideas-why': 'Mistakes?', 'ms5-q1': 'To reach the letters.', 'ms5-q2': 'A-T, G-C.', 'ms5-q3': 'They stuck out.',
      'ms5-q4a': 'Fixed it.', 'ms5-q4b': 'Nothing.', 'ms5-q4c': 'Nothing.', 'ms5-q5': 'Trust it more.', 'ms5-summary': 'Everything matched at the end.', 'gotta-ideas': 'DNA, errors, p53',
      'cl-relation-have': 'Chromosomes are DNA.', 'cl-relation-need': '', 'cl-relation-src-read': true, 'cl-relation-src-sim': false, 'cl-process-have': 'Unwind, unzip, pair.', 'cl-process-src-sim': true,
      'explanation-draft': 'DNA copying goes wrong sometimes.', 'ex-el-0': true, 'ex-el-1': true, 'ex-el-2': false, 'ex-el-3': false, 'ex-el-4': true, 'ex-el-5': false, 'peer-notes': 'Add evidence.', 'explanation-revised': 'Better.', 'next-questions': 'Why p53?',
      'expr-strand': 'A', 'expr-sentence': 'I am a p53 protein with a butterfly shape.', 'ms6-map-loc1-represents': 'nucleus', 'ms6-q2': 'It shows genes make proteins.', 'ms6-shape': 'Different.', 'ms6-questions': 'More?', 'gloss-mine': 'mutation',
      'exit-q1': 'a', 'exit-q2': 'e', 'exit-q3': 'A key in a lock.', 'exit-q4': 'd', 'exit-q5': 'All of them.', 'exit-q6': 'Shape matters.', 'exit-q7': 'My partner.', 'pt5-figured': 'Copying', 'pt6-questions': 'None', 'wrap-reflection': 'More detail.', 'wrap-limits': 'Size.' };
    const old = { v: 1, fork: { before: { top: { correct: 11, substitutions: 1 } } }, expression: { runs: [{ strand: 'A', sentence: 'x', matchesKey: true }] }, fields: OLD, feedback: { 'exit-q2': 'Yes.', sentence: 'x' },
      responseIds: Object.keys(OLD).filter(k => typeof OLD[k] === 'string' && !/^(expr-strand)$/.test(k)).concat(['exit-q1', 'exit-q2', 'exit-q4']), lastSection: 'checklist', lastVisitedAt: Date.now() - 5000 };
    const c2 = await T.ctxFor(browser, { width: 1366, height: 900 });
    await c2.addInitScript(([k, v]) => { try { if (!sessionStorage.getItem('__old')) { localStorage.setItem(k, v); sessionStorage.setItem('__old', '1'); } } catch (e) { /* ignore */ } }, [KEY, JSON.stringify(old)]);
    const q = await c2.newPage();
    const errs = [];
    q.on('pageerror', e => errs.push(e.message)); q.on('console', m => { if (m.type() === 'error' && !/gc\.zgo|fonts/.test(m.text())) errs.push(m.text()); });
    await stub(q);
    await q.goto(server.url + PAGE + '#wrapup');
    await q.waitForFunction(() => window.B3DnaP53 && document.querySelector('#wrapup.is-current'));
    T.ok(errs.length === 0, 'the page opens a save from the older page without errors ' + errs.join(' | '));
    T.ok(await q.isChecked('input[name="exit-q2-r"][value="e"]') && /^Yes\./.test(await q.locator('[data-q="exit-q2"] .q-fb').innerText()), 'old exit answers load into the new cards');
    T.ok(await q.inputValue('#ms5-summary') === 'Everything matched at the end.' && await q.inputValue('#explanation-draft') === 'DNA copying goes wrong sometimes.' && await q.inputValue('#exit-q7') === 'My partner.', 'old answers whose boxes still exist load into them');
    T.ok(await q.locator('#expr-sentence').evaluate(e => e.value) === 'I am a p53 protein with a butterfly shape.' && /^I am a p53/.test(await q.locator('#built-sentence').evaluate(e => e.textContent)), 'an old typed sentence appears in the word-bank sentence');
    T.ok(await q.evaluate(() => document.getElementById('ex-el-4').checked && !document.getElementById('ex-el-2').checked), 'old self-check ticks are kept');
    T.ok(await q.isChecked('input[name="cl-process-r"][value="know"]') && await q.isChecked('input[name="cl-relation-r"][value="know"]'), 'old checklist rows with evidence or a source count as "I know it"');
    const earlier = await q.locator('#earlier-answers-body').textContent();
    T.ok(/To reach the letters\./.test(earlier) && /Chromosomes hold genes\./.test(earlier) && /A key in a lock\./.test(earlier) && /mutation/.test(earlier), 'removed boxes are shown under "Earlier answers"');
    const saved = await q.evaluate(k => JSON.parse(localStorage.getItem(k)), KEY);
    T.ok(Object.keys(OLD).every(id => id in saved.fields && (typeof OLD[id] !== 'string' || id === 'expr-sentence' || id === 'exit-q1' || id === 'exit-q2' || saved.fields[id] === OLD[id] || typeof saved.fields[id] === 'string')), 'every old field is still in the saved record after the page re-saves');
    T.ok(saved.fields['ms5-q4a'] === 'Fixed it.' && saved.fields['cl-relation-have'] === 'Chromosomes are DNA.' && saved.fields['gloss-mine'] === 'mutation', 'removed fields keep their exact text');
    T.ok(saved.responseIds.length < 50 && saved.responseIds.includes('exit-q1') && saved.responseIds.includes('p-explain'), 'the response id list is the new one');
    const rep = await q.locator('#investigation-report').innerText();
    T.ok(/Earlier answer: DNA fork 1/.test(rep) && /To reach the letters\./.test(rep), 'the report includes the older answers');
    const bad = Object.keys(await q.evaluate(k => JSON.parse(localStorage.getItem(k)).fields, KEY)).length;
    T.ok(bad >= Object.keys(OLD).length, 'nothing was dropped from fields (' + bad + ' >= ' + Object.keys(OLD).length + ')');
    // dashboard: the card never shows more answers than responses
    await q.goto(server.url + 'openscied-dashboard.html');
    await q.waitForSelector('#dna-p53-progress');
    const txt = await q.locator('#dna-p53-progress').innerText();
    const m = /(\d+) of (\d+) responses/.exec(txt);
    T.ok(m && +m[1] <= +m[2] && +m[2] > 0, 'dashboard card count is sensible after the page re-saved an old record: ' + txt);
    // and straight from an old record the page has not rewritten yet
    await q.evaluate(([k, v]) => localStorage.setItem(k, v), [KEY, JSON.stringify(old)]);
    await q.reload();
    await q.waitForSelector('#dna-p53-progress');
    const txt2 = await q.locator('#dna-p53-progress').innerText();
    const m2 = /(\d+) of (\d+) responses/.exec(txt2);
    T.ok(m2 && +m2[1] <= +m2[2], 'dashboard card on an untouched old record stays at or below 100%: ' + txt2);
    T.ok(errs.length === 0, 'no errors on the dashboard');
    await c2.close();
    T.ok(problems.length === 0, 'no page errors while measuring ' + problems.join(' | '));
  } finally { await browser.close(); server.close(); }
  T.done('t93-dna-p53-budget');
})().catch(e => { console.error(e); process.exit(1); });
