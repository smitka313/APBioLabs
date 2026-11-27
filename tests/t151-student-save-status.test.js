'use strict';
const assert=require('node:assert/strict'),test=require('node:test'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
function memory() {
 const values=new Map();
 return { deny:false, getItem:k=>values.get(k)??null, removeItem:k=>values.delete(k),setItem(k,v) {if(this.deny)throw Error('blocked');values.set(k,String(v));}};
}
test('OpenSciEd receipt holds a multi-record failure until the affected work is successfully written',()=>{
 const store=memory(), events=[];
 const cx={Date,Math,Event,dispatchEvent(evt){events.push(evt.type);}};
 cx.window=cx;
 vm.runInNewContext(read('openscied-save-session.js'),cx);
 const one='aplab:openscied:b2-carbon-journey:v1',two='aplab:openscied:b2-carbon-journey:budget-v1';
 const tab=cx.OpenSciEdSaveSession.open(store,'b2-carbon-journey',[one,two]);
 assert.equal(tab.write(one,'{"rolls":1}').ok,true);
 store.deny=true;
 assert.equal(tab.write(one,'{"rolls":2}').ok,false);
 assert.equal(store.getItem(one),'{"rolls":1}');
 assert.equal(cx.BiologyBenchSaveState.failed,true);
 store.deny=false;
 assert.equal(tab.write(one,'{"rolls":1}').ok,true);
 assert.equal(tab.write(two,'{"records":1}').ok,true);
 assert.equal(cx.BiologyBenchSaveState.failed,true);
 assert.equal(tab.write(one,'{"rolls":2}').ok,true);
 assert.equal(cx.BiologyBenchSaveState.failed,false);
 assert.equal(store.getItem(one),'{"rolls":2}');
 assert.ok(events.every(x=>x==='blb:save-state'));
 const conflict=cx.OpenSciEdSaveSession.open(store,'b2-carbon-journey',[one]);
 assert.equal(tab.write(one,'{"rolls":3}').ok,true);
 assert.equal(conflict.write(one,'{"rolls":4}').reason,'changed');
 assert.equal(cx.BiologyBenchSaveState.failed,true);
});
test('shared save receipt mounts once and distinguishes idle, confirmed and failed states without using private data',()=>{
 function el(){return {children:[],dataset:{},setAttribute(){},append(...cs){this.children.push(...cs);}};}
 const host=el(),head=el(),handlers={};let receipt;
 host.after=z=>{receipt=z;};
 const document={currentScript:{src:'https://example.test/blb/student-save-status.js'},head,querySelector:()=>host,getElementById:()=>receipt,createElement:el};
 const cx={URL,document,location:{pathname:'/openscied-b1-migration'},addEventListener:(name,f)=>{handlers[name]=f;}};
 cx.window=cx; vm.runInNewContext(read('student-save-status.js'),cx);
 assert.equal(receipt.dataset.state,'idle');
 assert.equal(receipt.children[0].textContent,'No save confirmed yet');
 cx.BiologyBenchSaveState={at:100,failed:false};handlers['blb:save-state']();
 assert.equal(receipt.dataset.state,'ok');assert.equal(receipt.children[0].textContent,'Saved to this browser');
 cx.BiologyBenchSaveState={at:100,failed:true};handlers['blb:save-state']();
 assert.equal(receipt.dataset.state,'bad');assert.match(receipt.children[1].textContent,/Preview report to keep a copy before closing/);
});
test('AP receipt uses the stored timestamp and holds a failed write through no-op saves',()=>{
 const body=read('lab.js');
 const p=body.indexOf('  function saveNote(ok,');
 const q=body.indexOf('  /* A fresh status element',p);
 assert.ok(p>=0&&q>p);
 const store=memory();store.setItem('aplab:lab04:saved-at','123');
 const events=[],window={dispatchEvent(e){events.push(e.type);}};
 const cx={Event,window,localStorage:store,LAB_ID:'lab04',PAGE:{kind:'lab'},SAVE:{ok:null,at:0},Date,renderSavedClock(){},clearTimeout(){},setTimeout(){return 1;},renderSave(){}};
 const f=vm.runInNewContext(body.slice(p,q)+'\nsaveNote;',cx);
 f(true,false);assert.equal(window.BiologyBenchSaveState.at,123);assert.equal(window.BiologyBenchSaveState.failed,false);
 f(false,false);assert.equal(window.BiologyBenchSaveState.failed,true);
 f(true,false);assert.equal(window.BiologyBenchSaveState.failed,true);
 f(true,true);assert.equal(window.BiologyBenchSaveState.failed,false);assert.ok(window.BiologyBenchSaveState.at>123);
 assert.deepEqual(events,Array(4).fill('blb:save-state'));
});
