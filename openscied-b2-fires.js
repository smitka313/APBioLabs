/* Fires: Peat, Decomposition and Earth's Tilt: companion for OpenSciEd Unit B.2, Lessons 3 and 5.
   Light by design: dropdown rows and tap cards with instant feedback, and only three short text boxes. One saved record in
   localStorage, one live announcer, a report, a download and a "Clear this activity" dialog. Student work lives only in this browser.
   Every number from the yeast and tilt models is SIMULATED (see openscied-b2-fires-logic.js for the assumptions).

   SAVED STATE (localStorage 'aplab:openscied:b2-fires:v1'), format v1:
     { v:1,
       cards, decomp, tilt,                                 written by the three scenes (contract below); null until a scene saves
       fields:     { <element id, or radio name>: value }   every text box, select, checkbox, radio
       responseIds:[ ... ]                                  every answer id (radio names, text boxes, dropdowns); the dashboard counts these
       lastSection, lastVisitedAt }
   Feedback for choices is recomputed from the saved picks and the saved data on load, so it is never stale. Other companions' keys are
   never read or written here. Full contract text: docs/b2-fires-scenes.md.

   SCENE STATE CONTRACT (all numbers finite; timestamps are ms since 1970; nothing here is ever a timer)
     cards  = { placed:{ sugar|oxygen|carbon-dioxide|water|energy: 'in'|'out' }, solved:bool, updatedAt }
     decomp = { seed:uint32, startedAt:ms, skipped:bool, temps:[c1,c2,c3] each one of 5|18|27|35|43|55,
                recorded:[minutes already recorded, from 0,2,...,20], updatedAt }
                The foam heights are NOT stored: they are recomputed from seed + temps (B2FiresLogic.foamRows), so they cannot go stale.
     tilt   = { seed:uint32, startedAt:ms, skipped:bool, settings:[light for tubes A,B,C: direct|tilt45|tilt70|foil],
                recorded:bool (the student unwrapped the tubes and read the colors), starchDone:bool, updatedAt }
                BTB readings and starch are recomputed from seed + settings (B2FiresLogic.tiltResults).

   SCENE REGISTRATION (either way works, so script order never matters)
     (window.B2Scenes = window.B2Scenes || []).push({ id:'cards'|'decomp'|'tilt', mount(host, api) {...} })
     or  B2Fires.registerScene({ id, mount })
   api = window.B2Fires: saveState(id, data) / update(id, patch), getState(), announce(text) (the page's only live region),
   seed(salt) / rng(salt) (per-student, stable across reloads), logic (B2FiresLogic). */
(function () {
  'use strict';
  const KEY = 'aplab:openscied:b2-fires:v1';
  const saveAPI = window.OpenSciEdSaveSession, saveScope = 'b2-fires';
  const saveSession = (() => { try { return saveAPI?.open(localStorage, saveScope, [KEY]); } catch (_) { return null; } })();
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
    if (!result.ok) showSaveConflict(result);
  }
  window.addEventListener('storage', checkSaveConflict);
  window.addEventListener('pageshow', checkSaveConflict);
  const SECTIONS = ['overview', 'ideas', 'plan', 'yeast', 'cards', 'sense3', 'hypothesis', 'tilt', 'sense5', 'peat', 'wrapup'];
  const SCENE_IDS = ['cards', 'decomp', 'tilt'];
  const HOSTS = { cards: ['#cards-scene', '#cards-notice'], decomp: ['#decomp-scene', '#decomp-notice'], tilt: ['#tilt-scene', '#tilt-notice'] };
  const L = window.B2FiresLogic;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const state = { cards: null, decomp: null, tilt: null, fields: {}, lastSection: 'overview' };
  let cleared = false, ready = false, preservedSave = false, needsSaveUpgrade = false, hasSavedRecord = false, RESPONSE_IDS = [];
  const DATA_PICKS = { 'sense-bluest': 'bluest', 'sense-yellowest': 'yellowest' };

  function announce(text) { const e = $('#announcer'); if (!e) return; e.textContent = ''; setTimeout(function () { e.textContent = text; }, 30); }
  function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function copy(o) { try { return JSON.parse(JSON.stringify(o)); } catch (e) { return null; } }
  function studentIdentity() { return window.Lab && Lab.identity ? Lab.identity.get() : null; }

  /* ---------- saved state ---------- */
  function readStore() {
    try {
      const raw = readSave();
      if (raw === null) return;
      const d = JSON.parse(raw);
      if (!d || d.v !== 1) throw Error('Unknown saved format');
      hasSavedRecord = true;
      needsSaveUpgrade = !Array.isArray(d.responseIds);
      SCENE_IDS.forEach(function (id) { if (d[id] && typeof d[id] === 'object') state[id] = d[id]; });
      if (d.fields && typeof d.fields === 'object') state.fields = d.fields;
      if (SECTIONS.includes(d.lastSection)) state.lastSection = d.lastSection;
    } catch (e) { preservedSave = true; }
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
      const rec = { v: 1, fields: state.fields, responseIds: RESPONSE_IDS, lastSection: state.lastSection, lastVisitedAt: Date.now(), modelEvidence: L.sceneEvidence(state) };
      SCENE_IDS.forEach(function (id) { rec[id] = state[id]; });
      if (preservedSave) {
        renderReport();
        return;
      }
      const result = saveSession?.write(KEY, JSON.stringify(rec));
      if (!result?.ok) {
        $('#save-status').textContent = showSaveConflict(result);
        renderReport();
        return;
      }
      hasSavedRecord = true;
      $('#save-status').textContent = 'Saved on this device.';
    } catch (e) { $('#save-status').textContent = showSaveConflict(); }
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

  /* ---------- tables and "Your data" boxes ---------- */
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
  const tempText = c => c + ' °C';
  function cardsNodes() {
    const p = state.cards && state.cards.placed; if (!p || typeof p !== 'object') return [];
    const r = L.checkCards(p); if (!r.placed) return [];
    const rows = L.CARDS.map(function (c) { const x = r.results[c.id]; return [c.label + (c.note === 'energy' ? ' (energy card)' : ''), x.zone === 'in' ? 'Goes in' : x.zone === 'out' ? 'Comes out' : 'not placed yet', x.correct === true ? '✓ Matches the reaction' : x.correct === false ? '✕ Other side' : '○ Not placed']; });
    return [table('Where you put the cards', ['Card', 'My choice', 'Check'], rows),
      el('p', 'small muted', r.solved ? 'Your cards show cellular respiration: ' + L.REACTION + '.' : r.right + ' of 5 cards match the reaction so far.')];
  }
  function decompNodes(full) {
    const st = state.decomp, rows = L.foamRows(st); if (!rows.length) return [];
    const temps = L.normalizeTemps(st.temps), last = L.lastRow(rows), out = [];
    if (full) {
      out.push(table('Simulated foam height (mm)', ['Time (min)'].concat(temps.map(function (t, i) { return L.BEAKER_NAMES[i] + ' (' + tempText(t) + ')'; })), rows.map(function (r) { return [String(r.t)].concat(r.h.map(String)); })));
    }
    out.push(table('Foam at the last reading (' + last.t + ' min)', ['Beaker', 'Water temperature', 'Foam height (mm)', 'Carbon dioxide made (relative)'],
      temps.map(function (t, i) { return [L.BEAKER_NAMES[i], tempText(t), String(last.h[i]), L.co2Made(last.h[i]).toFixed(1)]; })));
    const pc = L.predictionCheck(($('#pred-fastest') || {}).value, st);
    if (pc) out.push(el('p', 'small', L.predictionSentence(pc)));
    out.push(el('p', 'small muted', 'SIMULATED foam. The foam is carbon dioxide gas, so relative carbon dioxide is foam height divided by 10. Not measurements from a real lab.'));
    return out;
  }
  function tiltNodes() {
    const st = state.tilt; if (!st || !st.recorded || !Array.isArray(st.settings) || typeof st.seed !== 'number') return [];
    const res = L.tiltResults(st.seed, st.settings);
    const rows = res.map(function (r) {
      const row = ['Tube ' + r.tube, L.LIGHTS[r.light].short, Math.round(r.intensity * 100) + '%', r.btb.toFixed(1) + ' (' + r.btbLabel + ')', (r.net > 0 ? '+' : '') + r.net.toFixed(2)];
      if (st.starchDone) row.push(r.starchLabel + ' (' + r.starch.toFixed(2) + ')');
      return row;
    });
    const head = ['Tube', 'Light', 'Light reaching the plant', 'BTB reading (1 deep blue to 6 yellow)', 'Carbon dioxide change (relative)'];
    if (st.starchDone) head.push('Iodine stain (starch)');
    return [table('Simulated BTB tubes after the night', head, rows),
      el('p', 'small muted', 'SIMULATED. The tubes started blue (2.0). Under 2 means less carbon dioxide, over 2 means more. Not measurements from a real lab.')];
  }
  const BOXES = [['#data-decomp-body', function () { return decompNodes(false); }], ['#data-tilt-body', tiltNodes]];
  function renderData() {
    BOXES.forEach(function (b) {
      const box = $(b[0]); if (!box) return;
      const nodes = b[1](); box.replaceChildren();
      if (!nodes.length) box.appendChild(el('p', 'muted', 'Run the test first. Your results will appear here.'));
      else nodes.forEach(function (n) { box.appendChild(n); });
    });
    const foam = decompNodes(false), tubes = tiltNodes(), data = $('#cer-model-data');
    data.hidden = !(foam.length || tubes.length);
    $('#cer-foam-body').replaceChildren(...foam);
    $('#cer-tilt-body').replaceChildren(...tubes);
    renderDataPicks(); renderPredNote(); renderClaim(false);
  }

  /* ---------- choices: instant feedback, recomputed from the picks ---------- */
  function feedbackEl(fs) {
    const id = 'feedback-' + (fs.dataset.id || ''); let p = document.getElementById(id);
    if (!p) { p = el('p', 'feedback'); p.id = id; fs.insertAdjacentElement('afterend', p); }
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
  function chipResult(fs) {
    const boxes = $$('input[type=checkbox]', fs), picked = boxes.filter(function (b) { return b.checked; }).map(function (b) { return b.id.slice(b.id.lastIndexOf('-') + 1); });
    if (!fs.dataset.answer) return { picked, text: '', status: 'poll' };
    const want = fs.dataset.answer.split(','), wrong = picked.filter(function (x) { return !want.includes(x); }), right = picked.filter(function (x) { return want.includes(x); });
    const done = right.length === want.length && !wrong.length, fb = document.getElementById('feedback-' + fs.dataset.id);
    return { picked, status: done ? 'correct' : wrong.length ? 'wrong' : 'partial',
      text: done ? (fb && fb.dataset.done || 'Yes.') : wrong.length ? 'Try again. Why not: one of your picks does not belong.' : picked.length ? 'Good so far. Keep tapping: ' + (want.length - right.length) + ' more to find.' : '' };
  }
  function renderChips(fs, speak) {
    const fb = document.getElementById('feedback-' + (fs.dataset.id || '')); if (!fb) return;
    const r = chipResult(fs); fb.textContent = r.text; fb.dataset.state = r.status;
    if (speak && r.text) announce(r.text);
  }

  /* ---------- dropdown rows ---------- */
  function pickResult(sel) {
    if (DATA_PICKS[sel.id]) return L.checkTiltPick(DATA_PICKS[sel.id], sel.value, state.tilt);
    return L.checkPick(sel.id, sel.value);
  }
  function renderPick(sel, speak) {
    const fb = document.getElementById('feedback-' + sel.id); if (!fb) return;
    const r = pickResult(sel);
    fb.textContent = r.message; fb.dataset.state = r.status === 'nodata' ? 'partial' : r.status === 'empty' ? '' : r.status;
    if (speak && r.message) announce(r.message);
  }
  const PICK_IDS = Object.keys(L.PICKS).concat(Object.keys(DATA_PICKS)).filter(function (id) { return !/^hyp-/.test(id); });
  function renderPicks() { PICK_IDS.forEach(function (id) { const s = document.getElementById(id); if (s) renderPick(s, false); }); }
  function renderDataPicks() { Object.keys(DATA_PICKS).forEach(function (id) { const s = document.getElementById(id); if (s) renderPick(s, false); }); }
  function setFb(id, r, speak) {
    const fb = document.getElementById(id); if (!fb) return;
    fb.textContent = r.message; fb.dataset.state = r.status === 'empty' ? '' : r.status;
    if (speak && r.message) announce(r.message);
  }
  function renderSugar(speak) { setFb('feedback-sugar', L.checkSugarSentence($('#sense-amount').value, $('#sense-temp').value), speak); }
  function renderHyp(speak) { setFb('feedback-hyp', L.checkHypothesis($('#hyp-light').value, $('#hyp-co2').value, $('#hyp-why').value), speak); }
  function renderPredNote() {
    const n = $('#pred-note'); if (!n) return;
    const pc = L.predictionCheck(($('#pred-fastest') || {}).value, state.decomp);
    n.textContent = L.predictionSentence(pc);
    n.hidden = !pc;
  }

  /* ---------- claim, evidence and reasoning self-check ---------- */
  const CLAIM_TEXT = { none: 'Pick a claim to begin. This is your own check, not a grade.', foundational: 'Foundational: add evidence and reasoning next.', linked: 'Linked: your claim has evidence. Add the reasoning and what the evidence cannot show.', organized: 'Organized: claim, evidence from your own data and the reading, reasoning, and a limit. (This is your own check, not a grade.)' };
  // Evidence chips about "my" beakers and tubes are checked against the student's own data, so a statement the data do not show earns no credit.
  const EV_KEY = { 'cer-ev-1': 'warmMost', 'cer-ev-2': 'coldLeast', 'cer-ev-3': 'directBluest', 'cer-ev-4': 'foilYellow' };
  function evidenceNote(id, v, d) {
    const k = EV_KEY[id], who = k === 'warmMost' ? d.mostBeaker && d.mostBeaker + ' had the most foam.' : k === 'coldLeast' ? d.leastBeaker && d.leastBeaker + ' had the least foam.'
      : k === 'directBluest' ? d.bluestTube && d.bluestTube + ' was bluest.' : d.yellowestTube && d.yellowestTube + ' was yellowest.';
    if (v === true) return '✓ Your data show this' + (who ? ': ' + who : '.');
    if (v === false) return '✕ Your data do not show this' + (who ? ': ' + who : '.') + ' Check your table.';
    return k === 'warmMost' || k === 'coldLeast' ? 'Record your foam readings, with different temperatures, to check this.' : L.tiltEvidenceGap(k, state.tilt);
  }
  function renderClaim(speak) {
    const ck = id => $('#' + id).checked, claimEl = $('input[name="cer-claim"]:checked'), reason = $('input[name="cer-reason"]:checked');
    const checks = L.evidenceChecks(state.decomp, state.tilt), detail = L.evidenceDetail(state.decomp, state.tilt), ok = {};
    Object.keys(EV_KEY).forEach(function (id) {
      const box = $('#' + id), v = checks[EV_KEY[id]], note = $('#' + id + '-note'), on = box.checked;
      // An older selection remains editable, but it no longer counts if its supporting model record is missing or changes.
      box.disabled = v === null && !on;
      box.dataset.evidence = v === true ? 'supported' : v === false ? 'not-supported' : 'unavailable';
      ok[id] = on && v === true;
      const isTube = id === 'cer-ev-3' || id === 'cer-ev-4';
      if (note) note.textContent = on || (isTube && v === null) ? evidenceNote(id, v, detail) : '';
    });
    const hasFoam = checks.warmMost !== null || checks.coldLeast !== null;
    const hasTubes = checks.directBluest !== null || checks.foilYellow !== null;
    const needFoam = 'Record a foam reading after 0 min with different temperatures.';
    const needTubes = 'Record a tilt comparison that supports one of the tube statements below.';
    $('#cer-tilt-recovery').hidden = checks.directBluest !== null && checks.foilYellow !== null;
    $('#cer-model-note').textContent = hasFoam && hasTubes
      ? 'Use your recorded comparisons. A strong explanation cites evidence about both decomposition and light.'
      : 'Model evidence still needed: ' + (!hasFoam ? needFoam + ' ' : '') + (!hasTubes ? needTubes : '');
    const claimOk = !!claimEl && claimEl.value === 'a', reasonOk = !!reason && reason.value === 'a';
    const flags = [claimOk, Object.keys(ok).some(function (k) { return ok[k]; }), ck('cer-ev-5'), reasonOk, ck('cer-caveat')];
    const ownsBoth = (ok['cer-ev-1'] || ok['cer-ev-2']) && (ok['cer-ev-3'] || ok['cer-ev-4']);
    const candidate = L.claimLevel(flags), level = candidate === 'organized' && !ownsBoth ? 'linked' : candidate;
    const out = $('#cer-level');
    const bad = claimEl && !claimOk ? 'Look again at your data and the reading: sunlight, storage and slow decomposition all matter. Try another claim. ' : reason && !reasonOk ? 'Check what light energy and cold each do to carbon and energy. ' : '';
    out.textContent = bad + CLAIM_TEXT[level] + (level === 'linked' && !ownsBoth ? ' Include supported evidence from both models for the full explanation.' : ''); out.dataset.level = level;
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
      const r = pickResult(s), group = s.closest('.sentence-row, .qt');
      return { id: s.id, prompt: group ? group.textContent.replace(/\s+/g, ' ').trim().slice(0, 160) : labelFor(s.id),
        answer: s.value ? s.options[s.selectedIndex].textContent.trim() : '', value: s.value, result: s.value ? (r.status || 'poll') : 'unanswered' };
    });
  }
  function chips() {
    return $$('main fieldset.chipset').map(function (fs) {
      const picked = $$('input:checked', fs);
      const result = { id: fs.dataset.id || legendOf(fs), question: legendOf(fs), chosen: picked.filter(b => !b.dataset.evidence || b.dataset.evidence === 'supported').map(b => b.parentElement.textContent.trim()) };
      const drafts = picked.filter(b => b.dataset.evidence && b.dataset.evidence !== 'supported');
      if (drafts.length) result.notSupportedByRecordedData = drafts.map(b => b.parentElement.textContent.trim());
      return result;
    });
  }
  function textAnswers() { return $$('main textarea, main input[type=text]').filter(function (t) { return !t.readOnly && t.id; }).map(function (t) { return { id: t.id, prompt: labelFor(t.id), answer: t.value.trim() }; }); }
  // ONE definition of "answers": every id in RESPONSE_IDS (each radio question, each dropdown, each required text box; boxes marked data-optional
  // are not counted). The report, the download and the dashboard (which reads the saved responseIds and the saved fields) all use it, so they agree.
  function answerStats() {
    const f = collectFields(), has = function (id) { return typeof f[id] === 'string' && f[id].trim() !== ''; };
    const text = RESPONSE_IDS.filter(function (id) { const e = document.getElementById(id); return e && e.tagName === 'TEXTAREA'; });
    return { answered: RESPONSE_IDS.filter(has).length, total: RESPONSE_IDS.length, writtenAnswered: text.filter(has).length, writtenTotal: text.length };
  }
  function renderReport() {
    const report = $('#investigation-report'); if (!report) return;
    report.replaceChildren();
    report.appendChild(el('div', 'eyebrow', 'Fires: peat, decomposition and Earth’s tilt · My work'));
    report.appendChild(el('h3', '', 'Your work, at a glance.'));
    const student = studentIdentity();
    report.appendChild(el('p', 'report-student', student ? 'Student: ' + student.name + (student.period ? ' · Class period: ' + student.period : '') : 'Student name not entered. Sign in on the Biology Companion Activities dashboard before submitting.'));
    const p = picks(), dd = dropdowns(), all = p.concat(dd);
    const good = all.filter(function (x) { return x.result === 'correct'; });
    const graded = $$('main fieldset.mcq[data-correct]').length + dd.filter(function (d) { return L.PICKS[d.id] ? L.PICKS[d.id].correct.length : !!DATA_PICKS[d.id]; }).length;
    const ul = el('ul', 'report-checks');
    const st = answerStats(); report.dataset.answered = st.answered; report.dataset.total = st.total;
    const answerState = document.getElementById('save-conflict')?.hidden === false ? 'answers in this tab' : 'answers saved';
    [st.answered + ' of ' + st.total + ' ' + answerState + ' (questions and writing only; ' + st.writtenAnswered + ' of ' + st.writtenTotal + ' written)', good.length + ' of ' + graded + ' checkable questions correct so far'].forEach(function (t) { ul.appendChild(el('li', '', t)); });
    report.appendChild(ul);
    const ev = L.sceneEvidence(state);
    report.appendChild(el('h4','','Model records (counted separately)'));
    const records=el('ul','report-checks'); records.dataset.modelRecords = '';
    [ev.cardsRight + ' of ' + L.CARDS.length + ' cards sorted correctly' + (ev.cardsPlaced ? ' (' + ev.cardsPlaced + ' placed)' : ''),
      ev.foamReadings + ' foam reading' + (ev.foamReadings===1?'':'s') + ' recorded' + (ev.foamReadings && !ev.foamAfterBaseline ? ' (starting reading only)' : ''),
      ev.tubesRead + ' of 3 BTB tubes read and recorded' + (ev.starchTested ? ' · starch test recorded' : '')].forEach(t=>records.appendChild(el('li','',t)));
    report.appendChild(records);
    cardsNodes().forEach(function (n) { report.appendChild(n); });
    decompNodes(true).forEach(function (n) { report.appendChild(n); });
    tiltNodes().forEach(function (n) { report.appendChild(n); });
    textAnswers().forEach(function (t) { if (t.answer) { report.appendChild(el('h4', '', t.prompt)); report.appendChild(el('p', 'report-answer', t.answer)); } });
    report.appendChild(el('p', 'small muted', 'Simplified teaching models. Yeast foam, plant and BTB results are simulated and do not replace real laboratory work.'));
  }
  function download() {
    state.fields = collectFields();
    const scenes = {}; SCENE_IDS.forEach(function (id) { scenes[id] = state[id]; });
    const d = state.decomp, t = state.tilt;
    const simulated = {
      foam: d ? L.foamRows(d).map(function (r) { return { minutes: r.t, foamHeightMm: r.h, carbonDioxideRelative: r.h.map(L.co2Made) }; }) : [],
      foamTemperaturesC: d ? L.normalizeTemps(d.temps) : null,
      tubes: t && typeof t.seed === 'number' && Array.isArray(t.settings) && t.recorded ? L.tiltResults(t.seed, t.settings).map(function (r) { return { tube: r.tube, light: r.light, lightReachingPlant: r.intensity, btbReading: r.btb, btbColor: r.btbLabel, carbonDioxideChangeRelative: r.net, starchIndex: t.starchDone ? r.starch : null }; }) : [] };
    const payload = { format: 'openscied-b2-fires-progress-v1', exportedAt: new Date().toISOString(), student: studentIdentity(),
      dataNote: 'Yeast foam, plant and BTB results in this file are SIMULATED by a model from the student’s Dataset ID. They are not measurements from a real lab. Nothing here is personal information.',
      answersSaved: answerStats(), modelEvidence: L.sceneEvidence(state), responseIds: RESPONSE_IDS, scenes, simulatedData: simulated, choices: picks(), dropdowns: dropdowns(), chips: chips(), written: textAnswers(), answers: state.fields };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = 'fires-peat-work.json'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }
  // Same rule as the other companions: clear this activity's record, then reload fresh at the Overview. Name and class period stay saved.
  function clearActivity() {
    const result = saveSession?.reset(KEY);
    if (!result?.ok) { $('#reset-dialog').close(); showSaveConflict(result); return; }
    $$('textarea, input[type=text], input[type=hidden], select').forEach(function (e) { if (e.tagName === 'SELECT') e.selectedIndex = 0; else e.value = ''; });
    $$('input[type=checkbox],input[type=radio]').forEach(function (e) { e.checked = e.defaultChecked; });
    cleared = true;
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
  window.B2Fires = api;
  function mountScene(id) {
    const host = $(HOSTS[id][0]), notice = $(HOSTS[id][1]);
    if (!host || !scenes[id] || host.dataset.mounted) return;
    host.dataset.mounted = '1'; if (notice) notice.hidden = true;
    try { scenes[id].mount(host, api); } catch (e) { host.dataset.mounted = ''; if (notice) { notice.hidden = false; notice.textContent = 'The interactive model could not start. Reload the page to try again.'; } }
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
    $$('main fieldset.chipset').forEach(function (fs) { renderChips(fs, false); });
    renderPicks(); renderSugar(false); renderHyp(false); renderPredNote(); renderClaim(false);
  }
  function wire() {
    readStore();
    if (preservedSave) {
      const notice = document.getElementById('save-conflict');
      notice.textContent = 'An unreadable save was kept. Download it from the dashboard before clearing it. Download any new work from this tab before reloading.';
      notice.hidden = false;
    }
    RESPONSE_IDS = Array.from(new Set($$('main input[type=radio]').map(function (r) { return r.name; }).concat(
      $$('main textarea').filter(function (t) { return !t.readOnly && t.id && !t.hasAttribute('data-optional'); }).map(function (t) { return t.id; }),
      $$('main select').filter(function (s) { return s.id && !s.closest('.scene-host'); }).map(function (s) { return s.id; }))));
    restoreFields();
    renderData(); renderAll(); resumeBar();
    ready = true;
    (window.B2Scenes || []).forEach(function (s) { api.registerScene(s); });
    window.B2Scenes = { push: function (s) { api.registerScene(s); } };
    SCENE_IDS.forEach(function (id) { if (!scenes[id]) { const n = $(HOSTS[id][1]); if (n) n.hidden = false; } });
    window.addEventListener('hashchange', function () { if (hasSavedRecord) save(); });
    $$('main input, main textarea, main select').forEach(function (e) { if (!e.closest('.scene-host')) { e.addEventListener('change', save); e.addEventListener('input', save); } });
    $$('main fieldset.mcq[data-id]').forEach(function (fs) { fs.addEventListener('change', function () { renderChoice(fs, true); if (/^cer-/.test(fs.dataset.id)) renderClaim(true); }); });
    $$('main fieldset.chipset').forEach(function (fs) { fs.addEventListener('change', function () { renderChips(fs, true); }); });
    PICK_IDS.forEach(function (id) { const s = document.getElementById(id); if (s) s.addEventListener('change', function () { renderPick(s, true); if (id === 'pred-fastest') { renderPredNote(); renderData(); } }); });
    ['sense-amount', 'sense-temp'].forEach(function (id) { $('#' + id).addEventListener('change', function () { renderSugar(true); }); });
    ['hyp-light', 'hyp-co2', 'hyp-why'].forEach(function (id) { $('#' + id).addEventListener('change', function () { renderHyp(true); }); });
    $('#cer').addEventListener('change', function () { renderClaim(false); });
    $('#download-work').addEventListener('click', download);
    $('#print-work').addEventListener('click', function () { renderReport(); window.print(); });
    const dialog = $('#reset-dialog');
    $('#reset-work').addEventListener('click', function () { dialog.showModal(); });
    $('#cancel-reset').addEventListener('click', function () { dialog.close(); });
    $('#confirm-reset').addEventListener('click', clearActivity);
    // Do not overwrite a whole saved investigation just because a tab opened. Upgrade legacy counters once.
    if (needsSaveUpgrade) save(); else renderReport();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire); else wire();
})();
