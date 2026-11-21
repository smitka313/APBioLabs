/* Gene expression scene (openscied-b3-dna-p53.html, section "Gene expression"): mounting, each strand against the OpenSciEd
   answer key, live copy and edit checks, the CUU card note, seeded error injection, saved runs and "Your data", keyboard-only use.
   Run: NODE_PATH=$(npm root -g) node tests/t95-gene-expression-scene.js */
const T = require('./_h');
const PAGE = 'openscied-b3-dna-p53.html', KEY = 'aplab:openscied:b3-dna-p53:v1';
const stub = pg => pg.route(/gc\.zgo\.at|fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, contentType: /gc\.zgo\.at/.test(r.request().url()) ? 'application/javascript' : 'text/css', body: '' }));
// Answer key (Teacher Reference DNA Sequences + Answer Key Gene Expression Simulation), typed here independently of the page.
const DNA = { A: 'AAGCCAAGATCACGCCACTCCCCATAATGGTCCCTTCTG', B: 'AAGCCAAGATCACGCCACTCCCCATAAGAATCCCGA', C: 'AAGCCAAGATCACGCCACTCCCCATAATGGTCCTTTCTG' };
const AMINO = { A: 'Phe-Ser-Arg-Gly-Ile-Thr-Arg-Glu-Asp', B: 'Phe-Ser-Arg-Gly-Ile-Pro-Arg-Ala', C: 'Phe-Ser-Arg-Gly-Ile-Thr-Arg-Lys-Asp' };
const SENT = { A: 'I am a p53 protein with a butterfly shape.', B: 'I am a p53 protein missing a piece.', C: 'I am a p53 protein with a different shape.' };
const PARTNER = { A: 'U', T: 'A', G: 'C', C: 'G' };
const EDITED = { A: 'UUC-AGU-AGG-GGU-AUU-ACC-AGG-GAA-GAC', B: 'UUC-AGU-AGG-GGU-AUU-CUU-AGG-GCU', C: 'UUC-AGU-AGG-GGU-AUU-ACC-AGG-AAA-GAC' };
(async () => {
  const browser = await T.launch(), server = await T.serve();
  async function open(opts = {}, name) {
    const ctx = await T.ctxFor(browser, { width: 1366, height: 900, ...opts });
    if (name) await ctx.addInitScript(n => { try { if (!sessionStorage.getItem('__named')) { localStorage.setItem('aplab:student', JSON.stringify({ name: n, period: '3' })); sessionStorage.setItem('__named', '1'); } } catch (e) { /* ignore */ } }, name);
    const p = await ctx.newPage(); p.problems = [];
    p.on('console', m => { if (m.type() === 'error') p.problems.push('console: ' + m.text()); });
    p.on('pageerror', e => p.problems.push('pageerror: ' + e.message));
    await stub(p);
    await p.goto(server.url + PAGE + '#expression');
    await p.waitForSelector('#gene-expression-scene[data-ge-ready]');
    return { ctx, p };
  }
  const result = p => p.locator('#ge-result').innerText();
  async function fullRun(p, k, inject) {
    await p.click('[data-strand=' + k + ']');
    if (inject) await p.click('#ge-inject');
    await p.click('#ge-copy-rest'); await p.click('#ge-cross-all'); await p.click('#ge-send'); await p.click('#ge-match-all');
  }
  try {
    // ---------- mount ----------
    let { ctx, p } = await open();
    T.ok(await p.locator('#gene-expression-notice').isHidden(), 'placeholder notice disappears once the scene registers');
    T.ok(await p.locator('#gene-expression-scene canvas[role=img][aria-label]').count() === 1, 'canvas has role and aria-label');
    T.ok(/no strand chosen/i.test(await p.locator('#gene-expression-desc').innerText()), 'text description starts with the choose-a-strand state');
    T.ok(await p.locator('[aria-live]').count() === 1, 'the page keeps a single live region (the scene adds none)');
    // ---------- each strand against the key ----------
    for (const k of 'ABC') {
      await p.click('[data-strand=' + k + ']');
      await p.click('#ge-copy-rest');
      const copy = (await result(p)).match(/Copy \(RNA\)\s+([A-U-]+)/)[1];
      T.ok(copy === DNA[k].split('').map(b => PARTNER[b]).join('').match(/.{3}/g).join('-'), 'Strand ' + k + ': copy is the complement of the DNA with U for T');
      await p.click('#ge-cross-all'); await p.click('#ge-send'); await p.click('#ge-match-all');
      const txt = await result(p);
      T.ok(txt.includes(EDITED[k]), 'Strand ' + k + ': edited copy matches the key');
      T.ok(txt.includes(AMINO[k]), 'Strand ' + k + ': amino acids match the key (' + AMINO[k] + ')');
      T.ok(txt.includes(SENT[k]) && /Matches the lesson key/.test(txt), 'Strand ' + k + ': sentence matches the key');
      T.ok((await p.locator('#gene-expression-desc').innerText()).includes(SENT[k]), 'Strand ' + k + ': text description carries the sentence');
    }
    const runs = JSON.parse(await p.evaluate(k => localStorage.getItem(k), KEY)).expression.runs;
    T.ok(runs.length === 3 && runs.map(r => r.strand).join('') === 'ABC', 'three runs saved, one per strand');
    T.ok(runs.every(r => r.matchesKey === true && r.injectedError === false && typeof r.at === 'number' && r.dna === DNA[r.strand] && r.aminoAcids.join('-') === AMINO[r.strand] && r.sentence === SENT[r.strand]), 'saved runs follow the contract');
    T.ok(runs[1].edited === EDITED.B && runs[1].copy.split('-').length === 12, 'saved copy and edited strings use dash-joined groups');
    // Your data boxes and the report
    for (const id of ['#data-expression-body', '#data-sense6-body']) {
      const t = await p.locator(id).innerText();
      T.ok(/Run 1: Strand A/.test(t) && /Run 3: Strand C/.test(t) && t.includes(SENT.B) && /matches the key/.test(t), id + ' fills from the runs');
    }
    // restore after reload
    await p.reload(); await p.waitForSelector('#gene-expression-scene[data-ge-ready]');
    let t = await result(p);
    T.ok(t.includes('Strand C') && t.includes(SENT.C), 'reload restores the last saved run');
    T.ok(/last saved run/i.test(await p.locator('#ge-feedback').innerText()), 'restored view says it is a saved run');
    T.ok((await p.locator('#data-expression-body').innerText()).includes('Run 3: Strand C'), 'Your data still has the runs after reload');
    // reset a run
    await p.click('#ge-reset');
    t = await result(p);
    T.ok(/Strand C: 39 DNA letters/.test(t) && !/Sentence/.test(t) && /Step 1/.test(await p.locator('#ge-stage h4').innerText()), 'Start over resets the run to step 1');
    T.ok(JSON.parse(await p.evaluate(k => localStorage.getItem(k), KEY)).expression.runs.length === 3, 'Start over keeps the saved runs');
    // ---------- live copy checking ----------
    await p.click('[data-strand=A]');
    await p.click('.ge-base[data-base=A]');           // first DNA letter is A, so the partner is U: A is wrong
    let fb = await p.locator('#ge-feedback').innerText();
    T.ok(/^✕/.test(fb) && /A in the DNA pairs with U/.test(fb), 'wrong base flagged with glyph and words: ' + fb);
    T.ok(await p.locator('.ge-base[data-base=A].is-wrong').count() === 1, 'wrong base button marked');
    T.ok(!(await result(p)).includes('Copy (RNA)'), 'a wrong base is not added to the copy');
    await p.click('.ge-base[data-base=U]');
    fb = await p.locator('#ge-feedback').innerText();
    T.ok(/^✓/.test(fb) && /Copy \(RNA\)\s+U/.test(await result(p)), 'right base is accepted with a check mark');
    await p.focus('.ge-base[data-base=U]'); await p.keyboard.press('t');
    T.ok(/RNA uses U instead of T/.test(await p.locator('#ge-feedback').innerText()), 'typing T is flagged (RNA has U)');
    // ---------- edit step ----------
    await p.click('#ge-copy-rest');
    await p.click('[data-g="4"]');
    fb = await p.locator('#ge-feedback').innerText();
    T.ok(/^✕/.test(fb) && /Group 4 should stay/.test(fb) && /should stay/.test(await p.locator('[data-g="4"] .s').innerText()), 'wrongly crossed group flagged with glyph and text');
    T.ok(await p.locator('[data-g="4"]').getAttribute('aria-pressed') === 'true', 'group button exposes pressed state');
    await p.click('[data-g="4"]');
    for (const g of [2, 3, 5]) await p.click('[data-g="' + g + '"]');
    T.ok(/Step 2/.test(await p.locator('#ge-stage h4').innerText()), 'edit is not finished with groups 2, 3 and 5 only');
    await p.click('[data-g="6"]');
    T.ok(/Step 3/.test(await p.locator('#ge-stage h4').innerText()), 'crossing out exactly groups 2, 3, 5 and 6 completes the edit');
    t = await result(p);
    T.ok(t.includes('(groups 2, 3, 5, 6 crossed out)') && t.includes(EDITED.A), 'edited copy drops groups 2, 3, 5 and 6');
    await p.click('#ge-send');
    // ---------- card matching ----------
    T.ok(/real code: Leu/.test(await p.locator('.ge-card[data-code=GAA]').innerText()) && /real genetic code gives Leu/.test(await p.locator('.ge-card[data-code=GAA]').getAttribute('aria-label')), 'the GAA card shows its real code (Leu) on the card itself, in text and in its accessible name');
    T.ok(await p.locator('.ge-card .r').count() === 1, 'only the one disagreeing card carries the note');
    await p.click('.ge-card[data-code=CGA]');
    fb = await p.locator('#ge-feedback').innerText();
    T.ok(/^✕/.test(fb) && /not the complement of UUC/.test(fb) && /AAG/.test(fb), 'wrong card flagged with glyph and words: ' + fb);
    T.ok(await p.locator('.ge-card[data-code=CGA].is-wrong').count() === 1, 'wrong card marked');
    await p.click('.ge-card[data-code=AAG]');
    T.ok(/^✓/.test(await p.locator('#ge-feedback').innerText()) && (await result(p)).includes('Phe-…'), 'right card adds its amino acid to the chain');
    await ctx.close();

    // ---------- CUU card note (strand B) ----------
    ({ ctx, p } = await open());
    await fullRun(p, 'B');
    t = await result(p);
    T.ok(/† Card note/.test(t) && /CUU/.test(t) && /card says Pro/.test(t) && /standard genetic code gives Leu/.test(t) && /sentence matches the lesson/.test(t), 'strand B shows the CUU note (card Pro, real code Leu)');
    T.ok(/says Pro, but in the standard code CUU codes for Leu/.test(await p.locator('#expression').textContent()), 'the page note and the scene note agree (card Pro, standard code Leu)');
    await p.click('[data-strand=A]'); await p.click('#ge-copy-rest'); await p.click('#ge-cross-all'); await p.click('#ge-send'); await p.click('#ge-match-all');
    T.ok(!/Card note/.test(await result(p)), 'strand A has no card note');
    await ctx.close();

    // ---------- inject an error ----------
    const errorFor = async name => {
      const o = await open({}, name);
      await o.p.click('[data-strand=A]'); await o.p.click('#ge-inject'); await o.p.click('#ge-copy-rest');
      const fbk = await o.p.locator('#ge-feedback').innerText();
      await o.p.click('#ge-cross-all'); await o.p.click('#ge-send'); await o.p.click('#ge-match-all');
      const r = await result(o.p), sent = (r.match(/Sentence\s+[✓✕]?\s*([^\n]+)/) || [])[1];
      const saved = JSON.parse(await o.p.evaluate(k => localStorage.getItem(k), KEY)).expression.runs[0];
      await o.ctx.close(); return { fbk, sent, saved, r };
    };
    const e1 = await errorFor('Pat Lee'), e2 = await errorFor('Pat Lee');
    T.ok(/^⚠ Copying error/.test(e1.fbk), 'error appears during copying with a warning glyph and words: ' + e1.fbk.slice(0, 60));
    T.ok(e1.sent !== SENT.A && !/Matches the lesson key/.test(e1.r) && /Differs from the key/.test(e1.r), 'injected error changes the sentence and the key comparison: ' + e1.sent);
    T.ok(e1.saved.injectedError === true && e1.saved.matchesKey === false && e1.saved.sentence === e1.sent.trim(), 'saved run records the injected error and no key match');
    T.ok(e1.fbk === e2.fbk && e1.sent === e2.sent && e1.saved.copy === e2.saved.copy, 'same student, same strand: same error (reproducible)');
    const others = await Promise.all(['Ann Ray', 'Bo Chen', 'Cy Diaz', 'Di Evans', 'Ed Fox'].map(errorFor));
    T.ok(new Set([e1.saved.copy, ...others.map(o => o.saved.copy)]).size > 1, 'different Dataset IDs get different errors');
    T.ok(e1.saved.copy.length === 13 * 4 - 1 && /^[ACGU-]+$/.test(e1.saved.copy), 'errored copy is still 39 valid letters');
    // after a reload mid-run the armed error is the same one
    ({ ctx, p } = await open({}, 'Pat Lee'));
    await p.click('[data-strand=A]'); await p.click('#ge-inject'); await p.click('#ge-copy-rest');
    const f1 = await p.locator('#ge-feedback').innerText();
    await p.reload(); await p.waitForSelector('#gene-expression-scene[data-ge-ready]');
    await p.click('[data-strand=A]'); await p.click('#ge-inject'); await p.click('#ge-copy-rest');
    T.ok(f1 === await p.locator('#ge-feedback').innerText(), 'the error is the same after a reload');
    T.ok(/⚠/.test(await p.locator('#ge-inject').innerText()), 'inject button shows that an error is added');
    await p.click('#ge-cross-all'); await p.click('#ge-send'); await p.click('#ge-match-all');
    T.ok(/CHANGED|changed/.test(await p.locator('#ge-result').innerText()), 'result explains what the error changed');
    // Your data marks the error
    T.ok(/Yes/.test(await p.locator('#data-expression-body').innerText()), 'Your data shows "Copying error added: Yes"');
    // a second injected run for the same strand differs (the saved count feeds the seed)
    await p.click('[data-strand=A]'); await p.click('#ge-inject'); await p.click('#ge-copy-rest'); await p.click('#ge-cross-all'); await p.click('#ge-send'); await p.click('#ge-match-all');
    const rs = JSON.parse(await p.evaluate(k => localStorage.getItem(k), KEY)).expression.runs;
    T.ok(rs.length === 2 && rs[0].copy !== rs[1].copy, 'a second injected run for the same strand gets a new error');
    // injecting mid-copy keeps the work done so far when the error is still ahead
    await p.click('[data-strand=C]'); await p.click('.ge-base[data-base=U]'); await p.click('#ge-inject');
    T.ok(/Copy \(RNA\)\s+U/.test(await result(p)), 'injecting early keeps the letters already copied');
    await ctx.close();

    // ---------- keyboard-only completion ----------
    ({ ctx, p } = await open());
    const press = k => p.keyboard.press(k);
    await p.focus('[data-strand=B]'); await press('Enter');
    T.ok(await p.evaluate(() => document.activeElement.dataset.base) === 'A', 'choosing a strand with Enter moves focus to the copy buttons');
    for (const b of DNA.B) await p.keyboard.type(PARTNER[b]);
    T.ok(await p.evaluate(() => document.activeElement.dataset.g) === '1', 'finishing the copy by typing moves focus to the groups');
    for (let g = 1; g <= 6; g++) { if (g > 1) await press('Tab'); if ([2, 3, 5, 6].includes(g)) await press('Enter'); }
    T.ok(await p.evaluate(() => document.activeElement.id) === 'ge-send', 'finishing the edit by keyboard moves focus to Send');
    await press('Enter');
    const order = await p.evaluate(() => Array.from(document.querySelectorAll('.ge-card')).map(b => b.dataset.code));
    T.ok(await p.evaluate(() => document.activeElement.classList.contains('ge-card')), 'sending moves focus to the cards');
    const want = ['AAG', 'UCA', 'UCC', 'CCA', 'UAA', 'GAA', 'UCC', 'CGA'];
    for (const code of want) {
      let cur = order.indexOf(await p.evaluate(() => document.activeElement.dataset.code)), to = order.indexOf(code);
      while (cur < to) { await press('Tab'); cur++; } while (cur > to) { await press('Shift+Tab'); cur--; }
      await press('Enter');
    }
    t = await result(p);
    T.ok(t.includes(SENT.B) && t.includes(AMINO.B), 'keyboard-only run of Strand B gives the key sentence');
    T.ok(JSON.parse(await p.evaluate(k => localStorage.getItem(k), KEY)).expression.runs.length === 1, 'keyboard-only run is saved once');
    T.ok(p.problems.length === 0, 'no console or page errors ' + p.problems.join(' | '));
    await ctx.close();
  } finally { await browser.close(); server.close(); }
  T.done('t95-gene-expression-scene');
})().catch(e => { console.error(e); process.exit(1); });
