/* Scene 4 of the Lessons 8-9 companion: skin cancer data explorer (host #skin-data-scene, id 'skin').
   Contract: docs/b3-inheritance-scenes.md. Pure logic is in the UMD wrapper (module.exports for Node tests, window.B3SkinLogic in the page).

   WHAT THIS SHOWS (assumptions)
   - Three scatterplots like the lesson's Skin Cancer Data figures (Eide MJ, Weinstock MA. Arch Dermatol 2005;141(4):477-481,
     doi:10.1001/archderm.141.4.477): melanoma incidence against average annual UV index (1997) for 11 SEER registry sites.
     The lesson's y axes differ (White to 50, Black to 1.8, Hispanic to 12) and the figure does not state the y-axis unit.
   - The numbers are APPROXIMATE readings of the lesson's figures (logic.SKIN_READINGS, measured from the figure pixels), not the paper's
     table. The owner verifies them against the paper before release. In the White figure the y tick labels under 20 read 10 and 5
     where equal 5-unit steps would read 15 and 10; the readings continue the 5-unit steps above 20.
   - Group labels follow the lesson (White, Black, Hispanic). The study's groups were White non-Hispanic, Black and Black-Hispanic, and
     White Hispanic. They are registry groups, not a biological split of people. Only incidence (new cases) is shown; mortality is not.
   - The optional trend line is an ordinary least-squares line with Pearson r, for describing a pattern only, not showing a cause.
   Saved state: skin = { viewed:{white,black,hispanic}, scale:'same'|'own', polls:{ id: optionId }, updatedAt }. "Viewed" means the student
   selected or focused a point in that graph (or opened its tab on a narrow screen). */
(function (root, factory) {
  const M = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = M.logic;
  else { root.B3SkinLogic = M.logic; (root.B3InhScenes = root.B3InhScenes || []).push({ id: 'skin', mount: M.mount }); }
})(typeof self !== 'undefined' ? self : this, function (root) {
  'use strict';
  const NODE = typeof module === 'object' && module.exports;
  const BASE = NODE ? require('./openscied-b3-inheritance-logic.js') : root.B3InheritanceLogic;

  /* ---------- pure logic ---------- */
  const GROUPS = ['white', 'black', 'hispanic'];
  const AXES = { white: { max: 50, step: 10 }, black: { max: 1.8, step: 0.2 }, hispanic: { max: 12, step: 2 } };
  const SAME_AXIS = { max: 50, step: 10 };
  const X_AXIS = { max: 12, step: 2 };
  const NOTE_APPROX = 'Values are approximate readings of the lesson’s figures, not exact data. The figure does not state the y-axis unit.';
  const CITATION = 'Eide MJ, Weinstock MA. Arch Dermatol 2005;141(4):477–481, doi:10.1001/archderm.141.4.477';
  const points = g => (BASE.SKIN_READINGS[g] || []).map(p => ({ site: p.site, uv: p.uv, rate: p.rate }));
  const axisFor = (g, scale) => scale === 'same' ? SAME_AXIS : AXES[g];
  const mean = a => a.reduce((s, x) => s + x, 0) / Math.max(1, a.length);
  const meanRate = g => mean(points(g).map(p => p.rate));
  const ratio = (a, b) => meanRate(a) / meanRate(b);
  const rateAt = (g, site) => { const p = points(g).find(q => q.site === site); return p ? p.rate : null; };
  const rank = (g, site) => points(g).slice().sort((a, b) => b.rate - a.rate).findIndex(p => p.site === site) + 1;   // 1 = highest (ties: first listed)
  const topSites = (g, n) => points(g).slice().sort((a, b) => b.rate - a.rate).slice(0, n).map(p => p.site);
  const highestUV = () => points('white').slice().sort((a, b) => b.uv - a.uv)[0].site;
  function trend(g) {
    const p = points(g), xs = p.map(q => q.uv), ys = p.map(q => q.rate), mx = mean(xs), my = mean(ys);
    let sxy = 0, sxx = 0; xs.forEach((x, i) => { sxy += (x - mx) * (ys[i] - my); sxx += (x - mx) * (x - mx); });
    const slope = sxx ? sxy / sxx : 0;
    return { slope, intercept: my - slope * mx, r: BASE.pearson(xs, ys) };
  }
  const fmt = (g, v) => v == null ? '—' : g === 'black' ? v.toFixed(1) : (Math.round(v * 10) / 10 === Math.round(v) ? String(Math.round(v)) : v.toFixed(1));
  // Label placement: first of right, left, above, below that stays inside the plot and misses every marker and earlier label. Null = no room.
  function placeLabels(items, box, fs, charW) {
    const placed = [], out = {}, R = 9, cw = charW || 0.56;
    const hit = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    items.slice().sort((a, b) => a.y - b.y).forEach(it => {
      const w = it.text.length * fs * cw, h = fs + 2;
      const cands = [{ x: it.x + R, y: it.y - h / 2, a: 'start' }, { x: it.x - R - w, y: it.y - h / 2, a: 'end' }, { x: it.x - w / 2, y: it.y - R - h, a: 'middle' }, { x: it.x - w / 2, y: it.y + R, a: 'middle' }];
      for (const c of cands) {
        const r = { x: c.x, y: c.y, w, h };
        if (r.x < box.l || r.x + w > box.r || r.y < box.t || r.y + h > box.b) continue;
        if (placed.some(q => hit(r, q))) continue;
        if (items.some(o => hit(r, { x: o.x - R, y: o.y - R, w: 2 * R, h: 2 * R }))) continue;
        placed.push(r); out[it.site] = { x: c.a === 'start' ? r.x : c.a === 'end' ? r.x + w : r.x + w / 2, y: r.y + h - 3, anchor: c.a }; break;
      }
    });
    return out;
  }
  const POLLS = [
    { id: 'high-white', q: 'Which site has the highest rate in the White graph?', options: ['Hawaii', 'Atlanta', 'Utah'], answer: () => topSites('white', 1)[0],
      right: 'Yes. Hawaii has the highest UV index of the 11 sites and the highest rate in this graph.',
      wrong: { Atlanta: 'Atlanta is second. Look for the dot at the very top.', Utah: 'Utah is in the lower half in this graph. Tap the top dot to see its name.' } },
    { id: 'hawaii-hisp', q: 'Hawaii has the highest UV index. In the Hispanic graph, its rate is…', options: ['The highest', 'About in the middle', 'The lowest'], answer: () => rank('hispanic', 'Hawaii') === 11 ? 'The lowest' : 'x',
      right: 'Yes. Hawaii has the most UV but the lowest rate in this graph (about 0 in the figure). So UV alone does not explain the pattern here.',
      wrong: { 'The highest': 'Tap Hawaii in the Hispanic graph. It sits at the bottom, not the top.', 'About in the middle': 'Tap Hawaii in the Hispanic graph. It sits at the very bottom.' } },
    { id: 'top-both', q: 'Which site is in the top two of both the White graph and the Hispanic graph?', options: ['Atlanta', 'Hawaii', 'Utah', 'Iowa'], answer: () => topSites('white', 2).filter(s => topSites('hispanic', 2).includes(s))[0],
      right: 'Yes. Atlanta is near the top in both, yet its UV index (about 5) is in the middle. Something besides UV differs between sites and groups. These graphs cannot say what.',
      wrong: { Hawaii: 'Hawaii is first in the White graph but last in the Hispanic graph.', Utah: 'Utah is high in the Hispanic graph but not in the top two of the White graph.', Iowa: 'Iowa is below the middle in both graphs.' } }
  ];
  function checkPoll(id, option) {
    const p = POLLS.find(x => x.id === id); if (!p || !option) return { status: 'empty', message: '' };
    return option === p.answer() ? { status: 'correct', message: p.right } : { status: 'wrong', message: 'Try again. ' + (p.wrong[option] || '') };
  }
  function describeGroup(g, scale) {
    const p = points(g), hi = p.slice().sort((a, b) => b.rate - a.rate)[0], lo = p.slice().sort((a, b) => a.rate - b.rate)[0], ax = axisFor(g, scale), t = trend(g);
    return BASE.SKIN_META.labels[g] + ' graph: ' + p.length + ' sites, y axis 0 to ' + ax.max + '. Highest rate about ' + fmt(g, hi.rate) + ' at ' + hi.site + ' (UV index ' + hi.uv.toFixed(1) + '), lowest about ' + fmt(g, lo.rate) + ' at ' + lo.site + '. Correlation r is ' + (t.r == null ? 'not defined' : t.r.toFixed(2)) + '.';
  }

  const logic = { GROUPS, AXES, SAME_AXIS, X_AXIS, NOTE_APPROX, CITATION, POLLS, points, axisFor, meanRate, ratio, rateAt, rank, topSites, highestUV, trend, fmt, placeLabels, checkPoll, describeGroup };
  if (NODE) return { logic };

  /* ---------- the scene ---------- */
  const SVGNS = 'http://www.w3.org/2000/svg';
  const CSS = `
.sk { display: grid; gap: 14px; min-width: 0; }
.sk * { box-sizing: border-box; }
.sk-row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.sk-chip { font: inherit; font-weight: 600; font-size: .88rem; padding: 4px 12px; min-height: 32px; border-radius: 999px; border: 1.5px solid var(--line); background: var(--surface); color: var(--ink); cursor: pointer; }
.sk-chip:hover { border-color: var(--accent); }
.sk-chip[aria-pressed="true"], .sk-chip[aria-expanded="true"] { background: var(--accent); border-color: var(--accent); color: var(--accent-ink); }
.sk-chip[aria-pressed="true"]::before { content: "\\2713\\00a0"; }
.sk-charts { display: grid; gap: 12px; grid-template-columns: 1fr; min-width: 0; }
.sk[data-layout="wide"] .sk-charts { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.sk-fig { margin: 0; padding: 8px; border: 1px solid var(--line); border-radius: var(--r); background: var(--surface); min-width: 0; display: grid; gap: 4px; align-content: start; }
.sk-fig[hidden] { display: none; }
.sk-fig h4 { margin: 0; font-size: 1rem; }
.sk-fig .sk-sub { margin: 0; font-size: .82rem; color: var(--muted); }
.sk[data-layout="narrow"] .sk-fig svg { max-width: 560px; margin: 0 auto; }
.sk svg { display: block; width: 100%; height: auto; }
.sk svg text { font-family: var(--f-body); fill: var(--ink); }
.sk .sk-grid { stroke: var(--grid); stroke-width: 1; }
.sk .sk-axis { stroke: var(--ink); stroke-width: 1.6; }
.sk .sk-tick { fill: var(--muted) !important; }
.sk .sk-trend { stroke: var(--ink); stroke-width: 1.8; stroke-dasharray: 6 4; fill: none; }
.sk .sk-pt .sk-mark { fill: var(--c); stroke: var(--surface); stroke-width: 1.5; }
.sk .sk-pt { cursor: pointer; outline: none; }
.sk .sk-pt .sk-hit { fill: transparent; }
.sk .sk-pt:focus-visible .sk-ring, .sk .sk-pt[aria-pressed="true"] .sk-ring { opacity: 1; }
.sk .sk-ring { fill: none; stroke: var(--ink); stroke-width: 2.4; opacity: 0; }
.sk .sk-pt[aria-pressed="true"] .sk-ring { stroke-dasharray: 3 2; }
.sk .sk-pt:focus-visible .sk-ring { stroke-dasharray: none; stroke: var(--accent); stroke-width: 3; }
.sk .sk-name { font-size: 12px; paint-order: stroke; stroke: var(--surface); stroke-width: 3px; stroke-linejoin: round; }
.sk-readout { padding: 10px 14px; border-left: 4px solid var(--accent); border-radius: 0 var(--r-sm) var(--r-sm) 0; background: var(--accent-soft); min-height: 5.2em; display: grid; gap: 2px; align-content: start; }
.sk-readout p { margin: 0; }
.sk-note { margin: 0; font-size: .85rem; color: var(--muted); }
.sk-panel { padding: 14px; border: 1px solid var(--line); border-radius: var(--r); background: var(--surface); display: grid; gap: 10px; min-width: 0; }
.sk-panel h4 { margin: 0; } .sk-panel p { margin: 0; }
.sk-tablewrap { overflow-x: auto; max-width: 100%; }
.sk-table { width: 100%; border-collapse: collapse; font-size: .9rem; }
.sk-table th, .sk-table td { padding: 4px 8px; text-align: left; border-bottom: 1px solid var(--line); white-space: nowrap; }
.sk-table tr[aria-current="true"] { background: var(--accent-soft); }
.sk-table .sk-site { font: inherit; font-weight: 650; background: none; border: 0; padding: 2px 4px; min-height: 28px; cursor: pointer; color: var(--accent); text-decoration: underline; }
.sk-poll { display: grid; gap: 6px; }
.sk-poll .sk-q { font-weight: 650; margin: 0; }
.sk-fb { min-height: 1.3em; font-weight: 600; margin: 0; }
.sk-fb[data-state="correct"] { color: var(--ok); } .sk-fb[data-state="correct"]::before { content: "\\2713\\00a0"; }
.sk-fb[data-state="wrong"] { color: var(--warn); }
.sk-explored { margin: 0; font-size: .9rem; }
.sk-framing { padding: 10px 14px; border: 1px solid var(--line); border-left: 4px solid var(--warn); border-radius: 0 var(--r-sm) var(--r-sm) 0; background: var(--warn-soft); font-size: .9rem; }
.sk-framing p { margin: 0 0 4px; } .sk-framing p:last-child { margin: 0; }
`;

  function mount(host, api) {
    const el = (tag, attrs, kids) => { const e = document.createElement(tag); Object.keys(attrs || {}).forEach(k => { if (k === 'text') e.textContent = attrs[k]; else if (k === 'class') e.className = attrs[k]; else e.setAttribute(k, attrs[k]); }); (kids || []).forEach(c => e.appendChild(c)); return e; };
    const sv = (tag, attrs, kids) => { const e = document.createElementNS(SVGNS, tag); Object.keys(attrs || {}).forEach(k => e.setAttribute(k, attrs[k])); (kids || []).forEach(c => e.appendChild(c)); return e; };
    const desc = document.getElementById('skin-data-desc');
    const LB = BASE.SKIN_META.labels, ORIG = BASE.SKIN_META.originalLabels;
    const COLOR = { white: 'var(--s3)', black: 'var(--s6)', hispanic: 'var(--s2)' };
    const SHAPE = { white: 'circle', black: 'square', hispanic: 'triangle' };
    const saved = (api.getState() || {}).skin || {};
    const S = { scale: saved.scale === 'same' ? 'same' : 'own', viewed: { white: !!(saved.viewed && saved.viewed.white), black: !!(saved.viewed && saved.viewed.black), hispanic: !!(saved.viewed && saved.viewed.hispanic) },
      polls: saved.polls && typeof saved.polls === 'object' ? Object.assign({}, saved.polls) : {}, names: true, trend: false, table: false, sel: null, tab: 'white',
      layout: window.innerWidth >= 1000 ? 'wide' : 'narrow' };
    function persist() { api.saveState('skin', { viewed: Object.assign({}, S.viewed), scale: S.scale, polls: Object.assign({}, S.polls), updatedAt: Date.now() }); }
    const style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style);
    host.replaceChildren(); host.dataset.sk = '1';
    const root = el('div', { class: 'sk' }); root.dataset.layout = S.layout; host.appendChild(root);

    root.appendChild(el('p', { class: 'sk-note', text: 'Each dot is one place (a cancer registry site). Tap a dot, or use the arrow keys and Enter, to see its value.' }));
    // controls
    const tabRow = el('div', { class: 'sk-row', role: 'group', 'aria-label': 'Choose a graph' });
    const tabBtns = {}; GROUPS.forEach(g => { const b = el('button', { type: 'button', class: 'sk-chip', 'data-tab': g, 'aria-pressed': 'false', text: LB[g] }); b.addEventListener('click', () => { S.tab = g; mark(g); render(); }); tabBtns[g] = b; tabRow.appendChild(b); });
    const scaleOwn = el('button', { type: 'button', class: 'sk-chip', 'data-scale': 'own', text: 'Own scale (as in the lesson)' });
    const scaleSame = el('button', { type: 'button', class: 'sk-chip', 'data-scale': 'same', text: 'Same scale (0 to 50)' });
    const namesBtn = el('button', { type: 'button', class: 'sk-chip', 'data-toggle': 'names', 'aria-pressed': 'true', text: 'Site names' });
    const trendBtn = el('button', { type: 'button', class: 'sk-chip', 'data-toggle': 'trend', 'aria-pressed': 'false', text: 'Trend line' });
    const tableBtn = el('button', { type: 'button', class: 'sk-chip', 'data-toggle': 'table', 'aria-expanded': 'false', text: 'Data table' });
    [scaleOwn, scaleSame].forEach(b => b.addEventListener('click', () => { S.scale = b.dataset.scale; persist(); render(); api.announce(S.scale === 'same' ? 'Same scale: every graph runs from 0 to 50. ' + scaleNote() : 'Own scale: each graph uses its own y axis, as in the lesson.'); }));
    namesBtn.addEventListener('click', () => { S.names = !S.names; render(); });
    trendBtn.addEventListener('click', () => { S.trend = !S.trend; render(); api.announce(S.trend ? 'Trend lines on. They describe the pattern only and do not show a cause.' : 'Trend lines off.'); });
    tableBtn.addEventListener('click', () => { S.table = !S.table; render(); });
    root.appendChild(el('div', { class: 'sk-row' }, [el('span', { class: 'sk-note', text: 'Y axis:' }), scaleOwn, scaleSame]));
    root.appendChild(el('div', { class: 'sk-row' }, [namesBtn, trendBtn, tableBtn]));
    const tabWrap = el('div', {}, [tabRow]); root.appendChild(tabWrap);
    const scaleLine = el('p', { class: 'sk-note', 'data-role': 'scale-note' }); root.appendChild(scaleLine);
    const charts = el('div', { class: 'sk-charts' }); root.appendChild(charts);
    const explored = el('p', { class: 'sk-explored', 'data-role': 'explored' }); root.appendChild(explored);
    const readout = el('div', { class: 'sk-readout', 'data-role': 'readout' }); root.appendChild(readout);
    const tableBox = el('div', { class: 'sk-panel', 'data-role': 'table-panel' }); root.appendChild(tableBox);
    const pollBox = el('div', { class: 'sk-panel' }, [el('h4', { text: 'Quick checks' })]); root.appendChild(pollBox);
    root.appendChild(el('div', { class: 'sk-framing' }, [
      el('p', { text: 'About the group labels: these are registry groups from the study (it used White non-Hispanic, Black and Black-Hispanic, and White Hispanic). They are not a biological split of people. Skin color and melanin vary within every group, and groups differ in many other ways.' }),
      el('p', { text: 'These graphs show new cases (incidence) only. Death statistics are not shown here.' }),
      el('p', { text: NOTE_APPROX + ' Source: ' + CITATION + ', as shown in the lesson’s figures.' })]));

    /* ----- charts ----- */
    const VW = 340, VH = 300, M = { l: 56, r: 14, t: 12, b: 58 };
    const PW = VW - M.l - M.r, PH = VH - M.t - M.b;
    const figs = {};
    function marker(g, x, y, r) {
      if (SHAPE[g] === 'square') return sv('rect', { class: 'sk-mark', x: x - r, y: y - r, width: 2 * r, height: 2 * r });
      if (SHAPE[g] === 'triangle') return sv('polygon', { class: 'sk-mark', points: x + ',' + (y - r * 1.3) + ' ' + (x + r * 1.25) + ',' + (y + r * 0.95) + ' ' + (x - r * 1.25) + ',' + (y + r * 0.95) });
      return sv('circle', { class: 'sk-mark', cx: x, cy: y, r });
    }
    function buildChart(g) {
      const ax = axisFor(g, S.scale), pts = points(g).sort((a, b) => a.uv - b.uv || a.rate - b.rate);
      const X = u => M.l + u / X_AXIS.max * PW, Y = v => M.t + PH - Math.min(v, ax.max) / ax.max * PH;
      const svg = sv('svg', { viewBox: '0 0 ' + VW + ' ' + VH, role: 'group', 'aria-label': LB[g] + ' graph, 11 points. ' + 'Use the arrow keys to move between points and Enter to select one.', focusable: 'false' });
      svg.style.aspectRatio = VW + ' / ' + VH;
      // grid and ticks
      for (let v = 0; v <= ax.max + 1e-9; v += ax.step) {
        const y = Y(v); svg.appendChild(sv('line', { class: 'sk-grid', x1: M.l, x2: M.l + PW, y1: y, y2: y }));
        const t = sv('text', { class: 'sk-tick', x: M.l - 8, y: y + 4, 'text-anchor': 'end', 'font-size': '12' }); t.textContent = ax.step < 1 ? v.toFixed(1) : String(Math.round(v)); svg.appendChild(t);
      }
      for (let u = 0; u <= X_AXIS.max; u += X_AXIS.step) {
        const x = X(u); svg.appendChild(sv('line', { class: 'sk-grid', x1: x, x2: x, y1: M.t, y2: M.t + PH }));
        const t = sv('text', { class: 'sk-tick', x, y: M.t + PH + 17, 'text-anchor': 'middle', 'font-size': '12' }); t.textContent = String(u); svg.appendChild(t);
      }
      svg.appendChild(sv('line', { class: 'sk-axis', x1: M.l, x2: M.l, y1: M.t, y2: M.t + PH })); svg.appendChild(sv('line', { class: 'sk-axis', x1: M.l, x2: M.l + PW, y1: M.t + PH, y2: M.t + PH }));
      const xt = sv('text', { x: M.l + PW / 2, y: VH - 8, 'text-anchor': 'middle', 'font-size': '12.5', 'font-weight': '650' }); xt.textContent = 'Average annual UV index (1997)'; svg.appendChild(xt);
      [['Melanoma incidence', 13], ['(unit not stated)', 28]].forEach(([txt, x]) => { const t = sv('text', { transform: 'translate(' + x + ',' + (M.t + PH / 2) + ') rotate(-90)', 'text-anchor': 'middle', 'font-size': '12.5', 'font-weight': '650' }); t.textContent = txt; svg.appendChild(t); });
      if (S.trend) {
        const tr = trend(g), x0 = pts[0].uv, x1 = pts[pts.length - 1].uv, y0 = tr.intercept + tr.slope * x0, y1 = tr.intercept + tr.slope * x1;
        svg.appendChild(sv('line', { class: 'sk-trend', x1: X(x0), y1: Y(y0), x2: X(x1), y2: Y(y1) }));
        const t = sv('text', { x: M.l + 8, y: M.t + 16, 'font-size': '12' }); t.textContent = 'Dashed line: r = ' + (tr.r == null ? 'n/a' : tr.r.toFixed(2)) + ' (pattern only)'; svg.appendChild(t);
      }
      const labs = S.names ? placeLabels(pts.map(p => ({ site: p.site, text: p.site, x: X(p.uv), y: Y(p.rate) })), { l: M.l + 2, r: M.l + PW + 4, t: M.t, b: M.t + PH + 2 }, 12) : {};
      pts.forEach((p, i) => {
        const x = X(p.uv), y = Y(p.rate);
        const a = sv('g', { class: 'sk-pt', role: 'button', tabindex: i === 0 ? '0' : '-1', 'aria-pressed': 'false', 'data-group': g, 'data-site': p.site, 'data-uv': String(p.uv), 'data-rate': String(p.rate),
          'aria-label': p.site + ', UV index about ' + p.uv.toFixed(1) + ', rate about ' + fmt(g, p.rate) });
        a.style.setProperty('--c', COLOR[g]);
        a.append(sv('circle', { class: 'sk-hit', cx: x, cy: y, r: 15 }), marker(g, x, y, 5.5), sv('circle', { class: 'sk-ring', cx: x, cy: y, r: 11 }));
        a.addEventListener('click', () => select(g, p.site, true));
        a.addEventListener('focus', () => { if (mark(g)) { persist(); } });
        a.addEventListener('keydown', e => {
          const all = Array.from(svg.querySelectorAll('.sk-pt')), k = all.indexOf(a); let n = -1;
          if (e.key === 'ArrowRight' || e.key === 'ArrowUp') n = Math.min(all.length - 1, k + 1); else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') n = Math.max(0, k - 1); else if (e.key === 'Home') n = 0; else if (e.key === 'End') n = all.length - 1;
          else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(g, p.site, true); return; }
          if (n >= 0) { e.preventDefault(); all.forEach(q => q.setAttribute('tabindex', '-1')); all[n].setAttribute('tabindex', '0'); all[n].focus(); }
        });
        svg.appendChild(a);
        if (labs[p.site]) { const t = sv('text', { class: 'sk-name', x: labs[p.site].x, y: labs[p.site].y, 'text-anchor': labs[p.site].anchor, 'aria-hidden': 'true' }); t.textContent = p.site; svg.appendChild(t); }
      });
      return svg;
    }
    function buildFigs() {
      charts.replaceChildren();
      GROUPS.forEach(g => {
        const f = el('figure', { class: 'sk-fig', 'data-group': g }), svg = buildChart(g);
        f.append(el('h4', { text: LB[g] + ' group' }), el('p', { class: 'sk-sub', text: 'Study label: ' + ORIG[g] }), svg);
        charts.appendChild(f); figs[g] = f;
      });
    }
    function mark(g) { if (S.viewed[g]) return false; S.viewed[g] = true; renderExplored(); renderTabs(); persist(); return true; }

    /* ----- selection and readouts ----- */
    function select(g, site, speak) {
      S.sel = { group: g, site }; mark(g); persist(); renderSel();
      if (speak) { const v = rateAt(g, site); api.announce(site + ' in the ' + LB[g] + ' graph: UV index about ' + BASE.SITE_UV[site].toFixed(1) + ', rate about ' + fmt(g, v) + '. Approximate reading.'); }
    }
    function renderSel() {
      root.querySelectorAll('.sk-pt').forEach(n => n.setAttribute('aria-pressed', String(!!S.sel && n.dataset.site === S.sel.site)));
      tableBox.querySelectorAll('tbody tr').forEach(tr => { if (S.sel && tr.dataset.site === S.sel.site) tr.setAttribute('aria-current', 'true'); else tr.removeAttribute('aria-current'); });
      readout.replaceChildren();
      if (!S.sel) { readout.appendChild(el('p', { text: 'Tap a dot to see its site and value.' })); updateDesc(); return; }
      const { group, site } = S.sel, uv = BASE.SITE_UV[site];
      readout.append(el('p', { text: site + ' (' + LB[group] + ' graph)', style: 'font-weight:700' }),
        el('p', { text: 'UV index about ' + uv.toFixed(1) + ' · rate about ' + fmt(group, rateAt(group, site)) + ' (unit not stated in the lesson figure)' }),
        el('p', { class: 'sk-note', text: 'Same site in all three graphs: ' + GROUPS.map(q => LB[q] + ' ' + fmt(q, rateAt(q, site))).join(', ') + '. Each graph has its own scale unless Same scale is on.' }));
      updateDesc();
    }
    function scaleNote() { return 'Same scale: Black-labeled values are about ' + Math.round(ratio('white', 'black')) + ' times smaller than White-labeled ones on average, and Hispanic-labeled values about ' + Math.round(ratio('white', 'hispanic')) + ' times smaller.'; }
    function renderExplored() { explored.textContent = 'Graphs explored: ' + GROUPS.map(g => LB[g] + (S.viewed[g] ? ' ✓' : ' –')).join('   '); }
    function renderTabs() {
      GROUPS.forEach(g => { tabBtns[g].setAttribute('aria-pressed', String(S.tab === g)); tabBtns[g].textContent = LB[g] + (S.viewed[g] ? ' ✓' : ''); });
    }
    function updateDesc() {
      if (!desc) return;
      desc.textContent = 'Text description: three graphs of melanoma incidence against average annual UV index (1997) for 11 U.S. registry sites, approximate readings. ' + GROUPS.map(g => describeGroup(g, S.scale)).join(' ') +
        (S.scale === 'same' ? ' ' + scaleNote() : '') + (S.sel ? ' Selected: ' + S.sel.site + ' in the ' + LB[S.sel.group] + ' graph.' : '') + ' The data table lists every point.';
    }

    /* ----- table ----- */
    function renderTable() {
      tableBox.hidden = !S.table; tableBtn.setAttribute('aria-expanded', String(S.table)); if (!S.table) { tableBox.replaceChildren(); return; }
      const rows = Object.keys(BASE.SITE_UV).map(s => { const tr = el('tr', { 'data-site': s }); const b = el('button', { type: 'button', class: 'sk-site', text: s }); b.addEventListener('click', () => select(S.tab, s, true)); tr.appendChild(el('th', { scope: 'row' }, [b])); tr.appendChild(el('td', { text: BASE.SITE_UV[s].toFixed(1) })); GROUPS.forEach(g => tr.appendChild(el('td', { 'data-group': g, text: fmt(g, rateAt(g, s)) }))); return tr; });
      const head = el('tr', {}, ['Site', 'UV index'].concat(GROUPS.map(g => LB[g] + ' rate')).map(h => el('th', { scope: 'col', text: h })));
      tableBox.replaceChildren(el('h4', { text: 'Data table (approximate values)' }), el('p', { class: 'sk-note', text: 'Same points as the graphs. Tap a site name to select it. ' + NOTE_APPROX }), el('div', { class: 'sk-tablewrap' }, [el('table', { class: 'sk-table', 'aria-label': 'Approximate melanoma incidence by site and group' }, [el('thead', {}, [head]), el('tbody', {}, rows)])]));
    }

    /* ----- polls ----- */
    function renderPolls() {
      pollBox.replaceChildren(el('h4', { text: 'Quick checks' }));
      POLLS.forEach(p => {
        const fb = el('p', { class: 'sk-fb', 'data-poll-feedback': p.id }), row = el('div', { class: 'sk-row', role: 'group', 'aria-label': p.q });
        const upd = () => { const r = checkPoll(p.id, S.polls[p.id]); fb.textContent = r.message; fb.dataset.state = r.status === 'empty' ? '' : r.status; row.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(S.polls[p.id] === b.dataset.option))); };
        p.options.forEach(o => { const b = el('button', { type: 'button', class: 'sk-chip', 'data-option': o, 'aria-pressed': 'false', text: o }); b.addEventListener('click', () => { S.polls[p.id] = o; persist(); upd(); api.announce(fb.textContent); }); row.appendChild(b); });
        pollBox.appendChild(el('div', { class: 'sk-poll', 'data-poll': p.id }, [el('p', { class: 'sk-q', text: p.q }), row, fb])); upd();
      });
    }

    /* ----- render ----- */
    function render() {
      root.dataset.layout = S.layout; root.dataset.scale = S.scale;
      buildFigs();
      GROUPS.forEach(g => { figs[g].hidden = S.layout === 'narrow' && g !== S.tab; });
      tabWrap.hidden = S.layout === 'wide';
      scaleOwn.setAttribute('aria-pressed', String(S.scale === 'own')); scaleSame.setAttribute('aria-pressed', String(S.scale === 'same'));
      namesBtn.setAttribute('aria-pressed', String(S.names)); trendBtn.setAttribute('aria-pressed', String(S.trend));
      scaleLine.textContent = S.scale === 'same' ? scaleNote() : 'Each graph uses its own y axis, as in the lesson (about 0 to 50, 0 to 1.8 and 0 to 12). Tap Same scale to compare sizes.';
      renderTabs(); renderExplored(); renderTable(); renderSel();
    }
    renderPolls(); render();
    if ('ResizeObserver' in window) {
      new ResizeObserver(() => { const w = host.clientWidth; if (!w) return; const want = w >= 960 ? 'wide' : 'narrow'; if (want !== S.layout) { S.layout = want; render(); } }).observe(host);
    }
    window.B3SkinScene = { state: () => ({ scale: S.scale, viewed: Object.assign({}, S.viewed), sel: S.sel, layout: S.layout, polls: Object.assign({}, S.polls) }) };
  }
  return { logic, mount };
});
