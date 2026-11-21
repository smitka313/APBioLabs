/* Pure logic for the Inheritance, Environment and Cancer Risk companion (OpenSciEd B.3, Lessons 8-9).
   No DOM here, so Node can test it (tests/openscied-b3-inheritance-logic.test.js) and the scene scripts can reuse it.

   Sources: Lesson 8 handouts and keys (Lakita's Family Pedigree, Two-Gene Pedigree, Electronic Exit Ticket) and Lesson 9
   (Investigative Question Tool, Skin Cancer Data). Assumptions, stated once:
   - Alleles are letters. p53: A fixes mutations, B does not. BRCA1: C = lower breast cancer risk, D = higher.
   - Pedigree model (Lesson 8): a shaded person has cancer related to p53, so carries at least one B. A person marked
     with a known genetic test result (knownGenotype) has exactly that genotype. An unshaded person without a test result
     could carry any genotype: not everyone who carries B gets cancer. "?" persons (untested) could be anything.
     Each child gets one allele from each parent (no new mutations in the model).
   - Crossing over is a single swap between the two genes of a chromosome pair. The recombinant percentage uses the
     Haldane map function as an ILLUSTRATION; the real p53-BRCA1 rate is not given by the lesson.
   - Skin cancer values are APPROXIMATE readings by eye from the lesson's three figures (Eide and Weinstock 2005).
     The y-axis unit is not stated in the figures. The owner must verify them against the paper before release. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(); else root.B3InheritanceLogic = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---------- exit ticket (Lesson 8 key: Q1 Population B, Q2 "ab", Q4 Environment) ---------- */
  const EXIT_ITEMS = {
    q1: { correct: 'b', why: {
      a: 'Try again. Why not: without crossing over, one parent makes only two kinds of gametes, so Population A has less variety, not more.',
      b: 'Yes. With crossing over the model makes four different gametes. Without it there are only two. More kinds of gametes means more variation.',
      c: 'Try again. Why not: both populations reproduce sexually, so both have some variation. The question is which has more.' } },
    q2: { correct: 'ab', why: {
      ab: 'Yes. Crossing over is least likely between genes that are close together, so a and b usually stay on the same piece and are passed on together.',
      ac: 'Try again. Why not: a and c are farther apart than a and b, so a swap can fall between them more easily.',
      ad: 'Try again. Why not: a and d are the farthest apart, so a swap is most likely to separate them.' } },
    q4: { correct: 'environment', why: {
      chance: 'Try again. Why not: Lesson 7 looked at random mutations that happen when body cells divide.',
      inheritance: 'Try again. Why not: Lesson 8 looked at how an allele passes from parent to child through egg and sperm.',
      environment: 'Yes. Random chance (Lesson 7) and inheritance (Lesson 8) have been covered. How the environment affects mutations comes next, in Part B.' } }
  };
  function checkExit(name, value) {
    const item = EXIT_ITEMS[name];
    if (!item) return { status: 'unknown', message: '' };
    if (!value) return { status: 'empty', message: 'Choose one answer first.' };
    const message = item.why[value];
    if (!message) return { status: 'wrong', message: 'Try again. Choose one of the answers shown.' };
    return { status: value === item.correct ? 'correct' : 'wrong', message };
  }

  /* ---------- tap-to-order (Passing on alleles) ---------- */
  const MEIOSIS_ORDER = ['copy', 'cross', 'divide', 'join'];
  function checkOrder(seq) {
    const s = Array.isArray(seq) ? seq : [];
    if (!s.length) return { status: 'empty', message: '' };
    if (s.length < MEIOSIS_ORDER.length) return { status: 'partial', message: s.every((x, i) => x === MEIOSIS_ORDER[i]) ? 'Good so far. Keep tapping.' : 'Not quite in order yet. Use Start over and try again.' };
    return s.every((x, i) => x === MEIOSIS_ORDER[i]) ? { status: 'correct', message: 'Yes. Copy, swap, divide twice, then egg and sperm join.' } : { status: 'wrong', message: 'Not quite. The DNA is copied first, and egg and sperm join last. Use Start over and try again.' };
  }

  /* ---------- Investigative Question Tool (Lesson 9 reference) ---------- */
  const FRAMES = ['How does {iv} affect {dv}?', 'What is the effect of {iv} on {dv}?'];
  function buildQuestion(frameIndex, iv, dv) {
    const f = FRAMES[frameIndex] || FRAMES[0];
    return f.replace('{iv}', String(iv || '').trim() || '____').replace('{dv}', String(dv || '').trim() || '____');
  }
  const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  const VAGUE = ['healthy', 'health', 'good', 'better', 'worse', 'nice', 'things', 'stuff', 'something', 'it', 'them', 'everything'];
  const MEASURE = ['number', 'count', 'colonies', 'colony', 'growth', 'grows', 'size', 'amount', 'percent', 'area', 'time', 'height', 'mass', 'rate', 'length', 'survive', 'survival'];
  // Criteria 1 and 2 are checked by hint; criterion 3 (does it help figure out something new?) is the student's own call.
  function checkQuestion(text, iv, dv) {
    const q = norm(text), a = norm(iv), b = norm(dv);
    const hasBoth = !!(a && b && a !== b && q.includes(a) && q.includes(b));
    let c1 = hasBoth ? 'Your question names what you change and what you measure.'
      : !a || !b ? 'Choose what you will change and what you will measure.'
      : a === b ? 'What you change and what you measure should be different things.' : 'Your question should include both the thing you change and the thing you measure.';
    const words = q ? q.split(' ').length : 0;
    const vagueDv = b.split(' ').some(w => VAGUE.includes(w)) && !b.split(' ').some(w => MEASURE.includes(w));
    const vagueIv = !a || a.split(' ').every(w => VAGUE.includes(w));
    const specific = hasBoth && words >= 7 && !vagueDv && !vagueIv;
    const c2 = specific ? 'You could design a test for this question.'
      : !hasBoth ? 'Finish the first check, then look at how specific it is.'
      : words < 7 ? 'Add detail so someone could design a test.' : vagueDv ? 'How could you measure that? Try something you can count or compare.' : 'Say exactly what you will change.';
    return { ok: hasBoth && specific, criteria: [
      { id: 'variables', met: hasBoth, hint: c1 },
      { id: 'specific', met: specific, hint: c2 },
      { id: 'new', met: null, hint: 'Your call: will the answer teach you something new about UV and cancer?' }] };
  }

  /* ---------- claim, evidence and reasoning self-check (Lesson 9 Making Sense 3) ---------- */
  // 0 claim chosen, 1 evidence from my dishes, 2 evidence from the study or the reading, 3 reasoning chosen, 4 says what the evidence cannot show.
  function claimLevel(flags) {
    const f = [0, 1, 2, 3, 4].map(i => !!(flags && flags[i]));
    const n = f.filter(Boolean).length;
    if (!n) return 'none';
    if (f.every(Boolean)) return 'organized';
    if (f[0] && f[1] && n >= 3) return 'linked';
    return 'foundational';
  }

  /* Does the student's own yeast table back up each evidence statement? true / false, or null when there are not enough counted dishes
     to say. dishes = [{ strain, spf, foil, dark, minutes, dose, colonies }]. Checked per strain (UV-sensitive and wild-type are never mixed).
       more: colonies fall as UV dose rises (Pearson r < -0.2 for the UV-sensitive yeast (or every strain if none) with 3+ dishes and 2+ different doses)
       dark: each strain's dark dish has at least 90% of that strain's highest count (counts are noisy, so "about the most")
       spf:  among sunscreen dishes (3+ different SPF numbers), colonies rise with SPF (r > 0.5, UV-sensitive yeast when run)
     This is a self-check of the student's reading of their own data, not a grade. */
  function trendR(xs, ys) {
    const n = xs.length; if (n < 3) return null;
    const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
    let sxy = 0, sxx = 0, syy = 0;
    for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) * (xs[i] - mx); syy += (ys[i] - my) * (ys[i] - my); }
    if (!(sxx > 0)) return null;
    if (!(syy > 0)) return 0; // every count the same: no trend
    return sxy / Math.sqrt(sxx * syy);
  }
  function evidenceDetail(dishes) {
    const fin = x => typeof x === 'number' && isFinite(x);
    const d = (Array.isArray(dishes) ? dishes : []).filter(x => x && typeof x === 'object' && fin(x.colonies) && x.colonies >= 0);
    const out = { more: null, dark: null, spf: null };
    const by = {}; d.forEach(x => { const k = x.strain === 'wild' ? 'wild' : 'sensitive'; (by[k] = by[k] || []).push(x); });
    const more = [], dark = [], spf = [], moreBy = {}, spfBy = {};
    Object.keys(by).forEach(k => {
      const g = by[k];
      const dosed = g.filter(x => fin(x.dose));
      if (dosed.length >= 3 && new Set(dosed.map(x => x.dose)).size >= 2) { const r = trendR(dosed.map(x => x.dose), dosed.map(x => x.colonies)); if (r != null) { more.push(r < -0.2); moreBy[k] = r < -0.2; } }
      const darks = g.filter(x => x.dark), top = Math.max.apply(null, g.map(x => x.colonies));
      if (darks.length && g.length >= 2) dark.push(darks.every(x => x.colonies >= 0.9 * top));
      const sp = g.filter(x => fin(x.spf) && x.spf > 0 && !x.dark && !x.foil);
      if (sp.length >= 3 && new Set(sp.map(x => x.spf)).size >= 3) { const r = trendR(sp.map(x => x.spf), sp.map(x => x.colonies)); if (r != null) { spf.push(r > 0.5); spfBy[k] = r > 0.5; } }
    });
    // The UV and SPF trends are judged on the UV-sensitive yeast when they were run (wild-type dishes stay flat on purpose); the dark dish on every strain.
    const trend = (list, byStrain) => byStrain.sensitive != null ? byStrain.sensitive : (list.length ? list.every(Boolean) : null);
    out.more = trend(more, moreBy); out.spf = trend(spf, spfBy);
    const basisOf = by2 => by2.sensitive != null ? 'sensitive' : Object.keys(by2).length ? 'wild' : null;
    const basis = { more: basisOf(moreBy), spf: basisOf(spfBy) };
    if (dark.length) out.dark = dark.every(Boolean);
    return { checks: out, basis: basis };
  }
  const evidenceChecks = dishes => evidenceDetail(dishes).checks;
  // Which yeast the UV and SPF verdicts were judged on: 'sensitive', 'wild', or null.
  const evidenceBasis = dishes => evidenceDetail(dishes).basis;

  /* ---------- pedigree data model and constraint checker ----------
     person = { id, label, sex:'M'|'F', affected:bool, deceased:bool, untested:bool, parents:[id,id]|null, knownGenotype:'AA'|null }
     (genotype letters: A fixes mutations, B does not; order does not matter). */
  const GENOTYPES = ['AA', 'AB', 'BB'];
  const gt = (x, y) => [x, y].sort().join('');
  const LAKITA = { id: 'lakita', persons: [
    { id: 'grandfather', label: 'Lakita’s grandfather', sex: 'M', affected: false, deceased: false, untested: false, parents: null, knownGenotype: 'AA' },
    { id: 'grandmother', label: 'Lakita’s grandmother', sex: 'F', affected: true, deceased: true, untested: false, parents: null, knownGenotype: null },
    { id: 'aunt1', label: 'Aunt (not tested)', sex: 'F', affected: false, deceased: false, untested: true, parents: ['grandfather', 'grandmother'], knownGenotype: null },
    { id: 'aunt2', label: 'Aunt (deceased, shaded)', sex: 'F', affected: true, deceased: true, untested: false, parents: ['grandfather', 'grandmother'], knownGenotype: null },
    { id: 'uncle', label: 'Uncle (deceased, shaded)', sex: 'M', affected: true, deceased: true, untested: false, parents: ['grandfather', 'grandmother'], knownGenotype: null },
    { id: 'aunt3', label: 'Aunt (not tested)', sex: 'F', affected: false, deceased: false, untested: true, parents: ['grandfather', 'grandmother'], knownGenotype: null },
    { id: 'father', label: 'Lakita’s father', sex: 'M', affected: true, deceased: true, untested: false, parents: ['grandfather', 'grandmother'], knownGenotype: null },
    { id: 'mother', label: 'Lakita’s mother', sex: 'F', affected: false, deceased: false, untested: false, parents: null, knownGenotype: 'AA' },
    { id: 'lakita', label: 'Lakita', sex: 'F', affected: true, deceased: false, untested: false, parents: ['father', 'mother'], knownGenotype: null }] };
  function childGenotypes(pa, pb) { const out = new Set(); for (const x of pa) for (const y of pb) out.add(gt(x, y)); return Array.from(out); }
  function ownDomain(p) {
    if (p.knownGenotype) return [gt(p.knownGenotype[0], p.knownGenotype[1])];
    if (p.affected === true) return ['AB', 'BB'];
    return GENOTYPES.slice();
  }
  // All genotype assignments that obey the model. Returns { ok, assignments:[{id:genotype}], possible:{id:[genotypes]} }.
  function solvePedigree(ped) {
    const persons = (ped && ped.persons) || [], byId = {};
    persons.forEach(p => { byId[p.id] = p; });
    const order = [], seen = new Set();
    function visit(p) {
      if (seen.has(p.id)) return; seen.add(p.id);
      (p.parents || []).forEach(id => { if (byId[id]) visit(byId[id]); });
      order.push(p);
    }
    persons.forEach(visit);
    const assignments = [], cur = {};
    (function go(i) {
      if (i === order.length) { assignments.push(Object.assign({}, cur)); return; }
      const p = order[i];
      for (const g of ownDomain(p)) {
        if (p.parents && p.parents.length === 2 && cur[p.parents[0]] && cur[p.parents[1]] && !childGenotypes(cur[p.parents[0]], cur[p.parents[1]]).includes(g)) continue;
        cur[p.id] = g; go(i + 1); delete cur[p.id];
      }
    })(0);
    const possible = {};
    persons.forEach(p => { possible[p.id] = GENOTYPES.filter(g => assignments.some(a => a[p.id] === g)); });
    return { ok: assignments.length > 0, assignments, possible };
  }
  function possibleGenotypes(ped) { return solvePedigree(ped).possible; }
  function normalizeGuess(list) { return Array.from(new Set((Array.isArray(list) ? list : []).map(x => String(x).toUpperCase().split('').sort().join('')).filter(g => GENOTYPES.includes(g)))).sort(); }
  // The student lists the genotypes they think are possible for one person. status: correct | incomplete | wrong | empty.
  function checkGuess(ped, id, guess) {
    const possible = possibleGenotypes(ped)[id];
    if (!possible) return { status: 'unknown', impossible: [], missing: [], possible: [] };
    const g = normalizeGuess(guess);
    if (!g.length) return { status: 'empty', impossible: [], missing: possible.slice(), possible };
    const impossible = g.filter(x => !possible.includes(x)), missing = possible.filter(x => !g.includes(x));
    return { status: impossible.length ? 'wrong' : missing.length ? 'incomplete' : 'correct', impossible, missing, possible };
  }
  function explainImpossible(ped, id, genotype) {
    const p = ((ped && ped.persons) || []).find(x => x.id === id); if (!p) return '';
    if (p.knownGenotype && gt(p.knownGenotype[0], p.knownGenotype[1]) !== genotype) return 'The lesson says genetic testing found only versions that fix mutations (AA) for this person.';
    if (p.affected && !genotype.includes('B')) return 'Shaded means cancer related to p53, so this person has at least one version that does not fix mutations (B).';
    return 'The parents cannot pass on that combination.';
  }

  /* ---------- two genes (Lesson 8 reference pedigree and key) ---------- */
  // chromosome = [p53 allele, BRCA1 allele]; person = { id, label, sex, chromosomes:[[..],[..]] }
  const TWO_GENE = { persons: [
    { id: 'father', label: 'Father', sex: 'M', chromosomes: [['A', 'C'], ['B', 'D']] },
    { id: 'mother', label: 'Mother', sex: 'F', chromosomes: [['A', 'C'], ['A', 'C']] },
    { id: 'child1', label: 'Child 1', sex: 'M', chromosomes: [['A', 'C'], ['A', 'C']], parents: ['father', 'mother'] },
    { id: 'child2', label: 'Child 2', sex: 'M', chromosomes: [['B', 'C'], ['A', 'C']], parents: ['father', 'mother'] },
    { id: 'child3', label: 'Child 3', sex: 'F', chromosomes: [['A', 'D'], ['A', 'C']], parents: ['father', 'mother'] }] };
  function twoGeneGenotypes(person) { const c = person.chromosomes; return { p53: gt(c[0][0], c[1][0]), brca1: gt(c[0][1], c[1][1]) }; }
  // Key table: p53 AB is high with BRCA1 CD, medium with CC; AA is low (medium with CD); BB and DD have no information but are likely high.
  function twoGeneRisk(p53, brca1) {
    const a = gt(p53[0], p53[1]), b = gt(brca1[0], brca1[1]);
    if (a === 'BB' || b === 'DD') return { level: 'likely-high', text: 'No information in the key, but likely higher' };
    const raise = (a === 'AB' ? 1 : 0) + (b === 'CD' ? 1 : 0);
    return raise === 2 ? { level: 'high', text: 'Higher' } : raise === 1 ? { level: 'medium', text: 'Medium' } : { level: 'low', text: 'Lower' };
  }
  // Can this child chromosome pair come from whole parental chromosomes (no crossing over)?
  function explainedWithoutCrossing(father, mother, child) {
    const eq = (x, y) => x[0] === y[0] && x[1] === y[1];
    const fromF = (c, f) => f.chromosomes.some(x => eq(x, c));
    const [c1, c2] = child.chromosomes;
    return (fromF(c1, father) && fromF(c2, mother)) || (fromF(c2, father) && fromF(c1, mother));
  }

  /* ---------- meiosis and crossing over ---------- */
  // parent = two chromosomes like ['AC','BD']. Without crossing over a parent makes only these two gamete types.
  function gameteTypes(parent, crossing) {
    const [x, y] = parent, out = [x, y];
    if (crossing) out.push(x[0] + y[1], y[0] + x[1]);
    return Array.from(new Set(out)).sort();
  }
  // Illustration only: recombinant percent for two genes d centiMorgans apart (Haldane), never above 50.
  function recombinantPercent(cM) { const d = Math.max(0, Number(cM) || 0); return 50 * (1 - Math.exp(-2 * d / 100)); }
  function gameteShares(parent, cM) {
    const [x, y] = parent, r = recombinantPercent(cM), out = {};
    out[x] = (out[x] || 0) + (100 - r) / 2; out[y] = (out[y] || 0) + (100 - r) / 2;
    out[x[0] + y[1]] = (out[x[0] + y[1]] || 0) + r / 2; out[y[0] + x[1]] = (out[y[0] + x[1]] || 0) + r / 2;
    return out;
  }

  /* ---------- UV: C to T example (a simplified picture) ---------- */
  const AA = { F: 'Phe', L: 'Leu', S: 'Ser', Y: 'Tyr', '*': 'Stop', C: 'Cys', W: 'Trp', P: 'Pro', H: 'His', Q: 'Gln', R: 'Arg', I: 'Ile', M: 'Met', T: 'Thr', N: 'Asn', K: 'Lys', V: 'Val', A: 'Ala', D: 'Asp', E: 'Glu', G: 'Gly' };
  const TABLE = 'FFLLSSSSYY**CC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG';
  function aminoFor(triplet) {
    const t = String(triplet || '').toUpperCase(), B = 'TCAG';
    if (!/^[TCAG]{3}$/.test(t)) return null;
    return AA[TABLE[B.indexOf(t[0]) * 16 + B.indexOf(t[1]) * 4 + B.indexOf(t[2])]];
  }
  // One C in the three-letter group becomes T. Returns null if that position is not a C.
  function cToT(triplet, position) {
    const t = String(triplet || '').toUpperCase();
    if (!/^[TCAG]{3}$/.test(t) || t[position] !== 'C') return null;
    const after = t.slice(0, position) + 'T' + t.slice(position + 1), before = aminoFor(t), next = aminoFor(after);
    return { before: t, after, aminoBefore: before, aminoAfter: next, same: before === next, stop: next === 'Stop' && before !== 'Stop' };
  }

  /* ---------- skin cancer data (approximate readings by eye; verify before release) ---------- */
  const SKIN_META = { source: 'Eide MJ, Weinstock MA. Arch Dermatol 2005;141(4):477-481, doi:10.1001/archderm.141.4.477 (as shown in the lesson’s Skin Cancer Data figures)',
    approximate: true, xLabel: 'Average annual UV index, 1997', yLabel: 'Melanoma incidence (the figure does not state the unit)',
    labels: { white: 'White', black: 'Black', hispanic: 'Hispanic' },
    originalLabels: { white: 'White Non-Hispanic', black: 'Black and Black-Hispanic', hispanic: 'White Hispanic' } };
  const SITE_UV = { Hawaii: 9.7, Atlanta: 5.0, 'New Mexico': 6.2, 'San Jose': 5.3, Connecticut: 3.5, Seattle: 2.7, 'Los Angeles': 5.9, 'San Francisco': 5.3, Utah: 4.8, Detroit: 3.4, Iowa: 4.0 };
  const SKIN_Y = {
    white: { Hawaii: 46, Atlanta: 28, 'New Mexico': 26, 'San Jose': 25, Connecticut: 24.5, Seattle: 25, 'Los Angeles': 25, 'San Francisco': 23.5, Utah: 23, Detroit: 20.5, Iowa: 18 },
    black: { Utah: 1.7, Connecticut: 1.5, Seattle: 1.4, 'New Mexico': 1.4, Atlanta: 1.2, 'Los Angeles': 1.1, Iowa: 0.9, Detroit: 0.9, 'San Francisco': 0.8, Hawaii: 0.2, 'San Jose': 0.1 },
    hispanic: { Atlanta: 10, Utah: 9.6, 'San Francisco': 5.9, Connecticut: 5.7, Seattle: 4.7, Iowa: 4.5, 'San Jose': 4.3, 'Los Angeles': 3.7, 'New Mexico': 3.4, Detroit: 2.5, Hawaii: 0 } };
  const SKIN_READINGS = {};
  Object.keys(SKIN_Y).forEach(g => { SKIN_READINGS[g] = Object.keys(SKIN_Y[g]).map(site => ({ site, uv: SITE_UV[site], rate: SKIN_Y[g][site] })); });
  function pearson(xs, ys) {
    const n = Math.min(xs.length, ys.length); if (n < 3) return null;
    const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
    let sxy = 0, sxx = 0, syy = 0;
    for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; syy += (ys[i] - my) ** 2; }
    return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : null;
  }
  function skinCorrelation(group) { const r = SKIN_READINGS[group]; return r ? pearson(r.map(p => p.uv), r.map(p => p.rate)) : null; }

  /* ---------- evidence kinds (Lesson 9 correlation and causation) ---------- */
  const EVIDENCE_KINDS = { graphs: 'pattern', dishes: 'test', reading: 'how' };

  return { EXIT_ITEMS, checkExit, MEIOSIS_ORDER, checkOrder, FRAMES, buildQuestion, checkQuestion, claimLevel, evidenceChecks, evidenceBasis,
    GENOTYPES, LAKITA, childGenotypes, solvePedigree, possibleGenotypes, normalizeGuess, checkGuess, explainImpossible,
    TWO_GENE, twoGeneGenotypes, twoGeneRisk, explainedWithoutCrossing, gameteTypes, recombinantPercent, gameteShares,
    aminoFor, cToT, SKIN_META, SITE_UV, SKIN_READINGS, pearson, skinCorrelation, EVIDENCE_KINDS };
});
