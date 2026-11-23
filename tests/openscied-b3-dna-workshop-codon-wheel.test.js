'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { BASES, translate } = require('../openscied-b3-dna-workshop-codon-wheel.js');

// Independent fixture: read NCBI's standard code by amino-acid family, rather
// than following the wheel's U/C/A/G matrix/indexing.
const groups = {
  Phe:'UUU UUC', Leu:'UUA UUG CUU CUC CUA CUG', Ile:'AUU AUC AUA',
  Met:'AUG', Val:'GUU GUC GUA GUG', Ser:'UCU UCC UCA UCG AGU AGC',
  Pro:'CCU CCC CCA CCG', Thr:'ACU ACC ACA ACG', Ala:'GCU GCC GCA GCG',
  Tyr:'UAU UAC', His:'CAU CAC', Gln:'CAA CAG', Asn:'AAU AAC',
  Lys:'AAA AAG', Asp:'GAU GAC', Glu:'GAA GAG', Cys:'UGU UGC',
  Trp:'UGG', Arg:'CGU CGC CGA CGG AGA AGG', Gly:'GGU GGC GGA GGG',
  Stop:'UAA UAG UGA'
};

test('all 64 mRNA codons map exactly to the standard amino-acid families', () => {
  assert.deepEqual([...BASES], ['U','C','A','G']);
  const expected = new Map();
  for (const [amino, members] of Object.entries(groups)) {
    for (const codon of members.split(' ')) {
      assert.equal(expected.has(codon), false, 'independent fixture repeats ' + codon);
      expected.set(codon, amino);
    }
  }
  assert.equal(expected.size, 64);
  for (const first of 'ACGU') {
    for (const second of 'ACGU') {
      for (const third of 'ACGU') {
        const codon = first + second + third;
        const actual = translate(codon);
        assert.ok(actual, codon + ' is in the standard code');
        assert.equal(actual.codon, codon);
        assert.equal(actual.abbreviation, expected.get(codon), codon);
        assert.equal(actual.stop, expected.get(codon) === 'Stop', codon + ' stop flag');
        assert.equal(actual.start, codon === 'AUG', codon + ' workshop start flag');
      }
    }
  }
});

test('the workshop exercise and an outside example have the expected full amino-acid names', () => {
  for (const [codon, name] of [
    ['AUG','Methionine'], ['GCU','Alanine'], ['UUU','Phenylalanine'], ['UGG','Tryptophan']
  ]) assert.equal(translate(codon).name, name);
  for (const codon of ['UAA','UAG','UGA']) {
    assert.equal(translate(codon).stop, true);
    assert.equal(translate(codon).start, false);
  }
  assert.notEqual(translate('GAU').name, translate('AUG').name, 'base order matters');
});

test('lookup accepts single unambiguous RNA triplets, not DNA, text, or longer input', () => {
  for (const invalid of ['ATG','TAA','UGT','TUG','AUN','A-G','A U G','AU','AUGUAA','',null,4,['A','U','G'],undefined]) {
    assert.equal(translate(invalid), null, String(invalid));
  }
});
