/* DNA Copying, p53 and Gene Expression: companion for OpenSciEd Biology B.3, Lessons 5-6.
   Same structure as the Cell Cycle companion: one saved record in localStorage, one live announcer, a report, a download
   and a "Clear this activity" dialog. Student work lives only in this browser.

   SAVED STATE (localStorage 'aplab:openscied:b3-dna-p53:v1'), format v1:
     { v:1,
       fork:        null | { before:{top,bottom}, after:{top,bottom}, p53:{a,b,c}, ... }   written by the DNA fork scene
       expression:  { runs:[ run, ... ] }                                                   written by the gene expression scene
       fields:      { <element id or radio name>: value }     every textarea, text box, select, checkbox and radio on the page
       feedback:    { <radio name>: text }                    feedback shown for a checked answer
       responseIds: [ ... ]                                   every written-response id (the dashboard counts these)
       lastSection, lastVisitedAt }
   The cell-cycle key ('aplab:openscied:b3-cell-cycle:v1') is never read or written here.

   DATA CONTRACT FOR THE TWO SCENES (full text: docs/b3-dna-p53-scenes.md)
   fork = {                                   // Lesson 5 handout table, filled by the scene; counts are whole numbers >= 0
     seed:   number,                          // seed used, from B3DnaP53.seed('fork')
     steps:  { unwound:bool, unzipped:bool }, // optional progress through the first steps
     before: { top:{correct,substitutions}, bottom:{correct,substitutions} },   // after pairing, before p53
     p53:    { a:{tried,removed}, b:{tried,removed}, c:{tried,removed} },        // how many times each version was applied / substitutions it removed
     after:  { top:{correct,substitutions}, bottom:{correct,substitutions} },   // after p53 and replacing letters
     updatedAt: ms timestamp }
   run = { strand:'A'|'B'|'C'|'custom', dna, copy, edited, aminoAcids:[...], sentence, matchesKey:bool, injectedError:bool, at:ms }
   Scene registration (either way works, so script order never matters):
     (window.B3DnaP53Scenes = window.B3DnaP53Scenes || []).push({ id:'fork'|'expression', mount(host, api) {...} })
     or  B3DnaP53.registerScene({ id, mount })
   mount(host, api): host is #dna-fork-scene or #gene-expression-scene. It holds a <canvas> (reuse or replace it) and a
   .scene-desc text region (keep it current for screen readers). api = window.B3DnaP53:
     api.saveFork(fork) / api.saveExpression({runs}) / api.addExpressionRun(run)   write and save
     api.getState()   copy of {fork, expression}
     api.announce(text)   the page's only live region
     api.seed(salt) / api.rng(salt)   per-student seeded randomness
     api.logic   B3DnaP53Logic (strands, cards, real codon table, rates)
   The "coming in the next update" notice is shown only when no scene registered for that host. */
(function () {
  'use strict';
  const KEY = 'aplab:openscied:b3-dna-p53:v1';
  const SECTIONS = ['overview', 'ideas', 'fork', 'sense5', 'checklist', 'explain', 'expression', 'sense6', 'wrapup'];
  const L = window.B3DnaP53Logic;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const state = { fork: null, expression: { runs: [] }, fields: {}, feedback: {}, lastSection: 'overview' };
  let cleared = false, hadSaved = false, ready = false, RESPONSE_IDS = [];
  const RADIO_NAMES = ['exit-q1', 'exit-q2', 'exit-q4'];
  const EXIT_CORRECT = { 'exit-q1': 'a', 'exit-q2': 'e', 'exit-q4': 'd' };
  const EXIT_WHY = {
    'exit-q1': { a: 'Yes. The reading says DNA is organized into chromosomes and genes code for proteins, and the picture shows that genes are sections of the chromosome. This answer uses both.',
      b: 'Try again. Why not: this is true, but it leaves out where genes are. The picture shows that genes are sections of a chromosome.',
      c: 'Try again. Why not: this is true and comes from the picture, but it leaves out that chromosomes are made of DNA and that genes code for proteins, which come from the reading.' },
    'exit-q2': { e: 'Yes. All four ideas help: a changed code can make a protein with a different shape, and a different shape fits the DNA better or worse, which changes how well p53 can correct mutations.' },
    'exit-q4': { d: 'Yes. All three statements are true. p53 (a) has 9 amino acids, p53 (b) has 8 with one different, and the difference changes the protein’s shape.' }
  };
  const PARTIAL = 'Try again. Why not: this idea is true and helps, but it is only one part. Reread all the choices, and look for the one that includes everything.';

  function studentIdentity() { return window.Lab && Lab.identity ? Lab.identity.get() : null; }
  function hash32(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function announce(text) { const el = $('#announcer'); if (!el) return; el.textContent = ''; setTimeout(function () { el.textContent = text; }, 30); }
  function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function copy(o) { try { return JSON.parse(JSON.stringify(o)); } catch (e) { return null; } }

  /* ---------- saved state ---------- */
  function readStore() {
    try {
      const d = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (!d || d.v !== 1) return;
      hadSaved = true;
      if (d.fork && typeof d.fork === 'object') state.fork = d.fork;
      if (d.expression && Array.isArray(d.expression.runs)) state.expression = { runs: d.expression.runs.slice(0, 50) };
      if (d.fields && typeof d.fields === 'object') state.fields = d.fields;
      if (d.feedback && typeof d.feedback === 'object') state.feedback = d.feedback;
      if (SECTIONS.includes(d.lastSection)) state.lastSection = d.lastSection;
    } catch (e) { /* unreadable saved work: start fresh in memory */ }
  }
  function collectFields() {
    const f = {};
    $$('main input, main textarea, main select').forEach(function (x) {
      if (x.readOnly || x.type === 'button') return;
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
      localStorage.setItem(KEY, JSON.stringify({ v: 1, fork: state.fork, expression: state.expression, fields: state.fields, feedback: state.feedback,
        responseIds: RESPONSE_IDS, lastSection: state.lastSection, lastVisitedAt: Date.now() }));
      $('#save-status').textContent = 'Saved on this device.';
    } catch (e) { $('#save-status').textContent = 'This browser could not save your work. Download a copy before leaving.'; }
    renderReport();
  }
  function restoreFields() {
    Object.keys(state.fields || {}).forEach(function (id) {
      const v = state.fields[id];
      if (RADIO_NAMES.includes(id)) { const r = $('input[name="' + id + '"][value="' + CSS.escape(String(v)) + '"]'); if (r) r.checked = true; return; }
      const e = document.getElementById(id);
      if (!e) return;
      if (e.type === 'checkbox') e.checked = !!v; else if (typeof v === 'string') e.value = v;
    });
    RADIO_NAMES.forEach(function (n) { const out = $('#feedback-' + n); if (out && state.feedback[n]) out.textContent = state.feedback[n]; });
  }

  /* ---------- "Your data" boxes ---------- */
  function table(caption, head, rows) {
    const wrap = el('div', 'table-wrap'), t = el('table', 'data');
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
  function rate(r) { return r == null ? 'n/a' : r.toFixed(1) + '%'; }
  function forkDataNodes() {
    const s = L.forkSummary(state.fork), out = [];
    if (!s) return out;
    const rows = (part) => [['Top strand', part.top.correct, part.top.substitutions, rate(part.top.rate)], ['Bottom strand', part.bottom.correct, part.bottom.substitutions, rate(part.bottom.rate)]];
    if (s.hasBefore) out.push(table('After pairing, before p53', ['Strand', 'Correctly paired', 'Substitutions', 'Substitution rate'], rows(s.before)));
    if (s.hasP53) {
      const p = el('p', '', 'p53 versions tried: ' + ['a', 'b', 'c'].map(function (v) { return 'p53 (' + v + '): applied ' + s.p53[v].tried + ' time' + (s.p53[v].tried === 1 ? '' : 's') + ', removed ' + s.p53[v].removed + ' substitution' + (s.p53[v].removed === 1 ? '' : 's'); }).join(' · ') + '.');
      out.push(p);
    }
    if (s.hasAfter) out.push(table('After p53 and replacing letters', ['Strand', 'Correctly paired', 'Substitutions', 'Substitution rate'], rows(s.after)));
    out.push(el('p', 'small muted', 'Simulated counts from the DNA fork model.'));
    return out;
  }
  function expressionDataNodes() {
    const runs = state.expression && Array.isArray(state.expression.runs) ? state.expression.runs : [];
    if (!runs.length) return [];
    const rows = runs.map(function (r, i) {
      const aa = Array.isArray(r.aminoAcids) ? r.aminoAcids.join('-') : '';
      return ['Run ' + (i + 1) + ': Strand ' + (r.strand || '?'), r.sentence || '(no sentence)', r.matchesKey ? '✓ matches the key' : '✕ differs from the key', r.injectedError ? 'Yes' : 'No', aa];
    });
    const out = [table('Strands you ran', ['Run', 'Sentence', 'Compared with the key', 'Copying error added', 'Amino acids'], rows)];
    out.push(el('p', 'small muted', 'Simulated results from the gene expression model.'));
    return out;
  }
  function renderData() {
    const fork = forkDataNodes(), expr = expressionDataNodes();
    [['#data-fork-body', fork, 'Run the model first. Your counts will appear here.'], ['#data-sense5-body', fork, 'Run the model first. Your counts will appear here.'],
      ['#data-expression-body', expr, 'Run the model first. The strands you tried will appear here.'], ['#data-sense6-body', expr, 'Run the model first. The strands you tried will appear here.']]
      .forEach(function (x) {
        const box = $(x[0]); if (!box) return;
        box.replaceChildren();
        if (!x[1].length) box.appendChild(el('p', 'muted', x[2]));
        else x[1].forEach(function (n) { box.appendChild(n.cloneNode(true)); });
      });
  }

  /* ---------- checklist, self-check, first-ideas echo ---------- */
  function renderChecklist() {
    let withEvidence = 0;
    $$('#checklist-table tbody tr').forEach(function (tr) {
      const k = tr.dataset.row, have = $('#cl-' + k + '-have').value.trim(), src = $$('input[type=checkbox]', tr).some(function (c) { return c.checked; });
      const s = $('#cl-status-' + k);
      if (have) withEvidence++;
      s.textContent = have && src ? '✓ Evidence and source' : have ? '○ Add where it came from' : '';
      tr.classList.toggle('is-done', !!(have && src));
    });
    $('#checklist-count').textContent = withEvidence + ' of 7 rows have evidence written.';
  }
  const LEVEL_TEXT = {
    none: 'Tick the ideas your explanation includes.',
    foundational: 'Foundational: you have some of the ideas. Next, link them: how do copying mistakes lead to differences in chromosomes?',
    linked: 'Linked: you connect mistakes in the DNA to differences in chromosomes. Next, explain the whole process, including how p53 fixes a mismatch and why only one version works.',
    organized: 'Organized: your explanation covers the copying process, how mistakes happen, how p53 fixes them, and what that means for the new cells. To stretch further, predict what would happen in daughter cells that only had p53 (b) or p53 (c).'
  };
  function selfFlags() { return [0, 1, 2, 3, 4, 5].map(function (i) { return $('#ex-el-' + i).checked; }); }
  function renderSelfLevel(speak) {
    const level = L.explanationLevel(selfFlags());
    $('#self-level').textContent = LEVEL_TEXT[level] + (level === 'none' ? '' : ' (This is your own check, not a grade.)');
    $('#self-level').dataset.level = level;
    if (speak) announce(LEVEL_TEXT[level].split(':')[0]);
  }
  function renderEcho() {
    const parts = [['What I knew about chromosomes', 'ideas-chromosomes'], ['Chromosomes at the end of the Cell Game', 'ideas-compare'], ['What could make them different', 'ideas-why']]
      .map(function (p) { return [p[0], $('#' + p[1]).value.trim()]; }).filter(function (p) { return p[1]; });
    const box = $('#first-ideas-text'); box.replaceChildren();
    if (!parts.length) { box.className = 'muted'; box.textContent = 'You have not written first ideas yet. You can add them in section 2.'; return; }
    box.className = '';
    parts.forEach(function (p) { const d = el('p'); d.appendChild(el('strong', '', p[0] + ': ')); d.appendChild(document.createTextNode(p[1])); box.appendChild(d); });
  }
  function rubricText() {
    const rows = $$('#rubric-table tbody tr').map(function (tr) { return '- ' + $('th', tr).textContent + ' | ' + $('td', tr).textContent; });
    return 'Peer feedback rubric. Lesson question: How do cancer cells end up with differences in their chromosomes, and what is the role of p53 in preventing the differences?\n' +
      'For each important idea, check if it is present and write specific feedback.\n' + rows.join('\n') +
      '\nSentence starters: You have good evidence to support ___. It would be more complete if you added ___. / I agree that ___. I think you should add more evidence from ___. / Did you include all of the important ideas?\n' +
      'Feedback should be specific enough that the author could make a change because of it.';
  }
  function copyRubric() {
    const text = rubricText(), status = $('#copy-rubric-status'), area = $('#rubric-text');
    function fallback() {
      area.value = text; area.hidden = false; area.focus(); area.select();
      let ok = false; try { ok = document.execCommand('copy'); } catch (e) { /* ignore */ }
      status.textContent = ok ? 'Copied.' : 'Select the text below and copy it.'; announce(status.textContent);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { status.textContent = 'Copied.'; announce('Peer rubric copied.'); }, fallback);
    else fallback();
  }
  function checkSentence() {
    const strand = $('#expr-strand').value, typed = $('#expr-sentence').value, out = $('#sentence-feedback');
    let msg;
    if (!strand || !typed.trim()) msg = 'Choose a strand and type your sentence first.';
    else {
      const r = L.checkSentence(strand, typed);
      if (r === 'match') msg = '✓ Match. Your sentence agrees with the key for Strand ' + strand + '.';
      else {
        const other = Object.keys(L.KEY_SENTENCE).find(function (k) { return k !== strand && L.checkSentence(k, typed) === 'match'; });
        msg = other ? '✕ That is the key sentence for Strand ' + other + ', not Strand ' + strand + '. Did you pick the right strand?'
          : '✕ It does not match the key for Strand ' + strand + '. Check each group of three, in order. A copying slip would give a different sentence, like a new mutation.';
      }
    }
    out.textContent = msg; state.feedback.sentence = msg; announce(msg); save();
  }

  /* ---------- exit ticket ---------- */
  function checkExit(name) {
    const choice = $('input[name="' + name + '"]:checked'), out = $('#feedback-' + name);
    let msg;
    if (!choice) msg = 'Choose one answer first.';
    else if (choice.value === EXIT_CORRECT[name]) msg = (EXIT_WHY[name][choice.value]) || 'Yes.';
    else msg = (EXIT_WHY[name] && EXIT_WHY[name][choice.value]) || PARTIAL;
    out.textContent = msg; state.feedback[name] = choice ? msg : ''; announce(msg); save();
  }

  /* ---------- report, download, clear ---------- */
  function labelFor(id) { const l = document.querySelector('label[for="' + id + '"]'); return l ? l.textContent.replace(/\s+/g, ' ').trim() : id; }
  function written(id) { const e = document.getElementById(id); return !!(e && e.value && e.value.trim()); }
  function renderReport() {
    const report = $('#investigation-report'); if (!report) return;
    report.replaceChildren();
    report.appendChild(el('div', 'eyebrow', 'DNA copying, p53 and gene expression · My evidence'));
    report.appendChild(el('h3', '', 'Your investigation, at a glance.'));
    const student = studentIdentity();
    report.appendChild(el('p', 'report-student', student ? 'Student: ' + student.name + (student.period ? ' · Class period: ' + student.period : '') : 'Student name not entered. Sign in on the Biology Companion Activities dashboard before submitting.'));
    const ul = el('ul', 'report-checks');
    const done = RESPONSE_IDS.filter(function (id) { return RADIO_NAMES.includes(id) ? !!$('input[name="' + id + '"]:checked') : written(id); }).length;
    const fs = L.forkSummary(state.fork), runs = state.expression.runs.length;
    [done + ' of ' + RESPONSE_IDS.length + ' responses written', fs ? 'DNA fork: results recorded' : 'DNA fork: not run yet', runs + ' gene expression run' + (runs === 1 ? '' : 's') + ' recorded',
      'Explanation self-check: ' + L.explanationLevel(selfFlags())].forEach(function (t) { ul.appendChild(el('li', '', t)); });
    report.appendChild(ul);
    forkDataNodes().concat(expressionDataNodes()).forEach(function (n) { report.appendChild(n); });
    RESPONSE_IDS.forEach(function (id) {
      let value;
      if (RADIO_NAMES.includes(id)) { const c = $('input[name="' + id + '"]:checked'); value = c ? c.parentElement.textContent.trim() + (c.value === EXIT_CORRECT[id] ? ' (correct)' : ' (not the best answer yet)') : ''; }
      else value = (document.getElementById(id) || { value: '' }).value.trim();
      report.appendChild(el('h4', '', RADIO_NAMES.includes(id) ? ({ 'exit-q1': 'Exit ticket 1', 'exit-q2': 'Exit ticket 2', 'exit-q4': 'Exit ticket 4' })[id] : labelFor(id)));
      report.appendChild(el('p', 'report-answer', value || 'Not answered yet.'));
    });
    report.appendChild(el('p', 'small muted', 'Simplified teaching models. All model numbers are simulated, not measurements from a cell, and nothing here predicts anyone’s health or is a diagnosis.'));
  }
  function download() {
    save();
    const exit = {};
    RADIO_NAMES.forEach(function (n) { const c = $('input[name="' + n + '"]:checked'); exit[n] = { answer: c ? c.value : '', correct: c ? c.value === EXIT_CORRECT[n] : null }; });
    const checklist = $$('#checklist-table tbody tr').map(function (tr) {
      const k = tr.dataset.row;
      return { row: $('th', tr).childNodes[0].textContent.trim(), evidenceIHave: $('#cl-' + k + '-have').value, sources: $$('input[type=checkbox]', tr).filter(function (c) { return c.checked; }).map(function (c) { return c.parentElement.textContent.trim(); }), evidenceINeed: $('#cl-' + k + '-need').value };
    });
    const responses = {};
    RESPONSE_IDS.forEach(function (id) { responses[id] = { prompt: labelFor(id), answer: RADIO_NAMES.includes(id) ? (exit[id] || {}).answer || '' : (document.getElementById(id) || { value: '' }).value }; });
    const payload = { format: 'openscied-b3-dna-p53-progress-v1', exportedAt: new Date().toISOString(), student: studentIdentity(),
      dataNote: 'All model data in this file is simulated by the DNA fork and gene expression models. It is not measured from a cell.',
      fork: state.fork, forkSummary: L.forkSummary(state.fork), expression: state.expression,
      explanationSelfCheck: { level: L.explanationLevel(selfFlags()), ideasIncluded: selfFlags() }, exitTicket: exit, checklist: checklist, responses: responses, answers: state.fields };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = 'dna-copying-p53-work.json'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }
  // Same rule as the Cell Cycle companion: clear this activity's record, then reload fresh at the Overview.
  // Name and class period are site-wide and stay saved.
  function clearActivity() {
    $$('textarea, input[type=text], select').forEach(function (e) { if (e.tagName === 'SELECT') e.selectedIndex = 0; else e.value = ''; });
    $$('input[type=checkbox],input[type=radio]').forEach(function (e) { e.checked = e.defaultChecked; });
    cleared = true;
    try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
    try { history.replaceState(null, '', location.pathname + location.search + '#overview'); } catch (e) { /* ignore */ }
    location.reload();
  }

  /* ---------- scenes: public hooks and the placeholder ---------- */
  const scenes = {};
  const HOSTS = { fork: ['#dna-fork-scene', '#dna-fork-notice', '#dna-fork-desc'], expression: ['#gene-expression-scene', '#gene-expression-notice', '#gene-expression-desc'] };
  const api = {
    version: 1, logic: L,
    getState: function () { return { fork: copy(state.fork), expression: copy(state.expression) }; },
    saveFork: function (fork) { state.fork = copy(fork); if (state.fork) state.fork.updatedAt = state.fork.updatedAt || Date.now(); renderData(); save(); },
    saveExpression: function (exp) { const runs = exp && Array.isArray(exp.runs) ? exp.runs.slice(-50) : []; state.expression = { runs: copy(runs) || [] }; renderData(); save(); },
    addExpressionRun: function (run) { if (!run || typeof run !== 'object') return; state.expression.runs.push(Object.assign({ at: Date.now() }, copy(run))); state.expression.runs = state.expression.runs.slice(-50); renderData(); save(); },
    announce: announce,
    seed: function (salt) { const base = window.Lab && Lab.identity && Lab.identity.seed ? Lab.identity.seed.seed : 0; return (base + hash32(String(salt || ''))) >>> 0; },
    rng: function (salt) { return Lab.rng(api.seed(salt)); },
    registerScene: function (scene) { if (!scene || !HOSTS[scene.id] || typeof scene.mount !== 'function') return; scenes[scene.id] = scene; if (ready) mountScene(scene.id); }
  };
  window.B3DnaP53 = api;
  function mountScene(id) {
    const host = $(HOSTS[id][0]), notice = $(HOSTS[id][1]);
    if (!host || !scenes[id] || host.dataset.mounted) return;
    host.dataset.mounted = '1'; if (notice) notice.hidden = true;
    try { scenes[id].mount(host, api); } catch (e) { host.dataset.mounted = ''; if (notice) { notice.hidden = false; notice.textContent = 'The interactive model could not start. Reload the page to try again.'; } }
  }
  function css(name, fallback) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback; }
  // Preview drawing used only while no scene is registered: a 24-letter strand and its partners (A with T, G with C).
  function drawPreview(id) {
    const host = $(HOSTS[id][0]); if (!host || host.dataset.mounted) return;
    const canvas = $('canvas', host); if (!canvas) return;
    const w = Math.max(280, Math.floor(host.clientWidth || 640)), h = Math.round(w * 340 / 960 < 150 ? 150 : w * 340 / 960), dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); canvas.style.width = '100%'; canvas.style.aspectRatio = w + ' / ' + h;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const ink = css('--ink', '#14211c'), muted = css('--muted', '#56665f'), accent = css('--accent', '#0d6e55'), bg = css('--surface-2', '#e8eeea'), line = css('--line', '#cfd9d3');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    const dna = L.STRANDS.A.slice(0, 24);
    const n = Math.min(24, Math.max(8, Math.floor((w - 40) / 22))), step = (w - 40) / n, y1 = h * 0.34, y2 = h * 0.66;
    ctx.font = '600 ' + Math.max(11, Math.min(16, step * 0.7)) + 'px ui-monospace, Menlo, monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const partner = { A: 'T', T: 'A', G: 'C', C: 'G' };
    for (let i = 0; i < n; i++) {
      const x = 20 + step * (i + 0.5), open = (i / n) * 14;     // the strands lean apart toward the right, like an unzipping fork
      ctx.strokeStyle = line; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y1 + 12); ctx.lineTo(x, y2 - 12 - open * 0.0); ctx.stroke();
      ctx.fillStyle = accent; ctx.fillText(dna[i], x, y1 - open);
      ctx.fillStyle = ink; ctx.fillText(partner[dna[i]], x, y2 + open);
    }
    ctx.fillStyle = muted; ctx.font = '600 13px system-ui, sans-serif'; ctx.textAlign = 'left';
    ctx.fillText(id === 'fork' ? 'Preview: a 24-letter strand with its partners (A with T, G with C)' : 'Preview: DNA letters and their complements (in RNA, A pairs with U)', 20, h - 14);
  }
  function showPlaceholders() {
    Object.keys(HOSTS).forEach(function (id) {
      if (scenes[id]) return;
      const notice = $(HOSTS[id][1]), desc = $(HOSTS[id][2]);
      if (notice) notice.hidden = false;
      if (desc) desc.textContent = id === 'fork'
        ? 'Text description: this is a preview picture of a 24-letter DNA strand with its partner letters, A with T and G with C. The interactive model is not loaded yet.'
        : 'Text description: this is a preview picture of DNA letters and their complements. The interactive model is not loaded yet.';
      drawPreview(id);
    });
  }

  /* ---------- wiring ---------- */
  function resumeBar() {
    const bar = $('#resume-bar');
    if (!bar) return;
    if (location.hash || state.lastSection === 'overview') { bar.hidden = true; return; }
    const target = $('#' + state.lastSection); if (!target) return;
    const a = $('a', bar); a.href = '#' + state.lastSection; a.textContent = 'Resume: ' + target.dataset.step; bar.hidden = false;
  }
  function wire() {
    readStore();
    RESPONSE_IDS = $$('main textarea').filter(function (t) { return !t.readOnly && t.id; }).map(function (t) { return t.id; }).concat(['expr-sentence'], RADIO_NAMES);
    restoreFields();
    renderData(); renderChecklist(); renderSelfLevel(false); renderEcho(); resumeBar();
    if (state.feedback.sentence) $('#sentence-feedback').textContent = state.feedback.sentence;
    ready = true;
    (window.B3DnaP53Scenes || []).forEach(function (s) { api.registerScene(s); });
    window.B3DnaP53Scenes = { push: function (s) { api.registerScene(s); } };
    showPlaceholders();
    window.addEventListener('hashchange', save);
    let pending = 0;
    window.addEventListener('resize', function () { cancelAnimationFrame(pending); pending = requestAnimationFrame(function () { Object.keys(HOSTS).forEach(drawPreview); }); }, { passive: true });
    document.addEventListener('companion:show', function () { Object.keys(HOSTS).forEach(drawPreview); });
    new MutationObserver(function () { Object.keys(HOSTS).forEach(drawPreview); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    if (window.matchMedia) { const m = matchMedia('(prefers-color-scheme: dark)'); if (m.addEventListener) m.addEventListener('change', function () { Object.keys(HOSTS).forEach(drawPreview); }); }
    $$('main input, main textarea, main select').forEach(function (e) { e.addEventListener('change', save); e.addEventListener('input', save); });
    $$('#checklist-table input, #checklist-table textarea').forEach(function (e) { e.addEventListener('input', renderChecklist); e.addEventListener('change', renderChecklist); });
    $$('#self-check input').forEach(function (e) { e.addEventListener('change', function () { renderSelfLevel(true); }); });
    ['ideas-chromosomes', 'ideas-compare', 'ideas-why'].forEach(function (id) { $('#' + id).addEventListener('input', renderEcho); });
    RADIO_NAMES.forEach(function (n) { $$('input[name="' + n + '"]').forEach(function (r) { r.addEventListener('change', function () { state.feedback[n] = ''; $('#feedback-' + n).textContent = ''; save(); }); }); });
    $$('[data-check]').forEach(function (b) { b.addEventListener('click', function () { checkExit(b.dataset.check); }); });
    ['expr-strand', 'expr-sentence'].forEach(function (id) { $('#' + id).addEventListener('input', function () { state.feedback.sentence = ''; $('#sentence-feedback').textContent = ''; }); $('#' + id).addEventListener('change', function () { state.feedback.sentence = ''; $('#sentence-feedback').textContent = ''; }); });
    $('#check-sentence').addEventListener('click', checkSentence);
    $('#copy-rubric').addEventListener('click', copyRubric);
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
