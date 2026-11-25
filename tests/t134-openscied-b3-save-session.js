/* Persistence regression for openscied-b3-cancer-rates, openscied-b3-cell-cycle,
   openscied-b3-dna-p53 and openscied-b3-inheritance-environment.
   Run the real save and full-reset controllers with two editors sharing one fake storage. */
'use strict';
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Save = require('../openscied-save-session.js');
const root = path.join(__dirname, '..');
const CancerRatesLogic = require('../openscied-b3-cancer-rates-logic.js');
const CancerRatesData = require('../openscied-b3-cancer-rates-data.js');
let flags = 0, passes = 0;
function check(ok, description) {
  flags++;
  if (ok) { passes++; console.log('ok: ' + description); }
  else console.log('FAIL: ' + description);
}
function sliceFunction(source, name, next) {
  return source.slice(source.indexOf('  function ' + name + '('), source.indexOf('\n  function ' + next + '('));
}
const setup = {
  'cancer-rates': { endSave:'source', key:"D=window.CancerRatesData,L=window.CancerRatesLogic,", field:'claim' },
  'cell-cycle': { endSave:'restoreFields', endReset:'reset', field:'analysis-design' },
  'dna-p53': { endSave:'restoreFields', endReset:'mountScene', field:'exit-q7', oneLiveRegion:true },
  'inheritance-environment': { endSave:'restoreFields', endReset:'mountScene', field:'exit-q7', oneLiveRegion:true }
};
for (const [name, spec] of Object.entries(setup)) {
  const scope = 'b3-' + name, key = 'aplab:openscied:' + scope + ':v1';
  const source = readFileSync(path.join(root,'openscied-' + scope + '.js'),'utf8');
  const html = readFileSync(path.join(root,'openscied-' + scope + '.html'),'utf8');
  const start = source.indexOf('  const saveScope');
  const since = start < 0 ? '' : source.slice(start, source.indexOf("window.addEventListener('pageshow', watchSaveChanges);",start) + "window.addEventListener('pageshow', watchSaveChanges);".length);
  const save = spec.key ? source.slice(source.indexOf('  function save(){'),source.indexOf('  const node=')) : sliceFunction(source,'save',spec.endSave);
  const qualifyingPins = spec.key ? sliceFunction(source,'qualifyingPins','hasFinalResponses') : '';
  const reset = spec.key ? source.slice(source.indexOf("  $('reset-confirm').addEventListener('click',()=>{"),source.indexOf("  const figure=$('chart')"))
    : spec.endReset === 'mountScene'
      ? source.slice(source.indexOf('  function clearActivity() {'),source.indexOf('  /* ---------- scenes: public hooks',source.indexOf('  function clearActivity() {')))
      : sliceFunction(source,'clearActivity',spec.endReset);
  const disk = new Map();
  const storage = {getItem(k){return disk.get(k)??null;},setItem(k,v){disk.set(k,v);},removeItem(k){disk.delete(k);}};
  function open(value) {
    const handlers={}, elements=new Map(), notice={hidden:true, firstElementChild:{textContent:''}, focus(){this.focused=true;}};
    let warningUpdates = 0;
    const warningSpeech = { text:'',
      get textContent(){return this.text;}, set textContent(next){this.text = next; warningUpdates++;} };
    const stepSpeech = { textContent:'Step feedback stays intact.' };
    const field = {id:spec.field, value};
    const element = id => {
      if (!elements.has(id)) elements.set(id, {textContent:'',value:'',style:{},close(){},focus(){},addEventListener(t,fn){this[t]=fn;}});
      return elements.get(id);
    };
    const state = { fields:{},game:{},trials:[],quick:'',mechanism:'',fork:null, expression:{runs:[]},feedback:{},claim:value, evidence:[], lastSection:'overview' };
    let reloads=0;
    const context = {
      document:{getElementById:id=>id==='save-announcement' ? warningSpeech :
        id==='step-announcement' ? stepSpeech : notice}, localStorage:storage,
      window:{ localStorage:storage,OpenSciEdSaveSession:Save,addEventListener(t,fn){handlers[t]=fn;},location:{reload(){reloads++;}}},
      history:{replaceState(){}},location:{hash:'',pathname:'/',search:'',reload(){reloads++;}},
      state,D:CancerRatesData,L:CancerRatesLogic,ready:true, cleared:false, hadSaved:false, invalid:false, blocked:false, RESPONSE_IDS:[spec.field],SCENE_IDS:[],SECTIONS:[],
      $:element, $$:sel=>sel.startsWith('input[type=radio]:checked')?[field]:[], collectFields:()=>({[spec.field]:field.value}), picks:()=>[{id:spec.field,value:field.value}],
      renderReport(){}, renderBaselineEcho(){}, refreshAll(){}, fresh(){return {};}, syncCasefile(){},syncIdentity(){},text(){},render(){},announce(){}
    };
    vm.createContext(context);
    vm.runInContext('const KEY='+JSON.stringify(key)+';\n'+since+'\n'+qualifyingPins+'\n'+save+'\n'+reset,context);
    return {save:context.save, notice, state, reloads:()=>reloads,
      warningSpeech, stepSpeech, warningUpdates:()=>warningUpdates,
      sync(){handlers.storage?.({type:'storage',key});},
      reset: spec.key ? element('reset-confirm').click : context.clearActivity };
  }
  check(html.includes('script') && html.indexOf('src="openscied-save-session.js"') >= 0 &&
    html.indexOf('src="openscied-save-session.js"') < html.lastIndexOf('src="openscied-'+scope+'.js'),
    scope+' loads the guard before its controller');
  const stale=open('older locally edited answer'), fresh=open('newer answer');
  fresh.save();
  const newer=disk.get(key);
  stale.sync(); stale.save(); stale.reset();
  check(typeof newer==='string' && disk.get(key)===newer && stale.notice.hidden===false &&
    /changed in another tab/.test(stale.notice.firstElementChild.textContent) && stale.reloads()===0,
    scope+' rejects stale saves and resets while preserving the current tab');
  if (spec.oneLiveRegion) {
    const tags = html.match(/<[^>]+(?:aria-live=|role="(?:alert|status)")[^>]*>/g) || [];
    check(tags.length===1 && /id="announcer"/.test(tags[0]) && /aria-atomic="false"/.test(tags[0]) &&
      /id="step-announcement"/.test(html) && /id="save-announcement"/.test(html),
      scope+' routes step and save announcements through one live region');
    check(stale.warningSpeech.textContent===stale.notice.firstElementChild.textContent &&
      stale.warningUpdates()===1 && stale.notice.focused && stale.stepSpeech.textContent==='Step feedback stays intact.',
      scope+' announces the visible save warning once, preserves step feedback, and focuses the warning if Reset is denied');
  }
  check((spec.key ? stale.state.claim : stale.state.fields[spec.field])==='older locally edited answer',
    scope+' leaves the unsaved answer available to download');
  // A still-open editor cannot resurrect its earlier state after ERASE.
  const afterWrite=open('can no longer restore this');
  Save.erase(storage,scope,[key]);
  afterWrite.sync();afterWrite.save();
  check(!disk.has(key) && !afterWrite.notice.hidden && /cleared in another tab/.test(afterWrite.notice.firstElementChild.textContent),
    scope+' does not restore erased work on the next save');
  const afterErase=open('fresh after erase');
  afterErase.save();
  check(disk.get(key)?.includes('fresh after erase'),scope+' allows saving again from a fresh tab');
}
console.log('t134-openscied-b3-save-session: '+passes+'/'+flags+' checks passed');
if(passes!==flags)process.exitCode=1;
