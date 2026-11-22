(function () {
  'use strict';
  const L = window.CarbonJourney, $ = s => document.querySelector(s);
  const key = 'aplab:openscied:b2-carbon-journey:v1';
  Lab.init({ id: 'openscied-b2-carbon-journey' });
  let raw = null;
  try { raw = localStorage.getItem(key); } catch (_) {}
  const restored = L.readSaved(raw);
  let unreadable = raw !== null && restored === null ? raw : null;
  let state = restored ?? L.initial(Lab.identity.seed.seed);
  const backupWarning = 'Saved work could not be read and has not been changed. Download the saved backup before starting a new journey.';
  const downloadButton = $('#download');
  const downloadLabel = downloadButton.textContent;
  if (unreadable !== null) downloadButton.textContent = 'Download saved backup';
  let guess = null, revealed = false, rolling = false, questionIndex = 0, chart;
  let section = 'play';
  if (restored) try { const v = JSON.parse(raw); if (['play', 'evidence', 'sense'].includes(v.lastSection)) section = v.lastSection; } catch (_) {}
  try { const old = JSON.parse(raw); if (state.pending !== null && old.presentation) { guess = L.stations.some(s => s[0] === old.presentation.guess) ? old.presentation.guess : null; revealed = old.presentation.revealed === true; if (typeof old.presentation.note === 'string') $('#note').value = old.presentation.note.slice(0,1000); } } catch (_) {}
  const name = id => L.stations.find(s => s[0] === id)[1];
  const mobile = () => matchMedia('(max-width:850px)').matches;
  function announce(message) { $('#status').textContent = message; }
  function save(message, replaceUnreadable = false) {
    if (unreadable !== null && !replaceUnreadable) { announce(backupWarning); return; }
    try {
      localStorage.setItem(key, JSON.stringify({ ...state, lastSection: section, lastVisitedAt: Date.now(), presentation: { guess, revealed, note: $('#note').value } }));
      unreadable = null;
      downloadButton.textContent = downloadLabel;
      announce(message || 'Journey saved on this device.');
    } catch (_) {
      announce(unreadable !== null
        ? 'Could not start a new saved journey. Your previous save has not been changed. Download the saved backup before trying again.'
        : 'Could not save on this device. Keep this page open and download your journey.');
    }
  }
  function setPage(id, saveSection = true) {
    section = id;
    if (saveSection) save();
    history.replaceState(null, '', '#' + id);
    document.body.classList.toggle('journey-playing', id === 'play');
    document.querySelectorAll('.journey-page').forEach(p => p.hidden = p.id !== id);
    document.querySelectorAll('[data-page]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.page === id)));
    if (id === 'evidence') drawChart();
    if (id === 'play') drawBoard();
    window.scrollTo(0, 0);
  }
  document.querySelectorAll('[data-page]').forEach(b => b.addEventListener('click', () => setPage(b.dataset.page)));
  $('[data-show-evidence]').addEventListener('click', () => setPage('evidence'));
  const questions = [
    ['q2', 'Why did all the carbon start out in the atmosphere?'],
    ['q3', 'What relationships or patterns do you notice in your journey’s totals?'],
    ['q4', 'Tell your carbon atom’s story. Include your recorded stops, forms of matter, energy transfers and mechanisms. Name specific organisms or materials.'],
    ['q5', 'Compare with a classmate. What was similar, even though your journeys differed?'],
    ['q6', 'How does this model help explain the effects of carbon dioxide added to the atmosphere by fires?']
  ];
  questions.forEach(([id, text]) => {
    const article = document.createElement('article'), label = document.createElement('label'), input = document.createElement('textarea');
    label.htmlFor = id; label.textContent = text; input.id = id; input.rows = id === 'q4' ? 6 : 3;
    input.maxLength = 20000; input.value = state.answers[id] || '';
    input.addEventListener('input', () => { state.answers[id] = input.value; save(); });
    article.append(label, input); $('#questions').append(article);
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
    const pending = state.pending !== null, c = pending ? L.outcome(state) : null, n = state.rows.length;
    $('#location').textContent = name(L.current(state));
    $('#turns').textContent = n + ' rolls · ' + (state.done ? 'complete' : n < 10 ? (10 - n) + ' to minimum' : 'ready to finish');
    $('#stage-label').textContent = pending ? revealed ? 'READ THE OFFICIAL CARD' : 'PREDICT YOUR NEXT STOP' : state.done ? 'JOURNEY COMPLETE' : 'READY TO EXPLORE';
    $('#card-instruction').textContent = pending ? name(L.current(state)) + ' · roll ' + state.pending + (state.producerExit ? ' · second table' : '') : state.done ? 'Explore your evidence next.' : unreadable !== null ? 'Saving is paused. Open Your evidence to download a backup or start a new journey.' : 'Roll to discover your atom’s next chapter.';
    $('#roll').hidden = pending || state.done; $('#roll').disabled = rolling || pending || state.done || unreadable !== null;
    $('#record').hidden = !pending || !revealed; $('#record').disabled = !pending || !revealed || state.done;
    $('#finish').disabled = n < 10 || pending || state.done;
    $('#finish').hidden = n < 10 || pending || state.done;
    $('#skip-prediction').hidden = !pending || revealed;
    $('#prediction-panel').hidden = !pending || revealed;
    $('#outcome-panel').hidden = !pending || !revealed;
    $('#ready-panel').hidden = pending;
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
      const tr = document.createElement('tr'); [r.turn, name(r.from), r.die, r.matter, r.energy, name(r.to), r.text || 'Earlier printed-card record', r.note].forEach(v => {
        const td = document.createElement('td'); td.textContent = v; tr.append(td);
      }); $('#journal').append(tr);
    });
    $('#summary').textContent = n ? n + ' rolls recorded. Your atom is at ' + name(L.current(state)) + '. Trace the recorded stops below.' : 'Record your journey first, then use its evidence here.';
    $('#story-strip').replaceChildren(); state.rows.forEach(r => { const p = document.createElement('p'); p.textContent = r.turn + '. ' + name(r.from) + ' → ' + name(r.to) + ' · ' + r.matter + (r.note ? ' · ' + r.note : ''); $('#story-strip').append(p); });
  }
  function reveal(id) {
    guess = id; revealed = true; save(); render(); $('#turn-stage').scrollTop = 0; $('#record').focus({ preventScroll: true });
  }
  $('#note').addEventListener('input', () => save());
  $('#skip-prediction').addEventListener('click', () => reveal(null));
  $('#roll').addEventListener('click', () => {
    if (state.pending !== null || state.done || rolling || unreadable !== null) return;
    state.pending = L.die(state.seed, state.rows.length); guess = null; revealed = false; rolling = true;
    $('#turn-details').open = false; $('#note').value = ''; save('Rolled ' + state.pending + '. Predict the destination, then reveal the card.');
    render(); $('.journey-hud').classList.add('rolling'); $('#turn-stage').scrollTop = 0;
    const delay = Lab.reducedMotion() ? 0 : 450;
    setTimeout(() => { rolling = false; $('.journey-hud').classList.remove('rolling'); $('#prediction-options button')?.focus({ preventScroll: true }); }, delay);
  });
  $('#record-form').addEventListener('submit', e => {
    e.preventDefault(); if (!revealed) return;
    try {
      state = L.record(state, { note: $('#note').value }); guess = null; revealed = false; $('#note').value = ''; $('#turn-details').open = false;
      save('Turn ' + state.rows.length + ' recorded. Your atom is at ' + name(L.current(state)) + '.'); render(); $('#turn-stage').scrollTop = 0;
      $('#roll').focus({ preventScroll: true });
    } catch (err) { announce(err.message); }
  });
  $('#finish').addEventListener('click', () => {
    if (state.rows.length < 10 || state.pending !== null || state.done) return;
    state.done = true; save(); render(); $('#complete-copy').textContent = 'You recorded ' + state.rows.length + ' rolls and finish at ' + name(L.current(state)) + '. Compare your system, matter and energy totals next.'; $('#complete-dialog').showModal();
  });
  $('#analyze').addEventListener('click', () => { $('#complete-dialog').close(); setPage('evidence'); });
  $('#restart').addEventListener('click', () => $('#reset-dialog').showModal()); $('#cancel-reset').addEventListener('click', () => $('#reset-dialog').close());
  $('#confirm-reset').addEventListener('click', () => {
    state = L.initial((state.seed + 0x6D2B79F5) >>> 0); guess = null; revealed = false; questionIndex = 0;
    questions.forEach(([id]) => $('#' + id).value = ''); $('#record-form').reset(); $('#reset-dialog').close();
    section = 'play'; save('New journey ready.', true); render(); showQuestion(); setPage('play', false);
  });
  $('#download').addEventListener('click', () => {
    const payload = { format: 'openscied-carbon-journey-v1', mode: 'official-station-cards', simulated: true, exportedAt: new Date().toISOString(), ...state };
    const backup = unreadable !== null;
    const url = URL.createObjectURL(new Blob([backup ? unreadable : JSON.stringify(payload, null, 2)], { type: backup ? 'text/plain' : 'application/json' })), a = document.createElement('a');
    a.href = url; a.download = backup ? 'carbon-atom-journey-saved-backup.txt' : 'carbon-atom-journey.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    announce(backup ? 'Saved backup downloaded. The original is still on this device.' : 'Journey downloaded.');
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
  render();
  const linked = location.hash.slice(1);
  setPage(['play', 'evidence', 'sense'].includes(linked) ? linked : section);
})();
