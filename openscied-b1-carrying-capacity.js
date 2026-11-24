(() => {
  'use strict';
  const L = window.CarryingLogic, ROUNDS = 12;
  const KEY = 'aplab:openscied-b1-carrying-capacity:run-v1';
  const saveAPI = window.OpenSciEdSaveSession, saveScope = 'b1-carrying-capacity';
  const keys = [KEY, ...['habitat','range','field'].map(part => 'aplab:openscied:b1-carrying-capacity:' + part + ':v1')];
  const reopen = () => { try { return saveAPI?.open(localStorage, saveScope, keys); } catch (_) { return null; } };
  let saveSession = reopen(), preservedSave = false;
  const getSaveSession = () => saveSession;
  function showSaveConflict(result) {
    const n = document.getElementById('save-conflict');
    const message = result?.reason === 'erased' ? 'Saved work was cleared in another tab. This tab cannot write it back.' :
      result?.reason === 'changed' ? 'A newer save from another tab was kept.' : 'This tab could not save on this device.';
    const copy = message + ' Download or copy this tab’s work before reloading.';
    if (n && (n.hidden || n.textContent !== copy)) { n.textContent = copy; n.hidden = false; speak(copy); }
    return copy;
  }
  function checkSaveConflict(event) {
    if (!saveSession) return;
    if (event.type === 'storage' && event.key && ![...keys, saveAPI.globalKey, saveAPI.scopeKey(saveScope), ...keys.map(saveAPI.resetKey)].includes(event.key)) return;
    const result = keys.map(key => saveSession.check(key)).find(x => !x.ok);
    if (result) showSaveConflict(result);
  }
  window.addEventListener('storage', checkSaveConflict);
  window.addEventListener('pageshow', checkSaveConflict);
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const optionalQuestion = 'habitat-claim';
  const requiredQuestions = ['claim', 'shortage-rule', 'long-run', 'migration-claim', 'limit'];
  const questions = [...requiredQuestions, optionalQuestion];
  const strings = ['prediction', ...questions];
  const stages = ['run', 'habitat', 'evidence', 'explain'];
  const evidenceFor = {'claim':'model','shortage-rule':'model','long-run':'range','migration-claim':'field','habitat-claim':'habitat','limit':'field'};
  const feedback = {
    food: {
      correct: 'Yes. One grass unit feeds one animal. If there is less grass than the herd needs, some animals do not survive.',
      wrong: 'Not quite. The starting herd size tells you how many animals need food, not how many can eat. Compare it with the available grass.'
    },
    field: {
      correct: 'Yes. Leveling off tells you growth slowed, not what caused it. To test a food explanation, look for separate evidence about resources, nutrition, and survival.',
      wrong: 'Not quite. Other limits could also slow growth. Population counts alone cannot distinguish food from those other possibilities.'
    }
  };
  const fresh = () => ({baseline:L.create(), comparison:null, selected:'baseline', page:'run', question:'claim', evidenceTrial:'baseline', evidenceRound:0, grass:50, answers:{}, checks:{}});
  const cleaned = (r) => {
    const x = L.restore(r);
    return x && x.round <= ROUNDS && x.roleSlots === 20 && x.startingPopulation === 2 ? x : null;
  };
  let state = fresh();
  try {
    const saved = saveSession ? saveSession.read(KEY) : localStorage.getItem(KEY);
    const raw = saved === null ? null : JSON.parse(saved);
    if (saved !== null && (!raw || typeof raw !== 'object' || Array.isArray(raw))) throw Error('Unknown saved format');
    if (raw && typeof raw === 'object') {
      const a = cleaned(raw.baseline), b = cleaned(raw.comparison);
      if (a?.grassPercent === 100) state.baseline = a;
      if (state.baseline.round === ROUNDS && b && [50,75].includes(b.grassPercent)) state.comparison = b;
      if (raw.selected === 'comparison' && state.comparison) state.selected = 'comparison';
      if (stages.includes(raw.page)) state.page = raw.page;
      if (questions.includes(raw.question)) state.question = raw.question;
      if (raw.evidenceTrial==='comparison' && state.comparison?.round) state.evidenceTrial='comparison';
      if (Number.isInteger(raw.evidenceRound) && raw.evidenceRound>0 && raw.evidenceRound<=ROUNDS) state.evidenceRound=raw.evidenceRound;
      state.grass = state.comparison?.grassPercent || ([50,75].includes(raw.grass) ? raw.grass : 50);
      for (const id of strings) if (typeof raw.answers?.[id] === 'string') state.answers[id] = raw.answers[id].slice(0,4000);
      for (const [key, choices] of Object.entries({food:['grass','herd'],field:['yes','no']})) if (choices.includes(raw.checks?.[key])) state.checks[key] = raw.checks[key];
    }
  } catch { preservedSave = true; }
  if (preservedSave) {
    const notice = document.getElementById('save-conflict');
    notice.textContent = 'An unreadable save was kept. Download it from the dashboard before clearing it. Download any new work from this tab before reloading.';
    notice.hidden = false;
  }
  const save = () => {
    if (preservedSave) return;
    let result;
    try { result = saveSession?.write(KEY, JSON.stringify(state)); } catch (_) {}
    $('#cc-save-status').textContent = result?.ok ? 'Work saves on this device' : showSaveConflict(result);
  };
  const speak = (text) => { $('#cc-status').textContent = text; };
  const current = () => state[state.selected];
  const rounds = (s) => [{x:0,y:s.startingPopulation}, ...s.rows.map((r) => ({x:r.round,y:r.ending}))];
  const escapeText = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const tableRow = (values) => '<tr><th scope="row">'+escapeText(values[0])+'</th>'+values.slice(1).map((x)=>'<td>'+escapeText(x)+'</td>').join('')+'</tr>';
  const plural = (x, one, many) => x+' '+(x === 1 ? one : many);
  const outcome = (r) => {
    if (!r) return 'No rounds yet. Predict how the herd will change, then run round 1 to see who gets enough grass.';
    const unfed = r.deaths ? plural(r.deaths,'animal did','animals did')+' not get enough grass.' : 'Every animal found enough grass.';
    const births = r.births ? plural(r.births,'calf joined','calves joined')+' the herd (half of the '+r.survivors+' fed animals, rounded down).' : 'No calves joined the herd: half of the fed animals rounds down to zero.';
    return 'Round '+r.round+': '+r.starting+' wildebeest competed for '+plural(r.grassAvailable,'grass unit','grass units')+'. '+unfed+' '+births+' The herd '+(r.ending>r.starting?'grew':r.ending<r.starting?'shrunk':'stayed the same')+' ('+r.starting+' → '+r.ending+').';
  };
  const mean = (rows) => rows.reduce((a,r)=>a+r.ending,0) / rows.length;
  const compareText = () => {
    if (!state.comparison || state.comparison.round < ROUNDS) return '';
    const first = mean(state.baseline.rows.slice(-4)).toFixed(1), second = mean(state.comparison.rows.slice(-4)).toFixed(1);
    return 'Over the last four rounds, the herd averaged '+first+' in the baseline and '+second+' with '+state.comparison.grassPercent+'% grass available. A herd can fluctuate from round to round; compare the pattern, not just the last point.';
  };
  const scene = window.CarryingScene.mount($('#cc-board'));
  const habitat = window.CarryingHabitatUI.mount($('#cc-habitat-app'), {announce:speak,getSaveSession,onSaveConflict:showSaveConflict});
  let chart, marks = [];
  const range = window.CarryingRange.mount($('#cc-range-app'), {announce:speak,getSaveSession,onSaveConflict:showSaveConflict,onMarks:(selected)=>{
    marks = selected;
    if (chart && state.page === 'run') chart.update({hLines:marks});
  }});
  const field = window.CarryingField.mount($('#cc-field-app'),{announce:speak,getSaveSession,onSaveConflict:showSaveConflict});
  function renderLab() {
    const s = current(), last = s.rows.at(-1), done = s.round === ROUNDS, compared = !!state.comparison;
    const scenario = state.selected === 'baseline' ? 'Baseline · All grass available' : 'Comparison · '+s.grassPercent+'% grass available';
    $('#cc-scenario').textContent = scenario;
    $('#cc-round').textContent = 'Round '+s.round+' of '+ROUNDS;
    $('#cc-board-phase').textContent = done ? 'End of run' : 'Before round '+(s.round+1);
    $('#cc-board-caption').textContent = (done ? 'Final herd and grass that would be available if another round were run.' : 'Starting herd and available grass for the next round.')+' One grass unit feeds one wildebeest.';
    scene.update({herd:s.population,grass:L.available(s),round:s.round,label:done ? 'End of run' : 'Before round '+(s.round+1)});
    $('#cc-outcome').textContent = outcome(last);
    $('#cc-next').disabled = $('#cc-finish').disabled = done;
    $('#cc-range-jump').hidden = !done;
    $('#cc-history tbody').innerHTML = s.rows.map((r)=>tableRow([r.round,r.starting,r.grassAvailable,r.survivors,r.births,r.deaths,r.ending])).join('');
    const ready = state.baseline.round === ROUNDS;
    $('#cc-compare-hint').textContent = compared ? 'Both runs stay on the graph. Choose which run to show on the board and in the table.' : ready ? 'Baseline complete. Choose how much grass will be available in the second run.' : 'Finish the baseline to unlock the comparison.';
    $('#cc-compare-controls').hidden = !ready || compared;
    $('#cc-run-switches').hidden = !compared;
    $('#cc-view-baseline').setAttribute('aria-pressed',String(state.selected === 'baseline'));
    $('#cc-view-comparison').setAttribute('aria-pressed',String(state.selected === 'comparison'));
    $('#cc-comparison-result').textContent = compareText();
    $('#cc-comparison-result').hidden = !compareText();
    if (state.page === 'run') {
      const series = [{name:'Baseline · 100% grass',line:true,dots:true,points:rounds(state.baseline)}];
      if (compared) series.push({name:'Comparison · '+state.comparison.grassPercent+'% grass',line:true,dots:true,dash:[6,4],points:rounds(state.comparison)});
      const spec = {responsive:true,height:300,xLabel:'Round',yLabel:'Wildebeest (model individuals)',xMin:0,xMax:ROUNDS,yMin:0,yMax:L.BASELINE.roleSlots,series,simTag:false,hLines:marks};
      if (chart) chart.update(spec); else chart = Lab.chart('#cc-chart',spec);
    }
    range.update({baseline:state.baseline,comparison:state.comparison});
  }
  function updateExplainProgress() {
    const done = requiredQuestions.filter(id=>state.answers[id]?.trim()).length;
    $('#cc-explain-progress').textContent = done+' of '+requiredQuestions.length+' required responses';
  }
  function renderQuestion() {
    const index = questions.indexOf(state.question);
    $('#cc-explain-question').value = state.question;
    $$('[data-cc-question]').forEach(el=>{el.hidden = el.dataset.ccQuestion !== state.question;});
    $('#cc-explain-prev').disabled = index === 0;
    $('#cc-explain-next').disabled = index === questions.length-1;
    $('#cc-explain-position').textContent = state.question === optionalQuestion ? 'Optional habitat question' :
      'Required question '+(index+1)+' of '+requiredQuestions.length;
    $('#cc-explain-next').textContent = questions[index+1] === optionalQuestion ? 'Optional question →' : 'Next →';
    $$('[data-cc-evidence]').forEach(d=>{d.open = d.dataset.ccEvidence===evidenceFor[state.question];});
    $('#cc-writing-migration').hidden = state.question!=='migration-claim';
    updateExplainProgress();
  }
  function chooseQuestion(id,previousFocus) {
    if (!questions.includes(id)) return;
    state.question = id;
    renderQuestion(); save();
    if (previousFocus?.disabled) $('#cc-explain-question').focus({preventScroll:true});
    speak($('#cc-explain-position').textContent+'. '+$('#cc-prompt-'+id).textContent);
  }
  $('#cc-explain-question').addEventListener('change',e=>chooseQuestion(e.target.value));
  $('#cc-explain-prev').addEventListener('click',e=>chooseQuestion(questions[questions.indexOf(state.question)-1],e.currentTarget));
  $('#cc-explain-next').addEventListener('click',e=>chooseQuestion(questions[questions.indexOf(state.question)+1],e.currentTarget));
  function renderRoundEvidence() {
    const models = ['baseline','comparison'].filter(id=>state[id]?.round);
    $('#cc-writing-rounds').hidden = !models.length;
    if (!models.length) return;
    if (!models.includes(state.evidenceTrial)) {state.evidenceTrial=models[0];state.evidenceRound=0;}
    const trial = state[state.evidenceTrial], shown = trial.rows.find(r=>r.round===state.evidenceRound) || trial.rows.find(r=>r.deaths>0) || trial.rows.at(-1);
    $('#cc-explain-trial').innerHTML = models.map(id=>'<option value="'+id+'">'+(id==='baseline'?'Baseline · 100% grass':state[id].grassPercent+'% grass comparison')+'</option>').join('');
    $('#cc-explain-trial').value = state.evidenceTrial;
    $('#cc-explain-round').innerHTML = trial.rows.map(r=>'<option value="'+r.round+'">Round '+r.round+'</option>').join('');
    $('#cc-explain-round').value = shown.round;
    const rows = [['start','Starting herd',shown.starting],['grass','Grass units',shown.grassAvailable],['survived','Survived',shown.survivors],['births','Births',shown.births],['deaths','Deaths',shown.deaths],['end','Ending herd',shown.ending]];
    $('#cc-explain-round-data').innerHTML = rows.map(([key,label,value])=>'<div><dt>'+label+'</dt><dd data-cc-stat="'+key+'">'+value+'</dd></div>').join('');
  }
  $('#cc-explain-trial').addEventListener('change',e=>{
    if (!['baseline','comparison'].includes(e.target.value)||!state[e.target.value]?.round) return;
    state.evidenceTrial=e.target.value;state.evidenceRound=0;renderRoundEvidence();save();
  });
  $('#cc-explain-round').addEventListener('change',e=>{
    state.evidenceRound=Number(e.target.value);renderRoundEvidence();save();
  });
  function renderLateEvidence() {
    const late = ['baseline','comparison'].filter(k=>state[k]?.round>=7);
    $('#cc-writing-late').innerHTML = late.length ? late.map(key=>{
      const t=state[key], rows=t.rows.filter(r=>r.round>=7);
      const name=key==='baseline'?'Baseline':t.grassPercent+'% grass comparison';
      return '<table data-cc-late-trial="'+key+'"><caption>'+name+' · simulated late rounds</caption><thead><tr><th scope="col">Round</th>'+rows.map(r=>'<th scope="col">'+r.round+'</th>').join('')+'</tr></thead><tbody><tr><th scope="row">Wildebeest</th>'+rows.map(r=>'<td data-cc-late-round="'+r.round+'">'+r.ending+'</td>').join('')+'</tr></tbody></table>';
    }).join('') : '';
  }
  function renderFieldEvidence() {
    const samples = window.CarryingField.DATA;
    const needed = new Set([1961,1977,1978,1994,1999,2012]);
    const format = new Intl.NumberFormat('en-US');
    const dataTable = (points,caption)=>'<table><caption>'+caption+'</caption><thead><tr><th scope="col">Year</th><th scope="col">Estimated herd</th></tr></thead><tbody>'+points.map(p=>tableRow([p.year,format.format(p.population)])).join('')+'</tbody></table>';
    $('#cc-writing-field-data').innerHTML = dataTable(samples.filter(p=>needed.has(p.year)),'Selected field estimates · not simulated')+'<details><summary>All 20 classroom estimates</summary>'+dataTable(samples,'OpenSciEd B.1 Lesson 5, adapted from Hopcraft et al. (2015)')+'</details><p>There are no classroom estimates for 1995–98. The field graph does not show where the herd grazed.</p>';
  }
  function renderWriting() {
    const items = [state.baseline,state.comparison].filter((s)=>s?.round).map((s)=>'At round '+s.round+', the '+(s.grassPercent === 100?'baseline':s.grassPercent+'% grass comparison')+' ended with '+plural(s.population,'wildebeest','wildebeest')+'.');
    $('#cc-writing-evidence').textContent = [...items,compareText()].filter(Boolean).join(' ') || 'No model rounds yet. Return to the model to collect data.';
    $('#cc-writing-habitat').textContent = habitat.report() || 'No completed habitat runs yet.';
    $('#cc-writing-range').textContent = range.report() || 'No fluctuation range recorded yet.';
    $('#cc-writing-field').textContent = field.report() || 'No field-rate calculations recorded yet.';
    renderRoundEvidence();renderLateEvidence();renderFieldEvidence();
  }
  function go(page, focus = true) {
    state.page = page;
    for (const id of stages) { $('#cc-'+id).hidden = id !== page; const button = $('.cc-nav [data-cc-go="'+id+'"]'); if (id === page) button.setAttribute('aria-current','page'); else button.removeAttribute('aria-current'); }
    if (page === 'run') renderLab();
    if (page === 'evidence') field.update();
    if (page === 'explain') {renderWriting();renderQuestion();}
    if (focus) { save(); $('#cc-'+page+'-title').focus(); }
  }
  function advance(end) {
    if (current().round >= ROUNDS) return;
    let s = L.step(current());
    if (end) while (s.round < ROUNDS) s = L.step(s);
    state[state.selected] = s;
    save(); renderLab();
    if (s.round === ROUNDS) {
      const target = $('#cc-range-jump');
      if (!target.hidden) { if (target.tagName !== 'BUTTON') target.tabIndex = -1; target.focus({preventScroll:true}); }
    }
    speak(outcome(s.rows.at(-1))+(s.round === ROUNDS ? ' Run complete.' : ''));
  }
  const report = () => {
    const who = Lab.identity.get() || {};
    const describe = (sim,name) => sim?.round ? [name+' (SIMULATED)', 'Round | Starting herd | Grass units | Survivors | Births | Deaths | Ending herd', ...sim.rows.map((r)=>[r.round,r.starting,r.grassAvailable,r.survivors,r.births,r.deaths,r.ending].join(' | '))].join('\n') : name+': no completed rounds.';
    return ['Serengeti Carrying Capacity Lab · Lesson 5', 'Name: '+(who.name || 'Not entered')+'\nClass period: '+(who.period || 'Not entered'), 'Prediction\n'+(state.answers.prediction || 'Not entered'), describe(state.baseline,'Baseline · 100% grass'), describe(state.comparison,'Grass comparison'+(state.comparison?' · '+state.comparison.grassPercent+'% grass':'')), compareText(), 'Estimated fluctuation range (SIMULATED)\n'+(range.report() || 'No range recorded.'), 'Habitat challenge (SIMULATED)\n'+(habitat.report() || 'No completed habitat runs.'), 'Field evidence (classroom estimates, not simulated)\n'+(field.report() || 'No field calculations recorded.'), 'How did grass availability affect the herd in your model?\n'+(state.answers.claim || 'Not entered'), 'Write an if/then rule for a grass shortage.\n'+(state.answers['shortage-rule'] || 'Not entered'), 'Predict what the baseline graph would look like after 50 rounds.\n'+(state.answers['long-run'] || 'Not entered'), 'How could migration affect carrying capacity?\n'+(state.answers['migration-claim'] || 'Not entered'), 'Optional: How did a limiting factor change the herd in the habitat challenge?\n'+(state.answers['habitat-claim'] || 'Not entered'), 'What is one thing this model cannot tell us about the real herd?\n'+(state.answers.limit || 'Not entered')].filter(Boolean).join('\n\n')+'\n';
  };
  const openReport = (message) => {
    $('#cc-report-text').value = report(); $('#cc-report-help').textContent = message || 'Select and copy this text if your device blocks downloads.'; $('#cc-report').showModal();
  };
  $('#cc-download').addEventListener('click', () => {
    let url;
    try {
      url = URL.createObjectURL(new Blob([report()],{type:'text/plain;charset=utf-8'}));
      const a = document.createElement('a'); a.href=url; a.download='carrying-capacity-investigation.txt'; document.body.append(a); a.click(); a.remove();
      setTimeout(()=>URL.revokeObjectURL(url), 30000);
      const note = $('#cc-download-status'); note.textContent = 'Download requested. If no file appears, use View text to copy.'; note.hidden = false; speak(note.textContent);
    } catch { if (url) URL.revokeObjectURL(url); openReport('Download was unavailable. Select and copy your investigation below.'); }
  });
  $('#cc-copy').addEventListener('click',()=>openReport());
  $$('.cc [data-cc-go]').forEach((button) => button.addEventListener('click',()=>go(button.dataset.ccGo)));
  $('#cc-next').addEventListener('click',()=>advance(false));
  $('#cc-finish').addEventListener('click',()=>advance(true));
  $('#cc-range-jump').addEventListener('click',()=>{
    const target = $('#cc-range-title');
    if (!target) return;
    target.tabIndex = -1; target.focus({preventScroll:true}); target.scrollIntoView({block:'start'});
  });
  $('#cc-grass').value = state.grass;
  $('#cc-grass').addEventListener('change',(e)=>{ state.grass = Number(e.target.value); save(); });
  $('#cc-compare').addEventListener('click',()=>{
    if (state.baseline.round !== ROUNDS || state.comparison) return;
    state.comparison = L.create({grassPercent:state.grass});
    state.selected = 'comparison'; save(); renderLab(); $('#cc-next').focus(); speak('Comparison ready. Starting with the same herd and '+state.grass+'% of grass roles available.');
  });
  for (const mode of ['baseline','comparison']) $('#cc-view-'+mode).addEventListener('click',()=>{
    if (!state[mode]) return;
    state.selected = mode; save(); renderLab();
    speak((mode === 'baseline' ? 'Baseline' : 'Comparison')+' selected. '+outcome(current().rows.at(-1)));
  });
  for (const id of strings) {
    const el = $('#cc-'+id); el.value = state.answers[id] || '';
    el.addEventListener('input',()=>{state.answers[id]=el.value;save();if(id!=='prediction')updateExplainProgress();});
  }
  function renderCheck(key, resultId, choice, correct, announce = false) {
    const target = $('#'+resultId);
    target.textContent = choice ? feedback[key][choice === correct ? 'correct' : 'wrong'] : '';
    target.hidden = !choice;
    if (announce && choice) speak(target.textContent);
  }
  for (const [key,group,buttonId,resultId,correct] of [
    ['food','cc-check-food','cc-check-answer','cc-feedback','grass'],
    ['field','cc-check-field','cc-check-field-answer','cc-field-feedback','no']
  ]) {
    const radios = $$('input[name="'+group+'"]');
    const picked = () => radios.find((x)=>x.checked)?.value;
    radios.forEach((radio)=>{
      radio.checked = state.checks[key] === radio.value;
      radio.addEventListener('change',()=>{ delete state.checks[key]; save(); renderCheck(key,resultId,null,correct); });
    });
    renderCheck(key,resultId,picked(),correct);
    $('#'+buttonId).addEventListener('click',()=>{
      const val=picked();
      if (!val) { speak('Choose an answer first.'); radios[0].focus(); return; }
      state.checks[key]=val;save();renderCheck(key,resultId,val,correct,true);
    });
  }
  $('#cc-reset').addEventListener('click',()=>$('#cc-reset-dialog').showModal());
  $('#cc-reset-confirm').addEventListener('click',()=>{
    const conflict = saveSession && keys.map(key => saveSession.check(key)).find(x => !x.ok);
    let result;
    if (saveSession && !conflict) try { result = saveAPI.erase(localStorage, saveScope, keys); } catch (_) {}
    $('#cc-reset-dialog').close();
    if (!result?.ok) { showSaveConflict(conflict || result); return; }
    saveSession = reopen(); preservedSave = false; $('#save-conflict').hidden = true;
    state=fresh(); habitat.reset(true); range.reset(); field.reset(); $('#cc-grass').value='50';
    for (const id of strings) $('#cc-'+id).value='';
    $$('input[type="radio"]').forEach((el)=>{el.checked=false;});
    for (const id of ['cc-feedback','cc-field-feedback']) {$('#'+id).hidden=true;$('#'+id).textContent='';}
    $('#cc-table').open = false; $('#cc-download-status').hidden = true;
    go('run'); speak('Investigation cleared. Ready for round 1.');
  });
  try {
    const host = $('#cc-identity');
    Lab.identity.mount(host);
    const clarify = () => host.querySelectorAll('p.small.muted').forEach((p)=>{if(p.textContent.includes('simulated data')) p.textContent='These details label your local download. The model gives the same result for the same settings.';});
    clarify(); new MutationObserver(clarify).observe(host,{childList:true,subtree:true});
  } catch {}
  range.update({baseline:state.baseline,comparison:state.comparison});
  go(state.page,false);
})();
