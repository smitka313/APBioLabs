/* Tilt test with BTB (OpenSciEd B.2 Lesson 5 companion, host #tilt-scene, scene id "tilt").
   A web stand-in for the class's three test tubes (a water plant in BTB solution, airtight, under clamp lights overnight, one tube in foil).
   EVERYTHING HERE IS SIMULATED: the BTB colors and starch stains come from the small model in openscied-b2-fires-logic.js (assumptions at the top of that
   file and on the page under "What this simulation models"), seeded from the student's Dataset ID, not measured from real plants. This page replaces
   no wet lab: real lamps get hot and need adult supervision.

   Flow: pick a light for each tube (direct 0 degrees, tilted 45, strongly tilted 70, or covered in foil; "Use the class plan" fills a suggestion) ->
   Start the night (stores a START TIMESTAMP, so a reload picks up where the clock is; one simulated night of 12 hours is one minute on screen,
   "Skip ahead for class" ends it at once) -> unwrap the tubes and read the colors (the foil tube's color stays hidden until then) -> table and
   chart -> optional iodine starch test.
   The drawing is a canvas scaled for devicePixelRatio and redrawn on resize and theme change. Each lamp is drawn at its real angle from the plant,
   with an arc and the angle in degrees; the BTB color is the number in the label; the number of oxygen bubbles on the plant follows the
   photosynthesis the model computed for that tube. Leader lines end in dots on the drawn liquid.
   Saved: api.saveState('tilt', { seed, startedAt, skipped, settings:[3], recorded, starchDone }). BTB and starch are recomputed from seed + settings. */
(function () {
  'use strict';
  const L = window.B2FiresLogic;
  const CSS = '.tl-ui{display:grid;gap:10px}.tl-panel{display:grid;gap:10px;padding:12px 14px;border:1px solid var(--line);border-radius:var(--r);background:var(--surface)}.tl-panel h4{margin:0;font-size:1rem}' +
    '.tl-setup{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:10px}.tl-field{display:grid;gap:4px;min-width:0}.tl-field label{font-weight:650;font-size:.92rem}.tl-field select{font:inherit;min-height:40px;max-width:100%;padding:4px 8px;border:1px solid var(--line);border-radius:var(--r-sm);background:var(--surface);color:var(--ink)}' +
    '.tl-actions{display:flex;flex-wrap:wrap;gap:8px;align-items:center}.tl-actions .btn{min-height:40px}.tl-clock{display:grid;gap:6px}.tl-clock strong{font:700 1.15rem var(--f-mono)}.tl-bar{height:12px;border:1px solid var(--line);border-radius:999px;background:var(--surface-2);overflow:hidden}.tl-bar i{display:block;height:100%;background:var(--accent);width:0}' +
    '.tl-note{margin:0;font-size:.88rem;color:var(--muted)}.tl-msg{margin:0;font-weight:600}.tl-confirm{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.tl-table th,.tl-table td{white-space:normal;text-align:left}.tl-fig{margin:0;display:grid;gap:6px}.tl-chart{max-width:100%}' +
    '.tl-tube-readouts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;list-style:none;margin:0;padding:0}.tl-tube-readouts li{display:grid;gap:3px;align-content:start;overflow-wrap:anywhere;padding:6px;border:1px solid var(--line);border-radius:var(--r-sm);font-size:.83rem}.tl-tube-readouts b{color:var(--ink)}' +
    '.tl-leaves{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}.tl-leaf{display:grid;gap:4px;justify-items:center;text-align:center;font-size:.88rem;margin:0}.tl-leaf svg{width:100%;max-width:150px;height:auto}' +
    '.scene-host.tall canvas{aspect-ratio:auto;height:clamp(300px,40vw,380px);min-height:0}@media(max-width:560px){.scene-host.tall canvas{height:340px}.tl-table{font-size:.82rem}.tl-table th,.tl-table td{padding:5px 4px}.tl-actions .btn{flex:1 1 auto}}';

  function mount(host, api) {
    const doc = host.ownerDocument || document, win = window;
    const canvas = host.querySelector('canvas'), desc = host.querySelector('.scene-desc');
    if (!canvas) throw new Error('tilt scene needs a canvas');
    if (!doc.getElementById('tilt-scene-css')) { const el = doc.createElement('style'); el.id = 'tilt-scene-css'; el.textContent = CSS; doc.head.appendChild(el); }
    host.classList.add('tall');
    const reduced = () => !!(win.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
    const num = L.num;
    function h(tag, attrs, ...kids) {
      const e = doc.createElement(tag);
      Object.keys(attrs || {}).forEach(k => { if (k === 'text') e.textContent = attrs[k]; else if (attrs[k] === true) e.setAttribute(k, ''); else if (attrs[k] !== false && attrs[k] != null) e.setAttribute(k, attrs[k]); });
      [].concat(...kids).forEach(x => { if (x != null) e.appendChild(typeof x === 'string' ? doc.createTextNode(x) : x); });
      return e;
    }
    const css = (n, f) => getComputedStyle(doc.documentElement).getPropertyValue(n).trim() || f;
    const top = h('div', { class: 'tl-ui' }), bottom = h('div', { class: 'tl-ui' });
    host.insertBefore(top, canvas); host.insertBefore(bottom, desc || null);

    let st = null, pending = ['', '', ''], confirmReset = false, announcedDone = false, lastDescKey = '', tickTimer = 0, rafId = 0;
    const s0 = api.getState().tilt;
    if (s0 && num(s0.seed) && num(s0.startedAt) && Array.isArray(s0.settings) && s0.settings.length >= 3) {
      st = { seed: s0.seed >>> 0, startedAt: s0.startedAt, skipped: !!s0.skipped, settings: s0.settings.slice(0, 3).map(L.LIGHTS ? (x => L.LIGHTS[x] ? x : 'direct') : String), recorded: !!s0.recorded, starchDone: !!s0.starchDone };
      pending = st.settings.slice(); announcedDone = progress() >= 1;
    }
    function progress() { return st ? L.nightProgress(st.startedAt, Date.now(), st.skipped) : 0; }
    const isDone = () => progress() >= 1;
    const results = () => st ? L.tiltResults(st.seed, st.settings) : null;
    function persist() { api.saveState('tilt', { seed: st.seed, startedAt: st.startedAt, skipped: st.skipped, settings: st.settings, recorded: st.recorded, starchDone: st.starchDone, updatedAt: Date.now() }); }
    const lightName = id => L.LIGHTS[id] ? L.LIGHTS[id].short : 'no light chosen';
    const hourText = p => 'Hour ' + Math.min(L.NIGHT_HOURS, Math.floor(p * L.NIGHT_HOURS)) + ' of ' + L.NIGHT_HOURS;

    // ----- actions -----
    function start() {
      const chk = L.setupCheck(pending); if (!chk.complete) return;
      st = { seed: api.seed('tilt'), startedAt: Date.now(), skipped: false, settings: pending.slice(0, 3), recorded: false, starchDone: false };
      announcedDone = false; persist(); render();
      api.announce('The night has started. The tubes are under the lights: ' + st.settings.map((s, i) => 'tube ' + L.TUBE_IDS[i] + ', ' + lightName(s)).join('; ') + '.');
    }
    function skipAhead() { if (!st || st.skipped || isDone()) return; st.skipped = true; persist(); announcedDone = true; render('[data-tl="unwrap"]'); api.announce('Skipped ahead. The night is over. Unwrap the tubes and read the colors.'); }
    function unwrap() {
      if (!st || !isDone() || st.recorded) return;
      st.recorded = true; persist(); render('[data-tl="starch"]');
      const r = results();
      api.announce('Tubes unwrapped. ' + r.map(t => 'Tube ' + t.tube + ' reads ' + t.btb.toFixed(1) + ', ' + t.btbLabel).join('; ') + '.');
    }
    function doStarch() { if (!st || !st.recorded || st.starchDone) return; st.starchDone = true; persist(); render(); api.announce('Starch test done. Look at the leaves.'); }
    function startOver() { st = null; confirmReset = false; announcedDone = false; lastDescKey = ''; pending = ['', '', '']; api.saveState('tilt', null); render(); api.announce('Started over. Choose a light for each tube.'); }

    // ----- controls and results (DOM) -----
    function render(focusSel) {
      stopTick(); top.replaceChildren(); bottom.replaceChildren();
      if (!st) renderSetup(); else renderRun();
      if (focusSel) { const f = host.querySelector(focusSel); if (f && !f.disabled) f.focus(); }
      lastDescKey = ''; draw(); updateDesc();
      if (st && !isDone()) startTick();
    }
    function renderSetup() {
      const box = h('div', { class: 'tl-panel' }, h('h4', { text: 'Set up three tubes' }),
        h('p', { class: 'tl-note', text: 'Each tube has the same kind and size of water plant in the same amount of BTB solution, and starts blue. Pick the light each tube gets.' }));
      const grid = h('div', { class: 'tl-setup' }), msg = h('p', { class: 'tl-msg', 'data-tl': 'msg' });
      const go = h('button', { type: 'button', class: 'btn btn--primary', 'data-tl': 'start', text: 'Start the night' });
      function refresh() { const c = L.setupCheck(pending); msg.textContent = c.message; go.disabled = !c.complete; draw(); updateDesc(); }
      [0, 1, 2].forEach(i => {
        const sel = h('select', { id: 'tl-light-' + i }), lab = h('label', { for: 'tl-light-' + i, text: 'Tube ' + L.TUBE_IDS[i] + ' light' });
        sel.appendChild(h('option', { value: '', text: 'Choose' }));
        L.LIGHT_IDS.forEach(id => { const o = h('option', { value: id, text: L.LIGHTS[id].label }); if (pending[i] === id) o.selected = true; sel.appendChild(o); });
        sel.addEventListener('change', () => { pending[i] = sel.value; refresh(); });
        grid.appendChild(h('div', { class: 'tl-field' }, lab, sel));
      });
      const plan = h('button', { type: 'button', class: 'btn', 'data-tl': 'plan', text: 'Use the class plan' });
      plan.addEventListener('click', () => { pending = L.SUGGESTED_SETUP.slice(); grid.querySelectorAll('select').forEach((s, i) => { s.value = pending[i]; }); refresh(); api.announce('Class plan chosen: tube A direct, tube B tilted 45 degrees, tube C in foil.'); });
      go.addEventListener('click', start);
      box.appendChild(grid); box.appendChild(msg); box.appendChild(h('div', { class: 'tl-actions' }, go, plan));
      box.appendChild(h('p', { class: 'tl-note', text: 'Simulated: the 12-hour night takes about one minute on screen. Your Dataset ID sets your plants’ small differences.' }));
      top.appendChild(box); refresh();
    }
    function renderRun() {
      const p = progress(), done = p >= 1;
      const clock = h('div', { class: 'tl-panel tl-clock' }, h('h4', { text: 'The night' }));
      clock.appendChild(h('strong', { 'data-tl': 'clock', text: done ? 'Morning: the night is over' : hourText(p) + ' under the lights' }));
      clock.appendChild(h('div', { class: 'tl-bar', role: 'presentation' }, h('i', { 'data-tl': 'bar', style: 'width:' + Math.round(p * 100) + '%' })));
      clock.appendChild(h('p', { class: 'tl-note', 'data-tl': 'hint', text: hint(done) }));
      const actions = h('div', { class: 'tl-actions' });
      const un = h('button', { type: 'button', class: 'btn btn--primary', 'data-tl': 'unwrap', text: st.recorded ? 'Tubes unwrapped and read' : 'Unwrap the tubes and read the colors' }); un.disabled = !done || st.recorded; un.addEventListener('click', unwrap); actions.appendChild(un);
      if (!done) { const skip = h('button', { type: 'button', class: 'btn', 'data-tl': 'skip', text: 'Skip ahead for class' }); skip.addEventListener('click', skipAhead); actions.appendChild(skip); }
      if (st.recorded && !st.starchDone) { const sb = h('button', { type: 'button', class: 'btn', 'data-tl': 'starch', text: 'Optional: iodine starch test' }); sb.addEventListener('click', doStarch); actions.appendChild(sb); }
      actions.appendChild(resetControl());
      clock.appendChild(actions);
      top.appendChild(clock);
      renderTubeReadouts();
      if (st.recorded) resultsPanel();
    }
    function renderTubeReadouts() {
      const list = h('ul', { class: 'tl-tube-readouts', 'aria-label': 'Tube light settings and recorded BTB readings' });
      results().forEach(row => {
        const item = h('li', { 'data-tube-readout': row.tube },
          h('b', { text: 'Tube ' + row.tube }),
          h('span', { text: lightName(row.light) + ' · ' + Math.round(row.intensity * 100) + '% light' }),
          h('span', { text: st.recorded ? 'BTB ' + row.btb.toFixed(1) + ' · ' + row.btbLabel :
            L.LIGHTS[row.light].foil ? 'BTB hidden under foil' : 'BTB not yet recorded' }));
        list.appendChild(item);
      });
      top.appendChild(list);
    }
    function hint(done) {
      if (st.recorded) return 'Compare the BTB numbers too. Tubes can look the same color and still have different readings. If BTB values tie after rounding or reach a limit, compare the modeled CO₂ changes in the table.';
      if (done) return 'The night is over. Unwrap the foil and read every tube.';
      return 'The tubes stay under the lights. The foil tube’s color stays hidden until morning.';
    }
    function resetControl() {
      const wrap = h('span', { class: 'tl-confirm' });
      if (!confirmReset) { const b = h('button', { type: 'button', class: 'btn btn--sm', 'data-tl': 'reset', text: 'Start over' }); b.addEventListener('click', () => { confirmReset = true; render('[data-tl="reset-yes"]'); }); wrap.appendChild(b); return wrap; }
      const yes = h('button', { type: 'button', class: 'btn btn--sm btn--danger', 'data-tl': 'reset-yes', text: 'Erase my tubes and start over' }); yes.addEventListener('click', startOver);
      const no = h('button', { type: 'button', class: 'btn btn--sm', text: 'Cancel' }); no.addEventListener('click', () => { confirmReset = false; render('[data-tl="reset"]'); });
      wrap.appendChild(yes); wrap.appendChild(no); return wrap;
    }
    function resultsPanel() {
      const r = results();
      const wrap = h('div', { class: 'tl-panel' }, h('h4', { text: 'Results: simulated tubes' }));
      const tw = h('div', { class: 'table-wrap', role: 'region', tabindex: '0', 'aria-label': 'BTB results table (simulated). Scrolls sideways on narrow screens.' }), t = h('table', { class: 'data tl-table' });
      t.appendChild(h('caption', { text: 'BTB color after the night (simulated). The tubes started blue, at 2.0.' }));
      const head = ['Tube', 'Light', 'Light reaching the plant', 'BTB reading (1 deep blue to 6 yellow)', 'Color', 'Carbon dioxide change (relative)']; if (st.starchDone) head.push('Iodine stain (starch)');
      t.appendChild(h('thead', {}, h('tr', {}, head.map(x => h('th', { scope: 'col', text: x })))));
      const tb = h('tbody');
      r.forEach(x => {
        const cells = [h('th', { scope: 'row', text: 'Tube ' + x.tube }), h('td', { text: L.LIGHTS[x.light].short }), h('td', { class: 'num', text: Math.round(x.intensity * 100) + '%' }), h('td', { class: 'num', text: x.btb.toFixed(1) }), h('td', { text: x.btbLabel }), h('td', { class: 'num', text: (x.net > 0 ? '+' : '') + x.net.toFixed(3) })];
        if (st.starchDone) cells.push(h('td', { text: x.starchLabel + ' (' + x.starch.toFixed(2) + ')' }));
        tb.appendChild(h('tr', {}, ...cells));
      });
      t.appendChild(tb); tw.appendChild(t); wrap.appendChild(tw);
      wrap.appendChild(h('p', { class: 'tl-note', text:
        'CO₂ change = respiration release − photosynthesis uptake, adjusted for plant size (relative model units). BTB is an indicator: its color name and rounded 1.0–6.0 scale can hide differences in CO₂. The model formulas are below under What this simulation models.' }));
      const figBox = h('div', { class: 'tl-chart', 'data-tl': 'chart' });
      wrap.appendChild(h('figure', { class: 'tl-fig' }, figBox, h('figcaption', { class: 'tl-note', text: 'Bar chart of the BTB reading for each tube (simulated). The tubes started blue, at 2.0. Lower is bluer, so carbon dioxide went down. Higher is yellower, so it went up.' })));
      if (st.starchDone) {
        const leaves = h('div', { class: 'tl-leaves' });
        r.forEach(x => { const d = L.starchDarkness(x.starch), f = h('figure', { class: 'tl-leaf' }); f.insertAdjacentHTML('beforeend', leafSvg(d, x)); f.appendChild(h('figcaption', { text: 'Tube ' + x.tube + ' (' + L.LIGHTS[x.light].short + '): ' + x.starchLabel + ' stain, starch ' + x.starch.toFixed(2) })); leaves.appendChild(f); });
        wrap.appendChild(h('h4', { text: 'Iodine test on a leaf from each tube (simulated)' })); wrap.appendChild(leaves);
        wrap.appendChild(h('p', { class: 'tl-note', text: 'Iodine turns dark blue-black where there is starch, and stays amber where there is none. Starch is where a plant stores extra sugar.' }));
      }
      bottom.appendChild(wrap);
      if (win.Lab && Lab.tableFit) Lab.tableFit.scan();
      if (win.Lab && Lab.chart) {
        try { Lab.chart(figBox, { type: 'bar', responsive: true, xLabel: 'Tube and light', yLabel: 'BTB reading (1 deep blue, 6 yellow; simulated)', yMin: 0, yMax: 6, categories: r.map(x => 'Tube ' + x.tube + ' · ' + L.LIGHTS[x.light].short), series: [{ name: 'BTB reading after the night', points: r.map((x, i) => ({ x: 'Tube ' + x.tube + ' · ' + L.LIGHTS[x.light].short, y: x.btb })) }] }); }
        catch (e) { figBox.textContent = 'The chart could not be drawn. The table above has every number.'; }
      }
    }
    // A leaf drawn with iodine on it: amber where no starch, dark blue-black as the starch index rises. Veins and an anchored label are drawn from the same geometry.
    function leafSvg(d, x) {
      const path = 'M12 50 C28 8 94 6 138 50 C94 94 28 92 12 50 Z', amber = '#c98a2b', stain = '#241a4d';
      return '<svg viewBox="0 0 150 100" role="img" aria-label="Leaf from tube ' + x.tube + ' with ' + x.starchLabel + ' iodine stain"><defs><clipPath id="lc' + x.tube + '"><path d="' + path + '"/></clipPath></defs>' +
        '<path d="' + path + '" fill="' + amber + '" stroke="' + css('--ink', '#222') + '" stroke-width="2"/><g clip-path="url(#lc' + x.tube + ')"><rect x="0" y="0" width="150" height="100" fill="' + stain + '" opacity="' + d.toFixed(2) + '"/></g>' +
        '<path d="M16 50 H134 M44 50 L62 28 M44 50 L62 72 M80 50 L98 30 M80 50 L98 70" stroke="' + css('--surface', '#fff') + '" stroke-opacity=".55" stroke-width="1.6" fill="none"/>' +
        '<circle cx="134" cy="50" r="3.4" fill="' + css('--accent', '#0d6e55') + '" stroke="' + css('--surface', '#fff') + '" stroke-width="1.2"/></svg>';
    }

    // ----- drawing -----
    function isDark() { const a = doc.documentElement.getAttribute('data-theme'); return a === 'dark' || (a !== 'light' && !!win.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches); }
    function geometry(W, H) {
      const colW = W / 3, floor = H - 56, tw = Math.min(64, Math.max(34, colW * 0.3)), th = Math.min(200, H * 0.56), R = Math.min(120, Math.max(44, colW * 0.38));
      return { colW, floor, tw, th, R, cols: [0, 1, 2].map(i => { const cx = colW * (i + 0.5), bottom = floor - 4, topY = bottom - th; return { cx, bottom, top: topY, mid: (topY + bottom) / 2, left: cx - tw / 2, right: cx + tw / 2 }; }) };
    }
    function plantArt(i, b, scale) { // deterministic Elodea: a stem with whorls of leaves, scaled by the plant size
      const r = L.makeRng(L.hash32((st ? st.seed : api.seed('tilt')) + ':plantdraw:' + i)), n = 9, pts = [], leaves = [];
      let x = 0; for (let k = 0; k <= n; k++) { x += (r.uniform() - 0.5) * 5; pts.push({ x: Math.max(-5, Math.min(5, x)), t: k / n }); }
      for (let k = 1; k <= n; k++) for (const side of [-1, 1]) leaves.push({ t: k / n, side, len: 0.8 + r.uniform() * 0.6, tilt: 0.5 + r.uniform() * 0.5, tone: r.uniform() });
      return { pts, leaves, size: scale * b };
    }
    function draw() {
      const W = Math.floor(canvas.clientWidth), H = Math.floor(canvas.clientHeight);
      if (!W || !H) return;
      const dpr = win.devicePixelRatio || 1;
      if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) { canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); }
      const ctx = canvas.getContext('2d'); if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
      const ink = css('--ink', '#14211c'), muted = css('--muted', '#56665f'), surface = css('--surface', '#fff'), surface2 = css('--surface-2', '#eef2ef'), line = css('--line', '#c9d2cd'), accent = css('--accent', '#0d6e55'), dark = isDark();
      const G = geometry(W, H), p = progress(), res = results(), settings = st ? st.settings : pending, running = !!st && p < 1, t = win.performance.now() / 1000;
      ctx.fillStyle = surface2; ctx.fillRect(0, 0, W, H);
      const bg = ctx.createLinearGradient(0, G.floor, 0, H); bg.addColorStop(0, dark ? '#2a3331' : '#d9dfd9'); bg.addColorStop(1, dark ? '#1c2321' : '#c4ccc5');
      ctx.fillStyle = bg; ctx.fillRect(0, G.floor, W, H - G.floor); ctx.strokeStyle = line; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, G.floor + 0.5); ctx.lineTo(W, G.floor + 0.5); ctx.stroke();
      ctx.textBaseline = 'alphabetic';
      [0, 1, 2].forEach(i => {
        const C = G.cols[i], sid = settings[i], chosen = !!L.LIGHTS[sid], foil = chosen && L.LIGHTS[sid].foil, theta = chosen ? L.LIGHTS[sid].angle : 0, I = chosen ? L.lightIntensity(sid) : 0;
        const tubeRes = res ? res[i] : null, wrapped = foil && !(st && st.recorded);
        const btb = tubeRes ? L.btbAt(tubeRes.btb, p) : L.BTB_START, col = L.btbColor(btb);
        const px = C.cx, py = C.mid, ang = theta * Math.PI / 180;
        // lamp position: at distance R from the plant, 'theta' degrees up from the horizontal (0 = straight at the side of the tube)
        const lx = px - G.R * Math.cos(ang), ly = py - G.R * Math.sin(ang), lw = Math.min(40, Math.max(24, G.colW * 0.2)), lh = lw * 0.72, dir = Math.atan2(py - ly, px - lx);
        // bench shadow under the tube
        ctx.save(); ctx.translate(px, C.bottom + 5); ctx.scale(1, 0.25); const sh = ctx.createRadialGradient(0, 0, 3, 0, 0, G.tw); sh.addColorStop(0, dark ? 'rgba(0,0,0,.6)' : 'rgba(40,50,45,.4)'); sh.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = sh; ctx.beginPath(); ctx.arc(0, 0, G.tw, 0, 7); ctx.fill(); ctx.restore();
        // lamp stand and clamp arm (drawn first so the tube and rays sit on top)
        if (chosen) {
          ctx.strokeStyle = dark ? '#8d9894' : '#59635f'; ctx.lineWidth = 3; ctx.lineCap = 'round';
          const bx = Math.max(10, lx - 6); ctx.beginPath(); ctx.moveTo(lx - Math.cos(dir) * lw * 0.45, ly - Math.sin(dir) * lw * 0.45); ctx.lineTo(bx, G.floor - 2); ctx.stroke();
          ctx.fillStyle = dark ? '#8d9894' : '#59635f'; ctx.beginPath(); ctx.ellipse(bx, G.floor - 1, 10, 3.5, 0, 0, 7); ctx.fill();
        }
        // light rays from the lamp to the tube (stop at the foil when covered)
        if (chosen) {
          const glow = ctx.createLinearGradient(lx, ly, px, py); glow.addColorStop(0, dark ? 'rgba(255,226,140,.55)' : 'rgba(250,200,60,.55)'); glow.addColorStop(1, dark ? 'rgba(255,226,140,.12)' : 'rgba(250,200,60,.14)');
          const nx = -Math.sin(dir), ny = Math.cos(dir), open = lh * 0.55, endX = foil ? px - Math.cos(dir) * (G.tw / 2 + 4) : px, endY = foil ? py - Math.sin(dir) * (G.tw / 2 + 4) : py;
          ctx.fillStyle = glow; ctx.beginPath(); ctx.moveTo(lx + Math.cos(dir) * lw * 0.4 + nx * open, ly + Math.sin(dir) * lw * 0.4 + ny * open); ctx.lineTo(endX + nx * (G.tw * 0.55), endY + ny * (G.tw * 0.55)); ctx.lineTo(endX - nx * (G.tw * 0.55), endY - ny * (G.tw * 0.55)); ctx.lineTo(lx + Math.cos(dir) * lw * 0.4 - nx * open, ly + Math.sin(dir) * lw * 0.4 - ny * open); ctx.closePath(); ctx.fill();
          ctx.strokeStyle = dark ? 'rgba(255,236,170,.8)' : 'rgba(214,150,10,.85)'; ctx.lineWidth = 1.2; ctx.setLineDash([5, 4]); ctx.lineDashOffset = running && !reduced() ? -t * 14 : 0;
          [-0.5, 0, 0.5].forEach(k => { ctx.beginPath(); ctx.moveTo(lx + Math.cos(dir) * lw * 0.5 + nx * open * k, ly + Math.sin(dir) * lw * 0.5 + ny * open * k); ctx.lineTo(endX + nx * G.tw * 0.4 * k, endY + ny * G.tw * 0.4 * k); ctx.stroke(); }); ctx.setLineDash([]); ctx.lineDashOffset = 0;
        }
        // the tube: BTB liquid, the plant, glass, airtight cap
        const rad = G.tw / 2, tubePath = () => { ctx.beginPath(); ctx.moveTo(C.left, C.top); ctx.lineTo(C.left, C.bottom - rad); ctx.arc(px, C.bottom - rad, rad, Math.PI, 0, true); ctx.lineTo(C.right, C.top); };
        ctx.save(); tubePath(); ctx.closePath(); ctx.clip();
        const liq = ctx.createLinearGradient(C.left, 0, C.right, 0); const c0 = 'rgb(' + col.join(',') + ')', c1 = 'rgb(' + col.map(v => Math.max(0, v - 38)).join(',') + ')', c2 = 'rgb(' + col.map(v => Math.min(255, v + 28)).join(',') + ')';
        liq.addColorStop(0, c1); liq.addColorStop(0.45, c2); liq.addColorStop(1, c0);
        if (wrapped) { ctx.fillStyle = dark ? '#b9bfc2' : '#cfd5d8'; ctx.fillRect(C.left, C.top, G.tw, C.bottom - C.top); }
        else {
          ctx.fillStyle = liq; ctx.fillRect(C.left, C.top + 10, G.tw, C.bottom - C.top);
          // the plant: a stem with leaf whorls, size scaled by the tube's plant size
          const art = plantArt(i, tubeRes ? tubeRes.plantSize : 1, 1), ph = (C.bottom - C.top) * 0.66 * art.size, base = C.bottom - rad * 0.4;
          ctx.strokeStyle = dark ? '#58a05a' : '#2b6b34'; ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.beginPath(); art.pts.forEach((q, k) => { const x = px + q.x, y = base - q.t * ph; if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y); }); ctx.stroke();
          art.leaves.forEach(l => { const q = art.pts[Math.round(l.t * (art.pts.length - 1))], x = px + q.x, y = base - l.t * ph, len = (G.tw * 0.36) * l.len * art.size; ctx.fillStyle = l.tone > 0.5 ? (dark ? '#5fae5f' : '#3f9a4a') : (dark ? '#4a8f4f' : '#2f7d3a'); ctx.strokeStyle = dark ? '#2d5a30' : '#1d4f26'; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.ellipse(x + l.side * len * 0.55, y - 1, len * 0.55, len * 0.17, l.side * (-l.tilt * 0.6), 0, 7); ctx.fill(); ctx.stroke(); });
          // oxygen bubbles on the leaves: more photosynthesis, more bubbles (none under foil or with no light)
          if (tubeRes) { const nb = Math.round(tubeRes.photosynthesis * 16 * Math.min(1, p * 1.6)); for (let k = 0; k < nb; k++) { const u = L.hash32('b' + i + ':' + k) / 4294967296, v = L.hash32('c' + i + ':' + k) / 4294967296, rise = running && !reduced() ? (t * 0.08 * (1 + u) + u) % 1 : 0, bx = px + (u - 0.5) * G.tw * 0.7, by = base - (0.15 + 0.8 * v) * ph - rise * 14; ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.strokeStyle = 'rgba(40,60,70,.55)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.arc(bx, by, 1.6 + (k % 3) * 0.5, 0, 7); ctx.fill(); ctx.stroke(); } }
          ctx.fillStyle = 'rgba(255,255,255,.28)'; ctx.fillRect(C.left + 4, C.top + 12, 4, (C.bottom - C.top) * 0.62);
        }
        ctx.restore();
        // foil: crinkled silver wrap over the tube (covers the plant until morning)
        if (wrapped) {
          const fg = ctx.createLinearGradient(C.left, 0, C.right, 0); fg.addColorStop(0, '#9aa1a5'); fg.addColorStop(0.3, '#eef1f2'); fg.addColorStop(0.55, '#b4babe'); fg.addColorStop(0.8, '#f4f6f6'); fg.addColorStop(1, '#8f979b');
          ctx.save(); tubePath(); ctx.closePath(); ctx.clip(); ctx.fillStyle = fg; ctx.fillRect(C.left, C.top, G.tw, C.bottom - C.top); ctx.strokeStyle = 'rgba(70,78,82,.45)'; ctx.lineWidth = 1;
          const fr = L.makeRng(L.hash32('foil' + i)); for (let k = 0; k < 16; k++) { const y = C.top + fr.uniform() * (C.bottom - C.top); ctx.beginPath(); ctx.moveTo(C.left, y); ctx.lineTo(C.right, y + (fr.uniform() - 0.5) * 12); ctx.stroke(); } ctx.restore();
        }
        ctx.strokeStyle = dark ? 'rgba(220,235,240,.85)' : 'rgba(80,110,120,.9)'; ctx.lineWidth = 2.2; ctx.lineJoin = 'round'; tubePath(); ctx.stroke();
        ctx.fillStyle = dark ? '#4a5456' : '#3d4b4f'; ctx.strokeStyle = dark ? '#c3cfd2' : '#20292b'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.rect(C.left - 3, C.top - 12, G.tw + 6, 13); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = dark ? 'rgba(220,235,240,.5)' : 'rgba(255,255,255,.35)'; for (let x = C.left + 2; x < C.right; x += 5) { ctx.beginPath(); ctx.moveTo(x, C.top - 10); ctx.lineTo(x, C.top - 2); ctx.stroke(); }
        // lamp head on top of the rays
        if (chosen) {
          ctx.save(); ctx.translate(lx, ly); ctx.rotate(dir);
          ctx.fillStyle = dark ? '#55615f' : '#46514f'; ctx.strokeStyle = dark ? '#c3cfd2' : '#1d2523'; ctx.lineWidth = 1.4;
          ctx.beginPath(); ctx.moveTo(-lw * 0.5, -lh * 0.28); ctx.lineTo(lw * 0.35, -lh * 0.62); ctx.lineTo(lw * 0.35, lh * 0.62); ctx.lineTo(-lw * 0.5, lh * 0.28); ctx.closePath(); ctx.fill(); ctx.stroke();
          ctx.fillStyle = foil ? (dark ? '#e8d9a0' : '#fff2b0') : '#fff6c8'; ctx.beginPath(); ctx.ellipse(lw * 0.36, 0, lh * 0.12, lh * 0.5, 0, 0, 7); ctx.fill(); ctx.stroke();
          ctx.restore();
          // angle arc at the plant: a dashed horizontal reference, the beam, and the angle in degrees
          const ar = Math.min(G.R * 0.55, 30);
          ctx.setLineDash([3, 3]); ctx.strokeStyle = muted; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(px - 6, py); ctx.lineTo(px - ar - 14, py); ctx.stroke(); ctx.setLineDash([]);
          if (theta > 0) { ctx.strokeStyle = ink; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(px, py, ar, Math.PI, Math.PI + ang); ctx.stroke(); }
          ctx.fillStyle = ink; ctx.font = '700 12px ' + css('--f-body', 'system-ui'); ctx.textAlign = 'right';
          const lblA = Math.PI + ang / 2; ctx.textAlign = 'center'; ctx.fillText(foil ? 'foil' : theta + '°', px + (ar + 15) * Math.cos(lblA) - (theta ? 0 : 0), py + (ar + 15) * Math.sin(lblA) + (theta ? 4 : 14));
          // anchor dot on the plant: where the beam is aimed
          ctx.fillStyle = accent; ctx.strokeStyle = surface; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(px, py, 3.2, 0, 7); ctx.fill(); ctx.stroke();
        } else {
          ctx.fillStyle = muted; ctx.font = '600 12px ' + css('--f-body', 'system-ui'); ctx.textAlign = 'center'; ctx.fillText('choose a light', px - G.R * 0.5, py - 4);
        }
        // header, light percentage and BTB label (number and name, so color is never the only cue)
        ctx.fillStyle = ink; ctx.textAlign = 'center'; ctx.font = '700 14px ' + css('--f-body', 'system-ui'); ctx.fillText('Tube ' + L.TUBE_IDS[i], px, 18);
        ctx.fillStyle = muted; ctx.font = '600 12px ' + css('--f-body', 'system-ui'); ctx.fillText(chosen ? lightName(sid) : 'no light chosen', px, 34); if (chosen) { ctx.font = '600 11px ' + css('--f-mono', 'monospace'); ctx.fillText(Math.round(I * 100) + '% light', px, 48); }
        const lab1 = !st ? 'BTB 2.0 · blue' : wrapped ? 'BTB hidden under foil' : 'BTB ' + btb.toFixed(1) + ' · ' + L.btbLabel(btb);
        ctx.font = '700 12px ' + css('--f-body', 'system-ui'); const tw = ctx.measureText(lab1).width + 12, ly2 = H - 22;
        ctx.strokeStyle = ink; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(px, ly2 - 16); ctx.lineTo(px, C.bottom - rad * 0.6); ctx.stroke();
        ctx.fillStyle = surface; ctx.strokeStyle = line; ctx.lineWidth = 1; ctx.beginPath(); ctx.rect(px - tw / 2, ly2 - 14, tw, 18); ctx.fill(); ctx.stroke();
        ctx.fillStyle = ink; ctx.fillText(lab1, px, ly2);
        ctx.fillStyle = accent; ctx.strokeStyle = surface; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(px, C.bottom - rad * 0.6, 3.2, 0, 7); ctx.fill(); ctx.stroke();
        
      });
      ctx.fillStyle = muted; ctx.font = '600 11px ' + css('--f-mono', 'monospace'); ctx.textAlign = 'left'; ctx.fillText(st ? 'SIMULATED · ' + (p >= 1 ? 'morning' : hourText(p).toLowerCase()) : 'SIMULATED · not started', 10, H - 4);
      canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', canvasLabel());
    }
    function canvasLabel() {
      const res = results(), p = progress();
      return 'Three simulated test tubes with a water plant in BTB solution, each with a lamp at its own angle or covered in foil. ' + [0, 1, 2].map(i => 'Tube ' + L.TUBE_IDS[i] + ': ' + lightName((st ? st.settings : pending)[i]) + (res ? (L.LIGHTS[res[i].light].foil && !st.recorded ? ', color hidden under foil' : ', BTB ' + L.btbAt(res[i].btb, p).toFixed(1)) : '')).join('. ') + '.';
    }
    function updateDesc() {
      const p = progress(), key = !st ? 'setup:' + pending.join(',') : (st.recorded ? 'rec' : 'h' + Math.floor(p * L.NIGHT_HOURS)) + ':' + st.settings.join(',') + ':' + st.starchDone;
      if (key === lastDescKey) return; lastDescKey = key;
      if (!desc) return;
      const res = results();
      desc.textContent = !st ? 'Text description: three simulated test tubes with a plant in blue BTB solution. Lights chosen: ' + [0, 1, 2].map(i => 'tube ' + L.TUBE_IDS[i] + ' ' + lightName(pending[i])).join(', ') + '. The night has not started.'
        : 'Text description: ' + (p >= 1 ? 'morning. ' : hourText(p).toLowerCase() + '. ') + res.map((x, i) => 'Tube ' + x.tube + ' (' + lightName(x.light) + ', ' + Math.round(x.intensity * 100) + '% light): ' + (L.LIGHTS[x.light].foil && !st.recorded ? 'color hidden under foil' : 'BTB ' + L.btbAt(x.btb, p).toFixed(1) + ', ' + L.btbLabel(L.btbAt(x.btb, p)))).join('; ') + '. Simulated data.';
      canvas.setAttribute('aria-label', canvasLabel());
    }

    // ----- clock: timestamps drive everything; this timer only repaints -----
    function startTick() {
      if (tickTimer) return;
      tickTimer = win.setInterval(tick, 500);
      if (!reduced()) { const loop = () => { if (!st || isDone()) { rafId = 0; return; } draw(); rafId = win.requestAnimationFrame(loop); }; rafId = win.requestAnimationFrame(loop); }
    }
    function stopTick() { if (tickTimer) { win.clearInterval(tickTimer); tickTimer = 0; } if (rafId) { win.cancelAnimationFrame(rafId); rafId = 0; } }
    function tick() {
      if (!st) { stopTick(); return; }
      const p = progress(), done = p >= 1, clock = top.querySelector('[data-tl="clock"]'), bar = top.querySelector('[data-tl="bar"]');
      if (clock) clock.textContent = done ? 'Morning: the night is over' : hourText(p) + ' under the lights';
      if (bar) bar.style.width = Math.round(p * 100) + '%';
      if (reduced()) draw();
      updateDesc();
      if (done) { stopTick(); if (!announcedDone) { announcedDone = true; api.announce('The night is over. Unwrap the tubes and read the colors.'); } render(); }
    }
    const redraw = () => { draw(); };
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(redraw).observe(canvas.parentElement || host);
    win.addEventListener('resize', redraw, { passive: true });
    doc.addEventListener('companion:show', redraw);
    new MutationObserver(redraw).observe(doc.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    if (win.matchMedia) { const mq = matchMedia('(prefers-color-scheme: dark)'); if (mq.addEventListener) mq.addEventListener('change', redraw); }
    win.addEventListener('pagehide', stopTick);
    render();
  }
  (window.B2Scenes = window.B2Scenes || []).push({ id: 'tilt', mount: mount });
})();
