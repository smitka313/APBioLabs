'use strict';

// Exercise the actual Burning Fuels page controller in separate DOM realms sharing one origin.
const test = require('node:test');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const SaveSession = require('../openscied-save-session.js');
const logic = require('../openscied-b2-burn-logic.js');
const controller = fs.readFileSync(process.env.BURN_CONTROLLER || path.join(__dirname,'../openscied-b2-burn-lab.js'),'utf8');
const KEY = 'aplab:openscied:b2-burn-lab:v1';
const FIRES = 'aplab:openscied:b2-fires:v1';
const SCOPE = 'b2-burn-lab';
const one = {seed:40,fuel:'grass',current:null,records:[{fuel:'grass',n:1,obs:[]}],review:{fuel:'grass',n:1}};
const two = {...one,records:[...one.records,{fuel:'wood',n:1,obs:[]}]};

function fixture() {
  const disk = new Map([[FIRES,'control']]);
  let writes = 0;
  const localStorage = { getItem:k=>disk.get(k)??null, setItem(k,v){disk.set(k,v);writes++;}, removeItem:k=>disk.delete(k) };
  const open = () => {
    const handlers = {}, dom = new Map(), location = {hash:'#burn', reload(){this.reloaded=true;}};
    let downloaded;
    const el = () => ({hidden:true,dataset:{},children:[],listeners:{},replaceChildren(...x){this.children=x;},appendChild(x){this.children.push(x);return x;},
      setAttribute(){},addEventListener(k,f){this.listeners[k]=f;},querySelector(){return null;},querySelectorAll(){return [];},close(){},click(){},remove(){}});
    const querySelector = s => {
      if (!s.startsWith('#')) return null;
      if (!dom.has(s)) dom.set(s,el());
      return dom.get(s);
    };
    const document = {readyState:'complete',body:el(),createElement:el,querySelector,querySelectorAll:()=>[],getElementById:()=>null};
    const window = {B2BurnLogic:logic,OpenSciEdSaveSession:SaveSession,addEventListener(k,fn){handlers[k]=fn;}};
    const URL = {createObjectURL(blob){downloaded=blob;return 'fixture-download';},revokeObjectURL(){}};
    vm.runInNewContext(controller,{window,document,location,localStorage,Blob,URL,setTimeout:f=>f()},{filename:'openscied-b2-burn-lab.js'});
    return {
      record(row){return window.B2Burn.saveState('burn',row);},
      count(){return window.B2Burn.getState().burn?.records.length??0;},
      nav(hash){location.hash=hash;handlers.hashchange();},
      change(key){handlers.storage?.({key});},
      warning(){return querySelector('#burn-save-warning-text').textContent??'';},
      async download(){querySelector('#download-work').listeners.click();return JSON.parse(await downloaded.text());},
      reset(){querySelector('#confirm-reset').listeners.click();return !!location.reloaded;}
    };
  };
  return {open,localStorage,count:()=>JSON.parse(localStorage.getItem(KEY))?.burn?.records?.length??0,writes:()=>writes};
}

test('recorded burns survive a freshly opened activity, which does not rewrite storage', () => {
  const f=fixture(), active=f.open();
  active.record(one);
  assert.equal(f.count(),1);
  const writes=f.writes();
  assert.equal(f.open().count(),1);
  assert.equal(f.writes(),writes);
});

test('stale navigation and edits do not overwrite another tab’s newer burns', async () => {
  const f=fixture(), active=f.open();
  active.record(one);
  const stale=f.open();
  active.record(two);
  stale.nav('#wrapup');
  assert.equal(f.count(),2);
  assert.match(stale.warning(),/Another tab saved newer work/);
  stale.record(one);
  const writes=f.writes();
  const backup=await stale.download();
  assert.equal(backup.simulatedData.burns.length,1);
  assert.equal(f.writes(),writes,'a manual download cannot overwrite storage');
  assert.equal(f.count(),2);
  assert.equal(stale.reset(),false,'a stale tab cannot clear newer work either');
  assert.equal(f.count(),2);
});

test('dashboard ERASE stays erased despite navigation and actions in tabs that were already open', () => {
  const f=fixture(), old=f.open(), previouslyEmpty=f.open();
  old.record(one);
  assert.equal(SaveSession.erase(f.localStorage,SCOPE,[KEY],()=> 'dashboard-reset').ok,true);
  old.change(SaveSession.scopeKey(SCOPE));
  assert.match(old.warning(),/cleared in another tab/);
  old.nav('#sense');
  assert.equal(f.localStorage.getItem(KEY),null);
  previouslyEmpty.record(one);
  assert.equal(f.localStorage.getItem(KEY),null);
  assert.equal(old.count(),1,'old tab still has its in-memory copy for export');
  assert.equal(f.open().count(),0);
  assert.equal(f.localStorage.getItem(FIRES),'control','unrelated saved keys stay intact');
});

test('confirmed activity reset clears storage and blocks other open editors without reloading them', () => {
  const f=fixture(), active=f.open();
  active.record(one);
  const stale=f.open();
  assert.equal(active.reset(),true);
  assert.equal(f.localStorage.getItem(KEY),null);
  stale.nav('#sense');
  assert.equal(f.localStorage.getItem(KEY),null);
  assert.match(stale.warning(),/cleared in another tab/);
});
