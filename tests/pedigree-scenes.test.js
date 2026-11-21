/* Pure logic of the pedigree and two-gene scenes (pedigree-scene.js, two-gene-scene.js) for openscied-b3-inheritance-environment.html.
   Expected values are written out by hand from the Lesson 8 key (Lakita's Pedigree Key, Two-Gene Pedigree key), not computed by the code under test. */
const test = require('node:test');
const assert = require('node:assert');
const L = require('../openscied-b3-inheritance-logic.js');
const PED = require('../pedigree-scene.js');
const TG = require('../two-gene-scene.js');

test('pedigree: feedback agrees with the key for every person', () => {
  const key = { grandfather: ['AA'], mother: ['AA'], lakita: ['AB'], father: ['AB'], aunt2: ['AB'], uncle: ['AB'], aunt1: ['AA', 'AB'], aunt3: ['AA', 'AB'], grandmother: ['AB', 'BB'] };
  Object.keys(key).forEach(id => {
    const f = PED.feedback(L, id, key[id]);
    assert.strictEqual(f.status, 'correct', id);
    assert.deepStrictEqual(f.possible, key[id], id);
    ['AA', 'AB', 'BB'].filter(g => !key[id].includes(g)).forEach(g => assert.strictEqual(PED.feedback(L, id, key[id].concat(g)).status, 'wrong', id + ' + ' + g));
  });
});
test('pedigree: incomplete guess for an untested aunt, empty guess, wording', () => {
  const inc = PED.feedback(L, 'aunt1', ['AA']);
  assert.strictEqual(inc.status, 'incomplete');
  assert.match(inc.text, /not tested/);
  assert.strictEqual(PED.feedback(L, 'aunt1', []).status, 'empty');
  assert.match(PED.feedback(L, 'aunt3', ['AA', 'AB']).text, /Could be either AA or AB/);
  assert.match(PED.feedback(L, 'lakita', ['BB']).text, /mother|A alleles|AA/);
  ['lakita', 'father', 'aunt1', 'grandmother'].forEach(id => ['AA', 'AB', 'BB'].forEach(g => assert.doesNotMatch(PED.feedback(L, id, [g]).text, /bad gene|defect|your fault/i)));
});
test('pedigree: reasons name the real cause', () => {
  assert.match(PED.reasonImpossible(L, 'lakita', 'AA'), /Shaded means/);
  assert.match(PED.reasonImpossible(L, 'father', 'BB'), /grandfather has only A alleles/);
  assert.match(PED.reasonImpossible(L, 'mother', 'AB'), /testing/);
});
test('pedigree: aria label and description', () => {
  assert.strictEqual(PED.ariaLabel(L, 'lakita', ['AB']), 'Lakita, daughter, shaded: cancer related to p53, genotype guess AB, matches the model');
  assert.strictEqual(PED.ariaLabel(L, 'aunt1', []), 'First aunt, female, not shaded, not tested, no genotype guess yet');
  assert.match(PED.ariaLabel(L, 'father', ['AA']), /^Lakita’s father, male, shaded: cancer related to p53, deceased, genotype guess AA, not possible$/);
  assert.match(PED.describe(L, {}), /No genotype picks yet/);
  assert.match(PED.describe(L, { lakita: ['AB'], aunt1: ['AA'] }), /Lakita, daughter AB \(matches the model\).*First aunt AA \(more could be true\)/);
  assert.deepStrictEqual(PED.cleanGuesses(L, { lakita: ['ab', 'ZZ'], nobody: ['AA'], aunt1: 'AA' }), { lakita: ['AB'] });
});
test('pedigree: arrow-key navigation stays on the tree', () => {
  assert.strictEqual(PED.navigate('grandfather', 'ArrowLeft'), 'grandfather');
  assert.strictEqual(PED.navigate('grandfather', 'ArrowRight'), 'grandmother');
  assert.strictEqual(PED.navigate('grandfather', 'ArrowUp'), 'grandfather');
  assert.strictEqual(PED.navigate('aunt1', 'ArrowUp'), 'grandfather');
  assert.strictEqual(PED.navigate('father', 'ArrowDown'), 'lakita');
  assert.strictEqual(PED.navigate('lakita', 'ArrowUp'), 'father');
  assert.strictEqual(PED.navigate('aunt1', 'End'), 'mother');
  PED.ORDER.forEach(id => ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].forEach(k => assert.ok(PED.META[PED.navigate(id, k)], id + k)));
});
test('pedigree: Punnett-style square for Lakita', () => {
  const p = PED.punnett(L);
  assert.strictEqual(p.father, 'AB'); assert.strictEqual(p.mother, 'AA'); assert.strictEqual(p.lakita, 'AB');
  assert.deepStrictEqual(p.cells, [['AA', 'AA'], ['AB', 'AB']]);
  assert.strictEqual(p.fatherGives, 'B'); assert.strictEqual(p.motherGives, 'A'); assert.ok(p.ok);
  assert.strictEqual(p.steps.length, 3);
});

test('two genes: people match the reference and key', () => {
  const want = { father: ['AB', 'CD', 'Higher'], mother: ['AA', 'CC', 'Lower'], child1: ['AA', 'CC', 'Lower'], child2: ['AB', 'CC', 'Medium'], child3: ['AA', 'CD', 'Medium'] };
  Object.keys(want).forEach(id => assert.match(TG.ariaLabel(L, id, false), new RegExp('p53 ' + want[id][0] + ', BRCA1 ' + want[id][1] + '.*' + want[id][2]), id));
  assert.deepStrictEqual(TG.expectedCarrier(L), ['father']);
  assert.deepStrictEqual(TG.expectedMismatch(L), ['child2', 'child3']);
});
test('two genes: tracing needs crossing over for children 2 and 3 only', () => {
  const f = L.TWO_GENE.persons[0], m = L.TWO_GENE.persons[1], kid = id => L.TWO_GENE.persons.find(p => p.id === id);
  assert.deepStrictEqual(TG.recombinants(f), [['A', 'D'], ['B', 'C']]);
  const t1 = TG.traceChild(f, m, kid('child1')), t2 = TG.traceChild(f, m, kid('child2')), t3 = TG.traceChild(f, m, kid('child3'));
  assert.strictEqual(t1.crossed, false); assert.deepStrictEqual(t1.fatherGave, ['A', 'C']);
  assert.strictEqual(t2.crossed, true); assert.deepStrictEqual(t2.fatherGave, ['B', 'C']); assert.deepStrictEqual(t2.motherGave, ['A', 'C']);
  assert.strictEqual(t3.crossed, true); assert.deepStrictEqual(t3.fatherGave, ['A', 'D']);
  // a child nobody could make: both chromosomes B-D from the mother side
  assert.strictEqual(TG.traceChild(f, m, { chromosomes: [['B', 'D'], ['B', 'D']] }), null);
  assert.strictEqual(TG.traceSteps(L, 'child1').length, 3);
  assert.strictEqual(TG.traceSteps(L, 'child2').length, 5);
  assert.ok(TG.traceSteps(L, 'child3').some(s => s.show.swap));
  assert.ok(!TG.traceSteps(L, 'child1').some(s => s.show.swap));
  assert.match(TG.traceSteps(L, 'child3')[4].text, /A–D is on neither parent’s chromosomes, so crossing over in the father made it/);
});
test('two genes: feedback wording and conclusion', () => {
  assert.match(TG.readFeedback(L, 'father', 'p53', 'AA').text, /top spots \(p53\)/);
  assert.match(TG.readFeedback(L, 'father', 'brca1', 'CC').text, /bottom spots \(BRCA1\)/);
  assert.strictEqual(TG.readFeedback(L, 'father', 'brca1', 'CD').ok, true);
  assert.strictEqual(TG.carrierFeedback(L, 'father').ok, true);
  assert.match(TG.carrierFeedback(L, 'child2').text, /only B/);
  assert.match(TG.carrierFeedback(L, 'child3').text, /only D/);
  assert.match(TG.mixFeedback(L, 'child1').text, /whole chromosome from each parent/);
  assert.strictEqual(TG.mixFeedback(L, 'father').ok, null);
  assert.match(TG.CONCLUSION, /Children 2 and 3.*swap between the two chromosomes of a pair \(crossing over\)/i);
});
test('two genes: saved state is checked against the key', () => {
  const c = TG.cleanState(L, { genotypes: { father: { p53: 'AB', brca1: 'CD' }, mother: { p53: 'BB', brca1: 'CC' }, ghost: { p53: 'AA', brca1: 'CC' } }, carrier: 'mother', mismatch: ['child2', 'child2', 'child1', 'child3'], traced: { child2: true, father: true } });
  assert.deepStrictEqual(Object.keys(c.genotypes), ['father']);
  assert.strictEqual(c.carrier, null);
  assert.deepStrictEqual(c.mismatch, ['child2', 'child3']);
  assert.deepStrictEqual(c.traced, { child2: true });
  assert.deepStrictEqual(TG.cleanState(L, null), { genotypes: {}, carrier: null, mismatch: [], traced: {} });
  assert.strictEqual(TG.navigate('child1', 'ArrowUp'), 'father');
  assert.strictEqual(TG.navigate('mother', 'ArrowDown'), 'child2');
});

test('Next person follows the drawing, generation by generation, and wraps', () => {
  const seen = []; let id = 'grandfather';
  for (let i = 0; i < 9; i++) { seen.push(id); id = PED.nextPerson(id); }
  assert.deepStrictEqual(seen, ['grandfather', 'grandmother', 'aunt1', 'aunt2', 'uncle', 'aunt3', 'father', 'mother', 'lakita']);
  assert.strictEqual(id, 'grandfather');
});
