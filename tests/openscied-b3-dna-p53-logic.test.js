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
