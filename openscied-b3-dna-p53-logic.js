/* Pure logic for the DNA Copying, p53 and Gene Expression companion (OpenSciEd B.3, Lessons 5-6).
   No DOM here, so Node can test it (tests/openscied-b3-dna-p53-logic.test.js) and the two scene scripts can reuse it.

   Sources for the data: the Lesson 6 Teacher Reference "DNA Sequences" (strands A, B, C), the "Amino Acid Cards"
   (card codes and words) and the Gene Expression Simulation answer key. Assumptions, stated once:
   - The model copies DNA to RNA by complementary pairing (A-U, T-A, G-C, C-G).
   - "Edit" removes the 2nd, 3rd, 5th and 6th groups of three, as in the handout. It stands in for real RNA splicing,
     where non-coding sections (introns) are cut out. Real splicing removes sections of very different lengths.
   - Each card shows the complement of an RNA group (what a tRNA anticodon would pair with), an amino acid and a word.
   - amino acid names for the real genetic code come from the standard codon table. One official card does not agree
     with it: the card for GAA (RNA group CUU) says Pro, but CUU codes for Leu. We keep the card words (so the sentence
     matches the lesson) and report the real amino acid next to it. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.B3DnaP53Logic = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Standard genetic code, RNA codons. Order of bases is U, C, A, G at each position.
  const BASES = 'UCAG';
  const ONE = 'FFLLSSSSYY**CC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG';
  const THREE = { F: 'Phe', L: 'Leu', S: 'Ser', Y: 'Tyr', C: 'Cys', W: 'Trp', P: 'Pro', H: 'His', Q: 'Gln', R: 'Arg', I: 'Ile', M: 'Met', T: 'Thr', N: 'Asn', K: 'Lys', V: 'Val', A: 'Ala', D: 'Asp', E: 'Glu', G: 'Gly', '*': 'Stop' };
  const STANDARD_CODE = {};
  for (let i = 0; i < 64; i++) STANDARD_CODE[BASES[(i >> 4) & 3] + BASES[(i >> 2) & 3] + BASES[i & 3]] = THREE[ONE[i]];

  const PAIR_DNA_TO_RNA = { A: 'U', T: 'A', G: 'C', C: 'G' };
  const PAIR_RNA_TO_ANTICODON = { A: 'U', U: 'A', G: 'C', C: 'G' };

  // The official strands (Teacher Reference 2). The key's DNA for strand B has 36 bases; A and C have 39.
  const STRANDS = {
    A: 'AAGCCAAGATCACGCCACTCCCCATAATGGTCCCTTCTG',
    B: 'AAGCCAAGATCACGCCACTCCCCATAAGAATCCCGA',
    C: 'AAGCCAAGATCACGCCACTCCCCATAATGGTCCTTTCTG'
  };
  const KEY_SENTENCE = {
    A: 'I am a p53 protein with a butterfly shape.',
    B: 'I am a p53 protein missing a piece.',
    C: 'I am a p53 protein with a different shape.'
  };
  // Official card deck: [code printed on the card, amino acid printed on the card, word printed on the card].
  const CARD_DECK = [['AAG', 'Phe', 'I'], ['UCA', 'Ser', 'am'], ['UCC', 'Arg', 'a'], ['CCA', 'Gly', 'p53'], ['UAA', 'Ile', 'protein'],
    ['UUU', 'Lys', 'different'], ['UGG', 'Thr', 'with'], ['CUU', 'Glu', 'butterfly'], ['CUG', 'Asp', 'shape'], ['GAA', 'Pro', 'missing'],
    ['CGA', 'Ala', 'piece']];
  const EDIT_REMOVES = [2, 3, 5, 6]; // groups to cross out, counting from 1

  function clean(s) { return String(s == null ? '' : s).toUpperCase().replace(/[^A-Z]/g, ''); }
  function isDna(s) { return /^[ACGT]+$/.test(s); }
  function isRna(s) { return /^[ACGU]+$/.test(s); }
  function transcribe(dna) {
    const d = clean(dna);
    if (!isDna(d)) return null;
    return d.split('').map(b => PAIR_DNA_TO_RNA[b]).join('');
  }
  function groups(seq) { const s = clean(seq), out = []; for (let i = 0; i + 3 <= s.length; i += 3) out.push(s.slice(i, i + 3)); return out; }
  function editCopy(rna) {
    const g = groups(rna);
    return g.filter((_, i) => !EDIT_REMOVES.includes(i + 1));
  }
  function anticodon(codon) { return codon.split('').map(b => PAIR_RNA_TO_ANTICODON[b]).join(''); }
  function cardFor(codon) {
    const wanted = anticodon(clean(codon));
    const c = CARD_DECK.find(card => card[0] === wanted);
    return c ? { code: c[0], amino: c[1], word: c[2] } : null;
  }
  // Everything a student writes in Part 1 of the kinesthetic model, computed from the DNA.
  function express(dna) {
    const copy = transcribe(dna);
    if (!copy) return null;
    const edited = editCopy(copy);
    const cards = edited.map(cardFor);
    const known = cards.every(Boolean);
    return {
      copy: groups(copy), edited, cards,
      aminoCards: cards.map(c => c ? c.amino : '?'),
      aminoReal: edited.map(c => STANDARD_CODE[c] || '?'),
      sentence: known ? cards.map(c => c.word).join(' ').replace(/^./, m => m.toUpperCase()).replace(/\s*$/, '.') : ''
    };
  }
  // Where the official card disagrees with the standard genetic code (position from 1, card and real amino acid).
  function cardDisagreements(result) {
    const out = [];
    if (result) result.edited.forEach((codon, i) => { if (result.aminoCards[i] !== result.aminoReal[i]) out.push({ position: i + 1, codon, card: result.aminoCards[i], real: result.aminoReal[i] }); });
    return out;
  }
  function normalizeSentence(s) { return String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim(); }
  // 'empty' | 'match' | 'differs' for a typed sentence against the key for the chosen strand.
  function checkSentence(strand, typed) {
    const key = KEY_SENTENCE[strand];
    if (!key) return 'empty';
    const t = normalizeSentence(typed);
    if (!t) return 'empty';
    return t === normalizeSentence(key) ? 'match' : 'differs';
  }

  // DNA fork numbers (Lesson 5 handout table). Counts are whole numbers, never negative or NaN.
  function count(n) { n = Number(n); return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0; }
  function substitutionRate(correct, subs) {
    const c = count(correct), s = count(subs), total = c + s;
    return total ? Math.round(1000 * s / total) / 10 : null; // 100 * substitutions / (correctly paired + substitutions), one decimal
  }
  function strandCounts(strand) {
    const x = strand && typeof strand === 'object' ? strand : {};
    const correct = count(x.correct), subs = count(x.substitutions);
    return { correct, substitutions: subs, rate: substitutionRate(correct, subs) };
  }
  // fork = { before:{top,bottom}, after:{top,bottom}, p53:{a:{tried,removed},...} } -> normalized, or null when empty.
  function forkSummary(fork) {
    if (!fork || typeof fork !== 'object') return null;
    const b = fork.before || {}, a = fork.after || {};
    const out = { before: { top: strandCounts(b.top), bottom: strandCounts(b.bottom) }, after: { top: strandCounts(a.top), bottom: strandCounts(a.bottom) }, p53: {} };
    const has = x => x.correct + x.substitutions > 0;
    out.hasBefore = has(out.before.top) || has(out.before.bottom);
    out.hasAfter = has(out.after.top) || has(out.after.bottom);
    ['a', 'b', 'c'].forEach(v => { const p = fork.p53 && fork.p53[v] || {}; out.p53[v] = { tried: count(p.tried), removed: count(p.removed) }; });
    out.hasP53 = ['a', 'b', 'c'].some(v => out.p53[v].tried > 0);
    return out.hasBefore || out.hasAfter || out.hasP53 ? out : null;
  }

  /* ---------- DNA fork model (Lesson 5 simulation guidance) ----------
     Assumptions (also written on the page): a 24-letter piece of DNA; after unzipping, each old strand gets a new partner strand.
     The student places the first 5 partners on each strand by hand (always correct); the model then pairs the remaining 19 on its
     own and now and then puts in a wrong letter (a substitution). A substitution here is a plain swap of one letter for another;
     real cells also lose or gain letters, and their copying enzymes proofread, which this model leaves out.
     Only p53 (a) fits the notch next to a wrong letter and removes it; p53 (b) and (c) do not fit. */
  const FORK_LENGTH = 24, FORK_MANUAL = 5, FORK_RATE = 0.1, FORK_MAX_SUBS = 6;
  const DNA_PARTNER = { A: 'T', T: 'A', G: 'C', C: 'G' };
  const LETTERS = 'ACGT';
  function partnerOf(letter) { return DNA_PARTNER[letter] || null; }
  // rand: a function returning numbers in [0, 1) (for example Lab.rng(seed).uniform). Deterministic for the same generator state.
  function forkPlan(rand) {
    const r = typeof rand === 'function' ? rand : Math.random;
    let top;
    for (let tries = 0; tries < 50; tries++) {          // a realistic mix: every letter at least twice
      top = []; for (let i = 0; i < FORK_LENGTH; i++) top.push(LETTERS[Math.floor(r() * 4)]);
      if (LETTERS.split('').every(l => top.filter(x => x === l).length >= 2)) break;
    }
    const bottom = top.map(partnerOf);                   // the other old strand: each letter pairs with the one above it
    const subs = { top: [], bottom: [] };
    ['top', 'bottom'].forEach(key => {
      const tmpl = key === 'top' ? top : bottom;
      const wrongFor = i => LETTERS.split('').filter(l => l !== partnerOf(tmpl[i]));   // the three letters that do not pair here
      const list = new Array(FORK_LENGTH).fill('');
      for (let i = FORK_MANUAL; i < FORK_LENGTH; i++) if (r() < FORK_RATE) list[i] = wrongFor(i)[Math.floor(r() * 3)];
      let n = list.filter(Boolean).length;
      while (n < 1) { const i = FORK_MANUAL + Math.floor(r() * (FORK_LENGTH - FORK_MANUAL)); list[i] = wrongFor(i)[Math.floor(r() * 3)]; n = list.filter(Boolean).length; } // at least one visible mismatch per strand
      for (let i = FORK_LENGTH - 1; n > FORK_MAX_SUBS && i >= 0; i--) if (list[i]) { list[i] = ''; n--; }
      subs[key] = list;
    });
    return { length: FORK_LENGTH, manual: FORK_MANUAL, top, bottom, subs };
  }
  // The letter the new strand needs at each site of one strand.
  function forkNeeded(plan, key) { return (key === 'top' ? plan.top : plan.bottom).map(partnerOf); }
  // Sites are strings of 'e' empty, 'g' correct pair, 'b' substitution, 'x' gap left where p53 removed a wrong letter.
  function siteCounts(sites) {
    const s = String(sites || '');
    let correct = 0, substitutions = 0;
    for (const c of s) { if (c === 'g') correct++; else if (c === 'b') substitutions++; }
    return { correct, substitutions };
  }
  // What the model pairs at one site: the correct letter ('g'), or the planned wrong one ('b'); never wrong in the by-hand sites.
  function autoSite(plan, key, i) { return i >= plan.manual && plan.subs[key][i] ? 'b' : 'g'; }
  // Apply one p53 version to a strand's sites. Only 'a' fits; it removes the leftmost substitution. Returns the new sites
  // string, the index touched (-1 when the strand has no substitution) and whether it fit.
  function p53Apply(sites, variant) {
    const s = String(sites || ''), i = s.indexOf('b');
    if (i < 0) return { sites: s, index: -1, fits: variant === 'a', removed: false };
    if (variant !== 'a') return { sites: s, index: i, fits: false, removed: false };
    return { sites: s.slice(0, i) + 'x' + s.slice(i + 1), index: i, fits: true, removed: true };
  }
  // Put a letter into the leftmost gap; only the correct partner fits. Returns {sites, index, fits}.
  function replaceGap(sites, plan, key, letter) {
    const s = String(sites || ''), i = s.indexOf('x');
    if (i < 0) return { sites: s, index: -1, fits: false };
    if (letter !== forkNeeded(plan, key)[i]) return { sites: s, index: i, fits: false };
    return { sites: s.slice(0, i) + 'g' + s.slice(i + 1), index: i, fits: true };
  }
  // Does a saved site string make sense for this plan? (guards old or damaged saves)
  function sitesValid(sites, plan, key) {
    if (typeof sites !== 'string' || sites.length !== FORK_LENGTH || !/^[egbx]+$/.test(sites)) return false;
    for (let i = 0; i < FORK_LENGTH; i++) if ((sites[i] === 'b' || sites[i] === 'x') && !plan.subs[key][i]) return false;
    return true;
  }

  // Self-check against the Teacher Edition's three levels. flags = the six "must include" ideas, true or false, in order:
  // 0 copying steps (unwind, unzip, match), 1 errors are mismatched bases (substitutions), 2 p53 removes mismatches,
  // 3 only one version of p53 does this, 4 fixed -> identical chromosomes, not fixed -> different, 5 cites evidence.
  function explanationLevel(flags) {
    const f = [0, 1, 2, 3, 4, 5].map(i => !!(flags && flags[i]));
    const n = f.filter(Boolean).length;
    if (!n) return 'none';
    if (f.every(Boolean)) return 'organized';
    if (f[1] && f[4] && n >= 3) return 'linked';
    return 'foundational';
  }

  return { STANDARD_CODE, STRANDS, KEY_SENTENCE, CARD_DECK, EDIT_REMOVES, transcribe, groups, editCopy, anticodon, cardFor, express, cardDisagreements,
    normalizeSentence, checkSentence, substitutionRate, strandCounts, forkSummary, explanationLevel,
    FORK_LENGTH, FORK_MANUAL, partnerOf, forkPlan, forkNeeded, siteCounts, autoSite, p53Apply, replaceGap, sitesValid };
});
