/* Scientific reference tests for all 13 labs.
   Each lab is driven through its real UI (tests/t59-drive.js), then the numbers the page shows and saves (data tables,
   key results, checker verdicts) are compared with an independent calculation written from scratch in tests/t59-lib.js.
   Pure model functions that are not exposed on window are lifted from the page source (t59-lib fnSrc) and called directly.
   Also: plausibility across several student identities (seeds), invalid-input handling, and statistics against reference values.
   Run: NODE_PATH=$(npm root -g) node tests/t59-science.js [lab01 lab05 ...] */
const T = require('./_h'), D = require('./t59-drive'), L = require('./t59-lib');
const only = process.argv.slice(2), want = n => !only.length || only.includes(n);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const r2 = x => Math.round(x * 100) / 100;

/* A context signed in as a given student (so each identity gets its own seeded dataset). */
async function ctxAs(b, name, o = {}) {
  const ctx = await T.ctxFor(b, Object.assign({ reduced: false }, o));
  await ctx.route(/gc\.zgo\.at/, r => r.abort());
  await ctx.addInitScript(n => { try { if (!sessionStorage.getItem('__who')) { localStorage.setItem('aplab:student', JSON.stringify({ name: n, period: '4' })); sessionStorage.setItem('__who', '1'); } } catch (e) { /* ignore */ } }, name);
  return ctx;
}
const table = (d, id) => (d.tables.find(t => t.id === id) || { rows: [] }).rows.filter(r => !r._setup || id === 'mg-table');
const kr = (d, id) => (d.keyres.find(k => k.id === id) || {}).value;
const text = (p, sel) => p.evaluate(s => (document.querySelector(s) || {}).textContent || '', sel);
const val = (p, sel, v) => p.evaluate(([s, v]) => { const e = document.querySelector(s); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, [sel, String(v)]);
const errs = (p, lab) => T.ok(p.errors.length === 0, lab + ': no page errors ' + p.errors.join(' | '));
const IDS = ['Avery Stone', 'Jordan Ruiz', 'Kim Park'];

/* Statistics against reference values (no browser needed). */
async function statsReference(b) {
  console.log('\n== shared statistics (Lab.stats, the χ² table, the Lab 1 Welch test)');
  const ctx = await ctxAs(b, IDS[0]); const p = await T.open(ctx, 'lab12.html');
  const tbl = await p.evaluate(() => Lab.stats.CHI_TABLE);
  for (let df = 1; df <= 10; df++) {
    T.ok(L.near(tbl[df][0], L.chi2crit(df, 0.05), 0.006) && L.near(tbl[df][1], L.chi2crit(df, 0.01), 0.006), `χ² critical values df ${df}: page ${tbl[df].join(' / ')} vs computed ${L.chi2crit(df).toFixed(3)} / ${L.chi2crit(df, 0.01).toFixed(3)}`);
  }
  const A1 = [27.5, 21.0, 19.0, 23.6, 17.0, 17.9, 16.9, 20.1, 21.9, 22.6, 23.1, 19.6, 19.0, 21.7, 21.4], A2 = [27.1, 22.0, 20.8, 23.4, 23.4, 23.5, 25.8, 22.0, 24.8, 20.2, 21.9, 22.1, 22.9, 20.5, 24.4];
  const ref = L.welch(A1, A2);
  T.ok(L.near(ref.t, 2.46, 0.01) && L.near(ref.df, 24.99, 0.02) && L.near(ref.p, 0.021, 0.001), `reference Welch example reproduces the textbook values (t 2.46, df 24.99, p 0.021): ${ref.t.toFixed(3)}, ${ref.df.toFixed(2)}, ${ref.p.toFixed(4)}`);
  const ls = await p.evaluate(([a, b2]) => ({ m: Lab.stats.mean(a), sd: Lab.stats.sd(a), se: Lab.stats.se(a), med: Lab.stats.median(b2), lr: (() => { const f = Lab.stats.linreg([1, 2, 3, 4, 5], [2.1, 3.9, 6.2, 7.8, 10.1]); return [f.m, f.b, f.r2]; })(), chi: Lab.stats.chiSquare([30, 10], [20, 20]).chi2 }), [A1, A2]);
  T.ok(L.near(ls.m, L.mean(A1), 1e-12) && L.near(ls.sd, L.sd(A1), 1e-12) && L.near(ls.se, L.se(A1), 1e-12) && L.near(ls.med, L.median(A2), 1e-12), 'Lab.stats mean / sd (n−1) / SE / median match the reference');
  const lr = L.linreg([1, 2, 3, 4, 5], [2.1, 3.9, 6.2, 7.8, 10.1]);
  T.ok(L.near(ls.lr[0], lr.m, 1e-12) && L.near(ls.lr[1], lr.b, 1e-12) && L.near(ls.lr[0], 1.99, 1e-9), 'Lab.stats.linreg slope/intercept match (slope 1.99)');
  T.ok(L.near(ls.chi, 10, 1e-12), 'Lab.stats.chiSquare([30,10],[20,20]) = 10');
  const S = { mean: L.mean, sd: L.sd, se: L.se, median: L.median };
  const f1 = L.load('lab01.html', ['TC', 'tcrit', 'welch'], { S });
  const w = f1.welch(L.mean(A1), L.sd(A1), 15, L.mean(A2), L.sd(A2), 15);
  T.ok(L.near(w.t, ref.t, 1e-9) && L.near(w.df, ref.df, 1e-9) && w.sig === true, `Lab 1 welch() on the textbook example: t ${w.t.toFixed(3)}, df ${w.df.toFixed(2)}, crit ${w.crit}, significant`);
  let worst = 0, at = 0;
  for (let df = 1; df <= 200; df++) { const e = Math.abs(f1.tcrit(df) - L.tcrit(df)); if (e > worst) { worst = e; at = df; } }
  T.ok(worst <= 0.011, `Lab 1 t critical values (df 1–200, two-sided 0.05) within 0.011 of the exact quantile (worst ${worst.toFixed(4)} at df ${at})`);
  errs(p, 'stats'); await ctx.close();
}

const LABS = {};

LABS.lab01 = async b => {
  const S = { mean: L.mean, sd: L.sd, se: L.se, median: L.median };
  const h2s = [];
  for (const who of IDS) {
    const ctx = await ctxAs(b, who), p = await T.open(ctx, 'lab01.html');
    await D.RUN.lab01(p); const d = await D.dump(p);
    const g = table(d, 'gen-table'); const row = k => g.find(r => r.pop.startsWith(k));
    const all = row('Gen 1 · all'), sel = row('Gen 1 · selected'), g2 = row('Gen 2 · selected'), ctl = row('Gen 2 · control');
    T.ok(all && sel && g2, `lab01 [${who}]: generation table has Gen 1, selected parents and Gen 2 rows`);
    if (!all || !sel || !g2) { await ctx.close(); continue; }
    T.ok(g.every(r => L.near(r.se, r.sd / Math.sqrt(r.n), 1e-9)), `lab01 [${who}]: SE = SD/√n in every row`);
    T.ok(g.every(r => { const [lo, hi] = r.range.split('–').map(Number); return lo >= 0 && lo <= r.mean && r.mean <= hi && lo <= r.median && r.median <= hi; }), `lab01 [${who}]: no negative hair counts; mean and median inside the range`);
    T.ok(sel.n === Math.max(2, Math.round(all.n * 0.1)) && sel.mean > all.mean && +sel.range.split('–')[0] >= all.median, `lab01 [${who}]: selected parents are the hairiest ~10% (n ${sel.n} of ${all.n}, mean ${r2(sel.mean)} > ${r2(all.mean)})`);
    const S_ = sel.mean - all.mean, R = g2.mean - all.mean, h2 = R / S_;
    T.ok(L.near(kr(d, 'gen2-mean'), Math.round(g2.mean * 10) / 10, 1e-9), `lab01 [${who}]: key result Gen 2 mean ${kr(d, 'gen2-mean')} = table ${r2(g2.mean)}`);
    T.ok(L.near(kr(d, 'realized-h2'), r2(h2), 1e-9), `lab01 [${who}]: realized h² = R/S = ${R.toFixed(2)}/${S_.toFixed(2)} = ${h2.toFixed(3)} (page ${kr(d, 'realized-h2')}); breeder's equation R = h²S holds`);
    h2s.push(h2);
    if (ctl) T.ok(Math.abs(ctl.mean - all.mean) < 4 * Math.hypot(ctl.se, all.se) + 1, `lab01 [${who}]: control line stays near Gen 1 (${r2(ctl.mean)} vs ${r2(all.mean)})`);
    errs(p, 'lab01'); await ctx.close();
  }
  T.ok(h2s.length === 3 && h2s.every(h => h > 0.1 && h < 1), `lab01: realized h² is biologically plausible (0.1–1) for 3 identities: ${h2s.map(h => h.toFixed(2)).join(', ')} (model h² ≈ 0.5)`);
  T.ok(new Set(h2s.map(h => h.toFixed(3))).size === 3, 'lab01: the three identities get different datasets');
  // the model's design heritability (comment says ≈ 0.5): V_G = 2·L·p·q·a², V_E = σE²
  const VG = 2 * 24 * 0.3 * 0.7 * 2.2 ** 2, h2model = VG / (VG + 49);
  T.ok(L.near(h2model, 0.5, 0.02), `lab01: trichome model parameters give h² = ${h2model.toFixed(3)} (stated ≈ 0.5)`);
};

LABS.lab02 = async b => {
  const f = L.load('lab02.html', ['hwChi'], { S: { sum: L.sum } });
  const ex = f.hwChi(19, 53, 28), rx = L.hw(19, 53, 28);
  T.ok(L.near(ex.p, 0.455, 1e-12) && L.near(ex.chi2, rx.chi2, 1e-12) && ex.exp.every((e, i) => L.near(e, rx.exp[i], 1e-12)), `lab02 hwChi(19,53,28): p 0.455, expected ${ex.exp.map(x => x.toFixed(2)).join('/')}, χ² ${ex.chi2.toFixed(4)}`);
  T.ok(f.hwChi(10, 0, 0).degenerate && f.hwChi(0, 0, 0) === null, 'lab02 hwChi: one allele only → degenerate; no counts → null');
  for (const who of IDS.slice(0, 2)) {
    const ctx = await ctxAs(b, who), p = await T.open(ctx, 'lab02.html');
    await D.RUN.lab02(p); const d = await D.dump(p);
    const card = table(d, 'card-table');
    T.ok(card.length > 0 && card.every(r => { const n = r.aa + r.ab + r.bb; return n > 0 && L.near(r.p, (2 * r.aa + r.ab) / (2 * n), 1e-9) && L.near(r.p + r.q, 1, 1e-9) && r.p >= 0 && r.p <= 1; }), `lab02 [${who}]: card model p = (2AA+AB)/2N and p+q = 1 in all ${card.length} rows`);
    const ss = table(d, 'ss-table');
    T.ok(ss.length === 2 && ss.every(r => { const n = r.aa + r.ab + r.bb, h = L.hw(r.aa, r.ab, r.bb); return n === r.n && L.near(r.p1, h.p, 1e-12) && L.near(r.dp, r.p1 - r.p0, 1e-12) && L.near(r.chi, h.chi2, 1e-9); }), `lab02 [${who}]: spreadsheet rows: genotypes sum to N, new p, Δp and HW χ² match the reference`);
    T.ok(ss.every(r => r.p1 >= 0 && r.p1 <= 1) && Math.abs(ss[1].dp) <= Math.abs(ss[0].dp) + 0.05, `lab02 [${who}]: N = 1000 drifts less than N = 16 (Δp ${ss[0].dp.toFixed(3)} vs ${ss[1].dp.toFixed(3)})`);
    const mg = table(d, 'mg-table').filter(r => r.aa != null);
    T.ok(mg.length > 3 && mg.every(r => { const h = L.hw(r.aa, r.ab, r.bb); return L.near(r.p, h.p, 1e-9) && (r.fit === 'one allele only' || (L.near(r.chi, h.chi2, 1e-9) && (r.fit === 'fits') === (h.chi2 <= 3.841))); }), `lab02 [${who}]: many-generations rows: p and χ² vs HW match, "fits" ⇔ χ² ≤ 3.84 (${mg.length} rows)`);
    T.ok(mg.every(r => r.p >= 0 && r.p <= 1 && r.aa >= 0 && r.ab >= 0 && r.bb >= 0), `lab02 [${who}]: frequencies stay in 0–1, no negative counts`);
    { const top = ss.reduce((a, x) => Math.abs(x.dp) > Math.abs(a.dp) ? x : a).dp; T.ok(L.near(kr(d, 'ss-max-dp'), top, 0.0006), `lab02 [${who}]: key result largest Δp = ${kr(d, 'ss-max-dp')} (table ${top.toFixed(4)}; rows ${JSON.stringify(ss.map(r => [r.n, r.dp]))})`); }
    if (who === IDS[0]) {
      // the χ² calculator through the UI: a typed dataset, then invalid entries
      await D.show(p, 'analyze');
      const calc = async (a, ab, bb) => { await p.evaluate(([a, ab, bb]) => { [['#cs-aa', a], ['#cs-ab', ab], ['#cs-bb', bb]].forEach(([s, v]) => { const e = document.querySelector(s); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); }); document.querySelector('#cs-run').click(); }, [a, ab, bb]); await sleep(200); return { st: await text(p, '#cs-status'), rows: await p.evaluate(() => Lab._reg.tables.find(t => t.el.id === 'cs-out').getRows().length) }; };
      let c = await calc(25, 50, 25);
      T.ok(/χ² = 0\.00 with df = 1/.test(c.st) && /Fail to reject/.test(c.st) && c.rows === 3, 'lab02 calculator: 25/50/25 → χ² 0.00, df 1, fail to reject: ' + c.st.slice(0, 80));
      const r = L.hw(12, 30, 58);
      c = await calc(12, 30, 58);
      T.ok(c.st.includes('χ² = ' + r.chi2.toFixed(2)) && c.st.includes('p = ' + r.p.toFixed(3)) && /Reject the null/.test(c.st) === (r.chi2 > 3.841), `lab02 calculator: 12/30/58 → p ${r.p.toFixed(3)}, χ² ${r.chi2.toFixed(2)} (reference)`);
      for (const [lbl, v] of [['blank', ['', '30', '58']], ['negative', ['-3', '30', '58']], ['decimal', ['2.5', '30', '58']], ['text', ['abc', '30', '58']]]) {
        c = await calc(...v);
        T.ok(/No χ² calculated/.test(c.st) && c.rows === 0, `lab02 calculator rejects a ${lbl} count: "${c.st.slice(0, 70)}"`);
      }
      c = await calc(40, 0, 0);
      T.ok(/only one allele/.test(c.st) && c.rows === 0, 'lab02 calculator: one allele only → clear message, no χ²');
    }
    errs(p, 'lab02'); await ctx.close();
  }
};

LABS.lab03 = async b => {
  const ctx = await ctxAs(b, IDS[0]), p = await T.open(ctx, 'lab03.html');
  // the page's own Smith-Waterman + BLAST statistics, called on sequences we control
  const R = await p.evaluate(() => {
    const rnd = Lab.rng(7), base = () => 'ACGT'[Math.floor(rnd.uniform() * 4)];
    const q = Array.from({ length: 300 }, base).join('');
    const mut = (s, k) => { const a = s.split(''); const idx = new Set(); while (idx.size < k) idx.add(Math.floor(rnd.uniform() * a.length)); idx.forEach(i => { a[i] = a[i] === 'A' ? 'C' : 'A'; }); return a.join(''); };
    const s10 = mut(q, 30), s30 = mut(q, 90), sGap = q.slice(0, 150) + 'TTTT' + q.slice(150), rand = Array.from({ length: 300 }, base).join('');
    const targets = [{ org: 'same', seq: q }, { org: 'm10', seq: s10 }, { org: 'm30', seq: s30 }, { org: 'gap', seq: sGap }, { org: 'rand', seq: rand }];
    const hits = blast(q, targets, 'blastn');
    const aln = targets.map(t => swAlign(q, t.seq, PROGRAMS.blastn));
    return { q, targets, hits: hits.map(h => ({ org: h.org, bits: h.bits, E: h.E, ident: h.ident, score: h.score, nid: h.nid, len: h.len, qa: h.qa, sa: h.sa })), aln: aln.map(a => ({ score: a.score, nid: a.nid, len: a.len, qa: a.qa, sa: a.sa })), P: PROGRAMS.blastn };
  });
  R.aln.forEach((a, i) => {
    const ref = L.swScore(R.q, R.targets[i].seq, R.P);
    let nid = 0; for (let k = 0; k < a.qa.length; k++) if (a.qa[k] === a.sa[k] && a.qa[k] !== '-') nid++;
    T.ok(a.score === ref && a.nid === nid && a.len === a.qa.length && a.qa.replace(/-/g, '').length <= R.q.length, `lab03 swAlign vs reference Smith-Waterman (${R.targets[i].org}): score ${a.score} = ${ref}; identities recount ${nid}/${a.len}`);
  });
  const by = Object.fromEntries(R.hits.map(h => [h.org, h]));
  T.ok(by.same && L.near(by.same.ident, 100, 1e-9) && by.same.score === 600, 'lab03 blast: identical sequence → 100% identity, raw score 2×300');
  T.ok(by.m10 && L.near(by.m10.ident, 90, 0.5) && by.m30 && L.near(by.m30.ident, 70, 2), `lab03 blast: 30 and 90 substitutions in 300 nt → ${by.m10 && by.m10.ident.toFixed(1)}% and ${by.m30 && by.m30.ident.toFixed(1)}% identity`);
  T.ok(R.hits.every(h => L.near(h.bits, (R.P.lambda * h.score - Math.log(R.P.K)) / Math.LN2, 1e-9) && L.near(h.E / (300 * 1e11 * Math.pow(2, -h.bits)), 1, 1e-9)), 'lab03 blast: bit score = (λS − ln K)/ln 2 and E = m·n·2^−bits for every hit');
  T.ok(R.hits.every((h, i) => i === 0 || (h.bits <= R.hits[i - 1].bits && h.E >= R.hits[i - 1].E)), 'lab03 blast: hits sorted by bit score, E value rises as the score falls');
  T.ok(!by.rand, 'lab03 blast: an unrelated random sequence is not reported (E > 10 or no word hit)');
  T.ok(R.P.lambda === 0.625 && R.P.K === 0.41 && R.P.match === 2 && R.P.mis === -3 && R.P.open === 5 && R.P.ext === 2, 'lab03 blastn uses NCBI Karlin-Altschul parameters for 2/−3, gaps 5/2 (λ 0.625, K 0.41)');
  // the student's run through the UI
  await D.RUN.lab03(p); const d = await D.dump(p);
  const bt = table(d, 'blast-table');
  T.ok(bt.length >= 3 && bt.every((r, i) => r.rank === i + 1 && r.ident > 0 && r.ident <= 100 && (i === 0 || r.bits <= bt[i - 1].bits)) && bt.every((r, i) => i === 0 || +r.e >= +bt[i - 1].e), `lab03: logged BLAST table ranked by score, identity in 0–100, E rising (${bt.length} hits)`);
  T.ok(L.near(kr(d, 'top-ident-A'), Math.round(bt[0].ident), 1), `lab03: key result top-hit identity ${kr(d, 'top-ident-A')} = table ${bt[0].ident}`);
  T.ok(bt[0].group === 'Birds' || bt[0].group === 'Crocodilians', 'lab03: the dinosaur gene\'s top hit is an archosaur (bird or crocodilian): ' + bt[0].org);
  errs(p, 'lab03'); await ctx.close();
};

LABS.lab04 = async b => {
  const R = 0.0831, TK = 295;
  for (const who of IDS.slice(0, 2)) {
    const ctx = await ctxAs(b, who), p = await T.open(ctx, 'lab04.html');
    await D.RUN.lab04(p);
    const d = await D.dump(p);
    const p1 = table(d, 'p1-table');
    T.ok(p1.length === 3 && p1.every(r => {
      const [Lx, W, H] = r.dims.split('×').map(Number), dcm = r.depth / 10, inner = Math.max(0, Lx - 2 * dcm) * Math.max(0, W - 2 * dcm) * Math.max(0, H - 2 * dcm);
      const sa = 2 * (Lx * W + Lx * H + W * H), v = Lx * W * H;
      return L.near(r._sa, sa, 1e-9) && L.near(r._v, v, 1e-9) && L.near(r._ratio, sa / v, 1e-9) && L.near(r._pct, 100 * (1 - inner / v), 0.05);
    }), `lab04 [${who}]: agar blocks: SA, V, SA:V and % diffused = 1 − (L−2d)(W−2d)(H−2d)/LWH match the reference (${p1.map(r => r._pct.toFixed(1) + '%').join(', ')})`);
    T.ok(p1.every((r, i) => i === 0 || r._ratio < p1[i - 1]._ratio && r._pct <= p1[i - 1]._pct), `lab04 [${who}]: larger blocks → lower SA:V → lower % diffused`);
    const p2 = table(d, 'p2-table');
    T.ok(p2.length >= 4 && p2.every(r => r.m0 > 0 && r.m1 > 0 && L.near(r._pct, 100 * (r.m1 - r.m0) / r.m0, 1e-9)), `lab04 [${who}]: dialysis bags: % change = (final − initial)/initial × 100, masses positive`);
    const bag = k => p2.find(r => r.pair.startsWith(k));
    const suc = bag('Suc in │ H₂O out'), nacl = bag('NaCl in │ H₂O out'), ova = bag('Ova in │ H₂O out');
    T.ok(suc && suc._pct > 5 && nacl && nacl._pct > 2 && (!ova || Math.abs(ova._pct) < 3), `lab04 [${who}]: bags with solute inside gain mass (sucrose ${suc && suc._pct.toFixed(1)}%, NaCl ${nacl && nacl._pct.toFixed(1)}%); 5% ovalbumin (≈1 mM) barely changes (${ova && ova._pct.toFixed(1)}%)`);
    // cores with the true concentrations (Reveal), then ψ = −iCRT
    await D.jc(p, '#p3b-reveal'); await sleep(200);
    await p.evaluate(() => document.querySelector('#p3b-run').click()); await sleep(4000);
    const d2 = await D.dump(p);
    const set = table(d2, 'p3b-table'), last = Math.max(...set.map(r => r.set)), rows = set.filter(r => r.set === last).sort((a, c) => a.conc - c.conc);
    T.ok(rows.length === 6 && rows.every(r => r.m0 > 0 && r.m1 > 0 && L.near(r.pct, 100 * (r.m1 - r.m0) / r.m0, 1e-9)), `lab04 [${who}]: cores: 6 cups, positive masses, % change correct`);
    T.ok(rows[0].pct > 0 && rows[rows.length - 1].pct < 0, `lab04 [${who}]: cores gain mass in 0 M (${rows[0].pct.toFixed(1)}%) and lose it in ${rows[rows.length - 1].conc} M (${rows[rows.length - 1].pct.toFixed(1)}%)`);
    const tis = set.filter(r => r.tissue === rows[rows.length - 1].tissue && r.conc != null && r.pct != null);   // the page fits every set of that tissue, as the student labelled it
    const fit0 = L.linreg(rows.map(r => r.conc), rows.map(r => r.pct)), fit = L.linreg(tis.map(r => r.conc), tis.map(r => r.pct)), xi = -fit.b / fit.m;
    T.ok(fit0.m < 0 && rows.every((r, i) => i === 0 || r.pct < rows[i - 1].pct + 3), `lab04 [${who}]: % change falls as true sucrose rises (slope ${fit0.m.toFixed(1)} %/M; ${rows.map(r => r.pct.toFixed(1)).join(', ')})`);
    const psi = kr(d2, 'psi-tissue'), iso = kr(d2, 'isotonic-point');
    T.ok(L.near(iso, r2(xi), 0.011), `lab04 [${who}]: isotonic point = x-intercept of the fit: page ${iso} M vs ${xi.toFixed(3)} M`);
    T.ok(L.near(psi, Math.round(-1 * xi * R * TK * 10) / 10, 0.11), `lab04 [${who}]: tissue ψ = ψs = −iCRT = −1 × ${xi.toFixed(3)} × 0.0831 × 295 = ${(-xi * R * TK).toFixed(2)} bars (page ${psi})`);
    T.ok(psi < 0 && psi > -25, `lab04 [${who}]: tissue ψ is plausible for potato (−25 to 0 bars): ${psi}`);
    // invalid inputs in the SA:V checker: blank cells, then a negative value
    await D.show(p, 'sa-v');
    await D.jc(p, '#p1-check'); await sleep(200);
    T.ok(/Fill in surface area, volume, SA:V, % diffused before checking/.test(await text(p, '#p1-fb')), 'lab04: SA:V checker asks for blank cells instead of grading them');
    await p.evaluate(() => { const i = document.querySelector('#p1-table input[data-k="sa"]'); i.value = '-6'; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); });
    await p.evaluate(() => { ['v', 'ratio', 'pct'].forEach(k => { const i = document.querySelector('#p1-table input[data-k="' + k + '"]'); i.value = '1'; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); }); });
    await D.jc(p, '#p1-check'); await sleep(200);
    const fb = await text(p, '#p1-fb');
    T.ok(/negative|can.t be|must be|greater than/i.test(fb.split('Row 2')[0]) && !/all correct/.test(fb.split('Row 2')[0]), 'lab04: SA:V checker flags a negative surface area: ' + fb.split('Row 2')[0].slice(0, 90));
    errs(p, 'lab04'); await ctx.close();
  }
};

LABS.lab05 = async b => {
  const f = L.load('lab05.html', ['et50']);
  T.ok(L.near(f.et50([0, 1, 3, 4, 6, 8], 10), 3.5, 1e-12) && f.et50([0, 1, 2], 10) === null && f.et50([5, 6], 10) === 0, 'lab05 et50(): linear interpolation between the minutes around n/2 (3.5 min), null if never reached');
  const ets = [];
  for (const who of IDS) {
    const ctx = await ctxAs(b, who), p = await T.open(ctx, 'lab05.html');
    await D.RUN.lab05(p); const d = await D.dump(p);
    const rows = table(d, 'cup-table'), n = await p.evaluate(() => (Lab.store.get('cup-prep') || {}).na), nb = await p.evaluate(() => (Lab.store.get('cup-prep') || {}).nb);
    T.ok(rows.length === 31 && rows.every((r, i) => r.m === i && r.a >= 0 && r.a <= n && r.b >= 0 && r.b <= nb), `lab05 [${who}]: 31 minutes recorded; floating counts within 0–${n} / 0–${nb}`);
    let ref = null; for (let m = 1; m < rows.length; m++) if (rows[m].a >= n / 2) { ref = m - 1 + (n / 2 - rows[m - 1].a) / (rows[m].a - rows[m - 1].a); break; }
    T.ok(ref != null && L.near(kr(d, 'et50-bicarb'), r2(ref), 1e-9) && L.near(kr(d, 'ret50-bicarb'), Math.round(1000 / ref) / 1000, 1e-9), `lab05 [${who}]: ET50 (interpolated) ${ref && ref.toFixed(3)} min and 1/ET50 ${ref && (1 / ref).toFixed(3)} match key results ${kr(d, 'et50-bicarb')} / ${kr(d, 'ret50-bicarb')}`);
    T.ok(rows[rows.length - 1].a > rows[rows.length - 1].b, `lab05 [${who}]: more disks float with CO₂ than without at 30 min (${rows[30].a} vs ${rows[30].b})`);
    ets.push(ref);
    if (who === IDS[0]) {
      await D.show(p, 'analyze'); await p.evaluate(() => Lab.pages.go(document.querySelector('#et-in'))); await sleep(300);
      const check = async (e, r) => { await val(p, '#et-in', e); await val(p, '#ret-in', r); await p.evaluate(() => document.querySelector('#et-check').click()); await sleep(250); return (await text(p, '#et-fb')) + ' || ' + (await p.evaluate(() => [...document.querySelectorAll('#et-in ~ .feedback, #ret-in ~ .feedback, .feedback.bad')].map(x => x.textContent).join(' ')) ); };
      let c = await check(ref.toFixed(2), (1 / ref).toFixed(3));
      T.ok(/ET50 correct|ET₅₀ correct|ET\s*50 correct/.test(c.replace(/<[^>]+>/g, '')) && /1\/ET.{0,3}50 correct/.test(c), 'lab05: checker accepts the reference ET50 and 1/ET50: ' + c.slice(0, 90));
      for (const [lbl, e, re] of [['blank', '', /Enter your ET50/], ['negative', '-4', /greater than 0/], ['text', 'abc', /must be a number|Enter your ET50/], ['over 45 min', '60', /more than 45/]]) {
        c = await check(e, '0.1');
        T.ok(re.test(c) && !/ET50 correct/.test(c), `lab05: checker rejects a ${lbl} ET50: "${(c.match(re) || [c.slice(0, 60)])[0]}"`);
      }
    }
    errs(p, 'lab05'); await ctx.close();
  }
  T.ok(ets.every(e => e > 5 && e < 25), `lab05: ET50 plausible for spinach at 15 cm, 0.2% bicarbonate (model ≈ 11 min): ${ets.map(e => e.toFixed(1)).join(', ')}`);
};

LABS.lab06 = async b => {
  const UL = Math.PI * 0.04 * 0.04 * 1000;
  T.ok(L.near(UL, 5.0265, 1e-4), 'lab06 reference: capillary volume π(0.040 cm)²·1 cm = 5.03 µL/cm');
  const rates = [];
  for (const who of IDS) {
    const ctx = await ctxAs(b, who), p = await T.open(ctx, 'lab06.html');
    await D.RUN.lab06(p); const d = await D.dump(p);
    const rows = table(d, 'p-table').filter(r => typeof r.e === 'number' && typeof r.c === 'number');
    const fit = L.linreg(rows.map(r => r.t), rows.map(r => (r.e - r.c) * UL));
    const rep = table(d, 'p-reps')[0];
    T.ok(rows.length >= 3 && rep && L.near(rep.rate, fit.m, 1e-9) && L.near(rep.perg, fit.m / 0.30, 1e-9), `lab06 [${who}]: rate = slope of corrected O₂ (seeds − beads) × 5.03 µL/cm vs time = ${fit.m.toFixed(3)} µL/min; per gram ÷ 0.30 g`);
    T.ok(L.near(kr(d, 'rate-microresp'), r2(fit.m), 1e-9), `lab06 [${who}]: key result ${kr(d, 'rate-microresp')} µL/min`);
    T.ok(rows.every((r, i) => i === 0 || r.e >= rows[i - 1].e - 0.1), `lab06 [${who}]: seed plug moves steadily (monotonic within reading error)`);
    rates.push(fit.m);
    const g = table(d, 'g-table')[0];
    T.ok(g && g.slope < 0 && L.near(g.o2, -g.slope / 100 * 242000, 1e-6) && g.o2 > 10 && g.o2 < 150, `lab06 [${who}]: O₂ sensor: falling % O₂; µL/min = −slope/100 × 242 mL gas = ${g && g.o2.toFixed(1)} (25 peas ≈ 45 µL/min)`);
    if (who === IDS[0]) {
      await D.show(p, 'microrespirometer');
      const check = async v => { await val(p, '#p-rate-in', v); await p.evaluate(() => document.querySelector('#p-rate-check').click()); await sleep(250); return (await text(p, '#p-rate-msg')) + ' || ' + await p.evaluate(() => { const e = document.querySelector('#p-rate-in'); const f = e.closest('.inline-num, .field, div').parentElement.querySelector('.feedback.bad'); return (f && f.textContent) || e.getAttribute('aria-invalid') || ''; }); };
      let c = await check(fit.m.toFixed(2));
      T.ok(/^Yes\. The best-fit slope is/.test(c), 'lab06: rate checker accepts the reference slope: ' + c.slice(0, 70));
      c = await check((fit.m * 2).toFixed(2)); T.ok(/^Not quite/.test(c), 'lab06: rate checker rejects twice the slope');
      for (const [lbl, v, re] of [['blank', '', /Type your rate|true/], ['negative', '-1', /can.t be negative|true/], ['text', 'abc', /Type your rate|number|true/]]) {
        c = await check(v);
        T.ok(re.test(c) && !/^Yes/.test(c), `lab06: rate checker rejects a ${lbl} rate (${c.slice(0, 60)})`);
      }
    }
    errs(p, 'lab06'); await ctx.close();
  }
  T.ok(rates.every(r => r > 0.6 && r < 2.2), `lab06: germinating Fast Plant seeds at 20 °C respire a plausible 0.6–2.2 µL O₂/min (0.30 g × ~4 µL·g⁻¹·min⁻¹): ${rates.map(r => r.toFixed(2)).join(', ')}`);
};

LABS.lab07 = async b => {
  const mus = [], mis = [];
  for (const who of IDS) {
    const ctx = await ctxAs(b, who), p = await T.open(ctx, 'lab07.html');
    await D.RUN.lab07(p); const d = await D.dump(p);
    const tips = [...table(d, 'rt-table-c').map(r => Object.assign({ j: 'control' }, r)), ...table(d, 'rt-table-t').map(r => Object.assign({ j: 'lectin' }, r))];
    T.ok(tips.length === 2 && tips.every(r => r.mit === r.P + r.M + r.A + r.T && r.total === r.I + r.mit && L.near(r.mi, 100 * r.mit / r.total, 1e-9)), `lab07 [${who}]: root tips: mitotic = P+M+A+T, total = I + mitotic, MI = mitotic/total × 100`);
    const c = tips.find(r => r.j === 'control'), t = tips.find(r => r.j === 'lectin');
    T.ok(L.near(kr(d, 'mi-control'), Math.round(c.mi * 10) / 10, 1e-9) && L.near(kr(d, 'mi-lectin'), Math.round(t.mi * 10) / 10, 1e-9), `lab07 [${who}]: key results MI control ${kr(d, 'mi-control')}%, lectin ${kr(d, 'mi-lectin')}%`);
    mis.push([c.mi, t.mi]);
    const s = table(d, 's-table'), P = L.sum(s.map(r => r.p)), Rr = L.sum(s.map(r => r.r)), mu = 50 * Rr / (P + Rr);
    T.ok(s.every(r => r.tot === r.p + r.r) && (P + Rr < 20 ? kr(d, 'map-units') === undefined : L.near(kr(d, 'map-units'), Math.round(mu * 10) / 10, 1e-9)), `lab07 [${who}]: Sordaria: map distance = (crossover asci ÷ total) ÷ 2 × 100 = ${mu.toFixed(1)} map units (page ${kr(d, 'map-units')}; ${P + Rr} asci, key result needs ≥ 20)`);
    mus.push(mu);
    // χ² (goodness of fit, control proportions as expected) through the page's calculator
    await D.show(p, 'root-tips');
    await p.evaluate(() => { const m = document.querySelector('[data-m="gof"]'); if (m) m.click(); document.querySelector('#chi-run').click(); }); await sleep(300);
    const A = c.I, B = c.mit, C = t.I, Dd = t.mit, ex = [A / (A + B) * (C + Dd), B / (A + B) * (C + Dd)], ref = L.chi2([C, Dd], ex);
    const out = await text(p, '#chi-out');
    T.ok(out.includes('χ² = ' + ref.toFixed(2)) && /df = 1/.test(out) && /critical value = 3\.84/.test(out) && (/reject the null/i.test(out.replace(/fail to reject the null/i, '')) === (ref >= 3.841)), `lab07 [${who}]: mitotic-index χ² (lectin vs control proportions) = ${ref.toFixed(2)}, df 1, decision correct`);
    T.ok(L.near(kr(await D.dump(p), 'chi2-lectin'), r2(ref), 1e-9), `lab07 [${who}]: χ² key result ${r2(ref)}`);
    errs(p, 'lab07'); await ctx.close();
  }
  T.ok(mis.every(([c, t]) => c > 2 && c < 30 && t > c), `lab07: lectin raises the mitotic index for every identity (control ${mis.map(m => m[0].toFixed(0)).join('/')}% vs lectin ${mis.map(m => m[1].toFixed(0)).join('/')}%)`);
  T.ok(mus.every(m => m > 0 && m < 50), `lab07: map distance is below 50 map units (physically possible) for every identity: ${mus.map(m => m.toFixed(1)).join(', ')}`);
};

LABS.lab08 = async b => {
  const ctx = await ctxAs(b, IDS[0]), p = await T.open(ctx, 'lab08.html');
  const ds = await p.evaluate(() => [dnaSpread({ vol: 10, plateUL: 100 }), dnaSpread({ vol: 20, plateUL: 100 }), dnaSpread({ vol: 10, plateUL: 250 })]);
  T.ok(L.near(ds[0], 0.005 * 10 * 100 / 510, 1e-12) && L.near(ds[1], 0.005 * 20 * 100 / 520, 1e-12) && L.near(ds[2], 0.005 * 10 * 250 / 510, 1e-12), `lab08 dnaSpread(): µg spread = 0.005 µg/µL × V × (plated ÷ (500 + V)) (10 µL, 100 µL plated → ${ds[0].toFixed(5)} µg)`);
  await D.RUN.lab08(p);
  const st = await p.evaluate(() => { const plates = Lab.store.get('plates') || {}; return { vol: (Lab.store.get('S') || {}).vol, keys: Object.keys(localStorage).filter(k => k.startsWith('aplab:lab08:')) }; });
  const amp = await p.evaluate(() => { const ro = document.querySelector('#plate-readouts').textContent; return ro; });
  const count = await p.evaluate(() => plates && plates['p-amp'] ? plates['p-amp'].count : null);   // the page's own plate (top-level script state)
  console.log('    lab08 readouts: ' + amp.replace(/\s+/g, ' ').slice(0, 200));
  T.ok(count != null && count > 0, 'lab08: +pGLO LB/amp plate shows a colony count after incubation: ' + count);
  const vol = 10, plated = 100;
  const mass = 0.005 * vol, frac = plated / (500 + vol), spread = mass * frac, eff = count / spread;
  await D.show(p, 'transform'); await p.evaluate(() => Lab.pages.go(document.querySelector('#c-count'))); await sleep(300);
  const fill = async o => { for (const [k, v] of Object.entries(o)) await val(p, '#' + k, v); await p.evaluate(() => document.querySelector('#calc-check').click()); await sleep(250); return text(p, '#calc-fb'); };
  let fb = await fill({ 'c-count': count, 'c-mass': mass, 'c-frac': frac.toFixed(3), 'c-spread': spread.toFixed(5), 'c-eff': Math.round(eff), 'c-sci': (eff / 10 ** Math.floor(Math.log10(eff))).toFixed(1) + ' × 10^' + Math.floor(Math.log10(eff)) });
  T.ok((fb.match(/✓/g) || []).length === 6 && !/✗/.test(fb), `lab08: calculator accepts the reference efficiency ${Math.round(eff)} transformants/µg (count ${count} ÷ ${spread.toFixed(5)} µg): ${fb.replace(/\s+/g, ' ').slice(0, 120)}`);
  await p.evaluate(() => document.querySelector('#calc-add').click()); await sleep(500);
  const d = await D.dump(p), run = table(d, 'runs-table').slice(-1)[0];
  T.ok(run && run.amp === count && L.near(run.dna, spread, 1e-12) && L.near(run.eff, eff, 1e-6), `lab08: runs table row: ${run && run.amp} colonies, ${run && run.dna.toFixed(5)} µg, efficiency ${run && Math.round(run.eff)}`);
  T.ok(kr(d, 'transformation-efficiency') === Math.round(eff), `lab08: key result efficiency ${kr(d, 'transformation-efficiency')}`);
  T.ok(eff >= 300 && eff <= 2e4, `lab08: efficiency is plausible for pGLO/CaCl₂ (manual range 8×10²–7×10³): ${Math.round(eff)}`);
  for (const [lbl, o, re] of [['blank count', { 'c-count': '' }, /Not graded yet: colony count/], ['negative count', { 'c-count': '-5' }, /colony count/], ['fraction > 1', { 'c-count': count, 'c-frac': '19.6' }, /Not graded yet: b/], ['text in sci notation', { 'c-frac': frac.toFixed(3), 'c-sci': 'lots' }, /Not graded yet: scientific notation/]]) {
    fb = await fill(o);
    T.ok(re.test(fb), `lab08: calculator handles ${lbl}: ${fb.replace(/\s+/g, ' ').slice(0, 90)}`);
  }
  errs(p, 'lab08'); await ctx.close();
};

LABS.lab09 = async b => {
  const ctx = await ctxAs(b, IDS[0]), p = await T.open(ctx, 'lab09.html');
  await D.RUN.lab09(p);
  // measure every lane, then type the λ/HindIII sizes for the marker bands
  const lanes = await p.evaluate(() => [...document.querySelectorAll('#g1-mlane option')].map(o => o.value));
  for (const l of lanes) { await p.selectOption('#g1-mlane', l); await p.click('#g1-mall'); await sleep(100); }
  const HIND = [27491, 23130, 9416, 6557, 4361, 2322, 2027, 564, 125];
  const meas = await p.evaluate(() => Lab._reg.tables.filter(t => !t.el.id && t.opts.columns.some(c => c.key === 'known')).map(t => t.getRows())[0]);
  T.ok(meas && meas.length > 5, 'lab09: measured bands on the practice gel: ' + (meas && meas.length));
  const markerLane = meas.filter(r => /HindIII/.test(r.sample));
  console.log('    lab09 samples: ' + [...new Set(meas.map(r => r.sample))].join(' | ') + '; marker bands at ' + markerLane.map(r => r.dist).join(', '));
  // assign sizes in order of distance; the two largest co-migrate at 0.8% so the first band is the 23,130/27,491 doublet
  // per HindIII lane, nearest band first: 23,130 (co-migrating with 27,491), 9,416, 6,557, 4,361, 2,322, 2,027, 564
  await p.evaluate(([sizes]) => {
    const t = Lab._reg.tables.find(x => !x.el.id && x.opts.columns.some(c => c.key === 'known'));
    const trs = [...t.el.querySelectorAll('tbody tr')], rows = t.getRows();
    const lanes = {}; rows.forEach((r, i) => { if (/HindIII/.test(r.sample)) (lanes[r.lane] = lanes[r.lane] || []).push(i); });
    Object.values(lanes).forEach(ix => { ix.sort((a, b) => rows[a].dist - rows[b].dist).forEach((i, k) => { if (k >= sizes.length) return; const inp = trs[i].querySelector('input[data-k="known"]'); inp.value = sizes[k]; inp.dispatchEvent(new Event('input', { bubbles: true })); inp.dispatchEvent(new Event('change', { bubbles: true })); }); });
  }, [[23130, 9416, 6557, 4361, 2322, 2027, 564]]);
  await sleep(800);
  const after = await p.evaluate(() => ({ rows: Lab._reg.tables.find(x => !x.el.id && x.opts.columns.some(c => c.key === 'known')).getRows(), frags: Lab.store.get('frags-g1'), kr: Lab.keyResults() }));
  const known = after.rows.filter(r => r.known > 0 && r.known <= 20000 && r.dist != null), fit = L.linreg(known.map(r => r.dist), known.map(r => Math.log10(r.known)));
  T.ok(known.length >= 5 && fit.m < 0, `lab09: standard curve log10(bp) vs distance from ${known.length} marker bands: slope ${fit.m.toFixed(4)} /mm (bigger fragments travel less)`);
  const resid = known.map(r => Math.abs(10 ** (fit.b + fit.m * r.dist) / r.known - 1));
  T.ok(Math.max(...resid) < 0.2, `lab09: marker bands lie on the semi-log line (worst ${(100 * Math.max(...resid)).toFixed(1)}% off)`);
  const unk = after.rows.filter(r => !(r.known > 0) && r.dist != null);
  const groups = {}; unk.forEach(r => { const est = 10 ** (fit.b + fit.m * r.dist); (groups[r.sample + '|' + r.band] = groups[r.sample + '|' + r.band] || []).push(est); });
  const fr = after.frags || [];
  T.ok(fr.length > 0 && fr.every(g => { const v = groups[g.sample + '|' + g.band]; return v && L.near(g.mean / L.mean(v), 1, 1e-6); }), `lab09: fragment estimates = 10^(m·d + b) from the student's curve (${fr.map(g => g.sample + ' ' + Math.round(g.mean)).join(', ')})`);
  const k = after.kr.find(x => x.id === 'frag-sizes');
  T.ok(k && fr.length && k.value === fr.filter(g => g.sample === fr[0].sample).map(g => Math.round(g.mean).toLocaleString('en-US')).join(', '), 'lab09: key result lists the estimated sizes: ' + (k && k.value));
  // true sizes: if the practice sample is λ cut by EcoRI or BamHI, the estimates should be within 15% of the published fragments
  const TRUE = { EcoRI: [21226, 7421, 5804, 5643, 4878, 3530, 21226 + 3530], BamHI: [16841, 7233, 6770, 6527, 5626, 5505, 5505 + 6770] };   // + the two end fragments joined by λ's sticky cos ends
  const s0 = fr.length ? fr[0].sample : '', tk = Object.keys(TRUE).find(x => s0.includes(x));
  if (tk) { const ests = fr.filter(g => g.sample === s0).map(g => g.mean); const ok = ests.every(e => TRUE[tk].some(t => Math.abs(e / t - 1) < 0.15)); T.ok(ok, `lab09: estimates for ${s0} are within 15% of the published λ/${tk} sizes: ${ests.map(Math.round).join(', ')}`); }
  errs(p, 'lab09'); await ctx.close();
};

LABS.lab10 = async b => {
  const KP = 4.35, KL = 5.5, KF = 4.76;
  const ctx = await ctxAs(b, IDS[0]), p = await T.open(ctx, 'lab10.html');
  await D.RUN.lab10(p);
  // a second harvest a week later for NPP between harvests
  await D.show(p, 'part-1-npp');
  await p.click('#p1-plus7'); await sleep(700); await p.click('#p1-harvest'); await sleep(500); await p.click('#p1-dry');
  await p.waitForFunction(() => !/Oven|drying/i.test(document.querySelector('#p1-status').textContent), null, { timeout: 30000 }).catch(() => {}); await sleep(1500);
  await p.evaluate(() => { [['#ratio-plant', '0.12'], ['#ratio-larva', '0.16']].forEach(([q, v]) => { const e = document.querySelector(q); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }); });
  await sleep(800);
  const d = await D.dump(p);
  const raw = table(d, 'p1-raw'), sum = table(d, 'p1-sum').sort((a, c) => a.age - c.age);
  T.ok(raw.length >= 10 && raw.every(r => r.dry > 0 && r.dry < r.wet && r.dry / r.wet > 0.08 && r.dry / r.wet < 0.4), `lab10: every plant's dry mass is positive and 8–40% of its wet mass (${raw.length} plants)`);
  T.ok(sum.length >= 2 && sum.every(s => { const rs = raw.filter(r => r.age === s.age); return rs.length === s.n && L.near(s.dry, L.mean(rs.map(r => r.dry)), 1e-9) && L.near(s.wet, L.mean(rs.map(r => r.wet)), 1e-9) && L.near(s.se, L.se(rs.map(r => r.dry)), 1e-9); }), `lab10: harvest summary: mean wet, mean dry and SE(dry) match the plants (${sum.map(s => 'day ' + s.age).join(', ')})`);
  const last = sum[sum.length - 1], first = sum[0];
  T.ok(L.near(kr(d, 'avg-daily-gain'), Math.round(last.dry * KP / last.age * 1000) / 1000, 1e-9), `lab10: average daily gain = dry × 4.35 kcal/g ÷ age = ${(last.dry * KP / last.age).toFixed(4)} (page ${kr(d, 'avg-daily-gain')})`);
  const npp = (last.dry - first.dry) / (last.age - first.age) * KP;
  T.ok(L.near(kr(d, 'npp'), Math.round(npp * 1000) / 1000, 1e-9), `lab10: NPP between harvests = Δdry/Δdays × 4.35 = ${npp.toFixed(4)} kcal/plant/day (page ${kr(d, 'npp')})`);
  T.ok(last.dry > first.dry && npp > 0, 'lab10: plants gain dry mass between harvests');
  const barn = table(d, 'p2-raw')[0];
  if (barn) {
    const evap = (barn.cs - barn.ce) / barn.cs, consumed = Math.max(0, barn.start - barn.end - evap * barn.start);
    const C = consumed * 0.12 * KP / barn.n, P = (barn.l3 - barn.l0) / barn.n * 0.16 * KL, F = barn.frass / barn.n * KF, R = C - P - F;
    const tr = kr(d, 'transfer-eff'), as = kr(d, 'assim-eff'), rr = kr(d, 'respiration');
    const corrected = await p.evaluate(() => document.querySelector('#p2-correct').checked);
    const Craw = (barn.start - barn.end) * 0.12 * KP / barn.n, Cu = corrected ? C : Craw;
    T.ok(L.near(tr, Math.round(1000 * P / Cu) / 10, 1e-9) && L.near(as, Math.round(1000 * (Cu - F) / Cu) / 10, 1e-9) && L.near(rr, Math.round((Cu - P - F) * 1000) / 1000, 1e-9), `lab10: larvae (evaporation-corrected ${corrected}): C ${Cu.toFixed(3)}, P ${P.toFixed(3)}, F ${F.toFixed(3)} kcal; P/C ${tr}%, A/C ${as}%, R = C − P − F ${rr}`);
    T.ok(Cu - P - F > 0 && P / Cu > 0.02 && P / Cu < 0.4, `lab10: energy budget is plausible: respiration > 0 and growth is 2–40% of intake (${(100 * P / Cu).toFixed(1)}%)`);
  } else T.ok(false, 'lab10: barn run produced a row');
  errs(p, 'lab10'); await ctx.close();
};

LABS.lab11 = async b => {
  const ctx = await ctxAs(b, IDS[0]), p = await T.open(ctx, 'lab11.html');
  await D.RUN.lab11(p);
  await D.go(p, '#tr-run'); await p.selectOption('#tr-cond', 'fan'); await p.click('#tr-run'); await D.tlReady(p, '#tr-timelapse', 20000).catch(() => {}); await sleep(1500);
  const d = await D.dump(p);
  const tr = table(d, 'tr-table');
  T.ok(tr.length >= 6 && tr.every(r => r.rate > 0 && r.area > 0 && L.near(r.rpa, r.rate / r.area * 1e4, 1e-9)), `lab11: rate per area = rate ÷ leaf area (× 10⁴ for the ×10⁻⁴ unit) in all ${tr.length} rows`);
  const ctl = tr.filter(r => r.cond === 'control'), fan = tr.filter(r => r.cond === 'fan');
  T.ok(L.near(kr(d, 'tr-rate-control'), r2(L.mean(ctl.map(r => r.rpa))), 1e-9), `lab11: key result = mean control rate per area ${r2(L.mean(ctl.map(r => r.rpa)))}`);
  T.ok(fan.length && L.mean(fan.map(r => r.rpa)) > L.mean(ctl.map(r => r.rpa)), `lab11: a fan raises transpiration (${L.mean(fan.map(r => r.rpa)).toFixed(2)} vs control ${L.mean(ctl.map(r => r.rpa)).toFixed(2)})`);
  T.ok(ctl.every(r => r.rpa > 0.2 && r.rpa < 10), 'lab11: control rates are plausible (0.2–10 × 10⁻⁴ mL·min⁻¹·cm⁻²)');
  const st = table(d, 'st-table');
  T.ok(st.length >= 2 && st.every(r => r.actual >= 0 && (r.surf !== 'lower' || r.actual > 0)), 'lab11: stomata counts are non-negative and the lower surface has stomata');
  errs(p, 'lab11'); await ctx.close();
};

LABS.lab12 = async b => {
  const ctx = await ctxAs(b, IDS[0]), p = await T.open(ctx, 'lab12.html');
  await D.RUN.lab12(p); const d = await D.dump(p);
  const v = table(d, 'vial-table')[0];
  T.ok(v && [v.t0, v.t15, v.t30].every(x => x >= 0 && x <= v.n) && v.t15 >= v.t0, `lab12: vial counts within 0–${v && v.n} and flies climb (0 s ${v && v.t0}, 15 s ${v && v.t15}, 30 s ${v && v.t30})`);
  T.ok(L.near(kr(d, 'vial-top'), Math.round(1000 * v.t30 / v.n) / 10, 1e-9), `lab12: key result % in top half ${kr(d, 'vial-top')}`);
  const tri = table(d, 'trials-table'), t1 = tri[tri.length - 1], ref = L.chi2([t1.A, t1.B], [(t1.A + t1.B) / 2, (t1.A + t1.B) / 2]);
  T.ok(L.near(t1.chi2, ref, 1e-9) && (t1.sig === 'Yes') === (ref > 3.841), `lab12: trial χ² = Σ(o−e)²/e with e = n/2 = ${ref.toFixed(3)}, "p < 0.05" ⇔ χ² > 3.84 (${t1.sig})`);
  T.ok(L.near(kr(d, 'chi2'), r2(ref), 1e-9) && L.near(kr(d, 'pct-a'), Math.round(1000 * t1.A / (t1.A + t1.B)) / 10, 1e-9), 'lab12: key results χ² and % at A match');
  const it = table(d, 'int-table');
  T.ok(it.length && it.every(r => r.aa >= 0 && r.ab >= 0 && r.aa + r.ab <= t1.A + t1.B), 'lab12: interval counts never exceed the flies in the chamber');
  // calculator through the UI
  await D.show(p, 'analyze');
  const calc = async (a, bb) => { await val(p, '#x-a', a); await val(p, '#x-b', bb); await p.evaluate(() => document.querySelector('#x-run').click()); await sleep(250); return { out: await text(p, '#x-out'), msg: await p.evaluate(() => [...document.querySelectorAll('#x-a ~ .feedback, #x-b ~ .feedback, .feedback.bad')].map(e => e.textContent).join(' ')), kr: await p.evaluate(() => (Lab.store.get('keyres:chi-calc') || {}).value) }; };
  let c = await calc(22, 8); const rc = L.chi2([22, 8], [15, 15]);
  T.ok(c.out.includes(rc.toFixed(2)) && L.near(c.kr, Math.round(rc * 1000) / 1000, 1e-9), `lab12 calculator: 22 vs 8 → χ² ${rc.toFixed(3)} (page ${c.kr}); ${c.out.replace(/\s+/g, ' ').slice(0, 100)}`);
  T.ok(/significant|reject/i.test(c.out) && rc > 3.84, 'lab12 calculator: 22 vs 8 is significant at df 1');
  c = await calc(15, 14); const r29 = L.chi2([15, 14], [14.5, 14.5]);
  T.ok(c.out.includes(r29.toFixed(2)) || c.kr === Math.round(r29 * 1000) / 1000, `lab12 calculator: 15 vs 14 uses e = 29/2 (χ² ${r29.toFixed(3)}): ${c.out.replace(/\s+/g, ' ').slice(0, 90)}`);
  for (const [lbl, a, re] of [['blank', '', /Enter the number of flies/], ['negative', '-2', /cannot be negative/], ['decimal', '3.5', /whole number/], ['text', 'many', /must be a number|Enter the number/]]) {
    c = await calc(a, '10');
    T.ok(re.test(c.msg) && c.kr == null, `lab12 calculator rejects a ${lbl} count and withdraws the key result: "${(c.msg.match(re) || [c.msg.slice(0, 50)])[0]}"`);
  }
  errs(p, 'lab12'); await ctx.close();
};

LABS.lab13 = async b => {
  const opts = [];
  for (const who of IDS.slice(0, 2)) {
    const ctx = await ctxAs(b, who), p = await T.open(ctx, 'lab13.html');
    await D.RUN.lab13(p); const d = await D.dump(p);
    const p1 = table(d, 'p1-table'), tr = Math.max(...p1.map(r => r.trial)), rows = p1.filter(r => r.trial === tr).sort((a, c) => a.t - c.t);
    const early = rows.filter(r => r.t <= 2), fit = L.linreg(early.map(r => r.t), early.map(r => r.aE));
    T.ok(early.length >= 2 && L.near(kr(d, 'initial-rate'), Math.round(fit.m * 1e4) / 1e4, 1e-9), `lab13 [${who}]: initial rate = slope of A470 vs time over 0–2 min = ${fit.m.toFixed(4)} A/min (page ${kr(d, 'initial-rate')})`);
    T.ok(rows.every((r, i) => i === 0 || r.aE >= rows[i - 1].aE - 0.015) && rows.every(r => r.aE >= -0.02 && r.aE < 1.5 && Math.abs(r.aC) < 0.06), `lab13 [${who}]: enzyme absorbance rises (monotonic within ±0.015) and stays below 1.5; the no-enzyme control stays near 0`);
    const late = rows.filter(r => r.t >= rows[rows.length - 1].t - 2);
    if (late.length >= 2 && rows[rows.length - 1].t >= 4) { const lf = L.linreg(late.map(r => r.t), late.map(r => r.aE)); T.ok(lf.m <= fit.m * 1.1, `lab13 [${who}]: rate slows as product accumulates (late slope ${lf.m.toFixed(4)} ≤ initial ${fit.m.toFixed(4)})`); }
    const p2 = table(d, 'p2-table');
    T.ok(p2.every(r => L.near(r.dA, r.a1 - r.a0, 1e-9)), `lab13 [${who}]: pH series ΔA = read − start in all ${p2.length} rows`);
    const by = {}; p2.forEach(r => (by[r.pH] = by[r.pH] || []).push(r.dA));
    const best = Object.entries(by).map(([k, v]) => [+k, L.mean(v)]).sort((a, c) => c[1] - a[1])[0];
    T.ok(kr(d, 'optimum-ph') === best[0], `lab13 [${who}]: optimum pH = buffer with the highest mean ΔA = ${best[0]} (page ${kr(d, 'optimum-ph')})`);
    opts.push(best[0]);
    if (who === IDS[0]) {
      // substrate series in the design: Michaelis–Menten saturation
      await D.go(p, '#p-d-h'); await p.fill('#p-d-h', 'More substrate will raise the rate until the enzyme is saturated.'); await sleep(1300);
      await p.selectOption('#d-iv', 'sub'); await sleep(200);
      await val(p, '#d-levels', '0.05, 0.1, 0.3, 0.6, 1.2');
      await D.go(p, '#d-run'); await p.click('#d-run');
      await p.waitForFunction(() => Lab._reg.tables.find(t => t.el.id === 'd-table').getRows().length > 0, null, { timeout: 30000 }).catch(() => {}); await sleep(1500);
      const dd = await D.dump(p), raw = table(dd, 'd-table');
      const lv = [...new Set(raw.map(r => r.level))].sort((a, c) => a - c), m = lv.map(x => L.mean(raw.filter(r => r.level === x).map(r => r.rate)));
      console.log('    lab13 substrate series: ' + lv.map((x, i) => x + ' mL → ' + m[i].toFixed(4)).join(', '));
      T.ok(lv.length === 5 && m.every((x, i) => i === 0 || x >= m[i - 1] * 0.9), 'lab13: initial rate rises with substrate (within replicate noise)');
      T.ok(lv.length === 5 && (m[4] - m[3]) / (1.2 - 0.6) < (m[1] - m[0]) / (0.1 - 0.05), 'lab13: rate saturates at high substrate (Michaelis–Menten): slope 0.6→1.2 mL < slope 0.05→0.1 mL');
      const sumT = table(dd, 'd-sum');
      T.ok(sumT.length === 5 && sumT.every(s => { const v = raw.filter(r => r.level === s.level).map(r => r.rate); return L.near(s.mean, L.mean(v), 1e-9) && (v.length < 2 || L.near(s.se, L.se(v), 1e-9)); }), 'lab13: design summary mean and SE match the replicates');
    }
    errs(p, 'lab13'); await ctx.close();
  }
  T.ok(opts.every(o => o >= 4 && o <= 7), `lab13: turnip peroxidase optimum pH is plausible (4–7): ${opts.join(', ')}`);
};

(async () => {
  const b = await T.launch();
  if (want('stats')) await statsReference(b);
  for (const n of Object.keys(LABS)) {
    if (!want(n)) continue;
    console.log('\n== ' + n);
    try { await LABS[n](b); } catch (e) { T.ok(false, n + ': test crashed: ' + e.message.split('\n')[0]); }
  }
  await b.close();
  T.done('t59-science');
})();
