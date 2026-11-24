/* Fires: Peat, Decomposition and Earth's Tilt: checks from the outside play-test audit (B1, B2, D1).
   B1 the prediction sentence is complete in the section 6 note and the section 11 report; B2 foam never shrinks where it should not;
   D1 the wrap-up, the download and the dashboard use one definition of "answers".
   Run: NODE_PATH=$(npm root -g) node tests/t110-b2-fires-audit.js */
const T = require('./_h');
const fs = require('fs');
const L = require('../openscied-b2-fires-logic.js');
const PAGE = 'openscied-b2-fires.html', KEY = 'aplab:openscied:b2-fires:v1';
const stub = pg => pg.route(/gc\.zgo\.at|fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, contentType: /gc\.zgo\.at/.test(r.request().url()) ? 'application/javascript' : 'text/css', body: '' }));
const counts = p => p.evaluate(() => { const t = document.querySelector('#investigation-report .report-checks').textContent; const a = /(\d+) of (\d+) answers saved/.exec(t); return { answered: a ? +a[1] : null, total: a ? +a[2] : null, text: t }; });
const answerAll = p => p.evaluate(() => {
  const fire = e => e.dispatchEvent(new Event('change', { bubbles: true }));
  document.querySelectorAll('main select').forEach(s => { if (s.closest('.scene-host')) return; const o = [...s.options].find(x => x.value); s.value = o.value; fire(s); });
  new Set([...document.querySelectorAll('main input[type=radio]')].map(r => r.name)).forEach(n => { const r = document.querySelector('input[name="' + n + '"]'); r.checked = true; fire(r); });
  document.querySelectorAll('main textarea').forEach(t => { t.value = 'A short answer.'; t.dispatchEvent(new Event('input', { bubbles: true })); });
});
(async () => {
  // ---------- B2 (logic, 300 seeds) ----------
  const seeds = Array.from({ length: 300 }, (_, i) => (i + 1) * 104729 >>> 0);
  let drops = 0;
  for (const t of [5, 18, 27, 35]) for (const s of seeds) for (const b of [0, 1, 2]) { const x = L.foamSeries(s, b, t); for (let k = 1; k < x.length; k++) if (x[k] < x[k - 1]) drops++; }
  T.ok(drops === 0, 'B2: across 300 students x 3 beakers, foam at 5, 18, 27 and 35 C never decreases from one reading to the next (decreases: ' + drops + ')');
  let early = 0; for (const s of seeds) for (const b of [0, 1, 2]) { const x = L.foamSeries(s, b, 43); for (let k = 1; k < x.length; k++) if (x[k] < x[k - 1] && L.TIMES[k] <= 14) early++; }
  T.ok(early === 0, 'B2: 43 C foam does not decrease before its late settle (decreases up to 14 min: ' + early + ')');
  let ahead = 0; for (const s of seeds) if (L.foamSeries(s, 0, 18)[1] > L.foamSeries(s, 1, 27)[1]) ahead++;
  T.ok(ahead === 0, 'B2: the cold beaker is never ahead of the room beaker at 2 minutes');

  const browser = await T.launch(), server = await T.serve();
  try {
    const ctx = await T.ctxFor(browser, { width: 1366, height: 900 });
    const p = await ctx.newPage(); await stub(p);
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(server.url + PAGE + '#sense3'); await p.waitForFunction(() => window.B2Fires && document.querySelector('.step.is-current'));

    // ---------- Scientific evidence is not an ordinary answer slot ----------
    await p.evaluate(() => {
      const b=B2Fires, seed=b.seed('audit'); const L=b.logic;
      b.saveState('cards',{placed:Object.fromEntries(L.CARDS.map(c=>[c.id,c.zone]))});
      b.saveState('decomp',{seed,temps:[18,27,43],recorded:[0]});
      b.saveState('tilt',{seed,settings:['direct','tilt45','foil'],recorded:false});
    });
    const model=p.locator('#investigation-report [data-model-records]');
    T.ok((await counts(p)).answered===0 && /5 of 5 cards sorted correctly/.test(await model.textContent()) &&
      /1 foam reading recorded \(starting reading only\)/.test(await model.textContent()) && /0 of 3 BTB tubes/.test(await model.textContent()),
      'a solved card sort and starting foam reading appear separately when no written/question prompts are answered');
    T.ok(await p.locator('#cer-ev-1').isDisabled() && await p.locator('#cer-ev-3').isDisabled(),
      '0-minute foam and unread BTB cannot be cited in CER');
    await p.evaluate(() => {
      const b=B2Fires, seed=b.seed('audit');
      b.saveState('decomp',{seed,temps:[18,27,43],recorded:[0,20]});
      b.saveState('tilt',{seed,settings:['direct','tilt45','foil'],recorded:true});
    });
    T.ok(await p.locator('#cer-ev-1').isEnabled() && await p.locator('#cer-ev-3').isEnabled() &&
      /3 of 3 BTB tubes/.test(await model.textContent()), 'actual comparable records enable citation and count in Wrap up');
    await p.evaluate(() => { B2Fires.saveState('cards',null); B2Fires.saveState('tilt',null); });

    // ---------- B1: the prediction sentence, section 6 note and section 11 report, several beakers ----------
    let allGood = true; const seen = [];
    for (const temps of [[18, 27, 43], [5, 27, 35], [27, 35, 55], [43, 18, 5]]) for (const pred of ['cold', 'room', 'warm']) {
      await p.evaluate(([t, pr]) => { const seed = B2Fires.seed('b1'); B2Fires.saveState('decomp', { seed, startedAt: Date.now() - 1e6, skipped: true, temps: t, recorded: [0, 2, 20] }); const s = document.getElementById('pred-fastest'); s.value = pr; s.dispatchEvent(new Event('change', { bubbles: true })); }, [temps, pred]);
      const note = await p.locator('#pred-note').textContent();
      const rep = await p.evaluate(() => [...document.querySelectorAll('#investigation-report p.small')].map(x => x.textContent).find(x => /You predicted/.test(x)) || '');
      const ok = t => /most foam was in Beaker [123] \(\d+ °C\), at \d+ mm\.$/.test(t) && (t.match(/\(/g) || []).length === (t.match(/\)/g) || []).length;
      if (!ok(note) || !ok(rep) || note !== rep) { allGood = false; seen.push(temps + ' ' + pred + ': ' + note + ' | ' + rep); }
    }
    T.ok(allGood, 'B1: for 12 beaker and prediction combinations the section 6 note and the section 11 report give the same complete sentence ending in the foam height ' + seen.join(' || '));
    await p.evaluate(() => { const seed = B2Fires.seed('b1'); B2Fires.saveState('decomp', { seed, startedAt: Date.now() - 1e6, skipped: true, temps: [18, 27, 43], recorded: [0, 2, 20] }); const s = document.getElementById('pred-fastest'); s.value = 'warm'; s.dispatchEvent(new Event('change', { bubbles: true })); });
    const sample = await p.locator('#pred-note').textContent(), top = Math.max(...L.foamRows({ seed: await p.evaluate(() => B2Fires.getState().decomp.seed), temps: [18, 27, 43], recorded: [20] }).pop().h);
    T.ok(sample.endsWith('Beaker 3 (43 °C), at ' + top + ' mm.'), 'B1: the sample sentence names the beaker, its temperature and its foam height: ' + sample);

    // ---------- D1: one definition of answers ----------
    await answerAll(p);
    const done = await counts(p);
    const rec = await p.evaluate(k => JSON.parse(localStorage.getItem(k)), KEY);
    T.ok(done.answered === done.total && done.total === rec.responseIds.length, 'D1: wrap-up reads ' + done.answered + ' of ' + done.total + ' answers saved; the saved responseIds has ' + rec.responseIds.length);
    T.ok(!rec.responseIds.includes('ideas-because') && !rec.responseIds.includes('wrap-question') && rec.responseIds.includes('wrap-sentence'), 'D1: optional text boxes are not counted as required answers');
    await p.evaluate(() => { location.hash = 'wrapup'; }); await p.waitForFunction(() => document.querySelector('#wrapup.is-current'));
    await p.locator('#legacy-report-tools > summary').click();
    const [dl] = await Promise.all([p.waitForEvent('download'), p.locator('#download-work').click()]);
    const payload = JSON.parse(fs.readFileSync(await dl.path(), 'utf8'));
    T.ok(payload.answersSaved.answered === done.answered && payload.answersSaved.total === done.total && payload.responseIds.length === done.total, 'D1: the download says the same: ' + JSON.stringify(payload.answersSaved));
    const d = await ctx.newPage(); await stub(d);
    await d.goto(server.url + 'openscied-dashboard.html'); await d.waitForSelector('#b2-fires-progress');
    const m = /(\d+) of (\d+) answers saved/.exec(await d.locator('#b2-fires-progress').innerText());
    T.ok(m && +m[1] === done.answered && +m[2] === done.total, 'D1: the dashboard reads ' + (m && m[0]) + ', equal to the wrap-up (' + done.answered + ' of ' + done.total + ')');
    await p.evaluate(() => { const s = document.getElementById('sense-past'); if (s) { s.value = ''; s.dispatchEvent(new Event('change', { bubbles: true })); } });
    const less = await counts(p); await d.reload(); await d.waitForSelector('#b2-fires-progress');
    const m2 = /(\d+) of (\d+) answers saved/.exec(await d.locator('#b2-fires-progress').innerText());
    T.ok(less.answered === done.answered - 1 && m2 && +m2[1] === less.answered && +m2[2] === less.total, 'D1: with one answer cleared both show ' + less.answered + ' of ' + less.total + ' (dashboard ' + (m2 && m2[0]) + ')');
    const legacy = await p.evaluate(k => {
      const r = JSON.parse(localStorage.getItem(k));
      r.responseIds = r.responseIds.concat(['ideas-because', 'wrap-question']);
      localStorage.setItem(k, JSON.stringify(r));
      return r;
    }, KEY);
    await p.reload(); await p.waitForFunction(() => window.B2Fires && document.querySelector('.step.is-current'));
    const rec2 = await p.evaluate(k => JSON.parse(localStorage.getItem(k)), KEY);
    T.ok(rec2.responseIds.length === less.total && !rec2.responseIds.includes('wrap-question'), 'D1: an older record that counted the optional boxes is normalized on the next visit');
    T.ok(JSON.stringify(rec2) === JSON.stringify({ ...legacy, responseIds: rec.responseIds }),
      'D1: the migration preserves optional notes, model records and last-work time exactly');
    const savedBytes = JSON.stringify(rec2);
    await p.reload(); await p.waitForFunction(() => window.B2Fires && document.querySelector('.step.is-current'));
    T.ok(await p.evaluate(k => localStorage.getItem(k), KEY) === savedBytes,
      'D1: later visits do not rewrite the corrected record');
    await d.reload(); await d.waitForSelector('#b2-fires-progress');
    T.ok(new RegExp(less.answered + ' of ' + less.total + ' answers saved').test(await d.locator('#b2-fires-progress').innerText()),
      'D1: the dashboard counts the corrected legacy record using the same total');
    T.ok(errs.length === 0, 'no page errors ' + errs.join());
    await ctx.close();
  } finally { await browser.close(); server.close(); }
  T.done('t110-b2-fires-audit');
})().catch(e => { console.error(e); process.exit(1); });
