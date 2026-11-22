/* Burning Fuels: What Burns and Why: companion for OpenSciEd Unit B.2, Lesson 2 ("What is peat and why does it burn so much?").
   Light by design: tap cards and dropdown rows with instant feedback, and only three short text boxes. One saved record in localStorage, one live
   announcer, a report, a download and a "Clear this activity" dialog. Student work lives only in this browser. Every number from the burn model is
   SIMULATED (see openscied-b2-burn-logic.js for the assumptions). This page replaces the teacher's real demonstration and none of its safety steps.

   SAVED STATE (localStorage 'aplab:openscied:b2-burn-lab:v1'), format v1:
     { v:1,
       burn,                                                 written by the burn scene (contract below); null until the first burn
       fields:     { <element id, or radio name>: value }    every text box, select, checkbox, radio
       responseIds:[ ... ]                                   every answer id (radio names, text boxes, dropdowns); the dashboard counts these
       lastSection, lastVisitedAt }
   Feedback for choices is recomputed from the saved picks and the saved data on load, so it is never stale. Other companions' keys are never read or
   written here. Full contract text: docs/b2-burn-lab-scenes.md.

   SCENE STATE CONTRACT (all numbers finite; timestamps are ms since 1970; nothing here is ever a timer)
     burn = { seed:uint32, fuel:'grass'|'leaves'|'wood'|'charcoal'|'peat' (the fuel last picked),
              current: null | { fuel, n:1..3, startedAt:ms, skipped:bool }      the burn in progress or finished but not yet recorded
              records: [ { fuel, n:1..3, obs:[observation chip ids] } ],         one per recorded sample
              updatedAt }
              Times, masses, temperatures and BTB readings are NOT stored: they are recomputed from seed + fuel + n (B2BurnLogic.burnResult).

   SCENE REGISTRATION (either way works, so script order never matters)
     (window.B2Scenes = window.B2Scenes || []).push({ id:'burn', mount(host, api) {...} })   or   B2Burn.registerScene({ id, mount })
   api = window.B2Burn: saveState(id, data) / update(id, patch), getState(), announce(text) (the page's only live region),
   seed(salt) / rng(salt) (per-student, stable across reloads), logic (B2BurnLogic). */
(function () {
  'use strict';
  const KEY = 'aplab:openscied:b2-burn-lab:v1';
  const SECTIONS = ['overview', 'ideas', 'fuels', 'burn', 'sense', 'sort', 'peat', 'wrapup'];
  const SCENE_IDS = ['burn'];
  const HOSTS = { burn: ['#burn-scene', '#burn-notice'] };
  const L = window.B2BurnLogic;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const state = { burn: null, fields: {}, lastSection: 'overview' };
  let cleared = false, hadSaved = false, ready = false, RESPONSE_IDS = [];
  const DATA_PICKS = { 'sense-lostmost': 'lostmost', 'sense-yellowest': 'yellowest', 'sense-warmest': 'warmest' };

  function announce(text) { const e = $('#announcer'); if (!e) return; e.textContent = ''; setTimeout(function () { e.textContent = text; }, 30); }
  function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function copy(o) { try { return JSON.parse(JSON.stringify(o)); } catch (e) { return null; } }
  function studentIdentity() { return window.Lab && Lab.identity ? Lab.identity.get() : null; }

  /* ---------- saved state ---------- */
  function readStore() {
    try {
      const d = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (!d || d.v !== 1) return;
      hadSaved = true;
      SCENE_IDS.forEach(function (id) { if (d[id] && typeof d[id] === 'object') state[id] = d[id]; });
      if (d.fields && typeof d.fields === 'object') state.fields = d.fields;
      if (SECTIONS.includes(d.lastSection)) state.lastSection = d.lastSection;
    } catch (e) { /* unreadable saved work: start fresh in memory */ }
  }
  function collectFields() {
    const f = {};
    $$('main input, main textarea, main select').forEach(function (x) {
      if (x.readOnly || x.type === 'button' || x.closest('.scene-host')) return; // scene controls save through api.saveState, not as page fields
      if (x.type === 'radio') { if (x.checked) f[x.name] = x.value; }
      else if (x.type === 'checkbox') f[x.id] = x.checked;
      else if (x.id) f[x.id] = x.value;
    });
    return f;
  }
  function save() {
    if (cleared || !ready) return;
    try {
      state.fields = collectFields();
      const section = location.hash.slice(1);
      if (SECTIONS.includes(section)) state.lastSection = section;
      const rec = { v: 1, fields: state.fields, responseIds: RESPONSE_IDS, lastSection: state.lastSection, lastVisitedAt: Date.now() };
      SCENE_IDS.forEach(function (id) { rec[id] = state[id]; });
      localStorage.setItem(KEY, JSON.stringify(rec));
      $('#save-status').textContent = 'Saved on this device.';
    } catch (e) { $('#save-status').textContent = 'This browser could not save your work. Download a copy before leaving.'; }
    renderReport();
  }
  function restoreFields() {
    Object.keys(state.fields || {}).forEach(function (id) {
      const v = state.fields[id];
      const radios = $$('input[type=radio][name="' + CSS.escape(id) + '"]');
      if (radios.length) { const r = radios.find(function (x) { return x.value === String(v); }); if (r) r.checked = true; return; }
      const e = document.getElementById(id);
      if (!e || e.closest('.scene-host')) return;
      if (e.type === 'checkbox') e.checked = !!v; else if (typeof v === 'string') e.value = v;
    });
  }

  /* ---------- tables ---------- */
  function table(caption, head, rows) {
    const wrap = el('div', 'table-wrap'), t = el('table', 'data');
    wrap.setAttribute('role', 'region'); wrap.setAttribute('aria-label', caption + '. Scrolls sideways on narrow screens.'); wrap.tabIndex = 0; // keyboard users can scroll a wide table
    t.appendChild(el('caption', '', caption));
    const thead = el('thead'), hr = el('tr');
    head.forEach(function (h) { const th = el('th', '', h); th.scope = 'col'; hr.appendChild(th); });
    thead.appendChild(hr); t.appendChild(thead);
    const tb = el('tbody');
    rows.forEach(function (r) {
      const tr = el('tr');
      r.forEach(function (c, i) { const cell = el(i ? 'td' : 'th', i ? 'num' : '', c); if (!i) cell.scope = 'row'; tr.appendChild(cell); });
      tb.appendChild(tr);
    });
    t.appendChild(tb); wrap.appendChild(t); return wrap;
  }
  const obsText = o => o && o.length ? L.OBS.filter(function (x) { return o.includes(x.id); }).map(function (x) { return x.label; }).join(', ') : '—';
  function burnNodes() {
    const rows = L.tableRows(state.burn); if (!rows.length) return [];
    return [table('Simulated burn results', ['Fuel (sample)', 'Caught fire after (s)', 'Burned for (s)', 'BTB before → after', 'Temperature before → after (°C)', 'Mass before → after (g)', 'What I saw'],
      rows.map(function (r) { return [r.label + ' (' + r.n + ')', String(r.igniteS), String(r.burnS), L.btbText(r.btbBefore) + ' → ' + L.btbText(r.btbAfter), r.tempBefore + ' → ' + r.tempAfter, r.massBefore.toFixed(1) + ' → ' + r.massAfter.toFixed(1), obsText(r.obs)]; })),
      el('p', 'small muted', 'SIMULATED burns. Not measurements from a real demonstration.')];
  }

  /* ---------- predictions, checked against the student's own table ---------- */
  function predState(fuel) {
    const parts = [['ignite', 'pred-' + fuel + '-ignite'], ['energy', 'pred-' + fuel + '-energy']].map(function (p) { return L.checkPrediction(fuel, p[0], ($('#' + p[1]) || {}).value, state.burn); }).filter(function (r) { return r.status !== 'empty'; });
    if (!parts.length) return { text: '', status: '' };
    const wrong = parts.some(function (r) { return r.status === 'wrong'; }), nodata = parts.every(function (r) { return r.status === 'nodata'; });
    const seen = {}; const text = parts.map(function (r) { return r.message; }).filter(function (m) { if (seen[m]) return false; seen[m] = 1; return true; }).join('\n');
    return { text, status: wrong ? 'wrong' : nodata || parts.some(function (r) { return r.status === 'nodata'; }) ? 'partial' : 'correct' };
  }
  function renderPred(fuel, speak) {
    const fb = document.getElementById('feedback-pred-' + fuel); if (!fb) return;
    const r = predState(fuel); fb.textContent = r.text; fb.dataset.state = r.status;
    if (speak && r.text) announce(r.text.replace(/\n/g, ' '));
  }
  function renderPreds(speak) { L.FUEL_IDS.forEach(function (f) { renderPred(f, speak); }); }
  function renderData() { renderPreds(false); renderDataPicks(); renderClaim(false); }

  /* ---------- choices: instant feedback, recomputed from the picks ---------- */
  function feedbackEl(fs) {
    const id = 'feedback-' + (fs.dataset.id || ''); let p = document.getElementById(id);
    if (!p) {
      p = el('p', 'feedback'); p.id = id;
      if (fs.classList.contains('me-item')) { p.classList.add('me-fb'); fs.appendChild(p); } else fs.insertAdjacentElement('afterend', p);
    }
    return p;
  }
  function choiceResult(fs) {
    const c = $('input[type=radio]:checked', fs); if (!c) return null;
    const text = c.dataset.why || '', correct = fs.dataset.correct;
    return { text, value: c.value, status: correct ? (c.value === correct ? 'correct' : 'wrong') : 'poll' };
  }
  function renderChoice(fs, speak) {
    const p = feedbackEl(fs), r = choiceResult(fs);
    p.textContent = r ? r.text : ''; p.dataset.state = r ? r.status : '';
    if (r && speak && r.text) announce(r.text);
  }

  /* ---------- dropdown rows ---------- */
  function pickResult(sel) {
    if (DATA_PICKS[sel.id]) return L.checkDataPick(DATA_PICKS[sel.id], sel.value, state.burn);
    const m = /^pred-(\w+)-(ignite|energy)$/.exec(sel.id);
    if (m) return L.checkPrediction(m[1], m[2], sel.value, state.burn);
    return L.checkPick(sel.id, sel.value);
  }
  function renderPick(sel, speak) {
    const fb = document.getElementById('feedback-' + sel.id); if (!fb) return;
    const r = pickResult(sel);
    fb.textContent = r.message; fb.dataset.state = r.status === 'nodata' ? 'partial' : r.status === 'empty' ? '' : r.status;
    if (speak && r.message) announce(r.message);
  }
  const PICK_IDS = Object.keys(L.PICKS).concat(Object.keys(DATA_PICKS));
  function renderPicks() { PICK_IDS.forEach(function (id) { const s = document.getElementById(id); if (s) renderPick(s, false); }); }
  function renderDataPicks() { Object.keys(DATA_PICKS).forEach(function (id) { const s = document.getElementById(id); if (s) renderPick(s, false); }); }

  /* ---------- claim, evidence and reasoning self-check ---------- */
  const CLAIM_TEXT = { none: 'Pick a claim to begin. This is your own check, not a grade.', foundational: 'Foundational: add evidence and reasoning next.', linked: 'Linked: your claim has evidence. Add the reasoning and what the evidence cannot show.', organized: 'Organized: claim, evidence from your own data and the reading, reasoning, and a limit. (This is your own check, not a grade.)' };
  // Evidence chips about "my" fuels are checked against the student's own table, so a statement the data do not show earns no credit.
  const EV_KEY = { 'cer-ev-1': 'peatMostMass', 'cer-ev-2': 'peatBtbMost', 'cer-ev-3': 'peatWarmest', 'cer-ev-4': 'peatLongest' };
  const EV_WHO = { peatMostMass: ['Most mass lost: ', 'mostMass'], peatBtbMost: ['Biggest BTB change: ', 'mostBtb'], peatWarmest: ['Temperature rose the most: ', 'warmest'], peatLongest: ['Longest burn: ', 'longest'] };
  function evidenceNote(id, v, d) {
    const k = EV_KEY[id], w = EV_WHO[k], who = d[w[1]] ? w[0] + d[w[1]] + '.' : '';
    if (v === true) return '✓ Your data show this' + (who ? ': ' + who : '.');
    if (v === false) return '✕ Your data do not show this' + (who ? ': ' + who : '.') + ' Check your table.';
    return 'Burn and record peat and at least one other fuel to check this.';
  }
  function renderClaim(speak) {
    const ck = id => $('#' + id).checked, claimEl = $('input[name="cer-claim"]:checked'), reason = $('input[name="cer-reason"]:checked');
    const checks = L.evidenceChecks(state.burn), detail = L.evidenceDetail(state.burn), ok = {};
    Object.keys(EV_KEY).forEach(function (id) {
      const v = checks[EV_KEY[id]], note = $('#' + id + '-note'), on = ck(id);
      ok[id] = on && v === true;
      if (note) note.textContent = on ? evidenceNote(id, v, detail) : '';
    });
    const claimOk = !!claimEl && claimEl.value === 'a', reasonOk = !!reason && reason.value === 'a';
    const flags = [claimOk, Object.keys(ok).some(function (k) { return ok[k]; }), ck('cer-ev-5'), reasonOk, ck('cer-caveat')];
    const level = L.claimLevel(flags), out = $('#cer-level');
    const bad = claimEl && !claimOk ? 'Look again at your data: peat has carbon, and burning does not make new matter. Try another claim. ' : reason && !reasonOk ? 'Check where the matter and the energy go when a fuel burns. ' : '';
    out.textContent = bad + CLAIM_TEXT[level]; out.dataset.level = level;
    if (speak) announce(CLAIM_TEXT[level].split(':')[0]);
  }

  /* ---------- report, download, clear ---------- */
  function legendOf(fs) { const l = $('legend', fs); return l ? l.textContent.replace(/\s+/g, ' ').trim() : ''; }
  function labelFor(id) { const l = document.querySelector('label[for="' + id + '"]'); return l ? l.textContent.replace(/\s+/g, ' ').trim() : id; }
  function picks() {
    return $$('main fieldset.mcq[data-id]').map(function (fs) {
      const c = $('input[type=radio]:checked', fs), r = choiceResult(fs);
      return { id: fs.dataset.id, question: legendOf(fs), answer: c ? c.parentElement.textContent.replace(/\s+/g, ' ').trim() : '', value: c ? c.value : '', result: r ? r.status : 'unanswered' };
    });
  }
  function dropdowns() {
    return $$('main select').filter(function (s) { return s.id && !s.closest('.scene-host'); }).map(function (s) {
      const r = pickResult(s), group = s.closest('.sentence-row, .pick-row');
      return { id: s.id, prompt: group ? group.textContent.replace(/\s+/g, ' ').trim().slice(0, 160) : labelFor(s.id),
        answer: s.value ? s.options[s.selectedIndex].textContent.trim() : '', value: s.value, result: s.value ? (r.status || 'poll') : 'unanswered' };
    });
  }
  function chips() {
    return $$('main fieldset.chipset').map(function (fs) { return { id: fs.dataset.id || legendOf(fs), question: legendOf(fs), chosen: $$('input:checked', fs).map(function (b) { return b.parentElement.textContent.trim(); }) }; });
  }
  function textAnswers() { return $$('main textarea, main input[type=text]').filter(function (t) { return !t.readOnly && t.id; }).map(function (t) { return { id: t.id, prompt: labelFor(t.id), answer: t.value.trim() }; }); }
  function renderReport() {
    const report = $('#investigation-report'); if (!report) return;
    report.replaceChildren();
    report.appendChild(el('div', 'eyebrow', 'Burning fuels · My work'));
    report.appendChild(el('h3', '', 'Your work, at a glance.'));
    const student = studentIdentity();
    report.appendChild(el('p', 'report-student', student ? 'Student: ' + student.name + (student.period ? ' · Class period: ' + student.period : '') : 'Student name not entered. Sign in on the Biology Companion Activities dashboard before submitting.'));
    const p = picks(), dd = dropdowns(), all = p.concat(dd), answered = all.filter(function (x) { return x.value; });
    const good = all.filter(function (x) { return x.result === 'correct'; });
    const graded = $$('main fieldset.mcq[data-correct]').length + dd.filter(function (d) { return L.PICKS[d.id] || DATA_PICKS[d.id] || /^pred-/.test(d.id); }).length;
    const ul = el('ul', 'report-checks');
    const burns = L.tableRows(state.burn).length;
    [answered.length + ' of ' + all.length + ' choice questions answered', good.length + ' of ' + graded + ' checkable questions correct so far', burns + (burns === 1 ? ' simulated burn recorded' : ' simulated burns recorded')].forEach(function (t) { ul.appendChild(el('li', '', t)); });
    report.appendChild(ul);
    burnNodes().forEach(function (n) { report.appendChild(n); });
    textAnswers().forEach(function (t) { if (t.answer) { report.appendChild(el('h4', '', t.prompt)); report.appendChild(el('p', 'report-answer', t.answer)); } });
    report.appendChild(el('p', 'small muted', 'Simplified teaching model. Burn results are simulated and do not replace the real demonstration.'));
  }
  function download() {
    save();
    const scenes = {}; SCENE_IDS.forEach(function (id) { scenes[id] = state[id]; });
    const simulated = { burns: L.tableRows(state.burn).map(function (r) { return { fuel: r.fuel, sample: r.n, caughtFireAfterSeconds: r.igniteS, burnedForSeconds: r.burnS, btbBefore: r.btbBefore, btbBeforeColor: r.btbLabelBefore, btbAfter: r.btbAfter, btbAfterColor: r.btbLabelAfter,
      temperatureBeforeC: r.tempBefore, temperatureAfterC: r.tempAfter, massBeforeG: r.massBefore, massAfterG: r.massAfter, observations: r.obs }; }) };
    const payload = { format: 'openscied-b2-burn-progress-v1', exportedAt: new Date().toISOString(), student: studentIdentity(),
      dataNote: 'Burn results in this file are SIMULATED by a model from the student’s Dataset ID. They are not measurements from a real demonstration. Nothing here is personal information.',
      scenes, simulatedData: simulated, choices: picks(), dropdowns: dropdowns(), chips: chips(), written: textAnswers(), answers: state.fields };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = 'burning-fuels-work.json'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }
  // Same rule as the other companions: clear this activity's record, then reload fresh at the Overview. Name and class period stay saved.
  function clearActivity() {
    $$('textarea, input[type=text], input[type=hidden], select').forEach(function (e) { if (e.tagName === 'SELECT') e.selectedIndex = 0; else e.value = ''; });
    $$('input[type=checkbox],input[type=radio]').forEach(function (e) { e.checked = e.defaultChecked; });
    cleared = true;
    try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
    try { history.replaceState(null, '', location.pathname + location.search + '#overview'); } catch (e) { /* ignore */ }
    location.reload();
  }

  /* ---------- scenes: public hooks ---------- */
  const scenes = {};
  const api = {
    version: 1, logic: L,
    getState: function () { const o = {}; SCENE_IDS.forEach(function (id) { o[id] = copy(state[id]); }); return o; },
    saveState: function (id, data) { if (!SCENE_IDS.includes(id)) return; state[id] = data && typeof data === 'object' ? copy(data) : null; if (state[id]) state[id].updatedAt = state[id].updatedAt || Date.now(); renderData(); save(); },
    update: function (id, patch) { if (!SCENE_IDS.includes(id) || !patch || typeof patch !== 'object') return; api.saveState(id, Object.assign({}, state[id] || {}, copy(patch), { updatedAt: Date.now() })); },
    announce: announce,
    seed: function (salt) { const base = window.Lab && Lab.identity && Lab.identity.seed ? Lab.identity.seed.seed : 0; return (base + L.hash32(String(salt || ''))) >>> 0; },
    rng: function (salt) { return Lab.rng(api.seed(salt)); },
    registerScene: function (scene) { if (!scene || !HOSTS[scene.id] || typeof scene.mount !== 'function') return; scenes[scene.id] = scene; if (ready) mountScene(scene.id); }
  };
  window.B2Burn = api;
  function mountScene(id) {
    const host = $(HOSTS[id][0]), notice = $(HOSTS[id][1]);
    if (!host || !scenes[id] || host.dataset.mounted) return;
    host.dataset.mounted = '1'; if (notice) notice.hidden = true;
    try { scenes[id].mount(host, api); } catch (e) { host.dataset.mounted = ''; if (notice) { notice.hidden = false; notice.textContent = 'The burn model could not start. Reload the page to try again.'; } }
  }

  /* ---------- wiring ---------- */
  function resumeBar() {
    const bar = $('#resume-bar'); if (!bar) return;
    if (location.hash || state.lastSection === 'overview') { bar.hidden = true; return; }
    const target = $('#' + state.lastSection); if (!target) return;
    const a = $('a', bar); a.href = '#' + state.lastSection; a.textContent = 'Resume: ' + target.dataset.step; bar.hidden = false;
  }
  function renderAll() {
    $$('main fieldset.mcq[data-id]').forEach(function (fs) { renderChoice(fs, false); });
    renderPicks(); renderPreds(false); renderClaim(false);
  }
  function wire() {
    readStore();
    RESPONSE_IDS = Array.from(new Set($$('main input[type=radio]').map(function (r) { return r.name; }).concat(
      $$('main textarea').filter(function (t) { return !t.readOnly && t.id; }).map(function (t) { return t.id; }),
      $$('main select').filter(function (s) { return s.id && !s.closest('.scene-host'); }).map(function (s) { return s.id; }))));
    restoreFields();
    renderData(); renderAll(); resumeBar();
    ready = true;
    (window.B2Scenes || []).forEach(function (s) { api.registerScene(s); });
    window.B2Scenes = { push: function (s) { api.registerScene(s); } };
    SCENE_IDS.forEach(function (id) { if (!scenes[id]) { const n = $(HOSTS[id][1]); if (n) n.hidden = false; } });
    window.addEventListener('hashchange', save);
    $$('main input, main textarea, main select').forEach(function (e) { if (!e.closest('.scene-host')) { e.addEventListener('change', save); e.addEventListener('input', save); } });
    $$('main fieldset.mcq[data-id]').forEach(function (fs) { fs.addEventListener('change', function () { renderChoice(fs, true); if (/^cer-/.test(fs.dataset.id)) renderClaim(true); }); });
    PICK_IDS.forEach(function (id) { const s = document.getElementById(id); if (s) s.addEventListener('change', function () { renderPick(s, true); }); });
    L.FUEL_IDS.forEach(function (f) { ['ignite', 'energy'].forEach(function (k) { const s = document.getElementById('pred-' + f + '-' + k); if (s) s.addEventListener('change', function () { renderPred(f, true); }); }); });
    $('#cer').addEventListener('change', function () { renderClaim(false); });
    $('#download-work').addEventListener('click', download);
    $('#print-work').addEventListener('click', function () { renderReport(); window.print(); });
    const dialog = $('#reset-dialog');
    $('#reset-work').addEventListener('click', function () { dialog.showModal(); });
    $('#cancel-reset').addEventListener('click', function () { dialog.close(); });
    $('#confirm-reset').addEventListener('click', clearActivity);
    // Only refresh an existing record on load: saving a blank page right after "Clear this activity" would make the dashboard show it as started.
    if (hadSaved) save(); else renderReport();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire); else wire();
})();
