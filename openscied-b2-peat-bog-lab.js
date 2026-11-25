/* Peat Bog Carbon Lab: companion for OpenSciEd Biology Unit B.2 (Fires). All the science is in openscied-b2-peat-bog-logic.js
   (SIMULATED, 0-100 teaching scale). This file draws the pictures and graphs, runs the controls, and saves the student's work.
   One saved record in localStorage, one live announcer (#announcer), a download and a "Clear this activity" dialog. Student work lives
   only in this browser.

   SAVED STATE (localStorage 'aplab:openscied:b2-peat-bog:v1'), format v1:
     { v:1,
       settings: { tilt, temp, co2, o2, wet, burn }        the six bog sliders (clamped to their ranges when read back)
       climate:  { fossil, forest, year }                   the global warming sliders
       explore:  'tilt'|'temp'|'co2'|'o2'|'wet'|'burn'      variable shown in "Test one variable"
       season:   0..3                                       season shown in "Zombie fires"
       motionPaused: bool                                   the student paused the moving shapes
       trials:   [ { id, label, tilt, temp, co2, o2, wet, burn, at } ]   INPUTS only; every output is recomputed from them
       trialLabel: string                                   the label box in My trials
       warmingUsed: bool                                    true once the student has used any Global warming control or "Test the bog in this year"
                                                            (the dashboard reads this; older saves without it fall back to "settings differ from today")
       responseIds: ['graph-answer'], fields: {...}           graph evidence response, kept so the dashboard reads every companion alike
       lastSection, lastVisitedAt }
   Nothing is written until the student changes something, so a fresh visit (or one right after "Clear this activity") leaves no record. */
(function () {
  'use strict';
  const L = window.B2PeatBogLogic;
  const KEY = 'aplab:openscied:b2-peat-bog:v1';
  const saveAPI = window.OpenSciEdSaveSession, saveScope = 'b2-peat-bog-lab';
  const saveSession = (() => { try { return saveAPI?.open(localStorage, saveScope, [KEY]); } catch (_) { return null; } })();
  const reportIdentity = saveAPI?.reportIdentity?.(saveSession, [KEY], studentIdentity) ?? (() => null);
  function readSave() { return saveSession ? saveSession.read(KEY) : localStorage.getItem(KEY); }
  function showSaveConflict(result) {
    const n = document.getElementById('save-conflict');
    const message = result?.reason === 'erased' ? 'Saved work was cleared in another tab. This tab cannot write it back.' :
      result?.reason === 'changed' ? 'A newer save from another tab was kept.' : 'This tab could not save on this device.';
    const copy = message + ' Download or copy this tab’s work before reloading.';
    if (n && (n.hidden || n.textContent !== copy)) { n.textContent = copy; n.hidden = false; announce(copy); }
    return copy;
  }
  function checkSaveConflict(event) {
    if (!saveSession) return;
    if (event.type === 'storage' && event.key && ![KEY, saveAPI.globalKey, saveAPI.scopeKey(saveScope), saveAPI.resetKey(KEY)].includes(event.key)) return;
    const result = saveSession.check(KEY);
    if (!result.ok) { showSaveConflict(result); renderStudent(); }
  }
  window.addEventListener('storage', checkSaveConflict);
  window.addEventListener('pageshow', checkSaveConflict);
  const SECTIONS = ['overview', 'bog', 'graph', 'zombie', 'warming', 'trials', 'model'];
  const NS = 'http://www.w3.org/2000/svg';
  const RAD = Math.PI / 180;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const byId = id => document.getElementById(id);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const motionQuery = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  const reduceMotion = () => !!(motionQuery && motionQuery.matches);

  const state = { S: Object.assign({}, L.DEFAULTS), climate: { fossil: 10, forest: 100, year: 2100 }, warmingUsed: false, climateTests: [], graphAnswer: '', explore: 'temp', season: 0, motionPaused: false, trials: [], trialLabel: '', lastSection: 'overview' };
  let cleared = false, hadSaved = false, ready = false, preservedSave = false, cur = null, rows = [], playTimer = null, nextId = 1;

  function svgEl(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function paint(e, prop, token) { e.style[prop] = 'var(' + token + ')'; return e; }
  function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function studentIdentity() { return window.Lab && Lab.identity && Lab.identity.get ? Lab.identity.get() : null; }

  /* ---------- the one live region ---------- */
  let announceTimer = null, quietTimer = null;
  function announce(text) { const e = byId('announcer'); if (!e) return; e.textContent = ''; clearTimeout(announceTimer); announceTimer = setTimeout(function () { e.textContent = text; }, 30); }
  // announceSoon waits while a slider is being dragged; announceNow (typed value, preset, reset, button) updates the region at once, so the
  // status text never lags one change behind. lastSpoken is the newest summary, kept so a short note can be said with it.
  let lastSpoken = '';
  function announceSoon(text) { lastSpoken = text; clearTimeout(quietTimer); clearTimeout(announceTimer); quietTimer = setTimeout(function () { announce(text); }, 700); }
  function announceNow(text) { lastSpoken = text; clearTimeout(quietTimer); announce(text); }
  function flash(text, withSummary) {
    $$('[data-rec-status]').forEach(function (s) { s.textContent = text; });
    clearTimeout(flash.t); flash.t = setTimeout(function () { $$('[data-rec-status]').forEach(function (s) { s.textContent = ''; }); }, 3500);
    announce(withSummary ? text + ' ' + lastSpoken : text);
  }

  /* ---------- saved state ---------- */
  function readStore() {
    try {
      const raw = readSave();
      if (raw === null) return;
      const d = JSON.parse(raw);
      if (!d || d.v !== 1) throw Error('Unknown saved format');
      hadSaved = true;
      if (d.settings) state.S = L.sanitize(d.settings);
      if (d.climate) state.climate = L.sanitizeClimate(d.climate);
      state.warmingUsed = d.warmingUsed === true;
      state.climateTests = (Array.isArray(d.climateTests) ? d.climateTests : [])
        .filter(x => x && Number.isFinite(x.year) && Number.isFinite(x.fossil) && Number.isFinite(x.forest))
        .slice(-30).map(L.sanitizeClimate);
      state.graphAnswer = typeof d.fields?.['graph-answer'] === 'string' ? d.fields['graph-answer'].slice(0, 4000) : '';
      if (L.VARS.some(function (v) { return v.key === d.explore; })) state.explore = d.explore;
      if (d.season === 0 || d.season === 1 || d.season === 2 || d.season === 3) state.season = d.season;
      state.motionPaused = d.motionPaused === true;
      state.trials = L.cleanTrials(d.trials);
      nextId = state.trials.reduce(function (m, t) { return Math.max(m, t.id); }, 0) + 1;
      if (typeof d.trialLabel === 'string') state.trialLabel = d.trialLabel.slice(0, 60);
      if (SECTIONS.includes(d.lastSection)) state.lastSection = d.lastSection;
    } catch (e) { preservedSave = true; }
  }
  function record() {
    return { v: 1, settings: state.S, climate: state.climate, warmingUsed: state.warmingUsed, explore: state.explore, season: state.season, motionPaused: state.motionPaused, trials: state.trials, trialLabel: state.trialLabel,
      responseIds: ['graph-answer'], fields: { 'graph-answer': state.graphAnswer }, climateTests: state.climateTests, lastSection: state.lastSection, lastVisitedAt: Date.now() };
  }
  function save() {
    if (cleared || !ready) return false;
    try {
      const section = location.hash.slice(1);
      if (SECTIONS.includes(section)) state.lastSection = section;
      if (preservedSave) return false;
      const result = saveSession?.write(KEY, JSON.stringify(record()));
      if (!result?.ok) {
        byId('save-status').textContent = showSaveConflict(result);
        return false;
      }
      hadSaved = true;
      byId('save-status').textContent = 'Saved on this device.';
      return true;
    } catch (e) { byId('save-status').textContent = showSaveConflict(); return false; }
  }

  /* ---------- controls: sliders with number boxes ---------- */
  const fmtVar = (v, x) => v.key === 'tilt' ? x.toFixed(2) + '°' : v.unit === '%' ? x + '%' : v.unit === '°C' ? x + ' °C' : x + ' ' + v.unit;
  const speakVar = (v, x) => v.key === 'tilt' ? x.toFixed(2) + ' degrees' : v.unit === '%' ? x + ' percent' : v.unit === '°C' ? x + ' degrees Celsius' : x + ' ' + v.unit;
  function paintRange(r) { r.style.setProperty('--pct', ((r.value - r.min) / (r.max - r.min) * 100) + '%'); }
  function decimals(step) { return (String(step).split('.')[1] || '').length; }
  // A slider and its number box edit the same value. The slider snaps to its own step; the number box can be more exact (tilt takes 0.01).
  // A typed value is clamped to the slider's range and rounded to its step. When that changes what the student typed, say so (visible note
  // in the control, and the live region) instead of changing the number silently.
  const clampNotes = new WeakMap();
  function noteFor(num) {
    const ctrl = num.closest('.ctrl');
    if (!ctrl) return null;
    let n = clampNotes.get(ctrl);
    if (!n) { n = el('span', 'hint clamp-note'); n.hidden = true; ctrl.appendChild(n); clampNotes.set(ctrl, n); }
    return n;
  }
  function showClampNote(num, text) {
    const n = noteFor(num); if (!n) return;
    n.textContent = text; n.hidden = !text;
    clearTimeout(n._t); if (text) n._t = setTimeout(function () { n.hidden = true; }, 6000);
  }
  function unitText(num) {
    const u = num.parentElement.querySelector('.numunit'), t = u ? u.textContent.trim() : '';
    return t === '%' || t === '% of today' || t === '°' ? t.charAt(0) : t ? ' ' + t : '';
  }
  function bindControl(range, num, set, numStep) {
    const st = numStep || +range.step, dec = decimals(st), mn = +range.min, mx = +range.max;
    num.dataset.dec = dec; num.min = mn; num.max = mx; num.step = st;
    let committed = null;
    range.addEventListener('input', function () { committed = null; set(+range.value); showClampNote(num, ''); });
    range.addEventListener('change', function () { if (lastSpoken) announceNow(lastSpoken); });
    num.addEventListener('input', function () {
      committed = null;
      // Preview and save complete in-range numbers immediately. Keep incomplete or
      // out-of-range edits intact until change/Enter, where the correction is announced.
      if (!num.value || !num.validity.valid) return;
      const value = Number(num.value);
      if (Number.isFinite(value) && value !== +num.dataset.value) set(value);
    });
    function commit() {
      const typed = parseFloat(String(num.value).replace(',', '.'));
      if (isNaN(typed)) { num.value = (+num.dataset.value).toFixed(dec); return; }
      const lim = clamp(typed, mn, mx);
      const v = clamp(+(Math.round((lim - mn) / st) * st + mn).toFixed(dec), mn, mx);
      const u = unitText(num), shown = v.toFixed(dec);
      let msg = '';
      if (typed > mx) msg = 'Set to ' + shown + u + ', the highest allowed.';
      else if (typed < mn) msg = 'Set to ' + shown + u + ', the lowest allowed.';
      else if (Math.abs(v - typed) > 1e-9) msg = 'Rounded to ' + shown + u + ' (this control moves in steps of ' + st + ').';
      // Enter can be followed by a native change/blur for the same edit. Do not
      // replace its live correction with a plain summary, or restart its note timer.
      if (!msg && committed === shown && +num.dataset.value === v) return;
      set(v, true); num.value = shown; committed = shown;
      showClampNote(num, msg);
      if (msg) announce(msg + ' ' + lastSpoken);
    }
    num.addEventListener('change', commit);
    num.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); commit(); num.select(); } });
  }
  function syncControl(range, num, value, valuetext) {
    if (+range.value !== value) range.value = value;
    paintRange(range);
    num.dataset.value = value;
    if (document.activeElement !== num) num.value = (+value).toFixed(+num.dataset.dec);
    range.setAttribute('aria-valuetext', valuetext);
  }

  const SLIDER_HINTS = {
    temp: 'Average Arctic summer air temperature before the tilt effect. About 10 °C today.',
    co2: 'Air today is about 420 ppm.',
    o2: 'Air today is about 21%. Fire needs more than about 12%.',
    wet: 'Water fills the air spaces in the peat. Higher water means less oxygen for decomposers and fire.',
    burn: 'Wildfire from lightning, or people cutting and burning peat for fuel.'
  };
  const SLIDER_INFO = {
    co2: ['What does ppm mean?', '<b>ppm</b> = parts per million. 420 ppm means 420 CO₂ molecules in every million molecules of air.'],
    burn: ['What does the Burning percent mean?', 'How much of the bog’s surface is on fire. Wet peat burns much less than dry peat, even at the same setting.']
  };
  function buildSliders() {
    const box = byId('sliders');
    L.VARS.filter(function (v) { return v.key !== 'tilt'; }).forEach(function (v) {
      const d = el('div', 'ctrl');
      const info = SLIDER_INFO[v.key] ? '<button class="info" type="button" aria-expanded="false" aria-controls="tip-' + v.key + '" aria-label="' + SLIDER_INFO[v.key][0] + '" title="' + SLIDER_INFO[v.key][0] + '"><span aria-hidden="true">i</span></button>' : '';
      d.innerHTML = '<div class="ctrl-top"><span class="lbl-row"><label for="s-' + v.key + '">' + v.label + '</label>' + info + '</span><span class="numwrap"><input type="number" class="num" id="n-' + v.key + '" inputmode="decimal" aria-label="Type a value for ' + v.label.toLowerCase() + ', in ' + (v.unit === '°C' ? 'degrees Celsius' : v.unit === '%' ? 'percent' : v.unit) + '"><span class="numunit" aria-hidden="true">' + v.unit + '</span></span></div>' +
        (SLIDER_INFO[v.key] ? '<span class="tip" id="tip-' + v.key + '" hidden>' + SLIDER_INFO[v.key][1] + '</span>' : '') +
        '<input type="range" id="s-' + v.key + '" min="' + v.min + '" max="' + v.max + '" step="' + v.step + '" value="' + state.S[v.key] + '">' +
        '<span class="hint">' + SLIDER_HINTS[v.key] + '</span>' +
        (v.key === 'wet' ? '<div class="o2read"><div class="ctrl-top"><b>Oxygen in the peat</b><span class="ov" id="o2Peat"></span></div><div class="bar" aria-hidden="true"><span id="o2PeatBar" class="fill-o2"></span></div><span class="hint" id="o2PeatTxt"></span></div>' : '');
      box.appendChild(d);
    });
    L.VARS.forEach(function (v) {
      bindControl(byId('s-' + v.key), byId('n-' + v.key), function (x, now) { state.S[v.key] = x; update(now); }, v.key === 'tilt' ? 0.01 : undefined);
    });
    // The same three sliders in Zombie fires.
    [['zWet', 'wet'], ['zBurn', 'burn'], ['zTemp', 'temp']].forEach(function (p) {
      bindControl(byId(p[0]), byId('n-' + p[0]), function (x, now) { state.S[p[1]] = x; update(now); });
    });
    const bogPresets = byId('presets');
    L.PRESETS.forEach(function (p) {
      const b = el('button', 'btn', p.name); b.type = 'button'; b.dataset.preset = p.name;
      b.addEventListener('click', function () { setState(p.values, true); flash('Loaded: ' + p.name + '.', true); });
      bogPresets.appendChild(b);
    });
    const rb = el('button', 'btn', 'Reset'); rb.type = 'button'; rb.dataset.preset = 'Reset';
    rb.addEventListener('click', function () { bogReset(); }); bogPresets.appendChild(rb);
    const tp = byId('tiltPresets');
    L.TILT_PRESETS.forEach(function (p) {
      const b = el('button', 'btn', p.name); b.type = 'button'; b.dataset.tilt = p.tilt;
      b.addEventListener('click', function () { setState({ tilt: p.tilt }, true); flash('Tilt set to ' + p.tilt + '°.', true); });
      tp.appendChild(b);
    });
  }
  function setState(vals, now) { state.S = L.sanitize(Object.assign({}, state.S, vals)); update(now); }
  function bogReset() { setState(L.DEFAULTS, true); flash('Back to starting values.', true); }
  function syncControls() {
    L.VARS.forEach(function (v) { syncControl(byId('s-' + v.key), byId('n-' + v.key), state.S[v.key], speakVar(v, state.S[v.key])); });
    [['zWet', 'wet'], ['zBurn', 'burn'], ['zTemp', 'temp']].forEach(function (p) {
      const v = L.VARS.find(function (x) { return x.key === p[1]; });
      syncControl(byId(p[0]), byId('n-' + p[0]), state.S[p[1]], speakVar(v, state.S[p[1]]));
    });
    const same = (a, b) => Math.abs(a - b) < 1e-6;
    $$('#presets .btn').forEach(function (b) {
      const p = L.PRESETS.find(function (x) { return x.name === b.dataset.preset; });
      b.setAttribute('aria-pressed', String(!!p && L.same(state.S, p.values)));
    });
    $$('#tiltPresets .btn').forEach(function (b) { b.setAttribute('aria-pressed', String(same(state.S.tilt, +b.dataset.tilt))); });
  }

  /* ---------- Earth's tilt diagram ---------- */
  function drawEarth() {
    const svg = byId('earth'); svg.replaceChildren();
    const cx = 190, cy = 88, r = 62, t = state.S.tilt;
    for (let i = 0; i < 5; i++) {
      const y = cy - 48 + i * 24;
      const ln = svgEl('line', { x1: 8, y1: y, x2: cx - Math.sqrt(Math.max(0, r * r - (y - cy) * (y - cy))) - 2, y2: y, 'stroke-width': 2 }, svg);
      paint(ln, 'stroke', '--b2-light'); ln.style.strokeOpacity = '0.8';
    }
    svgEl('text', { x: 8, y: 16, class: 'lbl-sm' }, svg).textContent = 'Sunlight';
    const disk = svgEl('circle', { cx, cy, r }, svg); paint(disk, 'fill', '--b2-water'); disk.style.fillOpacity = '0.35';
    const night = svgEl('path', { d: 'M ' + cx + ' ' + (cy - r) + ' A ' + r + ' ' + r + ' 0 0 1 ' + cx + ' ' + (cy + r) + ' Z' }, svg);
    paint(night, 'fill', '--ink'); night.style.fillOpacity = '0.28';
    const g = svgEl('g', { transform: 'rotate(' + (-t) + ' ' + cx + ' ' + cy + ')' }, svg);
    paint(svgEl('line', { x1: cx, y1: cy - r - 18, x2: cx, y2: cy + r + 18, 'stroke-width': 2 }, g), 'stroke', '--ink');
    paint(svgEl('line', { x1: cx - r, y1: cy, x2: cx + r, y2: cy, 'stroke-width': 1.2, 'stroke-dasharray': '3 3' }, g), 'stroke', '--ink');
    const ac = 90 - t, yac = cy - r * Math.sin(ac * RAD), wac = r * Math.cos(ac * RAD);
    paint(svgEl('line', { x1: cx - wac, y1: yac, x2: cx + wac, y2: yac, 'stroke-width': 1.5, 'stroke-dasharray': '4 3' }, g), 'stroke', '--b2-o2');
    const y65 = cy - r * Math.sin(L.LAT * RAD), w65 = r * Math.cos(L.LAT * RAD);
    paint(svgEl('line', { x1: cx - w65, y1: y65, x2: cx + w65, y2: y65, 'stroke-width': 2.5 }, g), 'stroke', '--b2-peat');
    paint(svgEl('circle', { cx: cx - w65, cy: y65, r: 4.5 }, g), 'fill', '--b2-burn');
    paint(svgEl('line', { x1: cx, y1: cy - r - 18, x2: cx, y2: cy - r + 4, 'stroke-width': 1, 'stroke-dasharray': '2 3' }, svg), 'stroke', '--muted');
    svgEl('text', { x: cx + 8, y: cy - r - 6, class: 'lbl-sm' }, svg).textContent = t.toFixed(2) + '° tilt';
    svgEl('text', { x: 262, y: cy + 4, class: 'lbl-sm' }, svg).textContent = 'night';
    svgEl('text', { x: 8, y: 162, class: 'lbl-sm' }, svg).textContent = '● 65°N peatlands  - - Arctic Circle';
    svg.setAttribute('aria-label', 'Earth tilted ' + t.toFixed(2) + ' degrees toward the sun on the longest day of summer. The Arctic Circle is a dashed line at ' + L.arcticCircle(t).toFixed(1) + ' degrees north and the bog latitude, 65 degrees north, is marked with a dot.');
  }

  /* ---------- bog picture ---------- */
  const SURF = 150, BASE = 352;
  const LY = {};   // named layers of the bog svg
  // One shape per material (and its color), so the moving shapes are told apart without color: circle CO2, diamond O2, drop water, square dead plants, star sunlight, triangle heat.
  const SHAPES = {
    co2: 'M-4.5 0a4.5 4.5 0 1 0 9 0a4.5 4.5 0 1 0 -9 0Z',
    o2: 'M0 -6.2L6.2 0L0 6.2L-6.2 0Z',
    water: 'M0 -6.4C3 -2.2 5 0 5 2.6A5 5 0 0 1 -5 2.6C-5 0 -3 -2.2 0 -6.4Z',
    sugar: 'M-4.6 -4.6h9.2v9.2h-9.2Z',
    light: 'M0 -6.5L1.8 -2.2L6.4 -2L2.8 1L4 5.6L0 3L-4 5.6L-2.8 1L-6.4 -2L-1.8 -2.2Z',
    heat: 'M0 -6.3L6.3 5.3H-6.3Z'
  };
  const FLOWS = [
    { id: 'light', kind: 'light', color: '--b2-light', src: m => 80 * m.relQ },
    { id: 'co2in', kind: 'co2', color: '--b2-co2', d: 'M 80 26 L 80 128', src: m => m.P, label: ['CO₂ in', 80, 18] },
    { id: 'o2out', kind: 'o2', color: '--b2-o2', d: 'M 130 128 L 130 26', src: m => m.P, label: ['O₂ out', 130, 18] },
    { id: 'water', kind: 'water', color: '--b2-water', d: 'M 40 300 L 40 160', src: m => m.P, label: ['Water', 48, 182, 'start'] },
    { id: 'store', kind: 'sugar', color: '--b2-sugar', d: 'M 300 156 L 300 300', src: m => m.P, label: ['Dead plants pile up as peat', 308, 296, 'start'] },
    { id: 'o2dec', kind: 'o2', color: '--b2-o2', d: 'M 420 26 L 420 168', src: m => m.D, label: ['O₂ in', 420, 18] },
    { id: 'co2dec', kind: 'co2', color: '--b2-co2', d: 'M 490 168 L 490 26', src: m => m.D, label: ['CO₂ out', 490, 18] },
    { id: 'o2burn', kind: 'o2', color: '--b2-o2', d: 'M 590 26 L 590 100', src: m => m.B, label: ['O₂', 590, 18] },
    { id: 'co2burn', kind: 'co2', color: '--b2-co2', d: 'M 640 100 L 640 26', src: m => m.B, label: ['CO₂ + water', 646, 18] },
    { id: 'heat', kind: 'heat', color: '--b2-burn', d: 'M 660 112 L 694 70', src: m => m.B }
  ];
  function buildBog() {
    const bog = byId('bog-svg'); bog.replaceChildren();
    const defs = svgEl('defs', {}, bog);
    const pat = svgEl('pattern', { id: 'icehatch-b', width: 8, height: 8, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, defs);
    paint(svgEl('rect', { width: 8, height: 8 }, pat), 'fill', '--b2-ice');
    const hl = svgEl('line', { x1: 0, y1: 0, x2: 0, y2: 8, 'stroke-width': 3 }, pat); paint(hl, 'stroke', '--b2-o2'); hl.style.strokeOpacity = '0.5';
    paint(svgEl('rect', { x: 0, y: 0, width: 700, height: SURF }, bog), 'fill', '--b2-sky');
    paint(svgEl('rect', { x: 0, y: SURF, width: 700, height: BASE - SURF }, bog), 'fill', '--b2-peat');
    for (let i = 0; i < 5; i++) {
      const y = SURF + 26 + i * 38;
      const band = svgEl('path', { d: 'M 0 ' + y + ' Q 175 ' + (y - 6) + ' 350 ' + y + ' T 700 ' + y + ' L 700 ' + (y + 19) + ' Q 525 ' + (y + 25) + ' 350 ' + (y + 19) + ' T 0 ' + (y + 19) + ' Z' }, bog);
      paint(band, 'fill', '--b2-peat2'); band.style.fillOpacity = '0.7';
    }
    paint(svgEl('rect', { x: 0, y: BASE, width: 700, height: 400 - BASE }, bog), 'fill', '--b2-sunk');
    svgEl('text', { x: 10, y: 392, class: 'lbl-sm' }, bog).textContent = 'sand and rock under the bog';
    LY.water = svgEl('rect', { x: 0, width: 700, class: 'b2-water' }, bog); paint(LY.water, 'fill', '--b2-water'); LY.water.style.fillOpacity = '0.22';
    LY.wline = svgEl('line', { x1: 0, x2: 700, 'stroke-width': 2, 'stroke-dasharray': '8 5' }, bog); paint(LY.wline, 'stroke', '--b2-water');
    LY.wlbl = svgEl('text', { x: 694, 'text-anchor': 'end', class: 'lbl-sm on-peat' }, bog);
    LY.pores = [];
    let ps = 11; const pr = function () { return (ps = (ps * 9301 + 49297) % 233280) / 233280; };
    for (let i = 0; i < 70; i++) {
      const c = svgEl('path', { d: SHAPES.o2, transform: 'translate(' + (pr() * 690 + 5).toFixed(1) + ' ' + (SURF + 8 + pr() * (BASE - SURF - 14)).toFixed(1) + ') scale(.5)' }, bog);
      paint(c, 'fill', '--b2-o2'); c.dataset.y = c.getAttribute('transform').match(/ ([\d.]+)\)/)[1]; LY.pores.push(c);
    }
    LY.embers = [];
    for (let i = 0; i < 30; i++) {
      const c = svgEl('path', { d: SHAPES.heat, transform: 'translate(' + (560 + pr() * 130).toFixed(1) + ' 0) scale(.5)' }, bog);
      paint(c, 'fill', '--b2-burn'); c.dataset.d = pr().toFixed(3); c.dataset.x = c.getAttribute('transform').match(/translate\(([\d.]+)/)[1]; LY.embers.push(c);
    }
    LY.airLbl = svgEl('text', { x: 100, class: 'lbl on-peat' }, bog);
    LY.wetLbl = svgEl('text', { x: 100, class: 'lbl on-peat' }, bog);
    LY.perm = svgEl('rect', { x: 0, width: 700, fill: 'url(#icehatch-b)' }, bog);
    // Give the changing water line and the ice edge separate label lanes.
    LY.iceTick = svgEl('line', { x1: 697, x2: 697, y2: 379, 'stroke-width': 1.5 }, bog);
    paint(LY.iceTick, 'stroke', '--b2-o2-t');
    LY.iceAnchor = svgEl('circle', { cx: 697, r: 2 }, bog); paint(LY.iceAnchor, 'fill', '--b2-o2-t');
    LY.plbl = svgEl('text', { x: 694, y: 392, 'text-anchor': 'end', class: 'lbl-b' }, bog); paint(LY.plbl, 'fill', '--b2-o2-t');
    svgEl('text', { x: 312, y: 182, class: 'lbl-sm on-peat' }, bog).textContent = 'young peat (recent dead plants)';
    svgEl('text', { x: 312, y: 338, class: 'lbl-sm on-peat' }, bog).textContent = 'old peat: 1000s of years old';
    let seed = 3; const rnd = function () { return (seed = (seed * 9301 + 49297) % 233280) / 233280; };
    LY.microbes = svgEl('g', {}, bog);
    for (let i = 0; i < 26; i++) {
      const m = svgEl('ellipse', { cx: (390 + rnd() * 140).toFixed(1), cy: (172 + rnd() * 160).toFixed(1), rx: 3.4, ry: 2 }, LY.microbes);
      paint(m, 'fill', '--b2-light');
    }
    LY.microbeEls = Array.from(LY.microbes.children);
    svgEl('text', { x: 455, y: 202, 'text-anchor': 'middle', class: 'lbl on-peat' }, bog).textContent = 'Decomposers';
    svgEl('text', { x: 455, y: 219, 'text-anchor': 'middle', class: 'lbl-sm on-peat' }, bog).textContent = 'bacteria and fungi';
    LY.plants = svgEl('g', {}, bog);
    for (let x = 12; x < 560; x += 15) {
      const h = 10 + ((x * 7) % 11);
      paint(svgEl('ellipse', { cx: x, cy: SURF - 2, rx: 9, ry: 5 }, LY.plants), 'fill', '--b2-photo');
      if ((x / 15) % 2 < 1) {
        const sedge = svgEl('path', { d: 'M ' + x + ' ' + (SURF - 4) + ' q -3 ' + (-h / 2) + ' -6 ' + (-h) + ' M ' + x + ' ' + (SURF - 4) + ' q 1 ' + (-h / 2) + ' 2 ' + (-h - 4) + ' M ' + x + ' ' + (SURF - 4) + ' q 4 ' + (-h / 2) + ' 8 ' + (-h + 2), fill: 'none', 'stroke-width': 1.6 }, LY.plants);
        paint(sedge, 'stroke', '--b2-photo');
      }
    }
    svgEl('text', { x: 100, y: SURF + 18, class: 'lbl on-peat' }, bog).textContent = 'Sphagnum moss and sedges';
    LY.beam = svgEl('line', { 'stroke-width': 26, 'stroke-linecap': 'round' }, bog); paint(LY.beam, 'stroke', '--b2-light');
    LY.sun = svgEl('circle', { r: 17 }, bog); paint(LY.sun, 'fill', '--b2-light');
    LY.sunlbl = svgEl('text', { class: 'lbl-sm' }, bog);
    LY.fire = svgEl('g', {}, bog);
    [[-22, 0.8], [-8, 1.1], [6, 0.9], [20, 0.7]].forEach(function (p) {
      const dx = p[0], s = p[1];
      paint(svgEl('path', { d: 'M ' + (dx - 9 * s) + ' 0 Q ' + (dx - 10 * s) + ' ' + (-22 * s) + ' ' + dx + ' ' + (-40 * s) + ' Q ' + (dx + 10 * s) + ' ' + (-22 * s) + ' ' + (dx + 9 * s) + ' 0 Z' }, LY.fire), 'fill', '--b2-burn');
      paint(svgEl('path', { d: 'M ' + (dx - 4 * s) + ' 0 Q ' + (dx - 5 * s) + ' ' + (-12 * s) + ' ' + dx + ' ' + (-22 * s) + ' Q ' + (dx + 5 * s) + ' ' + (-12 * s) + ' ' + (dx + 4 * s) + ' 0 Z' }, LY.fire), 'fill', '--b2-light');
    });
    LY.firelbl = svgEl('text', { x: 625, y: SURF + 18, 'text-anchor': 'middle', class: 'lbl on-peat' }, bog); LY.firelbl.textContent = 'Burning peat';
    const flowLayer = svgEl('g', {}, bog), dotLayer = svgEl('g', {}, bog), lblLayer = svgEl('g', {}, bog);
    FLOWS.forEach(function (f) {
      f.el = svgEl('path', { d: f.d || 'M 0 0', fill: 'none', 'stroke-linecap': 'round' }, flowLayer);
      paint(f.el, 'stroke', f.color); f.el.style.strokeOpacity = '0.35';
      f.g = svgEl('g', {}, dotLayer); f.dots = []; f.phase = (FLOWS.indexOf(f) * 0.137) % 1; f.rate = 0;
      if (f.label) svgEl('text', { x: f.label[1], y: f.label[2], 'text-anchor': f.label[3] || 'middle', class: f.label[2] > SURF ? 'lbl on-peat' : 'lbl' }, lblLayer).textContent = f.label[0];
    });
  }
  function drawBog(m) {
    const s = state.S, h = L.noonSun(s.tilt), ax = 300, ay = SURF - 4, dist = 128;
    const sx = ax - dist * Math.cos(h * RAD), sy = ay - dist * Math.sin(h * RAD);
    LY.sun.setAttribute('cx', sx); LY.sun.setAttribute('cy', sy);
    LY.beam.setAttribute('x1', sx); LY.beam.setAttribute('y1', sy); LY.beam.setAttribute('x2', ax); LY.beam.setAttribute('y2', ay);
    LY.beam.style.strokeOpacity = (0.15 + 0.3 * (m.relQ - 0.9) / 0.15).toFixed(2);
    LY.sunlbl.setAttribute('x', sx + 24); LY.sunlbl.setAttribute('y', sy + 4);
    LY.sunlbl.textContent = 'noon sun ' + h.toFixed(1) + '° high';
    FLOWS[0].el.setAttribute('d', 'M ' + sx + ' ' + sy + ' L ' + ax + ' ' + ay);
    const wy = SURF + 4 + (1 - s.wet / 100) * (BASE - SURF - 8);
    LY.water.setAttribute('y', wy); LY.water.setAttribute('height', Math.max(0, BASE - wy));
    LY.wline.setAttribute('y1', wy); LY.wline.setAttribute('y2', wy);
    const fireLabelY = SURF + 18;
    const waterY = m.B > 0.5 && Math.abs(wy - 5 - fireLabelY) < 20
      ? Math.max(wy + 18, fireLabelY + 20) : wy - 5;
    LY.wlbl.setAttribute('y', waterY); LY.wlbl.textContent = wy > BASE - 40 ? '' : 'water level';
    LY.airLbl.setAttribute('y', wy - 8); LY.airLbl.textContent = wy > SURF + 40 ? '↑ air spaces with oxygen' : '';
    LY.wetLbl.setAttribute('y', Math.max(wy + 18, SURF + 56)); LY.wetLbl.textContent = wy < BASE - 30 ? '↓ waterlogged, little oxygen' : '';
    LY.pores.forEach(function (c) { c.style.display = +c.dataset.y < wy - 3 && s.o2 > 0 ? '' : 'none'; });
    LY.microbeEls.forEach(function (mc) { mc.style.opacity = +mc.getAttribute('cy') < wy ? '1' : '0.25'; });
    const fireOn = m.B > 2;
    LY.embers.forEach(function (c) {
      const d = +c.dataset.d, y = SURF + 6 + d * Math.max(0, wy - SURF - 10);
      c.setAttribute('transform', 'translate(' + c.dataset.x + ' ' + y.toFixed(1) + ') scale(.5)');
      c.style.display = fireOn && d < m.B / 60 + 0.2 ? '' : 'none';
    });
    const ph = m.perm * (BASE - SURF - 10);
    LY.perm.setAttribute('y', BASE - ph); LY.perm.setAttribute('height', ph);
    LY.iceTick.setAttribute('y1', BASE - ph);
    LY.iceAnchor.setAttribute('cy', BASE - ph);
    LY.iceTick.style.display = LY.iceAnchor.style.display = ph > 0.75 ? '' : 'none';
    LY.plbl.textContent = 'Permafrost: ' + Math.round(m.perm * 100) + '% of peat frozen';
    LY.plants.style.opacity = (0.35 + 0.65 * Math.min(1, m.P / 45)).toFixed(2);
    LY.microbes.style.opacity = (0.15 + 0.85 * Math.min(1, m.D / 40)).toFixed(2);
    LY.fire.setAttribute('transform', 'translate(625 ' + SURF + ') scale(' + (0.4 + m.B / 100 * 0.9).toFixed(2) + ')');
    LY.fire.style.display = m.B > 0.5 ? '' : 'none';
    LY.firelbl.style.display = m.B > 0.5 ? '' : 'none';
    byId('bog-svg').setAttribute('aria-label', L.describeBog(m) + ' Arrows show carbon dioxide and oxygen moving between the air, the plants, the decomposers and any fire; thicker arrows mean a faster rate.');
  }
  function syncDots(f) {
    const want = f.rate < 0.5 ? 0 : Math.max(1, Math.round(f.rate / 12));
    while (f.dots.length < want) {
      const c = svgEl('path', { d: SHAPES[f.kind], 'stroke-width': 0.9 }, f.g);
      paint(c, 'fill', f.color); paint(c, 'stroke', '--ink'); c.style.strokeOpacity = '0.55'; f.dots.push(c);
    }
    while (f.dots.length > want) f.g.removeChild(f.dots.pop());
  }
  function placeDots() {
    FLOWS.forEach(function (f) {
      const n = f.dots.length; if (!n) return;
      let len = 0;
      try { len = f.el.getTotalLength(); } catch (e) { return; }
      for (let i = 0; i < n; i++) {
        let p; try { p = f.el.getPointAtLength(((f.phase + i / n) % 1) * len); } catch (e) { return; }
        f.dots[i].setAttribute('transform', 'translate(' + p.x.toFixed(1) + ' ' + p.y.toFixed(1) + ')');
      }
    });
  }
  const bogVisible = () => byId('bog').classList.contains('is-current') || !!byId('enlarge-dialog').open;
  const motionOn = () => !state.motionPaused && !reduceMotion() && !document.hidden && bogVisible();
  let raf = 0, lastT = 0;
  function tick(now) {
    raf = 0;
    if (!motionOn()) return;
    const dt = Math.min(0.1, (now - lastT) / 1000); lastT = now;
    FLOWS.forEach(function (f) { f.phase = (f.phase + dt * (0.05 + f.rate / 100 * 0.45)) % 1; });
    placeDots();
    raf = requestAnimationFrame(tick);
  }
  function kick() { if (!raf && motionOn()) { lastT = performance.now(); raf = requestAnimationFrame(tick); } }
  function syncMotionButton() {
    const b = byId('motion-btn');
    if (reduceMotion()) { b.textContent = 'Motion is off (your device asks for less motion)'; b.disabled = true; b.setAttribute('aria-pressed', 'true'); return; }
    b.disabled = false; b.textContent = state.motionPaused ? 'Play motion' : 'Pause motion'; b.setAttribute('aria-pressed', String(state.motionPaused));
  }

  /* ---------- meters, notes, change badges ---------- */
  let settled = null, settleTimer = null;
  function showDeltas(now) {
    const badges = $$('#meters .delta'), r = now.map(Math.round);
    if (!settled) { settled = r; return; }
    r.forEach(function (v, i) {
      const d = v - settled[i], e = badges[i];
      if (!d) { e.classList.remove('show'); return; }
      e.textContent = (d > 0 ? '↑ ' : '↓ ') + Math.abs(d); e.classList.add('show');
    });
    clearTimeout(settleTimer);
    settleTimer = setTimeout(function () { settled = r; badges.forEach(function (b) { b.classList.remove('show'); }); }, 3000);
  }
  const signed = n => (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(n);
  const SPEAKER = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  function renderNotes(m) {
    stopSpeaking();
    const box = byId('notes'); box.replaceChildren();
    L.notes(state.S, m).forEach(function (n) {
      const d = el('div', 'note ' + n.kind), sp = el('span'); const b = el('b', '', n.title + '.');
      sp.append(b, ' ' + n.text); d.appendChild(sp);
      const btn = el('button', 'speak'); btn.type = 'button'; btn.setAttribute('aria-pressed', 'false'); btn.setAttribute('aria-label', 'Read the note “' + n.title + '” aloud'); btn.title = 'Read aloud'; btn.innerHTML = SPEAKER;
      d.appendChild(btn); box.appendChild(d);
    });
  }
  function renderMeters(m) {
    [['p', m.P], ['d', m.D], ['b', m.B]].forEach(function (p) { byId(p[0] + 'Val').textContent = p[1].toFixed(0); byId(p[0] + 'Bar').style.width = p[1] + '%'; });
    ['P', 'D', 'B'].forEach(function (k) { byId('nb' + k).textContent = m[k].toFixed(0); });
    const net = Math.round(m.N), verdict = L.verdict(m.N);
    const nv = byId('nVal');
    nv.textContent = (verdict === 'sink' ? '✓ ' : verdict === 'source' ? '✕ ' : '') + signed(net);
    nv.style.color = verdict === 'sink' ? 'var(--b2-photo-t)' : verdict === 'source' ? 'var(--b2-burn-t)' : 'var(--ink)';
    byId('nbN').textContent = signed(net);
    byId('nbN').style.color = nv.style.color;
    const nb = byId('nBar'), w = Math.min(50, Math.abs(m.N) / 2);
    nb.style.left = m.N >= 0 ? '50%' : (50 - w) + '%'; nb.style.width = w + '%';
    nb.style.background = m.N >= 0 ? 'var(--b2-photo)' : 'var(--b2-burn)';
    byId('nText').textContent = verdict === 'sink' ? 'Carbon sink. Plants take in more carbon than decomposers and fire release, so peat builds up.'
      : verdict === 'source' ? 'Carbon released to atmosphere. Decomposers and fire release more carbon than plants take in, so the peat shrinks.' : 'Balanced. The peat is neither growing nor shrinking.';
    showDeltas([m.P, m.D, m.B, m.N]);
    byId('fTemp').textContent = m.T.toFixed(1) + ' °C';
    byId('fSun').textContent = L.noonSun(state.S.tilt).toFixed(1) + '°';
    byId('fQ').textContent = Math.round(m.q) + ' W/m²';
    const dq = (m.relQ - 1) * 100, dT = L.tiltWarming(state.S.tilt);
    byId('fQd').textContent = (dq >= 0 ? '+' : '') + dq.toFixed(1) + '%';
    byId('fT').textContent = (dT >= 0 ? '+' : '') + dT.toFixed(1) + ' °C';
    byId('o2Peat').textContent = m.peatO2.toFixed(1) + '%';
    byId('o2PeatBar').style.width = clamp(m.peatO2 / 35 * 100, 0, 100) + '%';
    byId('o2PeatTxt').textContent = 'Air has ' + state.S.o2 + '%. Water blocks oxygen from reaching most of the peat.';
  }
  function summaryText(m) {
    const warning = L.notes(state.S,m).find(note=>/^The fire/.test(note.title) && note.kind === 'warn');
    return 'Photosynthesis ' + Math.round(m.P) + ', decomposition ' + Math.round(m.D) + ', burning ' + Math.round(m.B) + '. Peat carbon ' + signed(Math.round(m.N)) + ': ' +
      (L.verdict(m.N) === 'sink' ? 'a carbon sink.' : L.verdict(m.N) === 'source' ? 'carbon is released to the air.' : 'balanced.')
      + (warning ? ' ' + warning.text : '');
  }

  /* ---------- text to speech (the device's built-in voice; nothing is sent anywhere) ---------- */
  const canSpeak = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
  if (!canSpeak) document.documentElement.classList.add('no-speech');
  let speakingBtn = null;
  function stopSpeaking() {
    if (canSpeak && speakingBtn) { try { speechSynthesis.cancel(); } catch (e) { /* ignore */ } }
    if (speakingBtn) speakingBtn.setAttribute('aria-pressed', 'false');
    speakingBtn = null;
  }
  document.addEventListener('click', function (e) {
    const btn = e.target.closest && e.target.closest('.speak');
    if (!btn || !canSpeak) return;
    if (speakingBtn === btn) { stopSpeaking(); return; }
    stopSpeaking();
    const src = btn.dataset.say ? byId(btn.dataset.say) : btn.parentElement.querySelector('span');
    const text = (src ? src.textContent : '').replace(/CO₂/g, 'C O 2').replace(/O₂/g, 'O 2').replace(/°C/g, ' degrees Celsius').replace(/°/g, ' degrees');
    if (!text.trim()) return;
    const u = new SpeechSynthesisUtterance(text); u.lang = 'en-US'; u.rate = 0.95;
    u.onend = u.onerror = function () { if (speakingBtn === btn) stopSpeaking(); };
    speakingBtn = btn; btn.setAttribute('aria-pressed', 'true');
    try { speechSynthesis.speak(u); } catch (err) { stopSpeaking(); }
  });
  window.addEventListener('pagehide', stopSpeaking);

  /* ---------- line charts (SVG), sized to their box so the text stays readable ---------- */
  function niceStep(raw) { const p = Math.pow(10, Math.floor(Math.log10(raw))), n = raw / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p; }
  function ticks(min, max, n) { const st = niceStep((max - min) / n), out = []; for (let v = Math.ceil(min / st - 1e-9) * st; v <= max + 1e-9; v += st) out.push(+v.toFixed(6)); return out; }
  const DASHES = ['', '9 5', '2 5'];
  const MARK = {
    circle: (x, y, r) => 'M' + (x - r) + ' ' + y + 'a' + r + ' ' + r + ' 0 1 0 ' + 2 * r + ' 0a' + r + ' ' + r + ' 0 1 0 ' + (-2 * r) + ' 0Z',
    square: (x, y, r) => 'M' + (x - r) + ' ' + (y - r) + 'h' + 2 * r + 'v' + 2 * r + 'h' + (-2 * r) + 'Z',
    triangle: (x, y, r) => 'M' + x + ' ' + (y - r - 1) + 'L' + (x + r + 1) + ' ' + (y + r) + 'H' + (x - r - 1) + 'Z'
  };
  function chartWidth(svg) { const w = Math.round(svg.getBoundingClientRect().width); return w >= 260 ? w : (svg.dataset.w ? +svg.dataset.w : 640); }
  function lineChart(svg, o) {
    const W = chartWidth(svg), H = o.height || Math.round(clamp(W * 0.46, 220, 330));
    svg.dataset.w = W; svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H); svg.replaceChildren();
    const m = { l: 56, r: 14, t: 12, b: o.xLabel ? 46 : 28 };
    const X = v => m.l + (v - o.xMin) / (o.xMax - o.xMin) * (W - m.l - m.r);
    const Y = v => H - m.b - (v - o.yMin) / (o.yMax - o.yMin) * (H - m.t - m.b);
    const grid = svgEl('g', { class: 'grid' }, svg), axis = svgEl('g', { class: 'axis' }, svg);
    ticks(o.yMin, o.yMax, o.yTicks || 5).forEach(function (t) {
      svgEl('line', { x1: m.l, x2: W - m.r, y1: Y(t), y2: Y(t) }, grid);
      svgEl('text', { x: m.l - 6, y: Y(t) + 4, 'text-anchor': 'end' }, axis).textContent = o.yFmt ? o.yFmt(t) : t;
    });
    ticks(o.xMin, o.xMax, o.xTicks || (W < 420 ? 4 : 6)).forEach(function (t) {
      svgEl('text', { x: X(t), y: H - m.b + 16, 'text-anchor': 'middle' }, axis).textContent = o.xFmt ? o.xFmt(t) : t;
    });
    svgEl('line', { x1: m.l, x2: W - m.r, y1: H - m.b, y2: H - m.b }, axis);
    svgEl('line', { x1: m.l, x2: m.l, y1: m.t, y2: H - m.b }, axis);
    if (o.xLabel) svgEl('text', { x: (m.l + W - m.r) / 2, y: H - 6, 'text-anchor': 'middle', class: 'axis-title' }, svg).textContent = o.xLabel;
    if (o.yLabel) svgEl('text', { x: 13, y: (m.t + H - m.b) / 2, 'text-anchor': 'middle', class: 'axis-title', transform: 'rotate(-90 13 ' + ((m.t + H - m.b) / 2) + ')' }, svg).textContent = o.yLabel;
    (o.refs || []).forEach(function (r) {
      if (r.y > o.yMax) return;
      const l = svgEl('line', { x1: m.l, x2: W - m.r, y1: Y(r.y), y2: Y(r.y), 'stroke-dasharray': '5 4', 'stroke-width': 1.4 }, svg); paint(l, 'stroke', '--b2-heat-t');
      const t = svgEl('text', { x: m.l + 6, y: Y(r.y) - 5, 'text-anchor': 'start', class: 'axis-title' }, svg); t.textContent = r.label; paint(t, 'fill', '--b2-heat-t');
    });
    o.series.forEach(function (s, si) {
      if (s.area) {
        const a = svgEl('path', { d: 'M ' + X(o.x[0]) + ' ' + Y(o.yMin) + ' ' + o.x.map(function (x, i) { return 'L ' + X(x).toFixed(1) + ' ' + Y(s.y[i]).toFixed(1); }).join(' ') + ' L ' + X(o.x[o.x.length - 1]) + ' ' + Y(o.yMin) + ' Z' }, svg);
        paint(a, 'fill', s.color); a.style.fillOpacity = '0.12';
      }
      const p = svgEl('path', { d: o.x.map(function (x, i) { return (i ? 'L' : 'M') + ' ' + X(x).toFixed(1) + ' ' + Y(s.y[i]).toFixed(1); }).join(' '), fill: 'none', 'stroke-width': 3, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, svg);
      if (s.dash) p.setAttribute('stroke-dasharray', s.dash);
      paint(p, 'stroke', s.color);
    });
    if (o.marker != null) {
      const mk = svgEl('line', { x1: X(o.marker), x2: X(o.marker), y1: m.t, y2: H - m.b, 'stroke-dasharray': '4 4', 'stroke-width': 1.5 }, svg); paint(mk, 'stroke', '--ink');
      o.series.forEach(function (s) {
        if (s.markY == null) return;
        const c = svgEl('path', { d: MARK[s.shape || 'circle'](X(o.marker), Y(s.markY), 5.5), 'stroke-width': 2.5 }, svg);
        paint(c, 'fill', '--surface'); paint(c, 'stroke', s.color);
      });
    }
    svg._geom = { W, H, m, X, Y };
  }
  function legendFor(ul, series) {
    ul.replaceChildren();
    series.forEach(function (s) {
      const li = el('li'), sv = svgEl('svg', { viewBox: '0 0 34 12', 'aria-hidden': 'true' });
      const ln = svgEl('line', { x1: 2, x2: 32, y1: 6, y2: 6, 'stroke-width': 3, 'stroke-linecap': 'round' }, sv); paint(ln, 'stroke', s.color); if (s.dash) ln.setAttribute('stroke-dasharray', s.dash);
      const mk = svgEl('path', { d: MARK[s.shape](17, 6, 4), 'stroke-width': 2 }, sv); paint(mk, 'fill', '--surface'); paint(mk, 'stroke', s.color);
      li.appendChild(sv); li.appendChild(document.createTextNode(s.name)); ul.appendChild(li);
    });
  }
  function dataTable(caption, head, body) {
    const wrap = el('div', 'table-wrap'), t = el('table', 'data');
    t.appendChild(el('caption', '', caption));
    const thead = el('thead'), hr = el('tr');
    head.forEach(function (h) { const th = el('th', h.cls || '', h.text || h); th.scope = 'col'; hr.appendChild(th); });
    thead.appendChild(hr); t.appendChild(thead);
    const tb = el('tbody');
    body.forEach(function (r) { const tr = el('tr'); r.forEach(function (c, i) { const cell = el(i ? 'td' : 'th', i ? 'num' : '', c); if (!i) cell.scope = 'row'; tr.appendChild(cell); }); tb.appendChild(tr); });
    t.appendChild(tb); wrap.appendChild(t); return wrap;
  }
  const SERIES = [
    { name: 'Photosynthesis', color: '--b2-photo', dash: DASHES[0], shape: 'circle' },
    { name: 'Decomposition', color: '--b2-resp', dash: DASHES[1], shape: 'square' },
    { name: 'Burning', color: '--b2-burn', dash: DASHES[2], shape: 'triangle' }
  ];
  function drawExplore() {
    const key = state.explore, ex = L.exploreSeries(state.S, key, 120), v = ex.v, c = cur || L.model(state.S);
    const unit = v.unit === '°' ? '°' : ' ' + v.unit;
    const f = x => key === 'tilt' ? x.toFixed(2) : key === 'co2' ? String(Math.round(x)) : x.toFixed(1).replace(/\.0$/, '');
    const series = [Object.assign({ y: ex.P, markY: c.P }, SERIES[0]), Object.assign({ y: ex.D, markY: c.D }, SERIES[1]), Object.assign({ y: ex.B, markY: c.B }, SERIES[2])];
    const svg = byId('explore');
    lineChart(svg, { x: ex.xs, xMin: v.min, xMax: v.max, yMin: 0, yMax: 100, xFmt: key === 'tilt' ? t => t.toFixed(1) : null, xTicks: key === 'tilt' ? 5 : undefined,
      xLabel: v.label + ' (' + v.unit + ')', yLabel: 'Rate (0–100, simulated)', series: series, marker: state.S[key] });
    legendFor(byId('explore-legend'), series);
    const peak = ex.P.indexOf(Math.max.apply(null, ex.P));
    svg.setAttribute('aria-label', 'Line graph, simulated. Photosynthesis, decomposition and burning rates from 0 to 100 as ' + v.label.toLowerCase() + ' goes from ' + f(v.min) + ' to ' + f(v.max) + unit + '. Photosynthesis is highest, at ' + Math.round(ex.P[peak]) + ', near ' + f(ex.xs[peak]) + unit + '. At your setting of ' + f(state.S[key]) + unit + ': photosynthesis ' + Math.round(c.P) + ', decomposition ' + Math.round(c.D) + ', burning ' + Math.round(c.B) + '. A table of the same values follows the graph.');
    byId('explore-now').textContent = 'At your setting of ' + f(state.S[key]) + unit + ' (simulated, 0–100 scale): photosynthesis ' + Math.round(c.P) + ', decomposition ' + Math.round(c.D) + ', burning ' + Math.round(c.B) + '.';
    const picks = []; for (let i = 0; i <= 120; i += 10) picks.push(i);
    byId('explore-table').replaceChildren(dataTable('Simulated rates (0–100 scale) as ' + v.label.toLowerCase() + ' changes. Other settings stay as set in The bog.', [v.label + ' (' + v.unit + ')', 'Photosynthesis', 'Decomposition', 'Burning'],
      picks.map(function (i) { return [f(ex.xs[i]), String(Math.round(ex.P[i])), String(Math.round(ex.D[i])), String(Math.round(ex.B[i]))]; })));
    addHover(svg, v, ex, series, f, unit);
  }
  function addHover(svg, v, ex, series, f, unit) {
    const gm = svg._geom, W = gm.W, H = gm.H, m = gm.m, n = ex.xs.length - 1;
    const g = svgEl('g', { 'pointer-events': 'none' }, svg); g.style.display = 'none';
    const ln = svgEl('line', { y1: m.t, y2: H - m.b, 'stroke-width': 1.5 }, g); paint(ln, 'stroke', '--muted');
    const dots = series.map(function (s) { const c = svgEl('path', { d: MARK[s.shape](0, 0, 5) }, g); paint(c, 'fill', s.color); return c; });
    const bw = 190, box = svgEl('rect', { width: bw, height: 82, rx: 6, class: 'hov-box' }, g);
    const tx = [0, 1, 2, 3].map(function (i) { return svgEl('text', { class: i ? 'lbl' : 'lbl-b' }, g); });
    tx.forEach(function (t) { t.style.fontSize = '13px'; });
    const overlay = svgEl('rect', { x: m.l, y: m.t, width: W - m.l - m.r, height: H - m.t - m.b, fill: 'transparent' }, svg);
    const move = function (e) {
      const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
      const p = pt.matrixTransform(svg.getScreenCTM().inverse());
      const i = clamp(Math.round((p.x - m.l) / (W - m.l - m.r) * n), 0, n), x = gm.X(ex.xs[i]);
      g.style.display = '';
      ln.setAttribute('x1', x); ln.setAttribute('x2', x);
      [ex.P, ex.D, ex.B].forEach(function (arr, k) { dots[k].setAttribute('transform', 'translate(' + x + ' ' + gm.Y(arr[i]) + ')'); });
      const bx = x + 12 + bw > W - m.r ? x - 12 - bw : x + 12;
      box.setAttribute('x', bx); box.setAttribute('y', m.t + 4);
      tx[0].textContent = f(ex.xs[i]) + unit;
      [ex.P, ex.D, ex.B].forEach(function (arr, k) { tx[k + 1].textContent = series[k].name + ': ' + Math.round(arr[i]); });
      tx.forEach(function (t, k) { t.setAttribute('x', bx + 10); t.setAttribute('y', m.t + 22 + k * 18); });
    };
    overlay.addEventListener('pointermove', move); overlay.addEventListener('pointerdown', move);
    overlay.addEventListener('pointerleave', function () { g.style.display = 'none'; });
  }

  /* ---------- zombie fires ---------- */
  function drawSeason(m, z) {
    const svg = byId('zombie-svg'); svg.replaceChildren();
    const season = state.season, top = 110, base = 270, alive = z.chance >= 50, winter = season === 2, s = state.S;
    const defs = svgEl('defs', {}, svg);
    const pat = svgEl('pattern', { id: 'icehatch-z', width: 8, height: 8, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, defs);
    paint(svgEl('rect', { width: 8, height: 8 }, pat), 'fill', '--b2-ice');
    const hl = svgEl('line', { x1: 0, y1: 0, x2: 0, y2: 8, 'stroke-width': 3 }, pat); paint(hl, 'stroke', '--b2-o2'); hl.style.strokeOpacity = '0.5';
    paint(svgEl('rect', { x: 0, y: 0, width: 700, height: top }, svg), 'fill', '--b2-sky');
    paint(svgEl('rect', { x: 0, y: top, width: 700, height: base - top }, svg), 'fill', '--b2-peat');
    paint(svgEl('rect', { x: 0, y: base, width: 700, height: 300 - base }, svg), 'fill', '--b2-sunk');
    const wy = top + 4 + (1 - s.wet / 100) * (base - top - 8);
    const wr = svgEl('rect', { x: 0, y: wy, width: 700, height: base - wy }, svg); paint(wr, 'fill', '--b2-water'); wr.style.fillOpacity = '0.22';
    paint(svgEl('line', { x1: 0, x2: 700, y1: wy, y2: wy, 'stroke-width': 2, 'stroke-dasharray': '8 5' }, svg), 'stroke', '--b2-water');
    svgEl('text', { x: 694, y: wy - 5, 'text-anchor': 'end', class: 'lbl-sm on-peat' }, svg).textContent = 'water level';
    const ph = m.perm * (base - top - 10);
    if (ph > 1) svgEl('rect', { x: 0, y: base - ph, width: 700, height: ph, fill: 'url(#icehatch-z)' }, svg);
    for (let x = 10; x < 700; x += 16) paint(svgEl('ellipse', { cx: x, cy: top - 2, rx: 9, ry: 4.5 }, svg), 'fill', season === 0 || season === 3 ? '--b2-photo' : '--b2-resp');
    const scar = svgEl('rect', { x: 250, y: top - 6, width: 200, height: 8 }, svg); paint(scar, 'fill', '--ink'); scar.style.fillOpacity = z.fire > 0.05 ? '0.6' : '0';
    if (winter) {
      paint(svgEl('rect', { x: 0, y: top - 22, width: 700, height: 22 }, svg), 'fill', '--b2-snow');
      svgEl('text', { x: 12, y: top - 30, class: 'lbl' }, svg).textContent = 'Snow insulates the ground';
    }
    const depthFrac = [0.35, 0.65, 0.85, 0.6][season];
    const emberAlive = z.fire > 0.05 && (season < 2 || alive);
    let es = 5; const er = function () { return (es = (es * 9301 + 49297) % 233280) / 233280; };
    const n = Math.round(6 + z.fire * 26), maxD = Math.max(8, (wy - top) * depthFrac);
    for (let i = 0; i < n; i++) {
      const ex = 260 + er() * 180, ey = top + 6 + er() * maxD;
      if (!emberAlive) continue;
      const c = svgEl('path', { d: SHAPES.heat, transform: 'translate(' + ex.toFixed(1) + ' ' + ey.toFixed(1) + ') scale(.55)' }, svg);
      paint(c, 'fill', i % 3 ? '--b2-burn' : '--b2-light'); c.style.opacity = season === 2 ? 0.55 + 0.45 * (z.chance / 100) : 1;
    }
    if (emberAlive && season >= 1) {
      svgEl('text', { x: 350, y: Math.min(base - 8, top + maxD + 22), 'text-anchor': 'middle', class: 'lbl on-peat' }, svg).textContent = season === 2 ? 'Fire smoldering underground' : 'Fire creeping into dry peat';
      [300, 350, 400].forEach(function (x) { paint(svgEl('line', { x1: x, y1: top - (winter ? 22 : 0) - 14, x2: x, y2: top + 10, 'stroke-width': 2, 'stroke-dasharray': '3 4' }, svg), 'stroke', '--b2-o2'); });
      svgEl('text', { x: 410, y: top - (winter ? 22 : 0) - 18, class: 'lbl-sm' }, svg).textContent = 'a little oxygen seeps in';
    }
    if (z.fire > 0.05 && (season === 0 || (season === 3 && alive))) {
      const g = svgEl('g', { transform: 'translate(350 ' + (top - 4) + ') scale(' + (0.7 + z.fire * 0.6).toFixed(2) + ')' }, svg);
      [-60, -30, 0, 30, 60].forEach(function (dx, i) {
        const k = [0.8, 1.1, 1.3, 1, 0.75][i];
        paint(svgEl('path', { d: 'M ' + (dx - 10 * k) + ' 0 Q ' + (dx - 11 * k) + ' ' + (-24 * k) + ' ' + dx + ' ' + (-44 * k) + ' Q ' + (dx + 11 * k) + ' ' + (-24 * k) + ' ' + (dx + 10 * k) + ' 0 Z' }, g), 'fill', '--b2-burn');
        paint(svgEl('path', { d: 'M ' + (dx - 4 * k) + ' 0 Q ' + (dx - 5 * k) + ' ' + (-12 * k) + ' ' + dx + ' ' + (-22 * k) + ' Q ' + (dx + 5 * k) + ' ' + (-12 * k) + ' ' + (dx + 4 * k) + ' 0 Z' }, g), 'fill', '--b2-light');
      });
    }
    if (emberAlive && (season === 1 || season === 2)) {
      [320, 380].forEach(function (x) {
        const sm = svgEl('path', { d: 'M ' + x + ' ' + (top - (winter ? 22 : 4)) + ' q -10 -20 0 -40 q 10 -20 0 -40', fill: 'none', 'stroke-width': 4, 'stroke-linecap': 'round' }, svg);
        paint(sm, 'stroke', '--b2-co2'); sm.style.strokeOpacity = '0.6';
      });
      svgEl('text', { x: 400, y: 30, class: 'lbl-sm' }, svg).textContent = 'a little smoke (CO₂) escapes';
    }
    svgEl('text', { x: 12, y: 24, class: 'lbl-b' }, svg).textContent = L.SEASONS[season];
    const cap = L.seasonCaption(season, z, s.wet);
    byId('zCaption').textContent = cap;
    svg.setAttribute('aria-label', 'Simulated cross-section of the bog in ' + L.SEASONS[season].toLowerCase() + '. Water level ' + s.wet + ' percent. Chance the fire survives the winter: ' + z.chance + ' percent. ' + cap);
    $$('[data-season]').forEach(function (b) { b.setAttribute('aria-pressed', String(+b.dataset.season === season)); });
    return cap;
  }
  function updateZombie(m) {
    const z = L.zombie(state.S, m), s = state.S;
    byId('zChance').textContent = z.chance + '%';
    byId('zFactors').innerHTML = L.ZOMBIE_FACTORS.map(function (f) {
      const pct = Math.round(z[f[0]] * 100), color = f[0] === 'oxy' ? '--b2-o2' : '--b2-burn';
      return '<div class="flowbar"><span>' + f[1] + '</span><div class="bar" aria-hidden="true"><span style="width:' + pct + '%;background:var(' + color + ')"></span></div><span class="num">' + pct + '%</span></div>';
    }).join('');
    const weak = L.weakestZombieFactor(z);
    byId('zWhy').textContent = z.chance >= 50 ? 'Dry, thawed, oxygen-rich peat lets the fire burrow deep enough to last the winter.' : 'Biggest obstacle: ' + L.ZOMBIE_WHY[weak];
    byId('znW').textContent = s.wet + '%'; byId('znO').textContent = m.peatO2.toFixed(1) + '%'; byId('znB').textContent = String(Math.round(m.B));
    return drawSeason(m, z);
  }

  /* ---------- the whole update ---------- */
  function update(now) {
    cur = L.model(state.S);
    syncControls(); drawEarth(); drawBog(cur); updateZombie(cur);
    FLOWS.forEach(function (f) {
      f.rate = f.src(cur);
      f.el.setAttribute('stroke-width', (1.5 + f.rate / 100 * 16).toFixed(1));
      syncDots(f);
    });
    placeDots(); kick();
    renderMeters(cur); renderNotes(cur); drawExplore();
    byId('record-bog').disabled = false;
    const settings = L.VARS.map(v=>v.label + ' ' + fmtVar(v,state.S[v.key])).join(' · ');
    byId('trial-settings').textContent = 'Settings for your next trial: ' + settings + '.';
    if (ready) { save(); (now ? announceNow : announceSoon)(summaryText(cur)); }
  }

  /* ---------- Test one variable ---------- */
  function buildExplore() {
    const sel = byId('xVar');
    L.VARS.forEach(function (v) { const o = el('option', '', v.label); o.value = v.key; sel.appendChild(o); });
    sel.value = state.explore;
    sel.addEventListener('change', function () { state.explore = sel.value; drawExplore(); save(); announce('Graph now shows ' + L.VARS.find(function (v) { return v.key === sel.value; }).label.toLowerCase() + '.'); });
  }

  /* ---------- seasons ---------- */
  function setSeason(i, say) { state.season = i; const cap = updateZombie(cur || L.model(state.S)); save(); if (say) announce(cap); }
  function wireZombie() {
    $$('[data-season]').forEach(function (b) { b.addEventListener('click', function () { clearInterval(playTimer); playTimer = null; setSeason(+b.dataset.season, true); }); });
    byId('zPlay').addEventListener('click', function () {
      clearInterval(playTimer); setSeason(0, true);
      playTimer = setInterval(function () { if (state.season >= 3) { clearInterval(playTimer); playTimer = null; return; } setSeason(state.season + 1, true); }, reduceMotion() ? 1800 : 2600);
    });
    byId('zSetup').addEventListener('click', function () { state.season = 0; setState(L.ZOMBIE_SETUP, true); announce('Zombie fire conditions loaded. ' + L.seasonCaption(0, L.zombie(state.S), state.S.wet)); });
    byId('reset-zombie').addEventListener('click', bogReset);
  }

  /* ---------- global warming ---------- */
  const CLIMATE_IDS = ['fossil', 'forest', 'year'];
  function drawGreenhouse(row) {
    const svg = byId('gh-svg'); svg.replaceChildren();
    const defs = svgEl('defs', {}, svg);
    ['heat', 'light'].forEach(function (k) {
      const mk = svgEl('marker', { id: 'ah-' + k, viewBox: '0 0 10 10', refX: 5, refY: 5, markerWidth: 5, markerHeight: 5, orient: 'auto-start-reverse' }, defs);
      paint(svgEl('path', { d: 'M 0 0 L 10 5 L 0 10 z' }, mk), 'fill', '--b2-' + k);
    });
    paint(svgEl('rect', { x: 0, y: 0, width: 600, height: 300, rx: 8 }, svg), 'fill', '--b2-sky');
    const band = svgEl('rect', { x: 0, y: 70, width: 600, height: 70 }, svg);
    paint(band, 'fill', '--b2-co2'); band.style.fillOpacity = (0.08 + 0.45 * clamp((row.C - 280) / 1100, 0, 1)).toFixed(2);
    const nMol = Math.round(row.C / 25);
    let seed = 7; const rnd = function () { return (seed = (seed * 9301 + 49297) % 233280) / 233280; };
    for (let i = 0; i < nMol; i++) paint(svgEl('circle', { cx: (rnd() * 590 + 5).toFixed(1), cy: (74 + rnd() * 62).toFixed(1), r: 2.6 }, svg), 'fill', '--b2-co2');
    svgEl('text', { x: 140, y: 62, class: 'lbl-sm' }, svg).textContent = 'atmosphere · ' + Math.round(row.C) + ' ppm CO₂';
    paint(svgEl('circle', { cx: 52, cy: 38, r: 22 }, svg), 'fill', '--b2-light');
    [150, 215, 280].forEach(function (gx) { paint(svgEl('line', { x1: 70, y1: 52, x2: gx, y2: 236, 'stroke-width': 3, 'marker-end': 'url(#ah-light)' }, svg), 'stroke', '--b2-light'); });
    svgEl('text', { x: 92, y: 178, class: 'lbl' }, svg).textContent = 'Sunlight';
    paint(svgEl('path', { d: 'M 0 248 Q 300 232 600 248 L 600 300 L 0 300 Z' }, svg), 'fill', '--b2-ground');
    svgEl('text', { x: 16, y: 284, class: 'lbl' }, svg).textContent = 'Ground warms up';
    const N = 6, trapped = L.heatTrapped(row.C);
    function wave(x, y0, y1, amp) { const pts = [], k = 40; for (let i = 0; i <= k; i++) { const t = i / k; pts.push((i ? 'L' : 'M') + ' ' + (x + Math.sin(t * Math.PI * 6) * amp).toFixed(1) + ' ' + (y0 + (y1 - y0) * t).toFixed(1)); } return pts.join(' '); }
    for (let i = 0; i < N; i++) {
      const x = 410 + i * 33;
      if (i < trapped) {
        paint(svgEl('path', { d: wave(x, 236, 110, 4), fill: 'none', 'stroke-width': 2.5 }, svg), 'stroke', '--b2-heat');
        paint(svgEl('path', { d: wave(x + 16, 112, 232, 3), fill: 'none', 'stroke-width': 2, 'stroke-dasharray': '4 3', 'marker-end': 'url(#ah-heat)' }, svg), 'stroke', '--b2-heat');
      } else {
        const up = svgEl('path', { d: wave(x, 236, 14, 4), fill: 'none', 'stroke-width': 2.5, 'marker-end': 'url(#ah-heat)' }, svg);
        paint(up, 'stroke', '--b2-heat'); up.style.strokeOpacity = '0.7';
      }
    }
    svgEl('text', { x: 395, y: 30, 'text-anchor': 'end', class: 'lbl' }, svg).textContent = 'Heat escaping to space: ' + (N - trapped) + ' of ' + N;
    svgEl('text', { x: 395, y: 172, 'text-anchor': 'end', class: 'lbl' }, svg).textContent = 'Heat sent back down: ' + trapped + ' of ' + N;
    const tt = svgEl('text', { x: 84, y: 34, class: 'lbl-b' }, svg); tt.textContent = row.y + ': +' + row.T.toFixed(1) + ' °C'; paint(tt, 'fill', '--b2-heat-t');
    svg.setAttribute('aria-label', 'Simulated greenhouse effect in ' + row.y + ': ' + Math.round(row.C) + ' ppm of carbon dioxide in the air and ' + row.T.toFixed(1) + ' degrees Celsius of warming since the 1800s. Of 6 heat arrows, ' + trapped + ' are sent back down to the ground and ' + (N - trapped) + ' escape to space.');
  }
  function updateClimate(now) {
    const c = state.climate, ids = { fossil: byId('fossil'), forest: byId('forest'), year: byId('year') };
    syncControl(ids.fossil, byId('n-fossil'), c.fossil, c.fossil.toFixed(1) + ' gigatonnes of carbon per year');
    syncControl(ids.forest, byId('n-forest'), c.forest, c.forest + ' percent of today');
    syncControl(ids.year, byId('n-year'), c.year, 'year ' + c.year);
    rows = L.climate(c.fossil, c.forest);
    const row = rows[c.year - L.Y0];
    [['fossil', row.fossil, 'n-fossil-bar'], ['clear', row.clear, 'n-clear'], ['land', row.land, 'n-land'], ['ocean', row.ocean, 'n-ocean']].forEach(function (p) {
      byId('b-' + p[0]).style.width = clamp(p[1] / 20 * 100, 0, 100) + '%'; byId(p[2]).textContent = p[1].toFixed(1);
    });
    const dC = L.ppmChange(row);
    byId('balanceText').textContent = dC > 0.05 ? 'More carbon goes in than comes out, so CO₂ in the air rises about ' + dC.toFixed(1) + ' ppm per year.'
      : dC < -0.05 ? 'Plants and oceans remove more than is added, so CO₂ in the air falls about ' + Math.abs(dC).toFixed(1) + ' ppm per year.' : 'Carbon in and carbon out are balanced, so CO₂ in the air holds steady.';
    drawGreenhouse(row); drawClimateCharts(row);
    const bv = L.bogForYear(rows, c.year);
    byId('sendInfo').textContent = 'Test the bog in ' + c.year + ' sets the bog to ' + bv.co2 + ' ppm CO₂' + (Math.round(row.C) === bv.co2 ? '' : ' (' + Math.round(row.C) + ' ppm rounded to the bog’s steps of 10 ppm)') + ' and a summer temperature of ' + bv.temp + ' °C.';
    if (ready) { save(); (now ? announceNow : announceSoon)(row.y + ': ' + Math.round(row.C) + ' ppm of CO₂ and ' + row.T.toFixed(1) + ' degrees of warming since the 1800s. ' + byId('balanceText').textContent); }
  }
  function drawClimateCharts(row) {
    const xs = rows.map(function (r) { return r.y; }), Cs = rows.map(function (r) { return r.C; }), Ts = rows.map(function (r) { return r.T; });
    const cMax = Math.max(500, Math.ceil(Math.max.apply(null, Cs) / 100) * 100), tMax = Math.max(3, Math.ceil(Math.max.apply(null, Ts)));
    const sc = byId('c-co2'), st = byId('c-temp');
    lineChart(sc, { x: xs, xMin: L.Y0, xMax: L.Y1, yMin: 250, yMax: cMax, xTicks: 4, yTicks: 4, xLabel: 'Year', yLabel: 'CO₂ (ppm)', series: [{ y: Cs, color: '--b2-co2', area: true, markY: row.C, shape: 'circle' }], marker: row.y });
    lineChart(st, { x: xs, xMin: L.Y0, xMax: L.Y1, yMin: 0, yMax: tMax, xTicks: 4, yTicks: 4, xLabel: 'Year', yLabel: 'Warming (°C)', yFmt: function (t) { return t.toFixed(1).replace('.0', ''); },
      refs: [{ y: 1.5, label: '1.5 °C goal' }, { y: 2, label: '2 °C upper limit' }], series: [{ y: Ts, color: '--b2-heat', area: true, markY: row.T, shape: 'circle' }], marker: row.y });
    sc.setAttribute('aria-label', 'Line graph, simulated: carbon dioxide in the air from 2025 to 2100, from ' + Math.round(Cs[0]) + ' to ' + Math.round(Cs[Cs.length - 1]) + ' ppm. In ' + row.y + ' it is ' + Math.round(row.C) + ' ppm. A table follows the graphs.');
    st.setAttribute('aria-label', 'Line graph, simulated: warming since the 1800s from 2025 to 2100, from ' + Ts[0].toFixed(1) + ' to ' + Ts[Ts.length - 1].toFixed(1) + ' degrees Celsius, with lines at 1.5 and 2 degrees. In ' + row.y + ' it is ' + row.T.toFixed(1) + ' degrees. A table follows the graphs.');
    const body = []; for (let i = 0; i < rows.length; i += 5) body.push([String(rows[i].y), String(Math.round(rows[i].C)), rows[i].T.toFixed(1)]);
    byId('climate-table').replaceChildren(dataTable('Simulated CO₂ and warming, every 5 years, for the fossil fuel and forest settings above.', ['Year', 'CO₂ in the air (ppm)', 'Warming since the 1800s (°C)'], body));
  }
  function wireClimate() {
    CLIMATE_IDS.forEach(function (k) {
      bindControl(byId(k), byId('n-' + k), function (x, now) { state.warmingUsed = true; state.climate = L.sanitizeClimate(Object.assign({}, state.climate, { [k]: x })); updateClimate(now); });
    });
    byId('climateReset').addEventListener('click', function () {
      state.warmingUsed = true; state.climate = L.sanitizeClimate({}); updateClimate(true); flash('Back to today’s values: 10 Gt, 100% forests and peatlands, year 2100.', true);
    });
    byId('sendBog').addEventListener('click', function () {
      const vals = L.bogForYear(rows, state.climate.year);
      state.warmingUsed = true;
      const c = state.climate;
      const previous = state.climateTests.at(-1);
      if (!previous || CLIMATE_IDS.some(k => previous[k] !== c[k])) {
        state.climateTests = state.climateTests.concat({ ...c }).slice(-30);
      }
      setState(vals, true);
      if (window.CompanionPages) CompanionPages.go('bog'); else location.hash = 'bog';
      announce('The bog is set to ' + state.climate.year + ': ' + vals.co2 + ' ppm of CO₂ and a summer temperature of ' + vals.temp + ' degrees Celsius. ' + summaryText(cur));
    });
  }

  /* ---------- recorded trials ---------- */
  const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  function renderLog() {
    byId('undo').disabled = !state.trials.length;
    byId('nav-count').textContent = String(state.trials.length);
    const sr = byId('nav-count').parentElement; let hid = sr.querySelector('.sr-only.cnt');
    if (!hid) { hid = el('span', 'sr-only cnt'); sr.appendChild(hid); }
    hid.textContent = state.trials.length ? ' (' + state.trials.length + ' recorded)' : '';
    const wrap = byId('logWrap'), details = byId('trial-details'), list = byId('trial-detail-list');
    byId('copy-trials-fallback').hidden = true;
    details.hidden = !state.trials.length;
    if (details.hidden) {
      wrap.innerHTML = '<div class="empty">No trials yet. Set up the bog, then choose Record this trial.</div>';
      details.open = false; list.replaceChildren(); return;
    }
    // Keep the three outcomes easy to compare. All other fields are available below and in the full exports.
    const data = state.trials.map((t, i) => L.trialRow(t, i + 1));
    wrap.innerHTML = '<table class="data trial-outcomes"><caption class="sr-only">Recorded trial outcomes. Simulated data, not measurements.</caption>' +
      '<thead><tr><th scope="col" class="trial-label-col">Trial and label</th><th scope="col">Peat carbon</th><th scope="col">Peat frozen</th><th scope="col">Winter fire chance</th></tr></thead><tbody>' +
      data.map((r, i) =>
        '<tr' + (i && r.label !== data[i - 1].label ? ' class="newgroup"' : '') + '>' +
        '<th scope="row" class="trial-label-col"><span>Trial ' + r.n + '</span>' +
        '<div class="trial-label"><span class="trial-label-mirror" aria-hidden="true">' + esc(r.label) + '</span>' +
        '<textarea class="lbl-input" data-i="' + i + '" rows="1" aria-label="Label for trial ' + r.n +
        '" maxlength="60" placeholder="Add a label" title="' + esc(r.label) + '">' + esc(r.label) + '</textarea></div></th>' +
        '<td data-outcome="N">' + esc(r.N) + '</td><td data-outcome="perm">' + esc(r.perm) + '%</td><td data-outcome="zc">' + esc(r.zc) + '%</td></tr>'
      ).join('') + '</tbody></table>';
    const extra = L.TRIAL_COLUMNS.filter(c => !['n', 'label', 'N', 'perm', 'zc'].includes(c.key));
    list.innerHTML = '<p class="small">Winter fire chance is the modeled chance that a fire survives the winter.</p>' +
      data.map(r => '<article class="trial-detail-card"><h3>Trial ' + r.n + (r.label ? ' · ' + esc(r.label) : '') + '</h3>' +
        '<dl>' + extra.map(c => '<dt>' + esc(c.label) + '</dt><dd data-trial-detail="' + c.key + '">' + esc(r[c.key]) + '</dd>').join('') + '</dl></article>').join('');
  }
  function renderStudent() {
    const st = reportIdentity(preservedSave);
    byId('trial-student').textContent = st?.name
      ? 'Student: ' + st.name + (st.period ? ' · Class period: ' + st.period : '')
      : 'No verified student name for this copy.';

  }
  function recordTrial(source) {
    const label = state.trialLabel.trim() || L.autoLabel(state.S, source);
    state.trials.push(Object.assign({}, state.S, { id: nextId++, label: label, at: Date.now() }));
    renderLog();
    const saved = save();
    const warning = saved ? '' : ' Only in this tab; download a copy before reloading.';
    byId('logStatus').textContent = 'Recorded trial ' + state.trials.length + ': ' + label + '.' + warning;
    flash((saved ? 'Saved as trial ' : 'Recorded in this tab as trial ') + state.trials.length +
      (source === 'zombie' ? ' (' + label + '). Open My trials to see it.' : '.') + warning);
  }
  function wireTrials() {
    const input = byId('trialLabel'); input.value = state.trialLabel;
    input.addEventListener('input', function () { state.trialLabel = input.value.slice(0, 60); save(); });
    byId('record').addEventListener('click', function () { recordTrial('table'); });
    byId('record-bog').addEventListener('click', function () { recordTrial('bog'); });
    byId('record-zombie').addEventListener('click', function () { recordTrial('zombie'); });
    byId('reset-bog').addEventListener('click', bogReset);
    byId('logWrap').addEventListener('input', function (e) {
      if (e.target.matches('.lbl-input')) e.target.previousElementSibling.textContent = e.target.value;
    });
    byId('logWrap').addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.matches('.lbl-input')) { e.preventDefault(); e.target.blur(); } });
    byId('logWrap').addEventListener('change', function (e) {
      if (!e.target.matches('.lbl-input')) return;
      state.trials[+e.target.dataset.i].label = e.target.value.replace(/\s+/g, ' ').trim().slice(0, 60);
      const saved = save(); renderLog();
      const message = saved ? 'Label saved.' : 'Label changed in this tab only. Download a copy before reloading.';
      byId('logStatus').textContent = message; announce(message);
    });
    byId('undo').addEventListener('click', function () {
      if (!state.trials.length) return;
      const gone = state.trials.pop(); renderLog(); save(); byId('logStatus').textContent = 'Removed trial ' + (state.trials.length + 1) + '.'; announce('Removed the last trial.');
      void gone;
    });
    byId('copy').addEventListener('click', function () {
      if (!state.trials.length) { byId('logStatus').textContent = 'Record at least one trial before copying.'; return; }
      const txt = [L.TRIAL_COLUMNS.map(function (c) { return c.label; }).join('\t')].concat(state.trials.map(function (t, i) { const r = L.trialRow(t, i + 1); return L.TRIAL_COLUMNS.map(function (c) { return r[c.key]; }).join('\t'); })).join('\n');
      const manual = byId('copy-trials-fallback');
      const fallback = function () {
        const box = byId('copy-trials-text');
        box.value = txt; manual.hidden = false; box.focus(); box.select();
        byId('logStatus').textContent = 'Full trial data selected. Use your device’s copy command, or download the CSV here.';
        announce('Full trial data selected. Use your copy command or download the CSV.');
      };
      try { navigator.clipboard.writeText(txt).then(function () { manual.hidden = true; byId('logStatus').textContent = 'Copied. Paste it into a spreadsheet or document.'; announce('Copied the table.'); }, fallback); } catch (e) { fallback(); }
    });
    byId('download-csv').addEventListener('click', function () {
      if (!state.trials.length) { byId('logStatus').textContent = 'Record at least one trial before downloading.'; return; }
      saveFile('peat-bog-trials-simulated.csv', '﻿' + L.csv(state.trials), 'text/csv;charset=utf-8');
      byId('logStatus').textContent = 'Downloaded peat-bog-trials-simulated.csv. Look in your Downloads folder.'; announce('Downloaded the table.');
    });
  }
  function saveFile(name, text, type) {
    const url = URL.createObjectURL(new Blob([text], { type: type }));
    const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  /* ---------- download, print, clear ---------- */
  function payload() {
    const m = L.model(state.S), who = reportIdentity(preservedSave);
    return { format: 'openscied-b2-peat-bog-lab-progress-v1', exportedAt: new Date().toISOString(), student: who, datasetId: window.Lab && Lab.identity && Lab.identity.datasetId ? Lab.identity.datasetId : null,
      dataNote: 'ALL NUMBERS IN THIS FILE ARE SIMULATED. Rates use a 0-100 teaching scale and are not measurements. The model is a simplified teaching model, not a forecast. This file can include the student name and class period. Share it only as your teacher directs.',
      settings: state.S, climate: state.climate, climateTests: state.climateTests, graphAnswer: state.graphAnswer, current: { photosynthesis: Math.round(m.P), decomposition: Math.round(m.D), burning: Math.round(m.B), peatCarbon: Math.round(m.N), permafrostPercent: Math.round(m.perm * 100) },
      trials: state.trials.map(function (t, i) { const r = L.trialRow(t, i + 1); return { trial: i + 1, label: r.label, inputs: { tilt: t.tilt, temp: t.temp, co2: t.co2, o2: t.o2, wet: t.wet, burn: t.burn }, outputs: L.trialOutputs(t), recordedAt: t.at ? new Date(t.at).toISOString() : null, simulated: true }; }),
      source: 'Peat Bog Carbon Lab, OpenSciEd Unit B.2 companion, https://biologylabbench.com/openscied-b2-peat-bog-lab' };
  }
  function classroomReport() {
    const data = payload(), trials = data.trials, missing = [], sections = [];
    if (trials.length < 2) missing.push('Record a baseline and a comparison trial in My trials.');
    else if (!trials.some(t => L.VARS.some(v => t.inputs[v.key] !== trials[0].inputs[v.key]))) {
      missing.push('Change a setting and record another trial so you can compare the outcomes.');
    }
    const answer = typeof data.graphAnswer === 'string' ? data.graphAnswer.trim() : '';
    if (!answer) missing.push('Answer the question in Test one variable with evidence from the graph.');
    else sections.push({ title: 'Test one variable', items: [{
      type: 'answer', prompt: 'What changed when you tested one variable?', value: answer
    }] });
    if (trials.length) {
      const table = (title, columns, rows) => ({ type: 'table', title, columns, rows });
      sections.push({ title: 'Recorded trials · simulated', items: [
        table('Trial setup', ['Trial', 'Label', 'Tilt (°)', 'Temperature control (°C)', 'CO₂ (ppm)'],
          trials.map(t => [t.trial, t.label, t.inputs.tilt, t.inputs.temp, t.inputs.co2])),
        table('Trial setup continued', ['Trial', 'Air oxygen (%)', 'Water level (%)', 'Burning setting (%)', 'Peat oxygen (%)'],
          trials.map(t => [t.trial, t.inputs.o2, t.inputs.wet, t.inputs.burn, t.outputs.peatO2])),
        table('Modeled rates (teaching scale, 0–100)', ['Trial', 'Summer temperature with tilt (°C)', 'Photosynthesis', 'Decomposition', 'Burning'],
          trials.map(t => [t.trial, t.outputs.Teff, t.outputs.P, t.outputs.D, t.outputs.B])),
        table('Modeled outcomes', ['Trial', 'Net peat carbon (model units)', 'Peat frozen (%)', 'Winter fire survival chance (%)'],
          trials.map(t => [t.trial, t.outputs.N, t.outputs.perm, t.outputs.zc]))
      ] });
    }
    if (state.warmingUsed) {
      const c = data.climate, rows = L.climate(c.fossil, c.forest);
      const columns = ['Year', 'Fossil fuel input (Gt C/year)', 'Forests and peatlands (% of today)', 'Atmospheric CO₂ (ppm)', 'Modeled warming (°C)'];
      const tableRow = (x, row) => [row.y, x.fossil, x.forest, +row.C.toFixed(1), +row.T.toFixed(2)];
      const compare = rows.filter(row => [2050, 2100, c.year].includes(row.y)).map(row => tableRow(c, row));
      const tested = (data.climateTests || []).map(x => {
        const row = L.climate(x.fossil, x.forest).find(r => r.y === x.year);
        return row ? tableRow(x, row) : null;
      }).filter(Boolean);
      sections.push({ title: 'Current climate scenario · simulated', items: [{
        type: 'table', title: 'Current settings: benchmark years and selected year', columns, rows: compare
      }, ...(tested.length ? [{ type: 'table', title: 'Scenarios sent to the bog', columns, rows: tested }] : [])] });
    }
    const last = trials.at(-1);
    return {
      title: 'Peat Bog Carbon Lab', unit: 'Unit 2',
      source: 'Simulated bog teaching model for OpenSciEd Unit B.2. Rates use a 0–100 teaching scale, not measurements or forecasts.',
      status: preservedSave || !saveSession?.check(KEY).ok ? 'recovery' : missing.length ? 'draft' : 'final',
      missing, student: data.student, keyResults: [{ label: 'Simulated trials recorded', value: trials.length },
        ...(last ? [{ label: 'Latest trial: frozen peat', value: last.outputs.perm, unit: '%' },
          { label: 'Latest trial: chance the fire survives winter', value: last.outputs.zc, unit: '%' }] : [])], sections
    };
  }
  function download() { saveFile('peat-bog-lab-work-simulated.json', JSON.stringify(payload(), null, 2), 'application/json'); byId('save-status').textContent = 'Downloaded peat-bog-lab-work-simulated.json.'; announce('Downloaded your work.'); }
  // Same rule as the other companions: clear this activity's record, then reload fresh at the Overview. Name and class period stay saved.
  function clearActivity() {
    const result = saveSession?.reset(KEY);
    if (!result?.ok) { byId('reset-dialog').close(); showSaveConflict(result); return; }
    cleared = true;
    try { history.replaceState(null, '', location.pathname + location.search + '#overview'); } catch (e) { /* ignore */ }
    location.reload();
  }

  /* ---------- enlarged pictures: the same drawing, scaled to fit the whole window ---------- */
  const PIC_TITLES = { bog: 'The bog', zombie: 'Zombie fires', gh: 'Greenhouse effect' };
  function wireEnlarge() {
    const dlg = byId('enlarge-dialog'), body = byId('enlarge-body');
    let home = null, holder = null, opener = null;
    function close() { if (dlg.open) dlg.close(); }
    dlg.addEventListener('close', function () {
      if (holder && home && holder.parentNode) { holder.parentNode.insertBefore(home, holder); holder.remove(); }
      holder = null; home = null; kick();
      if (opener && opener.focus) opener.focus();
    });
    byId('enlarge-close').addEventListener('click', close);
    dlg.addEventListener('click', function (e) { if (e.target === dlg) close(); });
    $$('[data-enlarge]').forEach(function (b) {
      b.addEventListener('click', function () {
        const svg = byId(b.dataset.enlarge + '-svg'); home = svg.closest('.pic-scroll'); opener = b;
        holder = document.createComment('picture'); home.parentNode.insertBefore(holder, home);
        body.appendChild(home); byId('enlarge-title').textContent = PIC_TITLES[b.dataset.enlarge] || 'Picture';
        dlg.showModal(); kick();
      });
    });
  }

  /* ---------- info buttons ---------- */
  function closeTips(except) {
    $$('.info[aria-expanded="true"]').forEach(function (b) {
      if (b === except) return;
      b.setAttribute('aria-expanded', 'false'); const t = byId(b.getAttribute('aria-controls')); if (t) t.hidden = true;
    });
  }
  document.addEventListener('click', function (e) {
    const b = e.target.closest && e.target.closest('.info'); if (!b) return;
    const t = byId(b.getAttribute('aria-controls')), open = b.getAttribute('aria-expanded') !== 'true';
    closeTips(b); b.setAttribute('aria-expanded', String(open)); if (t) t.hidden = !open;
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeTips(null); });

  /* ---------- layout helpers ---------- */
  function measureNav() { const n = $('.step-nav'); if (n) document.documentElement.style.setProperty('--navh', Math.round(n.getBoundingClientRect().height) + 'px'); }
  function numbarWatch() {
    if (!('IntersectionObserver' in window)) return;
    let ctrlIn = false, metersIn = false;
    const bar = byId('numbar');
    const sync = function () { bar.hidden = !(ctrlIn && !metersIn && matchMedia('(max-width: 900px)').matches); document.body.classList.toggle('numbar-on', !bar.hidden); };
    new IntersectionObserver(function (es) { es.forEach(function (e) { ctrlIn = e.isIntersecting; }); sync(); }).observe(byId('controls'));
    new IntersectionObserver(function (es) { es.forEach(function (e) { metersIn = e.isIntersecting; }); sync(); }, { threshold: 0.6 }).observe(byId('meters'));
    window.addEventListener('resize', sync);
  }
  function redrawCharts() { if (!ready) return; drawExplore(); drawClimateCharts(rows[state.climate.year - L.Y0]); }
  function resumeBar() {
    const bar = byId('resume-bar');
    if (location.hash || state.lastSection === 'overview' || !hadSaved) { bar.hidden = true; return; }
    const target = byId(state.lastSection); if (!target) return;
    const a = $('a', bar); a.href = '#' + state.lastSection; a.textContent = 'Resume: ' + target.dataset.step; bar.hidden = false;
  }

  /* ---------- wiring ---------- */
  function wire() {
    readStore();
    if (preservedSave) {
      const notice = document.getElementById('save-conflict');
      notice.textContent = 'An unreadable save was kept. Download it from the dashboard before clearing it. Download any new work from this tab before reloading.';
      notice.hidden = false;
    }
    buildSliders(); buildExplore(); buildBog(); wireZombie(); wireClimate(); wireTrials(); wireEnlarge();
    const graphAnswer = byId('graph-answer');
    if (graphAnswer) {
      graphAnswer.value = state.graphAnswer;
      graphAnswer.addEventListener('input', function () { state.graphAnswer = graphAnswer.value.slice(0, 4000); save(); });
    }
    byId('motion-btn').addEventListener('click', function () { state.motionPaused = !state.motionPaused; syncMotionButton(); kick(); save(); announce(state.motionPaused ? 'Motion paused.' : 'Motion playing.'); });
    syncMotionButton();
    if (motionQuery && motionQuery.addEventListener) motionQuery.addEventListener('change', function () { syncMotionButton(); placeDots(); kick(); });
    update(); updateClimate(); renderLog(); renderStudent(); resumeBar();
    ready = true;
    measureNav(); if ('ResizeObserver' in window) { const n = $('.step-nav'); if (n) new ResizeObserver(measureNav).observe(n); }
    numbarWatch();
    document.addEventListener('companion:show', function () { measureNav(); redrawCharts(); placeDots(); kick(); renderStudent(); });
    window.addEventListener('hashchange', function () { if (hadSaved) save(); kick(); });
    document.addEventListener('visibilitychange', kick);
    let pending = 0;
    window.addEventListener('resize', function () { cancelAnimationFrame(pending); pending = requestAnimationFrame(function () { redrawCharts(); measureNav(); }); }, { passive: true });
    new MutationObserver(function () { redrawCharts(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    window.OpenSciEdSubmission?.mount({ target: '#classroom-submission', collect: classroomReport });
    byId('download-work').addEventListener('click', download);
    byId('print-work').addEventListener('click', function () { renderStudent(); window.print(); });
    const trialDetails = byId('trial-details');
    let wasDetailsOpen;
    window.addEventListener('beforeprint', function () {
      renderStudent();
      if (wasDetailsOpen === undefined) wasDetailsOpen = trialDetails.open;
      if (!trialDetails.hidden) trialDetails.open = true;
    });
    window.addEventListener('afterprint', function () {
      if (wasDetailsOpen !== undefined) trialDetails.open = wasDetailsOpen;
      wasDetailsOpen = undefined;
    });
    const dialog = byId('reset-dialog');
    byId('reset-work').addEventListener('click', function () { dialog.showModal(); });
    byId('cancel-reset').addEventListener('click', function () { dialog.close(); });
    byId('confirm-reset').addEventListener('click', clearActivity);
    // A test hook, like the other companions: read-only access to the model and the page state.
    window.B2Peat = { state: state, logic: L, setState: setState, record: recordTrial, announce: announce, current: function () { return cur; } };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire); else wire();
})();
