/* Burn demonstration (OpenSciEd B.2 Lesson 2 companion, host #burn-scene, scene id "burn").
   A web stand-in for the teacher's Burning Fuels demonstration: five dry fuels (dried grass 4 g, dried leaves 4 g, wood chips 10 g, charcoal 10 g, peat 30 g: the handfuls are not equal, as the Teacher Edition notes) are burned
   on a heat-safe tray under a glass dome (an inverted bowl) that captures the carbon dioxide. A Petri dish of BTB sits INSIDE the dome beside the fuel, exposed to
   the air under the dome. A balance weighs the sample before and after, and a laser (infrared) thermometer is aimed at the fuel (through the dome glass, before the burn) and at the ash (dome lifted, after it).
   EVERYTHING HERE IS SIMULATED: the
   numbers come from the small model in openscied-b2-burn-logic.js (assumptions at the top of that file and on the page under "What this simulation
   models"), seeded from the student's Dataset ID, not measured from real fuels. This page replaces the real demonstration and none of its safety steps:
   real burning is done by the teacher with goggles, ventilation and everyone 15 feet back.

   Flow: pick a fuel -> "Burn it (virtual)" (stores a START TIMESTAMP, so a reload picks up where the clock is; 6 simulated seconds pass each real second,
   so peat takes about a minute and grass a few seconds; "Skip ahead for class" finishes at once, and with reduced motion the burn is shown finished) ->
   tap what you saw -> "Record results" fills one row of the table (fuel, time to ignite, BTB before and after, temperature, mass, observations) ->
   burn the next fuel, or a second sample of the same one (up to 3 each; a second sample differs a little, like real samples).
   The drawing is a canvas scaled for devicePixelRatio, redrawn on resize and theme change. Flame, glow, smoke, the shrinking sample, the carbon dioxide and
   droplets under the dome, the BTB color in the dish, the laser thermometer reading and the balance all come from the model state at that moment, so the picture always matches the numbers. Labels use computed
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
    '.scene-host.tall canvas{aspect-ratio:auto;height:clamp(270px,26vw,340px);min-height:0}@media(max-width:560px){.scene-host.tall canvas{height:290px}.bn-table{font-size:.82rem}.bn-table th,.bn-table td{padding:5px 4px}.bn-actions .btn{flex:1 1 auto}}';

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
    let st = L.cleanState(api.getState().burn), pending = st ? st.fuel : 'grass', confirmReset = false, metric = 'rise', lastStage = '', tickTimer = 0, rafId = 0, lastDescKey = '';
    const seedNow = () => st ? st.seed : api.seed('burn');
    const sampleNo = fuel => L.nextSample(st, fuel);
    // read = the laser thermometer and the balance have been read at this weighing: before (ready) or after (finished). Nothing is read while it burns.
    function view() {
      const cur = st && st.current;
      if (!cur && st?.review) {
        const res = L.burnResult(st.seed, st.review.fuel, st.review.n);
        return { phase: 'finished', res, sim: L.stateAt(res, res.runS), t: res.runS, read: true, saved: true };
      }
      if (cur) {
        const res = L.burnResult(st.seed, cur.fuel, cur.n), t = L.simSeconds(cur.startedAt, Date.now(), cur.skipped, res.runS), phase = t >= res.runS ? 'finished' : 'running';
        return { phase, res, sim: L.stateAt(res, t), t, read: phase === 'finished' && !!cur.after };
      }
      const n = sampleNo(pending) || L.MAX_SAMPLES, res = L.burnResult(seedNow(), pending, n), w = st && st.weighed;
      return { phase: 'ready', res, sim: L.stateAt(res, 0), t: 0, read: !!(w && w.fuel === pending && w.n === sampleNo(pending)) };
    }
    function persist() { return api.saveState('burn', { seed: st.seed, fuel: st.fuel, current: st.current, records: st.records, weighed: st.weighed || null, review: st.review || null, updatedAt: Date.now() }); }
    const stageText = v => v.phase === 'ready' ? (v.read ? 'Weighed and read, ready to burn' : 'Ready: not weighed yet') : v.sim.stage === 'heating' ? 'Being lit with a lighter' : v.sim.stage === 'burning' ? 'Burning' : v.sim.stage === 'dying' ? 'Dying out' : v.read ? 'Weighed again' : 'Out and cooled';
    const secs = s => Math.round(s) + ' s';

    // ----- actions -----
    function weighBefore() {
      const n = sampleNo(pending); if (!n || (st && st.current)) return;
      if (!st) st = { seed: api.seed('burn'), fuel: pending, current: null, records: [], weighed: null };
      st.fuel = pending; st.weighed = { fuel: pending, n }; persist(); render('[data-bn="burn"]');
      const r = view().res;
      api.announce('Weighed: ' + r.massBefore.toFixed(1) + ' grams. The laser thermometer aimed at the fuel reads ' + r.tempBefore + ' degrees Celsius. Now burn it.');
    }
    function finishReading() {
      if (!st?.current || view().phase !== 'finished') return null;
      const c = st.current;
      // Complete evidence once, after both weighings. A review points at that record, not a second burn.
      if (!st.records.some(row => row.fuel === c.fuel && row.n === c.n)) {
        st.records = st.records.concat([{ fuel: c.fuel, n: c.n, obs: (c.obs || []).slice() }]);
      }
      st.review = { fuel: c.fuel, n: c.n }; st.current = null; st.weighed = null; pending = c.fuel;
      lastStage = ''; lastDescKey = ''; return persist();
    }
    function weighAfter() {
      if (!st || !st.current) return;
      const v = view(); if (v.phase !== 'finished') return;
      const saved = finishReading();
      if (saved === null) return;
      render('[data-bn="saved"]');
      const r = v.res;
      api.announce((saved ? 'Saved ' : 'Recorded only in this tab. Download a copy before leaving. ') + r.label.toLowerCase() + ', sample ' + r.n + '. Ash: ' + r.massAfter.toFixed(1) + ' grams and ' + r.tempAfter + ' degrees Celsius. You can add observations or choose the next sample.');
    }
    function burn() {
      const n = sampleNo(pending); if (!n || (st && st.current) || !view().read) return;
      st.fuel = pending; st.weighed = null; st.current = { fuel: pending, n, startedAt: Date.now(), skipped: reduced(), after: false };
      lastStage = ''; lastDescKey = ''; persist(); render(reduced() ? '[data-bn="after"]' : '[data-bn="skip"]');
      api.announce(reduced() ? 'Burned ' + L.fuelLabel(pending).toLowerCase() + ', sample ' + n + '. Reduced motion is on, so the burn is shown finished. Lift the dome, weigh it and read the temperature again.'
        : 'Burning ' + L.fuelLabel(pending).toLowerCase() + ', sample ' + n + '. Watch the flame, the BTB in the dish, the laser thermometer and the balance.');
    }
    function skipAhead() {
      if (!st || !st.current || st.current.skipped) return;
      st.current.skipped = true; persist(); render('[data-bn="after"]');
      api.announce('Skipped ahead. The fuel is out. Lift the dome, weigh it and read the temperature again.'); lastStage = 'done';
    }
    function nextSample() {
      if (!st?.review) return;
      st.review = null; persist(); render('#bn-fuel');
    }
    function startOver() {
      st = null; confirmReset = false; lastStage = ''; lastDescKey = ''; pending = 'grass';
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
      const wb = h('button', { type: 'button', class: 'btn' + (v.read ? '' : ' btn--primary'), 'data-bn': 'weigh', text: !left ? 'All 3 samples burned' : v.read ? '✓ Weighed and read (before)' : 'Weigh and read temperature (before)' }); wb.disabled = !left || v.read; wb.addEventListener('click', weighBefore);
      const go = h('button', { type: 'button', class: 'btn' + (v.read ? ' btn--primary' : ''), 'data-bn': 'burn', text: 'Burn it (virtual)' }); go.disabled = !left || !v.read; go.addEventListener('click', burn);
      box.appendChild(h('div', { class: 'bn-setup' }, h('div', { class: 'bn-field' }, h('label', { for: 'bn-fuel', text: 'Fuel to burn' }), sel), h('div', { class: 'bn-actions' }, wb, go, resetControl())));
      box.appendChild(readoutRow([['Sample', left ? (used ? 'Sample ' + left + ' of ' + L.fuelLabel(pending).toLowerCase() : L.massOf(pending) + ' g of ' + L.fuelLabel(pending).toLowerCase()) : 'none left'], ['Mass on the balance (before)', left && v.read ? v.res.massBefore.toFixed(1) + ' g' : '—'], ['Fuel temperature, laser (before)', left && v.read ? v.res.tempBefore + ' °C' : '—'], ['BTB color', L.btbText(L.START_BTB)]]));
      box.appendChild(h('p', { class: 'bn-note', text: 'Step 1: weigh the handful and read the temperature. Step 2: burn it. Step 3: weigh and read the temperature again. ' + (st && st.records.length ? 'A second sample of the same fuel gives slightly different numbers.' : 'Simulated: a real burn takes minutes; here 6 seconds pass every second.') }));
      top.appendChild(box);
    }
    function renderRunning(v) {
      const clock = h('div', { class: 'bn-panel bn-clock' }, h('h4', { text: 'Burning ' + v.res.label.toLowerCase() + ' (sample ' + v.res.n + ')' }));
      clock.appendChild(h('strong', { 'data-bn': 'clock', text: 'Burn time ' + secs(v.t) }));
      clock.appendChild(h('div', { class: 'bn-bar', role: 'presentation' }, h('i', { 'data-bn': 'bar', style: 'width:' + Math.round(v.sim.progress * 100) + '%' })));
      clock.appendChild(h('p', { class: 'bn-note', 'data-bn': 'stage', text: stageText(v) + '.' }));
      clock.appendChild(h('p', { class: 'bn-note', text: 'The laser thermometer is put down while it burns. Nothing is weighed or read until the fuel is out.' }));
      const skip = h('button', { type: 'button', class: 'btn', 'data-bn': 'skip', text: 'Skip ahead for class' }); skip.addEventListener('click', skipAhead);
      clock.appendChild(h('div', { class: 'bn-actions' }, skip, resetControl()));
      top.appendChild(clock);
    }
    function renderFinished(v) {
      const r = v.res, box = h('div', { class: 'bn-panel' }, h('h4', { text: v.saved ? 'Both weighings complete' : 'The ' + r.label.toLowerCase() + ' is out.' }));
      const next = v.saved ? 'This sample is in your evidence table. You can add observations below.' : 'Lift the dome and weigh the ash to save this sample automatically.';
      box.appendChild(h('p', { class: v.saved ? 'bn-saved' : 'bn-pending', id: 'bn-pending', 'data-bn': v.saved ? 'saved' : 'pending', tabindex: v.saved ? '-1' : null },
        h('strong', { text: v.saved ? '✓ Sample recorded. ' : 'Not recorded yet. ' }), next));
      box.appendChild(readoutRow([['Caught fire after', r.igniteS + ' s'], ['Burned for', r.burnS + ' s'], ['BTB color', L.btbText(r.btbBefore) + ' → ' + L.btbText(r.btbAfter)], ['Fuel temperature, laser', v.read ? r.tempBefore + ' → ' + r.tempAfter + ' °C' : '— (not read yet)'], ['Mass on the balance', v.read ? r.massBefore.toFixed(1) + ' → ' + r.massAfter.toFixed(1) + ' g' : '— (not weighed yet)']]));
      if (!v.read) {
        const ab = h('button', { type: 'button', class: 'btn btn--primary', 'data-bn': 'after', 'aria-describedby': 'bn-pending', text: 'Lift dome and weigh ash (after)' }); ab.addEventListener('click', weighAfter);
        box.appendChild(h('div', { class: 'bn-actions' }, ab, resetControl()));
        box.appendChild(h('p', { class: 'bn-note', text: 'This step also reads the simulated ash temperature after the burn.' }));
        top.appendChild(box); return;
      }
      const recorded = st.records.find(row => row.fuel === r.fuel && row.n === r.n);
      const fs = h('fieldset', { class: 'bn-obs' }, h('legend', { class: 'bn-legend', text: 'Optional observations: what did you see? Select any that match, or leave them blank.' }));
      L.OBS.forEach(o => {
        const b = h('button', { type: 'button', class: 'bn-chip', 'aria-pressed': String(recorded.obs.includes(o.id)), text: o.label });
        b.addEventListener('click', () => {
          recorded.obs = recorded.obs.includes(o.id) ? recorded.obs.filter(x => x !== o.id) : recorded.obs.concat(o.id);
          b.setAttribute('aria-pressed', String(recorded.obs.includes(o.id)));
          persist(); renderResults();
        });
        fs.appendChild(b);
      });
      box.appendChild(fs);
      const rec = h('button', { type: 'button', class: 'btn btn--primary', 'data-bn': 'next', text: 'Choose next sample' }); rec.addEventListener('click', nextSample);
      box.appendChild(h('div', { class: 'bn-actions' }, rec, resetControl()));
      box.appendChild(h('p', { class: 'bn-note', text: 'In a real demonstration you aim the laser thermometer and read the balance yourself, at each weighing. Here the buttons read the simulated instruments.' }));
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
      t.appendChild(h('thead', {}, h('tr', {}, ['Fuel (sample)', 'Caught fire after (s)', 'Burned for (s)', 'BTB color before → after (1 to 6)', 'Fuel temperature before → after (°C)', 'Mass before → after (g)', 'What I saw'].map(x => h('th', { scope: 'col', text: x })))));
      const tb = h('tbody');
      if (!rows.length) tb.appendChild(h('tr', {}, h('td', { colspan: '7', class: 'bn-miss', text: 'Complete both weighings to save your first sample here.' })));
      rows.forEach(r => tb.appendChild(h('tr', {}, h('th', { scope: 'row', text: r.label + ' (' + r.n + ')' }), h('td', { class: 'num', text: String(r.igniteS) }), h('td', { class: 'num', text: String(r.burnS) }),
        h('td', { text: L.btbText(r.btbBefore) + ' → ' + L.btbText(r.btbAfter) }), h('td', { class: 'num', text: r.tempBefore + ' → ' + r.tempAfter }), h('td', { class: 'num', text: r.massBefore.toFixed(1) + ' → ' + r.massAfter.toFixed(1) }), h('td', { text: obsText(r.obs) }))));
      t.appendChild(tb); tw.appendChild(t); wrap.appendChild(tw);
      wrap.appendChild(h('p', { class: 'bn-note', 'data-bn': 'temp-note', text: 'A rise of only a degree or two can be thermometer noise (the laser thermometer shows whole degrees). Compare fuels with big differences.' }));
      const chips = h('div', { class: 'bn-chips', role: 'group', 'aria-label': 'Chart shows' }, h('span', { class: 'bn-legend', text: 'Chart shows:' }));
      Object.keys(L.METRICS).forEach(k => {
        const b = h('button', { type: 'button', class: 'bn-chip', 'aria-pressed': metric === k ? 'true' : 'false', text: L.METRICS[k].label });
        b.addEventListener('click', () => { metric = k; chips.querySelectorAll('.bn-chip').forEach(c => c.setAttribute('aria-pressed', c === b ? 'true' : 'false')); drawChart(figBox); });
        chips.appendChild(b);
      });
      wrap.appendChild(chips);
      const figBox = h('div', { class: 'bn-chart', 'data-bn': 'chart' });
      wrap.appendChild(h('figure', { class: 'bn-fig' }, figBox, h('figcaption', { class: 'bn-note', text: 'Bar chart of the table above (simulated). Each fuel has one bar per sample, and each sample number has its own pattern. The table has every number.' })));
      bottom.replaceChildren(wrap);
      if (win.Lab && Lab.tableFit) Lab.tableFit.scan();
      drawChart(figBox);
    }
    function drawChart(box) {
      if (!box) return;
      const rows = L.tableRows(st), names = (box.clientWidth || 600) < 480 ? L.SHORT_NARROW : L.SHORT;   // short names so a label never breaks inside a word
      box.replaceChildren();
      const cap = box.parentElement && box.parentElement.querySelector('figcaption');
      if (cap) cap.textContent = 'Bar chart of the table above (simulated). Each fuel has one bar per sample, and each sample number has its own pattern.' + (names === L.SHORT_NARROW ? ' Hay = dried grass, Leaf = dried leaves, Char = charcoal.' : '') + ' The table has every number.';
      if (win.Lab && Lab.chart) {
        try { Lab.chart(box, { type: 'bar', responsive: true, height: 300, xLabel: 'Fuel', yLabel: names === L.SHORT_NARROW ? L.METRICS[metric].yShort : L.METRICS[metric].yLabel, yMin: 0, categories: L.FUELS.map(f => names[f.id]), series: L.chartSeries(rows, metric, names), emptyText: 'Record a burn to see its bar here' }); }
        catch (e) { box.textContent = 'The chart could not be drawn. The table above has every number.'; }
      }
    }

    // ----- drawing -----
    function isDark() { const a = doc.documentElement.getAttribute('data-theme'); return a === 'dark' || (a !== 'light' && !!win.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches); }
    const rgb = c => 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')';
    const rgba = (c, a) => 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';
    const mix = (a, b, t) => [0, 1, 2].map(i => Math.round(a[i] + (b[i] - a[i]) * clamp(t, 0, 1)));
    // The apparatus, from the canvas size: a half-sphere glass bowl (the dome, upside down, width twice its height) over a heat-safe tray with the burning fuel and a Petri dish of
    // BTB beside it, a laser thermometer used only at the two weighings, and a balance on the bench. Every position and label anchor is computed from these numbers.
    function geom(W, H) {
      const floor = H - 40, bw0 = clamp(W * 0.27, 92, 150);
      const u = clamp(Math.min((floor - 96) / 130, (W - 24 - bw0) / 260), 0.62, 1.3);
      const a = 100 * u, b = a, cx = Math.max(W * 0.42, 160 * u + 8), rimY = floor - 4 * u;                 // hemisphere: radius a, height b = a, centre x, rim on the bench
      const bw = clamp(W * 0.27, 92, 150 * u), bx0 = Math.min(W - bw - 12, cx + a + 190 * u);
      const fx = cx - 32 * u, trayTop = floor - 9 * u, sy = trayTop - 14 * u;                              // fuel sample position (centre)
      const dishX = cx + 52 * u, dishLiqY = floor - 9 * u;                                                  // BTB dish, inside the dome beside the fuel
      const ang = 0.61, dir = { x: Math.cos(ang), y: Math.sin(ang) };                                      // laser: about 35 degrees down to the right
      const th = 2 * Math.PI - 0.8, domePt = { x: cx + a * Math.cos(th), y: rimY + b * Math.sin(th) };      // a point on the outer glass, upper right (label anchor)
      return { floor, u, a, b, cx, rimY, top: rimY - b, bw, bx0, bcx: bx0 + bw / 2, panY: floor - 46 * u, fx, trayTop, sy, dishX, dishLiqY, ang, dir, domePt };
    }
    // The laser thermometer is aimed at the FUEL: before the burn at the sample on the tray (the beam passes through the dome glass, which is down), after the burn at the ash on the
    // balance (the dome has been lifted, so the beam goes straight to it). The dot is computed from where the sample or the ash is drawn; the area is what the test measures.
    function laserPoints(G, mode, mf) {
      const u = G.u;
      if (mode === 'ash') {
        const T = { x: G.bcx, y: G.panY - 7 * u }, ang = 0.5, M = { x: T.x - Math.cos(ang) * 34 * u, y: T.y - Math.sin(ang) * 34 * u };
        return { T, M, ang, gunC: { x: M.x - Math.cos(ang) * 27 * u, y: M.y - Math.sin(ang) * 27 * u }, area: { x: T.x, y: T.y, r: 17 * u } };
      }
      const T = { x: G.fx, y: G.sy }, M = { x: G.cx - 116 * u, y: G.sy - 40 * u }, ang = Math.atan2(T.y - M.y, T.x - M.x);
      return { T, M, ang, gunC: { x: M.x - Math.cos(ang) * 27 * u, y: M.y - Math.sin(ang) * 27 * u }, area: { x: T.x, y: T.y, r: 18 * 0.72 * u * mf } };
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
    function drawGun(ctx, mx, my, ang, text, u, dark, css) {
      ctx.save(); ctx.translate(mx, my); ctx.rotate(ang);
      ctx.fillStyle = dark ? '#aab6b1' : '#3b4642'; ctx.strokeStyle = dark ? '#e4ece8' : '#1d2522'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(-54 * u, -7 * u); ctx.lineTo(-6 * u, -7 * u); ctx.lineTo(0, -3 * u); ctx.lineTo(0, 3 * u); ctx.lineTo(-6 * u, 7 * u); ctx.lineTo(-54 * u, 7 * u); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-40 * u, 7 * u); ctx.lineTo(-32 * u, 7 * u); ctx.lineTo(-30 * u, 26 * u); ctx.lineTo(-40 * u, 26 * u); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#0c1a14'; ctx.fillRect(-46 * u, -5 * u, 22 * u, 8 * u);
      if (text) { ctx.fillStyle = '#7dffb4'; ctx.font = '700 ' + Math.round(7.5 * Math.max(1, u)) + 'px ' + css('--f-mono', 'monospace'); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, -35 * u, -0.8 * u); ctx.textBaseline = 'alphabetic'; }
      ctx.fillStyle = text ? '#ff3b30' : (dark ? '#6c7874' : '#9aa6a1'); ctx.beginPath(); ctx.arc(-1.5 * u, 0, 2.2 * u, 0, 6.28); ctx.fill();
      ctx.restore();
    }
    function draw() {
      const W = Math.floor(canvas.clientWidth), H = Math.floor(canvas.clientHeight);
      if (!W || !H) return;
      const dpr = win.devicePixelRatio || 1;
      if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) { canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); }
      const ctx = canvas.getContext('2d'); if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
      const ink = css('--ink', '#14211c'), muted = css('--muted', '#56665f'), surface2 = css('--surface-2', '#eef2ef'), line = css('--line', '#c9d2cd');
      const dark = isDark(), G = geom(W, H), v = view(), sim = v.sim, res = v.res, u = G.u, mf = clamp(Math.sqrt(res.massStart / 10), 0.65, 1.7);   // bigger handfuls are drawn bigger
      const animate = v.phase === 'running' && !reduced(), tm = animate ? win.performance.now() / 1000 : 0, fuel = res.fuel;
      const metal = dark ? '#9aa6a2' : '#6c7874', metalLight = dark ? '#cfd8d4' : '#aab6b1', cx = G.cx, a = G.a, b = G.b, rimY = G.rimY;
      const lifted = v.phase === 'finished' && v.read, lift = lifted ? 0.2 * a : 0;                     // after the second weighing the dome has been lifted
      const gunOn = v.read && v.phase !== 'running', gunTemp = v.phase === 'ready' ? res.tempBefore : res.tempAfter;   // the laser is used only at the two weighings
      const LP = laserPoints(G, lifted ? 'ash' : 'fuel', mf), restM = { x: Math.max(4 + 54 * u, cx - a - 16 * u), y: G.floor - 26 * u };
      const gunBodyC = gunOn ? LP.gunC : { x: restM.x - 27 * u, y: restM.y };
      const domePath = (ia, ib) => { ctx.beginPath(); ctx.ellipse(cx, rimY, ia, ib, 0, Math.PI, 2 * Math.PI); ctx.closePath(); };
      // bench
      ctx.fillStyle = surface2; ctx.fillRect(0, 0, W, H);
      const bg = ctx.createLinearGradient(0, G.floor, 0, H); bg.addColorStop(0, dark ? '#2a3331' : '#d9dfd9'); bg.addColorStop(1, dark ? '#1c2321' : '#c4ccc5');
      ctx.fillStyle = bg; ctx.fillRect(0, G.floor, W, H - G.floor);
      ctx.strokeStyle = line; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, G.floor + 0.5); ctx.lineTo(W, G.floor + 0.5); ctx.stroke();
      const shadow = (x, w, k) => { ctx.save(); ctx.translate(x, G.floor + 6); ctx.scale(1, 0.2); const sh = ctx.createRadialGradient(0, 0, 3, 0, 0, w); sh.addColorStop(0, dark ? 'rgba(0,0,0,' + (0.6 * k) + ')' : 'rgba(40,50,45,' + (0.36 * k) + ')'); sh.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = sh; ctx.beginPath(); ctx.arc(0, 0, w, 0, 7); ctx.fill(); ctx.restore(); };
      shadow(cx + 6 * u, a * 1.18, lifted ? 0.7 : 1.15); shadow(G.bcx, G.bw * 0.7, 1);   // soft shadows of the dome and the balance
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      // balance (right): base, display, pedestal and pan; the fuel is weighed here before and after the burn
      const bw = G.bw, bx0 = G.bx0, baseTop = G.floor - 26 * u;
      const bag = ctx.createLinearGradient(0, baseTop, 0, G.floor); bag.addColorStop(0, dark ? '#c4cdc9' : '#eef2ef'); bag.addColorStop(1, dark ? '#8b9792' : '#b3beb9');
      ctx.fillStyle = bag; ctx.strokeStyle = dark ? '#5d6b65' : '#7b8782'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(bx0 + 8 * u, G.floor); ctx.lineTo(bx0, G.floor - 6 * u); ctx.lineTo(bx0 + 4 * u, baseTop); ctx.lineTo(bx0 + bw - 4 * u, baseTop); ctx.lineTo(bx0 + bw, G.floor - 6 * u); ctx.lineTo(bx0 + bw - 8 * u, G.floor); ctx.closePath(); ctx.fill(); ctx.stroke();
      const dw = bw * 0.62, dx = G.bcx - dw / 2, dy = baseTop + 5 * u, dh = 15 * u;
      ctx.fillStyle = '#0c1a14'; ctx.fillRect(dx, dy, dw, dh); ctx.strokeStyle = '#3c4a44'; ctx.strokeRect(dx + 0.5, dy + 0.5, dw - 1, dh - 1);
      const reading = v.phase === 'ready' && v.read ? res.massBefore.toFixed(1) + ' g' : lifted ? res.massAfter.toFixed(1) + ' g' : '--.- g';   // nothing is read while it burns
      ctx.fillStyle = '#7dffb4'; ctx.font = '700 ' + Math.round(12 * Math.max(0.8, u)) + 'px ' + css('--f-mono', 'monospace'); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(reading, G.bcx, dy + dh / 2 + 1); ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = dark ? '#aeb9b4' : '#8c9893'; ctx.fillRect(G.bcx - 5 * u, G.panY, 10 * u, baseTop - G.panY);
      ctx.fillStyle = dark ? '#d6dedb' : '#c4cdc9'; ctx.strokeStyle = dark ? '#6c7a74' : '#7b8782'; ctx.beginPath(); ctx.ellipse(G.bcx, G.panY, bw * 0.36, 7 * u, 0, 0, 6.28); ctx.fill(); ctx.stroke();
      if (v.phase === 'ready' && !v.read) drawSample(ctx, G.bcx, G.panY - 12 * u * mf, 0.62 * u * mf, fuel, 0, 0, dark);
      else if (lifted) drawAsh(ctx, G.bcx, G.panY - 3 * u, u, res.massAfter, dark);
      // heat-safe tray on the bench (the ash stays on it, under the dome, until the second weighing)
      const tg = ctx.createLinearGradient(0, G.trayTop, 0, G.floor); tg.addColorStop(0, metalLight); tg.addColorStop(1, metal);
      ctx.fillStyle = tg; ctx.strokeStyle = dark ? '#51605a' : '#4a5551'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(G.fx - 50 * u, G.trayTop); ctx.lineTo(G.fx - 44 * u, G.floor - 1); ctx.lineTo(G.fx + 44 * u, G.floor - 1); ctx.lineTo(G.fx + 50 * u, G.trayTop); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = dark ? '#7f8c87' : '#8e9a95'; ctx.beginPath(); ctx.ellipse(G.fx, G.trayTop, 50 * u, 4 * u, 0, 0, 6.28); ctx.fill(); ctx.stroke();
      if (v.phase === 'finished' && !lifted) drawAsh(ctx, G.fx, G.trayTop - 1 * u, u, res.massAfter, dark);
      // Petri dish of BTB beside the fuel, lid off, shallow liquid exposed to the air under the dome
      const liq = L.btbColor(sim.btb), dr = 26 * u, dTop = G.floor - 14 * u;
      ctx.fillStyle = dark ? 'rgba(200,225,235,.16)' : 'rgba(200,230,240,.35)'; ctx.strokeStyle = dark ? 'rgba(220,235,240,.85)' : 'rgba(80,110,120,.9)'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.ellipse(G.dishX, G.floor - 3 * u, dr, 5.5 * u, 0, 0, 6.28); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(G.dishX - dr, dTop); ctx.lineTo(G.dishX - dr, G.floor - 3 * u); ctx.moveTo(G.dishX + dr, dTop); ctx.lineTo(G.dishX + dr, G.floor - 3 * u); ctx.stroke();
      const lg = ctx.createRadialGradient(G.dishX - 6 * u, G.dishLiqY - 1, 1, G.dishX, G.dishLiqY, dr);
      lg.addColorStop(0, rgb(mix(liq, [255, 255, 255], 0.28))); lg.addColorStop(1, rgb(mix(liq, [0, 0, 0], 0.2)));
      ctx.fillStyle = lg; ctx.beginPath(); ctx.ellipse(G.dishX, G.dishLiqY, dr - 3 * u, 4.4 * u, 0, 0, 6.28); ctx.fill();
      ctx.fillStyle = dark ? 'rgba(200,225,235,.1)' : 'rgba(200,230,240,.22)'; ctx.beginPath(); ctx.moveTo(G.dishX - dr, dTop); ctx.lineTo(G.dishX + dr, dTop); ctx.lineTo(G.dishX + dr, G.floor - 3 * u); ctx.lineTo(G.dishX - dr, G.floor - 3 * u); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = dark ? 'rgba(220,235,240,.85)' : 'rgba(80,110,120,.9)'; ctx.beginPath(); ctx.ellipse(G.dishX, dTop, dr, 5.5 * u, 0, 0, 6.28); ctx.stroke();
      // the fuel on the tray, the lighter while it is being lit, flame, glow and smoke (all inside the dome)
      const running = v.phase === 'running', sx = G.fx, sy = G.sy, b0 = sim.burnedFraction;
      if (running && sim.igniter) { // a long lighter reaches in under the dome and lights the fuel
        ctx.strokeStyle = dark ? '#c3ccc8' : '#2b2f33'; ctx.lineWidth = 5 * u; ctx.beginPath(); ctx.moveTo(sx + 22 * u, G.trayTop - 8 * u); ctx.lineTo(cx + a + 26 * u, G.floor - 62 * u); ctx.stroke();
        drawIgniter(ctx, sx + 20 * u, G.trayTop - 6 * u, u, tm);
      }
      if (running || (v.phase === 'ready' && v.read)) drawSample(ctx, sx, sy, 0.72 * u * mf * (1 + 0.15 * (1 - b0)), fuel, running ? b0 : 0, running ? sim.glow : 0, dark);   // weighed: under the dome on the tray; not yet weighed: on the balance; finished: only ash
      ctx.save(); domePath(a - 5 * u, b - 5 * u); ctx.clip();
      const underDome = !lifted;
      if (underDome && sim.haze > 0.01) { const hg = ctx.createLinearGradient(0, G.top, 0, rimY - 0.3 * b); hg.addColorStop(0, (dark ? 'rgba(205,210,208,' : 'rgba(86,90,88,') + (0.52 * sim.haze).toFixed(3) + ')'); hg.addColorStop(1, (dark ? 'rgba(205,210,208,' : 'rgba(86,90,88,') + '0)'); ctx.fillStyle = hg; ctx.fillRect(cx - a, G.top, 2 * a, b); }
      if (running && sim.flame > 0.02) {
        const ceil = rimY - (b - 5 * u) * Math.sqrt(Math.max(0, 1 - Math.pow((sx - cx) / (a - 5 * u), 2))), room = Math.max(10 * u, sy + 6 * u - ceil - 6 * u);
        const fw = (20 + 16 * sim.flame) * u, fh = Math.min((14 + 62 * sim.flame) * u, room);
        ['grass', 'leaves'].includes(fuel) && sim.flame > 0.4 ? [-9, 0, 9].forEach((o, i) => drawFlame(ctx, sx + o * u, sy + 6 * u, fw * (i === 1 ? 1 : 0.7), fh * (i === 1 ? 1 : 0.72), tm, i * 1.7)) : drawFlame(ctx, sx, sy + 6 * u, fw, fh, tm, 0.5);
      }
      const puffs = running || v.phase === 'finished' && !lifted ? Math.round(sim.smoke * 14) : 0;
      for (let i = 0; i < puffs; i++) {
        const ph = animate ? (tm * (0.1 + (i % 4) * 0.012) + i / puffs) % 1 : (i + 0.5) / Math.max(1, puffs), top0 = sy - 14 * u, ceil = G.top + 18 * u;
        const px = sx + 6 * u + ph * (cx - sx + 10 * u) + Math.sin(ph * 6 + i) * 8 * u, py = top0 - ph * (top0 - ceil), pr = (5 + ph * 12) * u, al = (1 - ph * 0.6) * 0.3 * clamp(sim.smoke + 0.2, 0, 1);
        ctx.fillStyle = dark ? 'rgba(205,210,208,' + al.toFixed(3) + ')' : 'rgba(78,82,80,' + al.toFixed(3) + ')'; ctx.beginPath(); ctx.arc(px, py, pr, 0, 6.28); ctx.fill();
      }
      // carbon dioxide collecting under the dome: small open circles, more as more gas is made (drawn from the model, subtle); it escapes when the dome is lifted
      let gasAnchor = null; const gn = underDome ? Math.round(sim.gas * 40) : 0, gr = L.makeRng(L.hash32('gas'));
      for (let i = 0; i < 40; i++) {
        const gx = cx + (gr.uniform() * 2 - 1) * (a - 14 * u) * 0.9, k = gr.uniform(), edge = Math.sqrt(Math.max(0, 1 - Math.pow((gx - cx) / (a - 8 * u), 2))), ytop = rimY - (b - 8 * u) * edge + 8 * u, gy0 = ytop + k * k * (rimY - 30 * u - ytop) * 0.75, ph = gr.uniform() * 6.28;
        if (i >= gn) continue;
        const gx2 = gx + (animate ? Math.sin(tm * 0.8 + ph) * 2.5 * u : 0), gy = gy0 + (animate ? Math.cos(tm * 0.6 + ph) * 2 * u : 0);
        ctx.strokeStyle = dark ? 'rgba(210,225,220,.7)' : 'rgba(60,80,75,.65)'; ctx.fillStyle = dark ? 'rgba(210,225,220,.12)' : 'rgba(60,80,75,.1)'; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.arc(gx2, gy, 2.7 * u, 0, 6.28); ctx.fill(); ctx.stroke();
        if (!gasAnchor || gy < gasAnchor.y) gasAnchor = { x: gx2, y: gy };
      }
      ctx.restore();
      // the half-sphere glass bowl, upside down: thickness, a thick rim band, tint, highlights that follow the sphere (a little higher once it is lifted)
      ctx.save(); ctx.translate(0, -lift);
      const gg = ctx.createRadialGradient(cx - a * 0.35, rimY - b * 0.6, 4, cx, rimY - b * 0.3, a * 1.2); gg.addColorStop(0, dark ? 'rgba(200,225,235,.16)' : 'rgba(200,230,240,.34)'); gg.addColorStop(1, dark ? 'rgba(200,225,235,.05)' : 'rgba(200,230,240,.12)');
      ctx.fillStyle = gg; domePath(a, b); ctx.fill();
      ctx.strokeStyle = dark ? 'rgba(220,235,240,.88)' : 'rgba(80,110,120,.9)'; ctx.lineWidth = 2.6; domePath(a, b); ctx.stroke();
      ctx.strokeStyle = dark ? 'rgba(220,235,240,.45)' : 'rgba(80,110,120,.5)'; ctx.lineWidth = 1.2; domePath(a - 6 * u, b - 6 * u); ctx.stroke();
      ctx.fillStyle = dark ? 'rgba(200,225,235,.32)' : 'rgba(180,215,228,.6)'; ctx.fillRect(cx - a - 3 * u, rimY - 4.5 * u, 2 * a + 6 * u, 9 * u); ctx.strokeStyle = dark ? 'rgba(220,235,240,.88)' : 'rgba(80,110,120,.9)'; ctx.lineWidth = 1.4; ctx.strokeRect(cx - a - 3 * u, rimY - 4.5 * u, 2 * a + 6 * u, 9 * u);
      ctx.strokeStyle = dark ? 'rgba(255,255,255,.6)' : 'rgba(255,255,255,.95)'; ctx.lineWidth = 4 * u; ctx.beginPath(); ctx.ellipse(cx, rimY, a - 11 * u, b - 11 * u, 0, Math.PI + 0.3, Math.PI + 1.15); ctx.stroke();
      ctx.strokeStyle = dark ? 'rgba(255,255,255,.35)' : 'rgba(255,255,255,.7)'; ctx.lineWidth = 2.4 * u; ctx.beginPath(); ctx.ellipse(cx, rimY, a - 11 * u, b - 11 * u, 0, 2 * Math.PI - 0.55, 2 * Math.PI - 0.3); ctx.stroke();
      // condensation on the INSIDE of the curved glass: droplets sit just inside the inner surface, as many as the water the burn made (hydrogen in the fuel)
      let dropAnchor = null; const dn = Math.round(sim.drops * 44), dg = L.makeRng(L.hash32('drops'));
      for (let i = 0; i < 44; i++) {
        const t = Math.PI + 0.1 + dg.uniform() * (Math.PI - 0.2), inset = (3 + dg.uniform() * 8) * u, rad = (1.2 + dg.uniform() * 1.7) * u, xx = cx + (a - 6 * u - inset) * Math.cos(t), yy = rimY + (b - 6 * u - inset) * Math.sin(t);
        if (i >= dn) continue;
        ctx.fillStyle = dark ? 'rgba(210,235,255,.5)' : 'rgba(235,248,255,.7)'; ctx.strokeStyle = dark ? 'rgba(240,250,255,.9)' : 'rgba(40,90,120,.75)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(xx, yy, rad, 0, 6.28); ctx.fill(); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.beginPath(); ctx.arc(xx - rad * 0.3, yy - rad * 0.3, rad * 0.32, 0, 6.28); ctx.fill();
        if (xx > cx && (!dropAnchor || xx > dropAnchor.x)) dropAnchor = { x: xx, y: yy - lift };
      }
      ctx.restore();
      // laser (infrared) thermometer: used ONLY at the two weighings. Then it is a handheld gun with a thin laser line and a red dot on the fuel (before) or the ash (after);
      // otherwise it is put down on the bench with its display off.
      if (gunOn) {
        ctx.strokeStyle = 'rgba(255,40,40,.9)'; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(LP.M.x, LP.M.y); ctx.lineTo(LP.T.x, LP.T.y); ctx.stroke();
        drawGun(ctx, LP.M.x, LP.M.y, LP.ang, gunTemp + '°', u, dark, css);
        ctx.fillStyle = 'rgba(255,60,50,.35)'; ctx.beginPath(); ctx.arc(LP.T.x, LP.T.y, 6 * u, 0, 6.28); ctx.fill(); ctx.fillStyle = '#ff3b30'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(LP.T.x, LP.T.y, 2.8 * u, 0, 6.28); ctx.fill(); ctx.stroke();
            canvas.dataset.laser = JSON.stringify({ x: Math.round(LP.T.x * 10) / 10, y: Math.round(LP.T.y * 10) / 10, area: { x: Math.round(LP.area.x * 10) / 10, y: Math.round(LP.area.y * 10) / 10, r: Math.round(LP.area.r * 10) / 10 }, target: lifted ? 'ash' : 'fuel' });
      } else { drawGun(ctx, restM.x, restM.y, 0, '', u, dark, css); canvas.dataset.laser = ''; }
      // labels with leader lines that end in dots on the drawn structures (two rows above the dome on narrow canvases; beside the parts on wider ones)
      const o = { W, H }, wide = W >= 560, laneW = Math.max(80, Math.min(170, W / 2 - 10));
      const bal = v.phase === 'ready' ? [v.read ? 'weighed ' + res.massBefore.toFixed(1) + ' g' : 'not weighed yet'] : running ? ['empty while it burns'] : [lifted ? res.massAfter.toFixed(1) + ' g' : 'weigh after the burn'];
      labelBox(ctx, ['Balance' + (v.phase === 'ready' ? ': ' + res.label.toLowerCase() : '')].concat(bal), G.bcx, G.panY - 62 * u, { x: G.bcx - bw * 0.2, y: G.panY - 1 }, Object.assign({ align: 'center', maxW: bw + 20 }, o));
      const fuelTxt = ['Fuel on a tray', res.label + ' · ' + sim.massTrue.toFixed(1) + ' g left'];
      const gunTxt = ['Laser thermometer', v.phase === 'ready' ? (v.read ? gunTemp + ' °C on the fuel (before)' : 'not used yet') : running ? 'put down while it burns' : (lifted ? gunTemp + ' °C on the ash (after)' : 'waits for the 2nd weighing')];
      const domePtL = { x: G.domePt.x, y: G.domePt.y - lift };
      if (!wide) {
        labelBox(ctx, gunTxt, 4, 4, gunBodyC, Object.assign({ align: 'left', maxW: laneW }, o));
        labelBox(ctx, ['Glass dome', 'holds in the gas'], W - 4, 4, domePtL, Object.assign({ align: 'right', maxW: laneW }, o));
        labelBox(ctx, ['BTB in a dish', L.btbText(sim.btb)], W - 4, 42, { x: G.dishX, y: G.dishLiqY }, Object.assign({ align: 'right', maxW: laneW }, o));
        if (running) labelBox(ctx, fuelTxt, 4, 42, { x: sx, y: sy - 6 * u }, Object.assign({ align: 'left', maxW: laneW }, o));
      } else {
        const rx = cx + a + 14 * u, rw = Math.max(90, G.bx0 - rx - 4 * u), y0 = G.floor - 214;
        labelBox(ctx, gunTxt, gunBodyC.x - 20 * u, gunOn ? gunBodyC.y - 58 * u : G.floor - 96 * u, gunBodyC, Object.assign({ align: 'center', maxW: 190 }, o));
        if (running) labelBox(ctx, fuelTxt, cx - a - 14 * u, G.floor - 150 * u, { x: sx, y: sy - 6 * u }, Object.assign({ align: 'right', maxW: 180 }, o));
        labelBox(ctx, ['Glass dome', 'holds in the gas'], rx, y0, domePtL, Object.assign({ align: 'left', maxW: rw }, o));
        if (dropAnchor && dn >= 8) labelBox(ctx, ['Droplets of water', 'inside the dome'], rx, y0 + 42, dropAnchor, Object.assign({ align: 'left', maxW: rw }, o));
        if (gasAnchor && gn >= 6) labelBox(ctx, ['Carbon dioxide', 'collects under the dome'], rx, y0 + 84, gasAnchor, Object.assign({ align: 'left', maxW: rw }, o));
        labelBox(ctx, ['BTB in a dish', L.btbText(sim.btb)], rx, y0 + 126, { x: G.dishX, y: G.dishLiqY }, Object.assign({ align: 'left', maxW: rw }, o));
        if (running) {
          const txt = sim.igniter ? 'Lighter flame' : sim.flame >= 0.5 ? 'Flame' : sim.smoke >= 0.5 ? 'Smoke from smoldering' : sim.glow >= 0.3 ? 'Glowing ember' : 'Small flame';
          const anc = sim.igniter ? { x: sx + 20 * u, y: G.trayTop - 6 * u - 30 * u } : sim.flame >= 0.5 ? { x: sx, y: sy + 6 * u - Math.min((14 + 62 * sim.flame) * u, 60 * u) } : sim.smoke >= 0.5 ? { x: sx + 30 * u, y: sy - 14 * u - 0.4 * (sy - G.top) } : { x: sx + 10 * u, y: sy + 4 * u };
          labelBox(ctx, [txt], rx, y0 + 168, anc, Object.assign({ align: 'left', maxW: rw }, o));
        }
      }
      // bench caption
      ctx.fillStyle = muted; ctx.font = '600 11px ' + css('--f-mono', 'monospace'); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ctx.fillText('SIMULATED · ' + stageText(v) + (running ? ' · ' + secs(v.t) : ''), 10, H - 12);
      if (W > 560) { ctx.textAlign = 'right'; ctx.fillText(L.instrumentCaption(res, v.phase, v.read), W - 10, H - 12); }
      canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', canvasLabel(v));
    }
    function canvasLabel(v) {
      v = v || view(); const r = v.res, s = v.sim, name = r.label.toLowerCase(), lifted = v.phase === 'finished' && v.read;
      const flame = s.flame > 0.02 ? (s.flame >= 0.7 ? 'a bright flame' : 'a small flame') : 'no flame', smoke = s.smoke >= 0.5 ? ' lots of smoke,' : s.smoke >= 0.15 ? ' a little smoke,' : '', ember = s.glow >= 0.3 ? ' a glowing ember,' : '';
      const bowl = 'A half-sphere glass bowl, upside down (the dome), ';
      const tail = ' The BTB in the dish inside the dome is ' + L.btbText(s.btb) + '.' + (s.drops >= 0.2 ? ' Droplets of water have formed on the inside of the dome.' : '') + (s.gas >= 0.2 && !lifted ? ' Carbon dioxide is collecting under the dome.' : '');
      if (v.phase === 'ready') return 'Simulated burn demonstration. ' + bowl + 'stands over ' + (v.read ? 'a tray with the fuel on it and' : 'an empty tray with') + ' a dish of BTB inside it. Ready to burn ' + name + '. The ' + r.massStart + ' g handful ' +
        (v.read ? 'was weighed (the balance read ' + r.massBefore.toFixed(1) + ' grams) and now sits on the tray under the dome. The laser thermometer aimed at the fuel, through the dome glass, reads ' + r.tempBefore + ' degrees Celsius (before the burn).' : 'is on the balance, not weighed yet, and the laser thermometer rests on the bench.') + tail;
      if (v.phase === 'running') return 'Simulated burn demonstration. ' + bowl + 'over burning ' + name + ', sample ' + r.n + ', with a dish of BTB inside the dome: ' + stageText(v).toLowerCase() + ', ' + secs(v.t) + ' in. It shows ' + flame + ',' + smoke + ember +
        ' and the sample under the dome is down to ' + s.massTrue.toFixed(1) + ' grams. The laser thermometer is put down on the bench and the balance shows no reading while it burns.' + tail;
      return 'Simulated burn demonstration. ' + bowl + (lifted ? 'lifted off the cooled ' : 'still over the ash of ') + name + ', sample ' + r.n + ', with a dish of BTB inside the dome. ' +
        (lifted ? 'The ash is on the balance, which reads ' + r.massAfter.toFixed(1) + ' grams, and the laser thermometer aimed at the ash reads ' + r.tempAfter + ' degrees Celsius (after the burn).' : 'Only ash is left, still under the dome. The laser thermometer rests on the bench until you weigh again.') + tail;
    }
    function updateDesc() {
      const v = view(), key = v.phase + ':' + v.res.fuel + ':' + Math.floor(v.t / 3) + ':' + (st ? st.records.length : 0) + ':' + v.read;
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
      // The elapsed phase is derived from the saved start time; do not re-save unchanged state.
      if (v.phase === 'finished') { stopTick(); const active = host.contains(doc.activeElement); api.announce('The fuel is out. Lift the dome and weigh the ash before recording.'); render(active ? '[data-bn="after"]' : null); }
    }
    const redraw = () => { draw(); };
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(redraw).observe(canvas.parentElement || host);
    win.addEventListener('resize', redraw, { passive: true });
    doc.addEventListener('companion:show', redraw);
    new MutationObserver(redraw).observe(doc.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    if (win.matchMedia) { const mq = matchMedia('(prefers-color-scheme: dark)'); if (mq.addEventListener) mq.addEventListener('change', redraw); }
    win.addEventListener('pagehide', stopTick);
    // An older save may have both readings but still be waiting for the removed Record button.
    if (st?.current?.after && view().phase === 'finished') finishReading();
    render();
  }
  (window.B2Scenes = window.B2Scenes || []).push({ id: 'burn', mount: mount });
})();
