/* Scene 2 for the OpenSciEd B.3 Lessons 8-9 companion: the p53 and BRCA1 two-gene pedigree (host #two-gene-scene, id "twoGene").
   Drawn from the lesson's "p53 BRCA1 Pedigree" reference and its answer key: a father with chromosomes A-C and B-D, a mother with
   A-C and A-C, and three children. Each person is a pair of chromosome icons with both genes on each chromosome (p53 above
   BRCA1). Four tap activities, no typing:
     1 Read the chromosomes: tap a person and pick that person's p53 and BRCA1 genotype; each pick is checked at once.
     2 Both risk alleles: tap the person who has B (p53) and D (BRCA1).
     3 New mixes: tap each child who got a chromosome that matches neither parent's (the lesson's Making Sense 2).
     4 Trace the chromosomes: tap a child and step through where each chromosome came from, including the swap
       (crossing over) in the father for children 2 and 3. Static steps with Back/Next; "Play" only without reduced motion.

   WHAT IT MODELS (the same ideas are in the page's "What this models" note):
   - Alleles: p53 A fixes mutations and B does not; BRCA1 C is the lower-risk allele and D the higher-risk one. A or C alone means
     lower risk; adding B or D raises it (the key's table). Shading steps (Lower, Medium, Higher) come from the logic file's
     twoGeneRisk and always come with a word and a pattern, never colour alone.
   - Crossing over is drawn as one swap between the two chromosomes of a pair, between the two genes: the lower pieces exchange.
     Real genes sit at known distances apart and a swap happens in some gametes, not all. The lesson gives no real rate here.
   - Not a prediction for any person: it is a model of how alleles can combine, and risk is never certainty.
   - The video-person questions are not used here.

   Saved state: api.saveState('twoGene', { genotypes: { <id>: { p53, brca1 } }, carrier, mismatch, traced, updatedAt }).
   genotypes holds only people the student has read correctly. Pure functions are exported for node tests. */
(function (root, factory) {
  const m = factory();
  if (typeof module === 'object' && module.exports) module.exports = m.pure;
  if (typeof window !== 'undefined' && root === window) (window.B3InhScenes = window.B3InhScenes || []).push({ id: 'twoGene', mount: m.mount });
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---------- pure ---------- */
  const VIEW_W = 620, VIEW_H = 436, S = 48;
  const META = {
    father: { name: 'Father', row: 0, x: 240, y: 56, pair: [140, 17] },
    mother: { name: 'Mother', row: 0, x: 400, y: 56, pair: [520, 17] },
    child1: { name: 'Child 1', row: 1, x: 130, y: 232, pair: [130, 270] },
    child2: { name: 'Child 2', row: 1, x: 320, y: 232, pair: [320, 270] },
    child3: { name: 'Child 3', row: 1, x: 510, y: 232, pair: [510, 270] }
  };
  const ROWS = [['father', 'mother'], ['child1', 'child2', 'child3']];
  const IDS = ['father', 'mother', 'child1', 'child2', 'child3'];
  const P53 = ['AA', 'AB', 'BB'], BRCA = ['CC', 'CD', 'DD'];
  const MODES = [['read', '1 Read the chromosomes'], ['carrier', '2 Both risk alleles'], ['mix', '3 New mixes'], ['trace', '4 Trace the chromosomes']];
  const dash = c => c[0] + '–' + c[1];
  const byId = (L, id) => L.TWO_GENE.persons.find(function (p) { return p.id === id; });
  const truth = (L, id) => L.twoGeneGenotypes(byId(L, id));
  const alleles = p => [].concat.apply([], p.chromosomes).filter(function (a, i, arr) { return arr.indexOf(a) === i; }).sort();
  const hasBoth = p => { const a = alleles(p); return a.includes('B') && a.includes('D'); };
  const wholeText = p => p.chromosomes.map(dash).join(' and ');
  const risk = (L, id) => { const t = truth(L, id); return L.twoGeneRisk(t.p53, t.brca1); };
  const levelOf = r => r.level === 'high' ? 3 : r.level === 'medium' ? 2 : r.level === 'likely-high' ? 3 : 1;

  // Whole parental chromosome pairs or the two products of one swap in the father.
  function recombinants(father) { const x = father.chromosomes[0], y = father.chromosomes[1]; return [[x[0], y[1]], [y[0], x[1]]]; }
  const sameChr = (a, b) => a[0] === b[0] && a[1] === b[1];
  // Which parent chromosome did each child chromosome come from? null if the model cannot make this child.
  function traceChild(father, mother, child) {
    const c = child.chromosomes, recF = recombinants(father);
    let best = null;
    [[c[0], c[1], 0], [c[1], c[0], 1]].forEach(function (o) {
      const ff = o[0], fm = o[1], mi = mother.chromosomes.findIndex(function (x) { return sameChr(x, fm); });
      if (mi < 0) return;
      let fi = father.chromosomes.findIndex(function (x) { return sameChr(x, ff); }), crossed = false;
      if (fi < 0) { fi = recF.findIndex(function (x) { return sameChr(x, ff); }); crossed = true; if (fi < 0) return; }
      const cand = { fatherGave: ff.slice(), motherGave: fm.slice(), fatherIndex: fi, motherIndex: mi, crossed: crossed, childFromFather: o[2] };
      if (!best || (best.crossed && !crossed)) best = cand;
    });
    return best;
  }
  // Steps for the trace animation. Each step: { text, show: { swap, fatherPick, motherPick, childF, childM } }.
  function traceSteps(L, childId) {
    const father = byId(L, 'father'), mother = byId(L, 'mother'), child = byId(L, childId), t = traceChild(father, mother, child), n = META[childId].name;
    if (!t) return [{ text: n + ' cannot be made from these parents in this model.', show: {} }];
    if (!t.crossed) return [
      { text: 'The father passes on one whole chromosome: ' + dash(t.fatherGave) + '.', show: { fatherPick: true, childF: true } },
      { text: 'The mother passes on one whole chromosome: ' + dash(t.motherGave) + '.', show: { fatherPick: true, childF: true, motherPick: true, childM: true } },
      { text: n + ' has ' + dash(t.fatherGave) + ' and ' + dash(t.motherGave) + '. No swap is needed: this is the Lakita-style model.', show: { fatherPick: true, childF: true, motherPick: true, childM: true } }];
    return [
      { text: 'The father’s two chromosomes pair up.', show: {} },
      { text: 'Crossing over: the pair swap their lower pieces, between p53 and BRCA1.', show: { swap: true } },
      { text: 'One of the new chromosomes, ' + dash(t.fatherGave) + ', is passed on to ' + n + '.', show: { swap: true, fatherPick: true, childF: true } },
      { text: 'The mother passes on ' + dash(t.motherGave) + '.', show: { swap: true, fatherPick: true, childF: true, motherPick: true, childM: true } },
      { text: n + ' has ' + dash(t.fatherGave) + ' and ' + dash(t.motherGave) + '. ' + dash(t.fatherGave) + ' is on neither parent’s chromosomes, so crossing over in the father made it.', show: { swap: true, fatherPick: true, childF: true, motherPick: true, childM: true } }];
  }
  function readFeedback(L, id, gene, pick) {
    const t = truth(L, id)[gene], where = gene === 'p53' ? 'top spots (p53)' : 'bottom spots (BRCA1)', n = META[id].name;
    if (pick === t) return { ok: true, text: 'Yes. ' + n + ' has ' + (gene === 'p53' ? 'p53 ' : 'BRCA1 ') + t + '.' };
    return { ok: false, text: 'Not quite. Look at the ' + where + ' on both chromosomes of ' + n + '.' };
  }
  function carrierFeedback(L, id) {
    const p = byId(L, id), n = META[id].name, a = alleles(p);
    if (hasBoth(p)) return { ok: true, text: 'Yes. ' + n + ' has B (p53) and D (BRCA1): both risk alleles, on one chromosome. A model of risk, not a prediction.' };
    const risky = a.filter(function (x) { return x === 'B' || x === 'D'; });
    return { ok: false, text: 'Not this one. ' + n + ' has ' + a.join(', ') + (risky.length ? ': only ' + risky[0] + '. Look for both B and D.' : ': no risk alleles. Look for both B and D.') };
  }
  function mixFeedback(L, id) {
    const father = byId(L, 'father'), mother = byId(L, 'mother'), p = byId(L, id), n = META[id].name;
    if (!p.parents) return { ok: null, text: 'Tap a child to check.' };
    const whole = L.explainedWithoutCrossing(father, mother, p), t = traceChild(father, mother, p);
    if (whole) return { ok: false, text: 'Not this one. ' + n + ' got a whole chromosome from each parent: ' + p.chromosomes.map(dash).join(' and ') + '.' };
    const odd = p.chromosomes.find(function (c) { return !father.chromosomes.some(function (f) { return sameChr(f, c); }) && !mother.chromosomes.some(function (m) { return sameChr(m, c); }); });
    return { ok: true, text: 'Yes. ' + (odd ? dash(odd) : 'One chromosome') + ' matches neither parent’s chromosomes' + (t && t.crossed ? ', so a swap (crossing over) in the father is needed.' : '.') };
  }
  const expectedCarrier = L => IDS.filter(function (id) { return hasBoth(byId(L, id)); });
  const expectedMismatch = L => IDS.filter(function (id) { const p = byId(L, id); return p.parents && !L.explainedWithoutCrossing(byId(L, 'father'), byId(L, 'mother'), p); });
  const CONCLUSION = 'Children 2 and 3 each have a chromosome that neither parent has (B–C and A–D). A swap between the two chromosomes of a pair (crossing over) in the father can make them. Child 1 needs no swap.';
  function ariaLabel(L, id, confirmed) {
    const p = byId(L, id), t = truth(L, id), r = risk(L, id);
    return META[id].name + ', ' + (p.sex === 'M' ? 'male' : 'female') + ', chromosomes ' + wholeText(p) + ', p53 ' + t.p53 + ', BRCA1 ' + t.brca1 + ', chance of cancer in the model: ' + r.text + (confirmed ? ', genotype read' : '');
  }
  function describe(L, st) {
    const s = st || {};
    let t = 'Text description: the father has one chromosome with p53 A and BRCA1 C, and one with p53 B and BRCA1 D (highest likelihood). The mother has A–C on both. Child 1 has A–C and A–C (lowest). Child 2 has B–C and A–C (medium). Child 3 has A–D and A–C (medium).';
    const read = Object.keys(s.genotypes || {});
    if (read.length) t += ' You have read ' + read.length + ' of 5 people.';
    if (s.carrier) t += ' You found that the ' + META[s.carrier].name.toLowerCase() + ' has both risk alleles.';
    if ((s.mismatch || []).length === 2) t += ' You found the two children with a chromosome that matches neither parent.';
    return t;
  }
  function navigate(from, key) {
    const r = ROWS.findIndex(function (row) { return row.includes(from); });
    if (r < 0) return from;
    const row = ROWS[r], i = row.indexOf(from);
    if (key === 'ArrowLeft') return row[Math.max(0, i - 1)];
    if (key === 'ArrowRight') return row[Math.min(row.length - 1, i + 1)];
    if (key === 'Home') return row[0];
    if (key === 'End') return row[row.length - 1];
    const dr = key === 'ArrowUp' ? -1 : key === 'ArrowDown' ? 1 : 0;
    if (!dr || !ROWS[r + dr]) return from;
    return ROWS[r + dr].slice().sort(function (a, b) { return Math.abs(META[a].x - META[from].x) - Math.abs(META[b].x - META[from].x); })[0];
  }
  // Clean saved state against the lesson's truth, so a damaged save cannot show wrong marks.
  function cleanState(L, saved) {
    const s = saved || {}, out = { genotypes: {}, carrier: null, mismatch: [], traced: {} };
    IDS.forEach(function (id) {
      const g = s.genotypes && s.genotypes[id], t = truth(L, id);
      if (g && g.p53 === t.p53 && g.brca1 === t.brca1) out.genotypes[id] = { p53: t.p53, brca1: t.brca1 };
      if (s.traced && s.traced[id] === true && byId(L, id).parents) out.traced[id] = true;
    });
    if (expectedCarrier(L).includes(s.carrier)) out.carrier = s.carrier;
    const em = expectedMismatch(L); out.mismatch = (Array.isArray(s.mismatch) ? s.mismatch : []).filter(function (id, i, a) { return em.includes(id) && a.indexOf(id) === i; });
    return out;
  }
  const pure = { META, ROWS, IDS, P53, BRCA, MODES, recombinants, traceChild, traceSteps, readFeedback, carrierFeedback, mixFeedback, expectedCarrier, expectedMismatch,
    CONCLUSION, ariaLabel, describe, navigate, cleanState, dash, levelOf };

  /* ---------- the scene ---------- */
  const NS = 'http://www.w3.org/2000/svg';
  const ALLELE_VAR = { A: '--s3', B: '--s2', C: '--s5', D: '--s4' };
  const CSS = '.tg-ui{display:grid;gap:10px}.tg-steps{display:flex;flex-wrap:wrap;gap:8px}' +
    '.tg-steps button{font:inherit;font-weight:600;font-size:.9rem;min-height:40px;padding:6px 12px;border:1px solid var(--line);border-radius:var(--r-sm);background:var(--surface);color:var(--ink);cursor:pointer}' +
    '.tg-steps button[aria-pressed=true]{background:var(--accent-soft);border-color:var(--accent);box-shadow:inset 0 -3px 0 var(--accent)}' +
    '.tg-figure{border:1px solid var(--line);border-radius:var(--r);background:var(--surface-2);padding:2px}' +
    'svg.tg-svg,svg.tg-trace{display:block;width:100%;height:auto;margin:0 auto;touch-action:manipulation}svg.tg-svg{max-width:760px;aspect-ratio:' + VIEW_W + '/' + VIEW_H + '}svg.tg-trace{max-width:600px;aspect-ratio:440/292}' +
    '.tg-svg text,.tg-trace text{font-family:var(--f-body);fill:var(--ink);font-size:21px;font-weight:600}.tg-svg .tg-gene{fill:var(--muted);font-style:italic;font-weight:600;font-size:21px}' +
    '.tg-svg .tg-line,.tg-trace .tg-line{stroke:var(--ink);stroke-width:2.5;fill:none}' +
    '.tg-svg .tg-sym{stroke:var(--ink);stroke-width:2.5}.tg-svg .tg-hit{fill:transparent;cursor:pointer}.tg-svg .tg-ring{fill:none;stroke:var(--accent);stroke-width:4;opacity:0}' +
    '.tg-person{outline:none;cursor:pointer}.tg-person:focus-visible .tg-ring{opacity:1}.tg-person.is-sel .tg-ring{opacity:1;stroke-dasharray:7 4}.tg-person.is-sel:focus-visible .tg-ring{stroke-dasharray:0}' +
    '.tg-svg .tg-chr{fill:var(--surface);stroke:var(--ink);stroke-width:2}.tg-svg .tg-chr.is-new{stroke:var(--accent);stroke-width:4;stroke-dasharray:5 3}' +
    '.tg-svg .tg-badge{fill:var(--surface);stroke:var(--line);stroke-width:1.5}.tg-svg .tg-badge.ok{fill:var(--ok-soft);stroke:var(--ok)}' +
    '.tg-svg .tg-mark.ok{fill:var(--ok);stroke:none}.tg-svg .tg-mark.bad{fill:var(--bad);stroke:none}.tg-svg .tg-markt{fill:var(--bg);font-size:20px;font-weight:700;text-anchor:middle}' +
    '.tg-legend{display:flex;flex-wrap:wrap;gap:6px 16px;align-items:center;margin:0;font-size:.88rem;color:var(--muted)}.tg-legend span{display:inline-flex;gap:6px;align-items:center;color:var(--ink)}' +
    '.tg-panel{border:1px solid var(--line);border-radius:var(--r);background:var(--surface);padding:12px 14px;display:grid;gap:8px;align-content:start;min-height:210px}' +
    '.tg-panel h4{margin:0;font-size:1.02rem}.tg-ask{margin:0;font-weight:700}.tg-msg{margin:0;font-weight:600;min-height:2.8em}.tg-msg[data-state=ok]{color:var(--ok)}.tg-msg[data-state=bad]{color:var(--bad)}' +
    '.tg-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}.tg-row>b{min-width:5.2em}.tg-chip{font:inherit;min-width:76px;min-height:44px;padding:6px 12px;border:2px solid var(--line);border-radius:var(--r-sm);background:var(--surface);color:var(--ink);cursor:pointer;font-family:var(--f-mono);font-weight:700;font-size:1.05rem}' +
    '.tg-chip[aria-pressed=true]{border-color:var(--accent);background:var(--accent-soft)}.tg-chip.ok{border-color:var(--ok);background:var(--ok-soft)}.tg-chip.bad{border-color:var(--bad);background:var(--bad-soft)}.tg-chip:hover{border-color:var(--accent)}' +
    '.tg-actions{display:flex;flex-wrap:wrap;gap:8px;align-items:center}.tg-note{margin:0;font-size:.84rem;color:var(--muted)}' +
    '.tg-trace .tg-piece{transition:none}.tg-trace .tg-fade{transition:none}' +
    '@media (prefers-reduced-motion:no-preference){.tg-trace .tg-piece{transition:transform .7s ease}.tg-trace .tg-fade{transition:opacity .5s ease}.tg-svg .tg-ring{transition:opacity .15s}}' +
    '@media (max-width:480px){.tg-steps button{flex:1 1 44%}.tg-chip{min-width:64px;flex:1 1 64px}}';

  function mount(host, api) {
    const L = api.logic;
    const desc = host.querySelector('.scene-desc'), canvas = host.querySelector('canvas');
    if (!L || !desc) throw new Error('two-gene scene: host is incomplete');
    if (!document.getElementById('tg-scene-css')) { const st = document.createElement('style'); st.id = 'tg-scene-css'; st.textContent = CSS; document.head.appendChild(st); }
    const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
    const svgEl = (tag, attrs, parent) => { const e = document.createElementNS(NS, tag); Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); }); if (parent) parent.appendChild(e); return e; };
    const mqReduce = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

    let data = cleanState(L, api.getState().twoGene);
    let playing = false, animSwap = false, mode = 'read', sel = null, tabStop = 'father', picks = {}, marks = {}, msgText = '', msgState = '', traceChildId = null, tstep = 0, timer = 0;
    IDS.forEach(function (id) { if (data.genotypes[id]) picks[id] = { p53: data.genotypes[id].p53, brca1: data.genotypes[id].brca1 }; });
    function persist() { api.saveState('twoGene', { genotypes: data.genotypes, carrier: data.carrier, mismatch: data.mismatch, traced: data.traced, updatedAt: Date.now() }); }

    /* skeleton */
    const ui = el('div', 'tg-ui');
    const steps = el('div', 'tg-steps'); steps.setAttribute('role', 'group'); steps.setAttribute('aria-label', 'Activity');
    const modeBtns = {};
    MODES.forEach(function (m) { const b = el('button', '', m[1]); b.type = 'button'; b.addEventListener('click', function () { setMode(m[0]); }); steps.appendChild(b); modeBtns[m[0]] = b; });
    const fig = el('div', 'tg-figure');
    const svg = svgEl('svg', { class: 'tg-svg', viewBox: '0 0 ' + VIEW_W + ' ' + VIEW_H, role: 'group', 'aria-label': 'Two-gene pedigree: a father, a mother and three children, each drawn as a pair of chromosomes with p53 above BRCA1. Use the arrow keys to move between people.' });
    fig.appendChild(svg);
    const legend = el('p', 'tg-legend');
    const panel = el('div', 'tg-panel');
    const foot = el('p', 'tg-note', 'A learning model, not a prediction for any person. Risk alleles raise the chance of cancer; they do not mean someone will get it.');
    ui.append(steps, fig, legend, panel, foot);
    if (canvas) canvas.remove();
    host.insertBefore(ui, desc);

    /* defs: shading levels (pattern + word, not colour alone) and the origin patterns of the trace */
    const defs = svgEl('defs', {}, svg);
    function hatch(id, spacing, w, bg, fg) { const p = svgEl('pattern', { id: id, width: spacing, height: spacing, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, defs); svgEl('rect', { width: spacing, height: spacing, fill: bg }, p); if (w) svgEl('line', { x1: 0, y1: 0, x2: 0, y2: spacing, stroke: fg, 'stroke-width': w }, p); }
    hatch('tg-lvl2', 9, 2, 'var(--accent-soft)', 'var(--accent)');
    hatch('tg-lvl3', 6, 3.5, 'var(--accent-soft)', 'var(--accent)');
    hatch('tg-o2', 7, 2.5, 'var(--warn-soft)', 'var(--warn)');
    const FILL = { 1: 'var(--surface)', 2: 'url(#tg-lvl2)', 3: 'url(#tg-lvl3)' };
    const swatch = (lvl, word) => { const s = el('span'); s.innerHTML = '<svg width="26" height="20" viewBox="0 0 26 20" aria-hidden="true" focusable="false"><rect x="1.5" y="1.5" width="23" height="17" rx="3" fill="' + FILL[lvl] + '" stroke="currentColor" stroke-width="2"/></svg>'; s.appendChild(document.createTextNode(word)); return s; };
    legend.append(el('span', '', 'Chance of cancer in the model:'), swatch(1, 'Lower'), swatch(2, 'Medium'), swatch(3, 'Higher'));

    /* chromosome icons */
    const BW = 16, BH = 78;
    function chromPair(parent, cx, top, chroms, newIdx) {
      chroms.forEach(function (c, i) {
        const x = cx + (i ? 17 : -17);
        svgEl('rect', { class: 'tg-chr' + (newIdx === i ? ' is-new' : ''), x: x - BW / 2, y: top, width: BW, height: BH, rx: 8 }, parent);
        [[top + 14, c[0]], [top + 50, c[1]]].forEach(function (b) {
          svgEl('rect', { x: x - BW / 2 + 1, y: b[0], width: BW - 2, height: 13, fill: 'var(' + ALLELE_VAR[b[1]] + ')', stroke: (b[1] === 'B' || b[1] === 'D') ? 'var(--ink)' : 'none', 'stroke-width': 2 }, parent);
          const t = svgEl('text', { x: x + (i ? 1 : -1) * 34, y: b[0] + 11, 'text-anchor': 'middle' }, parent); t.textContent = b[1];
        });
      });
    }
    const gl = (y, text) => { const t = svgEl('text', { class: 'tg-gene', x: 4, y: y }, svg); t.textContent = text; t.setAttribute('aria-hidden', 'true'); };
    gl(17 + 25, 'p53'); gl(17 + 61, 'BRCA1'); gl(270 + 25, 'p53'); gl(270 + 61, 'BRCA1');
    // pedigree lines
    const M = META, half = S / 2, line = (x1, y1, x2, y2) => svgEl('path', { class: 'tg-line', d: 'M' + x1 + ' ' + y1 + ' L' + x2 + ' ' + y2 }, svg);
    const midx = (M.father.x + M.mother.x) / 2;
    line(M.father.x + half, M.father.y, M.mother.x - half, M.mother.y);
    line(midx, M.father.y, midx, 170); line(M.child1.x, 170, M.child3.x, 170);
    ['child1', 'child2', 'child3'].forEach(function (id) { line(M[id].x, 170, M[id].x, M[id].y - half); });
    const els = {};
    function drawPerson(p) {
      const m = M[p.id], g = svgEl('g', { class: 'tg-person', role: 'button', tabindex: '-1', 'data-person': p.id, 'data-sex': p.sex === 'M' ? 'male' : 'female', 'data-level': String(levelOf(risk(L, p.id))) }, svg);
      const top = m.y - half - 8, hitH = (m.row === 0 ? 100 : 232);
      const hx0 = Math.min(m.x - 54, m.pair[0] - 52), hx1 = Math.max(m.x + 54, m.pair[0] + 52);
      svgEl('rect', { class: 'tg-hit', x: hx0, y: top, width: hx1 - hx0, height: hitH }, g);
      if (p.sex === 'M') svgEl('rect', { class: 'tg-ring', x: m.x - half - 7, y: m.y - half - 7, width: S + 14, height: S + 14, rx: 5 }, g); else svgEl('circle', { class: 'tg-ring', cx: m.x, cy: m.y, r: half + 8 }, g);
      const lvl = levelOf(risk(L, p.id));
      const sym = p.sex === 'M' ? svgEl('rect', { x: m.x - half, y: m.y - half, width: S, height: S }, g) : svgEl('circle', { cx: m.x, cy: m.y, r: half }, g);
      sym.setAttribute('class', 'tg-sym'); sym.setAttribute('fill', FILL[lvl]);
      const dyn = svgEl('g', { class: 'tg-dyn' }, g);
      els[p.id] = { g: g, dyn: dyn, sym: sym };
      g.addEventListener('click', function () { tap(p.id, false); });
      g.addEventListener('focus', function () { tabStop = p.id; setTabs(); });
      g.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tap(p.id, true); return; }
        if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) { e.preventDefault(); const to = navigate(p.id, e.key); tabStop = to; setTabs(); els[to].g.focus(); }
      });
    }
    L.TWO_GENE.persons.forEach(drawPerson);
    function setTabs() { IDS.forEach(function (id) { els[id].g.setAttribute('tabindex', id === tabStop ? '0' : '-1'); }); }
    function drawDyn(id) {
      const p = byId(L, id), m = M[id], dyn = els[id].dyn, odd = data.mismatch.includes(id) ? oddIndex(id) : -1;
      dyn.replaceChildren();
      chromPair(dyn, m.pair[0], m.pair[1], p.chromosomes, odd);
      const ly = m.row === 0 ? m.y + half + 24 : m.pair[1] + BH + 28, by = ly + 24;
      const lab = svgEl('text', { x: m.x, y: ly, 'text-anchor': 'middle' }, dyn); lab.textContent = m.name;
      const g = data.genotypes[id];
      if (g) {
        const txt = '✓ ' + g.p53 + ' · ' + g.brca1, w = txt.length * 11 + 16;
        svgEl('rect', { class: 'tg-badge ok', x: m.x - w / 2, y: by - 18, width: w, height: 28, rx: 14 }, dyn);
        const t = svgEl('text', { x: m.x, y: by + 2, 'text-anchor': 'middle' }, dyn); t.textContent = txt;
      } else {
        svgEl('rect', { class: 'tg-badge', x: m.x - 30, y: by - 18, width: 60, height: 28, rx: 14, 'stroke-dasharray': '4 3' }, dyn);
        const t = svgEl('text', { x: m.x, y: by + 2, 'text-anchor': 'middle', style: 'fill:var(--muted);font-weight:500' }, dyn); t.textContent = 'read';
      }
      const mk = marks[id] || (data.carrier === id && mode === 'carrier' ? 'ok' : null) || (data.mismatch.includes(id) && mode === 'mix' ? 'ok' : null);
      if (mk) {
        svgEl('circle', { class: 'tg-mark ' + mk, cx: m.x - half - 2, cy: m.y - half - 2, r: 13 }, dyn);
        const t = svgEl('text', { class: 'tg-markt', x: m.x - half - 2, y: m.y - half + 5 }, dyn); t.textContent = mk === 'ok' ? '✓' : '✕';
      }
    }
    function oddIndex(id) {
      const p = byId(L, id), f = byId(L, 'father'), mo = byId(L, 'mother');
      return p.chromosomes.findIndex(function (c) { return !f.chromosomes.some(function (x) { return sameChr(x, c); }) && !mo.chromosomes.some(function (x) { return sameChr(x, c); }); });
    }

    /* panel builders */
    const msgEl = () => { const p = el('p', 'tg-msg', msgText); if (msgState) p.dataset.state = msgState; return p; };
    function say(text, state) { msgText = text; msgState = state || ''; const p = panel.querySelector('.tg-msg'); if (p) { p.textContent = text; if (state) p.dataset.state = state; else delete p.dataset.state; } api.announce(text); }
    function renderPanel(focusFirst) {
      panel.replaceChildren();
      if (mode === 'read') return panelRead(focusFirst);
      if (mode === 'carrier') {
        panel.append(el('p', 'tg-ask', 'Tap the person who has both risk alleles: B (p53) and D (BRCA1).'), msgEl());
        if (data.carrier && !msgText) say('Found: the ' + META[data.carrier].name.toLowerCase() + ' has both risk alleles.', 'ok');
        return;
      }
      if (mode === 'mix') {
        panel.append(el('p', 'tg-ask', 'Tap every child who got a chromosome that matches neither parent’s.'),
          el('p', 'tg-note', 'Parents’ chromosomes: father ' + wholeText(byId(L, 'father')) + '; mother ' + wholeText(byId(L, 'mother')) + '.'), msgEl());
        if (data.mismatch.length === 2 && !msgText) { msgText = CONCLUSION; msgState = 'ok'; panel.querySelector('.tg-msg').textContent = CONCLUSION; panel.querySelector('.tg-msg').dataset.state = 'ok'; }
        return;
      }
      return panelTrace();
    }
    function panelRead(focusFirst) {
      if (!sel) { panel.append(el('p', 'tg-ask', 'Tap a person, then read their two genes from the chromosomes.'), el('p', 'tg-note', Object.keys(data.genotypes).length + ' of 5 people read.'), msgEl()); return; }
      const p = byId(L, sel), pk = picks[sel] || (picks[sel] = { p53: null, brca1: null }), r = risk(L, sel);
      panel.appendChild(el('h4', '', META[sel].name + ' · ' + (p.sex === 'M' ? 'male' : 'female')));
      [['p53', P53, 'p53'], ['brca1', BRCA, 'BRCA1']].forEach(function (gene) {
        const row = el('div', 'tg-row'); row.setAttribute('role', 'group'); row.setAttribute('aria-label', gene[2] + ' genotype');
        row.appendChild(el('b', '', gene[2]));
        gene[1].forEach(function (opt) {
          const chosen = pk[gene[0]] === opt, ok = chosen && opt === truth(L, sel)[gene[0]];
          const b = el('button', 'tg-chip' + (chosen ? (ok ? ' ok' : ' bad') : '')); b.type = 'button'; b.dataset.gene = gene[0]; b.dataset.genotype = opt;
          b.textContent = (chosen ? (ok ? '✓ ' : '✕ ') : '') + opt; b.setAttribute('aria-pressed', chosen ? 'true' : 'false');
          b.setAttribute('aria-label', gene[2] + ' ' + opt + (chosen ? (ok ? ', correct' : ', not right') : ''));
          b.addEventListener('click', function () { pickGene(gene[0], opt); });
          row.appendChild(b);
        });
        panel.appendChild(row);
      });
      panel.appendChild(msgEl());
      if (data.genotypes[sel]) panel.appendChild(el('p', 'tg-note', 'Chance of cancer in the model: ' + r.text + ' (p53 ' + data.genotypes[sel].p53 + ' with BRCA1 ' + data.genotypes[sel].brca1 + ').'));
      if (focusFirst) { const f = panel.querySelector('.tg-chip'); if (f) f.focus(); }
    }
    function stopPlay() { if (timer) { clearInterval(timer); timer = 0; } playing = false; }
    function panelTrace() {
      if (!traceChildId) { panel.append(el('p', 'tg-ask', 'Tap a child to see which chromosome each parent passed on.'), msgEl()); return; }
      const hadFocus = panel.contains(document.activeElement);
      const ss = traceSteps(L, traceChildId), last = ss.length - 1, cur = ss[Math.min(tstep, last)];
      panel.appendChild(el('h4', '', META[traceChildId].name + ' · step ' + (tstep + 1) + ' of ' + ss.length));
      panel.appendChild(buildTrace(traceChildId, cur.show));
      animSwap = false;
      panel.appendChild(el('p', 'tg-msg', cur.text));
      const act = el('div', 'tg-actions');
      const back = el('button', 'btn btn--sm', 'Back'), next = el('button', 'btn btn--sm btn--primary', tstep < last ? 'Next' : 'Again');
      const play = el('button', 'btn btn--sm', playing ? 'Stop' : 'Play');
      [back, next].forEach(function (b) { b.type = 'button'; act.appendChild(b); });
      if (!mqReduce.matches) { play.type = 'button'; act.appendChild(play); }
      back.disabled = tstep === 0;
      const go = function (n) { stopPlay(); animSwap = n === tstep + 1; tstep = n; refresh(); const b = panel.querySelector('.tg-actions .btn--primary'); if (b) b.focus(); api.announce(ss[tstep].text); };
      back.addEventListener('click', function () { go(Math.max(0, tstep - 1)); });
      next.addEventListener('click', function () { go(tstep < last ? tstep + 1 : 0); });
      play.addEventListener('click', function () {
        if (playing) { stopPlay(); refresh(); return; }
        stopPlay(); playing = true; tstep = 0; refresh(); api.announce(ss[0].text);
        timer = setInterval(function () {
          tstep++; animSwap = true;
          if (tstep >= last) { stopPlay(); }
          refresh(); api.announce(ss[tstep].text);
        }, 2000);
      });
      panel.appendChild(act);
      if (tstep >= last) markTraced(traceChildId);
      if (hadFocus) { const b = panel.querySelector('.tg-actions button:not(:disabled)'); if (b && !panel.contains(document.activeElement)) b.focus(); }
    }
    function markTraced(id) { if (!id || data.traced[id]) return; data.traced[id] = true; persist(); }

    /* the trace picture: father's pair (with the swap), mother's pair, the child's pair */
    function buildTrace(childId, show) {
      const father = byId(L, 'father'), mother = byId(L, 'mother'), child = byId(L, childId), t = traceChild(father, mother, child);
      const sv = svgEl('svg', { class: 'tg-trace', viewBox: '0 0 440 292', role: 'img', focusable: 'false' });
      sv.setAttribute('aria-label', META[childId].name + ' trace. Father ' + wholeText(father) + (show.swap ? ', after crossing over: ' + recombinants(father).map(dash).join(' and ') : '') +
        '; mother ' + wholeText(mother) + '; the child has ' + wholeText(child) + '.');
      const d = svgEl('defs', {}, sv), pp = svgEl('pattern', { id: 'tg-o2t', width: 7, height: 7, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, d);
      svgEl('rect', { width: 7, height: 7, fill: 'var(--warn-soft)' }, pp); svgEl('line', { x1: 0, y1: 0, x2: 0, y2: 7, stroke: 'var(--warn)', 'stroke-width': 2.5 }, pp);
      svgEl('marker', { id: 'tg-arr', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, d).appendChild(svgEl('path', { d: 'M0 0 L10 5 L0 10 z', fill: 'var(--accent)' }));
      const W = 30, H = 84, HALF = 42, R = 15;
      const ORIGIN = { f0: 'var(--accent-soft)', f1: 'url(#tg-o2t)', m: 'var(--surface-2)' };
      function piece(g, x, top, kind, allele, origin) { // kind 'top' or 'bot'
        const pg = svgEl('g', { class: 'tg-piece' }, g);
        const y0 = kind === 'top' ? top : top + HALF;
        const d = kind === 'top' ? 'M' + (x - W / 2) + ' ' + (y0 + HALF) + ' V' + (y0 + R) + ' A' + R + ' ' + R + ' 0 0 1 ' + (x + W / 2) + ' ' + (y0 + R) + ' V' + (y0 + HALF) + ' Z'
          : 'M' + (x - W / 2) + ' ' + y0 + ' V' + (y0 + HALF - R) + ' A' + R + ' ' + R + ' 0 0 0 ' + (x + W / 2) + ' ' + (y0 + HALF - R) + ' V' + y0 + ' Z';
        svgEl('path', { d: d, fill: ORIGIN[origin], stroke: 'none' }, pg);
        const by = y0 + (HALF - 26) / 2 + (kind === 'top' ? 3 : -3);
        svgEl('rect', { x: x - W / 2 + 2, y: by, width: W - 4, height: 26, rx: 4, fill: 'var(--surface)', stroke: 'var(' + ALLELE_VAR[allele] + ')', 'stroke-width': (allele === 'B' || allele === 'D') ? 4 : 2.5 }, pg);
        const tx = svgEl('text', { x: x, y: by + 20, 'text-anchor': 'middle' }, pg); tx.textContent = allele;
        return pg;
      }
      const outline = (g, x, top, hl) => svgEl('rect', { x: x - W / 2, y: top, width: W, height: H, rx: R, fill: 'none', stroke: hl ? 'var(--accent)' : 'var(--ink)', 'stroke-width': hl ? 5 : 2.5 }, g);
      // father: slots at x = 60 and 110
      const fx = [60, 110], ftop = 24, g1 = svgEl('g', {}, sv);
      const pieces = [];
      father.chromosomes.forEach(function (c, i) { pieces.push({ top: piece(g1, fx[i], ftop, 'top', c[0], 'f' + i), bot: piece(g1, fx[i], ftop, 'bot', c[1], 'f' + i) }); });
      // The lower pieces trade places. When the student has just arrived at this step they start un-swapped and slide over
      // on the next frame; with reduced motion (or when going back and forth) the swapped state is drawn at once.
      const doSwap = function () { pieces[0].bot.style.transform = 'translateX(' + (fx[1] - fx[0]) + 'px)'; pieces[1].bot.style.transform = 'translateX(' + (fx[0] - fx[1]) + 'px)'; };
      if (show.swap) { if (animSwap && !mqReduce.matches) requestAnimationFrame(function () { requestAnimationFrame(doSwap); }); else doSwap(); }
      const picked = t && show.fatherPick ? t.fatherIndex : -1;
      fx.forEach(function (x, i) { outline(g1, x, ftop, picked === i); });
      if (show.swap && !show.fatherPick) { svgEl('path', { d: 'M40 ' + (ftop + HALF) + ' H130', stroke: 'var(--accent)', 'stroke-width': 2.5, 'stroke-dasharray': '5 4', fill: 'none' }, sv); const tt = svgEl('text', { x: 140, y: ftop + HALF + 6, fill: 'var(--accent)' }, sv); tt.textContent = 'swap'; }
      const fl = svgEl('text', { x: 85, y: 136, 'text-anchor': 'middle' }, sv); fl.textContent = 'Father';
      // mother: slots at x = 60 and 110, top 168
      const mtop = 168, g2 = svgEl('g', {}, sv);
      mother.chromosomes.forEach(function (c, i) { piece(g2, fx[i], mtop, 'top', c[0], 'm'); piece(g2, fx[i], mtop, 'bot', c[1], 'm'); });
      fx.forEach(function (x, i) { outline(g2, x, mtop, t && show.motherPick && t.motherIndex === i); });
      const ml = svgEl('text', { x: 85, y: 280, 'text-anchor': 'middle' }, sv); ml.textContent = 'Mother';
      // child: slots at x = 400 (from father) and 450 (from mother), top 96
      const cx = [330, 382], ctop = 96, g3 = svgEl('g', {}, sv);
      const fOrigin = t ? (t.crossed ? null : 'f' + t.fatherIndex) : null;
      [[0, t && t.fatherGave, show.childF], [1, t && t.motherGave, show.childM]].forEach(function (s) {
        const i = s[0], chr = s[1], on = !!s[2], grp = svgEl('g', { class: 'tg-fade', style: 'opacity:' + (on ? 1 : 0.25) }, g3);
        if (chr && on) {
          const topO = i === 1 ? 'm' : (t.crossed ? 'f' + (t.fatherIndex === 0 ? 0 : 1) : fOrigin), botO = i === 1 ? 'm' : (t.crossed ? 'f' + (t.fatherIndex === 0 ? 1 : 0) : fOrigin);
          piece(grp, cx[i], ctop, 'top', chr[0], topO); piece(grp, cx[i], ctop, 'bot', chr[1], botO);
        }
        svgEl('rect', { x: cx[i] - W / 2, y: ctop, width: W, height: H, rx: R, fill: 'none', stroke: 'var(--ink)', 'stroke-width': 2.5, 'stroke-dasharray': on ? '0' : '5 4' }, grp);
        const tag = svgEl('text', { x: cx[i], y: ctop - 8, 'text-anchor': 'middle', style: 'font-size:18px' }, g3); tag.textContent = i ? 'M' : 'F';
      });
      const cl = svgEl('text', { x: 356, y: 208, 'text-anchor': 'middle' }, sv); cl.textContent = META[childId].name;
      const cs = svgEl('text', { x: 356, y: 232, 'text-anchor': 'middle', style: 'font-size:17px;font-weight:500;fill:var(--muted)' }, sv); cs.textContent = 'F = father, M = mother';
      // arrows
      if (t && show.fatherPick) svgEl('path', { d: 'M' + (fx[t.fatherIndex] + W / 2 + 6) + ' ' + (ftop + HALF) + ' C 200 ' + (ftop + HALF) + ' 250 ' + (ctop + HALF) + ' ' + (cx[0] - W / 2 - 8) + ' ' + (ctop + HALF), fill: 'none', stroke: 'var(--accent)', 'stroke-width': 3, 'marker-end': 'url(#tg-arr)' }, sv);
      if (t && show.motherPick) svgEl('path', { d: 'M' + (fx[t.motherIndex] + W / 2 + 6) + ' ' + (mtop + HALF) + ' C 200 ' + (mtop + HALF) + ' 250 ' + (ctop + HALF + 20) + ' ' + (cx[1] - W / 2 - 8) + ' ' + (ctop + HALF + 20), fill: 'none', stroke: 'var(--accent)', 'stroke-width': 3, 'marker-end': 'url(#tg-arr)' }, sv);
      return sv;
    }

    /* actions */
    function setMode(m) {
      stopPlay(); mode = m; marks = {}; msgText = ''; msgState = ''; tstep = 0; animSwap = false;
      if (m === 'trace' && sel && byId(L, sel).parents) traceChildId = sel;
      refresh(); api.announce(MODES.find(function (x) { return x[0] === m; })[1] + '.');
    }
    function tap(id, focusFirst) {
      sel = id; tabStop = id;
      if (mode === 'read') { msgText = ''; msgState = ''; refresh(focusFirst); api.announce(META[id].name + ' selected. Read the two genes.'); return; }
      if (mode === 'carrier') {
        const r = carrierFeedback(L, id); marks = {}; marks[id] = r.ok ? 'ok' : 'bad';
        if (r.ok && data.carrier !== id) { data.carrier = id; persist(); }
        msgText = r.text; msgState = r.ok ? 'ok' : 'bad'; refresh(); api.announce(r.text); return;
      }
      if (mode === 'mix') {
        const r = mixFeedback(L, id); marks = {}; if (r.ok === null) { msgText = r.text; msgState = ''; refresh(); api.announce(r.text); return; }
        marks[id] = r.ok ? 'ok' : 'bad';
        if (r.ok && !data.mismatch.includes(id)) { data.mismatch = data.mismatch.concat(id).sort(); persist(); }
        const all = data.mismatch.length === expectedMismatch(L).length;
        msgText = r.ok && all ? r.text + ' ' + CONCLUSION : r.text; msgState = r.ok ? 'ok' : 'bad'; refresh(); api.announce(msgText); return;
      }
      // trace
      if (!byId(L, id).parents) { msgText = 'Tap a child to trace its chromosomes.'; traceChildId = null; refresh(); api.announce(msgText); return; }
      stopPlay(); traceChildId = id; tstep = 0; animSwap = false; msgText = ''; refresh(); api.announce(META[id].name + ' selected. ' + traceSteps(L, id)[0].text);
    }
    function pickGene(gene, opt) {
      const pk = picks[sel], f = readFeedback(L, sel, gene, opt); pk[gene] = opt;
      const t = truth(L, sel), both = pk.p53 === t.p53 && pk.brca1 === t.brca1;
      if (both) {
        data.genotypes[sel] = { p53: t.p53, brca1: t.brca1 }; persist();
        const r = risk(L, sel); msgText = 'Yes! ' + META[sel].name + ': p53 ' + t.p53 + ', BRCA1 ' + t.brca1 + '. Chance of cancer in the model: ' + r.text + '.'; msgState = 'ok';
      } else { if (data.genotypes[sel]) { delete data.genotypes[sel]; persist(); } msgText = f.text; msgState = f.ok ? 'ok' : 'bad'; if (f.ok) msgText += ' Now read the other gene.'; }
      refresh();
      const chip = panel.querySelector('.tg-chip[data-gene="' + gene + '"][data-genotype="' + opt + '"]'); if (chip) chip.focus();
      api.announce(msgText);
    }
    function refresh(focusFirst) {
      MODES.forEach(function (m) { modeBtns[m[0]].setAttribute('aria-pressed', mode === m[0] ? 'true' : 'false'); });
      IDS.forEach(function (id) {
        const e = els[id];
        e.g.setAttribute('aria-label', ariaLabel(L, id, !!data.genotypes[id]));
        e.g.classList.toggle('is-sel', sel === id && (mode === 'read' || mode === 'trace'));
        e.g.setAttribute('aria-pressed', sel === id && (mode === 'read' || mode === 'trace') ? 'true' : 'false');
        drawDyn(id);
      });
      desc.textContent = describe(L, data);
      setTabs(); renderPanel(focusFirst);
    }
    refresh();
  }
  return { pure: pure, mount: mount };
});
