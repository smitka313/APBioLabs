/* Reference checks for the Lessons 8-9 companion logic against hand-computed values from the OpenSciEd answer keys. */
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../openscied-b3-inheritance-logic.js');

test('exit ticket answers match the key (Q1 Population B, Q2 ab, Q4 Environment) and every wrong choice has a reason', () => {
  assert.equal(L.checkExit('q1', 'b').status, 'correct');
  assert.equal(L.checkExit('q2', 'ab').status, 'correct');
  assert.equal(L.checkExit('q4', 'environment').status, 'correct');
  for (const [name, item] of Object.entries(L.EXIT_ITEMS)) for (const [v, why] of Object.entries(item.why)) {
    if (v !== item.correct) { const r = L.checkExit(name, v); assert.equal(r.status, 'wrong'); assert.match(r.message, /^Try again\. Why not:/); }
    assert.ok(why.length > 20);
  }
  assert.equal(L.checkExit('q1', '').status, 'empty');
  assert.equal(L.checkExit('q9', 'a').status, 'unknown');
});
test('tap-to-order accepts only the meiosis order', () => {
  assert.equal(L.checkOrder(['copy', 'cross', 'divide', 'join']).status, 'correct');
  assert.equal(L.checkOrder(['copy', 'cross']).status, 'partial');
  assert.equal(L.checkOrder(['join', 'copy', 'cross', 'divide']).status, 'wrong');
  assert.equal(L.checkOrder([]).status, 'empty');
});
test('question tool builds the two frames and checks the criteria', () => {
  assert.equal(L.buildQuestion(0, 'the SPF number', 'the number of yeast colonies'), 'How does the SPF number affect the number of yeast colonies?');
  assert.equal(L.buildQuestion(1, 'x', 'y'), 'What is the effect of x on y?');
  const iv = 'the time under UV light', dv = 'the number of yeast colonies';
  const good = L.checkQuestion(L.buildQuestion(0, iv, dv), iv, dv);
  assert.equal(good.ok, true); assert.equal(good.criteria[2].met, null);
  assert.equal(L.checkQuestion('How does UV matter?', iv, dv).criteria[0].met, false);
  assert.equal(L.checkQuestion('', '', '').ok, false);
  assert.equal(L.checkQuestion('How does SPF affect SPF?', 'SPF', 'SPF').criteria[0].met, false);
  const vague = L.checkQuestion(L.buildQuestion(0, iv, 'how healthy the yeast seems'), iv, 'how healthy the yeast seems');
  assert.equal(vague.criteria[0].met, true); assert.equal(vague.criteria[1].met, false);
});
test('claim self-check levels', () => {
  assert.equal(L.claimLevel([]), 'none');
  assert.equal(L.claimLevel([true, false, false, false, false]), 'foundational');
  assert.equal(L.claimLevel([true, true, false, true, false]), 'linked');
  assert.equal(L.claimLevel([true, true, true, true, true]), 'organized');
});
test('Lakita pedigree: possible genotypes agree with the teacher edition', () => {
  const r = L.solvePedigree(L.LAKITA);
  assert.equal(r.ok, true);
  const p = r.possible;
  assert.deepEqual(p.grandfather, ['AA']); assert.deepEqual(p.mother, ['AA']);
  assert.deepEqual(p.lakita, ['AB']); assert.deepEqual(p.father, ['AB']);
  assert.deepEqual(p.aunt2, ['AB']); assert.deepEqual(p.uncle, ['AB']);
  assert.deepEqual(p.aunt1, ['AA', 'AB']); assert.deepEqual(p.aunt3, ['AA', 'AB']);
  assert.deepEqual(p.grandmother, ['AB', 'BB']);
});
test('guess checking: correct, incomplete, wrong, empty, and reasons', () => {
  assert.equal(L.checkGuess(L.LAKITA, 'aunt1', ['AA', 'AB']).status, 'correct');
  assert.equal(L.checkGuess(L.LAKITA, 'aunt1', ['ba', 'AA']).status, 'correct');
  assert.equal(L.checkGuess(L.LAKITA, 'aunt1', ['AA']).status, 'incomplete');
  const w = L.checkGuess(L.LAKITA, 'lakita', ['AA', 'AB']); assert.equal(w.status, 'wrong'); assert.deepEqual(w.impossible, ['AA']);
  assert.equal(L.checkGuess(L.LAKITA, 'father', []).status, 'empty');
  assert.match(L.explainImpossible(L.LAKITA, 'lakita', 'AA'), /at least one/);
  assert.match(L.explainImpossible(L.LAKITA, 'mother', 'AB'), /only versions that fix/);
});
test('impossible pedigrees are reported, not crashed', () => {
  const bad = { persons: [{ id: 'a', affected: false, knownGenotype: 'AA' }, { id: 'b', affected: false, knownGenotype: 'AA' }, { id: 'c', affected: true, parents: ['a', 'b'] }] };
  assert.equal(L.solvePedigree(bad).ok, false);
  assert.equal(L.solvePedigree({ persons: [] }).ok, true);
});
test('two-gene pedigree: genotypes, risk table, and which children need crossing over', () => {
  const P = Object.fromEntries(L.TWO_GENE.persons.map(x => [x.id, x]));
  assert.deepEqual(L.twoGeneGenotypes(P.father), { p53: 'AB', brca1: 'CD' });
  assert.deepEqual(L.twoGeneGenotypes(P.child2), { p53: 'AB', brca1: 'CC' });
  assert.deepEqual(L.twoGeneGenotypes(P.child3), { p53: 'AA', brca1: 'CD' });
  const lv = id => { const g = L.twoGeneGenotypes(P[id]); return L.twoGeneRisk(g.p53, g.brca1).level; };
  assert.equal(lv('father'), 'high'); assert.equal(lv('mother'), 'low'); assert.equal(lv('child1'), 'low');
  assert.equal(lv('child2'), 'medium'); assert.equal(lv('child3'), 'medium');
  assert.equal(L.twoGeneRisk('BB', 'CC').level, 'likely-high'); assert.equal(L.twoGeneRisk('AA', 'DD').level, 'likely-high');
  assert.equal(L.explainedWithoutCrossing(P.father, P.mother, P.child1), true);
  assert.equal(L.explainedWithoutCrossing(P.father, P.mother, P.child2), false);
  assert.equal(L.explainedWithoutCrossing(P.father, P.mother, P.child3), false);
});
test('gametes: two types without crossing over, four with it (Exit Q1)', () => {
  assert.deepEqual(L.gameteTypes(['AC', 'BD'], false), ['AC', 'BD']);
  assert.deepEqual(L.gameteTypes(['AC', 'BD'], true), ['AC', 'AD', 'BC', 'BD']);
  assert.deepEqual(L.gameteTypes(['AC', 'AC'], true), ['AC']);
});
test('recombinant percent rises with distance, stays between 0 and 50, and shares sum to 100', () => {
  assert.equal(L.recombinantPercent(0), 0);
  let prev = -1;
  for (const d of [0, 1, 5, 20, 50, 100, 500, 1e6]) { const r = L.recombinantPercent(d); assert.ok(r >= prev && r <= 50 && Number.isFinite(r)); prev = r; }
  assert.equal(L.recombinantPercent(-5), 0); assert.equal(L.recombinantPercent('x'), 0);
  const s = L.gameteShares(['AC', 'BD'], 30), sum = Object.values(s).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(sum - 100) < 1e-9); assert.ok(s.AC > s.AD);
});
test('C to T example uses the standard code', () => {
  assert.equal(L.aminoFor('CCA'), 'Pro'); assert.equal(L.aminoFor('TTA'), 'Leu'); assert.equal(L.aminoFor('TGA'), 'Stop'); assert.equal(L.aminoFor('ATG'), 'Met'); assert.equal(L.aminoFor('AUG'), null);
  const a = L.cToT('CCA', 1); assert.deepEqual([a.after, a.aminoBefore, a.aminoAfter, a.same], ['CTA', 'Pro', 'Leu', false]);
  const s = L.cToT('CTC', 2); assert.equal(s.same, true);
  const st = L.cToT('CGA', 0); assert.equal(st.aminoAfter, 'Stop'); assert.equal(st.stop, true);
  assert.equal(L.cToT('CCA', 2), null); assert.equal(L.cToT('xx', 0), null);
});
test('skin cancer readings: 11 sites per group, no impossible values, trends as described by the lesson', () => {
  for (const g of ['white', 'black', 'hispanic']) {
    const d = L.SKIN_READINGS[g]; assert.equal(d.length, 11);
    d.forEach(p => { assert.ok(Number.isFinite(p.uv) && p.uv > 0 && Number.isFinite(p.rate) && p.rate >= 0, g + ' ' + p.site); });
  }
  assert.ok(L.skinCorrelation('white') > 0.5, 'White: rates tend to rise with UV');
  assert.ok(L.skinCorrelation('hispanic') < L.skinCorrelation('white'));
  assert.equal(L.pearson([1, 1, 1], [1, 2, 3]), null); assert.equal(L.pearson([1], [1]), null);
  assert.equal(L.SKIN_META.approximate, true);
});

test('evidenceChecks compares the claim evidence with the student\'s own yeast table', () => {
  const mk = (o) => Object.assign({ strain: 'sensitive', minutes: 15 }, o);
  const good = [mk({ dark: true, dose: 0, colonies: 201 }), mk({ dose: 15, colonies: 1 }), mk({ spf: 15, dose: 1, colonies: 140 }), mk({ spf: 30, dose: 0.5, colonies: 172 }), mk({ spf: 50, dose: 0.3, colonies: 190 })];
  assert.deepEqual(L.evidenceChecks(good), { more: true, dark: true, spf: true });
  // SPF 20 below SPF 15 and a dark dish well below the top: those statements fail
  const noisy = [mk({ dark: true, dose: 0, colonies: 150 }), mk({ spf: 15, dose: 1, colonies: 190 }), mk({ spf: 20, dose: 0.75, colonies: 150 }), mk({ spf: 30, dose: 0.5, colonies: 160 }), mk({ spf: 50, dose: 0.3, colonies: 140 })];
  const r = L.evidenceChecks(noisy); assert.equal(r.dark, false); assert.equal(r.spf, false);
  // too little data: cannot say
  assert.deepEqual(L.evidenceChecks([]), { more: null, dark: null, spf: null });
  assert.deepEqual(L.evidenceChecks([mk({ dose: 1, colonies: 10 })]), { more: null, dark: null, spf: null });
  // never mixes strains and never crashes on junk
  assert.doesNotThrow(() => L.evidenceChecks([null, 5, { colonies: NaN }, { colonies: -1 }]));
  const mixed = good.concat(good.map(d => Object.assign({}, d, { strain: 'wild', colonies: 200 })));
  assert.equal(L.evidenceChecks(mixed).spf, true); // judged on the UV-sensitive yeast; wild-type dishes are flat on purpose
  assert.equal(L.evidenceChecks(good.map(d => Object.assign({}, d, { strain: 'wild', colonies: 200 }))).spf, false); // wild-type only and flat: not shown
});

test('evidenceBasis names the yeast the UV and SPF verdicts were judged on', () => {
  const mk = o => Object.assign({ strain: 'sensitive', minutes: 15 }, o);
  const sens = [mk({ dark: true, dose: 0, colonies: 200 }), mk({ spf: 15, dose: 1, colonies: 90 }), mk({ spf: 30, dose: 0.5, colonies: 115 }), mk({ spf: 50, dose: 0.3, colonies: 140 })];
  assert.deepEqual(L.evidenceBasis(sens), { more: 'sensitive', spf: 'sensitive' });
  assert.deepEqual(L.evidenceBasis(sens.map(d => Object.assign({}, d, { strain: 'wild' }))), { more: 'wild', spf: 'wild' });
  assert.deepEqual(L.evidenceBasis([]), { more: null, spf: null });
});
