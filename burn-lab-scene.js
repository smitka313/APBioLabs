/* Burn demonstration (OpenSciEd B.2 Lesson 2 companion, host #burn-scene, scene id "burn").
   A web stand-in for the teacher's Burning Fuels demonstration: five dry fuels (dried grass, dried leaves, wood chips, charcoal, peat) of 10 g each are burned
   under a glass flask of BTB solution, with a thermometer in the flask and a balance for the before and after mass. EVERYTHING HERE IS SIMULATED: the
   numbers come from the small model in openscied-b2-burn-logic.js (assumptions at the top of that file and on the page under "What this simulation
   models"), seeded from the student's Dataset ID, not measured from real fuels. This page replaces the real demonstration and none of its safety steps:
   real burning is done by the teacher with goggles, ventilation and everyone 15 feet back.

   Flow: pick a fuel -> "Burn it (virtual)" (stores a START TIMESTAMP, so a reload picks up where the clock is; 6 simulated seconds pass each real second,
   so peat takes about a minute and grass a few seconds; "Skip ahead for class" finishes at once, and with reduced motion the burn is shown finished) ->
   tap what you saw -> "Record results" fills one row of the table (fuel, time to ignite, BTB before and after, temperature, mass, observations) ->
   burn the next fuel, or a second sample of the same one (up to 3 each; a second sample differs a little, like real samples).
   The drawing is a canvas scaled for devicePixelRatio, redrawn on resize and theme change. Flame, glow, smoke, the shrinking sample, the BTB color,
   the thermometer and the balance all come from the model state at that moment, so the picture always matches the numbers. Labels use computed
   geometry: each leader line ends in a dot on the structure it names.
   Saved: api.saveState('burn', { seed, fuel, current:{fuel,n,startedAt,skipped}|null, records:[{fuel,n,obs:[chip ids]}] }). Every number is recomputed
   from seed + fuel + sample number (B2BurnLogic.burnResult), so nothing in a table can go stale. */
(function () {
  'use strict';
  const L = window.B2BurnLogic;
  const CSS = '.bn-ui{display:grid;gap:10px}.bn-panel{display:grid;gap:10px;padding:12px 14px;border:1px solid var(--line);border-radius:var(--r);background:var(--surface)}.bn-panel h4{margin:0;font-size:1rem}' +
    '.bn-setup{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;align-items:end}.bn-field{display:grid;gap:4px;min-width:0}.bn-field label{font-weight:650;font-size:.92rem}.bn-field select{font:inherit;min-height:40px;max-width:100%;padding:4px 8px;border:1px solid var(--line);border-radius:var(--r-sm);background:var(--surface);color:var(--ink)}' +
    '.bn-actions{display:flex;flex-wrap:wrap;gap:8px;align-items:center}.bn-actions .btn{min-height:40px}.bn-clock{display:grid;gap:6px}.bn-clock strong{font:700 1.15rem var(--f-mono)}.bn-bar{height:12px;border:1px solid var(--line);border-radius:999px;background:var(--surface-2);overflow:hidden}.bn-bar i{display:block;height:100%;background:var(--accent);width:0}' +
    '.bn-note{margin:0;font-size:.88rem;color:var(--muted)}.bn-msg{margin:0;font-weight:600}.bn-chips{display:flex;flex-wrap:wrap;gap:8px;align-items:center}.bn-legend{font-weight:700;margin-right:4px;padding:0}fieldset.bn-obs{border:0;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:8px;align-items:center}' +
    '.bn-chip{font:inherit;font-weight:600;font-size:.88rem;min-height:36px;min-width:44px;padding:4px 12px;border:1px solid var(--line);border-radius:999px;background:var(--surface);color:var(--ink);cursor:pointer}.bn-chip:hover{border-color:var(--accent)}.bn-chip[aria-pressed=true]{background:var(--accent-soft);border-color:var(--accent);box-shadow:inset 0 0 0 1px var(--accent)}.bn-chip[aria-pressed=true]::before{content:"✓ "}' +
    '.bn-table th,.bn-table td{white-space:normal;text-align:left}.bn-table td.bn-miss{color:var(--muted)}.bn-fig{margin:0;display:grid;gap:6px}.bn-chart{max-width:100%}.bn-confirm{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.bn-read{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:6px 12px;margin:0}.bn-read div{display:grid;gap:0}.bn-read dt{font-size:.8rem;color:var(--muted)}.bn-read dd{margin:0;font-weight:700}' +
    '.scene-host.tall canvas{aspect-ratio:auto;height:clamp(300px,40vw,380px);min-height:0}@media(max-width:560px){.scene-host.tall canvas{height:340px}.bn-table{font-size:.82rem}.bn-table th,.bn-table td{padding:5px 4px}.bn-actions .btn{flex:1 1 auto}}';

  function mount(host, api) {
    const doc = host.ownerDocument || document, win = window;
    const canvas = host.querySelector('canvas'), desc = host.querySelector('.scene-desc');
    if (!canvas) throw new Error('burn scene needs a canvas');
    if (!doc.getElementById('burn-scene-css')) { const el = doc.createElement('style'); el.id = 'burn-scene-css'; el.textContent = CSS; doc.head.appendChild(el); }
    host.classList.add('tall');
    const reduced = () => !!(win.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
    const num = L.num, clamp = L.clamp;
    function h(tag, attrs, ...kids) {
      const e = doc.createElement(tag);
      Object.keys(attrs || {}).forEach(k => { if (k === 'text') e.textContent = attrs[k]; else if (attrs[k] === true) e.setAttribute(k, ''); else if (attrs[k] !== false && attrs[k] != null) e.setAttribute(k, attrs[k]); });
      [].concat(...kids).forEach(x => { if (x != null) e.appendChild(typeof x === 'string' ? doc.createTextNode(x) : x); });
      return e;
    }
    const css = (n, f) => getComputedStyle(doc.documentElement).getPropertyValue(n).trim() || f;
    const top = h('div', { class: 'bn-ui' }), bottom = h('div', { class: 'bn-ui' });
    host.insertBefore(top, canvas); host.insertBefore(bottom, desc || null);

    // ----- state: validated copy of the saved record, or null before the first burn -----
    let st = L.cleanState(api.getState().burn), pending = st ? st.fuel : 'grass', obsPick = [], confirmReset = false, metric = 'rise', lastStage = '', tickTimer = 0, rafId = 0, lastDescKey = '';
    const seedNow = () => st ? st.seed : api.seed('burn');
    const sampleNo = fuel => L.nextSample(st, fuel);
    function view() {
      const cur = st && st.current;
      if (cur) {
        const res = L.burnResult(st.seed, cur.fuel, cur.n), t = L.simSeconds(cur.startedAt, Date.now(), cur.skipped, res.runS);
        return { phase: t >= res.runS ? 'finished' : 'running', res, sim: L.stateAt(res, t), t };
      }
      const n = sampleNo(pending) || L.MAX_SAMPLES, res = L.burnResult(seedNow(), pending, n);
      return { phase: 'ready', res, sim: L.stateAt(res, 0), t: 0 };
    }
    function persist() { api.saveState('burn', { seed: st.seed, fuel: st.fuel, current: st.current, records: st.records, updatedAt: Date.now() }); }
    const stageText = v => v.phase === 'ready' ? 'Ready' : v.sim.stage === 'heating' ? 'Heating in the igniter flame' : v.sim.stage === 'burning' ? 'Burning' : v.sim.stage === 'dying' ? 'Dying out' : 'Out and cooled';
    const secs = s => Math.round(s) + ' s';

    // ----- actions -----
    function burn() {
      const n = sampleNo(pending); if (!n || (st && st.current)) return;
      if (!st) st = { seed: api.seed('burn'), fuel: pending, current: null, records: [] };
      st.fuel = pending; st.current = { fuel: pending, n, startedAt: Date.now(), skipped: reduced() };
      obsPick = []; lastStage = ''; lastDescKey = ''; persist(); render();
      api.announce(reduced() ? 'Burned ' + L.fuelLabel(pending).toLowerCase() + ', sample ' + n + '. Reduced motion is on, so the burn is shown finished. Tap what you saw, then record your results.'
        : 'Burning ' + L.fuelLabel(pending).toLowerCase() + ', sample ' + n + '. Watch the flame, the BTB, the thermometer and the balance.');
    }
    function skipAhead() {
      if (!st || !st.current || st.current.skipped) return;
      st.current.skipped = true; persist(); render('[data-bn="record"]');
      api.announce('Skipped ahead. The fuel is out. Tap what you saw, then record your results.'); lastStage = 'done';
    }
    function recordIt() {
      if (!st || !st.current) return;
      const v = view(); if (v.phase !== 'finished') return;
      const c = st.current;
      st.records = st.records.concat([{ fuel: c.fuel, n: c.n, obs: obsPick.slice() }]); st.current = null; pending = c.fuel; obsPick = []; lastStage = ''; lastDescKey = '';
      persist(); render('[data-bn="burn"]');
      const r = v.res;
      api.announce('Recorded ' + r.label.toLowerCase() + ', sample ' + r.n + '. It caught fire after ' + r.igniteS + ' seconds. BTB went from ' + L.btbText(r.btbBefore) + ' to ' + L.btbText(r.btbAfter) + '. Temperature ' + r.tempBefore + ' to ' + r.tempAfter + ' degrees Celsius. Mass ' + r.massBefore.toFixed(1) + ' to ' + r.massAfter.toFixed(1) + ' grams.');
    }
    function startOver() {
      st = null; confirmReset = false; obsPick = []; lastStage = ''; lastDescKey = ''; pending = 'grass';
      api.saveState('burn', null); render(); api.announce('Started over. Pick a fuel to burn.');
    }

    // ----- controls and results (DOM) -----
    function render(focusSel) {
      stopTick();
      top.replaceChildren(); bottom.replaceChildren();
      const v = view();
      if (v.phase === 'ready') renderReady(v); else if (v.phase === 'running') renderRunning(v); else renderFinished(v);
      renderResults();
      if (focusSel) { const f = host.querySelector(focusSel); if (f && !f.disabled) f.focus(); }
      lastDescKey = ''; draw(); updateDesc();
      if (v.phase === 'running') startTick();
    }
    function readoutRow(items) {
      const dl = h('dl', { class: 'bn-read' });
      items.forEach(it => dl.appendChild(h('div', {}, h('dt', { text: it[0] }), h('dd', { text: it[1] }))));
      return dl;
    }
    function renderReady(v) {
      const used = L.samplesOf(st, pending), left = sampleNo(pending);
      const box = h('div', { class: 'bn-panel' }, h('h4', { text: 'Burn a fuel (virtual demonstration)' }));
      const sel = h('select', { id: 'bn-fuel' });
      L.FUELS.forEach(f => { const k = L.samplesOf(st, f.id); const o = h('option', { value: f.id, text: f.label + (k ? ' · burned ' + k + ' of ' + L.MAX_SAMPLES : '') }); if (f.id === pending) o.selected = true; sel.appendChild(o); });
      sel.addEventListener('change', () => { pending = L.normalizeFuel(sel.value); render('#bn-fuel'); });
      const go = h('button', { type: 'button', class: 'btn btn--primary', 'data-bn': 'burn', text: left ? 'Burn it (virtual)' : 'All 3 samples burned' }); go.disabled = !left; go.addEventListener('click', burn);
      box.appendChild(h('div', { class: 'bn-setup' }, h('div', { class: 'bn-field' }, h('label', { for: 'bn-fuel', text: 'Fuel to burn' }), sel), h('div', { class: 'bn-actions' }, go, resetControl())));
      box.appendChild(readoutRow([['Sample', left ? (used ? 'Sample ' + left + ' of ' + L.fuelLabel(pending).toLowerCase() : '10 g of ' + L.fuelLabel(pending).toLowerCase()) : 'none left'], ['Mass on the balance', left ? v.res.massBefore.toFixed(1) + ' g' : '—'], ['Flask thermometer', v.res.tempBefore + ' °C'], ['BTB color', L.btbText(L.START_BTB)]]));
      box.appendChild(h('p', { class: 'bn-note', text: st && st.records.length ? 'Burn all five fuels. A second sample of the same fuel gives slightly different numbers.' : 'Simulated: a real burn takes minutes. Here 6 seconds pass every second. Your Dataset ID sets your samples’ small differences.' }));
      top.appendChild(box);
    }
    function renderRunning(v) {
      const clock = h('div', { class: 'bn-panel bn-clock' }, h('h4', { text: 'Burning ' + v.res.label.toLowerCase() + ' (sample ' + v.res.n + ')' }));
      clock.appendChild(h('strong', { 'data-bn': 'clock', text: 'Burn time ' + secs(v.t) }));
      clock.appendChild(h('div', { class: 'bn-bar', role: 'presentation' }, h('i', { 'data-bn': 'bar', style: 'width:' + Math.round(v.sim.progress * 100) + '%' })));
      clock.appendChild(h('p', { class: 'bn-note', 'data-bn': 'stage', text: stageText(v) + '.' }));
      const skip = h('button', { type: 'button', class: 'btn', 'data-bn': 'skip', text: 'Skip ahead for class' }); skip.addEventListener('click', skipAhead);
      clock.appendChild(h('div', { class: 'bn-actions' }, skip, resetControl()));
      top.appendChild(clock);
    }
    function renderFinished(v) {
      const r = v.res, box = h('div', { class: 'bn-panel' }, h('h4', { text: 'The ' + r.label.toLowerCase() + ' is out. Read the instruments.' }));
      box.appendChild(readoutRow([['Caught fire after', r.igniteS + ' s'], ['Burned for', r.burnS + ' s'], ['BTB color', L.btbText(r.btbBefore) + ' → ' + L.btbText(r.btbAfter)], ['Thermometer', r.tempBefore + ' → ' + r.tempAfter + ' °C'], ['Mass on the balance', r.massBefore.toFixed(1) + ' → ' + r.massAfter.toFixed(1) + ' g']]));
      const fs = h('fieldset', { class: 'bn-obs' }, h('legend', { class: 'bn-legend', text: 'What did you see? Tap all that fit.' }));
      L.OBS.forEach(o => {
        const b = h('button', { type: 'button', class: 'bn-chip', 'aria-pressed': obsPick.includes(o.id) ? 'true' : 'false', text: o.label });
        b.addEventListener('click', () => { obsPick = obsPick.includes(o.id) ? obsPick.filter(x => x !== o.id) : obsPick.concat([o.id]); b.setAttribute('aria-pressed', obsPick.includes(o.id) ? 'true' : 'false'); });
        fs.appendChild(b);
      });
      box.appendChild(fs);
      const rec = h('button', { type: 'button', class: 'btn btn--primary', 'data-bn': 'record', text: 'Record results' }); rec.addEventListener('click', recordIt);
      box.appendChild(h('div', { class: 'bn-actions' }, rec, resetControl()));
      box.appendChild(h('p', { class: 'bn-note', text: 'In a real demonstration you read the thermometer and balance yourself. Here the buttons read the simulated instruments.' }));
      top.appendChild(box);
    }
    function resetControl() {
      const wrap = h('span', { class: 'bn-confirm' });
      if (!st) return wrap;
      if (!confirmReset) { const b = h('button', { type: 'button', class: 'btn btn--sm', 'data-bn': 'reset', text: 'Start over' }); b.addEventListener('click', () => { confirmReset = true; render('[data-bn="reset-yes"]'); }); wrap.appendChild(b); return wrap; }
      const yes = h('button', { type: 'button', class: 'btn btn--sm btn--danger', 'data-bn': 'reset-yes', text: 'Erase my burns and start over' }); yes.addEventListener('click', startOver);
      const no = h('button', { type: 'button', class: 'btn btn--sm', text: 'Cancel' }); no.addEventListener('click', () => { confirmReset = false; render('[data-bn="reset"]'); });
      wrap.appendChild(yes); wrap.appendChild(no); return wrap;
    }
    const obsText = o => o && o.length ? L.OBS.filter(x => o.includes(x.id)).map(x => x.label).join(', ') : '—';
    function renderResults() {
      const rows = L.tableRows(st);
      const wrap = h('div', { class: 'bn-panel' }, h('h4', { text: 'Results: simulated burns' }));
      const tw = h('div', { class: 'table-wrap', role: 'region', tabindex: '0', 'aria-label': 'Burn results table (simulated). Scrolls sideways on narrow screens.' }), t = h('table', { class: 'data bn-table' });
      t.appendChild(h('caption', { text: 'Simulated burn results. ' + rows.length + (rows.length === 1 ? ' sample' : ' samples') + ' recorded.' }));
      t.appendChild(h('thead', {}, h('tr', {}, ['Fuel (sample)', 'Caught fire after (s)', 'Burned for (s)', 'BTB color before → after (1 to 6)', 'Temperature before → after (°C)', 'Mass before → after (g)', 'What I saw'].map(x => h('th', { scope: 'col', text: x })))));
      const tb = h('tbody');
      if (!rows.length) tb.appendChild(h('tr', {}, h('td', { colspan: '7', class: 'bn-miss', text: 'Burn a fuel and record it. Your results will appear here.' })));
      rows.forEach(r => tb.appendChild(h('tr', {}, h('th', { scope: 'row', text: r.label + ' (' + r.n + ')' }), h('td', { class: 'num', text: String(r.igniteS) }), h('td', { class: 'num', text: String(r.burnS) }),
        h('td', { text: L.btbText(r.btbBefore) + ' → ' + L.btbText(r.btbAfter) }), h('td', { class: 'num', text: r.tempBefore + ' → ' + r.tempAfter }), h('td', { class: 'num', text: r.massBefore.toFixed(1) + ' → ' + r.massAfter.toFixed(1) }), h('td', { text: obsText(r.obs) }))));
      t.appendChild(tb); tw.appendChild(t); wrap.appendChild(tw);
      const chips = h('div', { class: 'bn-chips', role: 'group', 'aria-label': 'Chart shows' }, h('span', { class: 'bn-legend', text: 'Chart shows:' }));
      Object.keys(L.METRICS).forEach(k => {
        const b = h('button', { type: 'button', class: 'bn-chip', 'aria-pressed': metric === k ? 'true' : 'false', text: L.METRICS[k].label });
        b.addEventListener('click', () => { metric = k; chips.querySelectorAll('.bn-chip').forEach(c => c.setAttribute('aria-pressed', c === b ? 'true' : 'false')); drawChart(figBox); });
        chips.appendChild(b);
      });
      wrap.appendChild(chips);
      const figBox = h('div', { class: 'bn-chart', 'data-bn': 'chart' });
      wrap.appendChild(h('figure', { class: 'bn-fig' }, figBox, h('figcaption', { class: 'bn-note', text: 'Bar chart of the table above (simulated). Each fuel has one bar per sample, and each sample number has its own pattern. The table has every number.' })));
      bottom.appendChild(wrap);
      if (win.Lab && Lab.tableFit) Lab.tableFit.scan();
      drawChart(figBox);
    }
    function drawChart(box) {
      if (!box) return;
      const rows = L.tableRows(st);
      box.replaceChildren();
      if (win.Lab && Lab.chart) {
        try { Lab.chart(box, { type: 'bar', responsive: true, height: 300, xLabel: 'Fuel', yLabel: L.METRICS[metric].yLabel, yMin: 0, categories: L.FUELS.map(f => L.SHORT[f.id]), series: L.chartSeries(rows, metric), emptyText: 'Record a burn to see its bar here' }); }
        catch (e) { box.textContent = 'The chart could not be drawn. The table above has every number.'; }
      }
    }

    // ----- drawing -----
    function isDark() { const a = doc.documentElement.getAttribute('data-theme'); return a === 'dark' || (a !== 'light' && !!win.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches); }
    const rgb = c => 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')';
    const rgba = (c, a) => 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';
    const mix = (a, b, t) => [0, 1, 2].map(i => Math.round(a[i] + (b[i] - a[i]) * clamp(t, 0, 1)));
    function geom(W, H) {
      const floor = H - 40, u = clamp((floor - 14) / 300, 0.7, 1.2);
      const flaskW = 96 * u, neckW = 28 * u, flaskH = 120 * u, neckH = 40 * u;
      const cx = Math.max(W * 0.40, 100 * u);
      const flaskBottom = floor - 178 * u, flaskTop = flaskBottom - flaskH, neckY = flaskTop + neckH;
      const liqY = flaskBottom - 0.46 * (flaskBottom - neckY);
      const widthAt = y => neckW + (flaskW - neckW) * clamp((y - neckY) / (flaskBottom - neckY), 0, 1);
      const bw = clamp(W * 0.27, 92, 150 * u), bx0 = Math.min(W - bw - 12, cx + 215 * u);
      return { floor, u, flaskW, neckW, flaskH, neckH, cx, flaskBottom, flaskTop, neckY, liqY, widthAt, rodX: cx - 108 * u, sx: cx, sy: floor - 86 * u,
        bw, bx0, bcx: bx0 + bw / 2, panY: floor - 46 * u, bulb: { x: cx + 14 * u, y: flaskBottom - 14 * u }, tip: { x: cx + 5 * u, y: flaskTop - 12 * u } };
    }
    // ----- the fuel sample, drawn from the model's burned fraction -----
    const FRESH = { grass: [201, 165, 74], leaves: [168, 103, 44], wood: [200, 154, 98], charcoal: [48, 46, 46], peat: [74, 51, 33] };
    function sampleColor(fuel, b, dark) {
      const char = [34, 27, 22], ash = dark ? [158, 158, 152] : [140, 140, 134];
      return b < 0.5 ? mix(FRESH[fuel], char, b / 0.5) : mix(char, ash, (b - 0.5) / 0.5);
    }
    function drawSample(ctx, x, y, s, fuel, b, glow, dark) {
      const r = L.makeRng(L.hash32('shape:' + fuel)), col = sampleColor(fuel, b, dark), edge = mix(col, [0, 0, 0], 0.45), size = (0.55 + 0.45 * (1 - b * 0.78)) * s;
      ctx.save(); ctx.translate(x, y); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      if (fuel === 'grass') {
        const len = 1 - 0.55 * b;
        for (let i = 0; i < 18; i++) {
          const dx = (i - 9) * 2.4 * size, tipx = dx * 1.6 + (r.uniform() - 0.5) * 8 * size, tipy = -(24 + r.uniform() * 12) * size * len, bend = (r.uniform() - 0.5) * 14 * size;
          ctx.strokeStyle = rgb(mix(col, [255, 240, 170], 0.12 * (1 - b) * r.uniform())); ctx.lineWidth = Math.max(1, 1.9 * size);
          ctx.beginPath(); ctx.moveTo(dx * 0.5, 13 * size); ctx.quadraticCurveTo(dx + bend, tipy * 0.45, tipx, tipy); ctx.stroke();
        }
        ctx.strokeStyle = rgb(mix([120, 84, 44], col, b)); ctx.lineWidth = 3 * size; ctx.beginPath(); ctx.moveTo(-14 * size, 2 * size); ctx.lineTo(14 * size, 2 * size); ctx.stroke();
      } else if (fuel === 'leaves') {
        for (let i = 0; i < 8; i++) {
          const a = r.uniform() * 6.28, ox = (r.uniform() - 0.5) * 22 * size, oy = (r.uniform() - 0.5) * 14 * size, rx = (11 + r.uniform() * 7) * size * (1 - 0.35 * b), ry = rx * 0.5;
          ctx.fillStyle = rgb(mix(col, [90, 50, 20], r.uniform() * 0.35 * (1 - b))); ctx.strokeStyle = rgb(edge); ctx.lineWidth = 1;
          ctx.beginPath(); ctx.ellipse(ox, oy, Math.max(1, rx), Math.max(1, ry), a, 0, 6.28); ctx.fill(); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(ox - Math.cos(a) * rx * 0.8, oy - Math.sin(a) * rx * 0.8); ctx.lineTo(ox + Math.cos(a) * rx * 0.8, oy + Math.sin(a) * rx * 0.8); ctx.strokeStyle = rgba(edge, 0.7); ctx.stroke();
        }
      } else if (fuel === 'wood') {
        for (let i = 0; i < 5; i++) {
          const a = (r.uniform() - 0.5) * 1.4, ox = (i - 2) * 6.5 * size + (r.uniform() - 0.5) * 4 * size, oy = (r.uniform() - 0.5) * 9 * size, w = (16 + r.uniform() * 6) * size * (1 - 0.3 * b), hh = (7 + r.uniform() * 3) * size * (1 - 0.25 * b);
          ctx.save(); ctx.translate(ox, oy); ctx.rotate(a);
          ctx.fillStyle = rgb(mix(col, [150, 100, 55], r.uniform() * 0.3 * (1 - b))); ctx.strokeStyle = rgb(edge); ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(-w / 2, -hh / 2); ctx.lineTo(w / 2, -hh / 2 + 1.5); ctx.lineTo(w / 2 - 1, hh / 2); ctx.lineTo(-w / 2 + 1, hh / 2 - 1); ctx.closePath(); ctx.fill(); ctx.stroke();
          ctx.strokeStyle = rgba(edge, 0.55); ctx.beginPath(); ctx.moveTo(-w / 2 + 2, -hh * 0.1); ctx.lineTo(w / 2 - 2, hh * 0.05); ctx.stroke();
          ctx.restore();
        }
      } else if (fuel === 'charcoal') {
        for (let i = 0; i < 4; i++) {
          const ox = (i - 1.5) * 9 * size + (r.uniform() - 0.5) * 4 * size, oy = (r.uniform() - 0.5) * 8 * size, rad = (10 + r.uniform() * 5) * size * (1 - 0.25 * b), n = 6;
          ctx.beginPath();
          for (let k = 0; k < n; k++) { const an = k / n * 6.28 + r.uniform() * 0.5, rr = rad * (0.75 + r.uniform() * 0.4); ctx[k ? 'lineTo' : 'moveTo'](ox + Math.cos(an) * rr, oy + Math.sin(an) * rr * 0.8); }
          ctx.closePath(); ctx.fillStyle = rgb(col); ctx.strokeStyle = rgb(edge); ctx.lineWidth = 1; ctx.fill(); ctx.stroke();
          if (b < 0.4) { ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.beginPath(); ctx.moveTo(ox - rad * 0.4, oy - rad * 0.35); ctx.lineTo(ox + rad * 0.1, oy - rad * 0.45); ctx.stroke(); }
        }
      } else {
        for (let i = 0; i < 7; i++) {
          const ox = (r.uniform() - 0.5) * 24 * size, oy = (r.uniform() - 0.5) * 12 * size, rad = (8 + r.uniform() * 6) * size * (1 - 0.2 * b);
          ctx.fillStyle = rgb(mix(col, [96, 70, 46], r.uniform() * 0.3 * (1 - b))); ctx.beginPath(); ctx.arc(ox, oy, Math.max(1, rad), 0, 6.28); ctx.fill();
        }
        ctx.strokeStyle = rgba(mix(col, [140, 110, 70], 0.5), 0.8); ctx.lineWidth = 1;
        for (let i = 0; i < 9; i++) { const ox = (r.uniform() - 0.5) * 26 * size, oy = (r.uniform() - 0.5) * 12 * size, an = r.uniform() * 6.28; ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ox + Math.cos(an) * 7 * size, oy + Math.sin(an) * 7 * size); ctx.stroke(); }
      }
      if (glow > 0.02) { // glowing ember: orange light on the sample, brightest at the lower front
        const g = ctx.createRadialGradient(0, 3 * size, 2, 0, 3 * size, 30 * size * (0.6 + 0.5 * glow));
        g.addColorStop(0, 'rgba(255,196,80,' + (0.75 * glow).toFixed(2) + ')'); g.addColorStop(0.5, 'rgba(255,100,20,' + (0.5 * glow).toFixed(2) + ')'); g.addColorStop(1, 'rgba(255,60,0,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 3 * size, 30 * size * (0.6 + 0.5 * glow), 0, 6.28); ctx.fill();
      }
      ctx.restore();
    }
    function drawAsh(ctx, x, y, s, massG, dark) {
      const r = L.makeRng(7), k = clamp(massG / 3, 0.25, 1) * s, c = dark ? [158, 158, 152] : [140, 140, 134];
      for (let i = 0; i < 9; i++) {
        const ox = (r.uniform() - 0.5) * 30 * k, oy = -Math.abs(r.uniform() - 0.3) * 9 * k, rr = (5 + r.uniform() * 5) * k;
        ctx.fillStyle = rgb(mix(c, [60, 60, 58], r.uniform() * 0.5)); ctx.beginPath(); ctx.ellipse(x + ox, y + oy, rr * 1.3, rr * 0.7, 0, 0, 6.28); ctx.fill();
      }
    }
    function tongue(ctx, x, baseY, w, hgt, sway) {
      ctx.beginPath(); ctx.moveTo(x - w / 2, baseY);
      ctx.bezierCurveTo(x - w * 0.62, baseY - hgt * 0.45, x - w * 0.12 + sway * 0.5, baseY - hgt * 0.72, x + sway, baseY - hgt);
      ctx.bezierCurveTo(x + w * 0.12 + sway * 0.5, baseY - hgt * 0.72, x + w * 0.62, baseY - hgt * 0.45, x + w / 2, baseY);
      ctx.quadraticCurveTo(x, baseY + w * 0.18, x - w / 2, baseY); ctx.closePath();
    }
    function drawFlame(ctx, x, baseY, w, hgt, tm, ph) {
      const sway = Math.sin(tm * 9 + ph) * w * 0.14, hh = hgt * (1 + 0.07 * Math.sin(tm * 13 + ph * 2));
      [[1, 'rgba(255,88,20,0.88)'], [0.72, 'rgba(255,158,32,0.95)'], [0.46, 'rgba(255,224,92,0.96)'], [0.22, 'rgba(255,250,214,0.95)']].forEach(l => { ctx.fillStyle = l[1]; tongue(ctx, x, baseY, w * l[0], hh * (0.55 + 0.45 * l[0]), sway * l[0]); ctx.fill(); });
    }
    function drawIgniter(ctx, x, baseY, u, tm) {
      const sway = Math.sin(tm * 11) * 1.2 * u, hh = 36 * u * (1 + 0.05 * Math.sin(tm * 15));
      [[1, 'rgba(70,120,255,0.9)'], [0.55, 'rgba(150,200,255,0.95)'], [0.25, 'rgba(235,245,255,0.95)']].forEach(l => { ctx.fillStyle = l[1]; tongue(ctx, x, baseY, 13 * u * l[0], hh * (0.6 + 0.4 * l[0]), sway * l[0]); ctx.fill(); });
    }
    function labelBox(ctx, lines, x, y, anchor, o) {
      const ink = css('--ink', '#14211c'), line = css('--line', '#c9d2cd'), surface = css('--surface', '#fff'), accent = css('--accent', '#0d6e55');
      let fs = 12; const fam = css('--f-body', 'system-ui');
      const width = f => Math.max.apply(null, lines.map((t, i) => { ctx.font = (i ? '600 ' : '700 ') + f + 'px ' + fam; return ctx.measureText(t).width; })) + 12;
      const room = o.maxW || 160; while (fs > 10 && width(fs) > room) fs--;
      const bw = width(fs), bh = lines.length * (fs + 3) + 6;
      const bx = clamp(o.align === 'right' ? x - bw : o.align === 'center' ? x - bw / 2 : x, 4, Math.max(4, o.W - 4 - bw)), by = clamp(y, 2, Math.max(2, o.H - 40 - bh));
      const ex = clamp(anchor.x, bx, bx + bw), ey = clamp(anchor.y, by, by + bh);
      ctx.strokeStyle = ink; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(anchor.x, anchor.y); ctx.stroke();
      ctx.fillStyle = surface; ctx.strokeStyle = line; ctx.lineWidth = 1; ctx.beginPath(); ctx.rect(bx, by, bw, bh); ctx.fill(); ctx.stroke();
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      lines.forEach((t, i) => { ctx.font = (i ? '600 ' : '700 ') + fs + 'px ' + fam; ctx.fillStyle = i ? ink : css('--muted', '#56665f'); if (!i) ctx.fillStyle = ink; ctx.fillText(t, bx + 6, by + 3 + (i + 1) * (fs + 3) - 3); });
      ctx.fillStyle = accent; ctx.strokeStyle = surface; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(anchor.x, anchor.y, 3.6, 0, 6.28); ctx.fill(); ctx.stroke();
    }
    function draw() {
      const W = Math.floor(canvas.clientWidth), H = Math.floor(canvas.clientHeight);
      if (!W || !H) return;
      const dpr = win.devicePixelRatio || 1;
      if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) { canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); }
      const ctx = canvas.getContext('2d'); if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
      const ink = css('--ink', '#14211c'), muted = css('--muted', '#56665f'), surface2 = css('--surface-2', '#eef2ef'), line = css('--line', '#c9d2cd');
      const dark = isDark(), G = geom(W, H), v = view(), sim = v.sim, res = v.res, u = G.u;
      const animate = v.phase === 'running' && !reduced(), tm = animate ? win.performance.now() / 1000 : 0, fuel = res.fuel;
      const metal = dark ? '#9aa6a2' : '#6c7874', metalLight = dark ? '#cfd8d4' : '#aab6b1';
      // bench
      ctx.fillStyle = surface2; ctx.fillRect(0, 0, W, H);
      const bg = ctx.createLinearGradient(0, G.floor, 0, H); bg.addColorStop(0, dark ? '#2a3331' : '#d9dfd9'); bg.addColorStop(1, dark ? '#1c2321' : '#c4ccc5');
      ctx.fillStyle = bg; ctx.fillRect(0, G.floor, W, H - G.floor);
      ctx.strokeStyle = line; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, G.floor + 0.5); ctx.lineTo(W, G.floor + 0.5); ctx.stroke();
      const shadow = (x, w) => { ctx.save(); ctx.translate(x, G.floor + 6); ctx.scale(1, 0.2); const sh = ctx.createRadialGradient(0, 0, 3, 0, 0, w); sh.addColorStop(0, dark ? 'rgba(0,0,0,.6)' : 'rgba(40,50,45,.36)'); sh.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = sh; ctx.beginPath(); ctx.arc(0, 0, w, 0, 7); ctx.fill(); ctx.restore(); };
      shadow(G.cx, 46 * u); shadow(G.rodX, 42 * u); shadow(G.bcx, G.bw * 0.7);
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      // ring stand: base plate, rod, arm and ring (the back half of the ring first, so the flask sits in it)
      ctx.fillStyle = metal; ctx.fillRect(G.rodX - 34 * u, G.floor - 6 * u, 68 * u, 6 * u);
      const rg = ctx.createLinearGradient(G.rodX - 3 * u, 0, G.rodX + 3 * u, 0); rg.addColorStop(0, metalLight); rg.addColorStop(1, metal);
      ctx.fillStyle = rg; ctx.fillRect(G.rodX - 3 * u, G.flaskBottom + 3 * u, 6 * u, G.floor - 6 * u - G.flaskBottom - 3 * u);
      ctx.strokeStyle = metal; ctx.lineWidth = 4 * u; ctx.beginPath(); ctx.moveTo(G.rodX, G.flaskBottom + 3 * u); ctx.lineTo(G.cx - G.flaskW / 2 - 4 * u, G.flaskBottom + 3 * u); ctx.stroke();
      ctx.lineWidth = 3 * u; ctx.beginPath(); ctx.ellipse(G.cx, G.flaskBottom + 3 * u, G.flaskW / 2 + 5 * u, 6 * u, 0, Math.PI, 6.2832); ctx.stroke();
      // burner (the igniter): a small stove with a nozzle
      const bx = G.cx - 32 * u, by = G.floor - 30 * u;
      const bgr = ctx.createLinearGradient(bx, 0, bx + 64 * u, 0); bgr.addColorStop(0, metal); bgr.addColorStop(0.35, metalLight); bgr.addColorStop(1, metal);
      ctx.fillStyle = bgr; ctx.strokeStyle = dark ? '#51605a' : '#4a5551'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(bx + 6 * u, G.floor); ctx.lineTo(bx + 4 * u, by + 6 * u); ctx.quadraticCurveTo(bx + 4 * u, by, bx + 12 * u, by); ctx.lineTo(bx + 52 * u, by); ctx.quadraticCurveTo(bx + 60 * u, by, bx + 60 * u, by + 6 * u); ctx.lineTo(bx + 58 * u, G.floor); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = metal; ctx.fillRect(G.cx - 9 * u, by - 7 * u, 18 * u, 7 * u);
      ctx.fillStyle = dark ? '#2b3430' : '#34403b'; ctx.beginPath(); ctx.arc(bx + 50 * u, by + 16 * u, 4.5 * u, 0, 6.28); ctx.fill();
      // balance (right): base, display, pedestal and pan
      const bw = G.bw, bx0 = G.bx0, baseTop = G.floor - 26 * u;
      const bag = ctx.createLinearGradient(0, baseTop, 0, G.floor); bag.addColorStop(0, dark ? '#c4cdc9' : '#eef2ef'); bag.addColorStop(1, dark ? '#8b9792' : '#b3beb9');
      ctx.fillStyle = bag; ctx.strokeStyle = dark ? '#5d6b65' : '#7b8782'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(bx0 + 8 * u, G.floor); ctx.lineTo(bx0, G.floor - 6 * u); ctx.lineTo(bx0 + 4 * u, baseTop); ctx.lineTo(bx0 + bw - 4 * u, baseTop); ctx.lineTo(bx0 + bw, G.floor - 6 * u); ctx.lineTo(bx0 + bw - 8 * u, G.floor); ctx.closePath(); ctx.fill(); ctx.stroke();
      const dw = bw * 0.62, dx = G.bcx - dw / 2, dy = baseTop + 5 * u, dh = 15 * u;
      ctx.fillStyle = '#0c1a14'; ctx.fillRect(dx, dy, dw, dh); ctx.strokeStyle = '#3c4a44'; ctx.strokeRect(dx + 0.5, dy + 0.5, dw - 1, dh - 1);
      const reading = v.phase === 'ready' ? res.massBefore.toFixed(1) + ' g' : v.phase === 'running' ? '--.- g' : res.massAfter.toFixed(1) + ' g';
      ctx.fillStyle = '#7dffb4'; ctx.font = '700 ' + Math.round(12 * Math.max(0.8, u)) + 'px ' + css('--f-mono', 'monospace'); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(reading, G.bcx, dy + dh / 2 + 1); ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = dark ? '#aeb9b4' : '#8c9893'; ctx.fillRect(G.bcx - 5 * u, G.panY, 10 * u, baseTop - G.panY);
      ctx.fillStyle = dark ? '#d6dedb' : '#c4cdc9'; ctx.strokeStyle = dark ? '#6c7a74' : '#7b8782'; ctx.beginPath(); ctx.ellipse(G.bcx, G.panY, bw * 0.36, 7 * u, 0, 0, 6.28); ctx.fill(); ctx.stroke();
      if (v.phase === 'ready') drawSample(ctx, G.bcx, G.panY - 12 * u, 0.62 * u, fuel, 0, 0, dark);
      else if (v.phase === 'finished') drawAsh(ctx, G.bcx, G.panY - 3 * u, u, res.massAfter, dark);
      // flask: glass back, BTB liquid, thermometer, glass front
      const fl = G.cx - G.flaskW / 2, fr = G.cx + G.flaskW / 2, nl = G.cx - G.neckW / 2, nr = G.cx + G.neckW / 2, rr = 7 * u;
      const outline = () => { ctx.beginPath(); ctx.moveTo(nl, G.flaskTop); ctx.lineTo(nl, G.neckY); ctx.lineTo(fl + 2, G.flaskBottom - rr); ctx.quadraticCurveTo(fl, G.flaskBottom, fl + rr, G.flaskBottom); ctx.lineTo(fr - rr, G.flaskBottom); ctx.quadraticCurveTo(fr, G.flaskBottom, fr - 2, G.flaskBottom - rr); ctx.lineTo(nr, G.neckY); ctx.lineTo(nr, G.flaskTop); };
      const lw = G.widthAt(G.liqY), liq = L.btbColor(sim.btb);
      ctx.fillStyle = dark ? 'rgba(200,225,235,.08)' : 'rgba(200,230,240,.2)'; outline(); ctx.fill();
      const lg = ctx.createLinearGradient(0, G.liqY, 0, G.flaskBottom); lg.addColorStop(0, rgb(mix(liq, [255, 255, 255], 0.18))); lg.addColorStop(1, rgb(mix(liq, [0, 0, 0], 0.22)));
      ctx.fillStyle = lg; ctx.beginPath(); ctx.moveTo(G.cx - lw / 2, G.liqY); ctx.lineTo(fl + 2, G.flaskBottom - rr); ctx.quadraticCurveTo(fl, G.flaskBottom, fl + rr, G.flaskBottom); ctx.lineTo(fr - rr, G.flaskBottom); ctx.quadraticCurveTo(fr, G.flaskBottom, fr - 2, G.flaskBottom - rr); ctx.lineTo(G.cx + lw / 2, G.liqY); ctx.closePath(); ctx.fill();
      ctx.fillStyle = rgb(mix(liq, [255, 255, 255], 0.3)); ctx.beginPath(); ctx.ellipse(G.cx, G.liqY, lw / 2, 3.4 * u, 0, 0, 6.28); ctx.fill();
      // thermometer in the flask: glass tube, red column that rises with the temperature, scale ticks and a bulb
      const tb = G.bulb, tp = G.tip, frac = clamp((sim.temp - 15) / 25, 0.02, 1), colTop = { x: tb.x + (tp.x - tb.x) * frac * 0.92, y: tb.y + (tp.y - tb.y) * frac * 0.92 };
      ctx.strokeStyle = dark ? 'rgba(235,240,240,.85)' : 'rgba(250,250,250,.92)'; ctx.lineWidth = 6 * u; ctx.beginPath(); ctx.moveTo(tb.x, tb.y); ctx.lineTo(tp.x, tp.y); ctx.stroke();
      ctx.strokeStyle = dark ? '#7a8a85' : '#7b8782'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(tb.x + 3.2 * u, tb.y); ctx.lineTo(tp.x + 3.2 * u, tp.y); ctx.moveTo(tb.x - 3.2 * u, tb.y); ctx.lineTo(tp.x - 3.2 * u, tp.y); ctx.stroke();
      ctx.strokeStyle = '#d3322a'; ctx.lineWidth = 2.6 * u; ctx.beginPath(); ctx.moveTo(tb.x, tb.y); ctx.lineTo(colTop.x, colTop.y); ctx.stroke();
      ctx.fillStyle = '#d3322a'; ctx.beginPath(); ctx.arc(tb.x, tb.y, 4.6 * u, 0, 6.28); ctx.fill();
      for (let k = 1; k <= 6; k++) { const q = k / 7, px = tb.x + (tp.x - tb.x) * q, py = tb.y + (tp.y - tb.y) * q; ctx.strokeStyle = 'rgba(30,40,36,.55)'; ctx.beginPath(); ctx.moveTo(px + 3.4 * u, py); ctx.lineTo(px + 6.4 * u, py); ctx.stroke(); }
      ctx.strokeStyle = dark ? 'rgba(220,235,240,.85)' : 'rgba(80,110,120,.9)'; ctx.lineWidth = 2.2; outline(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(nl - 4 * u, G.flaskTop); ctx.lineTo(nr + 4 * u, G.flaskTop); ctx.stroke();
      ctx.strokeStyle = dark ? 'rgba(255,255,255,.5)' : 'rgba(255,255,255,.9)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(fl + 12 * u, G.flaskBottom - 16 * u); ctx.lineTo(G.cx - G.neckW / 2 - 6 * u, G.neckY + 6 * u); ctx.stroke();
      ctx.strokeStyle = metal; ctx.lineWidth = 3 * u; ctx.beginPath(); ctx.ellipse(G.cx, G.flaskBottom + 3 * u, G.flaskW / 2 + 5 * u, 6 * u, 0, 0, Math.PI); ctx.stroke();
      // tongs holding the sample (when it is in the flame), igniter, flame, ember, smoke
      const hx = Math.max(10, G.cx - 175 * u), hy = G.sy - 34 * u, inFlame = v.phase !== 'ready';
      const tong = (dy, gap) => { ctx.strokeStyle = dark ? '#b8c3bf' : '#5f6b67'; ctx.lineWidth = 3.2 * u; ctx.beginPath(); ctx.moveTo(hx, hy + dy); ctx.lineTo(G.sx - (inFlame ? 13 : 24) * u, G.sy + gap * (inFlame ? 0.6 : 1)); ctx.stroke(); ctx.fillStyle = dark ? '#d8e0dd' : '#46514d'; ctx.beginPath(); ctx.arc(hx, hy + dy, 3.2 * u, 0, 6.28); ctx.fill(); };
      if (inFlame) {
        const k = 0.72 * u, b = sim.burnedFraction;
        if (sim.igniter) drawIgniter(ctx, G.cx, by - 7 * u, u, tm);
        if (v.phase === 'finished') { /* sample is on the balance as ash */ } else drawSample(ctx, G.sx, G.sy, k * (1 + 0.15 * (1 - b)), fuel, b, sim.glow, dark);
        tong(-8 * u, -9 * u); tong(8 * u, 6 * u);
        if (sim.flame > 0.02) { const fw = (20 + 16 * sim.flame) * u, fh = (14 + 62 * sim.flame) * u; ['grass', 'leaves'].includes(fuel) && sim.flame > 0.4 ? [-9, 0, 9].forEach((o, i) => drawFlame(ctx, G.sx + o * u, G.sy + 4 * u, fw * (i === 1 ? 1 : 0.7), fh * (i === 1 ? 1 : 0.72), tm, i * 1.7)) : drawFlame(ctx, G.sx, G.sy + 4 * u, fw, fh, tm, 0.5); }
        const puffs = Math.round(sim.smoke * 14);
        for (let i = 0; i < puffs; i++) {
          const ph = animate ? (tm * (0.1 + (i % 4) * 0.012) + i / puffs) % 1 : (i + 0.5) / Math.max(1, puffs), px = G.sx + 6 * u + ph * 38 * u + Math.sin(ph * 6 + i) * 8 * u, py = G.sy - 12 * u - ph * (G.sy - G.flaskBottom - 6 * u + 70 * u), pr = (5 + ph * 15) * u, a = (1 - ph) * 0.34 * clamp(sim.smoke + 0.2, 0, 1);
          ctx.fillStyle = dark ? 'rgba(205,210,208,' + a.toFixed(3) + ')' : 'rgba(78,82,80,' + a.toFixed(3) + ')'; ctx.beginPath(); ctx.arc(px, py, pr, 0, 6.28); ctx.fill();
        }
      } else { tong(-8 * u, -11 * u); tong(8 * u, 9 * u); }
      // labels with leader lines that end in dots on the drawn structures
      const o = { W, H };
      labelBox(ctx, ['BTB solution', L.btbText(sim.btb)], G.cx - G.flaskW / 2 - 12 * u, G.flaskTop + 22 * u, { x: G.cx - lw / 2 + 2, y: G.liqY + 2 }, Object.assign({ align: 'right', maxW: Math.max(70, G.cx - G.flaskW / 2 - 18 * u) }, o));
      labelBox(ctx, ['Thermometer', sim.temp + ' °C'], G.cx + G.flaskW / 2 + 14 * u, G.flaskTop + 4 * u, colTop, Object.assign({ align: 'left', maxW: Math.max(70, G.bx0 - (G.cx + G.flaskW / 2 + 18 * u)) }, o));
      const massNow = v.phase === 'running' ? null : v.phase === 'ready' ? res.massBefore : res.massAfter;
      labelBox(ctx, ['Balance' + (v.phase === 'ready' ? ': ' + res.label.toLowerCase() : ''), massNow == null ? 'weigh after burning' : massNow.toFixed(1) + ' g'], G.bcx, G.panY - 62 * u, { x: G.bcx - bw * 0.2, y: G.panY - 1 }, Object.assign({ align: 'center', maxW: bw + 20 }, o));
      if (v.phase === 'running') labelBox(ctx, ['Fuel sample', res.label + ' · ' + (sim.massTrue).toFixed(1) + ' g left'], hx, G.sy - 100 * u, v.phase === 'ready' ? { x: G.bcx, y: G.panY - 14 * u } : { x: G.sx, y: G.sy - 6 * u }, Object.assign({ align: 'left', maxW: Math.max(90, G.cx - 70 * u - hx) }, o));
      if (W >= 560 && v.phase !== 'ready' && v.phase !== 'finished') {
        const flameTop = G.sy + 4 * u - (14 + 62 * sim.flame) * u, txt = sim.igniter ? 'Igniter flame' : sim.flame >= 0.5 ? 'Flame' : sim.smoke >= 0.5 ? 'Smoke from smoldering' : sim.glow >= 0.3 ? 'Glowing ember' : 'Small flame';
        const anc = sim.igniter ? { x: G.cx, y: by - 7 * u - 30 * u } : sim.flame >= 0.5 ? { x: G.sx, y: flameTop } : sim.smoke >= 0.5 ? { x: G.sx + 30 * u, y: G.sy - 12 * u - 0.35 * (G.sy - G.flaskBottom + 64 * u) } : { x: G.sx + 10 * u, y: G.sy + 6 * u };
        labelBox(ctx, [txt], G.cx + G.flaskW / 2 + 40 * u, G.sy - 12 * u, anc, Object.assign({ align: 'left', maxW: 150 }, o));
      }
      // bench caption
      ctx.fillStyle = muted; ctx.font = '600 11px ' + css('--f-mono', 'monospace'); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ctx.fillText('SIMULATED · ' + stageText(v) + (v.phase === 'running' ? ' · ' + secs(v.t) : ''), 10, H - 12);
      if (W > 560) { ctx.textAlign = 'right'; ctx.fillText('10 g sample · scale reads 0.1 g · thermometer reads 1 °C', W - 10, H - 12); }
      canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', canvasLabel(v));
    }
    function canvasLabel(v) {
      v = v || view(); const r = v.res, s = v.sim;
      const flame = s.flame > 0.02 ? (s.flame >= 0.7 ? 'a bright flame' : 'a small flame') : 'no flame', smoke = s.smoke >= 0.5 ? ' lots of smoke,' : s.smoke >= 0.15 ? ' a little smoke,' : '', ember = s.glow >= 0.3 ? ' a glowing ember,' : '';
      return 'Simulated burn demonstration. ' + (v.phase === 'ready' ? 'Ready to burn ' + r.label.toLowerCase() + '. The 10 g sample is on the balance, reading ' + r.massBefore.toFixed(1) + ' grams.'
        : r.label + ', sample ' + r.n + ': ' + stageText(v).toLowerCase() + ', ' + secs(v.t) + ' in. ' + (v.phase === 'finished' ? 'Only ash is left, and the balance reads ' + r.massAfter.toFixed(1) + ' grams.' : 'It shows ' + flame + ',' + smoke + ember + ' and the sample is down to ' + s.massTrue.toFixed(1) + ' grams.')) +
        ' The BTB in the flask is ' + L.btbText(s.btb) + ' and the thermometer reads ' + s.temp + ' degrees Celsius.';
    }
    function updateDesc() {
      const v = view(), key = v.phase + ':' + v.res.fuel + ':' + Math.floor(v.t / 3) + ':' + (st ? st.records.length : 0);
      if (key === lastDescKey) return; lastDescKey = key;
      if (!desc) return;
      desc.textContent = 'Text description: ' + canvasLabel(v).replace(/^Simulated burn demonstration\. /, '') + ' ' + (st ? st.records.length : 0) + (st && st.records.length === 1 ? ' sample' : ' samples') + ' recorded. Simulated data.';
      canvas.setAttribute('aria-label', canvasLabel(v));
    }

    // ----- clock: timestamps drive everything; this timer only repaints and watches for stage changes -----
    function startTick() {
      if (tickTimer) return;
      tickTimer = win.setInterval(tick, 250);
      if (!reduced()) { const loop = () => { const v = view(); if (v.phase !== 'running') { rafId = 0; return; } draw(); rafId = win.requestAnimationFrame(loop); }; rafId = win.requestAnimationFrame(loop); }
    }
    function stopTick() { if (tickTimer) { win.clearInterval(tickTimer); tickTimer = 0; } if (rafId) { win.cancelAnimationFrame(rafId); rafId = 0; } }
    function tick() {
      const v = view();
      if (v.phase === 'ready') { stopTick(); return; }
      const clock = top.querySelector('[data-bn="clock"]'), bar = top.querySelector('[data-bn="bar"]'), stage = top.querySelector('[data-bn="stage"]');
      if (clock) clock.textContent = 'Burn time ' + secs(v.t);
      if (bar) bar.style.width = Math.round(v.sim.progress * 100) + '%';
      if (stage) stage.textContent = stageText(v) + '.';
      if (v.sim.stage !== lastStage) { if (v.sim.stage === 'burning' && lastStage === 'heating') api.announce('It caught fire after ' + v.res.igniteS + ' seconds.'); lastStage = v.sim.stage; }
      if (reduced()) draw();
      updateDesc();
      if (v.phase === 'finished') { stopTick(); api.announce('The fuel is out. Tap what you saw, then record your results.'); render('[data-bn="record"]'); }
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
  (window.B2Scenes = window.B2Scenes || []).push({ id: 'burn', mount: mount });
})();
