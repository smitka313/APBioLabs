/* Dashboard identity uses the same name and class period as the rest of Lab Bench. */
(function () {
  'use strict';
  const PREFIX = 'aplab:openscied:';
  // Keep the exact existing key so work from the earlier preview stays available.
  const SERENGETI_KEY = 'aplab:openscied-b1-serengeti:preview-v1';
  const CARRYING_KEY = 'aplab:openscied-b1-carrying-capacity:run-v1';
  const CARBON_BUDGET_KEY = PREFIX + 'b2-carbon-journey:budget:v1';
  const FUTURES_KEY = PREFIX + 'b5-hybrid:v1';
  // Kept in sync with the board game's published fixed Model investigation question.
  const SERENGETI_MODEL_QUESTION = 'How do event cards and hunts change the wildebeest population across the four seasons?';
  const CARRYING_PARTS = ['range', 'habitat', 'field'];
  const CARRYING_EXTRA_KEYS = CARRYING_PARTS.map(part => PREFIX + 'b1-carrying-capacity:' + part + ':v1');
  const isOpenSciEdKey = key => key === SERENGETI_KEY || key === CARRYING_KEY || key.startsWith(PREFIX);
  // Each activity reads its own saved record: progress(raw) gives {started, section, visited, summary}; ids(saved) lists its written-response ids.
  const ACTIVITIES = [
    { id: 'migration', name: 'Migration Map Explorer', file: 'openscied-b1-migration.html', key: PREFIX + 'b1-migration:v1', clears: 'visited months, notebook entries, and written responses', progress: migrationProgress, ids: migrationResponseIds, answers: true },
    { id: 'carrying', name: 'Carrying Capacity', file: 'openscied-b1-carrying-capacity.html', key: CARRYING_KEY, extraKeys: CARRYING_EXTRA_KEYS, clears: 'grass model runs, habitat trials, range estimates, field evidence work, and written responses', progress: carryingProgress, ids: carryingResponseIds, answers: true },
    { id: 'serengeti', name: 'Serengeti Board Game', file: 'openscied-b1-serengeti.html', key: SERENGETI_KEY, clears: 'board game record, concept checks, and answers', progress: serengetiProgress, ids: serengetiResponseIds, answers: true },
    { id: 'ripple', name: 'Serengeti Ripple Effects', file: 'openscied-b1-ripple.html', key: PREFIX + 'b1-ripple:v1', clears: 'connections, prediction, run results, and written responses', progress: rippleProgress, ids: rippleResponseIds },
    { id: 'b2-burn', name: 'Burning Fuels: What Burns and Why', file: 'openscied-b2-burn-lab.html', key: PREFIX + 'b2-burn-lab:v1', clears: 'burn results and answers', progress: b2BurnProgress, ids: inhEnvResponseIds },
    { id: 'b2-fires', name: 'Fires: Peat, Decomposition & Earth\u2019s Tilt', file: 'openscied-b2-fires.html', key: PREFIX + 'b2-fires:v1', clears: 'model results and answers', progress: b2FiresProgress, ids: inhEnvResponseIds },
    { id: 'peat-bog', name: 'Peat Bog Carbon Lab', file: 'openscied-b2-peat-bog-lab.html', key: PREFIX + 'b2-peat-bog:v1', clears: 'bog settings, recorded trials, the graph explanation, and global warming settings', progress: peatBogProgress, ids: peatBogResponseIds },
    { id: 'carbon-journey', name: 'Carbon Atom Journey', file: 'openscied-b2-carbon-journey.html', key: PREFIX + 'b2-carbon-journey:v1', extraKeys: [CARBON_BUDGET_KEY], clears: 'carbon journey, budget trials, predictions and answers', progress: carbonJourneyProgress, ids: carbonResponseIds, answers: true },
    { id: 'cancer-rates', name: 'Cancer Rates Data Dive', file: 'openscied-b3-cancer-rates.html', key: PREFIX + 'b3-cancer-rates:v1', clears: 'prediction, case-file work, pinned comparisons, and written responses', progress: cancerRatesProgress, ids: cancerRatesResponseIds },
    { id: 'screening', name: 'Cancer Screening Design Lab', file: 'openscied-b3-screening.html', key: PREFIX + 'b3-screening:v1', clears: 'clinic plans and written recommendations', progress: screeningProgress, ids: screeningIds },
    { id: 'cell-cycle', name: 'Cell Cycle & Cancer', file: 'openscied-b3-cell-cycle.html', key: PREFIX + 'b3-cell-cycle:v1', clears: 'game progress, growth-model trials, and answers', progress: cellCycleProgress, ids: responseIds },
    { id: 'dna-workshop', name: 'DNA Workshop: Build, Copy, Decode', file: 'openscied-b3-dna-workshop.html', key: PREFIX + 'b3-dna-workshop:v1', clears: 'piece placements and written responses', progress: dnaWorkshopProgress, ids: dnaWorkshopResponseIds, answers: true },
    { id: 'dna-p53', name: 'DNA Copying, p53 & Gene Expression', file: 'openscied-b3-dna-p53.html', key: PREFIX + 'b3-dna-p53:v1', clears: 'model results and answers', progress: dnaP53Progress, ids: dnaP53ResponseIds },
    { id: 'inh-env', name: 'Inheritance, Environment & Cancer Risk', file: 'openscied-b3-inheritance-environment.html', key: PREFIX + 'b3-inheritance-environment:v1', clears: 'model results and answers', progress: inhEnvProgress, ids: inhEnvResponseIds },
    { id: 'hawksbeard', name: 'Hawksbeard Wind Lab', file: 'openscied-b4-hawksbeard.html', key: PREFIX + 'b4-hawksbeard:v1', clears: 'seed releases, prediction, and written responses', progress: hawksbeardProgress, ids: hawksbeardResponseIds, answers: true },
    { id: 'rat-generations', name: 'Rat Generations', file: 'openscied-b4-rat-generations.html', key: PREFIX + 'b4-rat-generations:v1', clears: 'model generations, prediction, and written responses', progress: ratGenerationsProgress, ids: ratGenerationsResponseIds, answers: true },
    { id: 'junco', name: 'Junco Investigation', file: 'openscied-b4-junco.html', key: PREFIX + 'b4-junco:v1', clears: 'prediction, investigation progress, and written responses', progress: juncoProgress, ids: juncoResponseIds },
    { id: 'wildlife-corridor', name: 'Wildlife Corridor Lab', file: 'openscied-b4-wildlife-corridor.html', key: PREFIX + 'b4-wildlife-corridor:v1', clears: 'prediction, crossing design, model runs, and written responses', progress: wildlifeCorridorProgress, ids: wildlifeCorridorResponseIds },
    { id:'wapusk', name:'Three Bears in Wapusk', file: 'openscied-b5-wapusk.html', key:PREFIX + 'b5-wapusk:v1', clears:'evidence notebook and comparison answers', progress:wapuskProgress, ids:wapuskIds },
    { id:'thermoregulation', name:'Bear Thermoregulation Lab', file: 'openscied-b5-thermoregulation.html', key:PREFIX+'b5-thermoregulation:v1', clears:'treadmill notebook, human readings, and matter and energy cards', progress:thermProgress, ids:thermIds },
    { id:'bear-ancestry', name:'Bear Ancestry Lab', file: 'openscied-b5-ancestry.html', key:PREFIX+'b5-ancestry:v1', clears:'trait notes, DNA comparisons, tree, and explanations', progress:bearAncestryProgress, ids:()=>['conclusion','revise'], answers:true },
    { id:'bear-speciation', name:'Ice Age Bear Speciation Explorer', file: 'openscied-b5-speciation.html', key:PREFIX+'b5-speciation:v1', clears:'model maps, fossil pins, and argument notebook', progress:bearSpeciationProgress, ids:()=>['first','needed','fossilNote','traitNote','revised','future'], answers:true },
    { id:'bear-hybrid', name:'Arctic Bear Futures & Hybridization', file: 'openscied-b5-hybrid.html', key:FUTURES_KEY, clears:'pinned climate comparisons, pedigree work, ten simulated matings, and responses', progress:bearHybridProgress, ids:()=>['prediction','evidence','claim','limit'], answers:true }
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
  const hasEntries = value => !!value && typeof value === 'object' && Object.keys(value).length > 0;
  const hasList = value => Array.isArray(value) && value.length > 0;
  const positive = value => Number.isFinite(value) && value > 0;
  const activityKeys = activity => [activity.key, ...(activity.extraKeys || [])];
  // The activity restores its own last screen. The three optional tools each have an independent save record.
  function carryingResponseIds() {
    return ['prediction', 'claim', 'shortage-rule', 'long-run', 'migration-claim', 'habitat-claim', 'limit'];
  }
  function carryingProgress(raw, optional = []) {
    const empty = {summary:'Not started', started:false, section:'', visited:0};
    const record = value => value && typeof value === 'object' && !Array.isArray(value);
    const round = value => Number.isInteger(value) && value >= 0 && value <= 12;
    let model, range, habitat, field;
    try {
      if (raw !== null && raw !== undefined) {
        model = JSON.parse(raw);
        if (!record(model) || !round(model.baseline?.round) || !record(model.answers) ||
            (model.comparison != null && !round(model.comparison.round))) throw Error('Unknown model record');
      }
      [range, habitat, field] = optional.map(value => {
        if (value === null || value === undefined) return null;
        const saved = JSON.parse(value);
        if (!record(saved) || saved.v !== 1) throw Error('Unknown tool record');
        return saved;
      });
    } catch (_) { return {...empty, summary:'Saved work could not be read. Download a copy before restarting.'}; }
    const baseline = model?.baseline.round || 0, comparison = model?.comparison?.round || 0;
    const answers = carryingResponseIds().filter(id => written(model?.answers || {}, id)).length;
    const rangeUsed = (typeof range?.note === 'string' && !!range.note.trim()) ||
      ['baseline','comparison'].some(trial => ['low','high','guess'].some(mark => Number.isFinite(range?.[trial]?.[mark])));
    const habitatUsed = typeof habitat?.scenario === 'string' && !!habitat.scenario;
    const fieldUsed = record(field?.entries) && Object.values(field.entries).some(entry =>
      entry && (written(entry,'answer') || written(entry,'reason') || entry.checked === true));
    const started = Boolean(baseline || model?.comparison || answers || Object.keys(model?.checks || {}).length ||
      rangeUsed || habitatUsed || fieldUsed);
    if (!started) return empty;
    const parts = [baseline + ' of 12 baseline rounds'];
    if (model?.comparison) parts.push(comparison + ' of 12 comparison rounds');
    parts.push(answers + ' of 7 responses written');
    if (rangeUsed) parts.push('Range work saved');
    if (habitatUsed) parts.push('Habitat work saved');
    if (fieldUsed) parts.push('Field work saved');
    return {started, section:'', visited:0, summary:parts.join(' · '),
      ...(baseline || comparison ? {stepsDone:baseline+comparison,stepsTotal:model?.comparison?24:12,stepsLabel:'Population model rounds'} : {})};
  }
  // Serengeti restores its last page from the existing saved record rather than a URL hash.
  function screeningIds(){return ['claim','limit'];}
  function screeningProgress(raw){
    const empty={started:false,section:'',summary:'Not started',visited:0};
    if(raw==null)return empty;
    let s;
    try{s=JSON.parse(raw);if(s?.v!==1||!Number.isInteger(s.seed)||s.seed<0||s.seed>4294967295)throw Error('Invalid save');}
    catch(_){return {...empty,summary:'Saved work could not be read. Download a copy before restarting.'};}
    if(s.started!==true){
      const practiced = s.practice && Object.values(s.practice).some(n=>n===1||n===2);
      return practiced ? {started:true,section:'',visited:Number(s.lastVisitedAt)||0,stepsDone:0,stepsTotal:3,
        stepsLabel:'Investigation milestones complete',summary:'Practice booking saved'} : empty;
    }
    const zone=z=>z==='hub'||z==='mobile',p=s.trial;
    const compared=zone(p?.screen)&&zone(p?.machine)&&p.operator===p.machine&&(zone(p.rides)||p.rides===null)
      &&(p.screen==='mobile'||p.machine==='mobile'||p.rides!==null)
      &&!(p.screen==='mobile'&&p.machine==='mobile'&&p.rides);
    const checks=Array.isArray(s.caseChecks)?new Set(s.caseChecks.filter(id=>Number.isInteger(id)&&id>=1&&id<=30)).size:0;
    const complete=compared&&checks===3&&s.finished===true&&screeningIds().every(id=>written(s,id));
    return {started:true,section:'',visited:Number(s.lastVisitedAt)||0,stepsDone:complete?3:compared&&checks===3?2:1,stepsTotal:3,stepsLabel:'Investigation milestones complete',
      summary:complete?'Investigation complete':compared?checks+'/3 patient comparisons checked':'Hospital plan recorded'};
  }
  function rippleResponseIds(){return ['choice','reason','claim','limit'];}
  function rippleProgress(raw){
    const empty={started:false,section:'',summary:'Not started',visited:0};
    if(raw==null)return empty;
    let s;
    try{s=JSON.parse(raw);if(s?.v!==1||!Array.isArray(s.answers)||!Number.isInteger(s.seed)||s.seed<0||s.seed>4294967295)throw Error('Invalid save');}
    catch(_){return {...empty,summary:'Saved work could not be read. Download a copy before restarting.'};}
    const linked=s.checked===true&&[1,1,1,1,-1,1].every((sign,i)=>s.answers[i]===sign);
    const predicted=linked&&s.predicted===true&&written(s,'reason')&&['decrease','same','increase'].includes(s.choice);
    const ran=predicted&&s.usual===true&&s.fewer===true;
    const finished=ran&&s.finished===true&&written(s,'claim')&&written(s,'limit');
    if(!s.answers.some(a=>a===1||a===-1)&&!rippleResponseIds().some(id=>written(s,id)))return empty;
    const n=[linked,predicted,ran,finished].filter(Boolean).length;
    return {started:true,section:'',visited:Number.isFinite(s.lastVisitedAt)?s.lastVisitedAt:0,stepsDone:n,stepsTotal:4,stepsLabel:'Investigation steps completed',
      summary:finished?'Investigation complete':ran?'Comparison recorded':predicted?'Prediction saved':linked?'Web checked':'Connections in progress'};
  }
  function serengetiResponseIds() { return ['question','evidence','claim','limits']; }
  function serengetiProgress(raw) {
    const empty = { summary: 'Not started', started: false, section: '', visited: 0 };
    if (!raw) return empty;
    let save;
    try {
      save = JSON.parse(raw);
      if (!save || save.v !== 1 || !Object.prototype.hasOwnProperty.call(save, 'game')
        || !save.answers || typeof save.answers !== 'object' || Array.isArray(save.answers)
        || (save.game !== null && (save.game.version !== 1 || !Array.isArray(save.game.log)
          || !Number.isInteger(save.game.season) || save.game.season < 0 || save.game.season > 3
          || !['migration','card','move','hunt','seasonEnd','complete'].includes(save.game.step)))) throw Error('Unknown format');
    } catch (_) { return { ...empty, summary: 'Saved work could not be read. Download a copy before restarting.' }; }
    const writtenCount = ['claim','limits'].filter(id => written(save.answers,id)).length;
    const started = Boolean(save.game || serengetiResponseIds().some(id => written(save.answers,id)));
    const records = save.game?.log.length || 0;
    const completed = save.game?.step === 'complete';
    const turn = save.game && ['Winter','Spring','Summer','Fall'][save.game.season];
    const phase = completed ? 'Year complete' : turn ? turn + ' turn' : 'Analysis started';
    return { ...empty, started, visited: Number.isFinite(save.lastVisitedAt) ? save.lastVisitedAt : 0,
      ...(save.game ? {stepsDone:completed?4:save.game.season,stepsTotal:4,stepsLabel:'Seasons completed'} : {}),
      summary: started ? phase + ' · ' + records + ' evidence ' + (records===1?'entry':'entries') + ' · ' + writtenCount + ' of 2 explanations written' : empty.summary };
  }
  function migrationResponseIds() { return ['question', 'prediction', 'patterns', 'absence', 'rain-prediction', 'rain-claim', 'regions', 'claim', 'limits', 'next']; }
  function migrationProgress(raw) {
    const empty = { summary: 'Not started', started: false, section: '', visited: 0 };
    if (!raw) return empty;
    let saved;
    try {
      saved = JSON.parse(raw);
      if (!saved || saved.v !== 1 || !Number.isInteger(saved.month) || saved.month < 0 || saved.month > 11 || !Array.isArray(saved.notes) || !Array.isArray(saved.visited) || !saved.answers || typeof saved.answers !== 'object' || Array.isArray(saved.answers)) throw Error('Unknown format');
    } catch (_) { return { ...empty, summary: 'Saved work could not be read. Download a copy before restarting.' }; }
    // Match explorer v1's stable month IDs and older timestamp/map-only IDs without loading the app.
    const monthNotes = new Set(), noteIds = new Set();
    for (const note of saved.notes) {
      if (!note || typeof note.id !== 'string') continue;
      const match = /^month-(\d{1,2})(?:-(?:map|\d+))?$/.exec(note.id);
      const month = match && Number(match[1]) < 12 ? Number(match[1])
        : note.type === 'map-observation' && Number.isInteger(note.month) && note.month >= 0 && note.month < 12 ? note.month : null;
      if (month === null) { noteIds.add(note.id); continue; }
      noteIds.add('month-' + month);
      const observation = typeof note.observation === 'string' ? note.observation
        : typeof note.text === 'string' ? (note.text.match(/(?:^|\n)My observation: ([\s\S]*?)(?=\nSource cards available for Location \d+\.\s*$|$)/) || [])[1] : '';
      if (observation?.trim()) monthNotes.add(month);
    }
    const months = monthNotes.size, notes = noteIds.size, answers = migrationResponseIds().filter(id => written(saved.answers,id)).length;
    const started = !!(notes || answers || Object.values(saved.observations || {}).some(v => typeof v === 'string' && v.trim()));
    const evidence = saved.notes.some(n=>n && typeof n.id==='string' && !/^month-/.test(n.id)) ||
      ['patterns','absence','rain-prediction','rain-claim','regions'].some(id=>written(saved.answers,id));
    const section = !started ? '' : saved.page==='explain' ? 'explain' : saved.page==='evidence' && evidence ? 'evidence' : 'explore';
    return { started, section,
      visited: Number.isFinite(saved.lastVisitedAt) ? saved.lastVisitedAt : 0,
      stepsDone:months,stepsTotal:12,stepsLabel:'Months with saved observations',
      summary: started ? months + ' of 12 months with notes · ' + notes + ' notebook ' + (notes===1?'entry':'entries') + ' · ' + answers + ' of 10 responses written' : 'Not started' };
  }
  function activityDestination(activity, item) { return activity.file + (item.section ? '#' + item.section : ''); }
  function carbonResponseIds(saved) { if(saved?.version===3)return ['q1','q2','q3','q4','q5']; return ['q2', 'q3', 'q4', 'q5', 'q6']; }
  function carbonJourneyProgress(raw, optional = []) {
    const journey = originalCarbonJourneyProgress(raw);
    if (!optional[0]) return journey;
    let budget;
    try {
      budget = JSON.parse(optional[0]);
      if (budget?.v !== 1 || !Number.isInteger(budget.position) || !Number.isInteger(budget.furthest) ||
          budget.position < -1 || budget.furthest < budget.position || budget.furthest > 8 ||
          typeof budget.prediction !== 'string' || typeof budget.explanation !== 'string') throw Error('Unknown budget format');
    } catch (_) {
      return {...journey, summary:(journey.summary === 'Not started' ? '' : journey.summary+' · ')+'Saved budget could not be read. Download a copy before restarting.'};
    }
    const started = budget.furthest > 0 || written(budget,'prediction') || written(budget,'explanation');
    if (!started) return journey;
    const visited = Number.isFinite(budget.lastVisitedAt) ? budget.lastVisitedAt : 0;
    const budgetSummary = budget.furthest >= 8 ? 'Budget comparison complete' :
      'Budget checkpoints: '+Math.max(0,budget.furthest)+' of 8';
    return {started:true, section:!journey.started || visited >= journey.visited ? 'budget' : journey.section,
      visited:Math.max(journey.visited,visited),
      ...(journey.started
        ? {stepsDone:journey.stepsDone,stepsTotal:journey.stepsTotal,stepsLabel:journey.stepsLabel}
        : {stepsDone:Math.max(0,budget.furthest),stepsTotal:8,stepsLabel:'Budget checkpoints reached'}),
      summary:(journey.started ? journey.summary+' · ' : '')+budgetSummary};
  }
  function originalCarbonJourneyProgress(raw) {
    const empty = { summary: 'Not started', started: false, section: 'play', visited: 0 };
    if (!raw) return empty;
    let saved;
    try { saved = JSON.parse(raw); if (!saved || ![1, 2, 3].includes(saved.version) || !Array.isArray(saved.rows)) throw Error('Unknown format'); }
    catch (_) { return { ...empty, summary: 'Saved work could not be read. Download a copy before restarting.' }; }
    const rolls = saved.rows.length, answers = carbonResponseIds(saved).filter(id => written(saved.answers || {}, id)).length;
    const started = !!(rolls || answers || saved.pending != null || written(saved.presentation || {},'note'));
    const fallback = answers ? 'sense' : saved.done ? 'evidence' : 'play';
    return { started, section: ['play', 'evidence', 'sense'].includes(saved.lastSection) ? saved.lastSection : fallback,
      visited: Number.isFinite(saved.lastVisitedAt) ? saved.lastVisitedAt : 0,
      stepsDone:Math.min(10,rolls),stepsTotal:10,stepsLabel:'Required turns recorded',
      summary: started ? rolls + ' rolls recorded · ' + answers + ' of 5 responses written' + (saved.done ? ' · Journey complete' : '') : 'Not started' };
  }
  const CANCER_RATES_SECTIONS = ['predict', 'explore', 'explain'];
  const CANCER_PREDICTIONS = ['same','different','unsure'];
  const CANCER_MEASURES = {
    types:['incidence','mortality'], states:['incidence','count'], poverty:['incidence','poverty','income'],
    michigan:['late-rate','late-share','screening','incidence','income'], race:['incidence','mortality']
  };
  const CANCER_CASE_ANSWERS = {access:'falling',diagnosis:'rising','test-cost':'longer'};
  function cancerRatesResponseIds() { return ['claim', 'limits']; }
  function cancerInvestigationQuestion(saved) {
    const casework = saved?.casework;
    return casework?.opened === true && written(casework, 'question') ? casework.question : '';
  }
  function cancerRatesProgress(raw) {
    const empty = { summary: 'Not started', started: false, section: '', visited: 0 };
    if (!raw) return empty;
    let saved;
    try {
      saved = JSON.parse(raw);
      if (!saved || typeof saved !== 'object' || Array.isArray(saved) || !Array.isArray(saved.evidence)) throw Error('Unknown format');
    } catch (_) { return { ...empty, summary:'Saved work could not be read. Download a copy before restarting.' }; }
    const field = key => typeof saved[key] === 'string' && saved[key].trim();
    const validChoice = CANCER_PREDICTIONS.includes(saved.prediction?.choice);
    const prediction = validChoice && saved.prediction?.locked === true;
    const predictionDraft = !prediction && (validChoice || written(saved.prediction || {},'reason'));
    const evidence = saved.evidence.filter(row => row && typeof row.a==='string' && !!row.a &&
      typeof row.b==='string' && !!row.b && row.a!==row.b &&
      Object.hasOwn(CANCER_MEASURES,row.view) && CANCER_MEASURES[row.view].includes(row.measure)).length;
    // New saves supply the activity's validated count of numeric comparisons.
    // Older exports are revalidated when opened; do not load the data library here.
    const numeric = saved.qualifyingPinCount === undefined ? evidence : Number.isInteger(saved.qualifyingPinCount)
      ? Math.min(evidence, Math.max(0, saved.qualifyingPinCount)) : 0;
    const answers = cancerRatesResponseIds().filter(field).length;
    const casework = saved.casework || {};
    // The activity only stores checked directions, not unsuccessful guesses.
    const checks = Object.entries(CANCER_CASE_ANSWERS).filter(([key,answer]) => casework[key] === answer).length;
    const notes = ['diagnoses','deaths','map'].filter(key => written(casework.notes ?? {}, key)).length;
    const trends = checks + notes;
    const question = cancerInvestigationQuestion(saved);
    const draft = typeof casework.questionDraft==='string' && casework.questionDraft.trim() !== String(casework.question || '').trim();
    const caseReady = trends === 6 && !!question;
    const completed = prediction && caseReady && !draft && numeric > 0 && answers === 2 && saved.completed === true;
    if (!prediction && !predictionDraft && !evidence && !answers && !trends && !question && !draft) return empty;
    const caseSummary = draft ? 'Question draft saved' : question ? 'Investigation question saved' : trends ? trends+' of 6 exhibits complete' : '';
    const fallback = answers || completed ? 'explain' : evidence || question ? 'explore' : 'predict';
    let section = CANCER_RATES_SECTIONS.includes(saved.step) ? saved.step : fallback;
    if (!prediction) section = 'predict';
    else if (draft || !caseReady) section = 'cr-income-cards';
    else if (!numeric) section = 'explore';
    return { started:true, section, visited:Number.isFinite(saved.lastVisitedAt) ? saved.lastVisitedAt : 0,
      stepsDone:trends,stepsTotal:6,stepsLabel:'Case-file exhibits completed',
      summary: [completed ? 'Investigation complete' : prediction ? 'Prediction saved' : predictionDraft ? 'Prediction draft' : '',
        caseSummary, numeric !== evidence ? numeric+' usable '+(numeric===1?'comparison':'comparisons')+' · '+(evidence-numeric)+' reference '+(evidence-numeric===1?'pin':'pins')
          : evidence || !caseSummary ? evidence+' pinned '+(evidence === 1 ? 'comparison' : 'comparisons') : '',
        answers ? answers+' of 2 responses saved' : ''].filter(Boolean).join(' · ') };
  }
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
    const started = !!(game.round || rounds.length || trials || answers || written(saved,'quick') || written(saved,'mechanism'));
    const fallback = answers === ids.length ? 'submit' : analysisStarted ? 'analyze' : answers ? 'cell-game' : trials ? 'growth-model' : game.round ? 'cell-game' : 'overview';
    return { started, section: SECTIONS.includes(saved.lastSection) ? saved.lastSection : fallback,
      visited: Number.isFinite(saved.lastVisitedAt) ? saved.lastVisitedAt : 0,
      ...(game.round || rounds.length ? {stepsDone:[1,2].filter(n=>!!results[n]).length,stepsTotal:2,stepsLabel:'Cell game rounds completed'} : {}),
      summary: started ? gameStatus + ' · ' + sets + ' trial set' + (sets === 1 ? '' : 's') + ' saved · ' + answers + ' of ' + ids.length + ' responses written' : 'Not started' };
  }
  // DNA Copying, p53 & Gene Expression (Lessons 5-6): the activity saves the ids of every written response; the fallback counts
  // any written text field in older or partial saves.
  const DNA_SECTIONS = ['overview', 'ideas', 'fork', 'sense5', 'checklist', 'explain', 'expression', 'sense6', 'wrapup'];
  function dnaWorkshopResponseIds() { return ['nucleotide','build','copy','rna','chain','sort']; }
  function dnaWorkshopProgress(raw) {
    const empty={started:false,section:'',visited:0,summary:'Not started'};
    let s;try {s=JSON.parse(raw);}catch (_){return empty;}
    if(!s||s.v!==1||s.progress?.v!==1||!s.progress.placed||
      typeof s.progress.placed!=='object'||Array.isArray(s.progress.placed))return empty;
    const placements=Object.values(s.progress.placed).filter(v=>typeof v==='string'&&v.length>0).length;
    const n=dnaWorkshopResponseIds().filter(id=>written(s.answers||{},id)).length;
    if(!placements&&!n)return empty;
    const logic=window.DNAWorkshopLogic;
    const workshops=['nucleotide','build','copy','rna','chain','sort'];
    const steps=logic?.complete ? {stepsDone:workshops.filter(id=>logic.complete(id,s.progress)).length,
      stepsTotal:workshops.length,stepsLabel:'Workshop practices completed'} : {};
    return {started:true,section:['nucleotide','build','copy','rna','chain','sort'].includes(s.step)?s.step:'nucleotide',
      visited:Number.isFinite(s.lastVisitedAt)?s.lastVisitedAt:0,...steps,
      summary:placements+' '+(placements===1?'piece':'pieces')+' placed'+(n?' · '+n+' '+(n===1?'response':'responses')+' saved':'')};
  }
  function dnaP53ResponseIds(saved) {
    const core=id=>typeof id==='string' && !!id && !['p-peer','peer-notes'].includes(id);
    const listed = saved && Array.isArray(saved.responseIds) ? saved.responseIds.filter(core) : [];
    if (listed.length) return Array.from(new Set(listed));
    const fields = saved && saved.fields || {};
    return Object.keys(fields).filter(id => core(id) && typeof fields[id] === 'string' && !/^(ex-el-|cl-.*-src-)/.test(id));
  }
  function dnaP53Progress(raw) {
    if (!raw) return { summary: 'Not started', started: false, section: 'overview', visited: 0 };
    let saved;
    try { saved = JSON.parse(raw); if (!saved || saved.v !== 1) throw Error('Unknown saved format'); }
    catch (e) { return { summary: 'Saved work could not be read. Download a copy before restarting.', started: false, section: 'overview', visited: 0 }; }
    const fields = saved.fields || {}, ids = dnaP53ResponseIds(saved), answers = ids.filter(id => written(fields, id)).length;
    const fork = !!(saved.fork?.steps?.unwound || saved.fork?.steps?.unzipped ||
      (typeof saved.fork?.stage === 'string' && !['','wound','coiled','start','ready'].includes(saved.fork.stage)) ||
      positive(saved.fork?.before?.top?.correct) || positive(saved.fork?.before?.bottom?.correct));
    const runs = saved.expression && Array.isArray(saved.expression.runs) ? saved.expression.runs.length : 0;
    const started = !!(answers || fork || runs);
    const fallback = answers && answers === ids.length ? 'wrapup' : runs ? 'sense6' : fork ? 'sense5' : answers ? 'ideas' : 'overview';
    return { started, section: DNA_SECTIONS.includes(saved.lastSection) ? saved.lastSection : fallback,
      visited: Number.isFinite(saved.lastVisitedAt) ? saved.lastVisitedAt : 0,
      stepsDone:Number(fork)+Number(runs>0),stepsTotal:2,stepsLabel:'Interactive models used',
      summary: started ? (fork ? 'DNA fork results saved' : 'DNA fork not run yet') + ' · ' + runs + ' gene expression run' + (runs === 1 ? '' : 's') + ' · ' + answers + ' of ' + ids.length + ' responses written' : 'Not started' };
  }
  // Inheritance, Environment & Cancer Risk (Lessons 8-9): the activity saves the ids of every response; six scenes may save state.
  const INH_SECTIONS = ['overview', 'ideas', 'families', 'reader', 'lakita', 'twogene', 'passing', 'exit8', 'envideas', 'skindata', 'plan', 'yeast', 'uvdna', 'wrapup'];
  const usedInheritanceScenes = saved => [
    hasEntries(saved.pedigree?.guesses),
    hasEntries(saved.twoGene?.genotypes) || hasEntries(saved.twoGene?.traced) || hasList(saved.twoGene?.mismatch) || written(saved.twoGene || {},'carrier'),
    hasList(saved.meiosis?.runs),
    hasEntries(saved.skin?.polls) || Object.values(saved.skin?.viewed || {}).some(value=>value===true),
    hasList(saved.planner?.conditions) || hasList(saved.planner?.controls) || written(saved.planner || {},'iv') || written(saved.planner || {},'dv') || saved.planner?.ready===true,
    positive(saved.yeast?.startedAt) || hasList(saved.yeast?.dishes)
  ].filter(Boolean).length;
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
    // Current records tell us which responses the activity's own choice counter uses.
    // Keep the older combined count for saves that do not identify the choices yet.
    const choices = Array.isArray(saved.choiceResponseIds)
      ? Array.from(new Set(saved.choiceResponseIds.filter(id => ids.includes(id)))) : [];
    const choiceCount = choices.filter(id => written(fields, id)).length;
    const models = usedInheritanceScenes(saved);
    const started = !!(answers || models || written(saved.question || {},'text'));
    const fallback = answers && answers === ids.length ? 'wrapup' : saved.yeast ? 'uvdna' : saved.planner ? 'yeast' : saved.skin ? 'plan' : models ? 'passing' : answers ? 'ideas' : 'overview';
    const responseSummary = choices.length ? choiceCount + ' of ' + choices.length + ' choice questions answered'
      : answers + ' of ' + ids.length + ' answers saved (choices and writing)';
    return { started, section: INH_SECTIONS.includes(saved.lastSection) ? saved.lastSection : fallback,
      visited: Number.isFinite(saved.lastVisitedAt) ? saved.lastVisitedAt : 0,
      stepsDone:models,stepsTotal:6,stepsLabel:'Interactive models used',
      summary: started ? models + ' of 6 interactive models used · ' + responseSummary : 'Not started' };
  }
  // Fires: Peat, Decomposition & Earth's Tilt (Unit B.2, Lessons 3 and 5): the activity saves the ids of every response; three scenes may save state.
  const B2_SECTIONS = ['overview', 'ideas', 'plan', 'yeast', 'cards', 'sense3', 'hypothesis', 'tilt', 'sense5', 'peat', 'wrapup'];
  const FIRES_TEMPS=[5,18,27,35,43,55], FIRES_DEFAULT_TEMPS=[18,27,43];
  const FIRES_LIGHTS=['direct','tilt45','tilt70','foil'];
  function firesMilestones(saved) {
    const evidence=saved.modelEvidence;
    const foam = saved.decomp, tilt=saved.tilt;
    // Older saves have the model inputs but lack the new comparison summary.
    const temps = FIRES_DEFAULT_TEMPS.map((fallback,i)=>{
      const raw=foam?.temps?.[i];
      if (raw==null) return fallback;
      const n=Number(raw);
      return Number.isFinite(n) ? FIRES_TEMPS.reduce((best,x)=>Math.abs(x-n)<Math.abs(best-n)?x:best) : 27;
    });
    const foamAfterBaseline=evidence?.foamAfterBaseline ??
      (Number.isFinite(foam?.seed) && Array.isArray(foam?.recorded) && foam.recorded.some(t=>Number.isInteger(t) && t>0 && t<=20 && t%2===0));
    const foamComparison=evidence?.foamComparison ?? (foamAfterBaseline && new Set(temps).size>=2);
    const validTubes=Array.isArray(tilt?.settings) && tilt.settings.length===3 && tilt.settings.every(id=>FIRES_LIGHTS.includes(id));
    const tiltComparison=evidence?.tiltComparison ??
      (tilt?.recorded===true && Number.isFinite(tilt.seed) && validTubes && new Set(tilt.settings).size>=2);
    return Number(evidence ? evidence.cardsRight===5 : saved.cards?.solved===true) + Number(foamComparison===true) +
      Number(tiltComparison===true && (evidence?.starchTested ?? tilt?.starchDone)===true);
  }
  const usedFiresScenes = saved => [
    hasEntries(saved.cards?.placed) || saved.cards?.solved===true || positive(saved.modelEvidence?.cardsPlaced),
    positive(saved.decomp?.startedAt) || hasList(saved.decomp?.recorded) || positive(saved.modelEvidence?.foamReadings),
    positive(saved.tilt?.startedAt) || saved.tilt?.recorded===true || saved.tilt?.starchDone===true || positive(saved.modelEvidence?.tubesRead)
  ].filter(Boolean).length;
  const hasClaimChecks = fields => Object.entries(fields).some(([id,value]) =>
    value === true && /^(?:cer-ev-[1-5]|cer-caveat)$/.test(id));
  function b2FiresProgress(raw) {
    if (!raw) return { summary: 'Not started', started: false, section: 'overview', visited: 0 };
    let saved;
    try { saved = JSON.parse(raw); if (!saved || saved.v !== 1) throw Error('Unknown saved format'); }
    catch (e) { return { summary: 'Saved work could not be read. Download a copy before restarting.', started: false, section: 'overview', visited: 0 }; }
    const fields = saved.fields || {}, ids = inhEnvResponseIds(saved), answers = ids.filter(id => written(fields, id)).length;
    const models = usedFiresScenes(saved);
    const milestones=firesMilestones(saved);
    const claim = hasClaimChecks(fields);
    const started = !!(answers || models || milestones || claim);
    const fallback = answers && answers === ids.length ? 'wrapup' : claim ? 'peat' : saved.tilt ? 'sense5' : saved.cards ? 'sense3' : saved.decomp ? 'cards' : answers ? 'ideas' : 'overview';
    return { started, section: B2_SECTIONS.includes(saved.lastSection) ? saved.lastSection : fallback,
      visited: Number.isFinite(saved.lastVisitedAt) ? saved.lastVisitedAt : 0,
      stepsDone:milestones,stepsTotal:3,stepsLabel:'Model evidence milestones complete',
      summary: started ? models + ' of 3 interactive models used · ' + answers + ' of ' + ids.length + ' answers saved' + (claim ? ' · Claim checklist saved' : '') : 'Not started' };
  }
  // Peat Bog Carbon Lab (Unit B.2): an explanation is saved work, but only recorded trials count toward the comparison meter.
  const PEAT_SECTIONS = ['overview', 'bog', 'graph', 'zombie', 'warming', 'trials', 'model'];
  const PEAT_DEFAULTS = { tilt: 23.44, temp: 10, co2: 420, o2: 21, wet: 75, burn: 0 }, PEAT_CLIMATE = { fossil: 10, forest: 100, year: 2100 };
  function peatBogResponseIds() { return ['graph-answer']; }
  function peatBogProgress(raw) {
    if (!raw) return { summary: 'Not started', started: false, section: 'overview', visited: 0 };
    let saved;
    try { saved = JSON.parse(raw); if (!saved || saved.v !== 1) throw Error('Unknown saved format'); }
    catch (e) { return { summary: 'Saved work could not be read. Download a copy before restarting.', started: false, section: 'overview', visited: 0 }; }
    const trialRows = Array.isArray(saved.trials) ? saved.trials : [];
    const trials = trialRows.length;
    const inputs=Object.keys(PEAT_DEFAULTS);
    const conditions=new Set(trialRows.map(row=>inputs.map(key=>row?.[key]))
      .filter(values=>values.every(Number.isFinite)).map(values=>JSON.stringify(values)));
    const bogChanged = !!saved.settings && Object.keys(PEAT_DEFAULTS).some(k => typeof saved.settings[k] === 'number' && Math.abs(saved.settings[k] - PEAT_DEFAULTS[k]) > 1e-6);
    // The page saves warmingUsed once any Global warming control or "Test the bog in this year" is used (even if the student ends on today's values).
    // Saves from before that flag existed fall back to comparing the climate settings with today's.
    const warmChanged = saved.warmingUsed === true || (!!saved.climate && Object.keys(PEAT_CLIMATE).some(k => typeof saved.climate[k] === 'number' && saved.climate[k] !== PEAT_CLIMATE[k]));
    const graphAnswered = written(saved.fields ?? {}, 'graph-answer');
    const started = !!(trials || bogChanged || warmChanged || graphAnswered || written(saved,'trialLabel'));
    const fallback = trials ? 'trials' : warmChanged ? 'warming' : graphAnswered ? 'graph' : bogChanged ? 'bog' : 'overview';
    return { started, section: PEAT_SECTIONS.includes(saved.lastSection) ? saved.lastSection : fallback,
      visited: Number.isFinite(saved.lastVisitedAt) ? saved.lastVisitedAt : 0,
      stepsDone:Math.min(conditions.size,2),stepsTotal:2,stepsLabel:'Trials saved for a comparison',
      summary: started ? trials + ' simulated trial' + (trials === 1 ? '' : 's') + ' recorded' +
        (trials>=2 && conditions.size===1 ? ' · The trials use the same conditions' : '') +
        ' · bog settings ' + (bogChanged ? 'changed' : 'unchanged') + ' · warming controls ' + (warmChanged ? 'used' : 'not used') +
        (graphAnswered ? ' · graph explanation saved' : '') : 'Not started' };
  }
  // Burning Fuels (Unit B.2, Lesson 2): the activity saves the ids of every response; the burn scene may save recorded samples.
  const BURN_SECTIONS = ['overview', 'ideas', 'fuels', 'burn', 'sense', 'sort', 'peat', 'wrapup'];
  function b2BurnProgress(raw) {
    if (!raw) return { summary: 'Not started', started: false, section: 'overview', visited: 0 };
    let saved;
    try { saved = JSON.parse(raw); if (!saved || saved.v !== 1) throw Error('Unknown saved format'); }
    catch (e) { return { summary: 'Saved work could not be read. Download a copy before restarting.', started: false, section: 'overview', visited: 0 }; }
    const fields = saved.fields || {}, ids = inhEnvResponseIds(saved), answers = ids.filter(id => written(fields, id)).length;
    const records=Array.isArray(saved.burn?.records)?saved.burn.records:[];
    const burns=records.length, fuelIds=['grass','leaves','wood','charcoal','peat'];
    const fuels=new Set(records.filter(rec=>fuelIds.includes(rec?.fuel)).map(rec=>rec.fuel));
    const claim = hasClaimChecks(fields);
    const started = !!(answers || burns || positive(saved.burn?.current?.startedAt) || claim);
    const fallback = answers && answers === ids.length ? 'wrapup' : claim ? 'peat' : burns ? 'sense' : answers ? 'ideas' : 'overview';
    return { started, section: BURN_SECTIONS.includes(saved.lastSection) ? saved.lastSection : fallback,
      visited: Number.isFinite(saved.lastVisitedAt) ? saved.lastVisitedAt : 0,
      stepsDone:fuels.size,stepsTotal:5,stepsLabel:'Fuels with saved results',
      summary: started ? burns + ' simulated burn' + (burns === 1 ? '' : 's') + ' recorded · ' + answers + ' of ' + ids.length + ' answers saved' + (claim ? ' · Claim checklist saved' : '') : 'Not started' };
  }
  const HAWKS_SECTIONS = ['predict', 'release', 'compare', 'explain'];
  function hawksbeardResponseIds() { return ['reflection', 'claim', 'evidence', 'limits']; }
  function ratGenerationsResponseIds() { return ['reason','claim','evidence','limits']; }
  function ratGenerationsProgress(raw) {
    const empty={summary:'Not started',started:false,section:'',visited:0};
    let s;try {s=JSON.parse(raw);}catch (_){return empty;}
    if(!s||s.v!==1||!Number.isInteger(s.seed)||s.seed<0||s.seed>0xffffffff||
      !Number.isInteger(s.action)||s.action<0||s.action>6||!['increase','same','decrease'].includes(s.prediction))return empty;
    const modelDone=s.action===6, analyzeDone=modelDone&&s.analysisChecked===true;
    const section=['predict','model'].includes(s.step)?s.step:
      modelDone?(s.step==='explain'&&analyzeDone?'explain':'analyze'):'model';
    const n=ratGenerationsResponseIds().filter(id=>written(s.answers||{},id)).length;
    const stepsDone=1+Number(modelDone)+Number(analyzeDone)+Number(analyzeDone&&['claim','evidence','limits'].every(id=>written(s.answers||{},id)));
    return {summary:s.action+' of 6 model actions recorded'+(n?' · '+n+' of 4 responses saved':''),
      started:true,section,visited:Number.isFinite(s.lastVisitedAt)?s.lastVisitedAt:0,stepsDone,stepsTotal:4,stepsLabel:'Investigation parts completed'};
  }
  function juncoResponseIds() { return ['prediction', 'claim', 'limits']; }
  function juncoProgress(raw) {
    const empty = { summary:'Not started', started:false, section:'', visited:0 };
    if (!raw) return empty;
    let saved;
    try {
      saved = JSON.parse(raw);
      if (!saved || typeof saved !== 'object' || Array.isArray(saved)) throw Error('Unknown format');
    } catch (_) { return { ...empty, summary:'Saved work could not be read. Download a copy before restarting.' }; }
    const sections = ['field', 'aviary', 'cort'];
    const prediction = written(saved, 'prediction'), revealed = saved.revealed === true;
    const answers = ['claim', 'limits'].filter(id => written(saved, id)).length;
    const fallback = revealed ? (answers ? 'cort' : 'aviary') : 'field';
    const section = sections.includes(saved.step) && (saved.step !== 'cort' || revealed) ? saved.step : fallback;
    const simulatedTrials = Array.isArray(saved.sim?.results) ? saved.sim.results.length : 0;
    const flightStarted = saved.sim?.active?.finished === false;
    if (!prediction && !revealed && !answers && !written(saved,'observation') && !written(saved,'reason') && !flightStarted && !simulatedTrials) return empty;
    const stage = { field:'Field notes', aviary:'Shared aviary', cort:'Stress hormone evidence' };
    const stepsDone=Number(written(saved,'observation'))+Number(revealed)+Number(answers===2);
    return { started:true, section, visited:Number.isFinite(saved.lastVisitedAt) ? saved.lastVisitedAt : 0,
      stepsDone,stepsTotal:3,stepsLabel:'Investigation steps completed',
      summary:[stage[section], simulatedTrials ? simulatedTrials+' simulated '+(simulatedTrials===1?'trial':'trials') : flightStarted ? 'Simulated trial in progress' : '', revealed ? 'Aviary results viewed' : prediction ? 'Prediction saved' : '', answers ? answers+' of 2 responses written' : ''].filter(Boolean).join(' · ') };
  }
  function wildlifeCorridorResponseIds(){ return ['claim','limits']; }
  function wildlifeCorridorProgress(raw){
    const empty={summary:'Not started',started:false,section:'',visited:0};
    if(raw==null)return empty;
    let s;
    try{
      s=JSON.parse(raw);
      if(s?.v===1&&s.model===undefined)return empty;
      const round=n=>Number.isInteger(n)&&n>=0&&n<=8;
      if(s?.v!==1||s.model!=='Aa'||!Number.isInteger(s.seed)||s.seed<0||s.seed>0xffffffff||!round(s.generations?.baseline)||
          !round(s.generations?.corridor)||![-1,1].includes(s.crossing))throw Error('Unknown format');
    }catch(_){return {...empty,summary:'Saved work could not be read. Download a copy before restarting.'};}
    const choice=['connected','same','divided'].includes(s.prediction?.choice);
    const reason=written(s.prediction||{},'reason');
    const prediction=choice&&reason, baseline=s.generations.baseline===8;
    const corridor=s.crossing===1&&s.generations.corridor===8;
    const finished=prediction&&baseline&&corridor&&s.finished===true&&wildlifeCorridorResponseIds().every(id=>written(s,id));
    const started=choice||reason||s.generations.baseline>0||s.crossing===1||wildlifeCorridorResponseIds().some(id=>written(s,id));
    if(!started)return empty;
    const stepsDone=[prediction,baseline,corridor,finished].filter(Boolean).length;
    // The activity restores its saved section itself; do not add a misleading fragment.
    return {started,section:'',visited:Number.isFinite(s.lastVisitedAt)?s.lastVisitedAt:0,
      stepsDone,stepsTotal:4,stepsLabel:'Investigation steps completed',
      summary:finished?'Investigation complete':[prediction?'Prediction saved':'Prediction in progress',
        s.generations.baseline>0?'First comparison: '+s.generations.baseline+' of 8 generations':'',
        s.crossing===1?'Crossing trial: '+s.generations.corridor+' of 8 generations':''].filter(Boolean).join(' · ')};
  }
  function hawksbeardProgress(raw) {
    const empty = { summary: 'Not started', started: false, section: '', visited: 0 };
    let saved;
    try { saved = JSON.parse(raw); } catch (_) { return empty; }
    if (!saved || saved.v !== 1 || !Number.isInteger(saved.released) || saved.released < 0 || saved.released > 5) return empty;
    const answers = hawksbeardResponseIds().filter(id => written(saved.answers || {}, id)).length;
    const prediction = ['city', 'field', 'same'].includes(saved.prediction);
    const started = Boolean(prediction || saved.released || answers);
    if (!started) return empty;
    const requested = saved.lastSection || saved.page;
    const section = HAWKS_SECTIONS.includes(requested) && (saved.released === 5 || requested === 'predict' || requested === 'release')
      ? requested : answers ? 'explain' : saved.released === 5 ? 'compare' : 'release';
    const visited = Number.isFinite(saved.lastVisitedAt) ? saved.lastVisitedAt : 0;
    const summary = saved.released + ' of 5 plant pairs released' + (answers ? ' · ' + answers + ' of ' + hawksbeardResponseIds().length + ' responses saved' : '');
    return { summary, started, section, visited, stepsDone:saved.released,stepsTotal:5,stepsLabel:'Plant pairs released' };
  }
  function wapuskIds(){return ['observe','scales','regional','seasonal','persistent','question'];}
  function wapuskProgress(raw){
    const blank={summary:'Not started',started:false,section:'',visited:0};
    let s;try{s=JSON.parse(raw);}catch(_){return blank;}
    if(s?.v!==1||!/^[A-F0-9]{8}$/.test(s.id))return blank;
    const n=wapuskIds().filter(id=>written(s.fields||{},id)).length;
    const hasScales=Array.isArray(s.scaleDraft)||Array.isArray(s.scaleCheck);
    const started=n>0||s.check==='place'||s.check==='meeting'||hasScales;
    if(!started)return blank;
    return {started,section:'',visited:Number(s.lastVisitedAt)||0,stepsDone:n,stepsTotal:6,stepsLabel:'Notebook responses saved',
      summary:n===6&&s.finished===true?'Notebook complete':(!n&&hasScales?'Scale choices saved · ':'')+n+' of 6 notebook responses saved'};
  }
  function thermIds(){return ['predict','field','pattern','human','explain'];}
  function thermProgress(raw){
    const blank={summary:'Not started',started:false,section:'',visited:0};
    let s;try{s=JSON.parse(raw);}catch(_){return blank;}
    if(s?.v!==1||!/^[A-F0-9]{8}$/.test(s.id))return blank;
    const n=thermIds().filter(id=>written(s.fields||{},id)).length;
    const started=n>0||['breaks','core','wild'].includes(s.check)||s.hum?.some?.(v=>typeof v==='string'&&v.trim())||Object.keys(s.sort||{}).length>0;
    if(!started)return blank;
    const section=['field','treadmill','human','model'].includes(s.step)?s.step:'field';
    return {started,section,visited:Number(s.lastVisitedAt)||0,stepsDone:n,stepsTotal:5,stepsLabel:'Notebook responses saved',summary:n+' of 5 notebook responses saved'};
  }
  function bearAncestryProgress(raw){
    const blank={summary:'Not started',started:false,section:'',visited:0};
    let s;try{s=JSON.parse(raw);}catch(_){return blank;}
    if(s?.v!==1||!/^[A-F0-9]{8}$/.test(s.id))return blank;
    const hasNotes=['profile','skull','teeth','claw'].some(k=>written(s.notes||{},k));
    if(!hasNotes)return blank;
    const guess=[0,1,2].includes(s.prediction);
    const dna=guess&&[0,1,2].every(i=>Array.isArray(s.checked)&&s.checked.includes(i));
    const tree=dna&&s.treeGood===true;
    const done=tree&&['conclusion','revise'].every(k=>written(s.answers||{},k));
    const n=Number(guess)+Number(dna)+Number(tree)+Number(done);
    const valid=['traits',...(guess?['dna']:[]),...(dna?['tree']:[]),...(tree?['explain']:[])];
    const section=valid.includes(s.step)?s.step:valid.at(-1);
    return {started:true,section,visited:Number(s.lastVisitedAt)||0,stepsDone:n,stepsTotal:4,stepsLabel:'Investigation steps completed',summary:n+' of 4 investigation steps complete'};
  }
  function bearSpeciationProgress(raw){
    const blank={summary:'Not started',started:false,section:'',visited:0};
    let s;try{s=JSON.parse(raw);}catch(_){return blank;}
    if(s?.v!==1||!/^[A-F0-9]{8}$/.test(s.id))return blank;
    const a=s.answers||{};
    const started=Object.keys(a).some(k=>written(a,k))||['cold','warm'].some(k=>Array.isArray(s.moves?.[k])&&s.moves[k].some(Boolean))||s.mathDraft?.some?.(Boolean)||s.mathChecked===true;
    if(!started)return blank;
    const map=s.locked===true;
    const fossil=map&&Array.isArray(s.pins)&&s.pins.some(i=>[0,1].includes(i))&&s.pins.some(i=>[2,3,4,5,6,7].includes(i))&&written(a,'fossilNote');
    const trait=fossil&&[0,1,2].every(i=>Array.isArray(s.genes)&&s.genes.includes(i))&&Number.isInteger(s.choices?.north)&&Number.isInteger(s.choices?.south)&&(s.rosterVersion!==2||s.matches?.north===true&&s.matches?.south===true)&&written(a,'traitNote');
    const finish=trait&&s.finished===true&&s.limit===true&&written(a,'revised')&&written(a,'future');
    const n=[map,fossil,trait,finish].filter(Boolean).length;
    const allowed=['cycles',...(map?['fossils']:[]),...(fossil?['traits']:[]),...(trait?['argument']:[])];
    return {started:true,section:allowed.includes(s.step)?s.step:allowed.at(-1),visited:Number(s.lastVisitedAt)||0,stepsDone:n,stepsTotal:4,stepsLabel:'Investigation steps completed',summary:n+' of 4 investigation steps complete'};
  }
  function bearHybridProgress(raw){
    const blank={summary:'Not started',started:false,section:'',visited:0};
    let s;try{s=JSON.parse(raw);}catch(_){return blank;}
    if(s?.v!==1||!/^[A-F0-9]{8}$/.test(s.id))return blank;
    const a=s.answers||{},start=Object.keys(a).some(k=>written(a,k))||!!s.year||s.rolls>0||
      (Array.isArray(s.islands)&&s.islands.length>0)||(Array.isArray(s.traces)&&s.traces.length>0);
    if(!start)return blank;
    const ice=[2030,2040,2050,2060,2070,2080,2090,2100].includes(s.year)&&written(a,'prediction');
    const family=ice&&Array.isArray(s.islands)&&['banks','victoria'].every(k=>s.islands.includes(k))&&Array.isArray(s.traces)&&
      s.traces.some(k=>['f1','f2','f3','f4'].includes(k))&&s.traces.some(k=>['c1','c2','c3','c4'].includes(k))&&written(a,'evidence');
    const model=family&&s.rolls===40,claim=model&&s.finished===true&&s.verdict==='clue'&&written(a,'claim')&&written(a,'limit');
    const n=[ice,family,model,claim].filter(Boolean).length,allowed=['ice',...(ice?['family']:[]),...(family?['model']:[]),...(model?['claim']:[])];
    return {started:true,section:allowed.includes(s.step)?s.step:allowed.at(-1),visited:Number(s.lastVisitedAt)||0,stepsDone:n,stepsTotal:4,stepsLabel:'Investigation steps completed',summary:n+' of 4 investigation steps complete'};
  }
  // Published, fixed denominators. A zero is meaningful even before a student starts.
  const STEP_SCALES = {
    migration:[12,'Months with saved observations'],carrying:[12,'Population model rounds'],
    serengeti:[4,'Seasons completed'],ripple:[4,'Investigation steps completed'],'b2-burn':[5,'Fuels with saved results'],'b2-fires':[3,'Model evidence milestones complete'],
    'peat-bog':[2,'Trials saved for a comparison'],'carbon-journey':[10,'Required turns recorded'],'cancer-rates':[6,'Case-file exhibits completed'],screening:[3,'Investigation steps completed'],
    'cell-cycle':[2,'Cell game rounds completed'],'dna-workshop':[6,'Workshop practices completed'],
    'dna-p53':[2,'Interactive models used'],'inh-env':[6,'Interactive models used'],
    hawksbeard:[5,'Plant pairs released'],'rat-generations':[4,'Investigation parts completed'],junco:[3,'Investigation steps completed'],
    'wildlife-corridor':[4,'Investigation steps completed'],wapusk:[6,'Notebook responses saved'],thermoregulation:[5,'Notebook responses saved'],'bear-ancestry':[4,'Investigation steps completed'],'bear-speciation':[4,'Investigation steps completed'],'bear-hybrid':[4,'Investigation steps completed']
  };
  // Only index identifiers with an established activity-report format.
  // Never infer who owns a raw browser record from the current sign-in.
  const datasetModels = {
    ripple:['SR-','seed'], screening:['SD-','seed'], hawksbeard:['HB-','seed'],
    'rat-generations':['RG-','seed'], junco:['JU-','notebookSeed'],
    'wildlife-corridor':['WC-AA-','seed'], wapusk:['WB-','id'],
    thermoregulation:['TH-','id'], 'bear-ancestry':['BA-','id'],
    'bear-speciation':['ICE-','id'], 'bear-hybrid':['HY-','id']
  };
  function backupDataset(activity, saved) {
    if (!Object.hasOwn(datasetModels,activity.id) || saved?.v!==1) return null;
    const [prefix, field] = datasetModels[activity.id];
    const value = saved[field];
    if (field==='id') return typeof value==='string' && /^[0-9A-F]{8}$/.test(value) ? prefix+value : null;
    return Number.isInteger(value) && value>=0 && value<=0xffffffff
      ? prefix+value.toString(16).toUpperCase().padStart(8,'0') : null;
  }
  function currentExporter(storage) {
    try {
      const identity=JSON.parse(storage.getItem('aplab:student'));
      const name=typeof identity?.name==='string'?identity.name.trim():'';
      if (name) return {name,period:typeof identity.period==='string'?identity.period:''};
    } catch (_) { /* The record can be anonymous or damaged. */ }
    return null;
  }
  function buildArchive(storage, onlyKeys) {
    const values=new Map();
    for (const key of new Set(onlyKeys||Object.keys(storage))) {
      if (typeof key!=='string'||!isOpenSciEdKey(key)) continue;
      const text=storage.getItem(key);
      if (text===null) continue;
      try {
        values.set(key,{parsed:true,value:JSON.parse(text)});
      } catch (_) {
        // Preserve exact bytes for recovery without burying every readable record
        // inside an escaped JSON string.
        values.set(key,{parsed:false,value:{unreadable:true,raw:text}});
      }
    }
    const work=Object.fromEntries([...values].map(([key,{value}])=>[key,value]));
    const responses={}, datasetIds={}, models={};
    // A readable copy of every written response (Making Sense and analysis) next to the raw saved work.
    ACTIVITIES.filter(activity => values.has(activity.key)).forEach(activity => {
      const archived=values.get(activity.key);
      if (!archived?.parsed) return;
      const saved=archived.value;
      const datasetId = backupDataset(activity,saved);
      if (datasetId) datasetIds[activity.id] = datasetId;
      const fields = saved && (['cancer-rates', 'junco', 'wildlife-corridor', 'ripple', 'screening'].includes(activity.id) ? saved : activity.answers ? saved.answers : saved.fields) || {};
      responses[activity.id] = {};
      activity.ids(saved).forEach(id => { responses[activity.id][id] = typeof fields[id] === 'string' ? fields[id] : ''; });
      if (activity.id==='serengeti') {
        responses.serengeti.modelQuestion=SERENGETI_MODEL_QUESTION;
        if (written(fields,'question')) responses.serengeti.investigationQuestion=fields.question;
      }
      if (activity.id==='bear-hybrid' && datasetId && Number.isInteger(saved.rolls) && saved.rolls>0 && saved.rolls<=40) {
        const data=window.ArcticBearData;
        models[activity.id]={datasetId,recordedFlips:saved.rolls,
          ...(data?.coinFlipDetails ? {coinFlips:data.coinFlipDetails(saved.id,saved.rolls)} : {detailUnavailable:true})};
      }
      // The DNA activity was shortened: answers saved by the longer version are no longer in its id list, so keep them in the copy.
      if (['hawksbeard','rat-generations'].includes(activity.id) && typeof saved?.prediction === 'string') responses[activity.id].prediction = saved.prediction;
      if (activity.id === 'bear-ancestry' && saved) {
        if ([0,1,2].includes(saved.prediction)) responses[activity.id].firstGuess=['Polar + Brown','Polar + Black','Brown + Black'][saved.prediction];
        for (const k of ['profile','skull','teeth','claw']) {
          if (written(saved.notes||{},k)) responses[activity.id][k+'Observation']=saved.notes[k];
        }
      }
      if (activity.id === 'junco' && saved) {
        if (written(saved, 'observation')) responses[activity.id].observation = saved.observation;
        if (written(saved, 'reason')) responses[activity.id].predictionReason = saved.reason;
      }
      if (activity.id === 'wildlife-corridor') {
        responses[activity.id].prediction = typeof saved?.prediction?.choice === 'string' ? saved.prediction.choice : '';
        responses[activity.id].predictionReason = typeof saved?.prediction?.reason === 'string' ? saved.prediction.reason : '';
      }
      if (activity.id === 'cancer-rates') {
        responses[activity.id].prediction = typeof saved?.prediction?.choice === 'string' ? saved.prediction.choice : '';
        responses[activity.id].predictionReason = typeof saved?.prediction?.reason === 'string' ? saved.prediction.reason : '';
        const question = cancerInvestigationQuestion(saved);
        if (question) responses[activity.id].investigationQuestion = question;
        if (typeof saved?.casework?.questionDraft==='string' && saved.casework.questionDraft.trim()!==question.trim()) {
          responses[activity.id].investigationQuestionDraft = saved.casework.questionDraft;
        }
        const savedNotes = saved?.casework?.notes ?? {};
        const observations = Object.fromEntries(Object.entries({ A:'diagnoses', B:'deaths', C:'map' })
          .filter(([,key]) => written(savedNotes,key))
          .map(([exhibit,key]) => [exhibit,savedNotes[key]]));
        if (Object.keys(observations).length) responses[activity.id].exhibitObservations = observations;
      }
      if (activity.id === 'dna-p53') Object.keys(fields).forEach(id => { if (!(id in responses[activity.id]) && typeof fields[id] === 'string') responses[activity.id][id] = fields[id]; });
    });
    const budget=values.get(CARBON_BUDGET_KEY);
    if (budget?.parsed && budget.value?.v===1) {
      responses['carbon-journey'] ||= {};
      for (const id of ['prediction','explanation']) {
        if (typeof budget.value[id]==='string') responses['carbon-journey']['budget-'+id]=budget.value[id];
      }
    }
    // 'exportedBy' is the person downloading, not an attribution of records.
    // Only the named reports inside activities can label their evidence.
    return {format:'openscied-saved-work-v2',exportedAt:new Date().toISOString(),scope:onlyKeys?'activity':'browser',
      exportedBy:currentExporter(storage),recordOwnership:'not-verified',datasetIds,work,responses,models};
  }
  // AP sign-out loads this script on demand. Load the same model helper there
  // only when this browser has Futures flips; re-check workspace ownership
  // after the async load so a stale tab can never export a new student's work.
  const currentScript=document.currentScript?.src;
  let loadingFutures;
  if (typeof window === 'object') window.OpenSciEdArchive = { async build(storage, onlyKeys) {
    const current=()=>Lab.data?.workspaceStatus?.()==='current';
    const check=()=>{if(!current())throw Error('Saved work was cleared in another tab. Reload before downloading.');};
    check();
    if ((!onlyKeys||onlyKeys.includes(FUTURES_KEY)) && !window.ArcticBearData?.coinFlipDetails) {
      let relevant=false;
      try {
        const saved=JSON.parse(storage.getItem(FUTURES_KEY));
        relevant=saved?.v===1&&/^[A-F0-9]{8}$/.test(saved.id)&&Number.isInteger(saved.rolls)&&saved.rolls>0&&saved.rolls<=40;
      } catch (_) { /* The present but unreadable record will still export. */ }
      if (relevant) {
        loadingFutures ||= new Promise((resolve,reject)=>{
          const script=document.createElement('script');
          script.src=currentScript?new URL('openscied-b5-hybrid-data.js',currentScript).href:'openscied-b5-hybrid-data.js';
          script.onload=resolve;
          script.onerror=()=>{script.remove();reject(Error('Could not load model details for the backup.'));};
          document.head.append(script);
        }).catch(error=>{loadingFutures=null;throw error;});
        try { await loadingFutures; } catch (_) { /* The structured seed and count are still recoverable. */ }
        check();
      }
    }
    const archive=buildArchive(storage,onlyKeys);
    check();
    return archive;
  }};

  function init() {
    $('[data-ph="dashboard-identity"]')?.remove();
    Lab.identity.mount('#openscied-student-identity', { sharedDevice: true, downloadOpenSciEd: () => downloadWork(undefined, null) });
    const status = $('#openscied-results-status');
    const dialog = $('#clear-openscied-dialog');
    const confirmation = $('#openscied-erase-confirmation');
    const confirmButton = $('#confirm-openscied-clear');
    const backupButton = $('#backup-before-openscied-clear');
    const backupStatus = $('#openscied-backup-status');
    const staleMessage = 'This device was switched to another student or cleared in a different tab. Reload this dashboard before using saved work.';
    const changedWorkMessage = 'Saved work changed while this dialog was open. Cancel and reopen this action to review the current work.';
    let clearTarget = null, confirmedWork = null;
    let tracker;
    try { tracker=window.OpenSciEdResume?.connect(localStorage); } catch (_) { /* saved-work display already handles blocked storage */ }
    const resumeLink=$('#openscied-resume-link');
    const resumeDate=document.createElement('time');
    resumeDate.className='dashboard-last-opened';
    resumeDate.hidden=true;
    resumeLink?.before?.(resumeDate);
    const meters=new Map();
    function updateMilestone(activity, status, item) {
      let meter=meters.get(activity.id);
      const [defaultTotal,defaultLabel]=STEP_SCALES[activity.id]||[];
      const total=item.stepsTotal??(item.started?undefined:defaultTotal);
      const done=item.stepsDone??0;
      const label=item.stepsLabel??defaultLabel;
      const known=Number.isInteger(done) && Number.isInteger(total) && total>0 && done>=0 && done<=total;
      if (!known && !item.started) {
        if(meter){meter.summary.hidden=true;meter.bar.hidden=true;}
        return;
      }
      if (!meter) {
        const summary=document.createElement('p'), bar=document.createElement('progress');
        summary.className='dashboard-activity-metric';bar.className='dashboard-activity-progress';
        status.before?.(summary,bar);meter={summary,bar};meters.set(activity.id,meter);
      }
      const {summary,bar}=meter;
      if(!known){summary.textContent='Work saved';summary.hidden=false;bar.hidden=true;return;}
      const detail=done+' of '+total+' '+label.toLowerCase();
      // This bar counts one named milestone, not the whole activity.
      if (summary.textContent !== detail) summary.textContent = detail;
      summary.hidden=String(item.summary||'').toLowerCase().startsWith(detail);bar.hidden=false;
      bar.max=total;bar.value=done;bar.title=detail;
      bar.setAttribute('aria-label',activity.name+' · '+label);
      bar.setAttribute('aria-valuetext',detail);
    }
    function dateLabel(seen, opened=0) {
      if (!Number.isFinite(seen) || seen<=0 || seen>Date.now()) {
        resumeDate.hidden=true; return;
      }
      const date = new Date(seen);
      resumeDate.dateTime=date.toISOString();
      const format=d=>d.toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'});
      resumeDate.textContent='Saved: '+format(date);
      resumeDate.title=opened>0&&opened<=Date.now()?'Last opened: '+format(new Date(opened)):'Last recorded activity work';

      resumeDate.hidden=false;
    }
    function savedKeys() {
      return Object.keys(localStorage).filter(isOpenSciEdKey);
    }
    function workspaceError() {
      const state = Lab.data?.workspaceStatus?.() || 'unavailable';
      return state === 'current' ? '' : state === 'changed' ? staleMessage :
        'This browser cannot access saved work. Allow site storage to save or clear results.';
    }
    function stopClear(message) {
      confirmedWork = null;
      confirmButton.disabled = true;
      if (backupButton) backupButton.disabled = true;
      $('#openscied-clear-error').textContent = message;
    }
    function captureClear(activity) {
      const api = window.OpenSciEdSaveSession;
      if (!api) throw Error('Cannot check saved work');
      const scope = activity?.file.replace(/^openscied-|\.html$/g, '') ?? null;
      const keys = (activity ? activityKeys(activity) : savedKeys()).slice().sort();
      // Do not erase new responses from another tab while a confirmation is open.
      const version = JSON.stringify([localStorage.getItem(api.globalKey),
        scope ? localStorage.getItem(api.scopeKey(scope)) : null,
        keys.map(key=>[key, localStorage.getItem(api.resetKey(key)), localStorage.getItem(key)])]);
      return { scope, keys, version };
    }
    function refresh(message) {
      const blocked = workspaceError();
      if (blocked) {
        $('#openscied-resume').hidden = true;
        dateLabel(0);
        meters.forEach(({summary,bar})=>{summary.hidden=true;bar.hidden=true;});
        ACTIVITIES.forEach(activity=>{
          const reset=$('#'+activity.id+'-reset'), progress=$('#'+activity.id+'-progress'), link=$('#'+activity.id+'-open');
          if (reset) reset.disabled=true;
          if (progress) progress.textContent='Saved work unavailable in this tab';
          if (link) {
            link.href=activity.file; link.textContent='Open activity →'; link.setAttribute('aria-label','Open activity: '+activity.name);
            const picture=link.closest?.('.dashboard-activity')?.querySelector('.dashboard-preview');
            if (picture) picture.href=activity.file;
          }
        });
        if (dialog.open) stopClear(blocked);
        status.textContent=blocked;
        $('#download-openscied-results').disabled=true;
        $('#clear-openscied-results').disabled=true;
        return;
      }
      try {
        const count = savedKeys().length;
        const recent = [];
        ACTIVITIES.forEach((activity, index) => {
          const [raw, ...optional] = activityKeys(activity).map(key => localStorage.getItem(key));
          const item = activity.progress(raw, optional);
          const progress = $('#' + activity.id + '-progress'), reset = $('#' + activity.id + '-reset'), link = $('#' + activity.id + '-open');
          // A cached dashboard may not have the newest card yet; keep the existing cards working.
          if (!progress || !reset || !link) return;
          if (progress.textContent !== item.summary) progress.textContent = item.summary;
          reset.disabled = !item.started && item.summary==='Not started';
          const action = item.started ? 'Continue activity' : 'Open activity';
          link.textContent = action + ' →';
          link.setAttribute('aria-label', action + ': ' + activity.name);
          link.href = activityDestination(activity, item);
          const pictureLink = link.closest?.('.dashboard-activity')?.querySelector('.dashboard-preview');
          if (pictureLink) pictureLink.href = item.started ? link.href : activity.file;
          updateMilestone(activity, progress, item);
          // Reconcile only a verified progress record. An old visit timestamp can seed the
          // ledger once, but after that only a change in evidence can promote the activity.
          if (item.started) {
            const meta=tracker?.snapshot(activity.file)||{};
            recent.push({activity,item,index,changed:meta.changed??item.visited,opened:meta.opened});
          }
        });
        recent.sort((a,b)=>b.changed-a.changed || a.index-b.index);
        $('#openscied-resume').hidden = !recent.length;
        if (recent.length) {
          const { activity, item, opened, changed } = recent[0];
          dateLabel(changed,opened);
          const guest = !Lab.identity.get()?.name;
          $('#resume-title').textContent = guest ? 'Saved work on this device' : 'Continue your activity';
          $('#openscied-resume-description').textContent = guest
            ? activity.name + ' · ' + item.summary + '. Continue only if this work is yours. Otherwise, switch students.'
            : activity.name + ' · ' + item.summary;
          resumeLink.href = activityDestination(activity, item);
          resumeLink.textContent = (guest ? 'Continue my saved ' : 'Resume ') + activity.name + ' →';
        } else dateLabel(0);
        $('#download-openscied-results').disabled = !count;
        $('#clear-openscied-results').disabled = !count;
        const next = message || (count ? 'This browser has saved work. Download a backup before clearing it.'
          : 'No saved work yet. Choose an activity to get started.');
        if (status.textContent !== next) status.textContent = next;
      } catch (e) {
        $('#openscied-resume').hidden = true;
        dateLabel(0);
        meters.forEach(({summary,bar})=>{summary.hidden=true;bar.hidden=true;});
        ACTIVITIES.forEach(activity => { const reset = $('#' + activity.id + '-reset'); if (reset) reset.disabled = true; });
        status.textContent = 'This browser cannot access saved work. Allow site storage to save or clear results.';
        $('#download-openscied-results').disabled = true;
        $('#clear-openscied-results').disabled = true;
      }
    }
    function downloadWork(onlyKeys, feedback = status) {
      const blocked = workspaceError();
      if (blocked) {
        if (feedback) feedback.textContent=blocked;
        return false;
      }
      try {
        const payload = buildArchive(localStorage, onlyKeys);
        if (workspaceError()) throw Error('Saved work changed before the backup.');
        const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
        const link = document.createElement('a');
        link.href = url; link.download = 'openscied-saved-work.json';
        document.body.appendChild(link); link.click(); link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        if (feedback) feedback.textContent = 'Backup download started: openscied-saved-work.json. This is not a classroom report.'+
          (payload.models['bear-hybrid']?.detailUnavailable?' The saved Futures record is included, but the flip detail could not be generated.':'');
        return true;
      } catch (e) {
        if (feedback) feedback.textContent = 'Could not download the backup. Nothing was cleared.';
        return false;
      }
    }
    $('#download-openscied-results').addEventListener('click', () => downloadWork());
    backupButton.addEventListener('click', () => downloadWork(clearTarget ? activityKeys(clearTarget) : null, backupStatus || status));
    function openClear(activity) {
      const blocked = workspaceError();
      if (blocked) { refresh(blocked); return; }
      clearTarget = activity || null;
      try { confirmedWork = captureClear(clearTarget); }
      catch (_) { status.textContent = 'Could not check saved work. Nothing was cleared.'; return; }
      $('#clear-openscied-title').textContent = activity ? 'Restart ' + activity.name + '?' : 'Clear OpenSciEd results?';
      $('#clear-openscied-description').textContent = activity
        ? 'This permanently clears this activity’s ' + activity.clears + ' on this device. Other activities, your name, class period, and AP Biology work stay saved.'
        : 'This permanently clears all OpenSciEd activity progress, model results, and answers saved on this device. Your name, class period, and AP Biology lab work will stay saved.';
      confirmButton.textContent = activity ? 'Erase this activity’s results' : 'Erase OpenSciEd results';
      confirmation.value = ''; confirmButton.disabled = true; backupButton.disabled = false;
      $('#openscied-clear-error').textContent = '';
      if (backupStatus) {
        backupStatus.textContent = '';
        backupStatus.setAttribute('role', 'status');
      }
      dialog.showModal();
    }
    $('#clear-openscied-results').addEventListener('click', () => openClear());
    ACTIVITIES.forEach(activity => $('#' + activity.id + '-reset')?.addEventListener('click', () => openClear(activity)));
    confirmation.addEventListener('input', () => { confirmButton.disabled = !confirmedWork || confirmation.value !== 'ERASE'; });
    $('#cancel-openscied-clear').addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => { confirmedWork=null; backupStatus?.removeAttribute?.('role'); });
    $('#clear-openscied-form').addEventListener('submit', event => {
      event.preventDefault();
      if (!confirmedWork || confirmation.value !== 'ERASE') return;
      const blocked = workspaceError();
      if (blocked) { stopClear(blocked); return; }
      try {
        const { keys, scope, version } = captureClear(clearTarget);
        if (version !== confirmedWork.version) { stopClear(changedWorkMessage); return; }
        const result = window.OpenSciEdSaveSession?.erase(localStorage, scope, keys);
        if (!result?.ok) {
          stopClear(result?.partial ?
            'Could not clear all saved results, and some records could not be put back. Check your backup before trying again.' :
            'Could not clear saved results. Your saved work was kept. Check browser storage and reopen this dialog.');
          return;
        }
        dialog.close();
        refresh(clearTarget ? clearTarget.name + ' results cleared. Other activities and your student sign-in are still saved.' : 'OpenSciEd results cleared. Your name, class period, and AP Biology work are still saved.');
      } catch (e) {
        stopClear('Could not check or clear saved results. Check browser storage and reopen this dialog.');
      }
    });
    // Snapshot before leaving the dashboard too, so even a fast first trip or a
    // delayed activity script has a baseline. Reopening unchanged work keeps its rank.
    document.addEventListener('click', event => {
      if (!tracker || workspaceError() || event.defaultPrevented || (event.button != null && event.button!==0)) return;
      const link=event.target?.closest?.('a.dashboard-preview, a.dashboard-open');
      if (link?.origin===window.location.origin && window.OpenSciEdResume.route(link.pathname)) {
        tracker.snapshot(link.pathname,'open');
      }
    });
    // The dashboard can remain open while an activity saves in another tab.
    window.addEventListener('storage', event => { if (!event.key || event.key === Lab.data.workspaceEpochKey ||
      event.key === 'aplab:student' || event.key === window.OpenSciEdResume?.META_KEY || window.OpenSciEdResume?.isMetaKey?.(event.key) || isOpenSciEdKey(event.key)) refresh(); });
    document.addEventListener('submit', event => {
      if (event.target?.closest?.('#openscied-student-identity')) setTimeout(refresh,0);
    });
    window.addEventListener('pageshow', () => refresh());
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')refresh();});
    refresh();
  }
  const mount = () => { if ($('#openscied-student-identity')) init(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();
