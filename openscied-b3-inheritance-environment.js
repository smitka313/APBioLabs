/* Inheritance, Environment and Cancer Risk: companion for OpenSciEd Biology B.3, Lessons 8-9.
   Light by design: mostly taps and choices with instant feedback, and only a few short text boxes. One saved record in
   localStorage, one live announcer, a report, a download and a "Clear this activity" dialog. Student work lives only in this browser.

   SAVED STATE (localStorage 'aplab:openscied:b3-inheritance-environment:v1'), format v1:
     { v:1,
       pedigree, twoGene, meiosis, skin, planner, yeast,   written by the six scenes (contract below); null until a scene saves
       question:   { text, iv, dv, ok }                     written by the page's Question Tool (read it with api.getQuestion())
       fields:     { <element id, or radio name>: value }   every text box, select, checkbox, radio, and the tap-order sequence
       responseIds:[ ... ]                                  every answer id (radio names, text boxes); the dashboard counts these
       lastSection, lastVisitedAt }
   Feedback for choices is recomputed from the saved picks on load, so it is never stale. The cell-cycle and DNA/p53 keys
   are never read or written here. Full contract text: docs/b3-inheritance-scenes.md.

   SCENE STATE CONTRACT (all counts whole numbers >= 0; letters: p53 A fixes / B does not, BRCA1 C lower / D higher risk)
     pedigree = { guesses:{ <personId>: ['AA'|'AB'|'BB', ...] }, view:'pedigree'|'chromosome', updatedAt }
                personIds are those of B3InheritanceLogic.LAKITA; the page re-checks every guess with logic.checkGuess.
     twoGene  = { genotypes:{ father|mother|child1|child2|child3: { p53:'AB', brca1:'CD' } }, updatedAt }
     meiosis  = { runs:[ { crossing:bool, parent:['AC','BD'], gametes:['AC','BD',...four strings], at } ], distanceCM:number, updatedAt }
     skin     = { viewed:{ white:bool, black:bool, hispanic:bool }, scale:'same'|'own', updatedAt }
                the approximate readings live in logic.SKIN_READINGS (the owner verifies them).
     planner  = { conditions:[ { group:1..7, label, spf:number|null, foil:bool, dark:bool, minutes:number, strain:'sensitive'|'wild' } ], controls:[ids], updatedAt }
     yeast    = { seed, startedAt:ms, incubationDays:3..5, skipped:bool,
                  dishes:[ { group, strain, label, dose:number, colonies:int>=0, rating:'none'|'few'|'some'|'many', observation:string } ], updatedAt }
                Store timestamps, not timers. All yeast numbers are SIMULATED.

   SCENE REGISTRATION (either way works, so script order never matters)
     (window.B3InhScenes = window.B3InhScenes || []).push({ id:'pedigree'|'twoGene'|'meiosis'|'skin'|'planner'|'yeast', mount(host, api) {...} })
     or  B3Inh.registerScene({ id, mount })
   mount(host, api): host holds a <canvas role="img" aria-label> (reuse or replace it, keep a role and label) and a .scene-desc text
   region (keep it current for screen readers). api = window.B3Inh:
     api.saveState(id, data) / api.update(id, patch)   write one scene's state and save; data boxes, report and download refresh
     api.getState()      copy of { pedigree, twoGene, meiosis, skin, planner, yeast, question }
     api.getQuestion()   the Question Tool result { text, iv, dv, ok }
     api.announce(text)  the page's only live region
     api.seed(salt) / api.rng(salt)   per-student seeded randomness (Lab.rng), stable across reloads
     api.logic           B3InheritanceLogic
   The "coming in the next update" notice is shown only while no scene has registered for that host. */
(function () {
  'use strict';
  const KEY = 'aplab:openscied:b3-inheritance-environment:v1';
  const saveScope = 'b3-inheritance-environment', saveAPI = window.OpenSciEdSaveSession;
  const saveSession = (() => {
    try { return saveAPI?.open(window.localStorage, saveScope, [KEY]); }
    catch (_) { return null; }
  })();
  const reportStudent = saveAPI?.reportIdentity?.(saveSession, [KEY], () => window.Lab?.identity?.get?.() ?? null);
  const unavailableSave = { ok:false, reason:'unavailable' };
  function showSaveProblem(result, focus = false) {
    const message = (result?.reason === 'erased' ? 'Saved work was cleared in another tab.' :
      result?.reason === 'changed' ? 'This activity changed in another tab.' : 'This browser could not save your work.') +
      ' This tab has not overwritten the saved work. Download a copy of your work here before reopening the activity.';
    const notice = document.getElementById('ose-save-protection');
    if (notice) {
      const changed = notice.hidden || notice.firstElementChild.textContent !== message;
      if (changed) notice.firstElementChild.textContent = message;
      notice.hidden = false;
      if (focus) notice.focus();
      // Keep the banner visible and announce it once, without replacing lesson feedback.
      if (changed && !focus) {
        const live = document.getElementById('save-announcement');
        if (live) live.textContent = message;
      }
    }
    return message;
  }
  function clearSaveProblem() {
    const notice = document.getElementById('ose-save-protection');
    if (notice && !notice.hidden) {
      notice.hidden = true;
      const live = document.getElementById('save-announcement');
      if (live) live.textContent = '';
    }
  }
  function watchSaveChanges(event) {
    if (event?.type === 'storage' && event.key !== null &&
        ![KEY, saveAPI?.globalKey, saveAPI?.scopeKey(saveScope), saveAPI?.resetKey(KEY)].includes(event.key)) return;
    const result = saveSession?.check(KEY);
    if (result && !result.ok && result.reason !== 'unavailable') showSaveProblem(result);
  }
  window.addEventListener('storage', watchSaveChanges);
  window.addEventListener('pageshow', watchSaveChanges);

  const SECTIONS = ['overview', 'ideas', 'families', 'reader', 'lakita', 'twogene', 'passing', 'exit8', 'envideas', 'skindata', 'plan', 'yeast', 'uvdna', 'wrapup'];
  const SCENE_IDS = ['pedigree', 'twoGene', 'meiosis', 'skin', 'planner', 'yeast'];
  const HOSTS = { pedigree: ['#pedigree-scene', '#pedigree-notice', '#pedigree-desc'], twoGene: ['#two-gene-scene', '#two-gene-notice', '#two-gene-desc'],
    meiosis: ['#meiosis-scene', '#meiosis-notice', '#meiosis-desc'], skin: ['#skin-data-scene', '#skin-data-notice', '#skin-data-desc'],
    planner: ['#planner-scene', '#planner-notice', '#planner-desc'], yeast: ['#yeast-uv-scene', '#yeast-uv-notice', '#yeast-uv-desc'] };
  const L = window.B3InheritanceLogic;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const state = { pedigree: null, twoGene: null, meiosis: null, skin: null, planner: null, yeast: null, question: null, fields: {}, lastSection: 'overview' };
  let cleared = false, hadSaved = false, ready = false, RESPONSE_IDS = [];
  const STEP_LABELS = { copy: 'The DNA is copied', cross: 'Matching chromosomes swap sections', divide: 'Two divisions make four cells', join: 'Egg and sperm join' };

  function hash32(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function announce(text) { const e = $('#step-announcement'); if (!e) return; e.textContent = ''; setTimeout(function () { e.textContent = text; }, 30); }
  function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function copy(o) { try { return JSON.parse(JSON.stringify(o)); } catch (e) { return null; } }
  function studentIdentity() { return reportStudent?.() ?? null; }
  const num = x => typeof x === 'number' && isFinite(x);

  /* ---------- saved state ---------- */
  function readStore() {
    try {
      const d = JSON.parse((saveSession?.read(KEY) ?? null) || 'null');
      if (!d || d.v !== 1) return;
      hadSaved = true;
      SCENE_IDS.forEach(function (id) { if (d[id] && typeof d[id] === 'object') state[id] = d[id]; });
      if (d.question && typeof d.question === 'object') state.question = d.question;
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
      const rec = { v: 1, question: state.question, fields: state.fields, responseIds: RESPONSE_IDS, choiceResponseIds:picks().map(x=>x.id), lastSection: state.lastSection, lastVisitedAt: Date.now() };
      SCENE_IDS.forEach(function (id) { rec[id] = state[id]; });
      const result = saveSession?.write(KEY, JSON.stringify(rec)) ?? unavailableSave;
      if (result.ok) clearSaveProblem();
      $('#save-status').textContent = result.ok ? 'Saved on this device.' : showSaveProblem(result);
    } catch (e) { $('#save-status').textContent = 'This browser could not save your work. Download a copy before leaving.'; }
    renderReport();
  }
  function restoreFields() {
    Object.keys(state.fields || {}).forEach(function (id) {
      const v = state.fields[id];
      const radios = $$('input[type=radio][name="' + CSS.escape(id) + '"]');
      if (radios.length) { const r = radios.find(function (x) { return x.value === String(v); }); if (r) r.checked = true; return; }
      const e = document.getElementById(id);
      if (!e) return;
      if (e.type === 'checkbox') e.checked = !!v; else if (typeof v === 'string') e.value = v;
    });
  }

  /* ---------- tables and "Your data" boxes ---------- */
  function table(caption, head, rows) {
    const wrap = el('div', 'table-wrap'), t = el('table', 'data');
    // Wide tables can scroll on phones; give keyboard users the same access.
    wrap.tabIndex = 0;
    wrap.setAttribute('role', 'region');
    wrap.setAttribute('aria-label', caption);
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
  function pedigreeNodes() {
    const g = state.pedigree && state.pedigree.guesses; if (!g || typeof g !== 'object') return [];
    const ids = Object.keys(g).filter(function (id) { return Array.isArray(g[id]) && g[id].length; });
    if (!ids.length) return [];
    let right = 0;
    const rows = ids.map(function (id) {
      const person = L.LAKITA.persons.find(function (p) { return p.id === id; }); if (!person) return null;
      const r = L.checkGuess(L.LAKITA, id, g[id]);
      let mark = '○ Keep going';
      if (r.status === 'correct') { mark = '✓ Matches the model'; right++; }
      else if (r.status === 'wrong') mark = '✕ Not possible: ' + r.impossible.join(', ') + '. ' + L.explainImpossible(L.LAKITA, id, r.impossible[0]);
      else if (r.status === 'incomplete') mark = '○ Could also be: ' + r.missing.join(', ');
      return [person.label, L.normalizeGuess(g[id]).join(', ') || '—', mark];
    }).filter(Boolean);
    return [table('Genotypes you picked (A fixes mutations, B does not)', ['Person', 'My picks', 'Check'], rows), el('p', 'small muted', right + ' of ' + rows.length + ' people match the model. Untested people can be either.')];
  }
  function twoGeneNodes() {
    const g = state.twoGene && state.twoGene.genotypes; if (!g || typeof g !== 'object') return [];
    const rows = L.TWO_GENE.persons.filter(function (p) { return g[p.id] && g[p.id].p53 && g[p.id].brca1; }).map(function (p) {
      return [p.label, g[p.id].p53, g[p.id].brca1, L.twoGeneRisk(g[p.id].p53, g[p.id].brca1).text];
    });
    return rows.length ? [table('Genotypes and likelihood', ['Person', 'p53', 'BRCA1', 'Likelihood of cancer'], rows), el('p', 'small muted', 'A model of risk, not a prediction for any person.')] : [];
  }
  function meiosisNodes() {
    const runs = state.meiosis && Array.isArray(state.meiosis.runs) ? state.meiosis.runs.filter(function (r) { return r && Array.isArray(r.gametes); }) : [];
    if (!runs.length) return [];
    const types = function (c) { return Array.from(new Set([].concat.apply([], runs.filter(function (r) { return !!r.crossing === c; }).map(function (r) { return r.gametes; })))).sort(); };
    const a = types(false), b = types(true), rows = [];
    rows.push(['Gamete set A · without crossing over', a.length?a.join(', '):'No run recorded', a.length?String(a.length):'—']);
    rows.push(['Gamete set B · with crossing over', b.length?b.join(', '):'No run recorded', b.length?String(b.length):'—']);
    return [table('Kinds of gametes you made', ['Run', 'Gametes seen', 'Kinds'], rows), el('p', 'small muted', 'Simulated gametes from the meiosis model.')];
  }
  function skinNodes() {
    const v = state.skin && state.skin.viewed; if (!v || !Object.keys(v).some(function (k) { return v[k]; })) return [];
    const rows = ['white', 'black', 'hispanic'].filter(function (k) { return v[k]; }).map(function (k) {
      const r = L.skinCorrelation(k);
      return [L.SKIN_META.labels[k] + '-labeled graph', '✓ Viewed', r == null ? 'n/a' : r.toFixed(2)];
    });
    return [table('Graphs you looked at', ['Graph', 'Viewed', 'Correlation r (descriptive only)'], rows), el('p', 'small muted', 'Approximate values. A correlation shows a pattern, not a cause.')];
  }
  function plannerNodes() {
    const c = state.planner && Array.isArray(state.planner.conditions) ? state.planner.conditions : [];
    if (!c.length) return [];
    const rows = c.map(function (d) { return ['Dish ' + d.group, d.label || '', d.dark ? 'Dark' : (num(d.minutes) ? d.minutes + ' min UV' : '—'), d.foil ? 'Foil' : (num(d.spf) ? 'SPF ' + d.spf : 'No sunscreen')]; });
    const labels={yeast:'Kind and amount of yeast',distance:'Distance from the lamp',days:'Days of growing',
      agar:'Dish and food (agar)',time:'UV time (among exposed dishes)',cover:'Cover (sunscreen or foil)'};
    const controls=Array.isArray(state.planner.controls)?state.planner.controls.map(k=>labels[k]).filter(Boolean):[];
    return [table('Your dishes', ['Dish', 'Condition', 'Light', 'Cover'], rows),
      ...(controls.length?[el('p','small','Fair-test constants selected: '+controls.join('; ')+'. The dark control receives no UV.')]:[])];
  }
  function yeastNodes() {
    const d = state.yeast && Array.isArray(state.yeast.dishes) ? state.yeast.dishes.filter(function (x) { return x && num(x.colonies); }) : [];
    if (!d.length) return [];
    const rows = d.map(function (x) { return ['Dish ' + x.group, x.strain==='wild'?'Wild-type':x.strain==='sensitive'?'UV-sensitive':'—',
      x.label || '',num(x.dose)?x.dose.toFixed(2):'Not recorded',String(Math.max(0, Math.round(x.colonies))),x.rating || 'not rated yet']; });
    return [table('Simulated yeast dishes', ['Dish', 'Yeast strain', 'Condition', 'Relative UV dose (model units)', 'Colonies', 'Growth'], rows), el('p', 'small muted', 'SIMULATED. Not measurements from a real lab.')];
  }
  const BOXES = [['#data-pedigree-body', pedigreeNodes], ['#data-twogene-body', twoGeneNodes], ['#data-meiosis-body', meiosisNodes], ['#data-skin-body', skinNodes], ['#data-planner-body', plannerNodes], ['#data-yeast-body', yeastNodes]];
  function renderData() {
    BOXES.forEach(function (b) {
      const box = $(b[0]); if (!box) return;
      const nodes = b[1](); box.replaceChildren();
      if (!nodes.length) box.appendChild(el('p', 'muted', b[0] === '#data-skin-body' ? 'Open the graphs first. What you viewed will appear here.' : 'Run the model first. Your results will appear here.'));
      else nodes.forEach(function (n) { box.appendChild(n); });
    });    renderClaim(false);
  }
  function renderSkinTable() {
    const box = $('#skin-table'); if (!box) return;
    const sites = Object.keys(L.SITE_UV), rows = sites.map(function (s) {
      return [s, L.SITE_UV[s].toFixed(1)].concat(['white', 'black', 'hispanic'].map(function (g) { const p = L.SKIN_READINGS[g].find(function (q) { return q.site === s; }); return p ? String(p.rate) : '—'; }));
    });
    box.replaceChildren(table('Approximate melanoma incidence by site', ['Site', 'UV index', 'White-labeled', 'Black-labeled', 'Hispanic-labeled'], rows));
  }

  /* ---------- choices: instant feedback, recomputed from the picks ---------- */
  function feedbackEl(fs) {
    const id = 'feedback-' + (fs.dataset.id || ''); let p = document.getElementById(id);
    if (!p) { p = el('p', 'feedback'); p.id = id; fs.insertAdjacentElement('afterend', p); }
    return p;
  }
  function choiceResult(fs) {
    const c = $('input[type=radio]:checked', fs); if (!c) return null;
    if (fs.dataset.exit) { const r = L.checkExit(fs.dataset.exit, c.value); return { text: r.message, status: r.status, value: c.value }; }
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
    if (!fs.dataset.answer) return { picked, text: picked.length ? 'Good thinking. Any of these could matter, and a graph alone cannot tell which.' : '', status: 'poll' };
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

  /* ---------- tap-to-order ---------- */
  function orderSeq() { const v = $('#order-meiosis-seq').value; return v ? v.split(',').filter(Boolean) : []; }
  function renderOrder(speak) {
    const root = $('#order-meiosis'), seq = orderSeq(), choices = $('.order-choices', root), picked = $('.order-picked', root);
    if (!choices.children.length) {
      // Buttons appear in a fixed scrambled order so the answer is not the reading order.
      ['join', 'cross', 'copy', 'divide'].forEach(function (k) {
        const b = el('button', 'btn', STEP_LABELS[k]); b.type = 'button'; b.dataset.step = k;
        b.addEventListener('click', function () { const s = orderSeq(); if (!s.includes(k)) { s.push(k); $('#order-meiosis-seq').value = s.join(','); renderOrder(true); save(); } });
        choices.appendChild(b);
      });
    }
    $$('button', choices).forEach(function (b) { b.disabled = seq.includes(b.dataset.step); });
    picked.replaceChildren(); seq.forEach(function (k) { picked.appendChild(el('li', '', STEP_LABELS[k])); });
    const r = L.checkOrder(seq), fb = $('#feedback-order-meiosis'); fb.textContent = r.message; fb.dataset.state = r.status;
    if (speak && r.message) announce(r.message);
  }

  /* ---------- Question Tool ---------- */
  function renderQuestion(speak) {
    const f = parseInt($('#qt-frame').value, 10) || 0, iv = $('#qt-iv').value, dv = $('#qt-dv').value, own = $('#qt-own').value.trim();
    const built = iv && dv ? L.buildQuestion(f, iv, dv) : '', text = own || built;
    $('#qt-question').textContent = text || 'Choose both to build your question.';
    const ul = $('#qt-criteria'); ul.replaceChildren();
    if (!text) { state.question = null; return; }
    const r = L.checkQuestion(text, iv, dv), newPick = $('input[name="qt-new"]:checked');
    const labels = ['Names what you change and what you measure', 'Specific enough to test', 'Teaches something new'];
    r.criteria.forEach(function (c, i) {
      const met = i === 2 ? (newPick ? newPick.value === 'yes' : null) : c.met;
      ul.appendChild(el('li', '', (met === true ? '✓ ' : '○ ') + labels[i] + (i === 2 ? (met === null ? ': your call below.' : '.') : ': ' + c.hint)));
    });
    state.question = { text, iv, dv, ok: r.ok };
    if (speak) announce(r.ok ? 'Your question passes the first two checks.' : r.criteria.find(function (c) { return !c.met; }).hint);
  }

  /* ---------- claim self-check and C-to-T ---------- */
  const CLAIM_TEXT = { none: 'Pick a claim to begin. This is your own check, not a grade.', foundational: 'Foundational: add evidence and reasoning next.', linked: 'Linked: your claim has evidence. Add the reasoning and what the evidence cannot show.', organized: 'Organized: claim, evidence from your dishes and from the study or reading, reasoning, and a limit. Your selected statements about the dishes match your counted results. This is a self-check, not a grade.' };
  // Evidence chips about "my dishes" are checked against the student's own yeast table, so a statement the data do not show earns no credit.
  const EV_KEY = { 'cer-ev-1': 'more', 'cer-ev-2': 'dark', 'cer-ev-3': 'spf' };
  function whose(id, basis) { const b = basis[EV_KEY[id]]; return b === 'sensitive' ? 'Your UV-sensitive dishes' : b === 'wild' ? 'Your wild-type dishes' : 'Your dishes'; }
  function evidenceVerdicts(dishes) {
    const checks = L.evidenceChecks(dishes), basis = L.evidenceBasis(dishes);
    const counted = dishes.some(x=>x && num(x.colonies));
    const result = {};
    Object.keys(EV_KEY).forEach(function (id) {
      const v = checks[EV_KEY[id]], group = whose(id, basis);
      result[id] = v === true ? {status:'supported',message:group+' show this.'} :
        v === false ? {status:'unsupported',message:group+' do not show this. Check your table.'} :
          {status:'unverified',message:counted?'Count more dishes to check this.':'Count your dishes first to check this.'};
    });
    result['cer-ev-4'] = {status:'supported',message:'The White-labeled graph generally rises as UV increases. The pattern is less clear in the other two graphs. This is a pattern, not proof of cause.'};
    return result;
  }
  const evidenceMark = {supported:'✓ Supported:',unsupported:'✕ Not supported:',unverified:'Not yet checked:'};
  function currentEvidence(){ return evidenceVerdicts(Array.isArray(state.yeast?.dishes) ? state.yeast.dishes : []); }
  function renderClaim(speak) {
    const ck = id => $('#' + id).checked, claimEl = $('input[name="cer-claim"]:checked'), reason = $('input[name="cer-reason"]:checked');
    const verdicts = currentEvidence(), ok = {};
    let unsupported = false, unverified = false;
    Object.entries(verdicts).forEach(function ([id,v]) {
      const note = $('#' + id + '-note'), on = ck(id);
      ok[id] = on && v.status === 'supported';
      if (on && v.status === 'unsupported') unsupported = true;
      if (on && v.status === 'unverified') unverified = true;
      if (note) note.textContent = on ? evidenceMark[v.status]+' '+v.message : '';
    });
    const claimOk = !!claimEl && claimEl.value !== 'c', reasonOk = !!reason && reason.value === 'a';
    const flags = [claimOk, ok['cer-ev-1'] || ok['cer-ev-2'] || ok['cer-ev-3'], ok['cer-ev-4'] || reasonOk, reasonOk, ck('cer-caveat')];
    const review = unsupported ? 'Review your evidence: at least one selected statement does not match your dishes. Compare it with your table and revise your choices.' :
      unverified ? 'Check your evidence: count the dishes you need before using the selected statement.' : '';
    const level = review ? 'review' : L.claimLevel(flags), out = $('#cer-level');
    const bad = claimEl && claimEl.value === 'c' ? 'Your dishes did change with UV, so “UV has no effect” does not fit. Try another claim. ' : reason && !reasonOk ? 'Yeast do not choose the dark. Think about what UV does to DNA. ' : '';
    out.textContent = bad + (review || CLAIM_TEXT[level]); out.dataset.level = level;
    if (speak) announce(bad + (review || CLAIM_TEXT[level].split(':')[0]));
  }
  function renderCto() {
    const out = $('#cto-result'), t = $('#cto-codon').value, pos = parseInt($('#cto-pos').value, 10), r = L.cToT(t, pos);
    if (!r) { out.textContent = 'That letter in ' + t + ' is not a C, so this UV change does not apply. Pick another letter.'; return; }
    out.textContent = r.before + ' (' + r.aminoBefore + ') → ' + r.after + ' (' + r.aminoAfter + '): ' +
      (r.stop ? 'a Stop signal, so the protein would end early.' : r.same ? 'the same amino acid, so this change would not alter the protein.' : 'a different amino acid, so the protein’s shape could change.');
  }

  /* ---------- report, download, clear ---------- */
  function legendOf(fs) { const l = $('legend', fs); return l ? l.textContent.replace(/\s+/g, ' ').trim() : ''; }
  function labelFor(id) { const l = document.querySelector('label[for="' + id + '"]'); return l ? l.textContent.replace(/\s+/g, ' ').trim() : id; }
  function picks() {
    const out = [];
    $$('main fieldset.mcq[data-id]').forEach(function (fs) {
      const c = $('input[type=radio]:checked', fs), r = choiceResult(fs);
      out.push({ id: fs.dataset.id, question: legendOf(fs), answer: c ? c.parentElement.textContent.replace(/\s+/g, ' ').trim() : '', value: c ? c.value : '', result: r ? r.status : 'unanswered' });
    });
    return out;
  }
  function chips() {
    return $$('main fieldset.chipset').map(function (fs) {
      const checks = $$('input:checked', fs);
      const chosen = checks.map(b=>b.parentElement.textContent.trim());
      const chip = {id:fs.dataset.id||legendOf(fs),question:legendOf(fs),chosen};
      if(chip.id==='cer-evidence' && checks.length){
        const verdicts=currentEvidence();
        chip.evidence=checks.map((input,i)=>{
          const verdict=verdicts[input.id];
          return verdict ? chosen[i]+' · '+evidenceMark[verdict.status]+' '+verdict.message : chosen[i];
        });
      }
      return chip;
    });
  }
  function progressTracker() {
    const fields = $$('input[type=checkbox]', $('fieldset.tracker[data-id="tracker"]'));
    const rows = fields.map(input => [
      input.parentElement.textContent.replace(/\s+/g, ' ').trim(),
      input.checked ? 'Checked' : 'Not checked'
    ]);
    const count = rows.filter(([, status]) => status === 'Checked').length;
    return { title: 'Progress tracker · ' + count + ' of ' + rows.length + ' checked',
      columns: ['I can explain…', 'My self-check'], rows };
  }
  function textAnswers() { return $$('main textarea, main input[type=text]').filter(function (t) { return !t.readOnly && t.id; }).map(function (t) { return { id: t.id, prompt: labelFor(t.id), answer: t.value.trim() }; }); }
  function renderReport() {
    const report = $('#investigation-report'); if (!report) return;
    report.replaceChildren();
    report.appendChild(el('div', 'eyebrow', 'Inheritance, environment and cancer risk · My work'));
    report.appendChild(el('h3', '', 'Your work, at a glance.'));
    const student = studentIdentity();
    report.appendChild(el('p', 'report-student', student ? 'Student: ' + student.name + (student.period ? ' · Class period: ' + student.period : '') : 'Student name not entered. Sign in on the Biology Companion Activities dashboard before submitting.'));
    const p = picks(), answered = p.filter(function (x) { return x.value; }), good = p.filter(function (x) { return x.result === 'correct'; });
    const graded = $$('main fieldset.mcq[data-correct], main fieldset.mcq[data-exit]').length;
    const ul = el('ul', 'report-checks');
    [answered.length + ' of ' + p.length + ' choice questions answered', good.length + ' of ' + graded + ' checkable questions correct so far',
      SCENE_IDS.filter(function (id) { return state[id]; }).length + ' of 6 interactive models used',
      state.question ? 'My question: ' + state.question.text : 'My question: not built yet'].forEach(function (t) { ul.appendChild(el('li', '', t)); });
    report.appendChild(ul);
    const tracker = progressTracker();
    const trackerTable = table(tracker.title, tracker.columns, tracker.rows);
    trackerTable.classList.add('report-tracker');
    report.appendChild(trackerTable);
    BOXES.forEach(function (b) { b[1]().forEach(function (n) { report.appendChild(n); }); });
    textAnswers().forEach(function (t) { if (t.answer) { report.appendChild(el('h4', '', t.prompt)); report.appendChild(el('p', 'report-answer', t.answer)); } });
    report.appendChild(el('p', 'small muted', 'Simplified teaching models. Yeast and gamete results are simulated, skin-cancer values are approximate, and nothing here predicts anyone’s health or is a diagnosis.'));
  }
  function download() {
    save();
    const scenes = {}; SCENE_IDS.forEach(function (id) { scenes[id] = state[id]; });
    const payload = { format: 'openscied-b3-inheritance-environment-progress-v1', exportedAt: new Date().toISOString(), student: studentIdentity(),
      dataNote: 'Yeast dishes and gametes in this file are SIMULATED. Skin-cancer values are approximate readings of published figures. Nothing here is personal health information.',
      question: state.question, scenes, choices: picks(), chips: chips(), written: textAnswers(), tapOrder: orderSeq(), answers: state.fields };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = 'inheritance-environment-work.json'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }
  // Same rule as the other companions: clear this activity's record, then reload fresh at the Overview. Name and class period stay saved.
  function clearActivity() {
    const result = saveSession?.reset(KEY) ?? unavailableSave;
    if (!result.ok) { $('#reset-dialog').close(); $('#save-status').textContent = showSaveProblem(result, true); return; }
    $$('textarea, input[type=text], input[type=hidden], select').forEach(function (e) { if (e.tagName === 'SELECT') e.selectedIndex = 0; else e.value = ''; });
    $$('input[type=checkbox],input[type=radio]').forEach(function (e) { e.checked = e.defaultChecked; });
    cleared = true;
    try { history.replaceState(null, '', location.pathname + location.search + '#overview'); } catch (e) { /* ignore */ }
    location.reload();
  }

  /* ---------- scenes: public hooks and the placeholder ---------- */
  const scenes = {};
  const api = {
    version: 1, logic: L,
    getState: function () { const o = {}; SCENE_IDS.forEach(function (id) { o[id] = copy(state[id]); }); o.question = copy(state.question); return o; },
    getQuestion: function () { return copy(state.question); },
    saveState: function (id, data) { if (!SCENE_IDS.includes(id)) return; state[id] = data && typeof data === 'object' ? copy(data) : null; if (state[id]) state[id].updatedAt = state[id].updatedAt || Date.now(); renderData(); save(); },
    update: function (id, patch) { if (!SCENE_IDS.includes(id) || !patch || typeof patch !== 'object') return; api.saveState(id, Object.assign({}, state[id] || {}, copy(patch), { updatedAt: Date.now() })); },
    announce: announce,
    seed: function (salt) { const base = window.Lab && Lab.identity && Lab.identity.seed ? Lab.identity.seed.seed : 0; return (base + hash32(String(salt || ''))) >>> 0; },
    rng: function (salt) { return Lab.rng(api.seed(salt)); },
    registerScene: function (scene) { if (!scene || !HOSTS[scene.id] || typeof scene.mount !== 'function') return; scenes[scene.id] = scene; if (ready) mountScene(scene.id); }
  };
  window.B3Inh = api;
  function mountScene(id) {
    const host = $(HOSTS[id][0]), notice = $(HOSTS[id][1]);
    if (!host || !scenes[id] || host.dataset.mounted) return;
    host.dataset.mounted = '1'; if (notice) notice.hidden = true;
    try { scenes[id].mount(host, api); } catch (e) { host.dataset.mounted = ''; if (notice) { notice.hidden = false; notice.textContent = 'The interactive model could not start. Reload the page to try again.'; } }
  }
  function css(name, fallback) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback; }
  // Preview picture used only while no scene is registered. Simple shapes by scene, in site tokens, with text so it is not color-only.
  const TITLES = { pedigree: 'Preview: a family tree', twoGene: 'Preview: two genes on one chromosome', meiosis: 'Preview: a parent cell making four gametes', skin: 'Preview: UV index against melanoma rate', planner: 'Preview: seven petri dishes', yeast: 'Preview: a petri dish with yeast colonies' };
  function drawPreview(id) {
    const host = $(HOSTS[id][0]); if (!host || host.dataset.mounted) return;
    const canvas = $('canvas', host); if (!canvas || !canvas.getContext) return;
    const w = Math.max(280, Math.floor(host.clientWidth || 640)), h = Math.round(Math.max(150, w * 340 / 960)), dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); canvas.style.width = '100%'; canvas.style.aspectRatio = w + ' / ' + h;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const ink = css('--ink', '#14211c'), muted = css('--muted', '#56665f'), accent = css('--accent', '#0d6e55'), bg = css('--surface-2', '#e8eeea'), soft = css('--accent-soft', '#cfe9df');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = ink; ctx.lineWidth = 2; ctx.fillStyle = soft;
    const cy = h * 0.45, s = Math.min(h * 0.22, 34);
    if (id === 'pedigree') { [[0.35, 0.28], [0.65, 0.28]].forEach(function (p, i) { ctx.beginPath(); if (i) ctx.arc(w * p[0], h * p[1], s / 2, 0, 7); else ctx.rect(w * p[0] - s / 2, h * p[1] - s / 2, s, s); ctx.fill(); ctx.stroke(); });
      for (let i = 0; i < 4; i++) { const x = w * (0.2 + i * 0.2); ctx.beginPath(); ctx.moveTo(w * 0.5, h * 0.28); ctx.lineTo(x, h * 0.62); ctx.stroke(); ctx.beginPath(); if (i % 2) ctx.arc(x, h * 0.68, s / 2, 0, 7); else ctx.rect(x - s / 2, h * 0.68 - s / 2, s, s); ctx.fill(); ctx.stroke(); } }
    else if (id === 'skin') { ctx.beginPath(); ctx.moveTo(w * 0.15, h * 0.15); ctx.lineTo(w * 0.15, h * 0.7); ctx.lineTo(w * 0.85, h * 0.7); ctx.stroke(); ctx.fillStyle = accent; for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.arc(w * (0.22 + i * 0.07), h * (0.62 - i * 0.04 + (i % 3) * 0.03), 4, 0, 7); ctx.fill(); } }
    else if (id === 'planner' || id === 'yeast') { const n = id === 'planner' ? 7 : 3; for (let i = 0; i < n; i++) { const x = w * (0.5 + (i - (n - 1) / 2) * (n > 3 ? 0.11 : 0.22)), r = Math.min(h * 0.2, w * (n > 3 ? 0.045 : 0.09)); ctx.beginPath(); ctx.arc(x, cy, r, 0, 7); ctx.fill(); ctx.stroke(); if (id === 'yeast') { ctx.fillStyle = accent; for (let k = 0; k < 14 - i * 5; k++) { ctx.beginPath(); ctx.arc(x + Math.cos(k * 2.4) * r * 0.6 * ((k % 4 + 1) / 4), cy + Math.sin(k * 2.4) * r * 0.6 * ((k % 4 + 1) / 4), 2.5, 0, 7); ctx.fill(); } ctx.fillStyle = soft; } } }
    else { [0.4, 0.6].forEach(function (p) { ctx.beginPath(); ctx.moveTo(w * p, h * 0.15); ctx.lineTo(w * p, h * 0.65); ctx.lineWidth = 12; ctx.strokeStyle = accent; ctx.lineCap = 'round'; ctx.stroke(); }); ctx.lineWidth = 2; ctx.strokeStyle = ink; }
    ctx.fillStyle = muted; ctx.font = '600 13px system-ui, sans-serif'; ctx.textAlign = 'left';
    ctx.fillText(TITLES[id], 20, h - 14);
  }
  function showPlaceholders() {
    SCENE_IDS.forEach(function (id) { if (scenes[id]) return; const notice = $(HOSTS[id][1]); if (notice) notice.hidden = false; drawPreview(id); });
  }

  /* ---------- wiring ---------- */
  function resumeBar() {
    const bar = $('#resume-bar'); if (!bar) return;
    if (location.hash || state.lastSection === 'overview') { bar.hidden = true; return; }
    const target = $('#' + state.lastSection); if (!target) return;
    const a = $('a', bar); a.href = '#' + state.lastSection; a.textContent = 'Resume: ' + target.dataset.step; bar.hidden = false;
  }
  function renderAll() { $$('main fieldset.mcq[data-id]').forEach(function (fs) { renderChoice(fs, false); }); $$('main fieldset.chipset').forEach(function (fs) { renderChips(fs, false); }); renderOrder(false); renderQuestion(false); renderClaim(false); renderCto(); }
  function wire() {
    readStore();
    RESPONSE_IDS = Array.from(new Set($$('main input[type=radio]').map(function (r) { return r.name; }).concat($$('main textarea').filter(function (t) { return !t.readOnly && t.id; }).map(function (t) { return t.id; }), ['qt-own', 'order-meiosis-seq'])));
    restoreFields();
    renderSkinTable(); renderData(); renderAll(); resumeBar();
    ready = true;
    (window.B3InhScenes || []).forEach(function (s) { api.registerScene(s); });
    window.B3InhScenes = { push: function (s) { api.registerScene(s); } };
    showPlaceholders();
    window.addEventListener('hashchange', save);
    let pending = 0;
    const redraw = function () { SCENE_IDS.forEach(drawPreview); };
    window.addEventListener('resize', function () { cancelAnimationFrame(pending); pending = requestAnimationFrame(redraw); }, { passive: true });
    document.addEventListener('companion:show', redraw);
    new MutationObserver(redraw).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    if (window.matchMedia) { const m = matchMedia('(prefers-color-scheme: dark)'); if (m.addEventListener) m.addEventListener('change', redraw); }
    $$('main input, main textarea, main select').forEach(function (e) { e.addEventListener('change', save); e.addEventListener('input', save); });
    $$('main fieldset.mcq[data-id]').forEach(function (fs) { fs.addEventListener('change', function () { renderChoice(fs, true); if (fs.dataset.id === 'qt-new') renderQuestion(false); }); });
    $$('main fieldset.chipset').forEach(function (fs) { fs.addEventListener('change', function () { renderChips(fs, true); }); });
    $('#cer').addEventListener('change', function () { renderClaim(true); });
    ['qt-frame', 'qt-iv', 'qt-dv', 'qt-own'].forEach(function (id) { $('#' + id).addEventListener('input', function () { renderQuestion(true); save(); }); $('#' + id).addEventListener('change', function () { renderQuestion(true); save(); }); });
    ['cto-codon', 'cto-pos'].forEach(function (id) { $('#' + id).addEventListener('change', renderCto); });
    $('[data-order-reset]').addEventListener('click', function () { $('#order-meiosis-seq').value = ''; renderOrder(false); save(); announce('Order cleared.'); });
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
  function submissionReport() {
    const answer = (prompt,value) => ({type:'answer',prompt,value:value || ''});
    const hasList = x => Array.isArray(x) && x.length > 0;
    const hasEntries = x => x && Object.keys(x).length > 0;
    const seen = [
      ['Lakita’s pedigree',!!hasEntries(state.pedigree?.guesses)],
      ['Two-gene inheritance',!!(hasEntries(state.twoGene?.genotypes) || hasEntries(state.twoGene?.traced) || hasList(state.twoGene?.mismatch) || state.twoGene?.carrier)],
      ['Meiosis and crossing over',hasList(state.meiosis?.runs)],
      ['Published skin-cancer graphs',!!(hasEntries(state.skin?.polls) || Object.values(state.skin?.viewed || {}).some(v=>v===true))],
      ['UV experiment plan',!!(state.planner?.ready || (hasList(state.planner?.conditions) && state.planner?.iv && state.planner?.dv))],
      ['UV yeast simulation',state.yeast?.dishes?.some(x=>Number.isFinite(x?.colonies)) || false]
    ];
    const done = seen.filter(([,used])=>used).length;
    const selected = picks(), allChips = chips();
    const response = textAnswers(), order = orderSeq(), aMissing = [], bMissing = [];
    const family = seen.slice(0,3), environment = seen.slice(3);
    const unused = entries => entries.filter(([,used])=>!used).map(([label])=>label);
    if (unused(family).length) aMissing.push('Use the remaining Lesson 8 models: ' + unused(family).join('; ') + '.');
    if (unused(environment).length) bMissing.push('Use the remaining Lesson 9 evidence: ' + unused(environment).join('; ') + '.');
    if (!state.question?.ok) bMissing.push('Build a testable question in the Question Tool.');
    const answered = id => selected.some(x=>x.id===id && !!x.value);
    if (!answered('cer-claim') || !answered('cer-reason') || !allChips.some(x=>x.id==='cer-evidence' && x.chosen.length)) {
      bMissing.push('Complete the yeast claim, evidence and reasoning builder. Your teacher reviews your explanation.');
    }
    if (selected.some(x=>/^exit-/.test(x.id) && !x.value)) aMissing.push('Answer the remaining Lesson 8 exit-ticket choices.');
    if (L.checkOrder(order).status !== 'correct') aMissing.push('Complete the meiosis ordering check.');
    if (!response.find(x=>x.id==='wrap-sentence')?.answer.trim()) bMissing.push('Write the wrap-up response on genes, environment and chance.');
    const lesson9Only = !bMissing.length && !!aMissing.length;
    const missing = lesson9Only ? [] : [...bMissing, ...aMissing];
    const beforeLesson9 = id => SECTIONS.indexOf(id) > 0 && SECTIONS.indexOf(id) < SECTIONS.indexOf('envideas');
    const partA = new Set($$('main .step').filter(section=>beforeLesson9(section.id))
      .flatMap(section=>$$('fieldset[data-id], textarea[id], input[type=text][id]',section).map(field=>field.dataset.id || field.id)));
    const scopedChoices = lesson9Only ? selected.filter(x=>!partA.has(x.id)) : selected;
    const formatModels = boxes => boxes.flatMap(([,build])=>build().map(node=>{
      const table = node.querySelector('table');
      if (!table) return {type:'text',text:node.textContent};
      return {type:'table',title:table.caption?.textContent,columns:Array.from(table.tHead.rows[0].cells,c=>c.textContent),
        rows:Array.from(table.tBodies[0].rows,r=>Array.from(r.cells,c=>c.textContent))};
    }));
    const orderAnswer = answer('My meiosis order',order.map(k=>STEP_LABELS[k]).filter(Boolean).join(' → '));
    const sections = [{title:'Assignment scope',items:[
      {type:'text',text:'Lesson 9: Environment and UV evidence ' + (bMissing.length?'in progress.':'recorded.')},
      ...(lesson9Only ? [{type:'text',text:'This report marks only the Lesson 9 pathway complete. Family activities are not required for this pathway.'}] :
        [{type:'text',text:'Lesson 8: Family and inheritance models ' + (aMissing.length?'not marked complete.':'recorded.')}])
    ]},{title:'My progress tracker',items:[
      {type:'table',...progressTracker()}
    ]},{title:'My evidence',items:[
      {type:'table',title:'Models and evidence used',columns:['Activity','Status'],rows:(lesson9Only?environment:seen).map(([label,used])=>[label,used?'Recorded':'Not recorded'])},
      ...formatModels(lesson9Only?BOXES.slice(3):BOXES)
    ]},{
      title:'My question and responses',items:[
        answer('My investigation question',state.question?.text),
        ...scopedChoices.map(x=>answer(x.question,x.answer)),
        ...allChips.filter(x=>x.id!=='tracker'&&(!lesson9Only||!partA.has(x.id))).map(x=>answer(x.question,x.evidence?.join('\n') ?? x.chosen.join('; '))),
        ...(!lesson9Only?[orderAnswer]:[]),
        ...response.filter(x=>x.answer&&(!lesson9Only||!partA.has(x.id))).map(x=>answer(x.prompt,x.answer))
      ]
    }];
    if (lesson9Only) {
      const earlier = [
        ...formatModels(BOXES.slice(0,3).filter((entry,i)=>family[i][1])),
        ...selected.filter(x=>partA.has(x.id)&&x.value).map(x=>answer(x.question,x.answer)),
        ...allChips.filter(x=>partA.has(x.id)&&x.chosen.length).map(x=>answer(x.question,x.chosen.join('; '))),
        ...(orderAnswer.value?[orderAnswer]:[]),
        ...response.filter(x=>x.answer&&partA.has(x.id)).map(x=>answer(x.prompt,x.answer))
      ];
      if (earlier.length) sections.push({title:'Earlier Lesson 8 work · not part of this assignment',items:earlier});
    }
    sections.push({title:'Sources and limits',items:[{type:'text',text:'Yeast and any gamete results shown are simulated. Skin-cancer observations are approximate readings of the lesson figures (Eide and Weinstock, 2005; doi:10.1001/archderm.141.4.477). Those figures do not state the y-axis unit. Group patterns cannot determine an individual’s risk or show cause.'}]});
    return {title:lesson9Only?'Environment & UV Evidence · Lesson 9':'Inheritance, Environment & Cancer Risk',unit:'OpenSciEd Biology B.3',
      source:'Models and approximate values from published figures; not a personal diagnosis or prediction.',
      status:!saveSession?.check(KEY).ok ? 'recovery' : missing.length ? 'draft' : 'final',missing,student:studentIdentity(),
      keyResults:[{label:'Model or evidence activities used',value:lesson9Only?'3 of 3 lesson 9 activities':done+' of '+seen.length},
        {label:'Choice responses entered',value:scopedChoices.filter(x=>x.value).length+' of '+scopedChoices.length}],sections};
  }

  window.OpenSciEdSubmission?.mount({target:'#ose-submission-report',collect:submissionReport});
})();

