/* Investigation planner (OpenSciEd B.3 Lesson 9 companion, host #planner-scene, scene id "planner").
   Students plan the virtual yeast UV test with taps only: what they change, what they measure, which yeast, what stays the same,
   a table of dishes (the handout's "Group / Environmental conditions / Exposure to light" table), live fair-test checks, and a
   prediction for each dish. The plan is saved to state.planner and the virtual yeast scene (yeast-uv-scene.js) uses it for its dishes.

   WHAT IT MODELS / ASSUMES (the page says the same under "What this simulation models"):
   - The class table in the Teacher Edition: groups 1-7 are no SPF, SPF 15, 18, 20, 30, 50 and no SPF under foil, 15 minutes each, with one
     dish kept in the dark as the control and wild-type yeast run in parallel. The handout has room for 10 groups, so the plan holds up to 10 dishes.
   - "Cover" (sunscreen SPF or foil) counts as ONE variable, because it is one thing that changes how much UV reaches the yeast; UV time is the other.
     Checks look only at UV dishes: the dark dish is the control, not a test dish.
   - The checks are about the design (one change, a dark control, an unprotected comparison dish, repeats, what is held constant). They never
     score the science of a prediction; they only point out when a prediction goes against the cause the student chose.
   - Everything here is a plan for a SIMULATED experiment. No free text: all choices are taps, toggles and menus.
   Pure logic (checks, presets, hints) is exported for node tests. Saved: api.saveState('planner', { conditions, controls, iv, dv, strainMode, ready }). */
(function (root, factory) {
  const m = factory();
  if (typeof module === 'object' && module.exports) module.exports = m;
  else { root.InvestigationPlanner = m; (root.B3InhScenes = root.B3InhScenes || []).push({ id: 'planner', mount: m.mount }); }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const MAX = 10, SPFS = [15, 18, 20, 30, 50], TIMES = [5, 10, 15, 20, 30, 60];
  const IVS = { spf: 'The SPF number', foil: 'Foil on or off', time: 'Time under UV' };
  const DVS = { colonies: 'Colonies counted', survival: 'Survival (share of the dark dish)', growth: 'Growth rating' };
  const STRAINS = { sensitive: 'UV-sensitive', wild: 'Wild-type', both: 'Both, side by side' };
  const HELD = [
    { id: 'yeast', label: 'Kind and amount of yeast', needed: true },
    { id: 'distance', label: 'Distance from the lamp', needed: true },
    { id: 'days', label: 'Days of growing', needed: true },
    { id: 'agar', label: 'Dish and food (agar)', needed: true },
    { id: 'time', label: 'UV time', needed: 'unless time' },
    { id: 'cover', label: 'Cover (sunscreen or foil)', needed: 'unless cover' }
  ];
  const REASONS = ['No UV, so no new damage', 'The cover blocks UV', 'More UV, more DNA damage', 'These yeast cannot repair UV damage', 'Wild-type can repair its DNA', 'Not sure yet'];
  const num = x => typeof x === 'number' && isFinite(x);

  /* ---------- conditions ---------- */
  function coverKey(c) { return c.foil ? 'foil' : num(c.spf) && c.spf > 0 ? 'spf' + c.spf : 'none'; }
  function coverName(c) { return c.foil ? 'Foil cover' : num(c.spf) && c.spf > 0 ? 'SPF ' + c.spf : 'No sunscreen'; }
  function labelFor(c) { return c.dark ? 'Dark control' : coverName(c) + ', ' + c.minutes + ' min'; }
  function normalizeCondition(raw, i) {
    if (!raw || typeof raw !== 'object') return null;
    const dark = !!raw.dark, foil = !dark && !!raw.foil;
    const spf = !dark && !foil && num(raw.spf) && raw.spf > 0 ? Math.round(raw.spf) : null;
    const minutes = dark ? 0 : (num(raw.minutes) && raw.minutes > 0 ? Math.min(120, Math.round(raw.minutes)) : 15);
    const c = { group: i + 1, label: '', spf, foil, dark, minutes, strain: raw.strain === 'wild' ? 'wild' : 'sensitive' };
    c.label = labelFor(c);
    if (raw.predict && typeof raw.predict === 'object') c.predict = { dir: ['more', 'fewer', 'same'].includes(raw.predict.dir) ? raw.predict.dir : '', why: typeof raw.predict.why === 'string' ? raw.predict.why.slice(0, 60) : '' };
    return c;
  }
  function normalizeConditions(list, strainMode) {
    return (Array.isArray(list) ? list : []).slice(0, MAX).map(normalizeCondition).filter(Boolean).map(function (c, i) {
      c.group = i + 1; c.strain = strainMode === 'wild' ? 'wild' : 'sensitive'; return c;
    });
  }
  const mk = (cover, minutes) => ({ spf: /^spf/.test(cover) ? +cover.slice(3) : null, foil: cover === 'foil', dark: cover === 'dark', minutes: minutes });
  function preset(name) {
    let list;
    if (name === 'class') list = [mk('dark', 0), mk('none', 15), mk('spf15', 15), mk('spf18', 15), mk('spf20', 15), mk('spf30', 15), mk('spf50', 15), mk('foil', 15)];
    else if (name === 'time') list = [mk('dark', 0), mk('none', 5), mk('none', 10), mk('none', 15), mk('none', 30), mk('none', 15)];
    else if (name === 'foil') list = [mk('dark', 0), mk('none', 15), mk('foil', 15), mk('none', 15), mk('foil', 15)];
    else list = [];
    const iv = name === 'class' ? 'spf' : name === 'time' ? 'time' : name === 'foil' ? 'foil' : '';
    return { conditions: normalizeConditions(list, 'sensitive'), iv, dv: iv ? 'colonies' : '', strainMode: iv ? 'both' : 'sensitive' };
  }

  /* ---------- fair-test logic ---------- */
  function varying(conds) {
    const tests = conds.filter(c => !c.dark);
    const cov = new Set(tests.map(coverKey)), tm = new Set(tests.map(c => c.minutes));
    const names = [];
    if (cov.size > 1) names.push('the cover');
    if (tm.size > 1) names.push('UV time');
    return { cover: cov.size > 1, time: tm.size > 1, names };
  }
  function repeats(conds) {
    const n = {}; conds.forEach(c => { const k = coverKey(c) + '|' + c.minutes + '|' + c.dark; n[k] = (n[k] || 0) + 1; });
    return Object.keys(n).filter(k => n[k] > 1).length;
  }
  function neededHeld(iv) { return HELD.filter(h => h.needed === true || (h.needed === 'unless time' && iv !== 'time') || (h.needed === 'unless cover' && iv === 'time')).map(h => h.id); }
  /* plan = { conditions, iv, dv, strainMode, controls }. Returns [{ id, level:'ok'|'warn'|'tip', text }]. */
  function checkPlan(plan) {
    plan = plan || {};
    const c = normalizeConditions(plan.conditions, plan.strainMode), tests = c.filter(x => !x.dark), out = [];
    const add = (id, level, text) => out.push({ id, level, ok: level === 'ok', text });
    const iv = plan.iv, v = varying(c);
    if (c.length < 2) add('enough', 'warn', 'Add at least two dishes, so there is something to compare.');
    else add('enough', 'ok', c.length + ' dishes in the plan.');
    if (!iv) add('iv', 'warn', 'Tap what you change.');
    else if (tests.length < 2) add('iv', 'warn', 'Add UV dishes that differ in the one thing you change.');
    else if (v.names.length > 1) add('iv', 'warn', 'Two things change at once: ' + v.names.join(' and ') + '. Then you cannot tell which one made the difference. Change just one.');
    else if (v.names.length === 0) add('iv', 'warn', 'All your UV dishes are set up the same, so there is nothing to compare. Change one thing.');
    else if (iv === 'time' && !v.time) add('iv', 'warn', 'You said you change UV time, but every dish gets the same time. The cover changes instead.');
    else if (iv !== 'time' && !v.cover) add('iv', 'warn', 'You said you change the cover, but every dish gets the same cover. UV time changes instead.');
    else if (iv === 'spf' && new Set(tests.filter(x => !x.foil).map(coverKey)).size < 2) add('iv', 'warn', 'To test the SPF number, use at least two different SPF settings (no sunscreen counts as one).');
    else if (iv === 'foil' && !(tests.some(x => x.foil) && tests.some(x => !x.foil))) add('iv', 'warn', 'To test foil, include one dish with foil and one without.');
    else add('iv', 'ok', 'Only one thing changes (' + v.names[0] + '). That makes it a fair test.');
    if (!plan.dv) add('dv', 'warn', 'Tap what you measure.');
    else add('dv', 'ok', 'You measure: ' + DVS[plan.dv].toLowerCase() + '.');
    if (c.some(x => x.dark)) add('dark', 'ok', 'A dark dish shows what the yeast do with no UV.');
    else add('dark', 'warn', 'No dark control. Add one, so you know UV (not the heat or the dish) caused any change.');
    if (iv !== 'time') {
      if (tests.some(x => coverKey(x) === 'none')) add('base', 'ok', 'An unprotected UV dish is there to compare against.');
      else if (tests.length) add('base', 'warn', 'No unprotected UV dish. Add a dish with no cover, to see what UV does on its own.');
    }
    if (c.length >= 2 && !repeats(c)) add('repeat', 'warn', 'No repeats. Repeat one dish: real dishes vary a little, and a repeat shows how much.');
    else if (c.length >= 2) add('repeat', 'ok', 'You repeated a dish, so you can see how much identical dishes vary.');
    if (plan.strainMode === 'sensitive' || !plan.strainMode) add('strain', 'tip', 'Tip: add wild-type yeast too. If the wild-type dishes survive UV, you know the lamp is not simply killing every yeast.');
    else if (plan.strainMode === 'wild') add('strain', 'tip', 'Tip: wild-type yeast repair UV damage, so changes may be small. UV-sensitive yeast show more.');
    const held = Array.isArray(plan.controls) ? plan.controls : [], need = neededHeld(iv), missing = need.filter(id => !held.includes(id));
    const wrong = held.filter(id => !need.includes(id) && HELD.some(h => h.id === id));
    const nm = id => HELD.find(h => h.id === id).label.toLowerCase();
    if (wrong.length) add('held', 'warn', 'You change ' + (iv === 'time' ? 'UV time' : 'the cover') + ', so it cannot stay the same in every dish.');
    else if (!held.length) add('held', 'warn', 'Tap what must stay the same in every dish.');
    else if (missing.length) add('held', 'warn', 'Still to keep the same: ' + missing.map(nm).join(', ') + '.');
    else add('held', 'ok', 'Everything else is kept the same.');
    return out;
  }
  const isReady = checks => checks.every(x => x.level !== 'warn');

  /* ---------- predictions ---------- */
  function referenceIndex(conds) {
    let best = -1;
    conds.forEach((c, i) => { if (!c.dark && coverKey(c) === 'none' && (best < 0 || c.minutes > conds[best].minutes)) best = i; });
    if (best < 0) conds.forEach((c, i) => { if (best < 0 && !c.dark) best = i; });
    return best;
  }
  function strength(c) { return c.dark || c.foil ? 0 : (num(c.spf) && c.spf > 0 ? 1 / c.spf : 1) * c.minutes; }
  /* The direction that the causal story (not the numbers) points to, comparing a dish with the reference dish. */
  function expectedDirection(c, ref) {
    if (!c || !ref || c === ref) return null;
    if (c.strain === 'wild' && ref.strain !== 'wild') return 'more';
    const a = strength(c), b = strength(ref);
    if (a < b * 0.8) return 'more';
    if (a > b * 1.25) return 'fewer';
    return 'same';
  }
  function predictionHint(c, ref) {
    const want = expectedDirection(c, ref); if (!want || !c.predict || !c.predict.dir) return '';
    if (c.predict.dir === want) return 'Good thinking. The dishes will show if it holds.';
    const why = c.dark ? 'with no UV there is no new DNA damage' : c.foil ? 'foil blocks the UV' : c.spf ? 'sunscreen lets less UV through' : want === 'fewer' ? 'more UV time means more DNA damage' : 'less UV time means less damage';
    return 'Think again: ' + why + '.';
  }

  /* ---------- the scene ---------- */
  function mount(host, api) {
    const doc = host.ownerDocument || document;
    const canvas = host.querySelector('canvas'), desc = host.querySelector('.scene-desc');
    if (!canvas) throw new Error('planner needs a canvas');
    if (!doc.getElementById('planner-scene-css')) { const st = doc.createElement('style'); st.id = 'planner-scene-css'; st.textContent = CSS; doc.head.appendChild(st); }
    const saved = api.getState().planner || {};
    let strainMode = ['sensitive', 'wild', 'both'].includes(saved.strainMode) ? saved.strainMode : 'sensitive';
    let iv = IVS[saved.iv] ? saved.iv : '', dv = DVS[saved.dv] ? saved.dv : '';
    let conds = normalizeConditions(saved.conditions, strainMode);
    let held = Array.isArray(saved.controls) ? saved.controls.filter(id => HELD.some(h => h.id === id)) : [];
    let touched = !!(saved.conditions && saved.conditions.length), lastSummary = '', announceTimer = 0;

    function h(tag, attrs, ...kids) {
      const e = doc.createElement(tag);
      Object.keys(attrs || {}).forEach(k => { if (k === 'text') e.textContent = attrs[k]; else if (attrs[k] === true) e.setAttribute(k, ''); else if (attrs[k] !== false && attrs[k] != null) e.setAttribute(k, attrs[k]); });
      [].concat(...kids).forEach(x => { if (x != null) e.appendChild(typeof x === 'string' ? doc.createTextNode(x) : x); });
      return e;
    }
    const ui = h('div', { class: 'pl-ui' });
    host.insertBefore(ui, desc || null);
    canvas.setAttribute('role', 'img');

    function toggleGroup(label, options, current, onPick, extraClass) {
      const g = h('div', { class: 'pl-group ' + (extraClass || ''), role: 'group', 'aria-label': label }, h('span', { class: 'pl-legend', text: label }));
      const row = h('div', { class: 'pl-chips' });
      Object.keys(options).forEach(k => {
        const on = current === k;
        const b = h('button', { type: 'button', class: 'pl-chip', 'aria-pressed': on ? 'true' : 'false', 'data-k': k }, h('span', { class: 'pl-tick', 'aria-hidden': 'true', text: on ? '✓' : '' }), options[k]);
        b.addEventListener('click', () => onPick(k)); row.appendChild(b);
      });
      g.appendChild(row); return g;
    }
    function render(focusSel) {
      const keep = focusSel || (doc.activeElement && ui.contains(doc.activeElement) ? selectorFor(doc.activeElement) : '');
      const scrollY = root_scroll();
      ui.textContent = '';
      // 1. starters
      const starters = h('div', { class: 'pl-group' }, h('span', { class: 'pl-legend', text: 'Start from' }));
      const sr = h('div', { class: 'pl-chips' });
      [['class', 'The class set (SPF)'], ['time', 'A UV time test'], ['foil', 'A foil test'], ['clear', 'Empty plan']].forEach(p => {
        const b = h('button', { type: 'button', class: 'pl-chip', 'data-starter': p[0], text: p[1] }); b.addEventListener('click', () => applyPreset(p[0])); sr.appendChild(b);
      });
      starters.appendChild(sr); ui.appendChild(starters);
      // 2. question taps
      ui.appendChild(toggleGroup('I change', IVS, iv, k => { iv = k; held = held.filter(x => x !== 'time' && x !== 'cover'); change('You change ' + IVS[k].toLowerCase() + '.', '[data-k="' + k + '"]'); }));
      ui.appendChild(toggleGroup('I measure', DVS, dv, k => { dv = k; change('You measure ' + DVS[k].toLowerCase() + '.', '[data-k="' + k + '"]'); }));
      ui.appendChild(toggleGroup('Yeast', STRAINS, strainMode, k => { strainMode = k; conds.forEach(c => { c.strain = k === 'wild' ? 'wild' : 'sensitive'; }); change('Yeast: ' + STRAINS[k].toLowerCase() + '.', '[data-k="' + k + '"]'); }));
      const q = api.getQuestion && api.getQuestion();
      if (q && q.ok && q.text) ui.appendChild(h('p', { class: 'pl-q', text: 'Your question: ' + q.text }));
      // 3. plan table
      const tbl = h('div', { class: 'pl-plan', role: 'table', 'aria-label': 'Plan: one row per dish' });
      tbl.appendChild(h('div', { class: 'pl-head', role: 'row' }, ['Dish', 'Cover', 'UV time', 'Actions'].map(t => h('span', { role: 'columnheader', text: t }))));
      conds.forEach((c, i) => {
        const cover = h('select', { 'aria-label': 'Dish ' + c.group + ' cover', 'data-f': 'cover' + i });
        [['none', 'No sunscreen']].concat(SPFS.map(s => ['spf' + s, 'SPF ' + s]), [['foil', 'Foil cover']]).forEach(o => { const op = h('option', { value: o[0], text: o[1] }); if (!c.dark && coverKey(c) === o[0]) op.selected = true; cover.appendChild(op); });
        cover.disabled = c.dark;
        const time = h('select', { 'aria-label': 'Dish ' + c.group + ' UV time', 'data-f': 'time' + i });
        const dk = h('option', { value: 'dark', text: 'Dark (no UV)' }); if (c.dark) dk.selected = true; time.appendChild(dk);
        TIMES.forEach(t => { const op = h('option', { value: String(t), text: t + ' min' }); if (!c.dark && c.minutes === t) op.selected = true; time.appendChild(op); });
        cover.addEventListener('change', () => { const m = mk(cover.value, c.minutes || 15); c.spf = m.spf; c.foil = m.foil; c.minutes = c.minutes || 15; c.label = labelFor(c); change('Dish ' + c.group + ': ' + coverName(c) + '.', '[data-f="cover' + i + '"]'); });
        time.addEventListener('change', () => { if (time.value === 'dark') { c.dark = true; c.spf = null; c.foil = false; c.minutes = 0; } else { c.dark = false; c.minutes = +time.value; } c.label = labelFor(c); change('Dish ' + c.group + ': ' + (c.dark ? 'dark' : c.minutes + ' minutes') + '.', '[data-f="time' + i + '"]'); });
        const rep = h('button', { type: 'button', class: 'pl-icon', 'aria-label': 'Repeat dish ' + c.group, title: 'Repeat this dish', 'data-f': 'rep' + i, text: '⧉ Repeat' });
        rep.disabled = conds.length >= MAX;
        rep.addEventListener('click', () => { conds.splice(i + 1, 0, normalizeCondition(c, i)); renumber(); change('Dish repeated. ' + conds.length + ' dishes.', '[data-f="rep' + i + '"]'); });
        const del = h('button', { type: 'button', class: 'pl-icon', 'aria-label': 'Remove dish ' + c.group, title: 'Remove this dish', 'data-f': 'del' + i, text: '✕ Remove' });
        del.addEventListener('click', () => { conds.splice(i, 1); renumber(); change('Dish removed. ' + conds.length + ' dishes.', conds.length ? '[data-f="del' + Math.min(i, conds.length - 1) + '"]' : '[data-add]'); });
        tbl.appendChild(h('div', { class: 'pl-row' + (c.dark ? ' is-dark' : ''), role: 'row' },
          h('span', { class: 'pl-num', role: 'rowheader', text: 'Dish ' + c.group }), h('span', { role: 'cell' }, cover), h('span', { role: 'cell' }, time), h('span', { class: 'pl-act', role: 'cell' }, rep, del)));
      });
      ui.appendChild(tbl);
      const add = h('button', { type: 'button', class: 'btn pl-add', 'data-add': '1', text: '+ Add a dish' }); add.disabled = conds.length >= MAX;
      add.addEventListener('click', () => { conds.push(normalizeCondition(mk('none', 15), conds.length)); renumber(); change('Dish added. ' + conds.length + ' dishes.', '[data-add]'); });
      ui.appendChild(h('div', { class: 'pl-addrow' }, add, h('span', { class: 'pl-muted', text: conds.length + ' of ' + MAX + ' dishes' })));
      // 4. keep the same
      const hg = h('div', { class: 'pl-group', role: 'group', 'aria-label': 'Keep the same in every dish' }, h('span', { class: 'pl-legend', text: 'Keep the same in every dish' }));
      const hr = h('div', { class: 'pl-chips' });
      HELD.forEach(o => {
        const on = held.includes(o.id);
        const b = h('button', { type: 'button', class: 'pl-chip', 'aria-pressed': on ? 'true' : 'false', 'data-k': 'held-' + o.id }, h('span', { class: 'pl-tick', 'aria-hidden': 'true', text: on ? '✓' : '' }), o.label);
        b.addEventListener('click', () => { held = on ? held.filter(x => x !== o.id) : held.concat(o.id); change(o.label + (on ? ' unchecked.' : ' kept the same.'), '[data-k="held-' + o.id + '"]'); });
        hr.appendChild(b);
      });
      hg.appendChild(hr); ui.appendChild(hg);
      // 5. checks
      const checks = checkPlan(plan());
      const box = h('div', { class: 'pl-checks panel' }, h('h4', { text: 'Fair-test check' }));
      const warns = checks.filter(x => x.level === 'warn').length;
      box.appendChild(h('p', { class: 'pl-summary' + (warns ? '' : ' is-ready'), text: !conds.length ? 'Pick a starter or add a dish.' : warns ? warns + (warns === 1 ? ' thing' : ' things') + ' to fix' : '✓ Your plan is a fair test. Ready for the virtual yeast.' }));
      const ul = h('ul', { class: 'pl-list' });
      checks.forEach(x => ul.appendChild(h('li', { class: 'pl-' + x.level }, h('span', { class: 'pl-glyph', 'aria-hidden': 'true', text: x.level === 'ok' ? '✓' : x.level === 'warn' ? '!' : 'i' }), h('span', { class: 'sr-only', text: x.level === 'ok' ? 'Good: ' : x.level === 'warn' ? 'Fix: ' : 'Tip: ' }), x.text)));
      box.appendChild(ul); ui.appendChild(box);
      // 6. predictions
      const refI = referenceIndex(conds);
      const pr = h('div', { class: 'pl-pred panel' }, h('h4', { text: 'Predict each dish' }), h('p', { class: 'pl-muted', text: 'Compared with the dish with no cover and the most UV' + (refI >= 0 ? ' (dish ' + conds[refI].group + ')' : '') + ': will the yeast grow more, fewer, or about the same?' }));
      conds.forEach((c, i) => {
        const card = h('div', { class: 'pl-card' }, h('strong', { class: 'pl-cardname', text: 'Dish ' + c.group + ': ' + c.label }));
        if (i === refI) card.appendChild(h('span', { class: 'pl-muted', text: 'This is the comparison dish.' }));
        else {
          const dirs = h('div', { class: 'pl-chips', role: 'group', 'aria-label': 'Dish ' + c.group + ' prediction' });
          [['more', 'More growth'], ['fewer', 'Fewer'], ['same', 'About the same']].forEach(d => {
            const on = c.predict && c.predict.dir === d[0];
            const b = h('button', { type: 'button', class: 'pl-chip pl-sm', 'aria-pressed': on ? 'true' : 'false', 'data-k': 'p' + i + d[0] }, h('span', { class: 'pl-tick', 'aria-hidden': 'true', text: on ? '✓' : '' }), d[1]);
            b.addEventListener('click', () => { c.predict = { dir: d[0], why: c.predict ? c.predict.why : '' }; change('Dish ' + c.group + ' prediction: ' + d[1].toLowerCase() + '.', '[data-k="p' + i + d[0] + '"]'); }); dirs.appendChild(b);
          });
          const why = h('select', { 'aria-label': 'Dish ' + c.group + ' reason', 'data-f': 'why' + i });
          why.appendChild(h('option', { value: '', text: 'Because…' }));
          REASONS.forEach(r => { const op = h('option', { value: r, text: r }); if (c.predict && c.predict.why === r) op.selected = true; why.appendChild(op); });
          why.addEventListener('change', () => { c.predict = { dir: c.predict ? c.predict.dir : '', why: why.value }; change('', '[data-f="why' + i + '"]'); });
          card.appendChild(dirs); card.appendChild(why);
          const hint = c.predict && c.predict.dir ? predictionHint(c, conds[refI]) : '';
          if (hint) card.appendChild(h('span', { class: 'pl-hint' + (/^Think/.test(hint) ? ' is-warn' : ''), text: hint }));
        }
        pr.appendChild(card);
      });
      if (!conds.length) pr.appendChild(h('p', { class: 'pl-muted', text: 'Add dishes to make predictions.' }));
      ui.appendChild(pr);
      if (keep) { const t = ui.querySelector(keep); if (t && !t.disabled) { try { t.focus({ preventScroll: true }); } catch (e) { t.focus(); } } }
      restore_scroll(scrollY);
      drawAndDescribe(checks);
    }
    function selectorFor(e) { return e.getAttribute('data-k') ? '[data-k="' + e.getAttribute('data-k') + '"]' : e.getAttribute('data-f') ? '[data-f="' + e.getAttribute('data-f') + '"]' : e.getAttribute('data-add') ? '[data-add]' : e.getAttribute('data-starter') ? '[data-starter="' + e.getAttribute('data-starter') + '"]' : ''; }
    function root_scroll() { return (doc.scrollingElement || doc.documentElement).scrollTop; }
    function restore_scroll(y) { const s = doc.scrollingElement || doc.documentElement; if (Math.abs(s.scrollTop - y) > 2) s.scrollTop = y; }
    function renumber() { conds.forEach((c, i) => { c.group = i + 1; c.strain = strainMode === 'wild' ? 'wild' : 'sensitive'; c.label = labelFor(c); }); }
    function plan() { return { conditions: conds, iv, dv, strainMode, controls: held }; }
    function applyPreset(name) {
      const p = preset(name); conds = p.conditions; iv = p.iv; dv = p.dv; strainMode = p.strainMode; conds.forEach(c => { c.strain = strainMode === 'wild' ? 'wild' : 'sensitive'; });
      held = []; change(name === 'clear' ? 'Plan cleared.' : 'Starter plan loaded: ' + conds.length + ' dishes. Check it, then adjust.', '[data-starter="' + name + '"]');
    }
    function change(msg, focusSel) {
      touched = true; renumber();
      const checks = checkPlan(plan());
      api.saveState('planner', { conditions: conds.map(c => Object.assign({}, c)), controls: held.slice(), iv, dv, strainMode, ready: isReady(checks) && conds.length >= 2, updatedAt: Date.now() });
      try { doc.dispatchEvent(new CustomEvent('b3:planner-changed')); } catch (e) { /* old browser */ }
      render(focusSel);
      const warns = checks.filter(x => x.level === 'warn').length, summary = (msg || '') + (conds.length ? ' ' + (warns ? warns + (warns === 1 ? ' thing' : ' things') + ' to fix.' : 'Plan is a fair test.') : '');
      clearTimeout(announceTimer); announceTimer = setTimeout(() => { if (summary.trim() && summary !== lastSummary) { lastSummary = summary; api.announce(summary.trim()); } }, 500);
    }

    /* ---------- canvas: the planned dishes ---------- */
    const css = (n, f) => getComputedStyle(doc.documentElement).getPropertyValue(n).trim() || f;
    function drawDish(ctx, cx, cy, r, c, col) {
      // glass dish: rim with a soft shadow, agar disc with a faint sheen
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.28)'; ctx.shadowBlur = r * 0.18; ctx.shadowOffsetY = r * 0.07;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fillStyle = col.glass; ctx.fill(); ctx.restore();
      ctx.lineWidth = Math.max(1.5, r * 0.05); ctx.strokeStyle = col.rim; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.stroke();
      const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r * 0.88); g.addColorStop(0, '#f1deaa'); g.addColorStop(1, '#dcc17f');
      ctx.beginPath(); ctx.arc(cx, cy, r * 0.86, 0, 7); ctx.fillStyle = g; ctx.fill();
      ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(120,90,30,.5)'; ctx.stroke();
      if (c.dark) { // dark box: dark disc, crescent moon and the word
        ctx.beginPath(); ctx.arc(cx, cy, r * 0.86, 0, 7); ctx.fillStyle = 'rgba(8,12,30,.82)'; ctx.fill();
        ctx.fillStyle = '#e9edf7'; ctx.beginPath(); ctx.arc(cx, cy - r * 0.12, r * 0.28, 0.5 * Math.PI, 1.5 * Math.PI, false); ctx.arc(cx - r * 0.1, cy - r * 0.12, r * 0.22, 1.5 * Math.PI, 0.5 * Math.PI, true); ctx.fill();
        ctx.font = '700 ' + Math.max(11, r * 0.24) + 'px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('DARK', cx, cy + r * 0.5);
        return;
      }
      if (c.foil) { // crinkled foil sheet
        const f = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r); f.addColorStop(0, '#f4f6f8'); f.addColorStop(0.5, '#aeb6bf'); f.addColorStop(1, '#e8ecef');
        ctx.beginPath(); ctx.arc(cx, cy, r * 0.9, 0, 7); ctx.fillStyle = f; ctx.fill(); ctx.strokeStyle = 'rgba(70,80,90,.55)'; ctx.lineWidth = 1;
        for (let k = 0; k < 7; k++) { ctx.beginPath(); ctx.moveTo(cx - r * 0.8 + k * r * 0.26, cy - r * 0.7); ctx.lineTo(cx - r * 0.55 + k * r * 0.2, cy + r * 0.72); ctx.stroke(); }
        ctx.fillStyle = '#26303a'; ctx.font = '700 ' + Math.max(11, r * 0.24) + 'px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('FOIL', cx, cy + r * 0.08);
      } else if (c.spf) { // translucent sunscreen film with the number
        ctx.beginPath(); ctx.arc(cx, cy, r * 0.86, 0, 7); ctx.fillStyle = 'rgba(255,255,255,' + (0.28 + Math.min(0.4, c.spf / 120)) + ')'; ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, r * 0.55, 0.3, 4.2); ctx.stroke(); ctx.beginPath(); ctx.arc(cx, cy, r * 0.3, 3, 6.6); ctx.stroke();
        ctx.fillStyle = '#2a2415'; ctx.font = '700 ' + Math.max(11, r * 0.26) + 'px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('SPF ' + c.spf, cx, cy + r * 0.09);
      } else { ctx.fillStyle = 'rgba(40,30,10,.55)'; ctx.font = '600 ' + Math.max(11, r * 0.22) + 'px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('open', cx, cy + r * 0.08); }
    }
    function drawRays(ctx, cx, top, r, col) {
      ctx.strokeStyle = col.uv; ctx.fillStyle = col.uv; ctx.lineWidth = 2;
      [-0.5, 0, 0.5].forEach(k => { const x = cx + k * r, y0 = top - r * 0.55; ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, top - 4); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x - 3.5, top - 8); ctx.lineTo(x, top - 2); ctx.lineTo(x + 3.5, top - 8); ctx.fill(); });
    }
    function drawAndDescribe(checks) {
      const w = Math.max(280, Math.floor(canvas.clientWidth || host.clientWidth || 640)), dpr = window.devicePixelRatio || 1;
      const n = conds.length, col = { glass: css('--surface', '#fff'), rim: css('--muted', '#56665f'), ink: css('--ink', '#14211c'), muted: css('--muted', '#56665f'), uv: css('--stain', '#a8326b'), bg: css('--surface-2', '#e8eeea') };
      const cols = Math.max(1, Math.min(n || 1, Math.floor(w / 92))), d = Math.min(104, Math.floor((w - 16) / cols) - 10), r = d / 2 * 0.86;
      const cellH = d + 62, rows = Math.max(1, Math.ceil(n / cols)), h2 = n ? rows * cellH + 12 : 120;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h2 * dpr); canvas.style.aspectRatio = w + ' / ' + h2; canvas.style.minHeight = '0';
      const ctx = canvas.getContext('2d'); if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.fillStyle = col.bg; ctx.fillRect(0, 0, w, h2);
      if (!n) { ctx.fillStyle = col.muted; ctx.font = '600 14px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('No dishes yet. Pick a starter plan or add a dish.', w / 2, h2 / 2); }
      conds.forEach((c, i) => {
        const gx = i % cols, gy = Math.floor(i / cols), cx = (w - cols * (d + 10)) / 2 + gx * (d + 10) + (d + 10) / 2, cy = 12 + gy * cellH + 26 + d / 2;
        if (!c.dark) drawRays(ctx, cx, cy - r, r, col);
        drawDish(ctx, cx, cy, r, c, col);
        ctx.fillStyle = col.ink; ctx.textAlign = 'center'; ctx.font = '700 12px system-ui, sans-serif'; ctx.fillText('Dish ' + c.group, cx, cy + r + 17);
        ctx.font = '12px system-ui, sans-serif'; ctx.fillStyle = col.muted; ctx.fillText(c.dark ? 'no UV' : 'UV ' + c.minutes + ' min', cx, cy + r + 32);
        if (c.dark) { ctx.fillStyle = col.muted; } // leader dot marks the dish centre for the label above
      });
      const list = conds.map(c => 'dish ' + c.group + ': ' + (c.dark ? 'dark control, no UV' : coverName(c).toLowerCase() + ', ' + c.minutes + ' minutes of UV')).join('; ');
      const fair = !checks ? '' : isReady(checks) && n >= 2 ? ' The plan passes the fair-test check.' : ' ' + checks.filter(x => x.level === 'warn').length + ' fair-test checks still need attention.';
      const text = n ? 'Plan with ' + n + ' dishes (' + STRAINS[strainMode].toLowerCase() + ' yeast): ' + list + '.' + fair : 'No dishes planned yet.';
      canvas.setAttribute('aria-label', 'Investigation planner. ' + text);
      if (desc) desc.textContent = 'Text description: ' + text;
    }

    let rafId = 0;
    const redraw = () => { cancelAnimationFrame(rafId); rafId = requestAnimationFrame(() => drawAndDescribe(checkPlan(plan()))); };
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(redraw).observe(canvas.parentElement || host);
    window.addEventListener('resize', redraw, { passive: true });
    doc.addEventListener('companion:show', redraw);
    new MutationObserver(redraw).observe(doc.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    if (window.matchMedia) { const mq = matchMedia('(prefers-color-scheme: dark)'); if (mq.addEventListener) mq.addEventListener('change', redraw); }
    render();
    if (touched) { /* restored from a saved plan: do not re-save until the student changes something */ }
  }

  const CSS = '.pl-ui{display:grid;gap:12px}.pl-group{display:grid;gap:6px;min-width:0}.pl-legend{font-weight:700}.pl-chips{display:flex;flex-wrap:wrap;gap:8px}' +
    '.pl-chip{font:inherit;font-weight:600;font-size:.9rem;min-height:40px;min-width:44px;padding:6px 12px;border:1px solid var(--line);border-radius:999px;background:var(--surface);color:var(--ink);cursor:pointer;display:inline-flex;align-items:center;gap:6px;text-align:left}' +
    '.pl-chip:hover{border-color:var(--accent)}.pl-chip[aria-pressed=true]{background:var(--accent-soft);border-color:var(--accent);color:var(--ink);box-shadow:inset 0 0 0 1px var(--accent)}.pl-tick{display:inline-block;min-width:.9em;color:var(--accent);font-weight:800}' +
    '.pl-chip.pl-sm{min-height:36px;padding:4px 10px;font-size:.86rem}.pl-q{margin:0;padding:8px 12px;border-left:4px solid var(--accent);background:var(--accent-soft);border-radius:0 var(--r-sm) var(--r-sm) 0;font-weight:600}' +
    '.pl-plan{display:grid;gap:6px}.pl-head,.pl-row{display:grid;grid-template-columns:5.5em minmax(0,1fr) minmax(0,1fr) auto;gap:8px;align-items:center}.pl-head{font-size:.82rem;font-weight:700;color:var(--muted);padding:0 8px}' +
    '.pl-row{padding:6px 8px;border:1px solid var(--line);border-radius:var(--r-sm);background:var(--surface)}.pl-row.is-dark{background:var(--surface-2);border-style:dashed}.pl-num{font-weight:700}' +
    '.pl-row select,.pl-card select{font:inherit;min-height:40px;max-width:100%;min-width:0;width:100%;border:1px solid var(--line);border-radius:var(--r-sm);background:var(--surface);color:var(--ink);padding:4px 8px}' +
    '.pl-row select:disabled{opacity:.6}.pl-act{display:flex;gap:6px}.pl-icon{font:inherit;font-size:.82rem;font-weight:600;min-height:36px;min-width:44px;padding:4px 10px;border:1px solid var(--line);border-radius:var(--r-sm);background:var(--surface);color:var(--ink);cursor:pointer;white-space:nowrap}' +
    '.pl-icon:hover:not(:disabled){border-color:var(--accent)}.pl-icon:disabled{opacity:.45;cursor:not-allowed}.pl-addrow{display:flex;flex-wrap:wrap;gap:12px;align-items:center}.pl-muted{color:var(--muted);font-size:.9rem;margin:0}' +
    '.pl-checks,.pl-pred{display:grid;gap:8px}.pl-checks h4,.pl-pred h4{margin:0}.pl-summary{margin:0;font-weight:700}.pl-summary.is-ready{color:var(--ok)}.pl-list{list-style:none;margin:0;padding:0;display:grid;gap:6px}' +
    '.pl-list li{display:flex;gap:8px;align-items:flex-start;line-height:1.4}.pl-glyph{flex:none;display:inline-grid;place-items:center;width:1.5em;height:1.5em;border-radius:50%;font:700 .82rem var(--f-mono);border:2px solid currentColor}' +
    '.pl-ok .pl-glyph{color:var(--ok)}.pl-warn .pl-glyph{color:var(--warn);border-radius:4px}.pl-tip .pl-glyph{color:var(--muted)}.pl-warn{font-weight:600}' +
    '.pl-card{display:grid;grid-template-columns:minmax(9em,13em) auto minmax(10em,16em);gap:8px 12px;align-items:center;padding:8px;border:1px solid var(--line);border-radius:var(--r-sm);background:var(--surface)}.pl-card .pl-hint{grid-column:1/-1;font-size:.9rem;color:var(--ok);font-weight:600}.pl-hint.is-warn{color:var(--warn)}' +
    '.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}.scene-host canvas{touch-action:pan-y}' +
    '@media(max-width:640px){.pl-head{display:none}.pl-row{grid-template-columns:1fr 1fr;gap:6px}.pl-num{grid-column:1/-1}.pl-act{grid-column:1/-1}.pl-card{grid-template-columns:1fr}.pl-chip{flex:1 1 auto}.pl-icon{flex:1}}';

  return { MAX, SPFS, TIMES, IVS, DVS, STRAINS, HELD, REASONS, coverKey, coverName, labelFor, normalizeCondition, normalizeConditions, preset, varying, repeats, neededHeld, checkPlan, isReady, referenceIndex, expectedDirection, predictionHint, mount };
});
