(function () {
  'use strict';
  const L = window.CarbonJourney, $ = s => document.querySelector(s);
  const key = 'aplab:openscied:b2-carbon-journey:v1';
  Lab.init({ id: 'openscied-b2-carbon-journey' });
  const budgetKey = 'aplab:openscied:b2-carbon-journey:budget:v1';
  const scope = 'b2-carbon-journey';
  const guard = window.OpenSciEdSaveSession;
  let saveSession, raw = null;
  try {
    saveSession = guard?.open(localStorage, scope, [key,budgetKey]);
    raw = saveSession ? saveSession.read(key) : localStorage.getItem(key);
  } catch (_) {}
  const reportIdentity = guard?.reportIdentity?.(saveSession, [key,budgetKey], () => Lab.identity.get?.() ?? null) ?? (() => null);
  const restored = L.readSaved(raw);
  let unreadable = raw !== null && restored === null ? raw : null;
  let state = restored ?? L.initial(Lab.identity.seed.seed);
  const backupWarning = 'Saved work could not be read and has not been changed. Download the saved backup before starting a new journey.';
  const downloadButton = $('#download');
  const downloadLabel = downloadButton.textContent;
  if (unreadable !== null) {
    downloadButton.textContent = 'Download saved backup';
    $('#legacy-report-tools').open = true;
  }
  let guess = null, revealed = false, rolling = false, questionIndex = 0, chart;
  let section = 'play', migrateLegacy = false;
  if (restored) try {
    const v = JSON.parse(raw);
    if (['play', 'evidence', 'sense'].includes(v.lastSection)) section = v.lastSection;
    migrateLegacy = v.version !== state.version;
  } catch (_) {}
  try { const old = JSON.parse(raw); if (state.pending !== null && old.presentation) { guess = L.stations.some(s => s[0] === old.presentation.guess) ? old.presentation.guess : null; revealed = old.presentation.revealed === true; if (typeof old.presentation.note === 'string') $('#note').value = old.presentation.note.slice(0,1000); } } catch (_) {}
  const name = id => L.stations.find(s => s[0] === id)[1];
  const mobile = () => matchMedia('(max-width:850px)').matches;
  function announce(message) { $('#status').textContent = message; }
  function updateRestart() {
    const hasWork = unreadable !== null || state.pending !== null || state.rows.length ||
      Object.values(state.answers).some(answer => answer.trim()) || $('#note').value.trim();
    $('#restart').disabled = !hasWork;
    $('#restart-hint').hidden = !!hasWork;
  }
  function conflict(result) {
    if (!result || result.ok || result.reason === 'unavailable') return false;
    const note = $('#journey-save-conflict');
    if (note.hidden) $('#legacy-report-tools').open = true;
    note.hidden = false;
    note.textContent = (result.reason === 'erased' ? 'This journey was cleared in another tab.' : 'This journey was changed in another tab.') +
      ' This tab will not overwrite it. Download your open work before reloading.';
    return true;
  }
  function saved(result, message, replacing = false) {
    if (result?.ok) {
      unreadable = null;
      downloadButton.textContent = downloadLabel;
      announce(message || 'Journey saved on this device.');
      return true;
    }
    if (!conflict(result)) announce(replacing
      ? 'Could not start a new saved journey. Your previous save has not been changed. Download the saved backup before trying again.'
      : 'Could not save on this device. Keep this page open and download your journey.');
    return false;
  }
  function save(message) {
    updateRestart();
    if (unreadable !== null) { announce(backupWarning); return false; }
    return saved(saveSession?.write(key, JSON.stringify({ ...state, lastSection: section, lastVisitedAt: Date.now(),
      presentation: { guess, revealed, note: $('#note').value } })), message);
  }
  window.addEventListener('storage', event => {
    if (saveSession && (!event.key || [key,guard.globalKey,guard.scopeKey(scope),guard.resetKey(key)].includes(event.key))) {
      conflict(saveSession.check(key));
    }
  });
  let budgetUI;
  function setPage(id, saveSection = true) {
    const budgeting = id === 'budget';
    if (!budgeting) {
      section = id;
      if (saveSection) save();
    }
    history.replaceState(null, '', '#' + id);
    document.body.classList.toggle('journey-playing', id === 'play');
    document.body.classList.toggle('journey-budgeting', budgeting);
    document.querySelectorAll('.journey-page').forEach(p => p.hidden = p.id !== id);
    document.querySelectorAll('[data-page]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.page === id)));
    if (id === 'evidence') drawChart();
    if (id === 'play') drawBoard();
    if (budgeting) {
      if (!budgetUI) budgetUI = window.CarbonBudgetUI?.mount($('#carbon-budget-host'), {
        announce,
        saveSession,
        reportStudent: reportIdentity,
        journeyEvidence: () => {
          const last = state.rows.at(-1);
          if (!last) return '';
          return 'Your last recorded roll: '+name(last.from)+' → '+name(last.to)+'. Matter: '+last.matter+'. Energy: '+last.energy+'.';
        }
      });
      else budgetUI.update?.();
      if (!budgetUI) $('#carbon-budget-host').textContent = 'The budget could not load. Reload to try again. Your original journey is unchanged.';
    }
    window.scrollTo(0, 0);
    if (budgeting) $('#cb-title')?.focus({preventScroll:true});
  }
  document.querySelectorAll('[data-page]').forEach(b => b.addEventListener('click', () => setPage(b.dataset.page)));
  $('[data-show-evidence]').addEventListener('click', () => setPage('evidence'));
  const questions = [
    ['q1', 'Your atom started in atmospheric carbon dioxide. Is that a rule of this model or a claim about where all Earth’s carbon is? Explain.'],
    ['q2', 'What relationships or patterns do you notice in your journey’s totals?'],
    ['q3', 'Tell the story of two turns you recorded. For each: Where did the atom go? What was it part of? What process moved it, and what happened to the energy? Name specific organisms or materials. If you also use a reference card, label it as an example, not one of your rolls.'],
    ['q4', 'Compare with a classmate. What was similar, even though your journeys differed?'],
    ['q5', 'How does this model help explain the effects of carbon dioxide added to the atmosphere by fires?']
  ];
  questions.forEach(([id, text]) => {
    const article = document.createElement('article'), label = document.createElement('label'), input = document.createElement('textarea');
    label.htmlFor = id; label.textContent = text; input.id = id; input.rows = id === 'q3' ? 6 : 3;
    input.maxLength = 20000; input.value = state.answers[id] || '';
    input.addEventListener('input', () => { state.answers[id] = input.value; save(); });
    article.append(label);
    if (id === 'q3') article.append($('#station-tour'));
    article.append(input); $('#questions').append(article);
  });
  let tourStation = '';
  function renderTour() {
    const samples = L.tour(state);
    const newExamples = samples.filter(sample => !sample.drawn).length;
    const selected = samples.find(sample => sample.from === tourStation) || samples.find(sample => !sample.drawn) || samples[0];
    const options = $('#station-tour-select');
    options.replaceChildren();
    for (const sample of samples) {
      const option = document.createElement('option'); option.value = sample.from;
      option.textContent = name(sample.from) + (sample.drawn ? ' · drawn' : state.coverageReviewed.includes(sample.from) ? ' · reviewed' : ' · example');
      options.append(option);
    }
    options.value = selected.from;
    $('#station-tour-summary').textContent = newExamples + ' of 7 sample card events are not in your rolls. That’s normal: the die can repeat routes.';
    $('#station-tour-event').textContent = selected.process + ': ' + name(selected.from) + ' → ' + name(selected.to);
    $('#station-tour-status').textContent = selected.drawn ? 'This card also appeared in your journey.' :
      selected.visited ? 'You reached this station, but this card event was not in your rolls.' : 'This station was not in your journey.';
    $('#station-tour-card').textContent = selected.text;
  }
  $('#station-tour-select').addEventListener('change', e => {
    tourStation = e.currentTarget.value; renderTour();
    announce(['#station-tour-event','#station-tour-status','#station-tour-card'].map(id => $(id).textContent).join(' '));
  });
  function showQuestion() {
    $('#questions').querySelectorAll('article').forEach((a, i) => a.hidden = i !== questionIndex);
    $('#question-number').textContent = 'Question ' + (questionIndex + 1) + ' of ' + questions.length;
    $('#question-prev').disabled = questionIndex === 0;
    $('#question-next').disabled = questionIndex === questions.length - 1;
  }
  $('#question-prev').addEventListener('click', () => { questionIndex = Math.max(0, questionIndex - 1); showQuestion(); });
  $('#question-next').addEventListener('click', () => { questionIndex = Math.min(questions.length - 1, questionIndex + 1); showQuestion(); });
  showQuestion();
  function inspect(id) {
    const art = window.CarbonJourneyScene.inspect(id);
    $('#inspect-title').textContent = name(id) + ' · Field view';
    $('#inspect-art').innerHTML = art.svg;
    $('#inspect-options').replaceChildren();
    const select = index => {
      $('#inspect-caption').textContent = art.features[index].text;
      $('#inspect-options').querySelectorAll('button').forEach((b, i) => b.setAttribute('aria-pressed', String(i === index)));
      $('#inspect-art').querySelectorAll('[data-feature]').forEach(p => p.setAttribute('aria-pressed', String(Number(p.dataset.feature) === index)));
    };
    art.features.forEach((f, i) => {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = (i + 1) + ' · ' + f.label;
      b.addEventListener('click', () => select(i)); $('#inspect-options').append(b);
    });
    $('#inspect-art').querySelectorAll('[data-feature]').forEach(p => {
      p.addEventListener('click', () => select(Number(p.dataset.feature)));
      p.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(Number(p.dataset.feature)); } });
    });
    select(0); $('#inspect-dialog').showModal();
  }
  function drawBoard() { window.CarbonJourneyScene.render(state, inspect); }
  $('#inspect-current').addEventListener('click', () => inspect(L.current(state)));
  document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => $('#' + b.dataset.close).close()));
  $('#help').addEventListener('click', () => $('#help-dialog').showModal());
  function drawDie() {
    const d = $('#die'), value = state.pending || state.rows.at(-1)?.die;
    d.replaceChildren();
    if (!value) { const span = document.createElement('span'); span.textContent = '?'; d.append(span); d.setAttribute('aria-label', 'Die not rolled'); return; }
    const positions = { 1: [5], 2: [1, 9], 3: [1, 5, 9], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] };
    positions[value].forEach(p => { const dot = document.createElement('i'); dot.style.gridArea = Math.ceil(p / 3) + ' / ' + ((p - 1) % 3 + 1); d.append(dot); });
    d.setAttribute('aria-label', (state.pending ? 'Die rolled ' : 'Last roll ') + value);
  }
  function totalBox(target, title, items) {
    const box = document.createElement('div'), h = document.createElement('h3'); box.dataset.total = title.toLowerCase(); h.textContent = title; box.append(h);
    items.forEach(({ label, count }) => {
      const row = document.createElement('div'); row.className = 'total-line';
      const a = document.createElement('span'), b = document.createElement('strong'); a.textContent = label; b.textContent = count; row.append(a, b); box.append(row);
    }); target.append(box);
  }
  function drawChart() {
    if (!state.rows.length) { $('#charts').textContent = 'Record a turn to build your evidence.'; return; }
    const opts = { type: 'bar', responsive: true, xLabel: 'Starting station', yLabel: 'Recorded rolls (count)', yMin: 0,
      yMax: Math.max(1, ...L.stations.map(s => state.rows.filter(r => r.from === s[0]).length)), categories: L.stations.map(s => s[1]),
      series: [{ name: 'Your journey · simulated dice', points: L.stations.map((s, i) => ({ x: i, y: state.rows.filter(r => r.from === s[0]).length })) }] };
    if (chart) chart.update(opts); else chart = Lab.chart($('#charts'), opts);
  }
  function render() {
    updateRestart();
    const pending = state.pending !== null, c = pending ? L.outcome(state) : null, n = state.rows.length;
    const missing = L.missingCoverage(state);
    const review = state.coverageCheckpoint ? missing[0] : null;
    $('#coverage-panel').hidden = $('#coverage-continue').hidden = !review;
    if (review) {
      $('#coverage-reason').textContent = state.coverageCheckpoint === 'repeat' ?
        'This route has repeated several card events. Read a card from a route you did not draw before your next roll.' :
        'Your rolls are complete. Review the missing station evidence before finishing (' + missing.length + ' to read).';
      $('#coverage-route').textContent = review.process + ': ' + name(review.from) + ' → ' + name(review.to);
      $('#coverage-card').textContent = review.text;
      $('#coverage-continue').textContent = state.coverageCheckpoint === 'finish' && missing.length === 1 ?
        'Mark card read and finish' : 'Mark card read';
    }
    $('#location').textContent = name(L.current(state));
    $('#turns').textContent = n + ' rolls · ' + (state.done ? 'complete' : n < 10 ? (10 - n) + ' to minimum' : 'ready to finish');
    $('#stage-label').textContent = review ? 'REFERENCE CARD' : pending ? revealed ? 'READ THE OFFICIAL CARD' : 'PREDICT YOUR NEXT STOP' : state.done ? 'JOURNEY COMPLETE' : 'READY TO EXPLORE';
    $('#card-instruction').textContent = review ? 'Your recorded journey stays unchanged.' : pending ? name(L.current(state)) + ' · roll ' + state.pending + (state.producerExit ? ' · second table' : '') : state.done ? 'Explore your evidence next.' : unreadable !== null ? 'Saving is paused. Open Your evidence to download a backup or start a new journey.' : 'Roll to discover your atom’s next chapter.';
    $('#roll').hidden = pending || state.done || !!review; $('#roll').disabled = rolling || pending || state.done || !!review || unreadable !== null;
    $('#record').hidden = !pending || !revealed; $('#record').disabled = !pending || !revealed || state.done;
    $('#finish').disabled = n < 10 || pending || state.done || !!review;
    $('#finish').hidden = n < 10 || pending || state.done || !!review;
    $('#finish').textContent = missing.length ? 'Review missed stations' : 'Finish journey';
    $('#skip-prediction').hidden = !pending || revealed;
    $('#prediction-panel').hidden = !pending || revealed;
    $('#outcome-panel').hidden = !pending || !revealed;
    $('#ready-panel').hidden = pending || !!review;
    $('#prediction-options').replaceChildren();
    if (pending && !revealed) L.stations.forEach(([id, label]) => {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.dataset.guess = id;
      b.addEventListener('click', () => reveal(id)); $('#prediction-options').append(b);
    });
    $('#official-card').textContent = c ? c.text : '';
    $('#matter').textContent = c ? c.matter : 'Roll to reveal'; $('#energy').textContent = c ? c.energy : 'Roll to reveal';
    $('#destination').textContent = c ? name(c.to) : 'Roll to reveal';
    $('#prediction-feedback').textContent = c && revealed ? guess ? (guess === c.to ? 'Your prediction matches the card. ' : 'You predicted ' + name(guess) + '. ') + (c.to === L.current(state) ? 'Your atom stays here this turn.' : 'Your atom will travel to ' + name(c.to) + '.') : 'Follow this event from the official station card.' : '';
    $('#producer-rule').hidden = !pending || !revealed || (L.current(state) !== 'producers');
    $('#producer-rule').textContent = state.producerExit ? 'This outcome uses the Producers card’s second table.' : c?.exit ? 'Record this growth turn. Your next roll uses the Producers card’s second table.' : 'This outcome uses the Producers card’s first table.';
    const last = state.rows.at(-1); $('#last-move').textContent = last ? 'Last turn: ' + name(last.from) + ' → ' + name(last.to) + ' · ' + last.matter : 'Start in atmospheric carbon dioxide.';
    drawDie(); drawBoard();
    const target = $('#totals'); target.replaceChildren();
    totalBox(target, 'Systems', L.totals(state, 'from', L.stations.map(s => s[0])).map(x => ({ label: name(x.label), count: x.count })));
    totalBox(target, 'Matter', L.totals(state, 'matter', L.matter)); totalBox(target, 'Energy', L.totals(state, 'energy', L.energy));
    showTotal();
    $('#journal').replaceChildren(); state.rows.forEach(r => {
      const tr = document.createElement('tr'); [r.turn, name(r.from), r.die, r.prediction === null ? 'Skipped' : r.prediction ? name(r.prediction) : 'Not saved in earlier version', r.matter, r.energy, name(r.to), r.text || 'Earlier printed-card record', r.note].forEach(v => {
        const td = document.createElement('td'); td.textContent = v; tr.append(td);
      }); $('#journal').append(tr);
    });
    renderTour();
    $('#summary').textContent = n ? n + ' rolls recorded. Your atom is at ' + name(L.current(state)) + '. These are rolls, not elapsed time or global carbon amounts.' : 'Record your journey first, then use its evidence here.';
    $('#story-strip').replaceChildren(); state.rows.forEach(r => {
      const turn = document.createElement('details'), summary = document.createElement('summary'), evidence = document.createElement('p');
      summary.textContent = r.turn + '. ' + name(r.from) + ' → ' + name(r.to);
      evidence.textContent = 'Matter: ' + r.matter + '. Energy: ' + r.energy + (r.text ? ' Card: ' + r.text : '') + (r.note ? ' Your note: ' + r.note : '');
      turn.append(summary, evidence); $('#story-strip').append(turn);
    });
  }
  function reveal(id) {
    guess = id; revealed = true; save(); render(); $('#turn-stage').scrollTop = 0; $('#record').focus({ preventScroll: true });
  }
  $('#note').addEventListener('input', () => save());
  $('#skip-prediction').addEventListener('click', () => reveal(null));
  $('#roll').addEventListener('click', () => {
    if (state.pending !== null || state.done || state.coverageCheckpoint || rolling || unreadable !== null) return;
    state.pending = L.die(state.seed, state.rows.length); guess = null; revealed = false; rolling = true;
    $('#turn-details').open = false; $('#note').value = ''; save('Rolled ' + state.pending + '. Predict the destination, then reveal the card.');
    render(); $('.journey-hud').classList.add('rolling'); $('#turn-stage').scrollTop = 0;
    const delay = Lab.reducedMotion() ? 0 : 450;
    setTimeout(() => { rolling = false; $('.journey-hud').classList.remove('rolling'); $('#prediction-options button')?.focus({ preventScroll: true }); }, delay);
  });
  $('#record-form').addEventListener('submit', e => {
    e.preventDefault(); if (!revealed) return;
    try {
      state = L.record(state, { note: $('#note').value, prediction: guess }); guess = null; revealed = false; $('#note').value = ''; $('#turn-details').open = false;
      if (L.routeRepeating(state) && L.missingCoverage(state).length) state.coverageCheckpoint = 'repeat';
      save('Turn ' + state.rows.length + ' recorded. Your atom is at ' + name(L.current(state)) + '.'); render(); $('#turn-stage').scrollTop = 0;
      $(state.coverageCheckpoint ? '#coverage-continue' : '#roll').focus({ preventScroll: true });
    } catch (err) { announce(err.message); }
  });
  function finishJourney() {
    state.done = true; state.coverageCheckpoint = null; save(); render();
    $('#complete-copy').textContent = 'You recorded ' + state.rows.length + ' rolls and finish at ' + name(L.current(state)) + '. Compare your system, matter and energy totals next.';
    $('#complete-dialog').showModal();
  }
  $('#finish').addEventListener('click', () => {
    if (state.rows.length < 10 || state.pending !== null || state.done || state.coverageCheckpoint) return;
    if (!L.missingCoverage(state).length) { finishJourney(); return; }
    state.coverageCheckpoint = 'finish'; save('Review missed stations before finishing.'); render();
    $('#turn-stage').scrollTop = 0; $('#coverage-continue').focus({preventScroll:true});
  });
  $('#coverage-continue').addEventListener('click', () => {
    if (!state.coverageCheckpoint) return;
    const review = L.missingCoverage(state)[0];
    if (!review) return;
    state.coverageReviewed.push(review.from);
    if (state.coverageCheckpoint === 'finish' && !L.missingCoverage(state).length) { finishJourney(); return; }
    if (state.coverageCheckpoint === 'repeat') state.coverageCheckpoint = null;
    save('Station evidence reviewed: '+name(review.from)+'. Your journal has not changed.'); render();
    $('#turn-stage').scrollTop = 0;
    $(state.coverageCheckpoint ? '#coverage-continue' : '#roll').focus({preventScroll:true});
  });
  $('#analyze').addEventListener('click', () => { $('#complete-dialog').close(); setPage('evidence'); });
  $('#restart').addEventListener('click', () => { if (!$('#restart').disabled) $('#reset-dialog').showModal(); }); $('#cancel-reset').addEventListener('click', () => $('#reset-dialog').close());
  $('#confirm-reset').addEventListener('click', () => {
    const next = L.initial((state.seed + 0x6D2B79F5) >>> 0);
    const raw = JSON.stringify({ ...next, lastSection:'play', lastVisitedAt:Date.now(), presentation:{ guess:null, revealed:false, note:'' } });
    const cleared = saved(saveSession?.reset(key, raw), 'New journey ready.', true);
    $('#reset-dialog').close();
    if (!cleared) return;
    state = next; guess = null; revealed = false; questionIndex = 0; tourStation = '';
    questions.forEach(([id]) => $('#' + id).value = ''); $('#record-form').reset();
    section = 'play'; render(); showQuestion(); setPage('play', false);
  });
  function classroomReport() {
    const table = (title, columns, rows) => ({ type: 'table', title, columns, rows });
    const answer = (prompt, value) => ({ type: 'answer', prompt, value });
    const sections = [], missing = [];
    const rolls = state.rows;
    const answered = questions.filter(([id]) => state.answers[id]?.trim());
    if (!state.done || rolls.length < 10) missing.push('Record at least ten rolls, review missed stations, and finish your journey.');
    if (answered.length < questions.length) missing.push('Complete ' + (questions.length - answered.length) + ' Make sense responses.');
    if (rolls.length) {
      sections.push({ title: 'Your recorded journey · simulated dice', items: [
        table('Recorded rolls', ['Turn', 'Starting station', 'Die', 'Your prediction', 'Next station'],
          rolls.map(r => [r.turn, name(r.from), r.die, r.prediction === null ? 'Skipped' :
            r.prediction ? name(r.prediction) : 'Not saved in earlier version', name(r.to)])),
        table('Matter and energy in recorded turns', ['Turn', 'Matter', 'Energy'], rolls.map(r => [r.turn, r.matter, r.energy])),
        ...rolls.filter(r => r.text || r.note).map(r => answer('Turn ' + r.turn + ' · card event and your note',
          [r.text, r.note ? 'Your note: ' + r.note : ''].filter(Boolean).join('\n')))
      ] });
      sections.push({ title: 'Journey totals · counts of recorded rolls', items: [
        table('Starting stations', ['Station', 'Roll count'], L.totals(state, 'from', L.stations.map(s => s[0])).map(r => [name(r.label), r.count])),
        table('Forms of matter', ['Category', 'Roll count'], L.totals(state, 'matter', L.matter).map(r => [r.label, r.count])),
        table('Energy categories', ['Category', 'Roll count'], L.totals(state, 'energy', L.energy).map(r => [r.label, r.count]))
      ] });
    }
    if (state.pending !== null && (revealed || $('#note').value.trim())) {
      const note = $('#note').value.trim();
      sections.push({ title: 'Unrecorded turn · draft only', items: [
        answer('Roll at ' + name(L.current(state)), String(state.pending)),
        ...(revealed ? [answer('Your prediction', guess ? name(guess) : 'Skipped')] : []),
        ...(note ? [answer('Your note', note)] : [])
      ] });
    }
    const reviewed = L.tour(state).filter(card => state.coverageReviewed.includes(card.from));
    if (reviewed.length) sections.push({ title: 'Reference cards you reviewed · not extra rolls', items: reviewed.map(card =>
      answer(name(card.from) + ' → ' + name(card.to) + ' · ' + card.process, card.text)) });
    if (answered.length) sections.push({ title: 'Make sense responses', items: answered.map(([id, prompt]) => answer(prompt, state.answers[id])) });

    // Like the text recovery export, read only the editor's paired Budget snapshot (or its live in-memory work).
    const budget = unreadable === null ? (budgetUI ? budgetUI.exportData() : window.CarbonBudgetUI?.readExport?.(saveSession)) : null;
    const checkpoints = budget?.checkpoints || [], items = [];
    if (budget?.prediction?.trim()) items.push(answer('Your Budget prediction', budget.prediction));
    const labels = [['baseline', 'Without fire'], ['fire', 'With peat fire']];
    if (checkpoints.length) items.push(
      table('Carbon checkpoints (model units)', ['Checkpoint', 'Trial', 'Atmosphere', 'Ocean', 'Plants', 'Peat'],
        checkpoints.flatMap(c => labels.map(([key, label]) => [c.title, label, c[key].carbon.air, c[key].carbon.ocean, c[key].carbon.plants, c[key].carbon.peat]))),
      table('Energy checkpoints (model units)', ['Checkpoint', 'Trial', 'Sunlight input', 'Plant chemical', 'Peat chemical', 'Thermal dispersed'],
        checkpoints.flatMap(c => labels.map(([key, label]) => [c.title, label, c[key].energy.sunlight, c[key].energy.plants, c[key].energy.peat, c[key].energy.heat])))
    );
    if (budget?.explanation?.trim()) items.push(answer('Your Budget explanation', budget.explanation));
    if (items.length) sections.push({ title: 'Optional Carbon & Energy Budget · simulated comparison', items });
    const coreUnreadable = unreadable !== null, budgetUnreadable = budget?.unreadableBackup != null;
    const recovering = coreUnreadable || budgetUnreadable || ![key, budgetKey].every(k => saveSession?.check(k).ok);
    if (coreUnreadable || budgetUnreadable) missing.push('An unreadable save is not included in this report. Use the existing backup download to preserve it.');
    return {
      title: 'Carbon Atom Journey', unit: 'Unit 2',
      source: 'OpenSciEd Unit B.2 Lesson 9 station cards and Carbon/Energy Quantitative Model. Journey counts use simulated dice; they are not elapsed time or global carbon quantities. The optional Budget uses model units, not field measurements.',
      status: recovering ? 'recovery' : missing.length ? 'draft' : 'final', missing, student: reportIdentity(coreUnreadable || budgetUnreadable),
      keyResults: [{ label: 'Journey rolls recorded', value: rolls.length },
        { label: 'Reference cards reviewed separately', value: reviewed.length },
        { label: 'Make sense responses completed', value: answered.length + ' of ' + questions.length }], sections
    };
  }
  $('#download').addEventListener('click', () => {
    const backup = unreadable !== null;
    // The unopened extension must not borrow work from the next student's session.
    const budget = backup ? null : (budgetUI ? budgetUI.exportData() : window.CarbonBudgetUI?.readExport?.(saveSession)) ?? null;
    const student = backup ? null : reportIdentity(budget?.unreadableBackup != null);
    const payload = backup ? null : {
      format: 'openscied-carbon-journey-v2', mode: 'official-station-cards', simulated: true,
      exportedAt: new Date().toISOString(), ...state, questions: Object.fromEntries(questions),
      ...(student ? { student } : {}),
      pendingPresentation: state.pending === null ? null : { revealed, ...(revealed ? {prediction: guess} : {}), note: $('#note').value },
      referenceCardsReviewed: L.tour(state).filter(sample => state.coverageReviewed.includes(sample.from))
        .map(({from,to,process,text})=>({from,to,process,text})),
      budget
    };
    const url = URL.createObjectURL(new Blob([backup ? unreadable : JSON.stringify(payload, null, 2)], { type: backup ? 'text/plain' : 'application/json' })), a = document.createElement('a');
    a.href = url; a.download = backup ? 'carbon-atom-journey-saved-backup.txt' : 'carbon-atom-journey.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    announce(backup ? 'Saved backup downloaded. The original is still on this device.' : 'Journey downloaded, including any saved budget work.');
  });
  $('#print').addEventListener('click', () => window.print());
  function toggleMap() {
    const panel = $('.board-panel'), open = !panel.classList.contains('board-expanded');
    panel.classList.toggle('board-expanded', open); panel.classList.toggle('full-map', open);
    $('#map-toggle').setAttribute('aria-expanded', String(open)); $('#map-toggle').textContent = open ? 'Back to turn' : 'Show full map';
    $('#enlarge').textContent = open ? 'Close enlarged board' : 'Enlarge board';
    $('.journey-hud').inert = open; $('.journey-header').inert = open; $('.journey-tabs').inert = open;
    drawBoard(); (mobile() ? $('#map-toggle') : $('#enlarge')).focus({ preventScroll: true });
  }
  $('#map-toggle').addEventListener('click', toggleMap); $('#enlarge').addEventListener('click', toggleMap);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('.board-panel').classList.contains('board-expanded') && !document.querySelector('dialog[open]')) toggleMap(); });
  matchMedia('(max-width:850px)').addEventListener('change', () => { drawBoard(); showTotal(); });
  let totalTab = 'systems';
  function showTotal() { $('#totals').querySelectorAll('[data-total]').forEach(el => el.hidden = mobile() && el.dataset.total !== totalTab); }
  document.querySelectorAll('[data-total-tab]').forEach(b => b.addEventListener('click', () => { totalTab = b.dataset.totalTab; document.querySelectorAll('[data-total-tab]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); showTotal(); }));
  window.OpenSciEdSubmission?.mount({ target: '#classroom-submission', collect: classroomReport });
  render();
  const linked = location.hash.slice(1);
  // Opening another tab is read-only for current saves. Legacy formats still migrate
  // deliberately, with the same conflict guard as every other autosave.
  setPage(['play', 'evidence', 'sense', 'budget'].includes(linked) ? linked : section, migrateLegacy);
})();
