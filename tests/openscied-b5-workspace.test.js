'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const file=process.env.B5_RECEIPT_MODULE||path.join(__dirname,'..','openscied-b5-workspace.js');
const element=()=>({hidden:false,dataset:{},children:[],textContent:'',
  replaceChildren(...children){this.children=children;},
  setAttribute(k,v){this[k]=v;},removeAttribute(k){if(k==='datetime')delete this.dateTime;}
});
function fixture(initial={},restored=false){
  let now=100,ok=true,allowed=true,lastRaw,storage;
  const output=element(),window={addEventListener(_,cb){storage=cb;}};
  class FakeDate extends Date {static now(){return now;}}
  vm.runInNewContext(fs.readFileSync(file,'utf8'),{window,document:{createElement:element},Date:FakeDate});
  const session={write(key,raw){lastRaw=raw;return {ok};}};
  const receipt=window.OpenSciEdB5Workspace.mount({output,key:'work',session,canSave:()=>allowed,restored:()=>restored,getRecord:()=>initial});
  return {output,receipt,attempted:()=>lastRaw,stamp:()=>output.children[1].dateTime,show:()=>output.dataset.saveState,
    setTime:value=>now=value,setWrite:value=>ok=value,allow:value=>{allowed=value;storage({key:'work'});}};
}
test('only successful work changes get a receipt; navigation and stale tabs do not refresh it',()=>{
  const f=fixture();
  assert.equal(f.show(),'ready');
  assert(f.output.children[1].hidden);
  assert(f.receipt.write(false));
  assert.equal(f.show(),'ready');
  assert.deepEqual(JSON.parse(f.attempted()),{});
  assert(f.receipt.write());
  assert.equal(f.show(),'saved');
  assert.equal(f.stamp(),new Date(100).toISOString());
  f.setTime(200);
  assert(f.receipt.write(false));
  assert.equal(JSON.parse(f.attempted()).lastSavedAt,100);
  assert.equal(f.stamp(),new Date(100).toISOString());
  f.setWrite(false);
  assert.equal(f.receipt.write(),false);
  assert.equal(f.show(),'blocked');
  assert(f.output.children[1].hidden);
  f.setTime(300);f.setWrite(true);
  assert(f.receipt.write(false));
  assert.equal(f.stamp(),new Date(100).toISOString(),'failed edit cannot update the receipt');
  f.allow(false);
  assert.equal(f.show(),'blocked','storage event refreshes state');
});
test('restored legacy work does not inherit an invented timestamp',()=>{
  const old=fixture({lastVisitedAt:70},true);
  assert.equal(old.show(),'restored');
  assert.equal(old.stamp(),undefined);
  const modern=fixture({lastSavedAt:80},true);
  assert.equal(modern.show(),'saved');
  assert.equal(modern.stamp(),new Date(80).toISOString());
});
