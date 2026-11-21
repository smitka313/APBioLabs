/* DNA Copying, p53 and Gene Expression: companion for OpenSciEd Biology B.3, Lessons 5-6.
   Same structure as the Cell Cycle companion: one saved record in localStorage, one live announcer, a report, a download
   and a "Clear this activity" dialog. Student work lives only in this browser.

   SAVED STATE (localStorage 'aplab:openscied:b3-dna-p53:v1'), format v1 (the key and format never change):
     { v:1,
       fork:        null | { before:{top,bottom}, after:{top,bottom}, p53:{a,b,c}, ... }   written by the DNA fork scene
       expression:  { runs:[ run, ... ] }                                                   written by the gene expression scene
       fields:      { <element id>: value }     every text box, hidden answer, checkbox on the page, plus any older answers (see below)
       feedback:    { <name>: text }            feedback shown for the sentence check
       responseIds: [ ... ]                     ids of every required response (the dashboard counts these)
       lastSection, lastVisitedAt }

   HOW ANSWERS ARE STORED. The page is made of "cards" (fieldset.qcard, data-q = the card id). Each card keeps its answer as a
   short string in one hidden input whose id is the card id, so it is saved like any other field:
     single  "a"                           the value of the chosen option
     multi   "a,c"                         the values of the chosen options
     rows    "A:T,T:A,G:C"                 row:value for each row that has a pick
   The visible radios and checkboxes (data-ui) are only a view of that string and are never saved themselves.
   Checklist rows keep "know"/"need" in cl-<row>-status and the source boxes under their old ids (cl-<row>-src-sim ...).
   The six explanation self-check boxes (ex-el-0..5) are ticked by the "Build your explanation" card, and kept as before.

   OLDER SAVES. An earlier, longer version of this page saved about 60 free-text boxes (ms5-q1 ... pt6-questions) that no
   longer exist. They are never dropped: they stay in `fields`, are shown (read-only) under "Earlier answers" in Wrap up,
   and are included in the report and the download. The key, the format and the ids that still exist are unchanged.

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
  const state = { fork: null, expression: { runs: [] }, fields: {}, feedback: {}, lastSection: 'overview', legacy: {} };
  let cleared = false, hadSaved = false, ready = false, RESPONSE_IDS = [];
  const CHECK_ROWS = ['relation', 'why', 'process', 'errors', 'corrected', 'after', 'cancer'];
  const STRAND_WORDS = 14;   // longest sentence the word bank will build
  // Labels for answers saved by the earlier, longer version of the page (they are shown and downloaded, never dropped).
  const OLD_LABELS = {
    'ideas-chromosomes': 'First ideas: what chromosomes are', 'ideas-compare': 'First ideas: chromosomes at the end of the Cell Game', 'ideas-why': 'First ideas: what could make them different',
    'ms5-q1': 'DNA fork 1: why unwind and unzip', 'ms5-q2': 'DNA fork 2: how the letters matched', 'ms5-q3': 'DNA fork 3: how mismatches looked',
    'ms5-q4a': 'DNA fork 4: p53 (a)', 'ms5-q4b': 'DNA fork 4: p53 (b)', 'ms5-q4c': 'DNA fork 4: p53 (c)', 'ms5-q5': 'DNA fork 5: how knowing real DNA copying changes the model', 'ms5-summary': 'DNA fork 6: sum it up',
    'gotta-ideas': 'Ideas an explanation must include', 'next-questions': 'Questions to answer next', 'explanation-draft': 'My explanation', 'peer-notes': 'Peer feedback', 'explanation-revised': 'My revised explanation',
    'ms6-map-loc1-represents': 'Map: Location 1 stands for', 'ms6-map-loc1-reading': 'Map: Location 1, what the reading adds', 'ms6-map-dna-represents': 'Map: paper DNA stands for', 'ms6-map-dna-reading': 'Map: paper DNA, what the reading adds', 'ms6-map-dna-differs': 'Map: paper DNA, how it differs',
    'ms6-map-copy-represents': 'Map: copy stands for', 'ms6-map-copy-reading': 'Map: copy, what the reading adds', 'ms6-map-loc2-represents': 'Map: Location 2 stands for', 'ms6-map-loc2-reading': 'Map: Location 2, what the reading adds',
    'ms6-map-cards-represents': 'Map: cards stand for', 'ms6-map-cards-reading': 'Map: cards, what the reading adds', 'ms6-map-cards-differs': 'Map: cards, how they differ', 'ms6-map-sentence-represents': 'Map: sentence stands for', 'ms6-map-sentence-reading': 'Map: sentence, what the reading adds',
    'ms6-q2': 'Gene expression 2: how the model helps', 'ms6-q3': 'Gene expression 3: same strand compared', 'ms6-q4': 'Gene expression 4: different strand compared', 'ms6-sentence-mismatch': 'Gene expression 5: a sentence that does not match', 'ms6-shape': 'Gene expression 6: protein shape', 'ms6-questions': 'Questions I have (gene expression)',
    'gloss-mine': 'My own glossary', 'exit-q3': 'Exit ticket 3', 'exit-q5': 'Exit ticket 5', 'exit-q6': 'Exit ticket 6', 'exit-q7': 'Exit ticket 7', 'pt5-figured': 'Lesson 5: what I figured out', 'pt5-questions': 'Lesson 5: questions I have',
    'pt6-figured': 'Lesson 6: what I figured out', 'pt6-questions': 'Lesson 6: questions I have', 'wrap-reflection': 'Looking back at my first ideas', 'wrap-limits': 'One thing the models leave out'
  };
  for (const k of CHECK_ROWS) { OLD_LABELS['cl-' + k + '-have'] = 'Checklist (' + k + '): evidence I have'; OLD_LABELS['cl-' + k + '-need'] = 'Checklist (' + k + '): evidence I need'; }

  function studentIdentity() { return window.Lab && Lab.identity ? Lab.identity.get() : null; }
  function hash32(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function announce(text) { const el = $('#announcer'); if (!el) return; el.textContent = ''; setTimeout(function () { el.textContent = text; }, 30); }
  function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function copy(o) { try { return JSON.parse(JSON.stringify(o)); } catch (e) { return null; } }
  function byId(id) { return document.getElementById(id); }
  function oneLine(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }

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
  // Saved ids that no element on this page uses any more (answers from the earlier, longer page). Kept as they were.
  function findLegacy() {
    state.legacy = {};
    Object.keys(state.fields || {}).forEach(function (id) {
      if (!byId(id)) state.legacy[id] = state.fields[id];
    });
  }
  function collectFields() {
    const f = {};
    $$('main input, main textarea, main select').forEach(function (x) {
      if (x.readOnly || x.type === 'button' || x.hasAttribute('data-ui')) return;
      if (x.type === 'checkbox') { if (x.id) f[x.id] = x.checked; }
      else if (x.id) f[x.id] = x.value;
    });
    return Object.assign({}, state.legacy, f);
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
    refreshAll();
  }
  function restoreFields() {
    Object.keys(state.fields || {}).forEach(function (id) {
      const v = state.fields[id], e = byId(id);
      if (!e) return;
      if (e.type === 'checkbox') e.checked = !!v; else if (typeof v === 'string') e.value = v;
    });
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

  /* ---------- cards: one question each, tap to answer, feedback right away ---------- */
  const cardEls = () => $$('main .qcard');
  const cardInput = card => byId(card.dataset.q);
  const isKeyed = card => !!card.querySelector('[data-ok]');
  function parseVal(card) {
    const v = (cardInput(card) || { value: '' }).value || '', type = card.dataset.type;
    if (type === 'multi') return v ? v.split(',') : [];
    if (type === 'rows') {
      const m = {};
      v.split(',').filter(Boolean).forEach(function (p) { const i = p.indexOf(':'); if (i > 0) m[p.slice(0, i)] = p.slice(i + 1); });
      return m;
    }
    return v;
  }
  // What the visible radios and checkboxes currently say, as the stored string.
  function readDom(card) {
    const type = card.dataset.type;
    if (type === 'multi') return $$('input[data-ui]:checked', card).map(i => i.value).join(',');
    if (type === 'rows') return $$('.rrow', card).map(function (r) { const c = $('input[data-ui]:checked', r); return c ? r.dataset.row + ':' + c.value : ''; }).filter(Boolean).join(',');
    const c = $('input[data-ui]:checked', card); return c ? c.value : '';
  }
  function optText(label) { return label ? oneLine($('span', label) ? $('span', label).textContent : label.textContent) : ''; }
  function optionFor(card, row, value) {
    const scope = row ? $$('.rrow', card).find(r => r.dataset.row === row) : card;
    const input = scope && $$('input[data-ui]', scope).find(i => i.value === value);
    return input ? input.closest('label') : null;
  }
  function rowDefs(card) { return $$('.rrow', card).map(r => ({ id: r.dataset.row, label: oneLine($('.rlabel', r).textContent), stem: r.dataset.stem || '' })); }
  // Readable answer for the report and the download: { text, correct } where correct is true, false, or null when there is no key.
  function cardResult(card) {
    const type = card.dataset.type, sel = parseVal(card), keyed = isKeyed(card);
    if (type === 'single') {
      const lab = sel ? optionFor(card, null, sel) : null;
      return { text: optText(lab), correct: keyed && lab ? lab.hasAttribute('data-ok') : null };
    }
    if (type === 'multi') {
      const labs = sel.map(v => optionFor(card, null, v)).filter(Boolean);
      const okAll = $$('label[data-ok]', card).every(l => labs.includes(l)) && labs.every(l => l.hasAttribute('data-ok'));
      return { text: labs.map(optText).join('; '), correct: keyed && labs.length ? okAll : null };
    }
    const defs = rowDefs(card), parts = [];
    let allOk = true, answered = 0;
    defs.forEach(function (d) {
      const v = sel[d.id]; if (!v) { allOk = false; return; }
      const lab = optionFor(card, d.id, v); answered++;
      if (keyed && !(lab && lab.hasAttribute('data-ok'))) allOk = false;
      parts.push(d.label + ': ' + optText(lab));
    });
    return { text: parts.join('; '), correct: keyed && answered ? allOk && answered === defs.length : null };
  }
  function cardAnswered(card) {
    const type = card.dataset.type, sel = parseVal(card);
    if (type === 'rows') return $$('.rrow', card).length > 0 && $$('.rrow', card).every(r => !!sel[r.dataset.row]);
    return type === 'multi' ? sel.length > 0 : !!sel;
  }
  function renderCard(card, speak) {
    const type = card.dataset.type, sel = parseVal(card), keyed = isKeyed(card);
    $$('input[data-ui]', card).forEach(function (i) {
      const row = i.closest('.rrow');
      i.checked = type === 'multi' ? sel.includes(i.value) : type === 'rows' ? !!row && sel[row.dataset.row] === i.value : sel === i.value;
      const lab = i.closest('label');
      lab.classList.toggle('is-sel', i.checked);
      if (i.checked && keyed) lab.dataset.state = lab.hasAttribute('data-ok') ? 'ok' : 'no'; else delete lab.dataset.state;
    });
    const fb = $('.q-fb', card);
    let msg = '', st = '';
    if (type === 'single' && sel) {
      const lab = optionFor(card, null, sel);
      if (keyed) {
        const ok = lab.hasAttribute('data-ok');
        msg = lab.dataset.why || (ok ? card.dataset.done : card.dataset.wrong) || (ok ? 'Yes.' : 'Not quite. Try another.'); st = ok ? 'ok' : 'no';
      } else { msg = (lab && lab.dataset.why) || card.dataset.saved || 'Saved.'; st = 'info'; }
    } else if (type === 'multi' && sel.length) {
      const r = cardResult(card);
      if (!keyed) { msg = card.dataset.saved || 'Saved.'; st = 'info'; }
      else if (r.correct) { msg = card.dataset.done || 'Yes.'; st = 'ok'; }
      else if (sel.some(v => !optionFor(card, null, v).hasAttribute('data-ok'))) { msg = card.dataset.wrong || 'Not quite. Check the options marked ✕.'; st = 'no'; }
      else { msg = 'Good so far. Are there more?'; st = 'info'; }
    } else if (type === 'rows' && cardAnswered(card)) {
      const r = cardResult(card);
      if (!keyed) { msg = card.dataset.saved || 'Saved.'; st = 'info'; }
      else if (r.correct) { msg = card.dataset.done || 'Yes.'; st = 'ok'; }
      else { msg = 'Not quite. Check the rows marked ✕ and change them.'; st = 'no'; }
    }
    if (fb) { fb.textContent = msg; if (st) fb.dataset.state = st; else delete fb.dataset.state; }
    card.dataset.answered = cardAnswered(card) ? '1' : '';
    if ('build' in card.dataset) renderBuilder(card, speak);
    if (speak && msg) announce(msg);
  }
  function onCard(card) { const h = cardInput(card); if (h) h.value = readDom(card); renderCard(card, true); save(); }

  /* ---------- "Build your explanation": the six ideas of the self-check, picked instead of typed ---------- */
  const LEVEL_TEXT = {
    none: 'Pick an ending in each row.',
    foundational: 'Foundational: you have some of the ideas. Next, link them: how do copying mistakes lead to differences in chromosomes?',
    linked: 'Linked: you connect mistakes in DNA to differences in chromosomes. Next, add how p53 fixes a mismatch and why only one version works.',
    organized: 'Organized: copying, mistakes, p53 and what it means for new cells are all there. To stretch, predict what daughter cells with only p53 (b) or (c) would get.'
  };
  function selfFlags() { return [0, 1, 2, 3, 4, 5].map(function (i) { return byId('ex-el-' + i).checked; }); }
  function renderBuilder(card, speak) {
    const sel = parseVal(card), items = [];
    $$('.rrow', card).forEach(function (r) {
      const v = sel[r.dataset.row]; if (!v) return;
      const lab = optionFor(card, r.dataset.row, v), tagged = $('[data-idea]', r), idea = tagged ? tagged.dataset.idea : null;
      if (idea != null) byId('ex-el-' + idea).checked = lab.hasAttribute('data-ok');
      items.push(r.dataset.stem + ' ' + optText(lab) + '.');
    });
    const list = $('#built-explanation');
    list.replaceChildren(); items.forEach(function (t) { list.appendChild(el('li', '', t)); }); list.hidden = !items.length;
    renderSelfLevel(speak);
  }
  function renderSelfLevel(speak) {
    const level = L.explanationLevel(selfFlags()), out = $('#self-level');
    out.textContent = LEVEL_TEXT[level] + (level === 'none' ? '' : ' (Your own check, not a grade.)');
    out.dataset.level = level;
    if (speak && level !== 'none') announce(LEVEL_TEXT[level].split(':')[0]);
  }

  /* ---------- checklist: I know it / I need it, and one tap for the source ---------- */
  function rowDone(k) {
    const status = byId('cl-' + k + '-status').value, src = $$('#cl-row-' + k + ' input[type=checkbox]').some(c => c.checked);
    return status === 'need' || (status === 'know' && src);
  }
  function renderChecklist() {
    let done = 0;
    CHECK_ROWS.forEach(function (k) {
      const row = byId('cl-row-' + k), status = byId('cl-' + k + '-status').value;
      const src = $$('input[type=checkbox]', row).some(c => c.checked), s = byId('cl-status-' + k);
      $$('input[data-ui]', row).forEach(function (r) { r.checked = r.value === status; r.closest('label').classList.toggle('is-sel', r.checked); });
      $('.src', row).hidden = status !== 'know';
      s.textContent = status === 'know' ? (src ? '✓ Know it, with a source' : '○ Tap where you learned it') : status === 'need' ? '→ Find it in the reading or the model' : '';
      const d = rowDone(k); if (d) done++;
      row.classList.toggle('is-done', d);
    });
    $('#checklist-count').textContent = done + ' of ' + CHECK_ROWS.length + ' ideas sorted.';
  }
  // Older saves: a row with evidence written or a source ticked was a "know" row.
  function migrateChecklist() {
    CHECK_ROWS.forEach(function (k) {
      const h = byId('cl-' + k + '-status');
      if (h.value) return;
      const had = typeof state.legacy['cl-' + k + '-have'] === 'string' && state.legacy['cl-' + k + '-have'].trim();
      if (had || $$('#cl-row-' + k + ' input[type=checkbox]').some(c => c.checked)) h.value = 'know';
    });
  }

  /* ---------- first-ideas echo ---------- */
  function renderEcho() {
    const lines = [];
    ['p-ideas-chrom', 'p-ideas-game', 'p-ideas-why'].forEach(function (id) {
      const card = $('[data-q="' + id + '"]'), r = card && cardResult(card);
      if (r && r.text) lines.push([card.dataset.label.replace(/^First idea: /, ''), r.text]);
    });
    [['ideas-chromosomes', 'What I knew about chromosomes'], ['ideas-compare', 'Chromosomes at the end of the Cell Game'], ['ideas-why', 'What could make them different']].forEach(function (p) {
      const t = typeof state.legacy[p[0]] === 'string' ? state.legacy[p[0]].trim() : '';
      if (t) lines.push([p[1], t]);
    });
    const box = $('#first-ideas-text'); box.replaceChildren();
    if (!lines.length) { box.className = 'muted'; box.textContent = 'You have not picked first ideas yet. You can add them in section 2.'; return; }
    box.className = '';
    lines.forEach(function (p) { const d = el('p'); d.appendChild(el('strong', '', p[0] + ': ')); d.appendChild(document.createTextNode(p[1])); box.appendChild(d); });
  }

  /* ---------- sentence builder (word bank) and the check against the key ---------- */
  function sentenceWords() { const v = (byId('expr-sentence').value || '').replace(/[.!?]+\s*$/, '').trim(); return v ? v.split(/\s+/).slice(0, STRAND_WORDS) : []; }
  function renderSentence() {
    const box = $('#built-sentence'), ws = sentenceWords();
    box.replaceChildren();
    if (!ws.length) box.appendChild(el('span', 'muted placeholder', 'Tap words in order.'));
    else {
      ws.forEach(function (w, i) { box.appendChild(el('span', 'w', i ? w : w.charAt(0).toUpperCase() + w.slice(1))); if (i < ws.length - 1) box.appendChild(document.createTextNode(' ')); });
      box.appendChild(el('span', 'muted', '.'));
    }
    const strand = byId('expr-strand').value;
    $$('input[name="expr-strand-r"]').forEach(function (r) { r.checked = r.value === strand; r.closest('label').classList.toggle('is-sel', r.checked); });
    $('#undo-word').disabled = $('#clear-sentence').disabled = !ws.length;
    $$('#sentence-check .word').forEach(function (b) { b.disabled = ws.length >= STRAND_WORDS; });
  }
  function sentenceChanged() { state.feedback.sentence = ''; $('#sentence-feedback').textContent = ''; renderSentence(); save(); }
  function checkSentence() {
    const strand = byId('expr-strand').value, typed = sentenceWords().join(' '), out = $('#sentence-feedback');
    let msg;
    if (!strand || !typed) msg = 'Choose a strand and tap your words first.';
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

  /* ---------- peer rubric text (copy button) ---------- */
  const RUBRIC_ROWS = [
    ['The relationship between DNA and chromosomes', 'Underline where you see the idea. Could it use more science ideas? Which, and where?'],
    ['Why, how and when DNA replicates', 'Underline it. Could more science ideas help?'],
    ['Where, how and why errors occur. What causes them? What is the effect?', 'Underline it. Circle evidence that supports it. Could it use more evidence, and where?'],
    ['Where, how and why errors are corrected', 'Underline it. Circle the evidence.'],
    ['What happens to the DNA after replication', 'Underline it. Circle the evidence.'],
    ['How DNA with mutations relates to cancer cells with differences in their chromosomes', 'Underline it. Circle the evidence. Add suggestions for what to add and where.']
  ];
  function rubricText() {
    return 'Peer feedback rubric. Lesson question: How do cancer cells end up with differences in their chromosomes, and what is the role of p53 in preventing the differences?\n' +
      'For each important idea, check if it is present and write specific feedback.\n' + RUBRIC_ROWS.map(r => '- ' + r[0] + ' | ' + r[1]).join('\n') +
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

  /* ---------- progress per section ---------- */
  function sectionItems(id) {
    const sec = byId(id), items = [];
    if (!sec) return items;
    if (id === 'fork') return [!!L.forkSummary(state.fork)];
    if (id === 'expression') return [state.expression.runs.length > 0, !!byId('expr-sentence').value.trim()];
    $$('.qcard', sec).forEach(c => items.push(cardAnswered(c)));
    CHECK_ROWS.forEach(function (k) { if ($('#cl-row-' + k, sec)) items.push(rowDone(k)); });
    $$('textarea', sec).filter(t => !t.readOnly && !t.closest('.write-more')).forEach(t => items.push(!!t.value.trim()));
    return items;
  }
  function renderProgress() {
    SECTIONS.forEach(function (id) {
      const sec = byId(id), items = sectionItems(id);
      if (!sec || !items.length) return;
      let bar = $('.sec-progress', sec);
      if (!bar) { bar = el('p', 'sec-progress'); bar.appendChild(el('span', 'dots')); bar.firstChild.setAttribute('aria-hidden', 'true'); bar.appendChild(el('span', 'txt')); const h = $('header', sec); if (h) h.after(bar); else sec.prepend(bar); }
      const n = items.filter(Boolean).length, dots = $('.dots', bar);
      if (dots.children.length !== items.length) { dots.replaceChildren(); items.forEach(function () { dots.appendChild(el('i')); }); }
      items.forEach((d, i) => dots.children[i].classList.toggle('on', d));
      $('.txt', bar).textContent = n === items.length ? '✓ All ' + n + ' done' : n + ' of ' + items.length + ' done';
      bar.classList.toggle('is-complete', n === items.length);
    });
  }
  function refreshAll() { renderProgress(); renderEcho(); renderReport(); }
  function renderEarlier() {
    const box = $('#earlier-answers-body'), wrap = $('#earlier-answers');
    box.replaceChildren();
    const ids = Object.keys(state.legacy).filter(id => typeof state.legacy[id] === 'string' && state.legacy[id].trim());
    ids.forEach(function (id) { const d = el('p'); d.appendChild(el('strong', '', (OLD_LABELS[id] || id) + ': ')); d.appendChild(document.createTextNode(state.legacy[id].trim())); box.appendChild(d); });
    wrap.hidden = !ids.length;
  }

  /* ---------- report, download, clear ---------- */
  function labelFor(id) {
    const card = $('[data-q="' + id + '"]');
    if (card) return card.dataset.label || id;
    if (id === 'expr-sentence') return 'My sentence for the key check';
    const m = /^cl-(\w+)-status$/.exec(id);
    if (m) return 'Checklist: ' + oneLine($('#cl-name-' + m[1]).textContent);
    const l = document.querySelector('label[for="' + id + '"]');
    return l ? oneLine(l.textContent) : (OLD_LABELS[id] || id);
  }
  function answerFor(id) {
    const card = $('[data-q="' + id + '"]');
    if (card) { const r = cardResult(card); return r.text ? r.text + (r.correct === true ? ' (correct)' : r.correct === false ? ' (not the best answer yet)' : '') : ''; }
    if (id === 'expr-sentence') { const s = sentenceWords().join(' '), st = byId('expr-strand').value; return s ? (st ? 'Strand ' + st + ': ' : '') + s.charAt(0).toUpperCase() + s.slice(1) + '.' + (state.feedback.sentence ? ' ' + state.feedback.sentence : '') : ''; }
    const m = /^cl-(\w+)-status$/.exec(id);
    if (m) { const v = byId(id).value; if (!v) return ''; return v === 'need' ? 'I need it' : 'I know it' + (sources(m[1]).length ? ' (' + sources(m[1]).join(', ') + ')' : ''); }
    return (byId(id) || { value: '' }).value.trim();
  }
  function sources(k) { return $$('#cl-row-' + k + ' input[type=checkbox]').filter(c => c.checked).map(c => oneLine(c.closest('label').textContent)); }
  function written(id) { const e = byId(id); return !!(e && e.value && e.value.trim()); }
  function optionalWriting() { return $$('main .write-more textarea').filter(t => t.value.trim()).map(t => [labelFor(t.id), t.value.trim(), t.id]); }
  function renderReport() {
    const report = $('#investigation-report'); if (!report) return;
    report.replaceChildren();
    report.appendChild(el('div', 'eyebrow', 'DNA copying, p53 and gene expression · My evidence'));
    report.appendChild(el('h3', '', 'Your investigation, at a glance.'));
    const student = studentIdentity();
    report.appendChild(el('p', 'report-student', student ? 'Student: ' + student.name + (student.period ? ' · Class period: ' + student.period : '') : 'Student name not entered. Sign in on the Biology Companion Activities dashboard before submitting.'));
    const ul = el('ul', 'report-checks');
    const done = RESPONSE_IDS.filter(written).length;
    const fs = L.forkSummary(state.fork), runs = state.expression.runs.length;
    [done + ' of ' + RESPONSE_IDS.length + ' responses given', fs ? 'DNA fork: results recorded' : 'DNA fork: not run yet', runs + ' gene expression run' + (runs === 1 ? '' : 's') + ' recorded',
      'Explanation self-check: ' + L.explanationLevel(selfFlags())].forEach(function (t) { ul.appendChild(el('li', '', t)); });
    report.appendChild(ul);
    forkDataNodes().concat(expressionDataNodes()).forEach(function (n) { report.appendChild(n); });
    RESPONSE_IDS.forEach(function (id) {
      report.appendChild(el('h4', '', labelFor(id)));
      report.appendChild(el('p', 'report-answer', answerFor(id) || 'Not answered yet.'));
    });
    optionalWriting().forEach(function (w) { report.appendChild(el('h4', '', 'Extra writing: ' + w[0])); report.appendChild(el('p', 'report-answer', w[1])); });
    const earlier = Object.keys(state.legacy).filter(id => typeof state.legacy[id] === 'string' && state.legacy[id].trim());
    earlier.forEach(function (id) { report.appendChild(el('h4', '', 'Earlier answer: ' + (OLD_LABELS[id] || id))); report.appendChild(el('p', 'report-answer', state.legacy[id].trim())); });
    report.appendChild(el('p', 'small muted', 'Simplified teaching models. All model numbers are simulated, not measurements from a cell, and nothing here predicts anyone’s health or is a diagnosis.'));
  }
  function download() {
    save();
    const exit = {};
    ['exit-q1', 'exit-q2', 'exit-q4'].forEach(function (n) { const card = $('[data-q="' + n + '"]'), r = cardResult(card); exit[n] = { answer: parseVal(card) || '', correct: r.correct }; });
    const checklist = CHECK_ROWS.map(function (k) {
      return { row: oneLine($('#cl-name-' + k).textContent), status: byId('cl-' + k + '-status').value, sources: sources(k),
        evidenceIHave: state.legacy['cl-' + k + '-have'] || '', evidenceINeed: state.legacy['cl-' + k + '-need'] || '' };
    });
    const responses = {};
    RESPONSE_IDS.forEach(function (id) { responses[id] = { prompt: labelFor(id), answer: (byId(id) || { value: '' }).value, answerText: answerFor(id) }; });
    const optional = {}; optionalWriting().forEach(function (w) { optional[w[2]] = { prompt: w[0], answer: w[1] }; });
    const earlier = {}; Object.keys(state.legacy).forEach(function (id) { if (typeof state.legacy[id] === 'string' && state.legacy[id].trim()) earlier[id] = { prompt: OLD_LABELS[id] || id, answer: state.legacy[id] }; });
    const payload = { format: 'openscied-b3-dna-p53-progress-v1', exportedAt: new Date().toISOString(), student: studentIdentity(),
      dataNote: 'All model data in this file is simulated by the DNA fork and gene expression models. It is not measured from a cell.',
      fork: state.fork, forkSummary: L.forkSummary(state.fork), expression: state.expression,
      explanationSelfCheck: { level: L.explanationLevel(selfFlags()), ideasIncluded: selfFlags() }, exitTicket: exit, checklist: checklist, responses: responses,
      optionalWriting: optional, earlierAnswers: earlier, answers: state.fields };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = 'dna-copying-p53-work.json'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }
  // Same rule as the Cell Cycle companion: clear this activity's record, then reload fresh at the Overview.
  // Name and class period are site-wide and stay saved.
  function clearActivity() {
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
  function responseIds() {
    const ids = [];
    $$('main .qcard, main .cl-row, main #sentence-check, main textarea').forEach(function (e) {
      if (e.matches('.qcard')) ids.push(e.dataset.q);
      else if (e.matches('.cl-row')) ids.push('cl-' + e.dataset.row + '-status');
      else if (e.id === 'sentence-check') ids.push('expr-sentence');
      else if (e.tagName === 'TEXTAREA' && !e.readOnly && e.id && !e.closest('.write-more')) ids.push(e.id);
    });
    return ids;
  }
  function wire() {
    readStore();
    findLegacy();
    RESPONSE_IDS = responseIds();
    restoreFields();
    migrateChecklist();
    cardEls().forEach(function (c) { renderCard(c, false); });
    renderData(); renderChecklist(); renderSelfLevel(false); renderEcho(); renderSentence(); renderEarlier(); resumeBar();
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
    // Plain fields (text boxes, source boxes, hidden answers) save on every change; the card views save through onCard below.
    $$('main input, main textarea, main select').forEach(function (e) {
      if (e.hasAttribute('data-ui') || e.type === 'hidden') return;
      e.addEventListener('change', save); e.addEventListener('input', save);
    });
    cardEls().forEach(function (c) { $$('input[data-ui]', c).forEach(function (i) { i.addEventListener('change', function () { onCard(c); }); }); });
    CHECK_ROWS.forEach(function (k) {
      $$('#cl-row-' + k + ' input[data-ui]').forEach(function (r) { r.addEventListener('change', function () { byId('cl-' + k + '-status').value = r.value; renderChecklist(); save(); announce(r.value === 'know' ? 'Marked: I know it. Tap where you learned it.' : 'Marked: I need it.'); }); });
      $$('#cl-row-' + k + ' input[type=checkbox]').forEach(function (c) { c.addEventListener('change', renderChecklist); });
    });
    $$('input[name="expr-strand-r"]').forEach(function (r) { r.addEventListener('change', function () { byId('expr-strand').value = r.value; sentenceChanged(); }); });
    $$('#sentence-check .word').forEach(function (b) { b.addEventListener('click', function () {
      const ws = sentenceWords(); if (ws.length >= STRAND_WORDS) return;
      ws.push(b.dataset.word); byId('expr-sentence').value = ws.join(' '); sentenceChanged(); announce('Added ' + b.dataset.word + '.'); }); });
    $('#undo-word').addEventListener('click', function () { const ws = sentenceWords(); const w = ws.pop(); byId('expr-sentence').value = ws.join(' '); sentenceChanged(); if (w) announce('Removed ' + w + '.'); });
    $('#clear-sentence').addEventListener('click', function () { byId('expr-sentence').value = ''; sentenceChanged(); announce('Sentence cleared.'); });
    $('#check-sentence').addEventListener('click', checkSentence);
    $('#copy-rubric').addEventListener('click', copyRubric);
    $('#download-work').addEventListener('click', download);
    $('#print-work').addEventListener('click', function () { renderReport(); window.print(); });
    const dialog = $('#reset-dialog');
    $('#reset-work').addEventListener('click', function () { dialog.showModal(); });
    $('#cancel-reset').addEventListener('click', function () { dialog.close(); });
    $('#confirm-reset').addEventListener('click', clearActivity);
    // Only refresh an existing record on load: saving a blank page right after "Clear this activity" would make the dashboard show it as started.
    if (hadSaved) save(); else refreshAll();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire); else wire();
})();
