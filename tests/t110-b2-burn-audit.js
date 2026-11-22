/* Burning Fuels: fixes and checks from the outside play-test audit (A1 to A4, D1).
   A1 corrected answers clear their wrong mark at once (guard: this held before too); A2 thermometer noise no longer makes near-identical fuels differ
   by several degrees; A3 grass at 5 s is inside the stated variation (page says so); A4 charcoal does draw droplets, so its label is right;
   D1 the wrap-up, the download and the dashboard use one definition of "answers".
   Run: NODE_PATH=$(npm root -g) node tests/t110-b2-burn-audit.js */
const T = require('./_h');
const fs = require('fs');
const L = require('../openscied-b2-burn-logic.js');
const PAGE = 'openscied-b2-burn-lab.html', KEY = 'aplab:openscied:b2-burn-lab:v1';
const stub = pg => pg.route(/gc\.zgo\.at|fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, contentType: /gc\.zgo\.at/.test(r.request().url()) ? 'application/javascript' : 'text/css', body: '' }));
const go = async (p, id) => { await p.evaluate(h => { location.hash = h; }, id); await p.waitForFunction(h => document.querySelector('#' + h + '.is-current'), id); };
const ALL = ['grass', 'leaves', 'wood', 'charcoal', 'peat'];
const seeds = Array.from({ length: 2000 }, (_, i) => (i + 1) * 7919 >>> 0);
const counts = p => p.evaluate(() => { const t = document.querySelector('#investigation-report .report-checks').textContent; const a = /(\d+) of (\d+) answers saved/.exec(t), c = /(\d+) of (\d+) checkable/.exec(t); return { answered: a ? +a[1] : null, total: a ? +a[2] : null, good: c ? +c[1] : null, graded: c ? +c[2] : null, text: t }; });
// Answer every question on the page the same way a student would (the first real option), directly in the DOM so hidden sections need no navigation.
const answerAll = (p, skip) => p.evaluate(skipIds => {
  const fire = e => e.dispatchEvent(new Event('change', { bubbles: true }));
  document.querySelectorAll('main select').forEach(s => { if (s.closest('.scene-host') || skipIds.includes(s.id)) return; const o = [...s.options].find(x => x.value); s.value = o.value; fire(s); });
  const names = new Set([...document.querySelectorAll('main input[type=radio]')].map(r => r.name));
  names.forEach(n => { if (skipIds.includes(n)) return; const r = document.querySelector('input[name="' + n + '"]'); r.checked = true; fire(r); });
  document.querySelectorAll('main textarea').forEach(t => { if (skipIds.includes(t.id)) return; t.value = 'A short answer.'; t.dispatchEvent(new Event('input', { bubbles: true })); });
}, skip || []);

(async () => {
  // ---------- A2: thermometer noise ----------
  let maxDiff = 0, worst = 0, bad = 0;
  for (const s of seeds) {
    const g = L.burnResult(s, 'grass', 1), l = L.burnResult(s, 'leaves', 1);
    maxDiff = Math.max(maxDiff, Math.abs(g.tempRise - l.tempRise));
    for (const f of ALL) { const r = L.burnResult(s, f, 1); worst = Math.max(worst, Math.abs(r.tempBefore - 22), Math.abs(r.tempAfter - Math.max(r.tempBefore, Math.round(22 + r.dT)))); if (r.tempAfter < r.tempBefore || !Number.isInteger(r.tempAfter)) bad++; }
  }
  T.ok(maxDiff <= 1, 'A2: across 2000 students, grass and leaves (true rise 2.5 and 2.6 C) never differ by more than 1 C in the table (largest: ' + maxDiff + ' C; was up to 5 C)');
  T.ok(worst <= 1 && bad === 0, 'A2: every reading is within 1 C of the true value, whole degrees, and never cooler after than before (worst ' + worst + ')');
  const g1 = L.burnResult(1, 'grass', 1), l1 = L.burnResult(1, 'leaves', 1), p1 = L.burnResult(1, 'peat', 1);
  T.ok(Math.abs(l1.dT - g1.dT) < 0.2 && p1.tempRise - g1.tempRise >= 10, 'A2: heat constants are unchanged (grass ' + g1.dT + ', leaves ' + l1.dT + ', peat ' + p1.dT + ' C true rise); peat still clearly warmest');
  // the same student's mass, BTB and timing numbers did not move (the noise still uses one draw per reading)
  const ref = L.burnResult(12345, 'wood', 2);
  T.ok(ref.massBefore === L.burnResult(12345, 'wood', 2).massBefore && ref.igniteS > 0, 'A2: results are reproducible for one student and sample');
  // ---------- A3: ignition timing is inside the stated variation ----------
  let maxGrass = 0; for (const s of seeds) maxGrass = Math.max(maxGrass, L.burnResult(s, 'grass', 1).igniteS);
  T.ok(maxGrass <= Math.round(4 * 1.15), 'A3: grass never catches later than 4 s x 1.15 = 4.6 s, shown as ' + Math.round(4 * 1.15) + ' s (largest in 2000 students: ' + maxGrass + ' s)');
  // ---------- A4: charcoal does draw droplets (so its label is right) ----------
  let minDrops = 99, noAnchor = 0;
  for (const s of seeds.slice(0, 400)) for (let n = 1; n <= 3; n++) {
    const r = L.burnResult(s, 'charcoal', n), dn = Math.round(r.dropletLevel * 44); minDrops = Math.min(minDrops, dn);
    const dg = L.makeRng(L.hash32('drops')); let right = false;   // same draws as the scene: first number of each drop is its angle
    for (let i = 0; i < 44; i++) { const t = Math.PI + 0.1 + dg.uniform() * (Math.PI - 0.2); dg.uniform(); dg.uniform(); if (i < dn && Math.cos(t) > 0) right = true; }
    if (!right) noAnchor++;
  }
  T.ok(minDrops >= 8 && noAnchor === 0, 'A4: a charcoal burn always draws at least 8 droplets (fewest: ' + minDrops + ') with one on the right side, so the "Droplets of water inside the dome" label is drawn and correct');
  T.ok(L.burnResult(1, 'charcoal', 1).dropletLevel < L.burnResult(1, 'peat', 1).dropletLevel && L.burnResult(1, 'charcoal', 1).dropletLevel < L.burnResult(1, 'grass', 1).dropletLevel, 'A4: charcoal still has the least condensation');

  const browser = await T.launch(), server = await T.serve();
  try {
    const ctx = await T.ctxFor(browser, { width: 1366, height: 900 });
    const p = await ctx.newPage(); await stub(p);
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(server.url + PAGE + '#wrapup'); await p.waitForFunction(() => window.B2Burn && document.querySelector('.step.is-current'));
    await p.evaluate(a => { const seed = B2Burn.seed('audit'); B2Burn.saveState('burn', { seed, fuel: 'peat', current: null, records: a.map(fuel => ({ fuel, n: 1, obs: [] })) }); }, ALL);

    // ---------- A1: correct, then wrong, then corrected again: the score returns ----------
    // choose the correct option of every checkable control, using the page's own checkers
    const fixes = await p.evaluate(() => {
      const burn = B2Burn.getState().burn, out = [];
      document.querySelectorAll('main select').forEach(s => {
        if (s.closest('.scene-host')) return;
        const m = /^pred-(\w+)-(ignite|energy)$/.exec(s.id); const opts = [...s.options].map(o => o.value).filter(Boolean);
        let good = null;
        for (const o of opts) { s.value = o; s.dispatchEvent(new Event('change', { bubbles: true })); const fb = document.getElementById('feedback-' + s.id); const st = m ? B2Burn.logic.checkPrediction(m[1], m[2], o, burn).status : fb && fb.dataset.state; if (st === 'correct') { good = o; break; } }
        if (good) out.push({ id: s.id, good, bad: opts.find(o => o !== good), kind: 'sel' });
      });
      document.querySelectorAll('main fieldset.mcq[data-correct]').forEach(fs => { const name = fs.querySelector('input').name, good = fs.dataset.correct; out.push({ id: name, good, bad: [...fs.querySelectorAll('input')].map(i => i.value).find(v => v !== good), kind: 'mcq' }); });
      return out;
    });
    const setPick = (c, v) => p.evaluate(([c, v]) => { if (c.kind === 'sel') { const s = document.getElementById(c.id); s.value = v; s.dispatchEvent(new Event('change', { bubbles: true })); } else { const r = document.querySelector('input[name="' + c.id + '"][value="' + v + '"]'); r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); } }, [c, v]);
    for (const c of fixes) await setPick(c, c.good);
    const full = await counts(p);
    T.ok(fixes.length === full.graded && full.good === full.graded, 'A1: with every checkable answer right the wrap-up reads ' + full.good + ' of ' + full.graded + ' (found ' + fixes.length + ' checkable controls)');
    let stuck = [];
    for (const c of fixes) { await setPick(c, c.bad); const w = await counts(p); await setPick(c, c.good); const b = await counts(p); if (w.good !== full.good - 1 || b.good !== full.good) stuck.push(c.id + ' wrong ' + w.good + ' fixed ' + b.good); }
    T.ok(stuck.length === 0, 'A1: for each of the ' + fixes.length + ' checkable answers, a wrong choice costs one point and correcting it gives it back ' + stuck.join(' | '));
    // survive a reload: wrong saved, reload, correct it
    await setPick(fixes[3], fixes[3].bad); await p.reload(); await p.waitForFunction(() => window.B2Burn && document.querySelector('.step.is-current'));
    const afterReload = await counts(p); await setPick(fixes[3], fixes[3].good); const fixedAgain = await counts(p);
    T.ok(afterReload.good === full.good - 1 && fixedAgain.good === full.good, 'A1: a wrong answer saved before a reload still clears when corrected after it (' + afterReload.good + ' then ' + fixedAgain.good + ')');

    // ---------- A2 page: the note under the data table ----------
    await go(p, 'burn');
    const note = await p.locator('#burn-scene [data-bn="temp-note"]').innerText();
    T.ok(/rise of only a degree or two can be thermometer noise/.test(note), 'A2: a note under the results table says a 1 to 2 degree rise can be thermometer noise');
    await go(p, 'wrapup');
    T.ok(/thermometer noise/.test(await p.locator('#investigation-report').innerText()), 'A2: the same note is in the report');
    // ---------- A3 page text ----------
    await go(p, 'burn');
    T.ok(/nearest second/.test(await p.locator('main').innerText()) || /nearest second/.test(await p.content()), 'A3: the page says the timing variation is about 15% and shown to the nearest second');

    // ---------- D1: one definition of answers ----------
    await go(p, 'wrapup');
    await answerAll(p, []);
    const done = await counts(p);
    const rec = await p.evaluate(k => JSON.parse(localStorage.getItem(k)), KEY);
    T.ok(done.answered === done.total && done.total === rec.responseIds.length, 'D1: wrap-up reads ' + done.answered + ' of ' + done.total + ' answers saved; the saved responseIds has ' + rec.responseIds.length);
    T.ok(!rec.responseIds.includes('ideas-because') && !rec.responseIds.includes('wrap-question') && rec.responseIds.includes('wrap-sentence'), 'D1: optional text boxes are not counted as required answers');
    const [dl] = await Promise.all([p.waitForEvent('download'), p.locator('#download-work').click()]);
    const payload = JSON.parse(fs.readFileSync(await dl.path(), 'utf8'));
    T.ok(payload.answersSaved.answered === done.answered && payload.answersSaved.total === done.total && payload.responseIds.length === done.total, 'D1: the download says the same: ' + JSON.stringify(payload.answersSaved));
    const d = await ctx.newPage(); await stub(d);
    await d.goto(server.url + 'openscied-dashboard.html'); await d.waitForSelector('#b2-burn-progress');
    const dtxt = await d.locator('#b2-burn-progress').innerText(), m = /(\d+) of (\d+) answers saved/.exec(dtxt);
    T.ok(m && +m[1] === done.answered && +m[2] === done.total, 'D1: the dashboard reads ' + (m && m[0]) + ', equal to the wrap-up (' + done.answered + ' of ' + done.total + ')');
    // leave one required answer out: both fall by one together
    await p.evaluate(() => { const s = document.getElementById('sense-btb'); s.value = ''; s.dispatchEvent(new Event('change', { bubbles: true })); });
    const less = await counts(p); await d.reload(); await d.waitForSelector('#b2-burn-progress');
    const m2 = /(\d+) of (\d+) answers saved/.exec(await d.locator('#b2-burn-progress').innerText());
    T.ok(less.answered === done.answered - 1 && m2 && +m2[1] === less.answered && +m2[2] === less.total, 'D1: with one answer cleared both show ' + less.answered + ' of ' + less.total + ' (dashboard ' + (m2 && m2[0]) + ')');
    // an old save that listed the optional boxes is rewritten with the one definition when the page opens
    await p.evaluate(k => { const r = JSON.parse(localStorage.getItem(k)); r.responseIds = r.responseIds.concat(['ideas-because', 'wrap-question']); localStorage.setItem(k, JSON.stringify(r)); }, KEY);
    await p.reload(); await p.waitForFunction(() => window.B2Burn && document.querySelector('.step.is-current'));
    const rec2 = await p.evaluate(k => JSON.parse(localStorage.getItem(k)), KEY);
    T.ok(rec2.responseIds.length === less.total && !rec2.responseIds.includes('wrap-question'), 'D1: an older record that counted the optional boxes is normalized on the next visit');
    T.ok(errs.length === 0, 'no page errors ' + errs.join());
    await ctx.close();
  } finally { await browser.close(); server.close(); }
  T.done('t110-b2-burn-audit');
})().catch(e => { console.error(e); process.exit(1); });
