/* Reference checks for the DNA/p53 companion logic against hand-computed values from the official answer key. */
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../openscied-b3-dna-p53-logic.js');

test('standard code has 64 codons and known anchors', () => {
  assert.equal(Object.keys(L.STANDARD_CODE).length, 64);
  assert.equal(L.STANDARD_CODE.AUG, 'Met'); assert.equal(L.STANDARD_CODE.UUC, 'Phe'); assert.equal(L.STANDARD_CODE.CUU, 'Leu');
  assert.equal(L.STANDARD_CODE.UAA, 'Stop'); assert.equal(L.STANDARD_CODE.GGU, 'Gly'); assert.equal(L.STANDARD_CODE.GAC, 'Asp');
});
test('strand lengths match the lesson (36 to 39 bases)', () => {
  assert.deepEqual(Object.values(L.STRANDS).map(s => s.length), [39, 36, 39]);
});
test('copy (mRNA) and edited copy match the answer key', () => {
  const key = {
    A: ['UUC-GGU-UCU-AGU-GCG-GUG-AGG-GGU-AUU-ACC-AGG-GAA-GAC', 'UUC-AGU-AGG-GGU-AUU-ACC-AGG-GAA-GAC'],
    B: ['UUC-GGU-UCU-AGU-GCG-GUG-AGG-GGU-AUU-CUU-AGG-GCU', 'UUC-AGU-AGG-GGU-AUU-CUU-AGG-GCU'],
    C: ['UUC-GGU-UCU-AGU-GCG-GUG-AGG-GGU-AUU-ACC-AGG-AAA-GAC', 'UUC-AGU-AGG-GGU-AUU-ACC-AGG-AAA-GAC']
  };
  for (const s of 'ABC') {
    const r = L.express(L.STRANDS[s]);
    assert.equal(r.copy.join('-'), key[s][0], 'copy ' + s);
    assert.equal(r.edited.join('-'), key[s][1], 'edited ' + s);
    assert.equal(r.edited.length, s === 'B' ? 8 : 9);
  }
});
test('cards give the key amino acids and sentences', () => {
  assert.equal(L.express(L.STRANDS.A).aminoCards.join('-'), 'Phe-Ser-Arg-Gly-Ile-Thr-Arg-Glu-Asp');
  assert.equal(L.express(L.STRANDS.B).aminoCards.join('-'), 'Phe-Ser-Arg-Gly-Ile-Pro-Arg-Ala');
  assert.equal(L.express(L.STRANDS.C).aminoCards.join('-'), 'Phe-Ser-Arg-Gly-Ile-Thr-Arg-Lys-Asp');
  for (const s of 'ABC') assert.equal(L.express(L.STRANDS[s]).sentence, L.KEY_SENTENCE[s]);
  assert.equal(L.anticodon('UUC'), 'AAG');
});
test('the real code differs from the official cards only for CUU (Leu, card says Pro)', () => {
  assert.deepEqual(L.cardDisagreements(L.express(L.STRANDS.A)), []);
  assert.deepEqual(L.cardDisagreements(L.express(L.STRANDS.C)), []);
  assert.deepEqual(L.cardDisagreements(L.express(L.STRANDS.B)), [{ position: 6, codon: 'CUU', card: 'Pro', real: 'Leu' }]);
});
test('strand C differs from strand A at one amino acid only (Glu to Lys, position 8)', () => {
  const a = L.express(L.STRANDS.A), c = L.express(L.STRANDS.C);
  const diff = a.aminoCards.map((x, i) => x === c.aminoCards[i] ? null : i + 1).filter(Boolean);
  assert.deepEqual(diff, [8]);
});
test('invalid input is guarded', () => {
  assert.equal(L.transcribe('AUG'), null); assert.equal(L.transcribe(''), null); assert.equal(L.express('xyz'), null);
  assert.equal(L.cardFor('XXX'), null); assert.equal(L.checkSentence('Z', 'x'), 'empty');
  assert.equal(L.express('AAGCC').sentence, 'I.'); // a short fragment still works; only whole groups are used
  assert.equal(L.express('AAG').edited.length, 1);
});
test('sentence check', () => {
  assert.equal(L.checkSentence('A', '  i am a P53 protein with a butterfly shape '), 'match');
  assert.equal(L.checkSentence('A', 'I am a p53 protein missing a piece.'), 'differs');
  assert.equal(L.checkSentence('B', ''), 'empty');
});
test('substitution rate is 100 * subs / (correct + subs), never NaN', () => {
  assert.equal(L.substitutionRate(22, 2), 8.3);
  assert.equal(L.substitutionRate(24, 0), 0);
  assert.equal(L.substitutionRate(0, 0), null);
  assert.equal(L.substitutionRate(-5, 'x'), null);
  assert.equal(L.substitutionRate(3.9, 1.2), 25);
});
test('fork summary normalizes and rejects empty data', () => {
  assert.equal(L.forkSummary(null), null); assert.equal(L.forkSummary({}), null);
  const s = L.forkSummary({ before: { top: { correct: 11, substitutions: 1 }, bottom: { correct: -3, substitutions: NaN } }, p53: { a: { tried: 2, removed: 2 } } });
  assert.equal(s.before.top.rate, 8.3); assert.equal(s.before.bottom.rate, null); assert.equal(s.hasBefore, true);
  assert.equal(s.hasAfter, false); assert.equal(s.p53.a.removed, 2); assert.equal(s.p53.b.tried, 0);
});
test('explanation levels follow the key', () => {
  assert.equal(L.explanationLevel([]), 'none');
  assert.equal(L.explanationLevel([true, false, false, false, false, false]), 'foundational');
  assert.equal(L.explanationLevel([false, true, true, false, true, false]), 'linked');
  assert.equal(L.explanationLevel([true, true, true, true, true, true]), 'organized');
  assert.equal(L.explanationLevel([true, true, true, true, true, false]), 'linked');
});

// ---- DNA fork model ----
const mkRand = seed => { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
test('fork plan: 24 letters, bottom strand pairs with top, first 5 sites never wrong, 1 to 6 substitutions per strand, for 500 seeds', () => {
  for (let seed = 1; seed <= 500; seed++) {
    const plan = L.forkPlan(mkRand(seed));
    assert.equal(plan.top.length, 24); assert.equal(plan.bottom.length, 24);
    plan.top.forEach((b, i) => { assert.ok('ACGT'.includes(b)); assert.equal(plan.bottom[i], { A: 'T', T: 'A', G: 'C', C: 'G' }[b]); });
    ['top', 'bottom'].forEach(k => {
      const subs = plan.subs[k], n = subs.filter(Boolean).length, need = L.forkNeeded(plan, k);
      assert.ok(n >= 1 && n <= 6, 'seed ' + seed + ' ' + k + ' has ' + n);
      subs.forEach((w, i) => { if (w) { assert.ok(i >= 5, 'manual sites are never wrong'); assert.notEqual(w, need[i]); assert.ok('ACGT'.includes(w)); } });
    });
  }
});
test('fork plan is reproducible for one seed and differs between seeds', () => {
  assert.deepEqual(L.forkPlan(mkRand(42)), L.forkPlan(mkRand(42)));
  const sigs = new Set(); for (let s = 1; s <= 40; s++) sigs.add(JSON.stringify(L.forkPlan(mkRand(s))));
  assert.ok(sigs.size >= 39);
  let total = 0; for (let s = 1; s <= 300; s++) { const p = L.forkPlan(mkRand(s)); total += p.subs.top.filter(Boolean).length + p.subs.bottom.filter(Boolean).length; }
  const mean = total / 600; assert.ok(mean > 1.2 && mean < 3.5, 'mean substitutions per strand ' + mean);
});
test('p53: only version a fits and removes the leftmost substitution; b and c change nothing', () => {
  const sites = 'ggggggbgggbggggggggggggg';
  const a = L.p53Apply(sites, 'a'); assert.equal(a.sites, 'ggggggxgggbggggggggggggg'); assert.equal(a.index, 6); assert.ok(a.fits && a.removed);
  ['b', 'c'].forEach(v => { const r = L.p53Apply(sites, v); assert.equal(r.sites, sites); assert.equal(r.index, 6); assert.equal(r.fits, false); assert.equal(r.removed, false); });
  const none = L.p53Apply('g'.repeat(24), 'a'); assert.equal(none.index, -1); assert.equal(none.removed, false);
});
test('replacing a gap needs the correct letter; counts follow the site string', () => {
  const plan = L.forkPlan(mkRand(7));
  const i = plan.subs.top.findIndex(Boolean);
  const sites = 'g'.repeat(i) + 'x' + 'g'.repeat(23 - i);
  const need = L.forkNeeded(plan, 'top')[i], wrong = 'ACGT'.split('').find(l => l !== need);
  assert.equal(L.replaceGap(sites, plan, 'top', wrong).fits, false);
  const ok = L.replaceGap(sites, plan, 'top', need); assert.ok(ok.fits); assert.equal(ok.sites, 'g'.repeat(24));
  assert.deepEqual(L.siteCounts('ggbxe'), { correct: 2, substitutions: 1 });
  assert.equal(L.substitutionRate(L.siteCounts('g'.repeat(22) + 'bb').correct, 2), 8.3);
});
test('site strings from damaged saves are rejected', () => {
  const plan = L.forkPlan(mkRand(9));
  assert.equal(L.sitesValid('g'.repeat(24), plan, 'top'), true);
  assert.equal(L.sitesValid('g'.repeat(23), plan, 'top'), false);
  assert.equal(L.sitesValid('z'.repeat(24), plan, 'top'), false);
  assert.equal(L.sitesValid(null, plan, 'top'), false);
  const noSub = plan.subs.top.findIndex(w => !w);
  assert.equal(L.sitesValid('g'.repeat(noSub) + 'b' + 'g'.repeat(23 - noSub), plan, 'top'), false);
});

/* ---- helpers used by the gene expression scene ---- */
test('pairCheck follows the pairing rules and explains mistakes', () => {
  assert.deepEqual([['A', 'U'], ['T', 'A'], ['G', 'C'], ['C', 'G']].map(([d, c]) => L.pairCheck(d, c).ok), [true, true, true, true]);
  const bad = L.pairCheck('A', 'T');
  assert.equal(bad.ok, false); assert.equal(bad.expected, 'U'); assert.match(bad.message, /A in the DNA pairs with U/);
  assert.equal(L.pairCheck('T', 'U').expected, 'A');
  assert.equal(L.pairCheck('A', 'Z').ok, false); assert.equal(L.pairCheck('', 'A').ok, false); assert.equal(L.pairCheck('A', '').ok, false);
});
test('crossCheck: only groups 2, 3, 5 and 6 complete the edit', () => {
  assert.equal(L.crossCheck([2, 3, 5, 6], 13).complete, true);
  assert.equal(L.crossCheck([2, 3, 5, 6], 12).complete, true);
  assert.deepEqual(L.crossCheck([2, 3, 4], 13), { wrong: [4], missing: [5, 6], complete: false });
  assert.equal(L.crossCheck([], 13).complete, false); assert.equal(L.crossCheck(null, 0).complete, false);
});
test('expressCopy reads a copy with a copying error and matches express for a clean copy', () => {
  for (const s of 'ABC') assert.deepEqual(L.expressCopy(L.transcribe(L.STRANDS[s])), L.express(L.STRANDS[s]));
  const rna = L.transcribe(L.STRANDS.A), pos = 24; // first base of group 9: A -> C makes CUU, the "missing" card
  const r = L.expressCopy(rna.slice(0, pos) + 'C' + rna.slice(pos + 1));
  assert.equal(r.sentence, 'I am a p53 missing with a butterfly shape.');
  assert.equal(L.expressCopy('AAT'), null);
});
test('injected errors are real substitutions that change the sentence, same for the same number', () => {
  for (const s of 'ABC') {
    const list = L.injectCandidates(L.STRANDS[s]), rna = L.transcribe(L.STRANDS[s]), key = L.express(L.STRANDS[s]).sentence;
    assert.ok(list.length >= 10, 'candidates ' + s);
    for (const e of list) {
      assert.ok(![2, 3, 5, 6].includes(e.group)); assert.notEqual(e.from, e.to); assert.equal(rna[e.position], e.from);
      const r = L.expressCopy(rna.slice(0, e.position) + e.to + rna.slice(e.position + 1));
      assert.notEqual(r.sentence, ''); assert.notEqual(r.sentence, key, 'sentence changes ' + s + e.position + e.to);
      assert.equal(r.edited.length, L.express(L.STRANDS[s]).edited.length);
    }
    assert.deepEqual(L.pickInjectedError(L.STRANDS[s], 0.37), L.pickInjectedError(L.STRANDS[s], 0.37));
    assert.deepEqual(L.pickInjectedError(L.STRANDS[s], NaN), list[0]); assert.deepEqual(L.pickInjectedError(L.STRANDS[s], 5), list[list.length - 1]);
  }
  assert.equal(L.pickInjectedError('XYZ', 0.5), null);
});
test('buildRun follows the saved-run contract', () => {
  const run = L.buildRun('B', L.STRANDS.B, L.transcribe(L.STRANDS.B), false, 123);
  assert.deepEqual(Object.keys(run).sort(), ['aminoAcids', 'at', 'copy', 'dna', 'edited', 'injectedError', 'matchesKey', 'sentence', 'strand']);
  assert.equal(run.copy, 'UUC-GGU-UCU-AGU-GCG-GUG-AGG-GGU-AUU-CUU-AGG-GCU'); assert.equal(run.edited, 'UUC-AGU-AGG-GGU-AUU-CUU-AGG-GCU');
  assert.equal(run.sentence, 'I am a p53 protein missing a piece.'); assert.equal(run.matchesKey, true); assert.equal(run.at, 123);
  const e = L.injectCandidates(L.STRANDS.A)[0], rna = L.transcribe(L.STRANDS.A);
  const mut = L.buildRun('A', L.STRANDS.A, rna.slice(0, e.position) + e.to + rna.slice(e.position + 1), true);
  assert.equal(mut.matchesKey, false); assert.equal(mut.injectedError, true);
  assert.equal(L.buildRun('A', 'AAG', 'XYZ'), null);
});
