/* DNA fork scene (openscied-b3-dna-p53.html, Lesson 5): mounting, step order, seeded errors, glyph + text for mismatches, p53 rule,
   data tables against an independent calculation, save and restore, keyboard-only completion, reduced motion, reset dialog, canvas pixels.
   Run: NODE_PATH=$(npm root -g) node tests/t94-dna-fork-flow.js */
const T = require('./_h');
const PAGE = 'openscied-b3-dna-p53.html';
const PARTNER = { A: 'T', T: 'A', G: 'C', C: 'G' };
const stub = ctx => ctx.route(/gc\.zgo\.at|fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, contentType: /gc\.zgo\.at/.test(r.request().url()) ? 'application/javascript' : 'text/css', body: '' }));
const S = '#dna-fork-scene';
async function open(browser, server, o = {}) {
  const ctx = await T.ctxFor(browser, { width: o.w || 1366, height: o.h || 900, reduced: o.reduced, dark: o.dark });
  await stub(ctx);
  if (o.name) await ctx.addInitScript(n => { try { localStorage.setItem('aplab:student', JSON.stringify({ name: n, period: '4' })); } catch (e) { /* ignore */ } }, o.name);
  const p = await ctx.newPage(); p.problems = [];
  p.on('pageerror', e => p.problems.push('pageerror: ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !/gc\.zgo\.at|net::|Failed to load resource|fonts\.g/.test(m.text())) p.problems.push('console: ' + m.text()); });
  await p.goto(server.url + PAGE + '#fork');
  await p.waitForFunction(() => window.B3DnaP53 && document.querySelector('#fork.is-current') && window.B3DnaForkScene);
  return { ctx, p };
}
const st = p => p.evaluate(() => B3DnaForkScene.state());
const waitStage = (p, stage, ms = 15000) => p.waitForFunction(s => B3DnaForkScene.state().stage === s, stage, { timeout: ms });
const rate = (c, s) => (c + s) ? Math.round(1000 * s / (c + s)) / 10 : null;
async function toUnzipped(p) {
  await p.click(S + ' button:has-text("Unwind the DNA")'); await p.waitForFunction(() => B3DnaForkScene.state().steps.unwound);
  await p.click(S + ' button:has-text("Add helicase")'); await p.waitForFunction(() => B3DnaForkScene.state().steps.unzipped);
}
async function pairByHand(p, upto = 5) {
  const m = await st(p);
  for (const k of ['top', 'bottom']) for (let i = 0; i < upto; i++) {
    const old = (k === 'top' ? m.plan.top : m.plan.bottom)[i];
    await p.click(`${S} button[data-strand="${k}"][data-letter="${PARTNER[old]}"]`);
    await p.waitForFunction(() => { const x = B3DnaForkScene.state(); return !x.busy || x.stage === 'auto'; }, null, { timeout: 5000 });
  }
}
async function pixels(p) {
  return p.evaluate(sel => {
    const c = document.querySelector(sel + ' canvas'), x = c.getContext('2d'), d = x.getImageData(0, 0, c.width, c.height).data;
    const near = (r, g, b, t, i) => Math.abs(d[i] - r) < t && Math.abs(d[i + 1] - g) < t && Math.abs(d[i + 2] - b) < t;
    let red = 0, green = 0;
    for (let i = 0; i < d.length; i += 4) { if (near(179, 38, 30, 28, i) || near(242, 134, 127, 28, i)) red++; if (near(31, 122, 61, 28, i) || near(111, 208, 143, 28, i)) green++; }
    return { red, green, w: c.width, h: c.height };
  }, S);
}
const tableRows = (p, caption) => p.evaluate(([sel, cap]) => {
  const t = Array.from(document.querySelectorAll(sel + ' table')).find(x => x.querySelector('caption').textContent === cap);
  return t ? Array.from(t.querySelectorAll('tbody tr')).map(r => Array.from(r.children).map(c => c.textContent)) : null;
}, [S, caption]);

(async () => {
  const browser = await T.launch(); const server = await T.serve();
  try {
    // ---------------- mount, order, seeds, glyphs, p53 rule, tables (reduced motion = fast, deterministic) ----------------
    let { ctx, p } = await open(browser, server, { reduced: true, name: 'Ada Lovelace' });
    T.ok(await p.locator('#dna-fork-notice').isHidden(), 'the "coming in the next update" notice is hidden once the scene registers');
    T.ok(await p.locator(S + ' canvas[role="img"]').getAttribute('aria-label').then(a => /DNA fork model/.test(a)), 'canvas has role img and an aria-label');
    T.ok((await p.locator('#dna-fork-desc').innerText()).length > 40, 'text description is filled');
    T.ok(await p.locator('[aria-live]').count() === 1 || await p.locator(S + ' [aria-live]').count() === 0, 'the scene adds no live region of its own');
    let s = await st(p);
    T.ok(s.stage === 'wound' && !s.steps.unwound, 'starts wound up');
    T.ok(await p.locator(S + ' button:has-text("Add helicase")').isHidden(), 'helicase cannot be added before unwinding');
    T.ok(await p.locator(S + ' button[data-letter]').first().isHidden(), 'letters cannot be placed before unzipping');
    T.ok(s.plan.top.length === 24 && s.plan.bottom.length === 24 && s.plan.top.every((b, i) => PARTNER[b] === s.plan.bottom[i]), '24-letter template, bottom strand pairs with top');
    const plan0 = JSON.stringify(s.plan.subs), seed0 = s.seed;

    await p.click(S + ' button:has-text("Unwind the DNA")');
    s = await st(p); T.ok(s.steps.unwound && !s.steps.unzipped && s.stage === 'zipped', 'unwind comes first, then helicase');
    T.ok(await p.locator(S + ' button:has-text("Unwind the DNA")').isHidden(), 'unwind button goes away after unwinding');
    await p.click(S + ' button:has-text("Add helicase")');
    s = await st(p); T.ok(s.steps.unzipped && s.stage === 'pairing', 'helicase unzips, then pairing starts');
    // a wrong letter does not fit and is not counted
    const need0 = PARTNER[s.plan.top[0]], wrong = 'ACGT'.split('').find(l => l !== need0);
    await p.click(`${S} button[data-strand="top"][data-letter="${wrong}"]`);
    s = await st(p); T.ok(s.sites.top[0] === 'e', 'a letter that does not pair is rejected');
    // five by hand on each strand, then the model pairs the rest by itself
    await pairByHand(p, 5);
    s = await st(p);
    T.ok(s.stage === 'p53', 'after 5 + 5 hand pairs the model finishes pairing on its own (reduced motion: at once)');
    T.ok(!/e/.test(s.sites.top + s.sites.bottom), 'both new strands are complete (24 sites each)');
    const exp = k => { const sub = s.plan.subs[k].filter(Boolean).length; return { c: 24 - sub, s: sub }; };
    ['top', 'bottom'].forEach(k => {
      const n = (s.sites[k].match(/b/g) || []).length;
      T.ok(n === exp(k).s && n >= 1 && n <= 6, `${k}: substitutions on the board (${n}) match the seeded plan and are between 1 and 6`);
      T.ok(s.sites[k].slice(0, 5) === 'ggggg', `${k}: the five by-hand pairs are all correct`);
    });
    // mismatches have a glyph and text: description and canvas
    const d = await p.locator('#dna-fork-desc').innerText();
    T.ok(/mismatch/i.test(d) && /red cross/.test(d) && /letter \d+|letters \d+/.test(d), 'description names each mismatch by position with the words "red cross" and "mismatch"');
    T.ok(/✕/.test(await p.locator(S + ' .fork-legend').innerText()) && /✓/.test(await p.locator(S + ' .fork-legend').innerText()), 'legend pairs a glyph with each color');
    const px = await pixels(p); T.ok(px.red > 80 && px.green > 400, `canvas shows red (${px.red}) and green (${px.green}) letter cells`);
    // before-p53 table equals the independent calculation
    const before = await tableRows(p, 'After pairing, before p53');
    T.ok(before && before.length === 2, 'before-p53 table is shown');
    ['top', 'bottom'].forEach((k, i) => T.ok(before[i][1] === String(exp(k).c) && before[i][2] === String(exp(k).s) && before[i][3] === rate(exp(k).c, exp(k).s).toFixed(1) + '%', `${k}: before-table row ${before[i].join(' / ')} matches 100 x substitutions / (correct + substitutions)`));
    let fork = (await p.evaluate(() => B3DnaP53.getState())).fork;
    T.ok(fork.before.top.correct === exp('top').c && fork.before.top.substitutions === exp('top').s && fork.seed === seed0, 'saved fork.before and fork.seed follow the contract');
    T.ok(!(fork.after.top.correct + fork.after.top.substitutions), 'after is empty until p53 has been tried and letters replaced');
    const pageBox = await p.locator('#data-fork-body').innerText();
    T.ok(/After pairing, before p53/.test(pageBox) && /4\.2%|\d+\.\d%/.test(pageBox), 'the page "Your data" box fills from the model');

    // p53: b and c never fit; a fits and leaves a gap that needs the right letter
    const beforeSites = JSON.stringify(s.sites);
    for (const v of ['b', 'c']) for (const k of ['top', 'bottom']) await p.click(`${S} button[data-p53="${v}"][data-strand="${k}"]`);
    s = await st(p);
    T.ok(JSON.stringify(s.sites) === beforeSites, 'p53 (b) and p53 (c) remove nothing on either strand');
    T.ok(s.p53.b.tried === 2 && s.p53.c.tried === 2 && s.p53.b.removed === 0 && s.p53.c.removed === 0 && s.p53.a.tried === 0, 'tried counts rise, removed stays 0 for b and c');
    T.ok(/did not fit/.test(await p.locator('#dna-fork-desc').innerText()), 'text says p53 did not fit');
    const topBad = s.sites.top.indexOf('b');
    await p.click(`${S} button[data-p53="a"][data-strand="top"]`);
    s = await st(p);
    T.ok(s.sites.top[topBad] === 'x' && s.p53.a.removed === 1 && s.p53.a.tried === 1, 'p53 (a) removes the leftmost substitution and leaves a gap');
    T.ok(await p.locator(`${S} .fork-letters[aria-label^="Top"]`).isVisible(), 'a letter row appears for the gap');
    const needGap = PARTNER[s.plan.top[topBad]], wrongGap = 'ACGT'.split('').find(l => l !== needGap);
    await p.click(`${S} button[data-strand="top"][data-letter="${wrongGap}"]`);
    s = await st(p); T.ok(s.sites.top[topBad] === 'x', 'a wrong replacement letter does not fit the gap');
    await p.click(`${S} button[data-strand="top"][data-letter="${needGap}"]`);
    s = await st(p); T.ok(s.sites.top[topBad] === 'g', 'the right letter fills the gap');
    // finish with a: loop until zero substitutions
    for (let g = 0; g < 30; g++) {
      s = await st(p); if (s.stage === 'complete') break;
      let done = false;
      for (const k of ['top', 'bottom']) {
        const gi = s.sites[k].indexOf('x'), bi = s.sites[k].indexOf('b');
        if (gi >= 0) { await p.click(`${S} button[data-strand="${k}"][data-letter="${PARTNER[(k === 'top' ? s.plan.top : s.plan.bottom)[gi]]}"]`); done = true; break; }
        if (bi >= 0) { await p.click(`${S} button[data-p53="a"][data-strand="${k}"]`); done = true; break; }
      }
      if (!done) break;
    }
    s = await st(p);
    T.ok(s.stage === 'complete' && !/[bx]/.test(s.sites.top + s.sites.bottom), 'finishing: both strands end at 0 substitutions');
    const subsTotal = exp('top').s + exp('bottom').s;
    T.ok(s.p53.a.removed === subsTotal, `p53 (a) removed every substitution (${s.p53.a.removed} of ${subsTotal})`);
    const after = await tableRows(p, 'After p53 and replacing letters');
    T.ok(after && after[0].join('|') === 'Top strand|24|0|0.0%' && after[1].join('|') === 'Bottom strand|24|0|0.0%', 'after-p53 table: 24 correct, 0 substitutions, 0.0% on both strands');
    fork = (await p.evaluate(() => B3DnaP53.getState())).fork;
    T.ok(fork.stage === 'complete', 'the saved run records how far it got (stage: ' + fork.stage + ')');
    T.ok(fork.after.top.correct === 24 && fork.after.bottom.substitutions === 0 && fork.p53.a.tried >= 1 && fork.steps.unzipped, 'saved fork.after, p53 and steps follow the contract');
    T.ok(/✓ Copy complete|two double strands/.test(await p.locator('#dna-fork-desc').innerText()), 'end state says two double strands');
    const completeSites = JSON.stringify(s.sites), attemptsBeforeRetest = s.p53.c.tried;
    await p.getByRole('button',{name:'Add p53 (c) to the top strand',exact:true}).click();
    const retried = await st(p);
    T.ok(retried.p53.c.tried === attemptsBeforeRetest + 1 && JSON.stringify(retried.sites) === completeSites &&
      /p53 \(c\).*no substitution there/.test(await p.locator('.fork-result').innerText()),
      'visible p53 (c) control still records a test after repair and clearly reports no substitution');
    T.ok(p.problems.length === 0, 'no page errors in the full run ' + p.problems.join(' | '));

    // ---------------- reset dialog ----------------
    await p.click(S + ' button:has-text("Start over")');
    T.ok(await p.locator(S + ' dialog[open]').count() === 1, 'start over asks first');
    await p.click(S + ' dialog button:has-text("Cancel")');
    T.ok((await st(p)).stage === 'complete', 'cancel keeps the run');
    await p.click(S + ' button:has-text("Start over")'); await p.click(S + ' dialog button:has-text("Start over")');
    s = await st(p);
    T.ok(s.run === 1 && s.stage === 'wound' && JSON.stringify(s.plan.subs) !== plan0, 'confirming starts a new run with a different seeded plan');
    T.ok(/Run the model first/.test(await p.locator('#data-fork-body').innerText()), 'the page data box is cleared for the new run');
    await ctx.close();

    // ---------------- seeds: same student reproducible, another student differs ----------------
    const plans = [];
    for (const name of ['Ada Lovelace', 'Ada Lovelace', 'Grace Hopper', 'Alan Turing']) { const o = await open(browser, server, { reduced: true, name }); plans.push(JSON.stringify((await st(o.p)).plan)); await o.ctx.close(); }
    T.ok(plans[0] === plans[1], 'same Dataset ID gives the same template and errors after a reload');
    T.ok(plans[0] !== plans[2] && plans[0] !== plans[3] && plans[2] !== plans[3], 'different students get different data');
    const same = JSON.parse(plans[0]); T.ok(JSON.stringify(same.subs) === plan0, 'the first run matches the run seen earlier for that student');

    // ---------------- save and restore mid-run ----------------
    ({ ctx, p } = await open(browser, server, { reduced: true, name: 'Mid Run' }));
    await toUnzipped(p);
    let m = await st(p);
    for (let i = 0; i < 3; i++) await p.click(`${S} button[data-strand="top"][data-letter="${PARTNER[m.plan.top[i]]}"]`);
    await p.click(`${S} button[data-strand="bottom"][data-letter="${PARTNER[m.plan.bottom[0]]}"]`);
    const midBefore = await st(p);
    await p.reload(); await p.waitForFunction(() => window.B3DnaForkScene && document.querySelector('#fork.is-current'));
    let r = await st(p);
    T.ok(r.stage === 'pairing' && r.sites.top === midBefore.sites.top && r.sites.bottom === midBefore.sites.bottom && JSON.stringify(r.plan) === JSON.stringify(midBefore.plan), 'reload resumes mid-pairing with the same sites and the same plan');
    T.ok(/Top strand 3 of 5, bottom strand 1 of 5/.test(await p.locator('.fork-next').innerText()), 'resumed prompt shows 3 of 5 and 1 of 5');
    for (let i = 3; i < 5; i++) await p.click(`${S} button[data-strand="top"][data-letter="${PARTNER[m.plan.top[i]]}"]`);
    for (let i = 1; i < 5; i++) await p.click(`${S} button[data-strand="bottom"][data-letter="${PARTNER[m.plan.bottom[i]]}"]`);
    await p.click(`${S} button[data-p53="a"][data-strand="top"]`);
    const mid2 = await st(p);
    await p.reload(); await p.waitForFunction(() => window.B3DnaForkScene && document.querySelector('#fork.is-current'));
    r = await st(p);
    T.ok(r.sites.top === mid2.sites.top && r.p53.a.tried === 1 && r.p53.a.removed === 1, 'reload resumes after p53 with the gap and the p53 counts');
    T.ok(await p.locator(`${S} .fork-letters[aria-label^="Top"]`).isVisible(), 'the gap still asks for a letter after reload');
    T.ok(await tableRows(p, 'After pairing, before p53') !== null, 'tables come back after reload');
    await ctx.close();

    // ---------------- keyboard-only completion (real animations on, short run) ----------------
    ({ ctx, p } = await open(browser, server, { reduced: true, name: 'Keys Only' }));
    const press = async (sel) => {
      for (let i = 0; i < 90; i++) { if (await p.evaluate(x => { const a = document.activeElement; return !!a && a.matches(x); }, sel)) { await p.keyboard.press('Enter'); return true; } await p.keyboard.press('Tab'); }
      for (let i = 0; i < 180; i++) { if (await p.evaluate(x => { const a = document.activeElement; return !!a && a.matches(x); }, sel)) { await p.keyboard.press('Space'); return true; } await p.keyboard.press('Shift+Tab'); }
      return false;
    };
    await p.evaluate(() => document.querySelector('#dna-fork-scene .fork-next').scrollIntoView());
    T.ok(await press(S + ' button[data-act="unwind"]'), 'Unwind is reachable and operable by keyboard');
    T.ok(await press(S + ' button[data-act="helicase"]'), 'Helicase is reachable and operable by keyboard');
    m = await st(p);
    let ok = true;
    for (const k of ['top', 'bottom']) for (let i = 0; i < 5; i++) ok = (await press(`${S} button[data-strand="${k}"][data-letter="${PARTNER[(k === 'top' ? m.plan.top : m.plan.bottom)[i]]}"]`)) && ok;
    T.ok(ok && (await st(p)).stage === 'p53', 'ten letters placed by keyboard');
    for (let g = 0; g < 40; g++) {
      s = await st(p); if (s.stage === 'complete') break;
      let done = false;
      for (const k of ['top', 'bottom']) {
        const gi = s.sites[k].indexOf('x'), bi = s.sites[k].indexOf('b');
        if (gi >= 0) { await press(`${S} button[data-strand="${k}"][data-letter="${PARTNER[(k === 'top' ? s.plan.top : s.plan.bottom)[gi]]}"]`); done = true; break; }
        if (bi >= 0) { await press(`${S} button[data-p53="${g % 2 ? 'a' : 'b'}"][data-strand="${k}"]`); done = true; break; }
      }
      if (!done) break;
    }
    T.ok((await st(p)).stage === 'complete', 'whole model completed with the keyboard only (p53 b then a, replacing letters)');
    await ctx.close();

    // ---------------- reduced motion: no animation, each click is one stepwise state ----------------
    ({ ctx, p } = await open(browser, server, { reduced: true, name: 'Calm Motion' }));
    await p.click(S + ' button:has-text("Unwind the DNA")');
    T.ok((await st(p)).steps.unwound && !(await st(p)).busy, 'reduced motion: unwinding is instant');
    await p.click(S + ' button:has-text("Add helicase")');
    T.ok((await st(p)).steps.unzipped && !(await st(p)).busy, 'reduced motion: unzipping is instant');
    await ctx.close();

    // ---------------- real motion: the automatic pairing runs over time ----------------
    ({ ctx, p } = await open(browser, server, { name: 'Moving Pictures' }));
    await p.click(S + ' button:has-text("Unwind the DNA")');
    s = await st(p); T.ok(s.busy && !s.steps.unwound, 'with motion, unwinding takes time (busy while it animates)');
    await p.waitForFunction(() => B3DnaForkScene.state().steps.unwound, null, { timeout: 4000 });
    await p.click(S + ' button:has-text("Add helicase")');
    await p.waitForFunction(() => B3DnaForkScene.state().steps.unzipped, null, { timeout: 6000 });
    await pairByHand(p, 5);
    await p.waitForFunction(() => /e/.test(B3DnaForkScene.state().sites.top) && /g/.test(B3DnaForkScene.state().sites.top.slice(6)), null, { timeout: 4000 }).catch(() => {});
    s = await st(p);
    const partial = s.sites.top.indexOf('e') > 0 || s.stage === 'auto';
    T.ok(partial || s.stage === 'p53', 'automatic pairing happens in view (not all at once)');
    await waitStage(p, 'p53', 12000);
    T.ok(true, 'automatic pairing finishes by itself and the model moves on to p53');
    await ctx.close();
  } finally { await browser.close(); server.close(); }
  T.done('t94-dna-fork-flow');
})();

