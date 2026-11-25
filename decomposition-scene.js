/* Yeast decomposition test (OpenSciEd B.2 Lesson 3 companion, host #decomp-scene, scene id "decomp").
   A web stand-in for the class's three-beaker yeast investigation (cold 18 C, room 27 C, warm 43 C water, 100 mL, sugar and yeast, foam
   height in mm every 2 minutes for 20 minutes). EVERYTHING HERE IS SIMULATED: the foam heights come from the small model in
   openscied-b2-fires-logic.js (assumptions at the top of that file and on the page under "What this simulation models"), seeded from the student's
   Dataset ID, not measured from real yeast. This page replaces no wet lab and none of its safety steps.

   Flow: choose the three water temperatures (default 18, 27, 43; the student may pick any of 5, 18, 27, 35, 43, 55) -> Start the test (stores a
   START TIMESTAMP, so a reload picks up where the clock is) -> record the foam height at 0, 2, ... 20 simulated minutes (one simulated minute
   is 4 seconds; "Skip ahead for class" finishes at once) -> table, chart (foam height or relative carbon dioxide made), text description.
   Recording readings is the student's job: "Record next reading" does one, "Record all readings so far" does every due one.
   The drawing is a canvas scaled for devicePixelRatio, redrawn on resize and theme change. Foam height in the picture is the same number the
   table shows at that minute (straight line between readings). Labels use computed geometry: the leader line ends in a dot on the foam top.
   Saved: api.saveState('decomp', { seed, startedAt, skipped, temps:[3], recorded:[minutes] }). The numbers are recomputed from seed + temps. */
(function () {
  'use strict';
  const L = window.B2FiresLogic;
  const CSS = '.dc-ui{display:grid;gap:10px}.dc-panel{display:grid;gap:10px;padding:12px 14px;border:1px solid var(--line);border-radius:var(--r);background:var(--surface)}.dc-panel h4{margin:0;font-size:1rem}' +
    '.dc-setup{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px}.dc-field{display:grid;gap:4px;min-width:0}.dc-field label{font-weight:650;font-size:.92rem}.dc-field select{font:inherit;min-height:40px;max-width:100%;padding:4px 8px;border:1px solid var(--line);border-radius:var(--r-sm);background:var(--surface);color:var(--ink)}' +
    '.dc-actions{display:flex;flex-wrap:wrap;gap:8px;align-items:center}.dc-actions .btn{min-height:40px}.dc-clock{display:grid;gap:6px}.dc-clock strong{font:700 1.15rem var(--f-mono)}.dc-bar{height:12px;border:1px solid var(--line);border-radius:999px;background:var(--surface-2);overflow:hidden}.dc-bar i{display:block;height:100%;background:var(--accent);width:0}' +
    '.dc-note{margin:0;font-size:.88rem;color:var(--muted)}.dc-chips{display:flex;flex-wrap:wrap;gap:8px;align-items:center}.dc-legend{font-weight:700;margin-right:4px}' +
    '.dc-chip{font:inherit;font-weight:600;font-size:.88rem;min-height:36px;min-width:44px;padding:4px 12px;border:1px solid var(--line);border-radius:999px;background:var(--surface);color:var(--ink);cursor:pointer}.dc-chip:hover{border-color:var(--accent)}.dc-chip[aria-pressed=true]{background:var(--accent-soft);border-color:var(--accent);box-shadow:inset 0 0 0 1px var(--accent)}' +
    '.dc-table th,.dc-table td{white-space:normal;text-align:left}.dc-table td.dc-miss{color:var(--muted)}.dc-fig{margin:0;display:grid;gap:6px}.dc-chart{max-width:100%}.dc-confirm{display:flex;gap:8px;flex-wrap:wrap;align-items:center}' +
    '.scene-host.tall canvas{aspect-ratio:auto;height:clamp(300px,40vw,380px);min-height:0}@media(max-width:560px){.scene-host.tall canvas{height:330px}.dc-table{font-size:.82rem}.dc-table th,.dc-table td{padding:5px 4px}.dc-actions .btn{flex:1 1 auto}}';
  const MM_VIEW = 120, WATER_MM = 38;

  function mount(host, api) {
    const doc = host.ownerDocument || document, win = window;
    const canvas = host.querySelector('canvas'), desc = host.querySelector('.scene-desc');
    if (!canvas) throw new Error('decomposition scene needs a canvas');
    if (!doc.getElementById('decomp-scene-css')) { const st = doc.createElement('style'); st.id = 'decomp-scene-css'; st.textContent = CSS; doc.head.appendChild(st); }
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
    const top = h('div', { class: 'dc-ui' }), bottom = h('div', { class: 'dc-ui' });
    host.insertBefore(top, canvas); host.insertBefore(bottom, desc || null);

    // ----- state: validated copy of the saved record, or null before the test starts -----
    let st = null, pending = L.DEFAULT_TEMPS.slice(), confirmReset = false, metric = 'foam', announcedDone = false, lastDescMinute = -1, tickTimer = 0, rafId = 0;
    const s0 = api.getState().decomp;
    if (s0 && num(s0.seed) && num(s0.startedAt)) {
      st = { seed: s0.seed >>> 0, startedAt: s0.startedAt, skipped: !!s0.skipped, temps: L.normalizeTemps(s0.temps), recorded: (Array.isArray(s0.recorded) ? s0.recorded : []).filter(t => L.TIMES.includes(t)) };
      st.recorded = Array.from(new Set(st.recorded)).sort((a, b) => a - b);
      pending = st.temps.slice(); announcedDone = isDone();
    }
    const series = () => (st ? st.temps : pending).map((t, i) => L.foamSeries(st ? st.seed : api.seed('decomp'), i, t));
    function minutes() { return st ? L.minutesElapsed(st.startedAt, Date.now(), st.skipped) : 0; }
    function isDone() { return !!st && minutes() >= L.END_MIN; }
    const dueTimes = () => L.TIMES.filter(t => t <= minutes() + 1e-9);
    const nextDue = () => L.TIMES.find(t => !(st && st.recorded.includes(t)));
    const readingLabel = (due, allRec) => allRec ? 'All 11 readings recorded' :
      due.length ? 'Record next unrecorded sample (' + due[0] + ' min)' : 'Next reading at ' + nextDue() + ' min';
    function persist() { api.saveState('decomp', { seed: st.seed, startedAt: st.startedAt, skipped: st.skipped, temps: st.temps, recorded: st.recorded, updatedAt: Date.now() }); }
    const tempLabel = t => t + ' °C';
    const tempWord = t => L.TEMP_NAMES[t] || '';

    // ----- actions -----
    function start() {
      st = { seed: api.seed('decomp'), startedAt: Date.now(), skipped: false, temps: pending.slice(), recorded: [], };
      announcedDone = false; lastDescMinute = -1; persist(); render();
      api.announce('Test started. The three beakers are at ' + st.temps.map(tempLabel).join(', ') + '. Record the foam height every 2 minutes.');
    }
    function record(all) {
      if (!st) return;
      const due = dueTimes().filter(t => !st.recorded.includes(t));
      if (!due.length) return;
      const take = all ? due : [due[0]];
      st.recorded = st.recorded.concat(take).sort((a, b) => a - b);
      persist(); render('[data-dc="record"]');
      api.announce(take.length === 1 ? 'Recorded the ' + take[0] + ' minute reading.' : 'Recorded ' + take.length + ' readings, up to ' + take[take.length - 1] + ' minutes.');
    }
    function skipAhead() {
      if (!st || st.skipped || isDone()) return;
      st.skipped = true; persist(); render('[data-dc="record"]');
      api.announce('Skipped ahead. The 20 minutes are over. Record the readings.'); announcedDone = true;
    }
    function startOver() {
      st = null; confirmReset = false; announcedDone = false; lastDescMinute = -1; pending = L.DEFAULT_TEMPS.slice();
      api.saveState('decomp', null); render(); api.announce('Started over. Choose the water temperatures.');
    }

    // ----- controls and results (DOM) -----
    function render(focusSel) {
      stopTick();
      top.replaceChildren(); bottom.replaceChildren();
      if (!st) renderSetup(); else renderRun();
      if (focusSel) { const f = host.querySelector(focusSel); if (f && !f.disabled) f.focus(); }
      lastDescMinute = -1; draw(); updateDesc();
      if (st && !isDone()) startTick();
    }
    function renderSetup() {
      const box = h('div', { class: 'dc-panel' }, h('h4', { text: 'Set up three beakers' }),
        h('p', { class: 'dc-note', text: 'Each beaker has 100 mL of water, the same sugar and the same yeast. Only the water temperature changes. The lesson uses cold, room and warm water.' }));
      const grid = h('div', { class: 'dc-setup' });
      [0, 1, 2].forEach(i => {
        const sel = h('select', { id: 'dc-temp-' + i }), lab = h('label', { for: 'dc-temp-' + i, text: L.BEAKER_NAMES[i] + ' water temperature' });
        L.TEMPS.forEach(t => { const o = h('option', { value: String(t), text: tempLabel(t) + ' · ' + tempWord(t).toLowerCase() }); if (t === pending[i]) o.selected = true; sel.appendChild(o); });
        sel.addEventListener('change', () => { pending[i] = L.normalizeTemp(sel.value); draw(); updateDesc(); });
        grid.appendChild(h('div', { class: 'dc-field' }, lab, sel));
      });
      box.appendChild(grid);
      const go = h('button', { type: 'button', class: 'btn btn--primary', 'data-dc': 'start', text: 'Start the test' }); go.addEventListener('click', start);
      box.appendChild(h('div', { class: 'dc-actions' }, go));
      box.appendChild(h('p', { class: 'dc-note', text: 'Simulated: one minute takes 4 seconds, so the whole test takes about 80 seconds. Your Dataset ID sets your beakers’ small differences.' }));
      top.appendChild(box);
    }
    function renderRun() {
      const m = minutes(), done = isDone(), due = dueTimes().filter(t => !st.recorded.includes(t)), allRec = st.recorded.length === L.TIMES.length;
      const clock = h('div', { class: 'dc-panel dc-clock' });
      clock.appendChild(h('h4', { text: 'The test' }));
      const strong = h('strong', { 'data-dc': 'clock', text: done ? 'Finished: 20 of 20 min' : 'Minute ' + Math.floor(m) + ' of 20' });
      const bar = h('div', { class: 'dc-bar', role: 'presentation' }, h('i', { 'data-dc': 'bar', style: 'width:' + Math.round(m / L.END_MIN * 100) + '%' }));
      clock.appendChild(strong); clock.appendChild(bar);
      clock.appendChild(h('p', { class: 'dc-note', 'data-dc': 'hint', text: hint(due, done, allRec) }));
      const catchUp = done && due.length > 1;
      const rec = h('button', { type: 'button', class: 'btn' + (catchUp ? '' : ' btn--primary'), 'data-dc': 'record', text: readingLabel(due, allRec) });
      rec.disabled = !due.length; rec.addEventListener('click', () => record(false));
      const recAll = h('button', { type: 'button', class: 'btn' + (catchUp ? ' btn--primary' : ''), 'data-dc': 'record-all', text: catchUp ? 'Record all ' + due.length + ' missing readings' : 'Record all readings so far' }); recAll.disabled = due.length < 2; recAll.addEventListener('click', () => record(true));
      const actions = h('div', { class: 'dc-actions' }, ...(catchUp ? [recAll, rec] : [rec, recAll]));
      if (!done) { const skip = h('button', { type: 'button', class: 'btn', 'data-dc': 'skip', text: 'Skip ahead for class' }); skip.addEventListener('click', skipAhead); actions.appendChild(skip); }
      actions.appendChild(resetControl());
      clock.appendChild(actions);
      clock.appendChild(h('p', { class: 'dc-note', text: 'In a real lab you would read each height off a ruler at its time. Here the button reads the simulated ruler for you.' }));
      top.appendChild(clock);
      resultsPanel();
    }
    function hint(due, done, allRec) {
      if (allRec) return 'Every reading is recorded. Look at the table and the chart.';
      if (done && due.length > 1) return 'The run is finished. Record all missing readings to fill the table, or add them one at a time starting at minute ' + due[0] + '.';
      if (done) return 'The run is finished. Record the sample from minute ' + due[0] + ' to finish your table.';
      if (due.length > 1) return 'The button records the oldest unrecorded sample first, not the current clock time. Record all readings so far to catch up.';
      if (due.length) return 'A reading is ready. Beaker temperatures: ' + st.temps.map((t, i) => L.BEAKER_NAMES[i] + ' ' + tempLabel(t)).join(', ') + '.';
      return 'Next reading at ' + nextDue() + ' minutes. Watch the foam rise.';
    }
    function resetControl() {
      const wrap = h('span', { class: 'dc-confirm' });
      if (!confirmReset) { const b = h('button', { type: 'button', class: 'btn btn--sm', 'data-dc': 'reset', text: 'Start over' }); b.addEventListener('click', () => { confirmReset = true; render('[data-dc="reset-yes"]'); }); wrap.appendChild(b); return wrap; }
      const yes = h('button', { type: 'button', class: 'btn btn--sm btn--danger', 'data-dc': 'reset-yes', text: 'Erase my readings and start over' }); yes.addEventListener('click', startOver);
      const no = h('button', { type: 'button', class: 'btn btn--sm', text: 'Cancel' }); no.addEventListener('click', () => { confirmReset = false; render('[data-dc="reset"]'); });
      wrap.appendChild(yes); wrap.appendChild(no); return wrap;
    }
    function resultsPanel() {
      const s = series(), rec = st.recorded;
      const wrap = h('div', { class: 'dc-panel' }, h('h4', { text: 'Results: simulated beakers' }));
      const tw = h('div', { class: 'table-wrap', role: 'region', tabindex: '0', 'aria-label': 'Foam height table (simulated). Scrolls sideways on narrow screens.' }), t = h('table', { class: 'data dc-table' });
      t.appendChild(h('caption', { text: 'Foam height in mm (simulated). ' + rec.length + ' of ' + L.TIMES.length + ' readings recorded.' }));
      t.appendChild(h('thead', {}, h('tr', {}, [h('th', { scope: 'col', text: 'Time (min)' })].concat(st.temps.map((tt, i) => h('th', { scope: 'col', text: L.BEAKER_NAMES[i] + ' (' + tempLabel(tt) + ')' }))))));
      const tb = h('tbody');
      L.TIMES.forEach((tm, k) => {
        const on = rec.includes(tm);
        tb.appendChild(h('tr', {}, h('th', { scope: 'row', text: String(tm) }), ...s.map(arr => h('td', { class: on ? 'num' : 'num dc-miss', text: on ? String(arr[k]) : '—' }))));
      });
      t.appendChild(tb); tw.appendChild(t); wrap.appendChild(tw);
      const chips = h('div', { class: 'dc-chips', role: 'group', 'aria-label': 'Chart shows' }, h('span', { class: 'dc-legend', text: 'Chart shows:' }));
      [['foam', 'Foam height (mm)'], ['co2', 'Carbon dioxide made (relative)']].forEach(([k, label]) => {
        const b = h('button', { type: 'button', class: 'dc-chip', 'aria-pressed': metric === k ? 'true' : 'false', text: label });
        b.addEventListener('click', () => { metric = k; chips.querySelectorAll('.dc-chip').forEach(c => c.setAttribute('aria-pressed', c === b ? 'true' : 'false')); drawChart(figBox); });
        chips.appendChild(b);
      });
      wrap.appendChild(chips);
      const figBox = h('div', { class: 'dc-chart', 'data-dc': 'chart' });
      wrap.appendChild(h('figure', { class: 'dc-fig' }, figBox, h('figcaption', { class: 'dc-note', text: 'Line chart of the table above (simulated). Each beaker has its own line, marker shape and line pattern. Foam is carbon dioxide gas, so relative carbon dioxide is foam height divided by 10.' })));
      bottom.appendChild(wrap);
      if (win.Lab && Lab.tableFit) Lab.tableFit.scan();
      drawChart(figBox);
    }
    function drawChart(box) {
      if (!box) return;
      const s = series(), rec = st ? st.recorded : [];
      const cv = metric === 'co2' ? L.co2Made : (x => x);
      const data = (st ? st.temps : pending).map((tt, i) => ({ name: L.BEAKER_NAMES[i] + ' · ' + tempLabel(tt), points: L.TIMES.filter(tm => rec.includes(tm)).map(tm => ({ x: tm, y: cv(s[i][L.TIMES.indexOf(tm)]) })), line: true, dots: true }));
      box.replaceChildren();
      if (win.Lab && Lab.chart) {
        try { Lab.chart(box, { type: 'xy', responsive: true, xLabel: 'Time (min)', yLabel: metric === 'co2' ? 'Carbon dioxide made (relative, simulated)' : 'Foam height (mm, simulated)', xMin: 0, xMax: 20, yMin: 0, series: data }); }
        catch (e) { box.textContent = 'The chart could not be drawn. The table above has every number.'; }
      }
    }

    // ----- drawing -----
    function isDark() { const a = doc.documentElement.getAttribute('data-theme'); return a === 'dark' || (a !== 'light' && !!win.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches); }
    const bubbleCache = {};
    function bubblesFor(i, count) {
      const key = i + ':' + (st ? st.seed : 0);
      if (!bubbleCache[key]) { const r = L.makeRng(L.hash32(key + ':bubbles')), arr = []; for (let k = 0; k < 420; k++) arr.push({ u: r.uniform(), v: Math.pow(r.uniform(), 0.8), r: 0.7 + r.uniform() * 1.6, tone: r.uniform(), ph: r.uniform() * 6.28 }); bubbleCache[key] = arr; }
      return bubbleCache[key];
    }
    function geometry(W, H) {
      const cw = W / 3, iw = Math.min(116, cw * 0.58), rim = 78, floor = H - 46, p = (floor - 6 - rim) / MM_VIEW;
      return { cw, iw, rim, floor, p, beakers: [0, 1, 2].map(i => { const cx = cw * (i + 0.5); return { cx, left: cx - iw / 2, right: cx + iw / 2, waterTop: floor - 6 - WATER_MM * p, bottom: floor - 6 }; }) };
    }
    function draw() {
      const W = Math.floor(canvas.clientWidth), H = Math.floor(canvas.clientHeight);
      if (!W || !H) return;
      const dpr = win.devicePixelRatio || 1;
      if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) { canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); }
      const ctx = canvas.getContext('2d'); if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
      const ink = css('--ink', '#14211c'), muted = css('--muted', '#56665f'), surface = css('--surface', '#fff'), surface2 = css('--surface-2', '#eef2ef'), line = css('--line', '#c9d2cd'), accent = css('--accent', '#0d6e55');
      const dark = isDark(), G = geometry(W, H), temps = st ? st.temps : pending, ser = series(), m = minutes();
      // bench
      ctx.fillStyle = surface2; ctx.fillRect(0, 0, W, H);
      const bg = ctx.createLinearGradient(0, G.floor, 0, H); bg.addColorStop(0, dark ? '#2a3331' : '#d9dfd9'); bg.addColorStop(1, dark ? '#1c2321' : '#c4ccc5');
      ctx.fillStyle = bg; ctx.fillRect(0, G.floor, W, H - G.floor);
      ctx.strokeStyle = line; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, G.floor + 0.5); ctx.lineTo(W, G.floor + 0.5); ctx.stroke();
      ctx.textBaseline = 'alphabetic';
      temps.forEach((T, i) => {
        const B = G.beakers[i], foamMm = L.foamAt(ser[i], m), foamPx = foamMm * G.p, foamTop = B.waterTop - foamPx, running = !!st && !isDone();
        // soft shadow on the bench
        ctx.save(); ctx.translate(B.cx, G.floor + 7); ctx.scale(1, 0.22);
        const sh = ctx.createRadialGradient(0, 0, 4, 0, 0, G.iw * 0.78); sh.addColorStop(0, dark ? 'rgba(0,0,0,.6)' : 'rgba(40,50,45,.38)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = sh; ctx.beginPath(); ctx.arc(0, 0, G.iw * 0.78, 0, 7); ctx.fill(); ctx.restore();
        // water (cloudy, yeast-tan), with a curved meniscus where it meets the glass
        const wg = ctx.createLinearGradient(0, B.waterTop, 0, B.bottom); wg.addColorStop(0, dark ? 'rgba(196,170,120,.78)' : 'rgba(224,200,150,.8)'); wg.addColorStop(1, dark ? 'rgba(150,126,86,.9)' : 'rgba(196,166,112,.9)');
        ctx.fillStyle = wg; ctx.beginPath(); ctx.moveTo(B.left + 2, B.waterTop - 3); ctx.quadraticCurveTo(B.left + 4, B.waterTop + 3, B.left + 9, B.waterTop + 3); ctx.lineTo(B.right - 9, B.waterTop + 3); ctx.quadraticCurveTo(B.right - 4, B.waterTop + 3, B.right - 2, B.waterTop - 3);
        ctx.lineTo(B.right - 2, B.bottom - 6); ctx.quadraticCurveTo(B.right - 2, B.bottom - 2, B.right - 8, B.bottom - 2); ctx.lineTo(B.left + 8, B.bottom - 2); ctx.quadraticCurveTo(B.left + 2, B.bottom - 2, B.left + 2, B.bottom - 6); ctx.closePath(); ctx.fill();
        // yeast sediment
        ctx.fillStyle = dark ? 'rgba(120,96,60,.8)' : 'rgba(150,118,70,.55)'; ctx.fillRect(B.left + 6, B.bottom - 5, G.iw - 12, 3);
        // foam: a beige body made of many bubbles; more foam, more bubbles, up to the top bubbles that stick out of the glass-line
        if (foamPx > 0.5) {
          const fw = G.iw - 4, fx = B.left + 2;
          ctx.save(); ctx.beginPath(); ctx.rect(fx, foamTop - 8, fw, foamPx + 9); ctx.clip();
          ctx.fillStyle = dark ? '#cdb98c' : '#e4d3a6'; ctx.fillRect(fx, foamTop + 2, fw, foamPx + 4);
          const bubs = bubblesFor(i), n = Math.min(bubs.length, Math.round(foamPx * 3.2 + 12)), t = win.performance.now() / 1000, animate = running && !reduced();
          for (let k = 0; k < n; k++) {
            const b = bubs[k], bx = fx + 3 + b.u * (fw - 6), by = B.waterTop - 1 - (b.v * (foamPx - 1)) + (animate ? Math.sin(t * 1.6 + b.ph) * 0.6 : 0), br = b.r * (G.iw > 90 ? 2.1 : 1.8);
            ctx.fillStyle = b.tone > 0.5 ? (dark ? '#e6d6ac' : '#f2e6c4') : (dark ? '#b8a273' : '#d3bf90'); ctx.beginPath(); ctx.arc(bx, by, br, 0, 7); ctx.fill();
            ctx.strokeStyle = dark ? 'rgba(255,248,225,.55)' : 'rgba(120,96,50,.45)'; ctx.lineWidth = 0.8; ctx.stroke();
            ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.beginPath(); ctx.arc(bx - br * 0.3, by - br * 0.3, br * 0.28, 0, 7); ctx.fill();
          }
          // rough top edge: a row of bubble caps right at the foam top, so the top of the foam is the measured height
          for (let x = fx + 3; x < fx + fw - 2; x += 5) { ctx.fillStyle = dark ? '#e6d6ac' : '#f2e6c4'; ctx.beginPath(); ctx.arc(x, foamTop + 2.5, 3.2, Math.PI, 0); ctx.fill(); ctx.strokeStyle = dark ? 'rgba(255,248,225,.55)' : 'rgba(120,96,50,.45)'; ctx.lineWidth = 0.8; ctx.stroke(); }
          ctx.restore();
        } else { ctx.strokeStyle = dark ? '#e6d6ac' : '#f2e6c4'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(B.left + 9, B.waterTop + 1); ctx.lineTo(B.right - 9, B.waterTop + 1); ctx.stroke(); }
        // rising gas bubbles in the water while the yeast work (not drawn with reduced motion)
        if (running && !reduced() && foamMm > 0) { const t = win.performance.now() / 1000, rate = Math.min(1, 0.25 + foamMm / 40); for (let k = 0; k < 7; k++) { const ph = (t * (0.3 + 0.06 * k) * rate + k * 0.37 + i * 0.2) % 1, bx = B.left + 12 + ((k * 37 + i * 11) % 100) / 100 * (G.iw - 24), by = B.bottom - 6 - ph * (B.bottom - B.waterTop - 8); ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(bx, by, 1.5 + (k % 3) * 0.6, 0, 7); ctx.stroke(); } }
        // glass: thin walls, rim lip, base, a bright highlight and mL graduations
        ctx.strokeStyle = dark ? 'rgba(220,235,240,.8)' : 'rgba(80,110,120,.85)'; ctx.lineWidth = 2.4; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(B.left - 5, G.rim - 2); ctx.lineTo(B.left, G.rim + 2); ctx.lineTo(B.left, B.bottom - 8); ctx.quadraticCurveTo(B.left, B.bottom, B.left + 8, B.bottom); ctx.lineTo(B.right - 8, B.bottom); ctx.quadraticCurveTo(B.right, B.bottom, B.right, B.bottom - 8); ctx.lineTo(B.right, G.rim + 2); ctx.lineTo(B.right + 5, G.rim - 2); ctx.stroke();
        ctx.fillStyle = dark ? 'rgba(200,225,235,.10)' : 'rgba(200,230,240,.22)'; ctx.fillRect(B.left + 1, G.rim + 2, G.iw - 2, B.bottom - G.rim - 4);
        ctx.strokeStyle = dark ? 'rgba(255,255,255,.5)' : 'rgba(255,255,255,.9)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(B.left + 7, G.rim + 18); ctx.lineTo(B.left + 7, B.bottom - 28); ctx.stroke();
        ctx.strokeStyle = dark ? 'rgba(220,235,240,.7)' : 'rgba(80,110,120,.7)'; ctx.lineWidth = 1;
        for (let k = 1; k <= 5; k++) { const yy = B.bottom - k * 50 * (WATER_MM / 100) * G.p; /* every 50 mL of a 250 mL beaker; 100 mL is the water line */ if (yy > G.rim + 8) { ctx.beginPath(); ctx.moveTo(B.right - (k % 2 ? 9 : 14), yy); ctx.lineTo(B.right, yy); ctx.stroke(); } }
        // ruler beside the beaker: 0 mm is the water surface, so the foam top reads straight off it
        const rx = B.left - 20, rw = 13;
        ctx.fillStyle = dark ? 'rgba(236,230,200,.92)' : 'rgba(250,244,214,.95)'; ctx.strokeStyle = dark ? '#6b6642' : '#8d865a'; ctx.lineWidth = 1;
        ctx.fillRect(rx, G.rim, rw, B.waterTop - G.rim + 4); ctx.strokeRect(rx + 0.5, G.rim + 0.5, rw - 1, B.waterTop - G.rim + 3);
        ctx.fillStyle = '#2b2a1c'; ctx.font = '600 9px ' + css('--f-mono', 'monospace'); ctx.textAlign = 'left';
        for (let mm = 0; mm <= 100; mm += 10) { const y = B.waterTop - mm * G.p; if (y < G.rim + 3) break; ctx.strokeStyle = '#2b2a1c'; ctx.beginPath(); ctx.moveTo(rx + rw, y); ctx.lineTo(rx + rw - (mm % 20 ? 4 : 8), y); ctx.stroke(); if (mm % 20 === 0 && G.p > 1.5 && mm > 0) ctx.fillText(String(mm), rx + 1, y + 3); }
        // header: beaker name, temperature (and its word, so it is not color or position alone)
        ctx.fillStyle = ink; ctx.textAlign = 'center'; ctx.font = '700 14px ' + css('--f-body', 'system-ui');
        ctx.fillText(L.BEAKER_NAMES[i], B.cx, 18);
        ctx.font = '600 12px ' + css('--f-body', 'system-ui'); ctx.fillStyle = muted; ctx.fillText(tempLabel(T) + ' · ' + tempWord(T).toLowerCase(), B.cx, 34);
        // foam label with a leader line that ends in a dot on the foam top (or the water surface when there is no foam yet)
        const ay = foamPx > 0.5 ? foamTop + 1 : B.waterTop + 1, label = 'Foam ' + Math.round(foamMm) + ' mm', ly = 56;
        ctx.font = '700 12px ' + css('--f-body', 'system-ui'); const tw = ctx.measureText(label).width + 12;
        ctx.strokeStyle = ink; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(B.cx, ly + 6); ctx.lineTo(B.cx, ay); ctx.stroke();
        ctx.fillStyle = surface; ctx.strokeStyle = line; ctx.lineWidth = 1; ctx.beginPath(); ctx.rect(B.cx - tw / 2, ly - 12, tw, 18); ctx.fill(); ctx.stroke();
        ctx.fillStyle = ink; ctx.textAlign = 'center'; ctx.fillText(label, B.cx, ly + 1);
        ctx.fillStyle = accent; ctx.strokeStyle = surface; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(B.cx, ay, 3.4, 0, 7); ctx.fill(); ctx.stroke();
      });
      // bench caption
      ctx.fillStyle = muted; ctx.font = '600 11px ' + css('--f-mono', 'monospace'); ctx.textAlign = 'left';
      ctx.fillText(st ? 'SIMULATED · minute ' + Math.floor(m) + ' of 20' : 'SIMULATED · not started', 10, H - 12);
      if (W > 560) { ctx.textAlign = 'right'; ctx.fillText('ruler: 0 mm = water surface', W - 10, H - 12); }
      canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', canvasLabel());
    }
    function canvasLabel() {
      const temps = st ? st.temps : pending, s = series(), m = minutes();
      return 'Three simulated beakers of yeast and sugar water. ' + temps.map((t, i) => L.BEAKER_NAMES[i] + ' at ' + tempLabel(t) + (st ? ' has ' + Math.round(L.foamAt(s[i], m)) + ' millimeters of foam' : '')).join('; ') + '.' + (st ? ' Minute ' + Math.floor(m) + ' of 20.' : ' The test has not started.');
    }
    function updateDesc() {
      const m = Math.floor(minutes()); if (m === lastDescMinute) return; lastDescMinute = m;
      if (!desc) return;
      const temps = st ? st.temps : pending, s = series();
      desc.textContent = !st ? 'Text description: three simulated beakers of yeast in sugar water at ' + temps.map(tempLabel).join(', ') + '. The test has not started, so there is no foam.'
        : 'Text description: at minute ' + m + ' of 20, ' + temps.map((t, i) => L.BEAKER_NAMES[i] + ' (' + tempLabel(t) + ') has ' + Math.round(L.foamAt(s[i], minutes())) + ' mm of foam').join('; ') + '. ' + st.recorded.length + ' of 11 readings recorded. Simulated data.';
      canvas.setAttribute('aria-label', canvasLabel());
    }

    // ----- clock: timestamps drive everything; this timer only repaints -----
    function startTick() {
      if (tickTimer) return;
      tickTimer = win.setInterval(tick, 250);
      if (!reduced()) { const loop = () => { if (!st || isDone()) { rafId = 0; return; } draw(); rafId = win.requestAnimationFrame(loop); }; rafId = win.requestAnimationFrame(loop); }
    }
    function stopTick() { if (tickTimer) { win.clearInterval(tickTimer); tickTimer = 0; } if (rafId) { win.cancelAnimationFrame(rafId); rafId = 0; } }
    function tick() {
      if (!st) { stopTick(); return; }
      const m = minutes(), done = m >= L.END_MIN, due = dueTimes().filter(t => !st.recorded.includes(t)), allRec = st.recorded.length === L.TIMES.length;
      const clock = top.querySelector('[data-dc="clock"]'), bar = top.querySelector('[data-dc="bar"]'), rec = top.querySelector('[data-dc="record"]'), recAll = top.querySelector('[data-dc="record-all"]'), hintEl = top.querySelector('[data-dc="hint"]');
      if (clock) clock.textContent = done ? 'Finished: 20 of 20 min' : 'Minute ' + Math.floor(m) + ' of 20';
      if (bar) bar.style.width = Math.round(m / L.END_MIN * 100) + '%';
      if (rec && !allRec) { rec.disabled = !due.length; rec.textContent = readingLabel(due, allRec); }
      if (recAll) recAll.disabled = due.length < 2;
      if (hintEl) hintEl.textContent = hint(due, done, allRec);
      if (reduced()) draw();
      updateDesc();
      if (done) { stopTick(); if (!announcedDone) { announcedDone = true; api.announce('The 20 minutes are over. Record the readings.'); } render(); }
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
  (window.B2Scenes = window.B2Scenes || []).push({ id: 'decomp', mount: mount });
})();
