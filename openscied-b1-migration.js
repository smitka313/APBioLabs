(function () {
  'use strict';
  const L=window.MigrationLogic,$=s=>document.querySelector(s),$$=s=>Array.from(document.querySelectorAll(s));
  const KEY='aplab:openscied:b1-migration:v1';
  const saveAPI = window.OpenSciEdSaveSession, saveScope = 'b1-migration';
  const saveSession = (() => { try { return saveAPI?.open(localStorage, saveScope, [KEY]); } catch (_) { return null; } })();
  const reportIdentity = saveAPI?.reportIdentity?.(saveSession, [KEY], () => window.Lab?.identity?.get?.() ?? null) ?? (() => null);
  function readSave() { return saveSession ? saveSession.read(KEY) : localStorage.getItem(KEY); }
  function showSaveConflict(result) {
    const n = document.getElementById('save-conflict');
    const message = result?.reason === 'erased' ? 'Saved work was cleared in another tab. This tab cannot write it back.' :
      result?.reason === 'changed' ? 'A newer save from another tab was kept.' : 'This tab could not save on this device.';
    const copy = message + ' Use Preview report to keep this tab’s work before reloading.';
    if (n && (n.hidden || n.textContent !== copy)) { n.textContent = copy; n.hidden = false; say(copy); }
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
  const ANNUAL_SOURCE='OpenSciEd B.1 Lesson 4 · Data Excursion 2: Annual Rainfall and Wildebeest Occupancy (one classroom example year)';
  const ANNUAL_URL='https://openscied.org/simulation/b-1-l4b-data-excursion-2-annual-rainfall-and-wildebeest-occupancy/';
  const RESPONSES=[
    ['question','1. What question are you investigating?','Lesson 3 · Purpose of the research'],
    ['prediction','2. What possible explanations could account for migration? What evidence would each predict?','Consider food, predators, and disease before comparing the cards.'],
    ['patterns','3. What patterns do you find between living and dead wildebeest?','Cite a month, a group, and bone-marrow fat values. Notice exceptions as well as patterns.'],
    ['absence','4. What lack of a pattern helps you evaluate a possible explanation?','Compare the disease measure across groups in the same month.'],
    ['rain-prediction','5. Where would you predict the herds to be in April based on rainfall? How does the map compare?','Lesson 4 · Compare evidence at the same time of year.'],
    ['rain-claim','6. Does the evidence support the claim that wildebeest always spend the most time in the wettest region?','Use the example year, the rainfall graph, and regional cards. Explain the limits of the evidence.'],
    ['regions','7. What advantages does each region offer, and why might the wildebeest leave it?','Compare the south, west, and north. Consider grass quality as well as quantity.'],
    ['claim','8. How is food connected to the migration? Build an explanation using at least two pieces of evidence.','Connect your evidence to your reasoning. Revise your initial ideas if needed.'],
    ['limits','9. What can these data not tell you? What additional evidence would help?','Consider sample selection, monthly group averages, rainfall stations, and changing locations.'],
    ['next','10. Is there a limit to how many wildebeest a region could support? How would you investigate?','Lesson 4 · A question to carry into the next lesson.']
  ];
  const RESPONSE_STAGES=['Research question and predictions','Health and disease patterns','Rainfall and occupancy','Regions and explanation','Limits and next steps'];
  const validResponseStage=i=>Number.isInteger(i)&&i>=0&&i<RESPONSE_STAGES.length;
  const REGIONS={
    north:{name:'North · a dry-season refuge',facts:['Some rain falls throughout the year. Grass stores nutrients in its roots, so the blades are less nutritious.','The Mara River flows year-round. Wildebeest move locally to follow rain showers.','When the rainy season begins, small groups move south toward the plains.'],short:'Year-round water; grass blades are less nutritious.'},
    south:{name:'South · the short-grass plains',facts:['Nutrient-rich soil supports nutritious grass blades, especially early in the wet season.','Open, treeless plains make predators easier to see and avoid.','Many calves are born in January–February. Lactating mothers need highly nutritious food.','Toward the end of the wet season, the grasslands dry and food becomes unavailable.'],short:'Nutritious wet-season grass; open plains; seasonal drying.'},
    west:{name:'West · a seasonal opportunity',facts:['Long grass, bushes, and trees give predators places to hide.','Grass takes nutrients into its blades during the dry season; during the wet season, it stores nutrients in its roots.','Mating occurs here when nutritional health is high. Mating uses energy, especially for males.','Wet clay-like soil can stick to hooves. In July, fires in tall grass can reduce available food.'],short:'Seasonal grass nutrition; mating; predators; clay soil and fire.'}
  };
  const ANNUAL=[{region:'South',rain:1160,occupancy:52},{region:'West',rain:1180,occupancy:26},{region:'North',rain:1310,occupancy:6}];
  let corrupt=false,unavailable=false,hydrating=true,state={v:1,month:0,region:'south',page:'explore',view:'field',collection:'cards',visited:[],notes:[],answers:{},responseStage:0,observations:{},weather:true,sort:'month',filter:'all',measure:'fat',lastVisitedAt:0};
  try{
    const raw=readSave();
    if(raw){const s=JSON.parse(raw);if(s.v!==1||!Number.isInteger(s.month)||s.month<0||s.month>11||!Array.isArray(s.notes)||!Array.isArray(s.visited)||!s.answers||typeof s.answers!=='object'||Array.isArray(s.answers))throw Error('Unknown save');
      state={...state,...s,region:REGIONS[s.region]?s.region:'south',page:['explore','evidence','explain'].includes(s.page)?s.page:'explore',view:['field','region','rain'].includes(s.view)?s.view:'field',collection:['cards','rainfall','notebook'].includes(s.collection)?s.collection:'cards',notes:L.normalizeNotebook(s.notes),responseStage:validResponseStage(s.responseStage)?s.responseStage:0,visited:Array.from(new Set(s.visited.filter(n=>Number.isInteger(n)&&n>=0&&n<12))),observations:s.observations&&typeof s.observations==='object'&&!Array.isArray(s.observations)?s.observations:{}};
      for(const n of state.notes)if(n.type==='map-observation'&&n.observation&&typeof state.observations[n.month]!=='string')state.observations[n.month]=n.observation;
    }
  }catch(e){corrupt=true;}
  function say(text){$('#mx-status').textContent=text;}
  function save(){
    if(hydrating)return;
    state.responseIds=RESPONSES.map(r=>r[0]);state.lastSection=state.page;state.lastVisitedAt=Date.now();
    if(corrupt){$('#save-state').textContent='Saved record needs attention';return;}
    let result;
    try{result=saveSession?.write(KEY,JSON.stringify(state));}catch(e){}
    unavailable=!result?.ok;
    $('#save-state').textContent=unavailable?'Not saved · download a copy':'Work saved on this device';
    if(unavailable)showSaveConflict(result);
  }
  function el(tag,text,cls){const n=document.createElement(tag);if(text!=null)n.textContent=String(text);if(cls)n.className=cls;return n;}
  function shortMonth(m){return L.MONTHS[m].slice(0,3);}
  function cardText(c){return `${L.MONTHS[c.month]} · Location ${c.location} · ${L.GROUPS[c.group]}: ${c.fat}% bone-marrow fat; ${c.health.toLowerCase()}; ${c.anthrax}% of the sampled group had anthrax. Monthly group average for sampled male wildebeest, not a herd-wide rate.`;}
  const observation=$('#observation');
  function editorMonth(){
    if(!observation.hasAttribute('data-editor-month'))return null;
    const month=Number(observation.dataset.editorMonth);
    return Number.isInteger(month)&&month>=0&&month<L.MONTHS.length?month:null;
  }
  function keepDraft(){
    const month=editorMonth();
    if(month!==null)state.observations[month]=observation.value;
  }
  function showDraft(month){
    const draft=typeof state.observations[month]==='string'?state.observations[month]:'';
    if(editorMonth()!==month)observation.dataset.editorMonth=String(month);
    if(observation.value!==draft)observation.value=draft;
    $('#month-note-month').textContent=L.MONTHS[month];
  }
  function renderNoteProgress(){
    const months=L.monthsWithNotes(state.notes);
    $('#visit-progress').textContent='Months with notes: '+months.length+' of 12';
    $$('#month-buttons button').forEach(b=>{
      const m=+b.dataset.month,hasNote=months.includes(m);
      const draft=typeof state.observations[m]==='string'?state.observations[m].trim():'';
      const saved=state.notes.find(n=>n.type==='map-observation'&&n.month===m)?.observation?.trim()||'';
      const hasDraft=Boolean(draft)&&draft!==saved;
      b.dataset.visited=String(hasNote);
      b.dataset.draft=String(hasDraft);
      b.setAttribute('aria-label','Explore '+L.MONTHS[m]+(hasNote?(unavailable||corrupt?' · note in this tab':' · note saved'):'')+(hasDraft?' · draft not yet in notebook':''));
    });
    $('#record').textContent=months.includes(state.month)?'Update month note':'Save month note';
    const feedback=$('#month-note-status');
    if(+feedback.dataset.noteMonth!==state.month){feedback.textContent='';feedback.hidden=true;}
  }
  function observeMonth(){if(!state.visited.includes(state.month))state.visited.push(state.month);}
  const scene=MigrationScene.init($('#migration-map'),$('#field-scene'),$('#map-wrap'));
  let timer=0;
  function pause(){clearInterval(timer);timer=0;$('#play').textContent='Play year';$('#play').setAttribute('aria-pressed','false');}
  function pauseForObservation(){
    if(!timer)return;
    pause();
    const month=editorMonth();
    say('Playback paused while you work on your '+(month===null?'month':L.MONTHS[month])+' note.');
  }
  function renderInspector(){const title=state.view==='region'?REGIONS[state.region].name:state.view==='rain'?'Read the rainfall graph':L.RANGES[state.month];$('#inspector-title').textContent=title;}
  function renderRainGraph(context,m){
    $(context==='dialog'?'#rain-dialog-focus':'#rain-focus').textContent='Reading '+L.MONTHS[m]+' on the original graph';
    $(context==='dialog'?'#rain-dialog .mx-rain-figure':'#view-rain .mx-rain-figure').style.setProperty('--mx-rain-month',L.rainColumn(m));
  }
  function renderRainMonth(m){
    renderRainGraph('explore',m);
    renderRainGraph('dialog',m);
  }
  function openRainGraph(m){
    pause();renderRainGraph('dialog',m);$('#rain-dialog').showModal();
  }
  function renderMonth(){const m=state.month;$('#month-title').textContent=L.MONTHS[m];$('#month-output').textContent=L.MONTHS[m];$('#season').textContent=L.SEASONS[m];$('#month-slider').value=m;renderInspector();renderRainMonth(m);$('#field-note').textContent=L.NOTES[m];$('#habitat-clue').textContent=L.habitatClue(m);showDraft(m);$('#weather').checked=state.weather;const cues=L.weatherCues(m),weatherText=state.weather?cues.rainText+'. '+cues.grassText+'. These cues are not measurements.':'Rain and grass illustrations are off.';$('#weather-reading').textContent=weatherText;$('#map-description').textContent=L.MONTHS[m]+'. Broad herd range: '+L.RANGES[m]+'. '+L.SEASONS[m]+'. This is an example route; real routes vary. '+weatherText+' '+(L.forMonth(m).length?'Field data available at location '+(m-3)+'.':'No health-card data supplied for this month.');$('#field-scene').setAttribute('aria-label','Illustration of wildebeest near the '+L.RANGES[m]+' during '+L.MONTHS[m]+'. Animals are decorative, not population counts.');$('#large-caption').textContent=$('#map-description').textContent;
    $$('#month-buttons button[data-month]').forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.month===m)));
    const cards=L.forMonth(m),host=$('#month-evidence');host.replaceChildren();const box=el('div',null,'mx-small-evidence');
    box.append(el('strong',cards.length?'Source evidence · Location '+(m-3):'No health cards for this month'));
    if(cards.length){box.append(el('p','Monthly group averages for sampled males, not measurements of individual animals.','mx-caption'));cards.forEach(c=>box.append(el('span',L.GROUPS[c.group]+': '+c.fat+'% fat')));const b=el('button','Compare these three cards →');b.type='button';b.onclick=()=>{state.filter=String(m);$('#card-month').value=state.filter;renderCards();go('evidence');collection('cards');};box.append(b);}else box.append(el('span','The supplied health cards cover May–October. Explore the map without inventing missing data.'));
    host.append(box);scene.set(m,{weather:state.weather,region:state.region});$('#large-prev').disabled=m===0;$('#large-next').disabled=m===11;$('#previous').disabled=m===0;$('#next').disabled=m===11;renderNoteProgress();
  }
  function changeMonth(m,user=true){keepDraft();state.month=L.monthIndex(m);if(user)observeMonth();region(L.fieldRegion(state.month));}
  // Preserve the incoming fragment during startup: adding #explore can anchor-scroll past the title.
  function go(page,focus=true){if(!['explore','evidence','explain'].includes(page))page='explore';pause();state.page=page;$$('.mx-page').forEach(n=>n.hidden=n.id!==page);$$('[data-page]').forEach(b=>{if(b.dataset.page===page)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});if(!hydrating&&location.hash!=='#'+page)history.replaceState(null,'','#'+page);if(focus){$('#'+page+'-title').focus({preventScroll:true});$('.mx-pages').scrollIntoView({block:'start'});}if(page==='explore')scene.resize();if(page==='evidence')renderCharts();if(page==='explain')renderNotes();save();}
  function view(v){state.view=v;renderInspector();$$('.mx-viewpanel').forEach(n=>n.hidden=n.id!=='view-'+v);$$('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===v)));if(v==='field')scene.resize();save();}
  function collection(v){state.collection=v;['cards','rainfall','notebook'].forEach(id=>$('#collection-'+id).hidden=id!==v);$$('[data-collection]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.collection===v)));renderCharts();renderNotes();save();}
  function region(r,open=false){if(!REGIONS[r])return;state.region=r;const data=REGIONS[r];$('#region-rain-station').textContent=$('#map-station-'+r).textContent;$('#region-facts').replaceChildren(...data.facts.map(f=>el('li',f)));if(open)view('region');scene.set(state.month,{region:r});renderMonth();save();}
  function addNote(note){if(state.notes.some(n=>n.id===note.id)){say('That evidence is already in your notebook.');return;}if(state.notes.length>=100){say('Your notebook has 100 entries. Download a copy, then remove an entry to add another.');return;}state.notes.push(note);save();renderNotes();renderCards();say('Added to notebook: '+note.title+(corrupt||unavailable?' · Download or copy it before leaving.':''));}
  function displayNoteText(n){return n.id==='rainfall-example'?L.notebookText(n).replace('Lesson 4 slides X–Y',ANNUAL_SOURCE):L.notebookText(n);}
  function renderNotes(){renderNoteProgress();const make=(n,canRemove)=>{const box=el('article',null,'mx-note');box.append(el('h4',n.title),el('p',displayNoteText(n)));if(canRemove){const b=el('button','Remove entry');b.type='button';b.setAttribute('aria-label','Remove '+n.title);b.onclick=()=>{state.notes=state.notes.filter(x=>x.id!==n.id);save();renderNotes();renderCards();say('Removed notebook entry.');};box.append(b);}return box;};$('#note-count').textContent=state.notes.length;$('#writing-note-count').textContent='('+state.notes.length+')';const main=$('#notebook-list'),side=$('#writing-notes');main.replaceChildren();side.replaceChildren();if(!state.notes.length){main.append(el('p','Your notebook is empty. Save a month, a regional observation, or a field card to begin.','mx-panel mx-note'));side.append(el('p','Save useful observations or cards in Explore or Investigate. They will appear here while you write.'));}else{const grid=el('div',null,'mx-notes');state.notes.forEach(n=>grid.append(make(n,true)));main.append(grid);state.notes.forEach(n=>side.append(make(n,false)));}}
  const animal=`<svg viewBox="0 0 180 100" aria-hidden="true"><defs><linearGradient id="body-%ID%" x2="0" y2="1"><stop stop-color="#9e9077"/><stop offset="1" stop-color="#555c4c"/></linearGradient></defs><ellipse cx="96" cy="91" rx="66" ry="5" fill="#718068" opacity=".2"/><path d="M60 59 57 86 53 93M74 65 69 86 72 94M129 64 126 82 132 92M139 60 144 82 150 92" fill="none" stroke="#40493e" stroke-width="3"/><path d="M56 29Q70 15 88 32L119 37Q145 34 147 54Q147 72 124 69L78 61 57 68 45 47Z" fill="url(#body-%ID%)"/><path d="M52 30 36 32 27 62Q24 70 36 69L48 59 60 42Z" fill="#424d40"/><path d="m30 58-8 5 3 8 16-3" fill="#b9b08a"/><path d="M41 32Q21 27 24 13M44 32Q62 27 57 13" fill="none" stroke="#b5a682" stroke-width="3" stroke-linecap="round"/><path d="M58 27 65 40M65 25 71 41M72 26 79 43M43 59 47 75 53 58M146 44Q165 41 159 70" fill="none" stroke="#354233" stroke-width="3"/><circle cx="39" cy="46" r="1.5" fill="#e4dabb"/></svg>`;
  function renderCards(){const filter=state.filter;const cards=filter==='all'?L.CARDS:L.forMonth(+filter),host=$('#card-groups');host.replaceChildren();L.groups(state.sort,cards).forEach(group=>{const section=el('section',null,'mx-card-group');const heading=el('h3',group.label);heading.append(el('span',group.cards.length+' cards'));section.append(heading);const grid=el('div',null,'mx-cards');group.cards.forEach(c=>{const card=el('article',null,'mx-card');card.dataset.card=c.id;card.append(el('div',shortMonth(c.month)+' · LOCATION '+c.location,'mx-card-id'),el('h4',L.GROUPS[c.group]));const image=el('div');image.innerHTML=animal.replaceAll('%ID%',c.id);card.append(image);const measure=el('div',c.fat+'%','mx-fat');measure.append(el('small','bone-marrow fat'));card.append(measure);const meter=el('div',null,'mx-meter');meter.setAttribute('aria-hidden','true');const fill=el('span');fill.style.width=c.fat+'%';meter.append(fill);card.append(meter,el('p',c.health),el('p',c.anthrax+'% of sampled group had anthrax'));const b=el('button',state.notes.some(n=>n.id==='card-'+c.id)?(unavailable||corrupt?'In notebook ✓':'Saved ✓'):'＋ Save card');b.type='button';b.disabled=state.notes.some(n=>n.id==='card-'+c.id);b.setAttribute('aria-label','Save '+L.MONTHS[c.month]+' '+L.GROUPS[c.group]+' card');b.onclick=()=>addNote({id:'card-'+c.id,title:L.MONTHS[c.month]+' · '+L.GROUPS[c.group],text:cardText(c),type:'source-card'});card.append(b);grid.append(card);});section.append(grid);host.append(section);});}
  function table(headers,rows){const t=el('table'),thead=el('thead'),tr=el('tr');headers.forEach(h=>{const th=el('th',h);th.scope='col';tr.append(th);});thead.append(tr);t.append(thead);const body=el('tbody');rows.forEach(row=>{const tr=el('tr');row.forEach(x=>tr.append(el('td',x)));body.append(tr);});t.append(body);return t;}
  let healthChart=null,occupancyChart=null;
  function renderCharts(){if(state.page!=='evidence')return;if(state.collection==='cards'&&$('#health-chart-disclosure').open){const measure=state.measure==='anthrax'?'anthrax':'fat';const opt={simTag:false,responsive:true,height:360,xLabel:'Month number (5 = May, 10 = October)',yLabel:measure==='fat'?'Bone-marrow fat (%)':'Sampled group with anthrax (%)',xMin:5,xMax:10,yMin:0,yMax:100,series:L.GROUPS.map((name,g)=>({name,line:true,dots:true,points:L.CARDS.filter(c=>c.group===g).map(c=>({x:c.month+1,y:c[measure]}))}))};if(healthChart)healthChart.update(opt);else healthChart=Lab.chart('#health-chart',opt);}if(state.collection==='rainfall'){const opt={simTag:false,responsive:true,height:360,xLabel:'Annual regional rainfall (mm)',yLabel:'Time in region (% of year)',xMin:1100,xMax:1350,yMin:0,yMax:60,series:ANNUAL.map(a=>({name:a.region+' · '+a.rain+' mm / '+a.occupancy+'%',dots:true,line:false,points:[{x:a.rain,y:a.occupancy}]}))};if(occupancyChart)occupancyChart.update(opt);else occupancyChart=Lab.chart('#occupancy-chart',opt);}}
  function submissionData(){
    const months=L.monthsWithNotes(state.notes);
    const written=RESPONSES.filter(([id])=>typeof state.answers[id]==='string'&&state.answers[id].trim()).length;
    const missing=[];
    if(corrupt)missing.push('An older save could not be read. This report contains work available in this tab only.');
    if(months.length<12)missing.push('Save an observation for each month ('+months.length+' of 12).');
    if(written<RESPONSES.length)missing.push('Answer the investigation questions ('+written+' of '+RESPONSES.length+').');
    const notebook=state.notes.map(n=>({type:'answer',prompt:n.title,value:displayNoteText(n)}));
    const chapters=[{title:'Evidence notebook',items:notebook.length?notebook:[{type:'text',text:'No notebook entries yet.'}]},
      {title:'My investigation responses',items:RESPONSES.map(([id,prompt])=>({type:'answer',prompt,value:state.answers[id]||''}))}];
    if(state.notes.some(n=>n.id==='rainfall-example'))chapters.push({title:'Rainfall and occupancy evidence',items:[
      {type:'table',title:'One classroom example year',columns:['Region','Annual rainfall (mm)','Time in region (%)'],rows:ANNUAL.map(a=>[a.region,a.rain,a.occupancy])},
      {type:'text',text:ANNUAL_SOURCE+' · '+ANNUAL_URL}]});
    return {title:'Migration Map Explorer',unit:'Unit B.1 · Lessons 3–4',
      source:'OpenSciEd B.1 field, regional and rainfall evidence; monthly rainfall graph by Concord Consortium (1961–1990 station averages). Map and animations are illustrative, not observations or population counts. The health cards report monthly averages for groups of sampled males.',
      status:corrupt?'recovery':missing.length?'draft':'final',missing,student:corrupt?null:reportIdentity(),
      keyResults:[{label:'Months with a saved observation',value:months.length+' / 12'},{label:'Investigation questions answered',value:written+' / '+RESPONSES.length}],sections:chapters};
  }
  function reportText(kind){
    const student=reportIdentity()||{};
    let result='MIGRATION MAP EXPLORER\nOpenSciEd B.1 Lessons 3–4 companion\nCreated by Robert Smitka\n\nName: '+(student.name||'')+'\nClass period: '+(student.period||'')+'\n\nSOURCE DATA AND ILLUSTRATIONS\nField cards and rainfall examples are source evidence, not simulated data. Map, weather, grass and animal animations are illustrative, not observations or population counts.\n\nMY NOTEBOOK\n';
    if(!state.notes.length)result+='\n[No notebook entries saved.]\n';
    state.notes.forEach((n,i)=>result+='\n'+(i+1)+'. '+n.title+'\n'+displayNoteText(n)+'\n');
    if(kind!=='notebook'){
      result+='\nMY RESPONSES\n';
      RESPONSES.forEach(([id,q])=>result+='\n'+q+'\n'+(state.answers[id]||'[No response yet]')+'\n');
    }
    result+='\nSources: OpenSciEd B.1 Lessons 3–4 data cards, regional cards and slides; monthly rainfall graph by Concord Consortium (1961–1990 station averages).\n';
    if(state.notes.some(n=>n.id==='rainfall-example'))result+=ANNUAL_SOURCE+'\n'+ANNUAL_URL+'\n';
    return result+'Original lesson materials: CC BY-NC 4.0. Adaptation: CC BY-NC-SA 4.0.\n';
  }
  function textCopy(kind,failed=false){
    const dialog=$('#text-copy-dialog'),field=$('#text-copy-field');
    $('#text-copy-title').textContent=kind==='notebook'?'Notebook text':'Investigation text';
    $('#text-copy-hint').textContent=(failed?'The file could not be downloaded. ':'')+'Copy the text below or use your device’s Copy command. It includes your name and class period if entered.';
    field.value=reportText(kind);
    if(!dialog.open)dialog.showModal();
    field.focus();field.select();
  }
  function download(kind){
    try{
      const blob=new Blob([reportText(kind)],{type:'text/plain;charset=utf-8'}),url=URL.createObjectURL(blob),a=el('a');
      a.href=url;a.download='migration-'+kind+'.txt';document.body.append(a);a.click();a.remove();
      setTimeout(()=>URL.revokeObjectURL(url),5000);
      say('Download requested. If no file appears, choose View text to copy your '+(kind==='notebook'?'notebook':'investigation')+'.');
    }catch(e){textCopy(kind,true);}
  }
  // Bring the same source records into Explain; the panels provide data, not model answers.
  const CONTEXT_LABELS=['Migration map and research measures','Field-card data: bone-marrow fat and anthrax','April map, rainfall graph and annual data','Regional facts and nutritional health','Study design and what was recorded'];
  function contextTable(caption,headers,rows){
    const grid=table(headers,rows);
    grid.createCaption().textContent=caption;
    Array.from(grid.tBodies[0].rows).forEach(row=>{
      const th=el('th',row.cells[0].textContent);th.scope='row';row.cells[0].replaceWith(th);
    });
    return grid;
  }
  function healthEvidence(includeAnthrax){
    const rows=[4,5,6,7,8,9].map(m=>[
      L.MONTHS[m],
      ...L.forMonth(m).map(c=>includeAnthrax ? c.fat+'% / '+c.anthrax+'%' : c.fat+'%')
    ]);
    return contextTable(
      includeAnthrax?'Bone-marrow fat / anthrax (%): each cell shows both measures.':'Bone-marrow fat (%)',
      ['Month','Living','Predator deaths','Other deaths'],rows
    );
  }
  function writingContext(i){
    const details=el('details',null,'mx-writing-context');
    details.dataset.writingContext=i;
    details.append(el('summary','Evidence: '+CONTEXT_LABELS[i]));
    const body=el('div',null,'mx-writing-context-body');details.append(body);
    const caption=text=>el('p',text,'mx-caption');
    if(i===0){
      body.append(contextTable('Broad monthly ranges on the schematic route',
        ['Month','Main range'],[0,5,8,10].map(m=>[L.MONTHS[m],L.RANGES[m]])),
        caption('OpenSciEd B.1 Lessons 3–4 monthly map. The route is schematic, not a count or a GPS track.'),
        el('p','The field cards record which group the sampled males were in, their average bone-marrow fat, and the share of the sampled group with anthrax.'));
    }else if(i===1){
      body.append(healthEvidence(true),
        caption('OpenSciEd B.1 Lesson 3 field data cards. These are monthly group averages for sampled male wildebeest from several studies, not counts or rates for the whole herd. The anthrax percentages come from an outbreak year.'));
    }else if(i===2){
      const graph=el('button','Open the original station graph');graph.type='button';
      graph.onclick=()=>openRainGraph(3);
      body.append(el('p','April range on the source map: '+L.RANGES[3]+'.'),
        el('p','April station comparison on the monthly graph: Simiyu (south) is below Handajega (west), which is below Kogatende (north).'),
        graph,caption('These are station averages from 1961–1990, not rainfall in the example year below. Source: OpenSciEd B.1 Lesson 4 rainfall investigation (Data Excursion 1).'),
        contextTable('Annual rainfall and time in each region · one example year',['Region','Rainfall (mm)','Time in region (%)'],
          ANNUAL.map(a=>[a.region,a.rain,a.occupancy])),
        caption('The three regions shown cover 84% of the year. Source: OpenSciEd B.1 Lesson 4 rainfall and herd location investigation (Data Excursion 2).'));
    }else if(i===3){
      const regions=el('div',null,'mx-context-regions');
      for(const key of ['south','west','north']){
        const label=el('h4',REGIONS[key].name);
        const facts=el('ul');REGIONS[key].facts.forEach(fact=>facts.append(el('li',fact)));
        const card=el('div');card.append(label,facts);regions.append(card);
      }
      const more=el('details');more.append(el('summary','Compare bone-marrow fat from the field cards'),healthEvidence(false),
        caption('OpenSciEd B.1 Lesson 3 field data cards. Each value is a monthly group average for sampled male wildebeest, not an individual measurement.'));
      body.append(regions,caption('Adapted from the OpenSciEd B.1 Lesson 4 Regional Data Cards.'),more);
    }else{
      const facts=el('ul');
      [
        'The 18 field cards are six months of selected group averages for male wildebeest, drawn from more than one study.',
        'The monthly rainfall graph summarizes three stations over 1961–1990. The occupancy table shows time in selected regions for one example year.',
        'The April and other monthly maps show broad ranges. The regional cards describe conditions such as grass traits, local water and seasonal changes.'
      ].forEach(text=>facts.append(el('li',text)));
      body.append(facts,caption('OpenSciEd B.1 Lessons 3–4 source scope. Keep observations and proposed new measurements separate.'));
    }
    return details;
  }
  const responseStages=RESPONSE_STAGES.map((title,i)=>{
    const section=el('section',null,'mx-response-stage'),heading=el('h3',title);
    heading.id='response-heading-'+i;heading.tabIndex=-1;
    section.setAttribute('aria-labelledby',heading.id);section.append(heading,writingContext(i));
    $('#responses').append(section);
    const option=el('option',(2*i+1)+'–'+(2*i+2)+' · '+title);
    option.value=i;$('#response-stage').append(option);
    return section;
  });
  function responseProgress(){
    const total=RESPONSES.filter(([id])=>typeof state.answers[id]==='string'&&state.answers[id].trim()).length;
    $('#response-progress').textContent=total+' of '+RESPONSES.length+' prompts answered';
  }
  function showResponseStage(i,focus=false){
    if(!validResponseStage(i))return;
    state.responseStage=i;
    responseStages.forEach((section,index)=>section.hidden=index!==i);
    $('#response-stage').value=String(i);
    $('#response-prev').disabled=i===0;
    $('#response-next').disabled=i===responseStages.length-1;
    if(focus){
      const heading=responseStages[i].firstElementChild;
      heading.focus({preventScroll:true});$('#response-stage').scrollIntoView({block:'nearest'});
    }
  }
  RESPONSES.forEach(([id,q,hint],i)=>{const box=el('div',null,'mx-response'),label=el('label',q);label.htmlFor='answer-'+id;const textarea=el('textarea');textarea.id='answer-'+id;textarea.rows=3;textarea.value=typeof state.answers[id]==='string'?state.answers[id]:'';textarea.setAttribute('aria-describedby','hint-'+id);textarea.oninput=()=>{state.answers[id]=textarea.value;responseProgress();save();};const p=el('p',hint);p.id='hint-'+id;box.append(label,p,textarea);responseStages[Math.floor(i/2)].append(box);});
  $('#response-stage').onchange=e=>{showResponseStage(+e.target.value);save();};
  $('#response-prev').onclick=()=>{showResponseStage(state.responseStage-1,true);save();};
  $('#response-next').onclick=()=>{showResponseStage(state.responseStage+1,true);save();};
  showResponseStage(state.responseStage);responseProgress();
  // Use compact disclosures on phones; keep the evidence visible beside the work on wider screens.
  const evidenceLayout=matchMedia('(max-width:800px)');
  const updateDisclosures=()=>{for(const id of ['writing-evidence','health-chart-disclosure'])$('#'+id).open=!evidenceLayout.matches;};
  evidenceLayout.addEventListener('change',updateDisclosures);
  updateDisclosures();
  $('#health-chart-disclosure').addEventListener('toggle',()=>{if($('#health-chart-disclosure').open)renderCharts();});

  L.MONTHS.forEach((m,i)=>{const b=el('button',m.slice(0,3));b.type='button';b.dataset.month=i;b.setAttribute('aria-label','Explore '+m);b.onclick=()=>{pause();changeMonth(i);};$('#month-buttons').append(b);});
  $$('[data-page]').forEach(b=>b.onclick=()=>go(b.dataset.page));$$('[data-go]').forEach(b=>b.onclick=()=>go(b.dataset.go));$$('[data-view]').forEach(b=>b.onclick=()=>view(b.dataset.view));$$('[data-region]').forEach(b=>b.onclick=()=>region(b.dataset.region,true));$$('[data-collection]').forEach(b=>b.onclick=()=>collection(b.dataset.collection));
  $('#month-slider').oninput=e=>{pause();changeMonth(+e.target.value);};$('#previous').onclick=()=>{pause();changeMonth(Math.max(0,state.month-1));};$('#next').onclick=()=>{pause();changeMonth(Math.min(11,state.month+1));};
  $('#play').onclick=()=>{if(timer){pause();return;}if(state.month===11)changeMonth(0);observeMonth();$('#play').textContent='Pause year';$('#play').setAttribute('aria-pressed','true');timer=setInterval(()=>{if(!timer)return;if(document.activeElement===observation){pauseForObservation();return;}if(state.month>=11){pause();say('Year complete. Compare your observations and investigate the evidence.');return;}changeMonth(state.month+1);if(state.month===11){pause();say('Year complete. Compare your observations and investigate the evidence.');}},1800);};
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
  $('#weather').onchange=e=>{state.weather=e.target.checked;renderMonth();save();};
  observation.addEventListener('pointerdown',pauseForObservation);
  observation.addEventListener('focus',pauseForObservation);
  observation.addEventListener('input',()=>{pauseForObservation();keepDraft();renderNoteProgress();save();});
  $('#record').onclick=()=>{
    pauseForObservation();
    const field=observation,month=editorMonth(),feedback=$('#month-note-status');
    if(month===null)return;
    keepDraft();
    const result=L.upsertMonthlyNote(state.notes,month,field.value);
    const noteSay=message=>{feedback.dataset.noteMonth=month;feedback.hidden=false;feedback.textContent=message;say(message);};
    if(result.status==='blank'){noteSay('Write an observation before saving this month’s note.');field.focus();return;}
    if(result.status==='unchanged'){noteSay('This month’s note is already in your notebook.');return;}
    if(result.status==='full'){noteSay('Your notebook has 100 entries. Download a copy, then remove an entry to add another.');return;}
    state.notes=result.notes;if(!state.visited.includes(month))state.visited.push(month);save();renderNotes();
    noteSay((result.status==='updated'?'Updated ':'Saved ')+L.MONTHS[month]+' note in your notebook.'+(corrupt||unavailable?' Not stored on this device; download or copy it before leaving.':''));
  };
  $('#record-region').onclick=()=>addNote({id:'region-'+state.region,title:REGIONS[state.region].name,text:REGIONS[state.region].facts.join('\n'),type:'regional-source'});
  $('#save-rain').onclick=()=>addNote({id:'rainfall-example',title:'Annual rainfall & occupancy · one example year',text:ANNUAL.map(a=>a.region+': '+a.rain+' mm annual rainfall; '+a.occupancy+'% of the year.').join('\n')+'\nSource: '+ANNUAL_SOURCE+'. Selected regions total 84%; this is not the full multi-year dataset used in the interactive data tool.',type:'rainfall-source'});
  $('#card-sort').value=state.sort;$('#card-month').value=state.filter;$('#health-measure').value=state.measure;
  $('#card-sort').onchange=e=>{state.sort=e.target.value;renderCards();save();};$('#card-month').onchange=e=>{state.filter=e.target.value;renderCards();save();};$('#health-measure').onchange=e=>{state.measure=e.target.value;renderCharts();save();};
  $('#health-table').append(table(['Month / location','Group','Fat (%)','Nutrition','Anthrax (%)'],L.CARDS.map(c=>[shortMonth(c.month)+' / '+c.location,L.GROUPS[c.group],c.fat,c.health,c.anthrax])));
  $('#occupancy-table').append(table(['Region','Annual rainfall (mm)','Time in region (%)'],ANNUAL.map(a=>[a.region,a.rain,a.occupancy])));
  window.MigrationEvidenceChecks?.mount({cards:L.CARDS,months:L.MONTHS,annual:ANNUAL,announce:say,showEvidence:source=>{
    if(source.collection==='cards'){
      state.measure=source.measure;state.filter=String(source.month);
      $('#health-measure').value=state.measure;$('#card-month').value=state.filter;
      renderCards();
    }
    go('evidence');collection(source.collection);
    const target=source.collection==='cards'?$('#card-month'):$('#occupancy-table');
    if(target){if(source.collection==='rainfall')target.tabIndex=-1;target.focus();}
  }});
  $('#download-notebook').onclick=()=>download('notebook');$('#download-report').onclick=()=>download('investigation');
  window.OpenSciEdSubmission?.mount({target:'#migration-submission',collect:submissionData,filename:'migration-investigation'});
  $('#copy-notebook').onclick=()=>textCopy('notebook');$('#copy-report').onclick=()=>textCopy('investigation');
  $('#copy-text').onclick=async()=>{
    const field=$('#text-copy-field');
    try{await navigator.clipboard.writeText(field.value);$('#text-copy-hint').textContent='Copied. Paste the text wherever you’d like to keep it.';}
    catch(e){field.focus();field.select();$('#text-copy-hint').textContent='Automatic copy is unavailable. Use your device’s Copy command on the selected text.';}
  };
  $('#help').onclick=()=>{pause();$('#guide').showModal();};$('#rain-enlarge').onclick=()=>openRainGraph(state.month);$$('[data-close]').forEach(b=>b.onclick=()=>$('#'+b.dataset.close).close());
  const mapWrap=$('#map-wrap'),placeholder=el('div');$('#enlarge').onclick=()=>{pause();mapWrap.before(placeholder);$('#large-map-host').append(mapWrap);$('#map-dialog').showModal();scene.resize();};$('#map-dialog').addEventListener('close',()=>{placeholder.replaceWith(mapWrap);scene.resize();});$('#large-prev').onclick=()=>changeMonth(Math.max(0,state.month-1));$('#large-next').onclick=()=>changeMonth(Math.min(11,state.month+1));
  window.addEventListener('hashchange',()=>{const page=location.hash.slice(1);if(['explore','evidence','explain'].includes(page))go(page);});
  try{Lab.identity.mount('#migration-identity');const identityHost=$('#migration-identity');const clarify=()=>{identityHost.querySelectorAll('p.small.muted').forEach(p=>{if(p.textContent.includes('simulated data'))p.textContent='Your name and class period label your classroom report and text downloads. Everyone investigates the same published source evidence in this activity.';});};clarify();new MutationObserver(clarify).observe(identityHost,{childList:true,subtree:true});}catch(e){say('Name entry is unavailable. You can still use Preview report.');}
  renderMonth();region(state.region);view(state.view);renderCards();renderNotes();collection(state.collection);const requested=location.hash.slice(1);go(['explore','evidence','explain'].includes(requested)?requested:state.page,false);hydrating=false;
  if(corrupt){
    const notice=$('#save-conflict');
    notice.textContent='Saved work could not be read and was kept. Download it from the dashboard before clearing it. Use Preview report to keep any new work from this tab before reloading.';
    notice.hidden=false;$('#save-state').textContent='Saved record needs attention';say(notice.textContent);
  }else if(!unavailable)say('Start with a month. Compare locations, save useful evidence, and build your explanation.');
})();
