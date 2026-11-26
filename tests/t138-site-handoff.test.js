'use strict';
const fs=require('node:fs'), vm=require('node:vm'), assert=require('node:assert/strict'),test=require('node:test');
const path=require('node:path');
const root=process.env.HANDOFF_BASE?path.resolve(process.env.HANDOFF_BASE):path.resolve(__dirname,'..');
const source=fs.readFileSync(root+'/lab.js','utf8');
const dashboardSource=fs.readFileSync(root+'/openscied-dashboard.js','utf8');
const guard=require(root+'/openscied-save-session.js');
const OLD={name:'First Student',period:'3'}, NEW={name:'Next Student',period:'4'};
const MIG='aplab:openscied:b1-migration:v1', GAME='aplab:openscied-b1-serengeti:preview-v1';
const CAP='aplab:openscied-b1-carrying-capacity:run-v1', AP='aplab:lab02:answer', FUTURES='aplab:openscied:b5-hybrid:v1';
const futuresSource=fs.readFileSync(root+'/openscied-b5-hybrid-data.js','utf8');
const EPOCH='aplab:pref:workspace-handoff:v1', RESUME='aplab:pref:openscied-resume:v1';
function storage(seed={}) {
  const s={...seed}, blocked={};
  Object.defineProperties(s,{
    blocked:{value:blocked}, length:{get:()=>Object.keys(s).length}, key:{value:i=>Object.keys(s)[i]??null}, getItem:{value:k=>Object.hasOwn(s,k)?s[k]:null},
    setItem:{value:(k,v)=>{if(blocked.set===k)throw Error('denied');s[k]=String(v);}},
    removeItem:{value:k=>{if(blocked.remove===k)throw Error('denied');delete s[k];}}
  });
  return s;
}
function page(localStorage,pathname='/index.html', beforeScriptLoad=()=>{}, program=source){
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
    trigger(k,details={}){let result;for(const fn of this.events[k]||[])result=fn({target:this,currentTarget:this,preventDefault:noop,stopPropagation:noop,...details});return result;}
    click(){if(!this.disabled)return this.trigger('click');}
    focus(){doc.activeElement=this;}
    append(...nodes){for(let n of nodes){if(typeof n==='string')n=new Element('#text',n);this.children.push(n);n.parent=this;}}
    remove(){if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this);}
    querySelector(q){return this.querySelectorAll(q)[0]||null;}
    querySelectorAll(q){
      const match=n=>q[0]==='.'?(n.className||'').split(' ').includes(q.slice(1)):q[0]==='#'?n.id===q.slice(1):n.tagName.toLowerCase()===q;
      return this.children.flatMap(n=>[...(match(n)?[n]:[]),...n.querySelectorAll(q)]);
    }
  }
  doc={documentElement:{style:{removeProperty:noop}},title:'Fixture',readyState:'loading',addEventListener:noop, removeEventListener:noop, body:new Element('body'),
    createElement:tag=>new Element(tag),createTextNode:txt=>new Element('#text',txt), querySelector(sel){return this.body.querySelector(sel);}, querySelectorAll(sel){return this.body.querySelectorAll(sel);}};
  const location={pathname,reload:()=>nav.push('reload'),assign:file=>nav.push(file)};
  const env={console,navigator:{},document:doc,location,localStorage,sessionStorage:storage(),
    setTimeout:noop,clearTimeout:noop,setInterval:noop,clearInterval:noop,addEventListener:noop,requestAnimationFrame:noop,cancelAnimationFrame:noop,
    Blob,TextEncoder,TextDecoder,btoa,atob,URL:{createObjectURL:blob=>(downloads.push(blob),'blob:test'),revokeObjectURL:noop}};
  doc.head=new Element('head');
  doc.head.append=script=>{
    assert.ok(['openscied-dashboard.js','openscied-b5-hybrid-data.js'].includes(script.src));
    queueMicrotask(()=>{
      if (beforeScriptLoad(script.src)===false) { script.onerror(); return; }
      vm.runInNewContext(script.src==='openscied-dashboard.js'?dashboardSource:futuresSource,env);
      script.onload();
    });
  };
  env.window=env; vm.runInNewContext(program,env);
  return {Lab:env.Lab, doc, nav, downloads, el:tag=>new Element(tag), env};
}
function confirm(box,id='signout',typed='First'){
  const gate=box.querySelector('#dm-'+id+'-gate');
  gate.value=typed;gate.trigger('input');box.querySelector('.dm-confirm').click();
}
const withStudent=(records={})=>storage({'aplab:student':JSON.stringify(OLD),...records});
const parse=async blob=>JSON.parse(await blob.text());

test('common sign-out sees OpenSciEd-only work and downloads structured records and exact unreadable values without claiming ownership',async()=>{
  const raw=' {\n"unreadable": []';
  const s=withStudent({[MIG]:'{"v":1}',[GAME]:raw,[CAP]:'null','aplab:pref:theme':'light'});
  const p=page(s), dialog=p.Lab.data.signOut();
  assert.doesNotMatch(dialog.textContent,/No saved lab work/);
  const download=dialog.querySelector('.dm-openscied-backup'); assert.ok(download); await download.click();
  const payload=await parse(p.downloads[0]);
  assert.deepEqual(payload.work,{[MIG]:{v:1},[GAME]:{unreadable:true,raw},[CAP]:null});
  assert.equal(payload.format,'openscied-saved-work-v2');
  assert.equal(payload.scope,'browser');
  assert.deepEqual(payload.exportedBy,OLD);
  assert.equal(Object.hasOwn(payload,'student'),false);assert.equal(payload.recordOwnership,'not-verified');assert.deepEqual(payload.datasetIds,{});
  const d=dashboard(s); d.el('download-openscied-results').click();
  const dashboardPayload=await parse(d.downloads[0]);
  assert.deepEqual({...payload,exportedAt:null},{...dashboardPayload,exportedAt:null});
  assert.equal(s[GAME],raw);assert.deepEqual(p.nav,[]);
});

test('backup waiting for its script cannot download the next student’s work',async()=>{
  const s=withStudent({[MIG]:migWork('original')});
  const p=page(s,'/lab02.html',()=>{
    confirm(page(s).Lab.data.signOut());
    assert.equal(page(s).Lab.identity.set(NEW),true);
    s.setItem(MIG,migWork('next student work'));
  });
  const dialog=p.Lab.data.signOut();
  await dialog.querySelector('.dm-openscied-backup').click();
  assert.equal(p.downloads.length,0);
  assert.match(dialog.querySelector('.tool-status').textContent,/cleared in another tab/);
  assert.equal(s.getItem(MIG),migWork('next student work'));
});

test('AP backup uses the shared Futures model and rechecks the workspace after loading it', async()=>{
  const saved={v:1,id:'FE8D9975',rolls:5};
  const records={[FUTURES]:JSON.stringify(saved)};
  const original=withStudent(records), p=page(original,'/lab02.html');
  const dialog=p.Lab.data.signOut();
  await dialog.querySelector('.dm-openscied-backup').click();
  const payload=await parse(p.downloads[0]);
  assert.deepEqual(payload.work[FUTURES],saved);
  assert.equal(payload.models['bear-hybrid'].coinFlips.length,5);
  assert.equal(payload.models['bear-hybrid'].coinFlips[4].mating,2);
  const replaced=withStudent(records);
  const stale=page(replaced,'/lab02.html',src=>{
    if(src!=='openscied-b5-hybrid-data.js')return;
    confirm(page(replaced).Lab.data.signOut());
    assert.equal(page(replaced).Lab.identity.set(NEW),true);
    replaced.setItem(FUTURES,JSON.stringify({...saved,id:'FE8D9976'}));
  });
  const interrupted=stale.Lab.data.signOut();
  await interrupted.querySelector('.dm-openscied-backup').click();
  assert.equal(stale.downloads.length,0,'late model response cannot export the next workspace');
  assert.match(interrupted.querySelector('.tool-status').textContent,/cleared in another tab/i);
  assert.equal(JSON.parse(replaced.getItem(FUTURES)).id,'FE8D9976');
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
  // The old confirmation must not erase. Reopening reviews the new work.
  dialog.querySelector('.dm-confirm').click();assert.deepEqual(p.nav,[]);
  assert.equal(s.getItem(MIG),'arrived since opened');
  dialog.querySelector('.dm-cancel').click();
  confirm(p.Lab.data.signOut());
  assert.deepEqual(p.nav,['reload']);
});

const OSE_PATH='/openscied-b1-migration.html';
const migWork=(claim,stamp=0)=>JSON.stringify({v:1,month:0,visited:[],notes:[],answers:{claim},lastVisitedAt:stamp});
const backupFor=(p,student)=>p.Lab.progressFile.parse({app:'aplab',v:1,lab:'lab02',student,data:{'field:model':'restored AP work'}});
test('named restore cannot replace a different site-wide sign-in or relabel unrelated OpenSciEd work',()=>{
  const s=withStudent({[MIG]:migWork('original record'),[AP]:'"first AP answer"'}), ap=page(s,'/lab02.html'), ose=page(s,OSE_PATH);
  const session=guard.open(s,'b1-migration',[MIG]);
  const reportIdentity=guard.reportIdentity(session,[MIG],()=>ose.Lab.identity.get());
  const incoming=backupFor(ap,NEW);
  assert.match(ap.Lab.progressFile.question(incoming).blocked,/does not match the current sign-in/);
  assert.throws(()=>ap.Lab.progressFile.apply(incoming), /sign out before restoring another student/);
  assert.equal(s.getItem(AP),'"first AP answer"'); assert.equal(s.getItem(MIG),migWork('original record'));
  assert.equal(reportIdentity().name,OLD.name); assert.deepEqual(ap.nav,[]);
});
test('same-student restore and clean unnamed-device restore work without touching other apps',()=>{
  const match=withStudent({[MIG]:migWork('same student record')}), a=page(match,'/lab02.html');
  a.Lab.progressFile.apply(backupFor(a,OLD));
  assert.equal(match.getItem(MIG),migWork('same student record')); assert.deepEqual(a.nav,['reload']);
  const different=storage({[MIG]:migWork('unnamed existing work')}), b=page(different,'/lab02.html');
  assert.throws(()=>b.Lab.progressFile.apply(backupFor(b,NEW)), /Other work is already saved/);
  assert.equal(different.getItem('aplab:student'),null);
  const clean=storage(), c=page(clean,'/lab02.html');
  c.Lab.progressFile.apply(backupFor(c,NEW));
  assert.equal(JSON.parse(clean.getItem('aplab:student')).name,NEW.name);
  assert.equal(clean.getItem('aplab:lab02:field:model'),'"restored AP work"');
});
function dashboard(s) {
  const p=page(s,'/openscied-dashboard.html'), ids={};
  const el=id=>{
    if(!ids[id]){
      const item=p.el(id.includes('-open')||id==='openscied-resume-link'?'a':id==='clear-openscied-dialog'?'dialog':'div');
      item.before=(...related)=>{item.beforeNodes=related;};
      item.showModal=()=>{item.open=true;};
      item.close=()=>{item.open=false;item.trigger('close');};
      ids[id]=item;
    }
    return ids[id];
  };
  p.doc.readyState='complete';
  p.doc.querySelector=sel=>sel.startsWith('#')?el(sel.slice(1)):null;
  p.env.OpenSciEdSaveSession=guard;
  p.env.OpenSciEdResume=require(root+'/openscied-resume.js');
  vm.runInNewContext(fs.readFileSync(root+'/openscied-dashboard.js','utf8'),p.env);
  return {...p,el};
}
function dashboardConfirm(d){
  d.el('openscied-erase-confirmation').value='ERASE';
  d.el('openscied-erase-confirmation').trigger('input');
  d.el('clear-openscied-form').trigger('submit');
}
test('an older dashboard confirmation cannot clear or back up the next student’s work',()=>{
  const s=withStudent({[MIG]:migWork('previous student')});
  const d=dashboard(s); d.el('migration-reset').click();
  assert.equal(d.el('clear-openscied-dialog').open,true);
  confirm(page(s).Lab.data.signOut());
  page(s).Lab.identity.set(NEW);
  s.setItem(MIG,migWork('new student'));
  dashboardConfirm(d);
  assert.equal(s.getItem(MIG),migWork('new student'));
  assert.equal(d.el('confirm-openscied-clear').disabled,true);
  assert.match(d.el('openscied-clear-error').textContent,/Reload this dashboard/);
  d.el('download-openscied-results').click(); assert.equal(d.downloads.length,0);
});
test('same-workspace changes cancel a stale confirmation; reviewing fresh work still permits a scoped clear',()=>{
  const s=withStudent({[MIG]:migWork('original'),[AP]:'"AP work"'}), d=dashboard(s);
  d.el('migration-reset').click();
  s.setItem(MIG,migWork('more work in another tab'));
  dashboardConfirm(d);
  assert.match(d.el('openscied-clear-error').textContent,/Saved work changed/);
  assert.equal(s.getItem(MIG),migWork('more work in another tab'));
  d.el('cancel-openscied-clear').click();
  d.el('migration-reset').click();
  dashboardConfirm(d);
  assert.equal(s.getItem(MIG),null); assert.equal(s.getItem(AP),'"AP work"');
});
test('guest dashboard describes unattributed work without silently naming it as this student’s',()=>{
  const d=dashboard(storage({[MIG]:migWork('guest evidence')}));
  assert.equal(d.el('openscied-resume').hidden,false);
  assert.equal(d.el('resume-title').textContent,'Saved work on this device');
  assert.match(d.el('openscied-resume-description').textContent,/Continue only if this work is yours/);
  assert.match(d.el('openscied-resume-link').textContent,/Continue my saved Migration Map Explorer/);
});
test('stale activity exits cannot refresh Resume after sign-out or scoped dashboard clear',()=>{
  const resume=require(root+'/openscied-resume.js'), J='aplab:openscied:b2-carbon-journey:v1';
  const CR='/openscied-b2-carbon-journey.html';
  const s=withStudent({[MIG]:migWork('First student',1000)});
  let now=1200;
  const stale=resume.connect(s,()=>now,{scope:'b1-migration'}); stale.snapshot(OSE_PATH,'open');
  confirm(page(s).Lab.data.signOut());
  const fresh=resume.connect(s,()=>now), mounted=resume.connect(s,()=>now,{scope:'b1-migration'});
  now=2000; mounted.snapshot(OSE_PATH,'open');
  now=2100; s.setItem(MIG,migWork('next student earlier',now));
  now=2400; s.setItem(J,JSON.stringify({version:3,rows:[{note:'next student later'}],lastVisitedAt:now}));
  now=3000; assert.deepEqual(stale.snapshot(OSE_PATH,'exit'),{});
  assert.equal(fresh.snapshot(OSE_PATH).changed,2100);
  assert.equal(fresh.snapshot(CR).changed,2400);
  assert.equal(guard.erase(s,'b1-migration',[MIG]).ok,true);
  s.setItem(MIG,migWork('newer run after scoped clear',3150));
  now=3200;assert.deepEqual(mounted.snapshot(OSE_PATH,'exit'),{});
  assert.ok(fresh.snapshot(OSE_PATH).changed>0);
});

test('Peat Bog dashboard distinguishes duplicate trials from a real model contrast',()=>{
  const key='aplab:openscied:b2-peat-bog:v1';
  const t={ tilt:23.44,temp:10,co2:420,o2:21,wet:75,burn:0 };
  const same={...t,label:'Different title, same inputs'};
  const identical=dashboard(withStudent({[key]:JSON.stringify({v:1,trials:[t,same]})}));
  assert.match(identical.el('peat-bog-progress').textContent,/same conditions/);
  assert.equal(identical.el('peat-bog-progress').beforeNodes[1].value,1);
  const contrasted=dashboard(withStudent({[key]:JSON.stringify({v:1,trials:[t,{...t,co2:800}]})}));
  assert.equal(contrasted.el('peat-bog-progress').beforeNodes[1].value,2);
});
test('Fires dashboard counts only valid contrasts, including older matching records',()=>{
  const key='aplab:openscied:b2-fires:v1', filesave=x=>withStudent({[key]:JSON.stringify({v:1,...x})});
  const cards={solved:true}, decomp={seed:7,temps:[18,18,18],recorded:[0,2]};
  const tilt={seed:7,settings:['direct','direct','direct'],recorded:true,starchDone:true};
  const identical=dashboard(filesave({cards,decomp,tilt}));
  assert.equal(identical.el('b2-fires-progress').beforeNodes[1].value,1);
  const contrasted=dashboard(filesave({cards,decomp:{...decomp,temps:[18,27,43]},tilt:{...tilt,settings:['direct','tilt70','foil']}}));
  assert.equal(contrasted.el('b2-fires-progress').beforeNodes[1].value,3);
  const marked=dashboard(filesave({cards,decomp,tilt,modelEvidence:{cardsRight:5,tubesRead:3,starchTested:true,foamAfterBaseline:true,
    foamComparison:false,tiltComparison:false}}));
  assert.equal(marked.el('b2-fires-progress').beforeNodes[1].value,1);
});
test('Cancer Rates dashboard will not show completed with reference-only pins or an uncommitted question edit',()=>{
  const KEY='aplab:openscied:b3-cancer-rates:v1';
  const seed=x=>withStudent({[KEY]:JSON.stringify(x)});
  const casework={access:'falling',diagnosis:'rising','test-cost':'longer',notes:{diagnoses:'trend',deaths:'trend',map:'trend'},opened:true,question:'Original question'};
  const complete={step:'explain',prediction:{choice:'same',locked:true},casework,claim:'claim',limits:'limit',
    evidence:[{a:'A',b:'B',view:'michigan',measure:'late-rate'}],completed:true};
  const reference=dashboard(seed({...complete,qualifyingPinCount:0}));
  assert.doesNotMatch(reference.el('cancer-rates-progress').textContent,/Investigation complete/);
  assert.match(reference.el('cancer-rates-progress').textContent,/0 usable comparisons · 1 reference pin/);
  assert.match(reference.el('cancer-rates-open').href,/#explore$/);
  const pending=dashboard(seed({...complete,casework:{...casework,questionDraft:'New question'},qualifyingPinCount:1}));
  assert.doesNotMatch(pending.el('cancer-rates-progress').textContent,/Investigation complete/);
  assert.match(pending.el('cancer-rates-progress').textContent,/Question draft saved/);
  const valid=dashboard(seed({...complete,casework:{...casework,questionDraft:' Original question '},qualifyingPinCount:1}));
  assert.match(valid.el('cancer-rates-progress').textContent,/Investigation complete/);
});

test('a legacy same-student backup with blank period does not overwrite a currently entered class period',()=>{
  const s=withStudent(), ap=page(s,'/lab02.html');
  ap.Lab.progressFile.apply(backupFor(ap,{name:' first student ',period:''}));
  assert.deepEqual(JSON.parse(s.getItem('aplab:student')),OLD);
  assert.equal(s.getItem('aplab:lab02:field:model'),'"restored AP work"');
});
test('a clean-device restore rolls back the imported AP record when browser storage cannot save its label',()=>{
  const s=storage(), ap=page(s,'/lab02.html');
  s.blocked.set='aplab:student';
  assert.throws(()=>ap.Lab.progressFile.apply(backupFor(ap,NEW)),/progress could not be loaded/);
  assert.equal(s.getItem('aplab:student'),null); assert.equal(ap.Lab.identity.get(),null);
  assert.equal(s.getItem('aplab:lab02:field:model'),null);
  assert.deepEqual(ap.nav,[]);
});

for (const [name,open,id,word] of [
  ['Sign out', p=>p.Lab.data.signOut(), 'signout','First'],
  ['Start over', p=>p.Lab.data.startOverAll(), 'startover','ERASE']
]) {
  test(name+' cannot erase while preparing a requested OpenSciEd archive',async()=>{
    const original=migWork('only copy of student work');
    const s=withStudent({[MIG]:original}),p=page(s,'/ap-biology.html'),dialog=open(p);
    const gate=dialog.querySelector('#dm-'+id+'-gate'),erase=dialog.querySelector('.dm-confirm');
    gate.value=word; gate.trigger('input');
    assert.equal(erase.disabled,false);
    const pending=dialog.querySelector('.dm-openscied-backup').click();
    assert.equal(erase.disabled,true);
    assert.match(dialog.querySelector('.tool-status').textContent,/Erase is paused/);
    gate.trigger('input'); gate.trigger('keydown',{key:'Enter'});
    erase.click();
    assert.equal(erase.disabled,true);
    assert.equal(s.getItem(MIG),original);
    assert.deepEqual(p.nav,[]);
    await pending;
    assert.deepEqual((await parse(p.downloads[0])).work[MIG],JSON.parse(original));
    assert.equal(erase.disabled,false);
    assert.match(dialog.querySelector('.tool-status').textContent,/Check your browser’s downloads/);
    erase.click();
    assert.equal(s.getItem(MIG),null);
    assert.deepEqual(p.nav,['reload']);
  });
}

test('a failed backup preserves work and requires fresh confirmation; retry can download',async()=>{
  const original=migWork('keep this work');
  const s=withStudent({[MIG]:original}); let first=true;
  const p=page(s,'/ap-biology.html',()=>{if(first){first=false;return false;}});
  const dialog=p.Lab.data.signOut(), gate=dialog.querySelector('#dm-signout-gate');
  const download=dialog.querySelector('.dm-openscied-backup'), erase=dialog.querySelector('.dm-confirm');
  gate.value='First'; gate.trigger('input'); await download.click();
  assert.match(dialog.querySelector('.tool-status').textContent,/Nothing was erased/);
  assert.equal(gate.value,''); assert.equal(erase.disabled,true);
  erase.click(); assert.equal(s.getItem(MIG),original);assert.equal(p.downloads.length,0);
  await download.click();assert.deepEqual((await parse(p.downloads[0])).work[MIG],JSON.parse(original));
  assert.equal(erase.disabled,true);
});

test('cancel during backup stops the pending download and retains work',async()=>{
  const original=migWork('do not erase');
  const s=withStudent({[MIG]:original}),p=page(s,'/ap-biology.html'),dialog=p.Lab.data.signOut();
  const pending=dialog.querySelector('.dm-openscied-backup').click();
  dialog.querySelector('.dm-cancel').click();await pending;
  assert.equal(p.downloads.length,0);assert.equal(s.getItem(MIG),original);
  assert.equal(p.doc.querySelector('.dm-card'),null);
});

test('both OpenSciEd archive paths include the Peat Bog graph explanation in readable responses',async()=>{
  const key='aplab:openscied:b2-peat-bog:v1', answer='The model showed that decomposition rose when it warmed.';
  const raw=JSON.stringify({v:1,lastSection:'graph',fields:{'graph-answer':answer},trials:[]});
  const s=withStudent({[key]:raw}),d=dashboard(s),a=page(s,'/lab02.html');
  d.el('download-openscied-results').click();
  await a.Lab.data.signOut().querySelector('.dm-openscied-backup').click();
  for(const file of [d.downloads[0],a.downloads[0]]){
    const payload=await parse(file);
    assert.deepEqual(payload.work[key],JSON.parse(raw));
    assert.equal(payload.responses['peat-bog']['graph-answer'],answer);
    assert.equal(Object.hasOwn(payload,'student'),false);assert.equal(payload.recordOwnership,'not-verified');
  }
});

const wordButton=dialog=>dialog.querySelectorAll('button').find(b=>b.textContent==='Download report (.docx)');
const wordDialogs=[
  ['Sign out', p=>p.Lab.data.signOut(), 'signout','First'],
  ['Start over all', p=>p.Lab.data.startOverAll(), 'startover','ERASE'],
  ['Start over this lab', p=>p.Lab.data.startOverLab(), 'startlab',null],
];
const unlockWordDialog=(gate,word)=>{
  if(word){gate.value=word;gate.trigger('input');}
  else{gate.checked=true;gate.trigger('change');}
};
for (const [label,open,id,word] of wordDialogs) {
  test(label+' cannot erase while the Word file is being built',async()=>{
    const original='"student measured 7.1"';
    const s=withStudent({[AP]:original,[MIG]:migWork('preserve companion work')});
    const p=page(s,'/lab02.html'), dialog=open(p);
    const gate=dialog.querySelector('#dm-'+id+'-gate'), erase=dialog.querySelector('.dm-confirm');
    let finish;
    p.Lab.report.docx=()=>new Promise(resolve=>{finish=resolve;});
    unlockWordDialog(gate,word);
    assert.equal(erase.disabled,false);
    const pending=wordButton(dialog).click();
    unlockWordDialog(gate,word);
    gate.trigger('keydown',{key:'Enter'}); erase.click();
    assert.equal(s.getItem(AP),original,'the only saved answer must survive an early erase attempt');
    assert.deepEqual(p.nav,[]);
    assert.equal(erase.disabled,true);
    assert.match(dialog.querySelector('.tool-status').textContent,/Erase is paused/);
    if(word)assert.equal(dialog.querySelector('.dm-openscied-backup').disabled,true);
    assert.equal(p.downloads.length,0);
    finish(new Blob(['synthetic Word report'])); await pending;
    assert.equal(await p.downloads[0].text(),'synthetic Word report');
    assert.equal(erase.disabled,false);
    erase.click();
    assert.equal(s.getItem(AP),null);
    assert.deepEqual(p.nav,[id==='signout'?'ap-biology.html':'reload']);
  });
}

test('a failed Word download re-locks the per-lab checkbox without erasing the answer',async()=>{
  const s=withStudent({[AP]:'"do not erase"'}), p=page(s,'/lab02.html'), dialog=p.Lab.data.startOverLab();
  const gate=dialog.querySelector('#dm-startlab-gate'), erase=dialog.querySelector('.dm-confirm');
  unlockWordDialog(gate,null);
  p.Lab.report.docx=async()=>{throw Error('docx-load');};
  await wordButton(dialog).click();
  assert.equal(gate.checked,false);
  assert.equal(erase.disabled,true);
  assert.match(dialog.querySelector('.tool-status').textContent,/Nothing was erased/);
  erase.click();
  assert.equal(s.getItem(AP),'"do not erase"');
  assert.deepEqual(p.nav,[]);
});

test('cancelling a pending Word download suppresses the file and retains work',async()=>{
  const s=withStudent({[AP]:'"do not erase"'}), p=page(s,'/lab02.html'), dialog=p.Lab.data.signOut();
  let finish;
  p.Lab.report.docx=()=>new Promise(resolve=>{finish=resolve;});
  const pending=wordButton(dialog).click();
  dialog.querySelector('.dm-cancel').click();
  finish(new Blob(['old report'])); await pending;
  assert.equal(p.downloads.length,0);
  assert.equal(s.getItem(AP),'"do not erase"');
  assert.deepEqual(p.nav,[]);
});

test('a Word build from a cleared workspace cannot download after the device is handed off',async()=>{
  const s=withStudent({[AP]:'"first student answer"'}), p=page(s,'/lab02.html'), dialog=p.Lab.data.signOut();
  let finish;
  p.Lab.report.docx=()=>new Promise(resolve=>{finish=resolve;});
  const pending=wordButton(dialog).click();
  const other=page(s); confirm(other.Lab.data.signOut());
  const next=page(s); assert.equal(next.Lab.identity.set(NEW),true);
  s.setItem(AP,'"next student answer"');
  finish(new Blob(['old report'])); await pending;
  assert.equal(p.downloads.length,0);
  assert.equal(s.getItem(AP),'"next student answer"');
  assert.match(dialog.querySelector('.tool-status').textContent,/cleared in another tab/);
});

test('the Word report captures visible answers and its teacher data before chart rendering yields',async()=>{
  // Execute the shipped Word method with controllable I/O to isolate the race.
  const method=source.match(/    async docx\(o = \{\}\) \{[\s\S]*?\},\r?\n    docxUrls:/)?.[0].split('    docxUrls:')[0];
  assert.ok(method);
  let answer='First measurement: 7.1', name='First Student', release, isRendering=false;
  const hold=new Promise(resolve=>{release=resolve;});
  const output=vm.runInNewContext('({'+method+'})',{
    flushSaves:()=>{}, peerLabChange:false,
    collectReport:()=>({answer,name}),
    progressPayload:()=>({data:{answer},student:{name}}),
    makeResumeCode:async payload=>JSON.stringify(payload),
    renderCharts:async rep=>{isRendering=true;await hold;return rep;},
    reportStamp:()=>null, tlInclude:()=>false, withNativeRandom:fn=>fn(), buildDocx:rep=>rep,
  }).docx();
  assert.equal(isRendering,true);
  answer='Corrected measurement: 7.2'; name='Corrected Student';
  release();
  const rep=await output, embedded=JSON.parse(rep.embed);
  assert.equal(rep.answer,'First measurement: 7.1');
  assert.equal(rep.name,'First Student');
  assert.equal(embedded.data.answer,rep.answer);
  assert.equal(embedded.student.name,rep.name);
});

test('single-lab Start over must not let an already-open copy put erased work back',()=>{
  const s=withStudent({[AP]:'"old reading 7.1"'});
  const old=page(s,'/lab02.html'), reset=page(s,'/lab02.html'), sibling=page(s,'/lab05.html');
  const dialog=reset.Lab.data.startOverLab();
  unlockWordDialog(dialog.querySelector('#dm-startlab-gate'),null);
  dialog.querySelector('.dm-confirm').click();
  assert.equal(s.getItem(AP),null);
  assert.deepEqual(reset.nav,['reload']);
  sibling.Lab.store.set('answer','unrelated work');
  assert.equal(s.getItem('aplab:lab05:answer'),'"unrelated work"');
  old.Lab.store.set('answer','old reading from tab left open');
  assert.equal(s.getItem(AP),null);
});

test('single-lab Start over must not reload and signal success if storage refused the deletion',()=>{
  const extra='aplab:lab02:another-answer';
  const s=withStudent({[extra]:'"first answer"',[AP]:'"still saved"'}), p=page(s,'/lab02.html');
  s.blocked.remove=AP;
  const dialog=p.Lab.data.startOverLab();
  unlockWordDialog(dialog.querySelector('#dm-startlab-gate'),null);
  dialog.querySelector('.dm-confirm').click();
  assert.deepEqual(p.nav,[]);
  assert.equal(s.getItem(AP),'"still saved"');
  assert.equal(s.getItem(extra),'"first answer"');
  assert.match(dialog.querySelector('.tool-status').textContent,/Could not clear this lab/);
  delete s.blocked.remove;
  dialog.querySelector('.dm-confirm').click();
  assert.deepEqual(p.nav,['reload']);
  assert.equal(s.getItem(extra),null);
});

test('AP sign-out must recheck current-lab work after the downloaded copy',async()=>{
  const s=withStudent({[AP]:'"initial reading"'}), p=page(s,'/lab02.html'), other=page(s,'/lab02.html');
  const dialog=p.Lab.data.signOut();
  await dialog.querySelectorAll('button').find(b=>b.textContent==='Download progress file').click();
  // Stub the browser storage iteration APIs for the actual payload, as in browser localStorage.
  const olderFile=await parse(p.downloads[0]);
  assert.equal(olderFile.data.answer,'initial reading');
  other.Lab.store.set('answer','new reading added to the lab in another tab');
  confirm(dialog);
  confirm(dialog);
  assert.equal(s.getItem(AP),'"new reading added to the lab in another tab"');
  assert.equal(dialog.querySelector('.dm-confirm').disabled,true);
  dialog.querySelector('.dm-cancel').click();
  const refreshed=p.Lab.data.signOut();
  await refreshed.querySelectorAll('button').find(b=>b.textContent==='Download progress file').click();
  assert.equal((await parse(p.downloads[1])).data.answer,'new reading added to the lab in another tab');
  confirm(refreshed);
  assert.equal(s.getItem(AP),null);
});

test('AP sign-out must not erase a new OpenSciEd response after the backup starts',async()=>{
  const s=withStudent({[MIG]:migWork('initial observation')}), p=page(s,'/ap-biology.html');
  const dialog=p.Lab.data.signOut();
  await dialog.querySelector('.dm-openscied-backup').click();
  assert.deepEqual((await parse(p.downloads[0])).work[MIG],JSON.parse(migWork('initial observation')));
  const activity=guard.open(s,'b1-migration',[MIG]);
  assert.equal(activity.write(MIG,migWork('new observation')).ok,true);
  confirm(dialog);
  assert.equal(s.getItem(MIG),migWork('new observation'));
});

test('a lab reset refuses to delete anything if it cannot invalidate the other tabs',()=>{
  const s=withStudent({[AP]:'"keep this answer"'}), p=page(s,'/lab02.html');
  s.blocked.set='aplab:pref:ap-lab-reset:v1:lab02';
  const dialog=p.Lab.data.startOverLab();
  unlockWordDialog(dialog.querySelector('#dm-startlab-gate'),null);
  dialog.querySelector('.dm-confirm').click();
  assert.equal(s.getItem(AP),'"keep this answer"');
  assert.match(dialog.querySelector('.tool-status').textContent,/Could not clear this lab/);
  assert.deepEqual(p.nav,[]);
});

test('a scoped restart allows fresh work and cannot be overwritten by a tab open before the restart',()=>{
  const s=withStudent({[AP]:'"old answer"'}), p=page(s,'/lab02.html');
  const stale=page(s,'/lab02.html'), d=p.Lab.data.startOverLab();
  unlockWordDialog(d.querySelector('#dm-startlab-gate'),null);
  d.querySelector('.dm-confirm').click();
  const fresh=page(s,'/lab02.html');
  fresh.Lab.store.set('answer','new answer after reset');
  stale.Lab.store.set('answer','old answer from earlier tab');
  assert.throws(()=>stale.Lab.progressFile.payload(),/cleared in another tab/);
  assert.equal(s.getItem(AP),'"new answer after reset"');
});

test('an untouched field cannot overwrite a newer answer while a backup flushes pending edits',()=>{
  const s=withStudent({'aplab:lab02:field:measurement':'"old reading"'}), p=page(s,'/lab02.html');
  const field=p.el('textarea');
  field.dataset={save:'measurement'};
  field.closest=()=>null;
  p.Lab.bindAutosave({querySelectorAll:()=>[field]});
  assert.equal(field.value,'old reading');
  s.setItem('aplab:lab02:field:measurement','"newer reading from another tab"');
  assert.equal(p.Lab.progressFile.payload().data['field:measurement'],'newer reading from another tab');
  field.value='typed in this tab but timer has not run'; field.trigger('input');
  assert.equal(p.Lab.progressFile.payload().data['field:measurement'],'typed in this tab but timer has not run');
});

test('a tab open before a scoped reset must not restore over fresh answers',()=>{
  const key='aplab:lab02:field:model',s=withStudent({[key]:'"before reset"'}),old=page(s,'/lab02.html'),p=page(s,'/lab02.html');
  const file=backupFor(old,OLD);
  const reset=p.Lab.data.startOverLab();
  unlockWordDialog(reset.querySelector('#dm-startlab-gate'),null);
  reset.querySelector('.dm-confirm').click();
  const fresh=page(s,'/lab02.html');
  fresh.Lab.store.set('field:model','fresh work after restart');
  let denied=false;
  try { old.Lab.progressFile.apply(file); } catch(e) { denied=/cleared in another tab/.test(e.message); }
  assert.equal(s.getItem(key),'"fresh work after restart"');
  assert.equal(denied,true);
  assert.deepEqual(old.nav,[]);
});

test('an older AP lab tab cannot overwrite a successfully restored answer',()=>{
  const key='aplab:lab02:field:model',s=withStudent({[key]:'"old tab value"'}),old=page(s,'/lab02.html'),p=page(s,'/lab02.html');
  p.Lab.progressFile.apply(backupFor(p,OLD));
  assert.equal(s.getItem(key),'"restored AP work"');
  old.Lab.store.set('field:model','old tab autosave after restore');
  assert.equal(s.getItem(key),'"restored AP work"');
});

test('a failed storage removal must not report an AP restore as cleanly replaced',()=>{
  const extra='aplab:lab02:field:unrelated-old', model='aplab:lab02:field:model';
  const s=withStudent({[extra]:'"old-only answer"',[model]:'"previous work"'}),p=page(s,'/lab02.html');
  s.blocked.remove=extra;
  let failed=false;
  try { p.Lab.progressFile.apply(backupFor(p,OLD)); } catch(e) { failed=true; }
  assert.equal(s.getItem(extra),'"old-only answer"');
  assert.equal(s.getItem(model),'"previous work"');
  assert.deepEqual(p.nav,[]);
  assert.equal(failed,true);
});

test('an older AP handoff dialog cannot download another student’s work for a different lab',async()=>{
  const lab05='aplab:lab05:field:answer',s=withStudent({[lab05]:'"first student previous work"'}),p=page(s,'/ap-biology.html');
  const dialog=p.Lab.data.signOut();
  const btn=dialog.querySelectorAll('button').find(el=>el.attributes['aria-label']==='Download progress file for Lab 5');
  assert.ok(btn);
  confirm(page(s).Lab.data.signOut());
  const fresh=page(s); assert.equal(fresh.Lab.identity.set(NEW),true);
  page(s,'/lab05.html').Lab.store.set('field:answer','next student Lab 5 work');
  btn.click();
  if(p.downloads.length) {
    const file=await parse(p.downloads[0]);
    assert.equal(file.student.name,OLD.name);
    assert.equal(file.data['field:answer'],'first student previous work','the old download contains a newer student’s answer');
  }
  assert.equal(p.downloads.length,0);
});

test('a restore confirmation must be renewed if peer work changes while it is open',()=>{
  const key='aplab:lab02:field:model',s=withStudent({[key]:'"current work"'}),p=page(s,'/lab02.html'),peer=page(s,'/lab02.html');
  const file=backupFor(p,OLD), pending=p.Lab.progressFile.question(file);
  peer.Lab.store.set('field:model','newer peer answer');
  let denied=false;
  try { p.Lab.progressFile.apply(file,pending.version); } catch(e) { denied=/Saved work changed/.test(e.message); }
  assert.equal(s.getItem(key),'"newer peer answer"');
  assert.equal(denied,true);
  assert.deepEqual(p.nav,[]);
  const reviewed=p.Lab.progressFile.question(file);
  p.Lab.progressFile.apply(file,reviewed.version);
  assert.equal(s.getItem(key),'"restored AP work"');
  assert.deepEqual(p.nav,['reload']);
});

test('a rejected restore write rolls back both overwritten and removed answers',()=>{
  const extra='aplab:lab02:field:extra', model='aplab:lab02:field:model', rejected='aplab:lab02:field:write-blocked';
  const s=withStudent({[extra]:'"before restore, only"',[model]:'"before restore"'}),p=page(s,'/lab02.html');
  s.blocked.set=rejected;
  const file=backupFor(p,OLD); file.data['field:write-blocked']='new answer';
  assert.throws(()=>p.Lab.progressFile.apply(file),/Nothing on this computer was changed/);
  assert.equal(s.getItem(extra),'"before restore, only"');
  assert.equal(s.getItem(model),'"before restore"');
  assert.equal(s.getItem(rejected),null);
  assert.deepEqual(p.nav,[]);
});

test('AP Word export does not combine a stale visible answer with newer data from an ordinary peer edit',async()=>{
  // Use actual field binding, collection, encoding and decoding; return the
  // Word builder's input to observe both reports without loading an external renderer.
  const reportSource=source
    .replace('async function renderCharts(rep) {','async function renderCharts(rep) { return rep;')
    .replace('async function buildDocx(rep) {','async function buildDocx(rep) { return rep;');
  assert.notEqual(reportSource,source);
  assert.ok(reportSource.includes('async function buildDocx(rep) { return rep;'));
  const key='aplab:lab02:field:measurement',s=withStudent({[key]:'"first answer displayed"'});
  const p=page(s,'/lab02.html',undefined,reportSource);
  const field=p.el('textarea');field.dataset={save:'measurement',label:'Measurement'};field.closest=()=>null;field.matches=()=>false;
  const section=p.el('section');
  section.dataset={step:'Analyze'};section.querySelectorAll=()=>[field];
  p.doc.querySelectorAll=sel=>sel==='section.step'?[section]:[];
  p.Lab.bindAutosave(section);
  assert.equal(field.value,'first answer displayed');
  page(s,'/lab02.html').Lab.store.set('field:measurement','newer answer saved elsewhere');
  let rep;
  try { rep=await p.Lab.report.docx({timelapse:false}); }
  catch(e) { if(/changed.*another tab/i.test(e.message)) rep=null; else throw e; }
  if (rep) {
    const embedded=await p.Lab.progressFile.readCode(rep.embed);
    assert.equal(rep.sections[0].items[0].a,embedded.data['field:measurement']);
  }
  assert.equal(s.getItem(key),'"newer answer saved elsewhere"');
  // Reopening the lab reads the latest answer in both parts of the export.
  field.value='newer answer saved elsewhere';
  const reloaded=page(s,'/lab02.html',undefined,reportSource);
  reloaded.doc.querySelectorAll=p.doc.querySelectorAll;
  const reviewed=await reloaded.Lab.report.docx({timelapse:false});
  const embedded=await reloaded.Lab.progressFile.readCode(reviewed.embed);
  assert.equal(reviewed.sections[0].items[0].a,'newer answer saved elsewhere');
  assert.equal(embedded.data['field:measurement'],reviewed.sections[0].items[0].a);
});

test('device-wide sign-out cannot lose AP answers just because a later storage deletion is blocked',()=>{
  const s=withStudent({[AP]:'"saved AP answer"',[MIG]:migWork('saved evidence')});
  s.blocked.remove=MIG;
  const p=page(s,'/ap-biology.html');
  const d=p.Lab.data.signOut();confirm(d);
  assert.deepEqual(p.nav,[]);
  assert.equal(JSON.parse(s.getItem('aplab:student')).name,OLD.name);
  assert.match(d.querySelector('.tool-status').textContent,/Could not finish clearing/);
  assert.equal(s.getItem(AP),'"saved AP answer"');
});

test('dashboard-wide OpenSciEd clear cannot lose one activity if storage blocks clearing another',()=>{
  const s=withStudent({[MIG]:migWork('notes from migration'),[GAME]:'{"answer":"board evidence"}'}),d=dashboard(s);
  s.blocked.remove=MIG;
  d.el('clear-openscied-results').click(); dashboardConfirm(d);
  assert.match(d.el('openscied-clear-error').textContent,/Could not clear/);
  assert.equal(s.getItem(MIG),migWork('notes from migration'));
  assert.equal(s.getItem(GAME),'{"answer":"board evidence"}');
});

test('bulk erase restores AP and OpenSciEd records if the final sign-out removal fails',()=>{
  const s=withStudent({[AP]:'"AP evidence"',[MIG]:migWork('companion evidence')});
  s.blocked.remove='aplab:student';
  const p=page(s,'/ap-biology.html'),dialog=p.Lab.data.signOut();confirm(dialog);
  assert.deepEqual(p.nav,[]);
  assert.deepEqual(JSON.parse(s.getItem('aplab:student')),OLD);
  assert.equal(s.getItem(AP),'"AP evidence"');
  assert.equal(s.getItem(MIG),migWork('companion evidence'));
  assert.match(dialog.querySelector('.tool-status').textContent,/saved work was kept/);
  delete s.blocked.remove;
  dialog.querySelector('.dm-confirm').click();
  assert.deepEqual(p.nav,['reload']);
});

test('Start over all rolls back work if its new Dataset number cannot be saved',()=>{
  const first='aplab:dataset:lab01:first student|3', second='aplab:dataset:lab02:first student|3';
  const s=withStudent({[AP]:'"must survive"',[first]:'2',[second]:'2'});
  s.blocked.set=second;
  const p=page(s,'/ap-biology.html'),dialog=p.Lab.data.startOverAll();confirm(dialog,'startover','ERASE');
  assert.deepEqual(p.nav,[]);
  assert.equal(s.getItem(AP),'"must survive"');
  assert.equal(s.getItem(first),'2');
  assert.equal(s.getItem(second),'2');
  assert.match(dialog.querySelector('.tool-status').textContent,/saved work was kept/);
});

test('OpenSciEd distinguishes a kept copy from a rollback it could not finish',()=>{
  const s=withStudent({[MIG]:migWork('blocked'),[GAME]:'{"old":"record"}'}), d=dashboard(s);
  s.blocked.remove=MIG; s.blocked.set=GAME;
  d.el('clear-openscied-results').click(); dashboardConfirm(d);
  assert.equal(s.getItem(GAME),null);
  assert.equal(s.getItem(MIG),migWork('blocked'));
  assert.match(d.el('openscied-clear-error').textContent,/records could not be put back/);
  assert.equal(d.el('confirm-openscied-clear').disabled,true);
});
