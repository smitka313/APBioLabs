'use strict';
const fs=require('node:fs'), vm=require('node:vm'), assert=require('node:assert/strict'),test=require('node:test');
const path=require('node:path');
const root=process.env.HANDOFF_BASE?path.resolve(process.env.HANDOFF_BASE):path.resolve(__dirname,'..');
const source=fs.readFileSync(root+'/lab.js','utf8');
const guard=require(root+'/openscied-save-session.js');
const OLD={name:'First Student',period:'3'}, NEW={name:'Next Student',period:'4'};
const MIG='aplab:openscied:b1-migration:v1', GAME='aplab:openscied-b1-serengeti:preview-v1';
const CAP='aplab:openscied-b1-carrying-capacity:run-v1', AP='aplab:lab02:answer';
const EPOCH='aplab:pref:workspace-handoff:v1', RESUME='aplab:pref:openscied-resume:v1';
function storage(seed={}) {
  const s={...seed}, blocked={};
  Object.defineProperties(s,{
    blocked:{value:blocked}, getItem:{value:k=>Object.hasOwn(s,k)?s[k]:null},
    setItem:{value:(k,v)=>{if(blocked.set===k)throw Error('denied');s[k]=String(v);}},
    removeItem:{value:k=>{if(blocked.remove===k)throw Error('denied');delete s[k];}}
  });
  return s;
}
function page(localStorage,pathname='/index.html'){
  const downloads=[], nav=[], noop=()=>{};
  let doc;
  class Element {
    constructor(tag,txt=''){this.tagName=tag.toUpperCase();this.nodeType=tag==='#text'?3:1;this.children=[];this.events={};this.attributes={};this.txt=txt;}
    get classList(){return {toggle:noop,add:noop,remove:noop};}
    get textContent(){return this.txt+this.children.map(n=>n.textContent).join('');}
    set textContent(v){this.txt=v;this.children=[];}
    set innerHTML(v){this.textContent=v;}
    hasAttribute(k){return Object.hasOwn(this.attributes,k);}
    setAttribute(k,v){this.attributes[k]=String(v);if(k==='hidden'||k==='disabled')this[k]=true;if(k==='id'||k==='value')this[k]=String(v);}
    removeAttribute(k){delete this.attributes[k];}
    addEventListener(k,fn){(this.events[k]||=[]).push(fn);}
    trigger(k){for(const fn of this.events[k]||[])fn({target:this,currentTarget:this,preventDefault:noop,stopPropagation:noop});}
    click(){if(!this.disabled)this.trigger('click');}
    focus(){doc.activeElement=this;}
    append(...nodes){for(let n of nodes){if(typeof n==='string')n=new Element('#text',n);this.children.push(n);n.parent=this;}}
    remove(){if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this);}
    querySelector(q){return this.querySelectorAll(q)[0]||null;}
    querySelectorAll(q){
      const match=n=>q[0]==='.'?(n.className||'').split(' ').includes(q.slice(1)):q[0]==='#'?n.id===q.slice(1):n.tagName.toLowerCase()===q;
      return this.children.flatMap(n=>[...(match(n)?[n]:[]),...n.querySelectorAll(q)]);
    }
  }
  doc={title:'Fixture',readyState:'loading',addEventListener:noop, removeEventListener:noop, body:new Element('body'),
    createElement:tag=>new Element(tag),createTextNode:txt=>new Element('#text',txt), querySelector(sel){return this.body.querySelector(sel);}, querySelectorAll(sel){return this.body.querySelectorAll(sel);}};
  const location={pathname,reload:()=>nav.push('reload'),assign:file=>nav.push(file)};
  const env={console,navigator:{},document:doc,location,localStorage,sessionStorage:storage(),
    setTimeout:noop,clearTimeout:noop,setInterval:noop,clearInterval:noop,addEventListener:noop,requestAnimationFrame:noop,cancelAnimationFrame:noop,
    Blob,URL:{createObjectURL:blob=>(downloads.push(blob),'blob:test'),revokeObjectURL:noop}};
  env.window=env; vm.runInNewContext(source,env);
  return {Lab:env.Lab, doc, nav, downloads, el:tag=>new Element(tag)};
}
function confirm(box,id='signout',typed='First'){
  const gate=box.querySelector('#dm-'+id+'-gate');
  gate.value=typed;gate.trigger('input');box.querySelector('.dm-confirm').click();
}
const withStudent=(records={})=>storage({'aplab:student':JSON.stringify(OLD),...records});
const parse=async blob=>JSON.parse(await blob.text());

test('common sign-out sees OpenSciEd-only work and downloads exact raw values without claiming ownership',async()=>{
  const raw=' {\n"unreadable": []';
  const s=withStudent({[MIG]:'{"v":1}',[GAME]:raw,[CAP]:'null','aplab:pref:theme':'light'});
  const p=page(s), dialog=p.Lab.data.signOut();
  assert.doesNotMatch(dialog.textContent,/No saved lab work/);
  const download=dialog.querySelector('.dm-openscied-backup'); assert.ok(download); download.click();
  const payload=await parse(p.downloads[0]);
  assert.deepEqual(payload.work,{[MIG]:'{"v":1}',[GAME]:raw,[CAP]:'null'});
  assert.equal(payload.format,'openscied-saved-work-v1');
  assert.equal(payload.student,null);assert.deepEqual(payload.responses,{});
  assert.equal(s[GAME],raw);assert.deepEqual(p.nav,[]);
});

test('site sign-out invalidates old AP and OpenSciEd writers and removes the prior label before fresh sign-in',()=>{
  const s=withStudent({[MIG]:'{"v":1}',[AP]:'"old answer"',[RESUME]:'old trace','aplab:pref:theme':'light'});
  const oldAp=page(s,'/lab02.html'), oldOpen=guard.open(s,'b1-migration',[MIG]);
  const p=page(s); confirm(p.Lab.data.signOut());
  assert.equal(p.nav[0],'reload');
  for(const k of [MIG,AP,RESUME,'aplab:student'])assert.equal(s.getItem(k),null,k);
  assert.equal(s.getItem('aplab:pref:theme'),'light');
  assert.ok(s.getItem(EPOCH));assert.ok(s.getItem(guard.globalKey));
  const fresh=page(s);assert.equal(fresh.Lab.identity.set(NEW),true);
  assert.equal(oldAp.Lab.identity.set(OLD),false);
  oldAp.Lab.store.set('answer','old write');
  assert.equal(s.getItem(AP),null);
  assert.equal(JSON.parse(s.getItem('aplab:student')).name,NEW.name);
  assert.equal(oldAp.Lab.identity.get().name,OLD.name);
  assert.equal(oldOpen.write(MIG,'old write').reason,'erased');
  assert.throws(()=>oldAp.Lab.progressFile.payload(),/cleared in another tab/);
  assert.throws(()=>oldAp.Lab.progressFile.apply({student:OLD,data:{answer:'old'}}),/cleared in another tab/);
});

test('blocked work deletion leaves the original identity, keeps the dialog open, and can be retried',()=>{
  const s=withStudent({[MIG]:'work',[AP]:'"ap work"'});s.blocked.remove=MIG;
  const p=page(s), dialog=p.Lab.data.signOut(); confirm(dialog);
  assert.equal(s.getItem(MIG),'work');assert.equal(JSON.parse(s.getItem('aplab:student')).name,OLD.name);
  assert.deepEqual(p.nav,[]);assert.match(dialog.querySelector('.tool-status').textContent,/Do not hand off/);
  delete s.blocked.remove; dialog.querySelector('.dm-confirm').click();assert.deepEqual(p.nav,['reload']);
});
test('guard failure never erases any work or identity',()=>{
  const s=withStudent({[MIG]:'work',[AP]:'"ap work"'});s.blocked.set=guard.globalKey;
  const p=page(s), dialog=p.Lab.data.signOut(); confirm(dialog);
  assert.equal(s.getItem(MIG),'work');assert.equal(s.getItem(AP),'"ap work"');
  assert.deepEqual(p.nav,[]);assert.equal(JSON.parse(s.getItem('aplab:student')).name,OLD.name);
});
test('a scoped OpenSciEd clear must not invalidate AP work, and site Start Over keeps the name',()=>{
  const s=withStudent({[MIG]:'work',[AP]:'"ap work"'}), ap=page(s,'/lab02.html');
  guard.erase(s,null,[MIG]);
  ap.Lab.store.set('answer','still valid');
  assert.equal(s.getItem(AP),'"still valid"');
  s.setItem(GAME,'next OpenSciEd record');
  const p=page(s);const dialog=p.Lab.data.startOverAll();assert.ok(dialog.querySelector('.dm-openscied-backup'));
  confirm(dialog,'startover','ERASE');
  assert.equal(JSON.parse(s.getItem('aplab:student')).name,OLD.name);
  assert.equal(s.getItem(AP),null);assert.equal(s.getItem(GAME),null);assert.deepEqual(p.nav,['reload']);
});
test('the shared-device form distinguishes an edit from a switch, and protects unnamed work',()=>{
  const s=withStudent({[MIG]:'old record'}), p=page(s);
  const box=p.Lab.identity.mount(p.el('div'),{sharedDevice:true});
  assert.equal(box.querySelector('.id-change').textContent,'Edit my name or class period');
  assert.equal(box.querySelector('.id-signout').textContent,'Switch student');
  box.querySelector('.id-change').click();
  assert.match(box.textContent,/correct your own information/);
  const anon=page(storage({[MIG]:'anonymous work'}));const form=anon.Lab.identity.mount(anon.el('div'),{sharedDevice:true});
  assert.match(form.textContent,/only if it is your work/);
  form.querySelector('.id-signout').click();
  const dialog=anon.doc.querySelector('.dm-card');
  assert.match(dialog.textContent,/type ERASE/);
  confirm(dialog,'signout','ERASE');assert.deepEqual(anon.nav,['reload']);
});
test('new OpenSciEd work discovered after confirmation opens is offered for backup before deletion',()=>{
  const s=withStudent({}), p=page(s), dialog=p.Lab.data.signOut();
  assert.equal(dialog.querySelector('.dm-openscied-work').hidden,true);
  s.setItem(MIG,'arrived since opened');
  confirm(dialog);
  assert.deepEqual(p.nav,[]);
  assert.equal(dialog.querySelector('.dm-openscied-work').hidden,false);
  assert.match(dialog.querySelector('.tool-status').textContent,/Download a backup/);
  dialog.querySelector('.dm-confirm').click();assert.deepEqual(p.nav,['reload']);
});
