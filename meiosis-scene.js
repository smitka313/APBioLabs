/* Scene 3 of the Lessons 8-9 companion: meiosis and crossing over (host #meiosis-scene, id 'meiosis').
   Contract: docs/b3-inheritance-scenes.md. Pure logic is in the UMD wrapper (module.exports for Node tests, window.B3MeiosisLogic in the page).

   WHAT THIS MODEL SHOWS (assumptions, also stated for students in the page's "What this simulation models" style notes)
   - One cell, one pair of matching chromosomes followed (blue, and orange with hatching) plus a second pair drawn only for scale. A human
     cell has 23 pairs and eggs and sperm get 23 chromosomes. Following one pair keeps the lesson's result: two kinds of gametes without
     crossing over, four kinds with it (Lesson 8 exit ticket Q1).
   - The parent chromosomes are A-C and B-D: p53 allele A or B on top, BRCA1 allele C or D below (A fixes mutations, B does not;
     C lower risk, D higher). Copying mistakes (mutations) are left out. The reading says crossing over is a swap between the two
     chromosomes of a pair; here one swap falls between the two genes, so a copy of each chromosome gets the other chromosome's lower section.
   - Divisions follow the reading: DNA copied, chromosomes pair and can swap, the cell divides, the two cells divide again without copying.
   - Animation (steps 1-6) is always the same picture. The "make 10 gametes" tally is where distance matters: the chance that a gamete is a
     NEW combination is the Haldane recombinant percent (logic.recombinantPercent), never above 50 percent, and 0 with crossing over off.
     That is an illustration: real rates differ by region and by person, and the lesson gives no p53-BRCA1 rate. Each gamete in the tally
     comes from its own cell (one gamete per meiosis), drawn with api.rng, so a Dataset ID always makes the same tally.
   - Map distances for the exit-ticket picture: the picture's chromosome is 480 units long, taken as 100 map units, so a-b is about 9,
     a-c about 42 and a-d about 73. Positions in the exit-ticket figure were not visible in the source; the page draws a-b close.
   Saved state: meiosis = { runs:[{ crossing, parent, gametes, at, kind:'animation'|'tally', distanceCM }], distanceCM, updatedAt }
   (an animation run has four gametes, a tally run ten). */
(function (root, factory) {
  const M = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = M.logic;
  else { root.B3MeiosisLogic = M.logic; (root.B3InhScenes = root.B3InhScenes || []).push({ id: 'meiosis', mount: M.mount }); }
})(typeof self !== 'undefined' ? self : this, function (root) {
  'use strict';
  const NODE = typeof module === 'object' && module.exports;
  const BASE = NODE ? require('./openscied-b3-inheritance-logic.js') : root.B3InheritanceLogic;

  /* ---------- pure logic ---------- */
  const PARENTS = [['AC', 'BD'], ['AD', 'BC'], ['AC', 'AD']];
  const ALL_TYPES = ['AC', 'AD', 'BC', 'BD'];
  const DIST_MIN = 2, DIST_MAX = 100, DIST_DEFAULT = 9;
  // Exit-ticket picture: genes a, b, c, d at x = 96, 138, 296, 446 on a 480-unit chromosome taken as 100 map units.
  const PICTURE_X = { a: 96, b: 138, c: 296, d: 446 };
  const mapUnits = (p, q) => Math.round(Math.abs(PICTURE_X[q] - PICTURE_X[p]) / 4.8);
  const EXIT_PAIRS = ['ab', 'ac', 'ad'].map(id => ({ id, label: id[0] + ' and ' + id[1], cM: mapUnits(id[0], id[1]) }));
  const clampDist = x => { const n = Number(x); return isFinite(n) ? Math.max(DIST_MIN, Math.min(DIST_MAX, Math.round(n))) : DIST_DEFAULT; };
  const sortedKinds = list => Array.from(new Set(list)).sort();
  // The four gametes of one meiosis, in cell order: chromosome 1, its copy (swapped lower part), chromosome 2's copy, chromosome 2.
  function animationGametes(parent, crossing) {
    const x = parent[0], y = parent[1];
    return crossing ? [x, x[0] + y[1], y[0] + x[1], y] : [x, x, y, y];
  }
  const isParental = (g, parent) => g === parent[0] || g === parent[1];
  const recombinantTypes = parent => [parent[0][0] + parent[1][1], parent[1][0] + parent[0][1]].filter(g => !isParental(g, parent));
  const newPercent = (crossing, cM) => crossing ? BASE.recombinantPercent(cM) : 0;
  const togetherPercent = cM => 100 - BASE.recombinantPercent(cM);
  // n gametes, each from its own cell. rng: Lab.rng-style object with uniform().
  function sampleGametes(rng, n, parent, crossing, cM) {
    const r = newPercent(crossing, cM) / 100, out = [], x = parent[0], y = parent[1];
    for (let i = 0; i < n; i++) {
      const swap = rng.uniform() < r, first = rng.uniform() < 0.5;
      out.push(swap ? (first ? x[0] + y[1] : y[0] + x[1]) : (first ? x : y));
    }
    return out;
  }
  function tally(gametes, parent) {
    const counts = {}; ALL_TYPES.forEach(t => { counts[t] = 0; });
    (gametes || []).forEach(g => { counts[g] = (counts[g] || 0) + 1; });
    const total = (gametes || []).length, parental = (gametes || []).filter(g => isParental(g, parent)).length;
    return { counts, total, parental, fresh: total - parental, kinds: sortedKinds(gametes || []) };
  }
  // Compare a student's tapped gametes with what the parent can make.
  function checkPick(parent, crossing, picks) {
    const can = BASE.gameteTypes(parent, crossing), got = sortedKinds(picks || []);
    const missing = can.filter(g => !got.includes(g)), extra = got.filter(g => !can.includes(g));
    const same = sortedKinds(BASE.gameteTypes(parent, true)).join() === sortedKinds(BASE.gameteTypes(parent, false)).join();
    if (!got.length) return { status: 'empty', missing, extra, can, message: 'Tap the gametes this parent can make, then press Check.' };
    if (!missing.length && !extra.length) {
      const msg = crossing
        ? (same ? 'Yes. With crossing over this parent can make ' + can.join(' and ') + '. A swap changes nothing here because the two chromosomes already match at one of the genes.'
          : 'Yes. With crossing over this parent can make ' + can.join(', ') + '. The swap adds ' + recombinantTypes(parent).join(' and ') + '.')
        : 'Yes. Without crossing over this parent can only pass on a whole chromosome: ' + can.join(' or ') + '.';
      return { status: 'correct', missing, extra, can, message: msg };
    }
    const parts = [];
    if (extra.length) parts.push(crossing ? extra.join(' and ') + ' cannot be made from these two chromosomes.' : extra.join(' and ') + ' needs a swap. Crossing over is off, so only whole chromosomes are passed on.');
    if (missing.length) parts.push('You are missing ' + missing.join(' and ') + (crossing ? '. A swap between the genes makes it.' : '.'));
    return { status: 'wrong', missing, extra, can, message: 'Not yet. ' + parts.join(' ') };
  }

  const STAGES = [
    { id: 'start', name: 'Start', text: 'A body cell has matching pairs of chromosomes. We follow one pair and show a second pair for scale. A human cell has 23 pairs.' },
    { id: 'copy', name: 'Copy', text: 'The DNA is copied first. Each chromosome now has two identical copies joined in the middle.' },
    { id: 'pair', name: 'Pair up', text: 'The two chromosomes of a pair line up side by side.' },
    { id: 'swap', name: 'Swap', text: '' },
    { id: 'divide1', name: 'Divide', text: 'The cell divides. Each new cell gets one chromosome of each pair, still with two copies joined.' },
    { id: 'divide2', name: 'Divide again', text: '' }
  ];
  function stageText(stage, parent, crossing) {
    const s = STAGES[stage];
    if (stage === 3) return crossing
      ? 'Crossing over: the two chromosomes of the pair swap sections. Here a swap falls between the two genes, so one copy of each chromosome now carries a new combination (' + recombinantTypes(parent).join(' and ') + ').'
      : 'Crossing over does not happen in this run, so the chromosomes stay exactly as they were.';
    if (stage === 5) {
      const g = animationGametes(parent, crossing), k = sortedKinds(g);
      return 'The two cells divide again without copying. Four gametes, each with half the chromosomes: ' + g.join(', ') + '. That is ' + k.length + ' kinds of gamete.';
    }
    return s.text;
  }

  /* ---------- geometry (shared by the drawing and the layout tests) ----------
     Chromatid (p, h, s): p = pair (0 followed, 1 for scale), h = which chromosome of the pair, s = which copy. */
  const LAYOUTS = {
    wide: { key: 'wide', W: 960, H: 410, cy: 210, L: 200, L2: 110, barW: 20, sd: 11, hd: 34, dl: 45, dl5: 30, fs: 14, lfs: 13, band: 18,
      big: { rx: 430, ry: 170 }, two: { cx: [250, 710], rx: 215, ry: 170 }, four: { cx: [134, 365, 595, 826], rx: 108, ry: 150 },
      p1apart: [259, 442], p2apart: [576, 749], p1pair: 346, p2pair: 653 },
    narrow: { key: 'narrow', W: 420, H: 395, cy: 200, L: 170, L2: 95, barW: 15, sd: 8.5, hd: 26, dl: 22, dl5: 14, fs: 15, lfs: 14, band: 20,
      big: { rx: 200, ry: 165 }, two: { cx: [105, 315], rx: 100, ry: 165 }, four: { cx: [52.5, 157.5, 262.5, 367.5], rx: 50, ry: 125 },
      p1apart: [84, 160], p2apart: [260, 336], p1pair: 122, p2pair: 298 }
  };
  function pose(G, p, h, s, stage) {
    const sis = (s ? 1 : -1) * G.sd, len = p ? G.L2 : G.L, apart = p ? G.p2apart : G.p1apart, y = G.cy - len / 2;
    let x, show = true;
    if (stage === 0) { x = apart[h]; show = s === 0; }
    else if (stage === 1) x = apart[h] + sis;
    else if (stage <= 3) x = (p ? G.p2pair : G.p1pair) + (h ? 1 : -1) * G.hd + sis;
    else if (stage === 4) x = G.two.cx[h] + (p ? G.dl : -G.dl) + sis;
    else x = G.four.cx[h * 2 + s] + (p ? G.dl5 : -G.dl5);
    return { x, y, len, show };
  }
  function cellsAt(G, stage) {
    const c = G.cy;
    if (stage <= 3) return [{ cx: G.W / 2, cy: c, rx: G.big.rx, ry: G.big.ry }];
    if (stage === 4) return G.two.cx.map(cx => ({ cx, cy: c, rx: G.two.rx, ry: G.two.ry }));
    return G.four.cx.map(cx => ({ cx, cy: c, rx: G.four.rx, ry: G.four.ry }));
  }
  // Gene positions along the followed chromosome (local y from its top). Spacing grows with distance (schematic, not to scale).
  function genePositions(G, cM) {
    const y1 = 34, y2 = y1 + 24 + ((clampDist(cM) - DIST_MIN) / (DIST_MAX - DIST_MIN)) * (G.L - y1 - 24 - 34);
    return { y1, y2, yb: (y1 + y2) / 2 };
  }

  const logic = { PARENTS, ALL_TYPES, DIST_MIN, DIST_MAX, DIST_DEFAULT, EXIT_PAIRS, STAGES, LAYOUTS, clampDist, animationGametes, isParental, recombinantTypes,
    newPercent, togetherPercent, sampleGametes, tally, checkPick, stageText, pose, cellsAt, genePositions, mapUnits };
  if (NODE) return { logic };

  /* ---------- the scene ---------- */
  const SVGNS = 'http://www.w3.org/2000/svg';
  const CSS = `
.ms { display: grid; gap: 14px; min-width: 0; }
.ms * { box-sizing: border-box; }
.ms-legend { margin: 0; font-size: .9rem; color: var(--muted); }
.ms-stage { display: block; width: 100%; max-width: 100%; height: auto; border: 1px solid var(--line); border-radius: var(--r); background: var(--surface-2); }
.ms-stage .ms-cell { fill: var(--accent-soft); stroke: var(--muted); stroke-width: 2; transition: opacity .6s ease; }
.ms-stage .ms-o0 { fill: var(--s3); } .ms-stage .ms-o1 { fill: url(#ms-hatch-a); } .ms-stage .ms-o2 { fill: var(--surface-2); } .ms-stage .ms-o3 { fill: url(#ms-hatch-b); }
.ms-stage .ms-chr { transition: transform .9s ease, opacity .6s ease; }
.ms-stage .ms-outline { fill: none; stroke: var(--ink); stroke-width: 1.6; }
.ms-stage .ms-swapped { fill: none; stroke: var(--accent); stroke-width: 3.2; stroke-dasharray: 5 3; }
.ms-stage .ms-band { fill: var(--surface); stroke: var(--ink); stroke-width: 1.2; }
.ms-stage .ms-letter { fill: var(--ink); font-weight: 700; text-anchor: middle; font-family: var(--f-body); }
.ms-stage .ms-cen { fill: var(--ink); }
.ms-stage .ms-bridge { fill: var(--ink); transition: opacity .6s ease; }
.ms-stage .ms-x { stroke: var(--ink); stroke-width: 2.4; stroke-linecap: round; transition: opacity .6s ease; }
.ms-stage text { fill: var(--ink); font-family: var(--f-body); }
.ms-stage .ms-call { transition: opacity .5s ease; }
.ms-stage .ms-call line { stroke: var(--ink); stroke-width: 1.4; }
.ms-stage .ms-call circle { fill: var(--ink); }
.ms-stage .ms-glabel { font-weight: 650; text-anchor: middle; transition: opacity .6s ease; }
.ms[data-layout="narrow"] .ms-stage { max-width: 560px; margin: 0 auto; }
@media (prefers-reduced-motion: reduce) { .ms-stage *, .ms-bar > i { transition: none !important; } }
.ms-caption { margin: 0; padding: 10px 14px; border-left: 4px solid var(--accent); border-radius: 0 var(--r-sm) var(--r-sm) 0; background: var(--accent-soft); min-height: 4.6em; }
.ms-caption b { display: block; font-size: .8rem; font-family: var(--f-mono); letter-spacing: .06em; text-transform: uppercase; color: var(--accent); }
.ms-row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.ms-row .btn, .ms-chip { min-height: 32px; min-width: 32px; }
.ms-steps { display: flex; flex-wrap: wrap; gap: 6px; margin: 0; padding: 0; list-style: none; }
.ms-chip { font: inherit; font-weight: 600; font-size: .88rem; padding: 4px 10px; border-radius: 999px; border: 1.5px solid var(--line); background: var(--surface); color: var(--ink); cursor: pointer; }
.ms-chip:hover { border-color: var(--accent); }
.ms-chip[aria-pressed="true"] { background: var(--accent); border-color: var(--accent); color: var(--accent-ink); }
.ms-chip[aria-current="step"] { background: var(--accent); border-color: var(--accent); color: var(--accent-ink); }
.ms-chip[aria-pressed="true"]::before { content: "\\2713\\00a0"; }
.ms-switch { display: inline-flex; align-items: center; gap: 10px; font: inherit; font-weight: 650; padding: 6px 14px 6px 8px; border: 1.5px solid var(--line); border-radius: 999px; background: var(--surface); color: var(--ink); cursor: pointer; min-height: 36px; }
.ms-switch .ms-knob { width: 38px; height: 22px; border-radius: 999px; background: var(--muted); position: relative; flex: none; }
.ms-switch .ms-knob::after { content: ""; position: absolute; top: 3px; left: 3px; width: 16px; height: 16px; border-radius: 50%; background: var(--surface); transition: transform .2s; }
.ms-switch[aria-checked="true"] .ms-knob { background: var(--accent); }
.ms-switch[aria-checked="true"] .ms-knob::after { transform: translateX(16px); }
@media (prefers-reduced-motion: reduce) { .ms-switch .ms-knob::after { transition: none; } }
.ms-panel { padding: 14px; border: 1px solid var(--line); border-radius: var(--r); background: var(--surface); display: grid; gap: 10px; min-width: 0; }
.ms-panel h4 { margin: 0; }
.ms-panel p { margin: 0; }
.ms-range { display: grid; gap: 4px; }
.ms-range input[type=range] { width: 100%; min-height: 28px; accent-color: var(--accent); }
.ms-tokens { display: flex; flex-wrap: wrap; gap: 6px; margin: 0; padding: 0; list-style: none; }
.ms-token { min-width: 52px; padding: 3px 8px; border: 2px solid var(--ink); border-radius: var(--r-sm); font: 700 .88rem var(--f-mono); background: var(--surface); text-align: center; }
.ms-token[data-new="1"] { background: var(--accent-soft); border-style: dashed; }
.ms-token[data-new="1"]::after { content: " \\2605"; }
.ms-bars { display: grid; gap: 4px; margin: 0; }
.ms-tokens:empty, .ms-bars:empty { display: none; }
.ms-bar { display: grid; grid-template-columns: 3.2em 1fr 6.5em; gap: 8px; align-items: center; font-size: .9rem; }
.ms-bar > span:first-child { font-family: var(--f-mono); font-weight: 700; }
.ms-bar > b { display: block; height: 14px; border-radius: 3px; background: var(--surface-2); overflow: hidden; }
.ms-bar > b > i { display: block; height: 100%; background: var(--accent); transition: width .5s ease; }
.ms-bar[data-new="1"] > b > i { background: repeating-linear-gradient(45deg, var(--s2) 0 5px, var(--surface) 5px 8px); }
.ms-cmp { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 10px; }
.ms-cmp > div { border: 1px solid var(--line); border-radius: var(--r-sm); padding: 10px; display: grid; gap: 6px; background: var(--surface-2); }
.ms-cmp strong { font-size: 1.05rem; }
.ms-fb { min-height: 1.4em; font-weight: 600; }
.ms-fb[data-state="correct"] { color: var(--ok); } .ms-fb[data-state="correct"]::before { content: "\\2713\\00a0"; }
.ms-fb[data-state="wrong"] { color: var(--warn); }
.ms-pairs { width: 100%; border-collapse: collapse; font-size: .9rem; }
.ms-pairs th, .ms-pairs td { padding: 4px 8px; text-align: left; border-bottom: 1px solid var(--line); }
.ms-small { font-size: .85rem; color: var(--muted); }
.ms-parent { display: inline-flex; gap: 6px; align-items: center; flex-wrap: wrap; font-weight: 650; }
.ms-sw { display: inline-block; width: 14px; height: 30px; border-radius: 7px; border: 1.5px solid var(--ink); vertical-align: middle; }
.ms-sw.o0 { background: var(--s3); } .ms-sw.o1 { background: repeating-linear-gradient(45deg, var(--s2) 0 4px, var(--surface) 4px 7px); }
.ms-grid2 { display: grid; gap: 14px; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); }
`;

  function mount(host, api) {
    const reduce = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
    const desc = document.getElementById('meiosis-desc');
    const el = (tag, attrs, kids) => { const e = document.createElement(tag); Object.keys(attrs || {}).forEach(k => { if (k === 'text') e.textContent = attrs[k]; else if (k === 'class') e.className = attrs[k]; else e.setAttribute(k, attrs[k]); }); (kids || []).forEach(c => e.appendChild(c)); return e; };
    const sv = (tag, attrs, kids) => { const e = document.createElementNS(SVGNS, tag); Object.keys(attrs || {}).forEach(k => e.setAttribute(k, attrs[k])); (kids || []).forEach(c => e.appendChild(c)); return e; };
    const num = x => typeof x === 'number' && isFinite(x);

    /* ----- state ----- */
    const saved = (api.getState() || {}).meiosis;
    let runs = saved && Array.isArray(saved.runs) ? saved.runs.filter(r => r && Array.isArray(r.gametes) && r.gametes.every(g => ALL_TYPES.includes(g))).slice(-40) : [];
    const S = { stage: 0, crossing: runs.length ? !!runs[runs.length - 1].crossing : false, dist: saved && num(saved.distanceCM) ? clampDist(saved.distanceCM) : DIST_DEFAULT,
      parentIdx: 0, picks: [], playing: false, timer: 0, layout: window.innerWidth >= 1000 ? 'wide' : 'narrow' };
    const parentOf = () => PARENTS[S.parentIdx];
    const ANIM_PARENT = PARENTS[0];

    function persist() {
      api.saveState('meiosis', { runs: runs.slice(-40), distanceCM: S.dist, updatedAt: Date.now() });
    }

    /* ----- skeleton ----- */
    const style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style);
    const root = el('div', { class: 'ms' });
    const cv = host.querySelector('canvas'); if (cv) cv.remove();
    host.insertBefore(root, host.firstChild);
    host.dataset.ms = '1'; root.dataset.layout = S.layout;
    root.appendChild(el('p', { class: 'ms-legend', text: 'Letters: A or B is the p53 gene, C or D is the BRCA1 gene (A fixes mutations, B does not; C is the lower-risk version, D the higher-risk one). Blue plain and orange striped are the two chromosomes of a pair.' }));
    const stageWrap = el('div'); root.appendChild(stageWrap);
    const caption = el('p', { class: 'ms-caption', id: 'ms-caption' }); root.appendChild(caption);

    // controls: steps, back, next, play, crossing switch
    const stepList = el('ol', { class: 'ms-steps', 'aria-label': 'Steps of meiosis' });
    const stepBtns = STAGES.map((s, i) => { const b = el('button', { type: 'button', class: 'ms-chip', 'data-step': String(i), text: (i + 1) + ' ' + s.name }); b.addEventListener('click', () => go(i, true)); stepList.appendChild(el('li', {}, [b])); return b; });
    const back = el('button', { type: 'button', class: 'btn btn--sm', text: 'Back' });
    const next = el('button', { type: 'button', class: 'btn btn--sm btn--primary', text: 'Next step' });
    const play = el('button', { type: 'button', class: 'btn btn--sm', text: 'Play all' });
    const sw = el('button', { type: 'button', class: 'ms-switch', role: 'switch', 'aria-checked': 'false' }, [el('span', { class: 'ms-knob', 'aria-hidden': 'true' }), el('span', { class: 'ms-swt', text: 'Crossing over: off' })]);
    root.appendChild(el('div', { class: 'ms-row' }, [sw]));
    root.appendChild(stepList);
    root.appendChild(el('div', { class: 'ms-row' }, [back, next].concat(reduce ? [] : [play])));
    back.addEventListener('click', () => go(S.stage - 1, true));
    next.addEventListener('click', () => go(S.stage + 1, true));
    play.addEventListener('click', () => { if (S.playing) { stopPlay(); announceOnce('Paused.'); return; } if (S.stage >= 5) go(0, false); S.playing = true; play.textContent = 'Pause'; tick(); });
    sw.addEventListener('click', () => { setCrossing(!S.crossing); });

    // distance slider + exit-ticket pairs
    const rng = el('input', { type: 'range', min: String(DIST_MIN), max: String(DIST_MAX), step: '1', value: String(S.dist) });
    const rngOut = el('span', { class: 'ms-small' });
    const readout = el('p', { class: 'ms-readout' });
    const pairBody = el('tbody');
    EXIT_PAIRS.forEach(pr => {
      const b = el('button', { type: 'button', class: 'ms-chip', 'data-pair': pr.id, text: pr.label });
      b.addEventListener('click', () => { setDist(pr.cM, true); announceOnce(pr.label + ': about ' + pr.cM + ' map units apart. About ' + Math.round(togetherPercent(pr.cM)) + ' of 100 gametes keep them together.'); });
      pairBody.appendChild(el('tr', {}, [el('th', { scope: 'row' }, [b]), el('td', { text: '~' + pr.cM }), el('td', { 'data-together': pr.id, text: '~' + Math.round(togetherPercent(pr.cM)) + '%' })]));
    });
    const pairs = el('table', { class: 'ms-pairs' }, [el('caption', { class: 'ms-small', text: 'Tap a pair to set the slider. Spacing taken from the picture in the exit ticket (illustration).' }), el('thead', {}, [el('tr', {}, [el('th', { scope: 'col', text: 'Pair of genes' }), el('th', { scope: 'col', text: 'Map units apart' }), el('th', { scope: 'col', text: 'Stay together' })])]), pairBody]);
    const distPanel = el('div', { class: 'ms-panel' }, [el('h4', { text: 'How far apart are the two genes?' }),
      el('label', { class: 'ms-range' }, [el('span', { text: 'Distance between the genes (map units, an illustration)' }), rng, rngOut]), readout, pairs]);
    rng.addEventListener('input', () => setDist(+rng.value, false));
    rng.addEventListener('change', () => { persist(); });

    // tally
    const makeBtn = el('button', { type: 'button', class: 'btn btn--primary btn--sm', text: 'Make 10 gametes' });
    const clearBtn = el('button', { type: 'button', class: 'btn btn--sm', text: 'Clear tally' });
    const tokens = el('ul', { class: 'ms-tokens', 'aria-label': 'The 10 gametes' });
    const bars = el('div', { class: 'ms-bars' });
    const tallySum = el('p', { class: 'ms-tallysum', 'data-role': 'tally-summary' });
    const totalLine = el('p', { class: 'ms-small' });
    const tallyPanel = el('div', { class: 'ms-panel' }, [el('h4', { text: 'Make some gametes (simulated)' }),
      el('p', { class: 'ms-small', text: 'Each gamete comes from a different cell. Starred, dashed gametes are NEW combinations, not copies of a parent chromosome.' }),
      el('div', { class: 'ms-row' }, [makeBtn, clearBtn]), tokens, bars, tallySum, totalLine]);
    makeBtn.addEventListener('click', makeTen);
    clearBtn.addEventListener('click', () => { runs = runs.filter(r => r.kind !== 'tally'); persist(); renderTally(); announceOnce('Tally cleared.'); });

    // which gametes check
    const parentBox = el('span', { class: 'ms-parent' });
    const newParent = el('button', { type: 'button', class: 'btn btn--sm', text: 'Try a different parent' });
    const chipRow = el('div', { class: 'ms-row', role: 'group', 'aria-label': 'Possible gametes' });
    const chipBtns = ALL_TYPES.map(t => { const b = el('button', { type: 'button', class: 'ms-chip', 'data-pick': t, 'aria-pressed': 'false', text: t }); b.addEventListener('click', () => { S.picks = S.picks.includes(t) ? S.picks.filter(x => x !== t) : S.picks.concat(t); fb.textContent = ''; fb.dataset.state = ''; renderCheck(); }); chipRow.appendChild(b); return b; });
    const checkBtn = el('button', { type: 'button', class: 'btn btn--primary btn--sm', text: 'Check' });
    const fb = el('p', { class: 'ms-fb', 'data-role': 'check-feedback' });
    const checkMode = el('p', { class: 'ms-small' });
    const checkPanel = el('div', { class: 'ms-panel' }, [el('h4', { text: 'Which gametes can this parent make?' }),
      el('div', { class: 'ms-row' }, [parentBox, newParent]), checkMode, chipRow, el('div', { class: 'ms-row' }, [checkBtn]), fb]);
    newParent.addEventListener('click', () => { S.parentIdx = (S.parentIdx + 1) % PARENTS.length; S.picks = []; fb.textContent = ''; fb.dataset.state = ''; renderCheck(); announceOnce('New parent: ' + parentOf()[0] + ' and ' + parentOf()[1] + '.'); });
    checkBtn.addEventListener('click', () => {
      const r = checkPick(parentOf(), S.crossing, S.picks); fb.textContent = r.message; fb.dataset.state = r.status === 'correct' ? 'correct' : 'wrong'; announceOnce(r.message);
    });

    // compare populations
    const cmp = el('div', { class: 'ms-cmp' });
    const cmpPanel = el('div', { class: 'ms-panel' }, [el('h4', { text: 'Two gamete sets, same parent' }), cmp]);

    root.appendChild(el('div', { class: 'ms-grid2' }, [distPanel, tallyPanel]));
    root.appendChild(el('div', { class: 'ms-grid2' }, [checkPanel, cmpPanel]));
    root.appendChild(el('p', { class: 'ms-small', text: 'This is a simplified model. It follows one pair of chromosomes, leaves out copying mistakes, and the gametes in the tally are simulated, not measured.' }));

    /* ----- drawing ----- */
    let svg = null, chroms = [], cellEls = [], callG = null, xEls = [], glabels = [], G = LAYOUTS[S.layout], paths = {};
    function build() {
      G = LAYOUTS[S.layout];
      svg = sv('svg', { class: 'ms-stage', viewBox: '0 0 ' + G.W + ' ' + G.H, role: 'img', 'aria-label': 'Meiosis: one parent cell with two pairs of chromosomes is copied, can swap sections, and divides twice into four gametes.', focusable: 'false' });
      svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
      svg.style.aspectRatio = G.W + ' / ' + G.H;
      const defs = sv('defs', {}, [
        sv('pattern', { id: 'ms-hatch-a', patternUnits: 'userSpaceOnUse', width: '8', height: '8', patternTransform: 'rotate(45)' }, [sv('rect', { width: '8', height: '8', style: 'fill:var(--s2)' }), sv('rect', { width: '3', height: '8', style: 'fill:var(--surface)' })]),
        sv('pattern', { id: 'ms-hatch-b', patternUnits: 'userSpaceOnUse', width: '8', height: '8', patternTransform: 'rotate(45)' }, [sv('rect', { width: '8', height: '8', style: 'fill:var(--muted)' }), sv('rect', { width: '3', height: '8', style: 'fill:var(--surface-2)' })])]);
      svg.appendChild(defs);
      cellEls = [];
      for (let i = 0; i < 7; i++) { const e = sv('ellipse', { class: 'ms-cell' }); svg.appendChild(e); cellEls.push(e); }
      chroms = [];
      const w = G.barW, r = w / 2;
      for (let p = 0; p < 2; p++) for (let h = 0; h < 2; h++) for (let s = 0; s < 2; s++) {
        const len = p ? G.L2 : G.L;
        const g = sv('g', { class: 'ms-chr', 'data-pair': String(p), 'data-hom': String(h), 'data-copy': String(s) });
        const top = sv('path', {}), bot = sv('path', {});
        const outline = sv('rect', { class: 'ms-outline', x: String(-r), y: '0', width: String(w), height: String(len), rx: String(r) });
        const swapped = sv('path', { class: 'ms-swapped' });
        g.append(top, bot, outline, swapped);
        const o = { p, h, s, g, top, bot, swapped, bands: [], letters: [] };
        if (!p) for (let k = 0; k < 2; k++) {
          const band = sv('rect', { class: 'ms-band', x: String(-r - 3), width: String(w + 6), height: String(G.band), rx: '4' });
          const t = sv('text', { class: 'ms-letter', 'font-size': String(G.lfs) });
          g.append(band, t); o.bands.push(band); o.letters.push(t);
        }
        g.appendChild(sv('circle', { class: 'ms-cen', cx: '0', cy: '14', r: '3.2' }));
        if (s === 0) { const br = sv('rect', { class: 'ms-bridge', x: '0', y: '11', width: String(2 * G.sd), height: '6', rx: '2' }); o.bridge = br; g.appendChild(br); }
        svg.appendChild(g); chroms.push(o);
      }
      xEls = [sv('line', { class: 'ms-x' }), sv('line', { class: 'ms-x' })]; xEls.forEach(x => svg.appendChild(x));
      callG = sv('g', { class: 'ms-call' }); svg.appendChild(callG);
      glabels = [0, 1, 2, 3].map(i => { const t = sv('text', { class: 'ms-glabel', 'font-size': String(G.fs), 'data-gamete': String(i) }); svg.appendChild(t); return t; });
      stageWrap.replaceChildren(svg);
      paint(true);
    }
    const segTop = (w, y1) => { const r = w / 2; return 'M' + (-r) + ',' + y1 + ' V' + r + ' A' + r + ',' + r + ' 0 0 1 ' + r + ',' + r + ' V' + y1 + ' Z'; };
    const segBot = (w, y0, y1) => { const r = w / 2; return 'M' + (-r) + ',' + y0 + ' V' + (y1 - r) + ' A' + r + ',' + r + ' 0 0 0 ' + r + ',' + (y1 - r) + ' V' + y0 + ' Z'; };
    const chrom = (p, h, s) => chroms[p * 4 + h * 2 + s];
    function paint(instant) {
      if (!svg) return;
      if (instant) svg.classList.add('ms-instant');
      const gp = genePositions(G, S.dist), par = ANIM_PARENT, swapOn = S.crossing && S.stage >= 3;
      chroms.forEach(o => {
        const ps = pose(G, o.p, o.h, o.s, S.stage), inner = !o.p && ((o.h === 0 && o.s === 1) || (o.h === 1 && o.s === 0));
        const swapped = swapOn && inner;
        o.g.style.transform = 'translate(' + ps.x + 'px,' + ps.y + 'px)';
        o.g.style.opacity = ps.show ? '1' : '0';
        if (instant) o.g.style.transition = 'none'; else o.g.style.transition = '';
        const yb = o.p ? ps.len / 2 : gp.yb, topO = o.p ? 2 + o.h : o.h, botO = o.p ? topO : (swapped ? 1 - o.h : o.h);
        o.top.setAttribute('d', segTop(G.barW, yb)); o.top.setAttribute('class', 'ms-o' + topO);
        o.bot.setAttribute('d', segBot(G.barW, yb, ps.len)); o.bot.setAttribute('class', 'ms-o' + botO);
        o.swapped.setAttribute('d', segBot(G.barW, yb, ps.len)); o.swapped.style.opacity = swapped ? '1' : '0';
        o.g.setAttribute('data-bottom', String(botO));
        if (o.bands.length) {
          [gp.y1, gp.y2].forEach((y, k) => {
            o.bands[k].setAttribute('y', String(y - G.band / 2)); o.letters[k].setAttribute('y', String(y + G.lfs * 0.35));
            o.letters[k].textContent = par[k ? botO : topO][k];
          });
        }
        if (o.bridge) o.bridge.style.opacity = S.stage >= 1 && S.stage <= 4 ? '1' : '0';
      });
      const cells = cellsAt(G, S.stage);
      cellEls.forEach((e, i) => {
        const big = i === 0, two = i === 1 || i === 2, k = big ? 0 : two ? i - 1 : i - 3;
        const want = S.stage <= 3 ? big : S.stage === 4 ? two : i >= 3;
        const geo = want ? cells[k] : null; if (geo) { e.setAttribute('cx', geo.cx); e.setAttribute('cy', geo.cy); e.setAttribute('rx', geo.rx); e.setAttribute('ry', geo.ry); }
        else { const any = big ? cellsAt(G, 0)[0] : two ? cellsAt(G, 4)[k] : cellsAt(G, 5)[k]; e.setAttribute('cx', any.cx); e.setAttribute('cy', any.cy); e.setAttribute('rx', any.rx); e.setAttribute('ry', any.ry); }
        e.style.opacity = want ? '1' : '0';
      });
      // chiasma (the crossing point), only while the swap is shown
      const a = pose(G, 0, 0, 1, 3), b = pose(G, 0, 1, 0, 3), yy = a.y + gp.yb;
      xEls[0].setAttribute('x1', a.x); xEls[0].setAttribute('y1', yy - 7); xEls[0].setAttribute('x2', b.x); xEls[0].setAttribute('y2', yy + 7);
      xEls[1].setAttribute('x1', a.x); xEls[1].setAttribute('y1', yy + 7); xEls[1].setAttribute('x2', b.x); xEls[1].setAttribute('y2', yy - 7);
      xEls.forEach(x => { x.style.opacity = S.stage === 3 && S.crossing ? '1' : '0'; });
      // callouts: anchors come from the geometry that is drawn
      callG.replaceChildren();
      const calls = [];
      if (S.stage === 1) { const q = pose(G, 0, 0, 0, 1); calls.push({ t: 'Copies joined in the middle', ax: q.x + G.sd, ay: q.y + 14 }); }
      if (S.stage === 2) { const q = pose(G, 0, 0, 1, 2), q2 = pose(G, 0, 1, 0, 2); calls.push({ t: 'Matching chromosomes pair up', ax: (q.x + q2.x) / 2, ay: q.y + 60 }); }
      if (S.stage === 3 && S.crossing) { const q = pose(G, 0, 0, 1, 3); calls.push({ t: 'Swapped sections', ax: q.x, ay: q.y + (gp.yb + G.L) / 2 }); }
      calls.forEach(c => {
        const hw = c.t.length * G.fs * 0.28 + 6, tx = Math.max(hw, Math.min(G.W - hw, c.ax));
        const label = sv('text', { x: tx, y: String(G.fs + 6), 'font-size': String(G.fs), 'text-anchor': 'middle', 'font-weight': '650' }); label.textContent = c.t;
        callG.append(label, sv('line', { x1: tx, y1: String(G.fs + 12), x2: c.ax, y2: c.ay }), sv('circle', { cx: c.ax, cy: c.ay, r: '3.8' }));
      });
      // gamete names under the four cells, only in the last step
      const gam = animationGametes(par, S.crossing);
      glabels.forEach((t, i) => {
        const cx = G.four.cx[i], g = gam[i];
        t.setAttribute('x', cx); t.setAttribute('y', G.cy + G.four.ry + G.fs + 8);
        t.textContent = g + (isParental(g, par) ? '' : ' (new)'); t.dataset.type = g;
        t.style.opacity = S.stage === 5 ? '1' : '0';
      });
      if (instant) { void svg.getBoundingClientRect(); svg.classList.remove('ms-instant'); chroms.forEach(o => { o.g.style.transition = ''; }); }
    }

    /* ----- actions ----- */
    let lastSaid = '';
    function announceOnce(t) { if (t && t !== lastSaid) { lastSaid = t; api.announce(t); } else if (t) { api.announce(t); } }
    function describe() {
      const par = ANIM_PARENT, st = S.stage, txt = stageText(st, par, S.crossing);
      const dist = 'Genes are ' + S.dist + ' map units apart, so with crossing over on about ' + Math.round(newPercent(true, S.dist)) + ' in 100 gametes get a new combination.';
      const tl = runs.filter(r => r.kind === 'tally').slice(-1)[0];
      const tt = tl ? ' Last tally of ' + tl.gametes.length + ' gametes: ' + tl.gametes.join(', ') + '.' : '';
      return 'Step ' + (st + 1) + ' of 6, ' + STAGES[st].name + '. Parent chromosomes ' + par[0] + ' and ' + par[1] + ', crossing over ' + (S.crossing ? 'on' : 'off') + '. ' + txt + ' ' + dist + tt;
    }
    function renderCaption() {
      const st = S.stage; caption.replaceChildren(el('b', { text: 'Step ' + (st + 1) + ' of 6: ' + STAGES[st].name }), document.createTextNode(stageText(st, ANIM_PARENT, S.crossing)));
      stepBtns.forEach((b, i) => { if (i === st) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current'); });
      back.disabled = st === 0; next.disabled = st === 5;
      host.dataset.stage = String(st); host.dataset.crossing = S.crossing ? 'on' : 'off';
      const gam = st === 5 ? animationGametes(ANIM_PARENT, S.crossing) : [];
      host.dataset.kinds = st === 5 ? String(sortedKinds(gam).length) : '';
      if (svg) svg.setAttribute('aria-label', 'Meiosis step ' + (st + 1) + ' of 6, ' + STAGES[st].name + '. ' + stageText(st, ANIM_PARENT, S.crossing));
      if (desc) desc.textContent = 'Text description: ' + describe();
    }
    function recordAnimation() {
      runs = runs.filter(r => !(r.kind === 'animation' && !!r.crossing === S.crossing));
      runs.push({ crossing: S.crossing, parent: ANIM_PARENT.slice(), gametes: animationGametes(ANIM_PARENT, S.crossing), at: Date.now(), kind: 'animation', distanceCM: S.dist });
      persist();
    }
    function go(i, speak) {
      i = Math.max(0, Math.min(5, i)); if (i === S.stage && !speak) return;
      if (speak) stopPlay();
      S.stage = i; paint(reduce); renderCaption();
      if (i === 5) { recordAnimation(); renderCompare(); }
      if (speak) announceOnce('Step ' + (i + 1) + ' of 6, ' + STAGES[i].name + '. ' + stageText(i, ANIM_PARENT, S.crossing));
    }
    function tick() { S.timer = setTimeout(() => { if (!S.playing) return; if (S.stage >= 5) { stopPlay(); return; } go(S.stage + 1, false); if (S.stage >= 5) { stopPlay(); announceOnce(stageText(5, ANIM_PARENT, S.crossing)); } else tick(); }, 1700); }
    function stopPlay() { S.playing = false; clearTimeout(S.timer); play.textContent = 'Play all'; }
    function setCrossing(on) {
      S.crossing = !!on; sw.setAttribute('aria-checked', String(S.crossing)); sw.querySelector('.ms-swt').textContent = 'Crossing over: ' + (S.crossing ? 'on' : 'off');
      S.picks = []; fb.textContent = ''; fb.dataset.state = '';
      paint(false); renderCaption(); renderCheck(); renderReadout(); renderTally(); renderCompare();
      if (S.stage === 5) recordAnimation();
      announceOnce('Crossing over is ' + (S.crossing ? 'on' : 'off') + '. ' + (S.crossing ? 'This parent can make four kinds of gametes.' : 'This parent can make two kinds of gametes.'));
    }
    function setDist(v, speak) {
      S.dist = clampDist(v); rng.value = String(S.dist); paint(false); renderReadout(); renderCaption();
      if (speak) { persist(); }
    }
    function makeTen() {
      const idx = runs.filter(r => r.kind === 'tally').length, g = sampleGametes(api.rng('meiosis-tally-' + idx), 10, ANIM_PARENT, S.crossing, S.dist);
      runs.push({ crossing: S.crossing, parent: ANIM_PARENT.slice(), gametes: g, at: Date.now(), kind: 'tally', distanceCM: S.dist });
      const tallies = runs.filter(r => r.kind === 'tally'); if (tallies.length > 30) runs.splice(runs.indexOf(tallies[0]), 1);
      persist(); renderTally(); renderCaption();
      const t = tally(g, ANIM_PARENT);
      announceOnce('10 gametes made: ' + t.parental + ' like a parent chromosome and ' + t.fresh + ' new combination' + (t.fresh === 1 ? '' : 's') + '.');
    }

    /* ----- panels ----- */
    function renderReadout() {
      const p = Math.round(newPercent(true, S.dist)), tg = Math.round(togetherPercent(S.dist));
      rngOut.textContent = S.dist + ' map units';
      rng.setAttribute('aria-valuetext', S.dist + ' map units apart');
      readout.replaceChildren(document.createTextNode('With crossing over on, about ' + p + ' in 100 gametes get a NEW combination of these two genes, and about ' + tg + ' in 100 keep the parent’s combination. '),
        el('span', { class: 'ms-small', text: S.crossing ? 'Closer genes: new combinations are rarer. The percent is a little below the map distance because two swaps can undo each other, and it never goes above 50.' : 'Crossing over is off right now, so the tally below shows 0 new combinations.' }));
      pairBody.querySelectorAll('button').forEach(b => { const pr = EXIT_PAIRS.find(x => x.id === b.dataset.pair); b.setAttribute('aria-pressed', String(pr.cM === S.dist)); });
    }
    function renderTally() {
      const all = runs.filter(r => r.kind === 'tally'), last = all[all.length - 1];
      tokens.replaceChildren(); bars.replaceChildren();
      if (!last) { tallySum.textContent = 'Press Make 10 gametes. The same Dataset ID always gives the same first ten.'; totalLine.textContent = ''; host.dataset.tally = ''; return; }
      last.gametes.forEach(g => tokens.appendChild(el('li', { class: 'ms-token', 'data-gamete-type': g, 'data-new': isParental(g, last.parent) ? '0' : '1', text: g })));
      const t = tally(last.gametes, last.parent);
      ALL_TYPES.forEach(type => {
        const fresh = !isParental(type, last.parent), n = t.counts[type];
        bars.appendChild(el('div', { class: 'ms-bar', 'data-new': fresh ? '1' : '0', 'data-type': type }, [el('span', { text: type }), el('b', {}, [el('i', { style: 'width:' + (n / Math.max(1, t.total) * 100) + '%' })]), el('span', { text: n + ' of ' + t.total + (fresh ? ' (new)' : '') })]));
      });
      tallySum.textContent = 'Same as a parent chromosome: ' + t.parental + ' of ' + t.total + '. New combination: ' + t.fresh + ' of ' + t.total + '. Kinds seen: ' + t.kinds.length + ' (' + t.kinds.join(', ') + ').' + (last.crossing ? '' : ' Crossing over was off.');
      const same = all.filter(r => !!r.crossing === S.crossing && r.distanceCM === S.dist), n = same.reduce((a, r) => a + r.gametes.length, 0), f = same.reduce((a, r) => a + tally(r.gametes, r.parent).fresh, 0);
      totalLine.textContent = same.length > 1 ? 'All ' + same.length + ' tallies with these settings: ' + f + ' new of ' + n + ' (' + Math.round(f / n * 100) + '%). The model’s expected value is about ' + Math.round(newPercent(S.crossing, S.dist)) + '%.' : (same.length ? 'Make more tallies to see the percent settle near the model’s expected ' + Math.round(newPercent(S.crossing, S.dist)) + '%.' : '');
      host.dataset.tally = last.gametes.join(',');
      if (desc) desc.textContent = 'Text description: ' + describe();
    }
    function renderCheck() {
      const par = parentOf();
      parentBox.replaceChildren(document.createTextNode('Parent chromosomes: '), el('span', { class: 'ms-sw o0', 'aria-hidden': 'true' }), document.createTextNode(par[0][0] + '–' + par[0][1] + ' and '), el('span', { class: 'ms-sw o1', 'aria-hidden': 'true' }), document.createTextNode(par[1][0] + '–' + par[1][1]));
      checkMode.textContent = 'Crossing over is ' + (S.crossing ? 'ON' : 'OFF') + ' (use the switch at the top). Tap every gamete this parent can make.';
      chipBtns.forEach(b => b.setAttribute('aria-pressed', String(S.picks.includes(b.dataset.pick))));
      host.dataset.parent = par.join(',');
    }
    function renderCompare() {
      const mk = (name, crossing) => { const k = BASE.gameteTypes(ANIM_PARENT, crossing); return el('div', { 'data-pop': crossing ? 'B' : 'A' }, [el('strong', { text: name }), el('p', { text: (crossing ? 'Meiosis WITH crossing over' : 'Meiosis WITHOUT crossing over') }), el('div', { class: 'ms-row' }, k.map(t => el('span', { class: 'ms-token', text: t, 'data-new': isParental(t, ANIM_PARENT) ? '0' : '1' }))), el('p', { class: 'ms-small', text: k.length + ' kinds of gamete' + (crossing ? ': more variation' : '') })]); };
      cmp.replaceChildren(mk('Gamete set A', false), mk('Gamete set B', true));
    }

    /* ----- start ----- */
    sw.setAttribute('aria-checked', String(S.crossing)); sw.querySelector('.ms-swt').textContent = 'Crossing over: ' + (S.crossing ? 'on' : 'off');
    try { build(); } catch (e) { stageWrap.replaceChildren(el('p', { class: 'ms-small', text: 'The drawing could not be shown on this device. The steps, tally and checks below still work.' })); svg = null; }
    renderCaption(); renderReadout(); renderTally(); renderCheck(); renderCompare();
    // The picture changes layout on phones: a taller, bigger-lettered drawing below 900 px of scene width.
    if ('ResizeObserver' in window) {
      let lastW = 0;
      new ResizeObserver(() => { const w = host.clientWidth; if (!w || Math.abs(w - lastW) < 4) return; lastW = w; const want = w >= 900 ? 'wide' : 'narrow'; if (want !== S.layout) { S.layout = want; root.dataset.layout = want; build(); renderCaption(); } }).observe(host);
    }
    window.B3MeiosisScene = { state: () => ({ stage: S.stage, crossing: S.crossing, dist: S.dist, layout: S.layout, runs: runs.length, kinds: host.dataset.kinds }), layout: () => G, poses: () => chroms.map(o => ({ p: o.p, h: o.h, s: o.s, x: o.g.style.transform })) };
  }
  return { logic, mount };
});
