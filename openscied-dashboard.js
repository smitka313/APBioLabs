/* Dashboard identity uses the same name and class period as the rest of Lab Bench. */
(function () {
  'use strict';
  const PREFIX = 'aplab:openscied:';
  // Each activity reads its own saved record: progress(raw) gives {started, section, visited, summary}; ids(saved) lists its written-response ids.
  const ACTIVITIES = [
    { id: 'cell-cycle', name: 'Cell Cycle & Cancer', file: 'openscied-b3-cell-cycle.html', key: PREFIX + 'b3-cell-cycle:v1', clears: 'game progress, growth-model trials, and answers', progress: cellCycleProgress, ids: responseIds },
    { id: 'dna-p53', name: 'DNA Copying, p53 & Gene Expression', file: 'openscied-b3-dna-p53.html', key: PREFIX + 'b3-dna-p53:v1', clears: 'model results and answers', progress: dnaP53Progress, ids: dnaP53ResponseIds },
    { id: 'inh-env', name: 'Inheritance, Environment & Cancer Risk', file: 'openscied-b3-inheritance-environment.html', key: PREFIX + 'b3-inheritance-environment:v1', clears: 'model results and answers', progress: inhEnvProgress, ids: inhEnvResponseIds },
    { id: 'b2-fires', name: 'Fires: Peat, Decomposition & Earth\u2019s Tilt', file: 'openscied-b2-fires.html', key: PREFIX + 'b2-fires:v1', clears: 'model results and answers', progress: b2FiresProgress, ids: inhEnvResponseIds },
    { id: 'peat-bog', name: 'Peat Bog Carbon Lab', file: 'openscied-b2-peat-bog-lab.html', key: PREFIX + 'b2-peat-bog:v1', clears: 'bog settings, recorded trials, and global warming settings', progress: peatBogProgress, ids: noResponseIds },
    { id: 'b2-burn', name: 'Burning Fuels: What Burns and Why', file: 'openscied-b2-burn-lab.html', key: PREFIX + 'b2-burn-lab:v1', clears: 'burn results and answers', progress: b2BurnProgress, ids: inhEnvResponseIds }
  ];
  const SECTIONS = ['overview', 'background', 'cell-game', 'growth-model', 'analyze', 'submit'];
  // Written-response fields. The activity saves the ids of every response field it has (saved.responseIds), so the
  // dashboard counts whatever the activity actually asks. This list is only the fallback for saves made before the
  // activity recorded them: the 10 analysis answers (starting idea plus the 9 analysis questions, 4a and 4b) plus the 21 Lesson 3 Making Sense fields.
  const MAKING_SENSE = ['g1', 'g1cp', 's', 'g2', 'g2cp', 'm', 'mcp'].reduce((ids, row) => ids.concat(['ms-r1-' + row + '-happened', 'ms-r1-' + row + '-represent']), [])
    .concat(['ms-r2-q1', 'ms-r2-q2', 'ms-r2-q3', 'ms-r2-q4', 'ms-limits-explain', 'ms-limits-could-not', 'ms-limits-progress']);
  const ANALYSIS = ['model-baseline', 'analysis-design', 'analysis-variation', 'analysis-celltypes', 'explanation', 'explanation-size', 'analysis-cancer', 'analysis-checkpoints', 'model-revision', 'model-prediction'];
  const FALLBACK_RESPONSES = MAKING_SENSE.concat(ANALYSIS);
  function responseIds(saved) {
    const listed = saved && Array.isArray(saved.responseIds) ? saved.responseIds.filter(id => typeof id === 'string' && id) : [];
    return listed.length ? Array.from(new Set(listed)) : FALLBACK_RESPONSES;
  }
  function written(fields, id) { return typeof fields[id] === 'string' && !!fields[id].trim(); }
  const $ = selector => document.querySelector(selector);
  function cellCycleProgress(raw) {
    if (!raw) return { summary: 'Not started', started: false, section: 'overview', visited: 0 };
    let saved;
    try { saved = JSON.parse(raw); if (!saved || saved.v !== 1) throw Error('Unknown saved format'); }
    catch (e) { return { summary: 'Saved work could not be read. Download a copy before restarting.', started: false, section: 'overview', visited: 0 }; }
    const fields = saved.fields || {}, game = saved.game || {}, results = game.roundResults || {};
    const ids = responseIds(saved), answers = ids.filter(id => written(fields, id)).length;
    const analysisStarted = ids.some(id => !/^ms-/.test(id) && written(fields, id));
    const trials = Array.isArray(saved.trials) ? saved.trials.length : 0;
    const sets = Math.ceil(trials / 3);
    const rounds = [1, 2].filter(n => results[n]).map(n => 'Round ' + n + ' complete');
    if (game.round && !results[game.round]) rounds.push('Round ' + game.round + ' in progress');
    const gameStatus = rounds.length ? rounds.join(' · ') : game.round ? 'Round ' + game.round + ' in progress' : 'Game not started';
    const started = !!(game.round || trials || answers || saved.quick || (SECTIONS.includes(saved.lastSection) && saved.lastSection !== 'overview'));
    const fallback = answers === ids.length ? 'submit' : analysisStarted ? 'analyze' : answers ? 'cell-game' : trials ? 'growth-model' : game.round ? 'cell-game' : 'overview';
    return { started, section: SECTIONS.includes(saved.lastSection) ? saved.lastSection : fallback,
      visited: Number.isFinite(saved.lastVisitedAt) ? saved.lastVisitedAt : 0,
      summary: started ? gameStatus + ' · ' + sets + ' trial set' + (sets === 1 ? '' : 's') + ' saved · ' + answers + ' of ' + ids.length + ' responses written' : 'Not started' };
  }
  // DNA Copying, p53 & Gene Expression (Lessons 5-6): the activity saves the ids of every written response; the fallback counts
  // any written text field in older or partial saves.
  const DNA_SECTIONS = ['overview', 'ideas', 'fork', 'sense5', 'checklist', 'explain', 'expression', 'sense6', 'wrapup'];
  function dnaP53ResponseIds(saved) {
    const listed = saved && Array.isArray(saved.responseIds) ? saved.responseIds.filter(id => typeof id === 'string' && id) : [];
    if (listed.length) return Array.from(new Set(listed));
    const fields = saved && saved.fields || {};
    return Object.keys(fields).filter(id => typeof fields[id] === 'string' && !/^(ex-el-|cl-.*-src-)/.test(id));
  }
  function dnaP53Progress(raw) {
    if (!raw) return { summary: 'Not started', started: false, section: 'overview', visited: 0 };
    let saved;
    try { saved = JSON.parse(raw); if (!saved || saved.v !== 1) throw Error('Unknown saved format'); }
    catch (e) { return { summary: 'Saved work could not be read. Download a copy before restarting.', started: false, section: 'overview', visited: 0 }; }
    const fields = saved.fields || {}, ids = dnaP53ResponseIds(saved), answers = ids.filter(id => written(fields, id)).length;
    const fork = !!(saved.fork && typeof saved.fork === 'object' && Object.keys(saved.fork).length);
    const runs = saved.expression && Array.isArray(saved.expression.runs) ? saved.expression.runs.length : 0;
    const started = !!(answers || fork || runs || (DNA_SECTIONS.includes(saved.lastSection) && saved.lastSection !== 'overview'));
    const fallback = answers && answers === ids.length ? 'wrapup' : runs ? 'sense6' : fork ? 'sense5' : answers ? 'ideas' : 'overview';
    return { started, section: DNA_SECTIONS.includes(saved.lastSection) ? saved.lastSection : fallback,
      visited: Number.isFinite(saved.lastVisitedAt) ? saved.lastVisitedAt : 0,
      summary: started ? (fork ? 'DNA fork results saved' : 'DNA fork not run yet') + ' · ' + runs + ' gene expression run' + (runs === 1 ? '' : 's') + ' · ' + answers + ' of ' + ids.length + ' responses written' : 'Not started' };
  }
  // Inheritance, Environment & Cancer Risk (Lessons 8-9): the activity saves the ids of every response; six scenes may save state.
  const INH_SECTIONS = ['overview', 'ideas', 'families', 'reader', 'lakita', 'twogene', 'passing', 'exit8', 'envideas', 'skindata', 'plan', 'yeast', 'uvdna', 'wrapup'];
  const INH_SCENES = ['pedigree', 'twoGene', 'meiosis', 'skin', 'planner', 'yeast'];
  function inhEnvResponseIds(saved) {
    const listed = saved && Array.isArray(saved.responseIds) ? saved.responseIds.filter(id => typeof id === 'string' && id) : [];
    if (listed.length) return Array.from(new Set(listed));
    const fields = saved && saved.fields || {};
    return Object.keys(fields).filter(id => typeof fields[id] === 'string');
  }
  function inhEnvProgress(raw) {
    if (!raw) return { summary: 'Not started', started: false, section: 'overview', visited: 0 };
    let saved;
    try { saved = JSON.parse(raw); if (!saved || saved.v !== 1) throw Error('Unknown saved format'); }
    catch (e) { return { summary: 'Saved work could not be read. Download a copy before restarting.', started: false, section: 'overview', visited: 0 }; }
    const fields = saved.fields || {}, ids = inhEnvResponseIds(saved), answers = ids.filter(id => written(fields, id)).length;
    const models = INH_SCENES.filter(id => saved[id] && typeof saved[id] === 'object').length;
    const started = !!(answers || models || (INH_SECTIONS.includes(saved.lastSection) && saved.lastSection !== 'overview'));
    const fallback = answers && answers === ids.length ? 'wrapup' : saved.yeast ? 'uvdna' : saved.planner ? 'yeast' : saved.skin ? 'plan' : models ? 'passing' : answers ? 'ideas' : 'overview';
    return { started, section: INH_SECTIONS.includes(saved.lastSection) ? saved.lastSection : fallback,
      visited: Number.isFinite(saved.lastVisitedAt) ? saved.lastVisitedAt : 0,
      summary: started ? models + ' of 6 interactive models used · ' + answers + ' of ' + ids.length + ' answers saved' : 'Not started' };
  }
  // Fires: Peat, Decomposition & Earth's Tilt (Unit B.2, Lessons 3 and 5): the activity saves the ids of every response; three scenes may save state.
  const B2_SECTIONS = ['overview', 'ideas', 'plan', 'yeast', 'cards', 'sense3', 'hypothesis', 'tilt', 'sense5', 'peat', 'wrapup'];
  const B2_SCENES = ['cards', 'decomp', 'tilt'];
  function b2FiresProgress(raw) {
    if (!raw) return { summary: 'Not started', started: false, section: 'overview', visited: 0 };
    let saved;
    try { saved = JSON.parse(raw); if (!saved || saved.v !== 1) throw Error('Unknown saved format'); }
    catch (e) { return { summary: 'Saved work could not be read. Download a copy before restarting.', started: false, section: 'overview', visited: 0 }; }
    const fields = saved.fields || {}, ids = inhEnvResponseIds(saved), answers = ids.filter(id => written(fields, id)).length;
    const models = B2_SCENES.filter(id => saved[id] && typeof saved[id] === 'object').length;
    const started = !!(answers || models || (B2_SECTIONS.includes(saved.lastSection) && saved.lastSection !== 'overview'));
    const fallback = answers && answers === ids.length ? 'wrapup' : saved.tilt ? 'sense5' : saved.cards ? 'sense3' : saved.decomp ? 'cards' : answers ? 'ideas' : 'overview';
    return { started, section: B2_SECTIONS.includes(saved.lastSection) ? saved.lastSection : fallback,
      visited: Number.isFinite(saved.lastVisitedAt) ? saved.lastVisitedAt : 0,
      summary: started ? models + ' of 3 interactive models used · ' + answers + ' of ' + ids.length + ' answers saved' : 'Not started' };
  }
  // Peat Bog Carbon Lab (Unit B.2): a simulator with no written answers. Progress is the recorded trials plus whether the bog or warming settings were changed (all simulated data).
  const PEAT_SECTIONS = ['overview', 'bog', 'graph', 'zombie', 'warming', 'trials', 'model'];
  const PEAT_DEFAULTS = { tilt: 23.44, temp: 10, co2: 420, o2: 21, wet: 75, burn: 0 }, PEAT_CLIMATE = { fossil: 10, forest: 100, year: 2100 };
  function noResponseIds() { return []; }
  function peatBogProgress(raw) {
    if (!raw) return { summary: 'Not started', started: false, section: 'overview', visited: 0 };
    let saved;
    try { saved = JSON.parse(raw); if (!saved || saved.v !== 1) throw Error('Unknown saved format'); }
    catch (e) { return { summary: 'Saved work could not be read. Download a copy before restarting.', started: false, section: 'overview', visited: 0 }; }
    const trials = Array.isArray(saved.trials) ? saved.trials.length : 0;
    const bogChanged = !!saved.settings && Object.keys(PEAT_DEFAULTS).some(k => typeof saved.settings[k] === 'number' && Math.abs(saved.settings[k] - PEAT_DEFAULTS[k]) > 1e-6);
    const warmChanged = !!saved.climate && Object.keys(PEAT_CLIMATE).some(k => typeof saved.climate[k] === 'number' && saved.climate[k] !== PEAT_CLIMATE[k]);
    const started = !!(trials || bogChanged || warmChanged || (PEAT_SECTIONS.includes(saved.lastSection) && saved.lastSection !== 'overview'));
    const fallback = trials ? 'trials' : warmChanged ? 'warming' : bogChanged ? 'bog' : 'overview';
    return { started, section: PEAT_SECTIONS.includes(saved.lastSection) ? saved.lastSection : fallback,
      visited: Number.isFinite(saved.lastVisitedAt) ? saved.lastVisitedAt : 0,
      summary: started ? trials + ' simulated trial' + (trials === 1 ? '' : 's') + ' recorded · bog settings ' + (bogChanged ? 'changed' : 'unchanged') + ' · warming ' + (warmChanged ? 'explored' : 'not explored') : 'Not started' };
  }
  // Burning Fuels (Unit B.2, Lesson 2): the activity saves the ids of every response; the burn scene may save recorded samples.
  const BURN_SECTIONS = ['overview', 'ideas', 'fuels', 'burn', 'sense', 'sort', 'peat', 'wrapup'];
  function b2BurnProgress(raw) {
    if (!raw) return { summary: 'Not started', started: false, section: 'overview', visited: 0 };
    let saved;
    try { saved = JSON.parse(raw); if (!saved || saved.v !== 1) throw Error('Unknown saved format'); }
    catch (e) { return { summary: 'Saved work could not be read. Download a copy before restarting.', started: false, section: 'overview', visited: 0 }; }
    const fields = saved.fields || {}, ids = inhEnvResponseIds(saved), answers = ids.filter(id => written(fields, id)).length;
    const burns = saved.burn && Array.isArray(saved.burn.records) ? saved.burn.records.length : 0;
    const started = !!(answers || burns || (BURN_SECTIONS.includes(saved.lastSection) && saved.lastSection !== 'overview'));
    const fallback = answers && answers === ids.length ? 'wrapup' : burns ? 'sense' : answers ? 'ideas' : 'overview';
    return { started, section: BURN_SECTIONS.includes(saved.lastSection) ? saved.lastSection : fallback,
      visited: Number.isFinite(saved.lastVisitedAt) ? saved.lastVisitedAt : 0,
      summary: started ? burns + ' simulated burn' + (burns === 1 ? '' : 's') + ' recorded · ' + answers + ' of ' + ids.length + ' answers saved' : 'Not started' };
  }
  function init() {
    Lab.identity.mount('#openscied-student-identity');
    const status = $('#openscied-results-status');
    const dialog = $('#clear-openscied-dialog');
    const confirmation = $('#openscied-erase-confirmation');
    const confirmButton = $('#confirm-openscied-clear');
    let clearTarget = null;
    function savedKeys() {
      return Object.keys(localStorage).filter(key => key.startsWith(PREFIX));
    }
    function refresh(message) {
      try {
        const count = savedKeys().length;
        const recent = [];
        ACTIVITIES.forEach(activity => {
          const raw = localStorage.getItem(activity.key), item = activity.progress(raw);
          $('#' + activity.id + '-progress').textContent = item.summary;
          $('#' + activity.id + '-reset').disabled = !raw;
          const link = $('#' + activity.id + '-open');
          link.textContent = item.started ? 'Continue activity →' : 'Open activity →';
          link.href = activity.file + '#' + item.section;
          if (item.started) recent.push({ activity, item });
        });
        recent.sort((a, b) => b.item.visited - a.item.visited);
        $('#openscied-resume').hidden = !recent.length;
        if (recent.length) {
          const { activity, item } = recent[0];
          $('#openscied-resume-description').textContent = activity.name + ' · ' + item.summary;
          $('#openscied-resume-link').href = activity.file + '#' + item.section;
          $('#openscied-resume-link').textContent = 'Resume ' + activity.name + ' →';
        }
        $('#download-openscied-results').disabled = !count;
        $('#clear-openscied-results').disabled = !count;
        status.textContent = message || (count
          ? 'OpenSciEd work is saved on this device. You can download a copy or clear it for a fresh start.'
          : 'No OpenSciEd results saved on this device. Choose an activity to get started.');
      } catch (e) {
        $('#openscied-resume').hidden = true;
        ACTIVITIES.forEach(activity => { $('#' + activity.id + '-reset').disabled = true; });
        status.textContent = 'This browser cannot access saved work. Allow site storage to save or clear results.';
        $('#download-openscied-results').disabled = true;
        $('#clear-openscied-results').disabled = true;
      }
    }
    function downloadWork(onlyKeys) {
      try {
        const work = {};
        const keys = onlyKeys || savedKeys(), responses = {};
        keys.forEach(key => { work[key] = localStorage.getItem(key); });
        // A readable copy of every written response (Making Sense and analysis) next to the raw saved work.
        ACTIVITIES.filter(activity => keys.includes(activity.key)).forEach(activity => {
          let saved = null;
          try { saved = JSON.parse(work[activity.key]); } catch (e) { return; }
          const fields = saved && saved.fields || {};
          responses[activity.id] = {};
          activity.ids(saved).forEach(id => { responses[activity.id][id] = typeof fields[id] === 'string' ? fields[id] : ''; });
          // The DNA activity was shortened: answers saved by the longer version are no longer in its id list, so keep them in the copy.
          if (activity.id === 'dna-p53') Object.keys(fields).forEach(id => { if (!(id in responses[activity.id]) && typeof fields[id] === 'string') responses[activity.id][id] = fields[id]; });
        });
        const payload = { format: 'openscied-saved-work-v1', exportedAt: new Date().toISOString(), student: Lab.identity.get(), work, responses };
        const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
        const link = document.createElement('a');
        link.href = url; link.download = 'openscied-saved-work.json';
        document.body.appendChild(link); link.click(); link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        status.textContent = 'Downloaded a copy of your OpenSciEd work.';
      } catch (e) {
        status.textContent = 'Could not download your OpenSciEd work. Your saved results have not been cleared.';
      }
    }
    $('#download-openscied-results').addEventListener('click', () => downloadWork());
    $('#backup-before-openscied-clear').addEventListener('click', () => downloadWork(clearTarget ? [clearTarget.key] : null));
    function openClear(activity) {
      clearTarget = activity || null;
      $('#clear-openscied-title').textContent = activity ? 'Restart ' + activity.name + '?' : 'Clear OpenSciEd results?';
      $('#clear-openscied-description').textContent = activity
        ? 'This permanently clears this activity’s ' + activity.clears + ' on this device. Other activities, your name, class period, and AP Biology work stay saved.'
        : 'This permanently clears all OpenSciEd activity progress, model results, and answers saved on this device. Your name, class period, and AP Biology lab work will stay saved.';
      confirmButton.textContent = activity ? 'Erase this activity’s results' : 'Erase OpenSciEd results';
      confirmation.value = ''; confirmButton.disabled = true;
      $('#openscied-clear-error').textContent = '';
      dialog.showModal();
    }
    $('#clear-openscied-results').addEventListener('click', () => openClear());
    ACTIVITIES.forEach(activity => $('#' + activity.id + '-reset').addEventListener('click', () => openClear(activity)));
    confirmation.addEventListener('input', () => { confirmButton.disabled = confirmation.value !== 'ERASE'; });
    $('#cancel-openscied-clear').addEventListener('click', () => dialog.close());
    $('#clear-openscied-form').addEventListener('submit', event => {
      event.preventDefault();
      if (confirmation.value !== 'ERASE') return;
      try {
        (clearTarget ? [clearTarget.key] : savedKeys()).forEach(key => localStorage.removeItem(key));
        dialog.close();
        refresh(clearTarget ? clearTarget.name + ' results cleared. Other activities and your student sign-in are still saved.' : 'OpenSciEd results cleared. Your name, class period, and AP Biology work are still saved.');
      } catch (e) {
        $('#openscied-clear-error').textContent = 'Could not clear all saved results. Check your browser storage settings and try again.';
      }
    });
    // The dashboard can remain open while an activity saves in another tab.
    window.addEventListener('storage', event => { if (!event.key || event.key.startsWith(PREFIX)) refresh(); });
    window.addEventListener('pageshow', () => refresh());
    refresh();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
