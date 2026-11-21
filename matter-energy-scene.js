/* Matter Energy Cards (OpenSciEd B.2 Lesson 3 companion, host #cards-scene, scene id "cards").
   The student taps each of five cards to say whether it goes IN to a decomposer (yeast) or comes OUT. Correct: sugar and oxygen in;
   carbon dioxide, water and energy out (cellular respiration). Energy is a different kind of card because it is transferred, not matter.
   The drawing under the cards shows the student's CURRENT arrangement (not the answer): molecules are drawn from their real structure
   (glucose ring, O2, CO2, H2O), and the sentence "This is the reaction" appears only when all five cards are right.
   Saved: api.saveState('cards', { placed: { sugar:'in', ... }, solved:bool }). No timers, nothing random, nothing simulated except the model itself.
   This scene has no canvas: its drawing is SVG, built from the same geometry as the labels, so each label sits under the structure it names. */
(function () {
  'use strict';
  const L = window.B2FiresLogic;
  const NS = 'http://www.w3.org/2000/svg';
  const CSS = '.mc-ui{display:grid;gap:12px}.mc-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(168px,1fr));gap:10px}' +
    '.mc-card{display:grid;gap:6px;align-content:start;padding:10px;border:2px solid var(--line);border-radius:var(--r);background:var(--surface);min-width:0}' +
    '.mc-card.mc-energy{border-style:dashed;background:var(--surface-2)}.mc-card[data-state=correct]{border-color:var(--ok)}.mc-card[data-state=wrong]{border-color:var(--ink)}' +
    '.mc-card h4{margin:0;font-size:1rem}.mc-kind{font:600 .72rem var(--f-mono);letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}' +
    '.mc-icon{width:100%;height:64px;display:block}.mc-btns{display:flex;gap:6px;flex-wrap:wrap}.mc-btn{font:inherit;font-weight:600;font-size:.88rem;min-height:40px;flex:1 1 auto;padding:4px 8px;border:1px solid var(--line);border-radius:var(--r-sm);background:var(--surface);color:var(--ink);cursor:pointer}' +
    '.mc-btn:hover{border-color:var(--accent)}.mc-btn[aria-pressed=true]{background:var(--accent-soft);border-color:var(--accent);box-shadow:inset 0 0 0 1px var(--accent)}' +
    '.mc-fb{margin:0;font-size:.88rem;min-height:1.3em}.mc-fb:empty{min-height:0}.mc-fb[data-state=correct]::before{content:"\\2713  ";font-weight:800;color:var(--ok)}.mc-fb[data-state=wrong]::before{content:"\\2715  ";font-weight:800}' +
    '.mc-eq{border:1px solid var(--line);border-radius:var(--r);background:var(--surface-2);padding:10px;display:grid;gap:6px}.mc-eq h4{margin:0}.mc-eq svg{display:block;width:100%;height:auto;max-height:190px}' +
    '.mc-sentence{margin:0;font-weight:700}.mc-sentence[data-state=correct]::before{content:"\\2713  ";color:var(--ok)}' +
    '.mc-t{fill:var(--ink);font:600 13px var(--f-body)}.mc-t-sm{fill:var(--muted);font:600 11px var(--f-mono);letter-spacing:.04em}.mc-line{stroke:var(--ink);fill:none;stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round}' +
    '.mc-c{fill:var(--muted);stroke:var(--ink);stroke-width:1.4}.mc-o{fill:#d9483f;stroke:#7d1d17;stroke-width:1.4}.mc-h{fill:var(--surface);stroke:var(--ink);stroke-width:1.4}.mc-bolt{fill:#f2c230;stroke:var(--ink);stroke-width:2;stroke-linejoin:round}' +
    '.mc-leader{stroke:var(--muted);stroke-width:1.2}.mc-dot{fill:var(--accent);stroke:var(--surface);stroke-width:1}.mc-zone{fill:none;stroke:var(--line);stroke-width:1.5;stroke-dasharray:5 4}.mc-arrow{stroke:var(--ink);stroke-width:3;fill:none}.mc-arrow-head{fill:var(--ink)}' +
    '.mc-actions{display:flex;gap:8px;flex-wrap:wrap}@media(max-width:520px){.mc-cards{grid-template-columns:repeat(2,minmax(0,1fr))}}';

  // ----- molecule drawings: one function per card, centered on (cx, cy), about 'r' tall. Returns { svg, anchor:{x,y} } (the anchor is the atom the label points at).
  function atom(cls, x, y, r) { return '<circle class="' + cls + '" cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="' + r + '"/>'; }
  function ln(x1, y1, x2, y2) { return '<line class="mc-line" x1="' + x1.toFixed(1) + '" y1="' + y1.toFixed(1) + '" x2="' + x2.toFixed(1) + '" y2="' + y2.toFixed(1) + '"/>'; }
  function drawMolecule(id, cx, cy, s) {
    const u = s / 60; // unit
    if (id === 'sugar') { // glucose ring: 5 carbons and 1 oxygen, with OH and CH2OH groups
      const R = 20 * u, pts = [0, 1, 2, 3, 4, 5].map(function (i) { const a = Math.PI / 6 + i * Math.PI / 3 - Math.PI / 2; return [cx + R * Math.cos(a), cy + R * Math.sin(a)]; });
      let g = '<polygon class="mc-line" points="' + pts.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' ') + '"/>';
      pts.forEach(function (p, i) { const out = Math.atan2(p[1] - cy, p[0] - cx), ex = p[0] + 12 * u * Math.cos(out), ey = p[1] + 12 * u * Math.sin(out); if (i !== 0) { g += ln(p[0], p[1], ex, ey) + atom('mc-o', ex, ey, 3.6 * u); } });
      g += atom('mc-o', pts[0][0], pts[0][1], 4.6 * u);
      pts.slice(1).forEach(function (p) { g += atom('mc-c', p[0], p[1], 3.6 * u); });
      return { svg: g, anchor: { x: pts[0][0], y: pts[0][1] } };
    }
    if (id === 'oxygen') { const d = 11 * u;
      return { svg: ln(cx - d, cy - 2.5 * u, cx + d, cy - 2.5 * u) + ln(cx - d, cy + 2.5 * u, cx + d, cy + 2.5 * u) + atom('mc-o', cx - d, cy, 8 * u) + atom('mc-o', cx + d, cy, 8 * u), anchor: { x: cx - d, y: cy } }; }
    if (id === 'carbon-dioxide') { const d = 21 * u;
      return { svg: ln(cx - d, cy - 2.5 * u, cx, cy - 2.5 * u) + ln(cx - d, cy + 2.5 * u, cx, cy + 2.5 * u) + ln(cx, cy - 2.5 * u, cx + d, cy - 2.5 * u) + ln(cx, cy + 2.5 * u, cx + d, cy + 2.5 * u) +
        atom('mc-o', cx - d, cy, 8 * u) + atom('mc-c', cx, cy, 7 * u) + atom('mc-o', cx + d, cy, 8 * u), anchor: { x: cx, y: cy } }; }
    if (id === 'water') { const a = 104.5 / 2 * Math.PI / 180, hx = 18 * u * Math.sin(a), hy = 18 * u * Math.cos(a), oy = cy - 7 * u;
      return { svg: ln(cx, oy, cx - hx, oy + hy) + ln(cx, oy, cx + hx, oy + hy) + atom('mc-o', cx, oy, 9 * u) + atom('mc-h', cx - hx, oy + hy, 5 * u) + atom('mc-h', cx + hx, oy + hy, 5 * u), anchor: { x: cx, y: oy } }; }
    // energy: a lightning bolt on a dashed tile. It is not made of atoms.
    const p = [[0.12, -1], [-0.55, 0.12], [-0.05, 0.12], [-0.2, 1], [0.58, -0.22], [0.06, -0.22]].map(function (q) { return (cx + q[0] * 26 * u).toFixed(1) + ',' + (cy + q[1] * 24 * u).toFixed(1); }).join(' ');
    return { svg: '<polygon class="mc-bolt" points="' + p + '"/>', anchor: { x: cx, y: cy } };
  }
  function iconSvg(id) {
    const m = drawMolecule(id, 60, 32, 52);
    return '<svg class="mc-icon" viewBox="0 0 120 64" aria-hidden="true" focusable="false">' + m.svg + '</svg>';
  }

  function mount(host, api) {
    const doc = host.ownerDocument || document, mountEl = host.querySelector('.mc-mount') || host, desc = host.querySelector('.scene-desc');
    if (!doc.getElementById('cards-scene-css')) { const st = doc.createElement('style'); st.id = 'cards-scene-css'; st.textContent = CSS; doc.head.appendChild(st); }
    const saved = api.getState().cards;
    const placed = {};
    if (saved && saved.placed && typeof saved.placed === 'object') L.CARDS.forEach(function (c) { if (saved.placed[c.id] === 'in' || saved.placed[c.id] === 'out') placed[c.id] = saved.placed[c.id]; });
    function h(tag, cls, text) { const e = doc.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
    const ui = h('div', 'mc-ui'); mountEl.replaceChildren(ui);
    const cardsEl = h('div', 'mc-cards'); cardsEl.setAttribute('role', 'group'); cardsEl.setAttribute('aria-label', 'The five cards');
    const eq = h('div', 'mc-eq'), actions = h('div', 'mc-actions');
    const cardNodes = {};
    L.CARDS.forEach(function (c) {
      const card = h('article', 'mc-card' + (c.note === 'energy' ? ' mc-energy' : '')); card.dataset.card = c.id;
      card.insertAdjacentHTML('afterbegin', iconSvg(c.id));
      card.appendChild(h('h4', '', c.label)); card.appendChild(h('span', 'mc-kind', c.note === 'energy' ? 'Energy card (not matter)' : 'Matter card'));
      const btns = h('div', 'mc-btns'); btns.setAttribute('role', 'group'); btns.setAttribute('aria-label', c.label + ': goes in or comes out');
      ['in', 'out'].forEach(function (z) {
        const b = h('button', 'mc-btn', z === 'in' ? 'Goes in' : 'Comes out'); b.type = 'button'; b.dataset.zone = z; b.setAttribute('aria-pressed', 'false');
        b.addEventListener('click', function () { place(c.id, z); }); btns.appendChild(b);
      });
      const fb = h('p', 'mc-fb'); card.appendChild(btns); card.appendChild(fb);
      cardsEl.appendChild(card); cardNodes[c.id] = { card, btns, fb };
    });
    const reset = h('button', 'btn btn--sm', 'Start over'); reset.type = 'button'; reset.addEventListener('click', function () { L.CARDS.forEach(function (c) { delete placed[c.id]; }); persist(); render(); api.announce('Cards cleared.'); });
    actions.appendChild(reset);
    ui.appendChild(cardsEl); ui.appendChild(eq); ui.appendChild(actions);

    function persist() { api.saveState('cards', { placed: Object.assign({}, placed), solved: L.checkCards(placed).solved, updatedAt: Date.now() }); }
    function place(id, zone) {
      if (placed[id] === zone) delete placed[id]; else placed[id] = zone;
      persist(); render();
      const r = L.checkCards(placed), x = r.results[id];
      if (r.solved) api.announce('All five cards are right. This is the reaction: ' + L.REACTION + '.'); else api.announce(x.zone ? x.message : L.CARDS.find(function (c) { return c.id === id; }).label + ' card cleared.');
    }
    // The equation drawing: the cards the student put on each side, drawn from the real molecule structures, with the arrow between.
    function drawEq(r) {
      const inIds = L.CARDS.filter(function (c) { return placed[c.id] === 'in'; }), outIds = L.CARDS.filter(function (c) { return placed[c.id] === 'out'; });
      const W = 420, H = 140, zoneW = 180, x2 = 236;
      let g = '<rect class="mc-zone" x="4" y="22" width="' + zoneW + '" height="' + (H - 28) + '" rx="10"/><rect class="mc-zone" x="' + x2 + '" y="22" width="' + zoneW + '" height="' + (H - 28) + '" rx="10"/>' +
        '<text class="mc-t-sm" x="12" y="15">GOES IN</text><text class="mc-t-sm" x="' + (x2 + 8) + '" y="15">COMES OUT</text>' +
        '<path class="mc-arrow" d="M192 66 H212"/><polygon class="mc-arrow-head" points="230,66 214,58 214,74"/>';
      function side(list, x0) {
        list.forEach(function (c, i) {
          const cx = x0 + zoneW * (i + 0.5) / list.length, m = drawMolecule(c.id, cx, 58, Math.min(44, zoneW / list.length * 0.72)), words = c.label.split(' ');
          g += m.svg + '<line class="mc-leader" x1="' + cx.toFixed(1) + '" y1="96" x2="' + m.anchor.x.toFixed(1) + '" y2="' + m.anchor.y.toFixed(1) + '"/>' + atom('mc-dot', m.anchor.x, m.anchor.y, 2.8) +
            words.map(function (w, k) { return '<text class="mc-t" text-anchor="middle" x="' + cx.toFixed(1) + '" y="' + (110 + k * 14) + '">' + w + '</text>'; }).join('');
          if (i < list.length - 1) g += '<text class="mc-t" text-anchor="middle" x="' + (x0 + zoneW * (i + 1) / list.length).toFixed(1) + '" y="62">+</text>';
        });
      }
      side(inIds, 4); side(outIds, x2);
      return '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + (r.solved ? 'Reaction: ' + L.REACTION : 'Your arrangement: goes in: ' + (inIds.map(function (c) { return c.label; }).join(', ') || 'nothing yet') + '. Comes out: ' + (outIds.map(function (c) { return c.label; }).join(', ') || 'nothing yet')) + '">' + g + '</svg>';
    }
    function render() {
      const r = L.checkCards(placed);
      L.CARDS.forEach(function (c) {
        const n = cardNodes[c.id], x = r.results[c.id];
        n.card.dataset.state = x.correct === true ? 'correct' : x.correct === false ? 'wrong' : '';
        n.fb.textContent = x.message; n.fb.dataset.state = n.card.dataset.state;
        $all('button', n.btns).forEach(function (b) { b.setAttribute('aria-pressed', x.zone === b.dataset.zone ? 'true' : 'false'); });
      });
      eq.replaceChildren(); eq.insertAdjacentHTML('beforeend', '<h4>' + (r.solved ? 'This is the reaction' : 'Your arrangement so far') + '</h4>' + drawEq(r));
      const s = h('p', 'mc-sentence', r.solved ? 'Sugar + oxygen → carbon dioxide + water + energy transferred. This is cellular respiration.' : r.placed ? r.right + ' of ' + r.placed + ' placed cards are right.' + (r.placed < 5 ? ' Place the rest.' : ' Check the cards marked with ✕ and try the other side.') : 'Tap Goes in or Comes out under each card.');
      s.dataset.state = r.solved ? 'correct' : ''; eq.appendChild(s);
      if (desc) desc.textContent = 'Text description: ' + L.CARDS.map(function (c) { const z = placed[c.id]; return c.label + ': ' + (z === 'in' ? 'goes in' : z === 'out' ? 'comes out' : 'not placed') + (r.results[c.id].correct === true ? ' (right)' : r.results[c.id].correct === false ? ' (not right)' : ''); }).join('; ') + '.' + (r.solved ? ' The reaction is ' + L.REACTION + '.' : '');
    }
    function $all(sel, root) { return Array.prototype.slice.call(root.querySelectorAll(sel)); }
    render();
  }
  (window.B2Scenes = window.B2Scenes || []).push({ id: 'cards', mount: mount });
})();
