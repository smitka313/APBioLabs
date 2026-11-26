'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const L=require('../migration-logic.js');
// Independent transcription checked against all 18 supplied student card images,
// not the inconsistent teacher summary key. Values are monthly group averages.
const reference=[
  [4,0,95,0,'Healthy'],[4,1,75,0,'Healthy'],[4,2,90,0,'Healthy'],
  [5,0,92,20,'Healthy'],[5,1,68,20,'Nutritionally stressed'],[5,2,60,20,'Nutritionally stressed'],
  [6,0,89,20,'Healthy'],[6,1,51,20,'Nutritionally stressed'],[6,2,31,20,'Nutritionally starved'],
  [7,0,73,0,'Healthy'],[7,1,48,0,'Nutritionally stressed'],[7,2,23,0,'Nutritionally starved'],
  [8,0,76,0,'Healthy'],[8,1,46,0,'Nutritionally stressed'],[8,2,31,0,'Nutritionally starved'],
  [9,0,77,0,'Healthy'],[9,1,54,0,'Nutritionally stressed'],[9,2,55,0,'Nutritionally stressed']
];
for(const [month,group,fat,anthrax,health] of reference)test(`source card ${month+1}, group ${group}`,()=>{const c=L.CARDS.find(c=>c.month===month&&c.group===group);assert.ok(c);assert.equal(c.fat,fat);assert.equal(c.anthrax,anthrax);assert.equal(c.health,health);assert.equal(c.location,month-3);});
test('no fabricated health data outside supplied six months',()=>{assert.equal(L.CARDS.length,18);for(const m of [0,1,2,3,10,11])assert.deepEqual(L.forMonth(m),[]);});
test('source exceptions preserved rather than replaced by key summaries',()=>{assert.equal(L.CARDS.filter(c=>c.health==='Healthy').length,8);assert.equal(L.CARDS.find(c=>c.month===4&&c.group===2).fat,90);assert.equal(L.CARDS.find(c=>c.month===6&&c.group===1).fat,51);});
test('all sorting methods retain every unique source card',()=>{for(const sort of ['month','group','health','anthrax']){const grouped=L.groups(sort),cards=grouped.flatMap(g=>g.cards);assert.equal(cards.length,18);assert.equal(new Set(cards.map(c=>c.id)).size,18);}});
test('anthrax groups describe samples, not cause of death',()=>{assert.equal(L.groups('anthrax').find(g=>g.label==='20% anthrax').cards.length,6);for(const m of [5,6])assert.deepEqual(L.forMonth(m).map(c=>c.anthrax),[20,20,20]);});
test('all month positions are finite, inside schematic, southern in Jan and northern in Sep',()=>{assert.equal(L.POSITIONS.length,12);for(const p of L.POSITIONS){assert.ok(p.every(Number.isFinite));assert.ok(p[0]>0&&p[0]<1000&&p[1]>0&&p[1]<660);}assert.ok(L.POSITIONS[0][1]>L.POSITIONS[8][1]);});
test('invalid month input cannot generate undefined coordinates',()=>{for(const value of [-1,12,NaN,Infinity,null,'5',1.5])assert.equal(L.monthIndex(value),0);assert.equal(L.monthIndex(11),11);});
function dashboard(){let src=fs.readFileSync(path.join(__dirname,'../openscied-dashboard.js'),'utf8');src=src.replace('  function init() {','  globalThis.migrationTest = { migrationProgress, migrationResponseIds };\n  function init() {');const context={document:{readyState:'loading',addEventListener(){}}};vm.runInNewContext(src,context);return context.migrationTest;}
test('dashboard recognizes real work and resumes correct section',()=>{const {migrationProgress}=dashboard();assert.equal(migrationProgress(null).summary,'Not started');const result=migrationProgress(JSON.stringify({v:1,month:7,page:'explain',visited:[4,7],notes:[{id:'card'}],answers:{claim:'Evidence-based response'},lastVisitedAt:123}));assert.equal(result.started,true);assert.equal(result.section,'explain');assert.equal(result.visited,123);assert.match(result.summary,/0 of 12 months with notes.*1 notebook entry.*1 of 10/);});
test('dashboard preserves unreadable work and rejects unknown schemas',()=>{const {migrationProgress}=dashboard();for(const raw of ['{','null','{}',JSON.stringify({v:2,month:0,visited:[],notes:[],answers:{}}),JSON.stringify({v:1,month:50,visited:[],notes:[],answers:{}})])assert.match(migrationProgress(raw).summary,/could not be read/);});
test('opening the explorer alone does not claim completed work',()=>{const {migrationProgress}=dashboard();assert.equal(migrationProgress(JSON.stringify({v:1,month:0,visited:[],notes:[],answers:{},observations:{},lastVisitedAt:1})).started,false);});
test('dashboard exports all ten explorer responses and recognizes observation-only work',()=>{const api=dashboard();assert.equal(api.migrationResponseIds().length,10);assert.equal(api.migrationProgress(JSON.stringify({v:1,month:0,visited:[],notes:[],answers:{},observations:{0:'My question'}})).started,true);});
test('canonical monthly notes upsert without duplicates and blank notes do not count',()=>{
  const blank=L.upsertMonthlyNote([],0,'  ');
  assert.equal(blank.status,'blank');
  assert.deepEqual(blank.notes,[]);
  const saved=L.upsertMonthlyNote(blank.notes,0,'  My first observation.  ');
  assert.equal(saved.status,'new');assert.equal(saved.notes[0].id,'month-0');
  assert.deepEqual(L.monthsWithNotes(saved.notes),[0]);
  const same=L.upsertMonthlyNote(saved.notes,0,'My first observation.');
  assert.equal(same.status,'unchanged');
  const edit=L.upsertMonthlyNote(same.notes,0,'New January thought.');
  assert.equal(edit.status,'updated');assert.equal(edit.notes.length,1);
  assert.match(L.notebookText(edit.notes[0]),/New January thought/);
  assert.doesNotMatch(L.notebookText(edit.notes[0]),/My first observation/);
});
test('legacy notes deduplicate idempotently and preserve distinct student writing',()=>{
  const note=(id,text)=>({id,title:'May',type:'map-observation',month:4,text});
  const map=note('month-4-map','Map observation (illustrative broad range): Western corridor.');
  const first=note('month-4-123','Map observation.\nMy observation: First thought.\nSecond line.\nSource cards available for Location 1.');
  const recent=note('month-4-456','Map observation.\nMy observation: Latest thought.\nSource cards available for Location 1.');
  const card={id:'card-m5g0',title:'May living',text:'95% marrow fat'};
  const blank={id:'month-3-map',title:'April',text:'Map only'};
  const notes=L.normalizeNotebook([map,first,recent,card,blank]);
  assert.deepEqual(notes.map(n=>n.id),['month-4','card-m5g0','month-3']);
  assert.deepEqual(L.monthsWithNotes(notes),[4]);
  assert.equal(notes[0].observation,'Latest thought.');
  assert.match(L.notebookText(notes[0]),/Earlier saved observations:[\s\S]*First thought\.\nSecond line\./);
  assert.deepEqual(L.normalizeNotebook(notes),notes);
  const {migrationProgress}=dashboard();
  const save=JSON.stringify({v:1,month:7,page:'explore',visited:[4,7],notes:[map,first,recent,card,blank],answers:{}});
  assert.match(migrationProgress(save).summary,/1 of 12 months with notes.*3 notebook entries/);
});
test('source image and all local activity dependencies exist',()=>{const html=fs.readFileSync(path.join(__dirname,'../openscied-b1-migration.html'),'utf8');for(const match of html.matchAll(/(?:src|href)="([^"#]+)"/g)){if(/^https?:/.test(match[1])||match[1]==='openscied-dashboard.html')continue;assert.ok(fs.existsSync(path.join(__dirname,'..',match[1])),match[1]);}assert.ok(!html.includes('Answer Key'));});
function chartFixture(collection,open=true){
  const ui=fs.readFileSync(path.join(__dirname,'../openscied-b1-migration.js'),'utf8');
  const fn=ui.slice(ui.indexOf('  function renderCharts()'),ui.indexOf('  function reportText('));
  const captures=[], disclosure={open}, overlap={hidden:true};
  const context={
    L,state:{page:'evidence',collection,measure:'fat'},
    $(selector){
      if(selector==='#health-chart-disclosure')return disclosure;
      assert.equal(selector,'#health-chart-overlap','the chart renderer uses known test controls');
      return overlap;
    },
    ANNUAL:[{region:'South',rain:1160,occupancy:52},{region:'West',rain:1180,occupancy:26},{region:'North',rain:1310,occupancy:6}],
    healthChart:null,occupancyChart:null,Lab:{chart(selector,options){captures.push(options);return {update(o){captures.push(o);}};}}
  };
  vm.createContext(context);
  vm.runInContext(fn,context);
  return {captures,disclosure,overlap,state:context.state,draw:()=>vm.runInContext('renderCharts();',context)};
}
test('editing pauses the exact playback controller and keeps separate drafts on their months',()=>{
  const ui=fs.readFileSync(path.join(__dirname,'../openscied-b1-migration.js'),'utf8');
  const cut=(from,to)=>ui.slice(ui.indexOf(from),ui.indexOf(to));
  const elements=new Map(), intervals=new Map(), document={activeElement:null,addEventListener(){}};
  const $=id=>{
    if(!elements.has(id)){
      const listeners={},attrs={};
      elements.set(id,{attrs,dataset:{},value:'',addEventListener(e,f){(listeners[e]??=[]).push(f);},
        setAttribute(e,v){attrs[e]=v;},hasAttribute(e){return e==='data-editor-month'&&Object.hasOwn(this.dataset,'editorMonth');},
        fire(e){listeners[e]?.forEach(f=>f({target:this}));this['on'+e]?.({target:this});},
        focus(){document.activeElement=this;this.fire('focus');if(id==='#observation')$('.mx-record').fire('focusin');}});
    }
    return elements.get(id);
  };
  const field=$('#observation'), play=$('#play');
  const state={month:4,observations:{},notes:[],visited:[]};
  let serial=0;
  const context={L,state,$,$$:()=>[],document,messages:[],corrupt:false,unavailable:false,
    MigrationScene:{init(){}},save(){},say(text){context.messages.push(text);},
    setInterval(callback){intervals.set(++serial,callback);return serial;},clearInterval(id){intervals.delete(id);},
    renderMonth(){vm.runInContext(`if(typeof showDraft==='function')showDraft(state.month);else $('#observation').value=state.observations[state.month]||'';`,context);},
    view(){},region(){context.renderMonth();},renderNotes(){vm.runInContext('renderNoteProgress();',context);}
  };
  vm.createContext(context);
  vm.runInContext(cut('  function cardText(','  function renderInspector(')+
    cut('  function changeMonth(','  function go(')+
    cut("  $('#month-slider').oninput","  $('#record-region').onclick"),context);
  context.renderMonth();
  field.value='Initial May draft.';field.fire('input');
  play.fire('click');assert.equal(play.attrs['aria-pressed'],'true');
  assert.equal(field.readOnly,true,'no editing against a moving month');
  assert.equal($('#record').disabled,true);
  assert.equal($('#month-note-playback').hidden,false);
  const queued=[...intervals.values()][0];queued();
  assert.equal(state.month,5,'the map keeps playing');
  assert.equal(field.dataset.editorMonth,'4','the editor is not rebound on an autoplay tick');
  assert.equal(field.value,'Initial May draft.');
  field.focus();assert.equal(play.attrs['aria-pressed'],'false','focus interrupts playback before the next tick');
  queued();assert.equal(state.month,5,'a frame already queued does not advance after focus');
  assert.equal(field.dataset.editorMonth,'5','the editor binds to the frozen month before the next keystroke');
  assert.equal(field.readOnly,false);
  assert.equal($('#record').disabled,false);
  assert.equal($('#month-note-playback').hidden,true);
  vm.runInContext('changeMonth(4)',context);
  play.fire('click');
  queued();assert.equal(state.month,4,'an earlier timer does not advance a new Play');
  $('#pause-and-note').fire('click');
  assert.equal(play.attrs['aria-pressed'],'false','the note shortcut also freezes the chosen month');
  assert.equal(document.activeElement,field,'the shortcut moves focus to the editing field');
  field.value='A May draft.';field.fire('input');
  for(const tick of intervals.values())tick();
  assert.equal(state.month,4);assert.equal(field.value,'A May draft.');assert.equal(state.notes.length,0);
  vm.runInContext('changeMonth(5)',context);assert.equal(field.value,'');
  field.value='A June draft.';field.fire('input');
  vm.runInContext('changeMonth(4)',context);assert.equal(field.value,'A May draft.');
  $('#record').fire('click');
  assert.equal(state.notes.length,1);assert.equal(state.notes[0].id,'month-4');
  assert.equal(state.observations[5],'A June draft.');assert.match(context.messages.at(-1),/Saved May/);
});
test('the three rainfall displays keep the original graph and provide a dark treatment and a raw-color link',()=>{
  const html=fs.readFileSync(path.join(__dirname,'../openscied-b1-migration.html'),'utf8');
  const css=fs.readFileSync(path.join(__dirname,'../openscied-b1-migration.css'),'utf8');
  assert.equal([...html.matchAll(/<img[^>]+src="assets\/migration-rainfall-source\.png"/g)].length,3);
  assert.equal([...html.matchAll(/<a[^>]+href="assets\/migration-rainfall-source\.png"/g)].length,3);
  assert.match(css,/data-theme=dark[^\n]*\.mx-rain-figure img[^\n]*\.mx-rain-source[^\n]*filter:invert\(/);
});
test('the field evidence panel states sampling and outbreak limits before students compare cards',()=>{
  const html=fs.readFileSync(path.join(__dirname,'../openscied-b1-migration.html'),'utf8');
  const evidence=html.slice(html.indexOf('id="collection-cards"'),html.indexOf('id="card-groups"'));
  for(const phrase of ['monthly group averages for sampled male wildebeest','several studies','outbreak year','whole herd','126 carcasses sampled in 1968–1973','not the number behind any one card'])assert.ok(evidence.includes(phrase),phrase);
});
test('published evidence charts disable the toolkit simulation label',()=>{
  for(const collection of ['cards','rainfall']){
    const {captures,draw}=chartFixture(collection);
    draw();
    assert.equal(captures.length,1);assert.equal(captures[0].simTag,false,collection+' uses source data, not simulation');
    assert.equal(captures[0].responsive,true,collection+' chart labels remain readable in narrow panels');
  }
});
test('the overlap clue appears only for the coincident anthrax series',()=>{
  const chart=chartFixture('cards');
  chart.draw();
  assert.equal(chart.overlap.hidden,true);
  chart.state.measure='anthrax';
  chart.draw();
  assert.equal(chart.overlap.hidden,false);
  const [first,...others]=chart.captures.at(-1).series;
  for(const group of others)assert.deepEqual(group.points,first.points);
  chart.state.measure='fat';
  chart.draw();
  assert.equal(chart.overlap.hidden,true);
});
test('the closed mobile health chart waits until open without suppressing annual evidence',()=>{
  const cards=chartFixture('cards',false);
  cards.draw();
  assert.equal(cards.captures.length,0);
  cards.disclosure.open=true;
  cards.draw();
  assert.equal(cards.captures.length,1);
  const rainfall=chartFixture('rainfall',false);
  rainfall.draw();
  assert.equal(rainfall.captures.length,1);
});

test('April keeps the main herd range in the south despite the lesson’s wetter northern station', () => {
  assert.match(L.RANGES[3], /South and southwest/i);
  assert.match(L.NOTES[3], /still in the south.*Maswa/i);
  const [march,april,may] = L.POSITIONS.slice(2,5);
  assert.ok(april[0] < march[0], 'April is centered to the west of March');
  assert.ok(Math.abs(april[1]-march[1]) < 25, 'April stays in the southern band with March');
  assert.ok(may[1] < april[1]-75, 'northward movement is clear by May');
});

test('the October Maasai Mara range precedes the November southbound return', () => {
  assert.match(L.RANGES[9], /Maasai Mara/);
  assert.doesNotMatch(L.SEASONS[9], /return/i);
  assert.match(L.SEASONS[10], /return south/i);
  assert.ok(L.POSITIONS[10][1] > L.POSITIONS[9][1], 'southbound range moves down the schematic');
  assert.equal(L.fieldRegion(10), 'north', 'November shows the northern end of the eastern corridor');
});

test('illustrative weather uses the Lesson 4 wet/dry convention independently of region', () => {
  const wetMonths = L.MONTHS.filter((_,i) => L.isWetSeason(i));
  assert.deepEqual(wetMonths, ['January','February','March','April','May','December']);
  assert.equal(L.fieldRegion(4), 'west', 'May can be wet even as herds move west');
  assert.equal(L.fieldRegion(11), 'south', 'December returns toward the southern plains');
});


test('Transition labels distinguish range from direction of seasonal movement', () => {
  assert.match(L.RANGES[6], /Northwestern corridor/);
  assert.match(L.RANGES[11], /Eastern corridor toward the southern plains/);
  assert.ok(L.POSITIONS[6][0]>L.POSITIONS[5][0] && L.POSITIONS[6][1]<L.POSITIONS[5][1]);
  assert.ok(L.POSITIONS[11][1]>L.POSITIONS[10][1] && L.POSITIONS[11][1]<L.POSITIONS[0][1]);
});

test('Rain illustration always marks the north, and May adds showers in the western corridor', () => {
  for(const m of [7,8,9]) {
    const weather=L.weatherCues(m);
    assert.ok(weather.rain.some(({x,y})=>x>=475 && x<=600 && y<115));
    assert.match(weather.grassText,/bent tufts/);
  }
  const may=L.weatherCues(4);
  assert.ok(may.rain.some(({x,y})=>x<405 && y>=210 && y<=295));
  assert.ok(may.rain.every(({y})=>y<410));
  assert.match(may.grassText,/upright tufts/);
  assert.ok(L.weatherCues(0).rain.some(({x,y})=>x>620 && y>420));
});

test('Rainfall outline brackets image positions for January, April, August and December', () => {
  for(const [m,x,y] of [[0,45,45],[3,223,225],[7,462,478],[11,700,701]]){
    const left=Number.parseFloat(L.rainColumn(m))*7.5;
    assert.ok(left<x && y<left+7.94*7.5);
  }
});

test('evidence checks explain all distractors without grading free text', () => {
  const C=require('../migration-evidence-checks.js');
  const checks=C.create({cards:L.CARDS,months:L.MONTHS,annual:[
    {region:'South',rain:1160,occupancy:52},{region:'North',rain:1310,occupancy:6}
  ]});
  assert.deepEqual(checks.map(c=>c.answer),['absence','patterns','rain-claim']);
  for(const c of checks) {
    assert.equal(c.options.filter(o=>C.evaluate(c,o.id).correct).length,1);
    assert.equal(C.evaluate(c,'some free-text response'),undefined);
    for(const o of c.options)assert.match(C.evaluate(c,o.id).message,/^(Supported|Recheck the evidence)\./);
  }
  const disease=checks[0];
  assert.match(C.evaluate(disease,'higher-dead').message,/June shows 20% in all three groups; July shows 20% in all three groups/);
  assert.match(C.evaluate(disease,'same-groups').message,/does not prove anthrax never mattered/);
});
