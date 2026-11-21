/* Scene 1 for the OpenSciEd B.3 Lessons 8-9 companion: Lakita's family pedigree (host #pedigree-scene, id "pedigree").
   An SVG family tree drawn from the lesson's handout and key. The student taps a person and chooses every p53 genotype that
   could be true (A fixes mutations, B does not). The pure solver in openscied-b3-inheritance-logic.js (solvePedigree, checkGuess,
   explainImpossible) says at once whether each pick is possible, and keeps "could be either" for people who were not tested.

   WHAT IT MODELS (the same ideas are written in the page's "What this models" note):
   - Symbols as in the handout: square = biological male (sperm parent), circle = biological female (egg parent), shaded (with
     diagonal lines, so it is not colour alone) = cancer related to a p53 mutation, slash = deceased, "?" = not tested.
   - Rules of the model: a shaded person has at least one B; the two people the lesson tested are AA; an unshaded person who was
     not tested could be anything, because not everyone who has a B gets cancer; each child gets one allele from each parent.
   - Simplified: real families have more people, new mutations, and risk that depends on much more than one gene. A B raises
     the chance of cancer; it does not mean a person will get it, and nobody is to blame. This is a lesson model, not a
     prediction for any person. Only this pedigree is offered: students cannot enter their own family.
   - The "chromosome 17" view draws each person's pair of chromosomes with the p53 spot, for people whose pick is one genotype.
   - "Show how Lakita got her alleles" is a Punnett-style square: her father (AB) gives one allele, her mother (AA) gives one.

   Saved state (api.saveState('pedigree', ...)): { guesses: { <personId>: ['AA'|'AB'|'BB', ...] }, view: 'pedigree'|'chromosome', updatedAt }.
   Keyboard: Tab enters the tree (one stop); arrow keys move between people; Enter or Space opens the genotype chooser;
   Escape goes back to the person. Everything pure is exported for node tests (module.exports). */
(function (root, factory) {
  const m = factory();
  if (typeof module === 'object' && module.exports) module.exports = m.pure;
  if (typeof window !== 'undefined' && root === window) (window.B3InhScenes = window.B3InhScenes || []).push({ id: 'pedigree', mount: m.mount });
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---------- pure: layout, wording, navigation, feedback ---------- */
  const VIEW_W = 600, VIEW_H = 570, S = 52;
  // Positions in the 600 x 492 drawing. Row 0 grandparents, row 1 their five children and the mother, row 2 Lakita.
  const META = {
    grandfather: { name: 'Grandfather', say: 'Lakita’s grandfather', row: 0, x: 172, y: 64 },
    grandmother: { name: 'Grandmother', say: 'Lakita’s grandmother', row: 0, x: 316, y: 64 },
    aunt1: { name: 'Aunt', short: 'Aunt 1', say: 'First aunt', row: 1, x: 52, y: 256 },
    aunt2: { name: 'Aunt', short: 'Aunt 2', say: 'Second aunt', row: 1, x: 148, y: 256 },
    uncle: { name: 'Uncle', say: 'Uncle', row: 1, x: 244, y: 256 },
    aunt3: { name: 'Aunt', short: 'Aunt 3', say: 'Third aunt', row: 1, x: 340, y: 256 },
    father: { name: 'Father', say: 'Lakita’s father', row: 1, x: 436, y: 256 },
    mother: { name: 'Mother', say: 'Lakita’s mother', row: 1, x: 532, y: 256 },
    lakita: { name: 'Lakita', say: 'Lakita, daughter', row: 2, x: 484, y: 434 }
  };
  const ROWS = [['grandfather', 'grandmother'], ['aunt1', 'aunt2', 'uncle', 'aunt3', 'father', 'mother'], ['lakita']];
  const ORDER = ['lakita', 'father', 'mother', 'grandfather', 'grandmother', 'aunt1', 'aunt2', 'uncle', 'aunt3'];
  const GENOS = ['AA', 'AB', 'BB'];
  const GENO_WORDS = { AA: 'both fix', AB: 'one fixes, one does not', BB: 'neither fixes' };

  function person(L, id) { return L.LAKITA.persons.find(function (p) { return p.id === id; }); }
  function cleanGuesses(L, g) {
    const out = {};
    if (!g || typeof g !== 'object') return out;
    L.LAKITA.persons.forEach(function (p) {
      const list = L.normalizeGuess(g[p.id]);
      if (list.length) out[p.id] = list;
    });
    return out;
  }
  const orList = list => list.length < 2 ? list.join('') : list.slice(0, -1).join(', ') + ' or ' + list[list.length - 1];
  function badgeText(guess) { return guess.length ? guess.join(', ') : ''; }

  // Why can this person not have this genotype? Friendly, one sentence. Uses the logic file's reason first.
  function reasonImpossible(L, id, genotype) {
    const p = person(L, id), base = L.explainImpossible(L.LAKITA, id, genotype);
    if (!p || base !== 'The parents cannot pass on that combination.' || !p.parents) return base;
    const poss = L.possibleGenotypes(L.LAKITA);
    for (const pid of p.parents) {
      const only = poss[pid];
      if (!only.some(function (g) { return g.includes('B'); }) && genotype.includes('B')) return META[pid].say + ' has only A alleles (' + only[0] + '), so a B cannot come from that side.';
    }
    return base;
  }
  // The scene's answer for one person: { status, text, marks:{AA:'ok'|'bad'|null,...}, possible }.
  function feedback(L, id, guessRaw) {
    const p = person(L, id), name = /^(aunt|uncle)/.test(id) ? 'this ' + META[id].name.toLowerCase() : id === 'lakita' ? 'Lakita' : META[id].say;
    const r = L.checkGuess(L.LAKITA, id, guessRaw), g = L.normalizeGuess(guessRaw), marks = {};
    GENOS.forEach(function (x) { marks[x] = g.includes(x) ? (r.possible.includes(x) ? 'ok' : 'bad') : null; });
    let text;
    if (r.status === 'empty') text = 'Pick every genotype that could be true for ' + name + '.';
    else if (r.status === 'wrong') text = 'Not quite: ' + r.impossible[0] + ' is not possible. ' + reasonImpossible(L, id, r.impossible[0]);
    else if (r.status === 'incomplete') text = 'Good so far. ' + (p.untested ? 'This person was not tested, so ' + (r.missing.length === 1 ? 'one' : r.missing.length) : (r.missing.length === 1 ? 'One' : r.missing.length)) + ' more could also be true.';
    else if (r.possible.length > 1) text = 'Yes! Could be either ' + orList(r.possible) + '.' + (p.untested ? ' This person was not tested, so we cannot tell.' : '');
    else text = 'Yes! ' + (p.knownGenotype ? 'The lesson says testing found ' + r.possible[0] + '.' : 'Only ' + r.possible[0] + ' fits.');
    return { status: r.status, text: text, marks: marks, possible: r.possible };
  }
  function hint(L, id) {
    const p = person(L, id);
    if (p.knownGenotype) return 'Hint: this person was tested, and the lesson says the result was ' + p.knownGenotype + '.';
    if (p.affected) return 'Hint: shaded means cancer related to p53, so at least one allele is B. Which genotypes still fit the parents?';
    if (p.untested) return 'Hint: not tested, so think about what the parents could pass on. More than one answer can fit.';
    return 'Hint: think about which alleles the parents could pass on.';
  }
  function ariaLabel(L, id, guessRaw) {
    const p = person(L, id), m = META[id], g = L.normalizeGuess(guessRaw);
    const bits = [m.say, p.sex === 'M' ? 'male' : 'female'];
    bits.push(p.affected ? 'shaded: cancer related to p53' : 'not shaded');
    if (p.deceased) bits.push('deceased');
    if (p.untested) bits.push('not tested');
    if (id === 'lakita') bits.splice(1, 1); // "Lakita, daughter" already says it
    if (!g.length) bits.push('no genotype guess yet');
    else {
      const f = feedback(L, id, g);
      bits.push('genotype guess ' + orList(g) + (f.status === 'correct' ? ', matches the model' : f.status === 'wrong' ? ', not possible' : ', more could be true'));
    }
    return bits.join(', ');
  }
  function describe(L, guessesRaw) {
    const guesses = cleanGuesses(L, guessesRaw), ids = Object.keys(guesses);
    let t = 'Text description: Lakita’s grandfather (not shaded; testing found AA) and grandmother (shaded, deceased) have five children: an aunt not tested, a shaded deceased aunt, a shaded deceased uncle, an aunt not tested, and Lakita’s father (shaded, deceased). Lakita’s father and her mother (not shaded; testing found AA) have Lakita (shaded). Square means male, circle means female, a slash means deceased, and a question mark means not tested.';
    if (!ids.length) return t + ' No genotype picks yet.';
    return t + ' Your picks: ' + ORDER.filter(function (id) { return guesses[id]; }).map(function (id) {
      const f = feedback(L, id, guesses[id]);
      return META[id].say + ' ' + orList(guesses[id]) + (f.status === 'correct' ? ' (matches the model)' : f.status === 'wrong' ? ' (not possible)' : ' (more could be true)');
    }).join('; ') + '.';
  }
  // Arrow-key movement. rows: ROWS. Left/Right along a row, Up/Down to the nearest person in the next row, Home/End row ends.
  // "Next person" follows the drawing: top generation first, left to right, then the next row down, and back to the top.
  function nextPerson(from) { const all = [].concat.apply([], ROWS), i = all.indexOf(from); return all[(i + 1) % all.length]; }
  function navigate(from, key) {
    let r = ROWS.findIndex(function (row) { return row.includes(from); });
    if (r < 0) return from;
    const row = ROWS[r], i = row.indexOf(from);
    if (key === 'ArrowLeft') return row[Math.max(0, i - 1)];
    if (key === 'ArrowRight') return row[Math.min(row.length - 1, i + 1)];
    if (key === 'Home') return row[0];
    if (key === 'End') return row[row.length - 1];
    const dr = key === 'ArrowUp' ? -1 : key === 'ArrowDown' ? 1 : 0;
    if (!dr || !ROWS[r + dr]) return from;
    const x = META[from].x;
    return ROWS[r + dr].slice().sort(function (a, b) { return Math.abs(META[a].x - x) - Math.abs(META[b].x - x); })[0];
  }
  // The Punnett-style square for "how Lakita got her alleles", from the solver (not typed in).
  function punnett(L) {
    const poss = L.possibleGenotypes(L.LAKITA), f = poss.father[0], m = poss.mother[0], lk = poss.lakita[0];
    const rows = f.split(''), cols = m.split('');
    const cells = rows.map(function (a) { return cols.map(function (b) { return [a, b].sort().join(''); }); });
    // Lakita is shaded, so she has a B: she got it from the parent who has one.
    const fatherGives = f.includes('B') && !m.includes('B') ? 'B' : rows[0], motherGives = m.includes('B') && !f.includes('B') ? 'B' : cols[0];
    const r = rows.indexOf(fatherGives), c = cols.indexOf(motherGives);
    return { father: f, mother: m, lakita: lk, rows, cols, cells, fatherGives, motherGives, hit: [r, c], ok: [r, c].every(function (v) { return v >= 0; }) && cells[r][c] === lk,
      steps: [
        'Lakita’s father is ' + f + '. He passes on one allele to Lakita: here, his ' + fatherGives + '.',
        'Lakita’s mother is ' + m + '. She can only pass on an ' + motherGives + '.',
        fatherGives + ' from her father + ' + motherGives + ' from her mother = ' + lk + '. His ' + fatherGives + ' was in his sperm cells from birth.'] };
  }
  function summary(L, guessesRaw) {
    const g = cleanGuesses(L, guessesRaw);
    const done = L.LAKITA.persons.filter(function (p) { return g[p.id] && feedback(L, p.id, g[p.id]).status === 'correct'; }).length;
    return { done: done, total: L.LAKITA.persons.length, picked: Object.keys(g).length };
  }
  const pure = { META, ROWS, ORDER, nextPerson, GENOS, GENO_WORDS, cleanGuesses, feedback, hint, reasonImpossible, ariaLabel, describe, navigate, punnett, summary, orList, badgeText };

  /* ---------- the scene ---------- */
  const NS = 'http://www.w3.org/2000/svg';
  const CSS = '.ped-ui{display:grid;gap:10px}' +
    '.ped-toolbar{display:flex;flex-wrap:wrap;gap:8px;align-items:center}' +
    '.ped-seg{display:inline-flex;border:1px solid var(--line);border-radius:var(--r-sm);overflow:hidden;background:var(--surface)}' +
    '.ped-seg button{font:inherit;font-weight:600;font-size:.9rem;min-height:40px;padding:6px 14px;border:0;background:transparent;color:var(--ink);cursor:pointer}' +
    '.ped-seg button+button{border-left:1px solid var(--line)}.ped-seg button[aria-pressed=true]{background:var(--accent-soft);box-shadow:inset 0 -3px 0 var(--accent)}' +
    '.ped-tool{min-height:40px}.ped-tool[aria-pressed=true]{background:var(--accent-soft);border-color:var(--accent)}' +
    '.ped-figure{border:1px solid var(--line);border-radius:var(--r);background:var(--surface-2);padding:2px}' +
    'svg.ped-svg{display:block;width:100%;max-width:760px;height:auto;margin:0 auto;aspect-ratio:' + VIEW_W + '/' + VIEW_H + ';touch-action:manipulation}' +
    '.ped-svg text{font-family:var(--f-body);fill:var(--ink);font-size:21px;font-weight:600}.ped-svg .ped-gen{fill:var(--muted);font-size:20px;font-weight:700}' +
    '.ped-svg .ped-line{stroke:var(--ink);stroke-width:2.5;fill:none}.ped-svg .ped-link.is-hl{stroke:var(--accent);stroke-width:5}' +
    '.ped-svg .ped-sym{fill:var(--surface);stroke:var(--ink);stroke-width:2.5}.ped-svg .ped-sym.is-shaded{fill:url(#ped-hatch)}' +
    '.ped-svg .ped-slash{stroke:var(--ink);stroke-width:3;fill:none}.ped-svg .ped-q{font-size:30px;font-weight:700;text-anchor:middle}' +
    '.ped-svg .ped-hit{fill:transparent;stroke:none;cursor:pointer}.ped-svg .ped-ring{fill:none;stroke:var(--accent);stroke-width:4;opacity:0}' +
    '.ped-person{outline:none;cursor:pointer}.ped-person:focus-visible .ped-ring{opacity:1;stroke-dasharray:0}' +
    '.ped-person.is-sel .ped-ring{opacity:1;stroke-dasharray:7 4}.ped-person.is-sel:focus-visible .ped-ring{stroke-dasharray:0}' +
    '.ped-person.is-sel .ped-sym,.ped-person.is-hl .ped-sym{stroke:var(--accent);stroke-width:4}' +
    '.ped-svg .ped-badge{fill:var(--surface);stroke:var(--line);stroke-width:1.5}.ped-svg .ped-badge.ok{fill:var(--ok-soft);stroke:var(--ok)}.ped-svg .ped-badge.bad{fill:var(--bad-soft);stroke:var(--bad)}.ped-svg .ped-badge.part{fill:var(--warn-soft);stroke:var(--warn)}' +
    '.ped-svg .ped-chr{fill:var(--surface);stroke:var(--ink);stroke-width:2}.ped-svg .ped-band.A{fill:var(--s3)}.ped-svg .ped-band.B{fill:var(--s2)}.ped-svg .ped-band.Q{fill:var(--muted)}' +
    '.ped-panel{border:1px solid var(--line);border-radius:var(--r);background:var(--surface);padding:12px 14px;display:grid;gap:8px;align-content:start;min-height:196px}' +
    '.ped-panel h4{margin:0;font-size:1.02rem}.ped-msg{margin:0;font-weight:600;min-height:2.8em}.ped-msg[data-state=correct]{color:var(--ok)}.ped-msg[data-state=wrong]{color:var(--bad)}' +
    '.ped-chips{display:flex;flex-wrap:wrap;gap:8px}.ped-chip{font:inherit;display:grid;gap:0;justify-items:center;min-width:104px;min-height:56px;padding:6px 12px;border:2px solid var(--line);border-radius:var(--r-sm);background:var(--surface);color:var(--ink);cursor:pointer}' +
    '.ped-chip b{font-family:var(--f-mono);font-size:1.15rem}.ped-chip small{font-size:.78rem;color:var(--muted)}.ped-chip[aria-pressed=true]{border-color:var(--accent);background:var(--accent-soft)}' +
    '.ped-chip.ok{border-color:var(--ok);background:var(--ok-soft)}.ped-chip.bad{border-color:var(--bad);background:var(--bad-soft)}.ped-chip:hover{border-color:var(--accent)}' +
    '.ped-actions{display:flex;flex-wrap:wrap;gap:8px;align-items:center}.ped-note{margin:0;font-size:.84rem;color:var(--muted)}' +
    '.ped-punnett{border-collapse:collapse;margin:2px 0}.ped-punnett th,.ped-punnett td{border:1px solid var(--line);padding:8px 14px;text-align:center;font-family:var(--f-mono);font-size:1.05rem;min-width:64px}' +
    '.ped-punnett th{background:var(--surface-2);font-weight:700}.ped-punnett .is-hl{background:var(--accent-soft);box-shadow:inset 0 0 0 3px var(--accent)}.ped-punnett td{color:var(--muted)}.ped-punnett td.is-hl,.ped-punnett td.is-pick{color:var(--ink);font-weight:700}' +
    '.ped-punnett caption{caption-side:top;text-align:left;font-size:.84rem;color:var(--muted);padding-bottom:4px}' +
    '@media (prefers-reduced-motion:no-preference){.ped-svg .ped-sym,.ped-svg .ped-ring,.ped-punnett td,.ped-punnett th{transition:all .18s ease}}' +
    '@media (max-width:480px){.ped-chip{min-width:84px;flex:1 1 84px}.ped-tool{flex:1 1 100%}}';

  function mount(host, api) {
    const L = api.logic;
    const desc = host.querySelector('.scene-desc'), canvas = host.querySelector('canvas');
    if (!L || !desc) throw new Error('pedigree scene: host is incomplete');
    if (!document.getElementById('ped-scene-css')) { const st = document.createElement('style'); st.id = 'ped-scene-css'; st.textContent = CSS; document.head.appendChild(st); }
    const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
    const svgEl = (tag, attrs) => { const e = document.createElementNS(NS, tag); Object.keys(attrs || {}).forEach(function (k) { const v = String(attrs[k]); if (v.indexOf('var(') >= 0 && e.style) e.style.setProperty(k, v); else e.setAttribute(k, v); }); return e; };

    /* state */
    const saved = api.getState().pedigree || {};
    let guesses = cleanGuesses(L, saved.guesses);
    let view = saved.view === 'chromosome' ? 'chromosome' : 'pedigree';
    let sel = null, mode = 'choose', step = 0, tabStop = 'grandfather';
    let lastMsg = '';
    function persist() { api.saveState('pedigree', { guesses: guesses, view: view, updatedAt: Date.now() }); }

    /* skeleton */
    const ui = el('div', 'ped-ui');
    const bar = el('div', 'ped-toolbar'), seg = el('div', 'ped-seg');
    seg.setAttribute('role', 'group'); seg.setAttribute('aria-label', 'View');
    const bTree = el('button', '', 'Family tree'), bChr = el('button', '', 'Chromosome 17 pair');
    [bTree, bChr].forEach(function (b) { b.type = 'button'; seg.appendChild(b); });
    const bHow = el('button', 'btn ped-tool', 'Show how Lakita got her alleles'); bHow.type = 'button';
    bar.append(seg, bHow);
    const fig = el('div', 'ped-figure');
    const svg = svgEl('svg', { class: 'ped-svg', viewBox: '0 0 ' + VIEW_W + ' ' + VIEW_H, role: 'group', 'aria-label': 'Lakita’s family pedigree. Use the arrow keys to move between people and Enter to choose genotypes.' });
    fig.appendChild(svg);
    const panel = el('div', 'ped-panel');
    const foot = el('p', 'ped-note', 'A learning model, not a prediction for any person. Having a B raises the chance of cancer; it does not mean someone will get it, and nobody is to blame.');
    ui.append(bar, fig, panel, foot);
    if (canvas) canvas.remove();
    host.insertBefore(ui, desc);
    host.classList.add('ped-host');

    /* drawing: lines, then people */
    const defs = svgEl('defs');
    const pat = svgEl('pattern', { id: 'ped-hatch', width: 8, height: 8, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' });
    pat.append(svgEl('rect', { width: 8, height: 8, fill: 'var(--accent-soft)' }), svgEl('line', { x1: 0, y1: 0, x2: 0, y2: 8, stroke: 'var(--accent)', 'stroke-width': 3 }));
    defs.appendChild(pat); svg.appendChild(defs);
    [['I', 64], ['II', 256], ['III', 434]].forEach(function (g) { const t = svgEl('text', { class: 'ped-gen', x: 6, y: g[1] + 7 }); t.textContent = g[0]; t.setAttribute('aria-hidden', 'true'); svg.appendChild(t); });
    const M = META, half = S / 2, L1 = 204;
    const line = (x1, y1, x2, y2, extra) => { const l = svgEl('path', { class: 'ped-line' + (extra || ''), d: 'M' + x1 + ' ' + y1 + ' L' + x2 + ' ' + y2 }); svg.appendChild(l); return l; };
    // marriage line of the grandparents, drop and sibship line
    const gmx = (M.grandfather.x + M.grandmother.x) / 2;
    line(M.grandfather.x + half, M.grandfather.y, M.grandmother.x - half, M.grandmother.y);
    line(gmx, M.grandfather.y, gmx, L1);
    line(M.aunt1.x, L1, M.father.x, L1);
    ['aunt1', 'aunt2', 'uncle', 'aunt3', 'father'].forEach(function (id) { line(M[id].x, L1, M[id].x, M[id].y - half); });
    // father and mother, and Lakita's descent line
    const linkFM = line(M.father.x + half, M.father.y, M.mother.x - half, M.mother.y, ' ped-link');
    const mid = (M.father.x + M.mother.x) / 2;
    const linkL = line(mid, M.father.y, mid, M.lakita.y - half, ' ped-link');
    const els = {};
    function drawPerson(p) {
      const m = M[p.id], g = svgEl('g', { class: 'ped-person', role: 'button', tabindex: '-1', 'data-person': p.id, 'data-sex': p.sex === 'M' ? 'male' : 'female',
        'data-shaded': p.affected ? '1' : '0', 'data-deceased': p.deceased ? '1' : '0', 'data-untested': p.untested ? '1' : '0' });
      g.appendChild(svgEl('rect', { class: 'ped-hit', x: m.x - 47, y: m.y - half - 6, width: 94, height: S + 118 }));
      const ring = p.sex === 'M' ? svgEl('rect', { class: 'ped-ring', x: m.x - half - 7, y: m.y - half - 7, width: S + 14, height: S + 14, rx: 5 }) : svgEl('circle', { class: 'ped-ring', cx: m.x, cy: m.y, r: half + 8 });
      g.appendChild(ring);
      const sym = p.sex === 'M' ? svgEl('rect', { x: m.x - half, y: m.y - half, width: S, height: S }) : svgEl('circle', { cx: m.x, cy: m.y, r: half });
      sym.setAttribute('class', 'ped-sym' + (p.affected ? ' is-shaded' : ''));
      g.appendChild(sym);
      if (p.untested) { const q = svgEl('text', { class: 'ped-q', x: m.x, y: m.y + 10 }); q.textContent = '?'; g.appendChild(q); }
      if (p.deceased) g.appendChild(svgEl('path', { class: 'ped-slash', d: 'M' + (m.x - half - 9) + ' ' + (m.y + half + 9) + ' L' + (m.x + half + 9) + ' ' + (m.y - half - 9) }));
      const lab = svgEl('text', { x: m.x, y: m.y + half + 24, 'text-anchor': 'middle' }); lab.textContent = m.short || m.name; g.appendChild(lab);
      const dyn = svgEl('g', { class: 'ped-dyn' }); g.appendChild(dyn);
      svg.appendChild(g);
      els[p.id] = { g: g, dyn: dyn };
      g.addEventListener('click', function () { choose(p.id, false); });
      g.addEventListener('focus', function () { tabStop = p.id; setTabs(); });
      g.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(p.id, true); return; }
        if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) { e.preventDefault(); const to = navigate(p.id, e.key); tabStop = to; setTabs(); els[to].g.focus(); }
      });
    }
    let drawFailed = false;
    try { L.LAKITA.persons.forEach(drawPerson); } catch (err) { drawFailed = true; fig.appendChild(el('p', 'ped-note', 'The picture could not be drawn in this browser. Use the text description below.')); }
    function setTabs() { if (drawFailed) return; Object.keys(els).forEach(function (id) { els[id].g.setAttribute('tabindex', id === tabStop ? '0' : '-1'); }); }

    function chromIcon(parent, cx, top, genotype) {
      const known = genotype && genotype.length === 2 ? genotype.split('') : ['?', '?'];
      known.forEach(function (a, i) {
        const x = cx + (i ? 14 : -14), cls = a === '?' ? 'Q' : a;
        parent.appendChild(svgEl('rect', { class: 'ped-chr', x: x - 7, y: top, width: 14, height: 36, rx: 7 }));
        parent.appendChild(svgEl('rect', { class: 'ped-band ' + cls, x: x - 7, y: top + 9, width: 14, height: 9 }));
        const t = svgEl('text', { x: x, y: top + 58, 'text-anchor': 'middle' }); t.textContent = a; parent.appendChild(t);
      });
    }
    function drawDyn(id) {
      const m = M[id], dyn = els[id].dyn, g = guesses[id] || [], f = g.length ? feedback(L, id, g) : null;
      dyn.replaceChildren();
      const y = m.y + half + 62;
      if (view === 'chromosome') chromIcon(dyn, m.x, y - 22, g.length === 1 ? g[0] : null);
      else if (g.length) {
        const txt = g.length > 2 ? '3 picks' : badgeText(g), glyph = f.status === 'correct' ? '✓ ' : f.status === 'wrong' ? '✕ ' : '○ ';
        const w = Math.max(56, (glyph.length + txt.length) * 11 + 14);
        dyn.appendChild(svgEl('rect', { class: 'ped-badge ' + (f.status === 'correct' ? 'ok' : f.status === 'wrong' ? 'bad' : 'part'), x: m.x - w / 2, y: y - 18, width: w, height: 28, rx: 14 }));
        const t = svgEl('text', { x: m.x, y: y + 2, 'text-anchor': 'middle' }); t.textContent = glyph + txt; dyn.appendChild(t);
      } else {
        dyn.appendChild(svgEl('rect', { class: 'ped-badge', x: m.x - 30, y: y - 18, width: 60, height: 28, rx: 14, 'stroke-dasharray': '4 3' }));
        const t = svgEl('text', { x: m.x, y: y + 2, 'text-anchor': 'middle', style: 'fill:var(--muted);font-weight:500' }); t.textContent = 'pick'; dyn.appendChild(t);
      }
    }

    /* panel */
    const msg = (text, state) => { const p = el('p', 'ped-msg', text); if (state) p.dataset.state = state; p.setAttribute('data-ped-msg', ''); return p; };
    function renderPanel(focusChip) {
      panel.replaceChildren();
      if (mode === 'trace') return renderTrace();
      if (!sel) {
        const s = summary(L, guesses);
        panel.append(el('h4', '', 'Tap a person in the family tree'), msg('Then pick every genotype that could be true for them. A fixes mutations. B does not.'),
          el('p', 'ped-note', s.done + ' of ' + s.total + ' people match the model.'));
        return;
      }
      const p = person(L, sel), m = M[sel], g = guesses[sel] || [], f = feedback(L, sel, g);
      const title = (sel === 'lakita' ? 'Lakita' : m.say) + ' · ' + (p.sex === 'M' ? 'male' : 'female') + (p.affected ? ', shaded' : '') + (p.untested ? ', not tested' : '') + (p.deceased ? ', deceased' : '');
      panel.appendChild(el('h4', '', title));
      const chips = el('div', 'ped-chips'); chips.setAttribute('role', 'group'); chips.setAttribute('aria-label', 'Genotypes that could be true');
      GENOS.forEach(function (x) {
        const b = el('button', 'ped-chip' + (f.marks[x] ? ' ' + f.marks[x] : '')); b.type = 'button'; b.dataset.genotype = x;
        b.setAttribute('aria-pressed', g.includes(x) ? 'true' : 'false');
        const bb = el('b', '', (f.marks[x] === 'ok' ? '✓ ' : f.marks[x] === 'bad' ? '✕ ' : '') + x); b.append(bb, el('small', '', GENO_WORDS[x]));
        b.setAttribute('aria-label', x + ', ' + GENO_WORDS[x] + (f.marks[x] === 'ok' ? ', possible' : f.marks[x] === 'bad' ? ', not possible' : ''));
        b.addEventListener('click', function () { toggle(x); });
        chips.appendChild(b);
      });
      panel.appendChild(chips);
      panel.appendChild(msg(lastMsg || f.text, lastMsg ? f.status : (f.status === 'empty' ? '' : f.status)));
      const act = el('div', 'ped-actions');
      const nx = el('button', 'btn btn--sm', 'Next person'), hb = el('button', 'btn btn--sm', 'Hint'), cl = el('button', 'btn btn--sm btn--ghost', 'Clear this person');
      [nx, hb, cl].forEach(function (b) { b.type = 'button'; act.appendChild(b); });
      nx.addEventListener('click', function () { choose(nextPerson(sel), false); });
      hb.addEventListener('click', function () { const t = hint(L, sel); lastMsg = t; renderPanel(); api.announce(t); });
      cl.addEventListener('click', function () { delete guesses[sel]; lastMsg = ''; persist(); refresh(); api.announce('Cleared.'); });
      panel.appendChild(act);
      if (focusChip) { const first = panel.querySelector('.ped-chip'); if (first) first.focus(); }
    }
    panel.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      if (mode === 'trace') closeTrace(); else if (sel && els[sel]) els[sel].g.focus();
    });
    function renderTrace() {
      const P = punnett(L);
      panel.appendChild(el('h4', '', 'How Lakita got her alleles · step ' + (step + 1) + ' of 3'));
      const t = el('table', 'ped-punnett'); t.appendChild(el('caption', '', 'Punnett-style square. Rows: Lakita’s father’s alleles. Columns: Lakita’s mother’s alleles. Each box is one possible child.'));
      const head = el('tr'); head.appendChild(el('td')); head.firstChild.style.border = '0'; head.firstChild.style.background = 'none'; 
      P.cols.forEach(function (c) { const th = el('th', step === 1 ? 'is-hl' : '', c); th.scope = 'col'; th.title = 'Mother gives ' + c; head.appendChild(th); });
      const thead = el('thead'); thead.appendChild(head); t.appendChild(thead);
      const tb = el('tbody');
      P.rows.forEach(function (a, r) {
        const tr = el('tr'), th = el('th', step === 0 && r === P.hit[0] ? 'is-hl' : '', a); th.scope = 'row'; tr.appendChild(th);
        P.cells[r].forEach(function (cell, c) {
          const isHit = r === P.hit[0] && c === P.hit[1], td = el('td', (step === 2 && isHit ? 'is-hl' : '') + (step === 2 && isHit ? ' is-pick' : ''), (step === 2 && isHit ? '✓ ' : '') + cell);
          if (step === 2 && isHit) td.setAttribute('aria-label', cell + ', Lakita');
          tr.appendChild(td);
        });
        tb.appendChild(tr);
      });
      t.appendChild(tb); panel.appendChild(t);
      panel.appendChild(msg(P.steps[step]));
      const act = el('div', 'ped-actions');
      const back = el('button', 'btn btn--sm', 'Back'), next = el('button', 'btn btn--sm btn--primary', step < 2 ? 'Next' : 'Done'), close = el('button', 'btn btn--sm btn--ghost', 'Close');
      [back, next, close].forEach(function (b) { b.type = 'button'; act.appendChild(b); });
      back.disabled = step === 0;
      back.addEventListener('click', function () { step = Math.max(0, step - 1); refresh(); api.announce(P.steps[step]); });
      next.addEventListener('click', function () { if (step < 2) { step++; refresh(); api.announce(P.steps[step]); } else closeTrace(); });
      close.addEventListener('click', closeTrace);
      panel.appendChild(act);
    }
    function closeTrace() { mode = 'choose'; refresh(); bHow.focus(); }

    /* actions */
    function choose(id, focusChip) {
      mode = 'choose'; sel = id; lastMsg = ''; tabStop = id;
      refresh(focusChip);
      api.announce(M[id].say + ' selected. ' + (guesses[id] ? feedback(L, id, guesses[id]).text : 'Pick every genotype that could be true.'));
    }
    function toggle(x) {
      const cur = new Set(guesses[sel] || []);
      if (cur.has(x)) cur.delete(x); else cur.add(x);
      const next = GENOS.filter(function (v) { return cur.has(v); });
      if (next.length) guesses[sel] = next; else delete guesses[sel];
      lastMsg = ''; persist();
      const f = feedback(L, sel, next);
      refresh();
      const chip = panel.querySelector('.ped-chip[data-genotype="' + x + '"]'); if (chip) chip.focus();
      api.announce(f.text);
    }
    function refresh(focusChip) {
      svg.setAttribute('aria-label', 'Lakita’s family pedigree. Use the arrow keys to move between people and Enter to choose genotypes.');
      if (!drawFailed) L.LAKITA.persons.forEach(function (p) {
        const e = els[p.id];
        e.g.setAttribute('aria-label', ariaLabel(L, p.id, guesses[p.id]));
        e.g.classList.toggle('is-sel', mode === 'choose' && sel === p.id);
        e.g.classList.toggle('is-hl', mode === 'trace' && ['father', 'mother', 'lakita'].includes(p.id));
        e.g.setAttribute('aria-pressed', mode === 'choose' && sel === p.id ? 'true' : 'false');
        drawDyn(p.id);
      });
      [linkFM, linkL].forEach(function (l) { l.classList.toggle('is-hl', mode === 'trace'); });
      bTree.setAttribute('aria-pressed', view === 'pedigree' ? 'true' : 'false'); bChr.setAttribute('aria-pressed', view === 'chromosome' ? 'true' : 'false');
      bHow.setAttribute('aria-pressed', mode === 'trace' ? 'true' : 'false');
      desc.textContent = describe(L, guesses);
      setTabs(); renderPanel(focusChip);
    }
    bTree.addEventListener('click', function () { view = 'pedigree'; persist(); refresh(); api.announce('Family tree view.'); });
    bChr.addEventListener('click', function () { view = 'chromosome'; persist(); refresh(); api.announce('Chromosome 17 view. Each pair shows the p53 allele on each chromosome, where you picked one genotype.'); });
    bHow.addEventListener('click', function () { if (mode === 'trace') { closeTrace(); return; } mode = 'trace'; step = 0; refresh(); api.announce(punnett(L).steps[0]); });
    refresh();
  }
  return { pure: pure, mount: mount };
});
