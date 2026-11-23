(() => {
  'use strict';
  const L = window.CarryingLogic, ROUNDS = 12;
  const KEY = 'aplab:openscied-b1-carrying-capacity:run-v1';
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const n = new Intl.NumberFormat('en-US');
  const strings = ['prediction', 'claim', 'habitat-claim', 'limit'];
  const stages = ['run', 'habitat', 'evidence', 'explain'];
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
  const fresh = () => ({baseline:L.create(), comparison:null, selected:'baseline', page:'run', grass:50, answers:{}, checks:{}});
  const cleaned = (r) => {
    const x = L.restore(r);
    return x && x.round <= ROUNDS && x.roleSlots === 20 && x.startingPopulation === 2 ? x : null;
  };
  let state = fresh();
  try {
    const raw = JSON.parse(localStorage.getItem(KEY));
    if (raw && typeof raw === 'object') {
      const a = cleaned(raw.baseline), b = cleaned(raw.comparison);
      if (a?.grassPercent === 100) state.baseline = a;
      if (state.baseline.round === ROUNDS && b && [50,75].includes(b.grassPercent)) state.comparison = b;
      if (raw.selected === 'comparison' && state.comparison) state.selected = 'comparison';
      if (stages.includes(raw.page)) state.page = raw.page;
      state.grass = state.comparison?.grassPercent || ([50,75].includes(raw.grass) ? raw.grass : 50);
      for (const id of strings) if (typeof raw.answers?.[id] === 'string') state.answers[id] = raw.answers[id].slice(0,4000);
      for (const [key, choices] of Object.entries({food:['grass','herd'],field:['yes','no']})) if (choices.includes(raw.checks?.[key])) state.checks[key] = raw.checks[key];
    }
  } catch {}
  const save = () => {
    try { localStorage.setItem(KEY, JSON.stringify(state)); $('#cc-save-status').textContent = 'Work saves on this device'; }
    catch { $('#cc-save-status').textContent = 'Device storage is unavailable. Download your work before leaving.'; }
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
  const habitat = window.CarryingHabitatUI.mount($('#cc-habitat-app'), {announce:speak});
  let chart, fieldChart;
  const field = L.EVIDENCE;
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
      const spec = {responsive:true,height:250,xLabel:'Round',yLabel:'Wildebeest (model individuals)',xMin:0,xMax:ROUNDS,yMin:0,yMax:20,series,simTag:false};
      if (chart) chart.update(spec); else chart = Lab.chart('#cc-chart',spec);
    }
  }
  function renderField() {
    const observations = field.rows;
    const spec = {responsive:true,height:290,xLabel:'Year',yLabel:'Estimated wildebeest',xMin:1961,xMax:1994,yMin:0,yMax:1600000,simTag:false,
      series:[{name:'Published March estimates',line:true,dots:true,points:observations.map(({year,population})=>({x:year,y:population}))}]};
    if (!fieldChart) fieldChart = Lab.chart('#cc-field-chart',spec); else fieldChart.update(spec);
  }
  function renderWriting() {
    const items = [state.baseline,state.comparison].filter((s)=>s?.round).map((s)=>'At round '+s.round+', the '+(s.grassPercent === 100?'baseline':s.grassPercent+'% grass comparison')+' ended with '+plural(s.population,'wildebeest','wildebeest')+'.');
    $('#cc-writing-evidence').textContent = [...items,compareText()].filter(Boolean).join(' ') || 'No model rounds yet. Return to the model to collect data.';
    $('#cc-writing-habitat').textContent = habitat.report() || 'No completed habitat runs yet.';
  }
  function go(page, focus = true) {
    state.page = page;
    for (const id of stages) { $('#cc-'+id).hidden = id !== page; const button = $('.cc-nav [data-cc-go="'+id+'"]'); if (id === page) button.setAttribute('aria-current','page'); else button.removeAttribute('aria-current'); }
    if (page === 'run') renderLab();
    if (page === 'evidence') renderField();
    if (page === 'explain') renderWriting();
    if (focus) { save(); $('#cc-'+page+'-title').focus(); }
  }
  function advance(end) {
    if (current().round >= ROUNDS) return;
    let s = L.step(current());
    if (end) while (s.round < ROUNDS) s = L.step(s);
    state[state.selected] = s;
    save(); renderLab();
    if (s.round === ROUNDS) {
      const target = state.comparison ? $('#cc-comparison-result') : $('#cc-compare');
      if (!target.hidden) { if (target.tagName !== 'BUTTON') target.tabIndex = -1; target.focus({preventScroll:true}); }
    }
    speak(outcome(s.rows.at(-1))+(s.round === ROUNDS ? ' Run complete.' : ''));
  }
  const fieldSource = field.source + '. ' + field.method;
  const fieldDOI = field.url;
  const report = () => {
    const who = Lab.identity.get() || {};
    const describe = (sim,name) => sim?.round ? [name+' (SIMULATED)', 'Round | Starting herd | Grass units | Survivors | Births | Deaths | Ending herd', ...sim.rows.map((r)=>[r.round,r.starting,r.grassAvailable,r.survivors,r.births,r.deaths,r.ending].join(' | '))].join('\n') : name+': no completed rounds.';
    return ['Serengeti Carrying Capacity Lab · Lesson 5', 'Name: '+(who.name || 'Not entered')+'\nClass period: '+(who.period || 'Not entered'), 'Prediction\n'+(state.answers.prediction || 'Not entered'), describe(state.baseline,'Baseline · 100% grass'), describe(state.comparison,'Grass comparison'+(state.comparison?' · '+state.comparison.grassPercent+'% grass':'')), compareText(), 'Habitat challenge (SIMULATED)\n'+(habitat.report() || 'No completed habitat runs.'), 'Field evidence (published estimates, not simulated)\n'+fieldSource+'\n'+fieldDOI, 'How did grass availability affect the herd in your model?\n'+(state.answers.claim || 'Not entered'), 'How did a limiting factor change the herd in the habitat challenge?\n'+(state.answers['habitat-claim'] || 'Not entered'), 'What is one thing this model cannot tell us about the real herd?\n'+(state.answers.limit || 'Not entered')].filter(Boolean).join('\n\n')+'\n';
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
    el.addEventListener('input',()=>{state.answers[id]=el.value;save();});
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
    state=fresh(); habitat.reset(); save(); $('#cc-reset-dialog').close(); $('#cc-grass').value='50';
    for (const id of strings) $('#cc-'+id).value='';
    $$('input[type="radio"]').forEach((el)=>{el.checked=false;});
    for (const id of ['cc-feedback','cc-field-feedback']) {$('#'+id).hidden=true;$('#'+id).textContent='';}
    $('#cc-table').open = false; $('#cc-download-status').hidden = true;
    go('run'); speak('Investigation cleared. Ready for round 1.');
  });
  $('#cc-field-source').append(fieldSource+' ');
  const citation = document.createElement('a'); citation.href=fieldDOI; citation.textContent='Read the study'; $('#cc-field-source').append(citation);
  $('#cc-field-data').innerHTML = '<details><summary>View published March estimates</summary><table><caption class="cc-sr">March wildebeest population estimates in Table 5</caption><thead><tr><th scope="col">Year</th><th scope="col">Estimated wildebeest</th></tr></thead><tbody>'+field.rows.map(({year,population})=>tableRow([year,n.format(population)])).join('')+'</tbody></table></details>';
  const interval = $('#cc-interval'), reveal = $('#cc-rate-reveal'), rateAnswer = $('#cc-rate-answer');
  interval.innerHTML = field.intervals.map((x,i)=>'<option value="'+i+'">'+x.start+' to '+x.end+'</option>').join('');
  function showInterval(show) {
    const {start,end} = field.intervals[Number(interval.value)];
    const r = L.historicalRate(start,end);
    $('#cc-interval-data').textContent = start+': '+n.format(r.startPopulation)+' estimated wildebeest. '+end+': '+n.format(r.endPopulation)+'. '+plural(r.years,'year','years')+' elapsed. Subtract the start estimate from the end estimate and divide by the years elapsed.';
    rateAnswer.hidden = !show; reveal.setAttribute('aria-expanded',String(show)); reveal.textContent = show?'Hide average yearly change':'Show average yearly change';
    rateAnswer.textContent = n.format(r.change)+' ÷ '+r.years+' ≈ '+n.format(Math.round(r.rate))+' wildebeest per year on average. Individual years can differ from this average.';
  }
  interval.addEventListener('change',()=>showInterval(false));
  reveal.addEventListener('click',()=>{ showInterval(rateAnswer.hidden); if(!rateAnswer.hidden) speak(rateAnswer.textContent); });
  showInterval(false);
  try {
    const host = $('#cc-identity');
    Lab.identity.mount(host);
    const clarify = () => host.querySelectorAll('p.small.muted').forEach((p)=>{if(p.textContent.includes('simulated data')) p.textContent='These details label your local download. The model gives the same result for the same settings.';});
    clarify(); new MutationObserver(clarify).observe(host,{childList:true,subtree:true});
  } catch {}
  go(state.page,false);
})();
