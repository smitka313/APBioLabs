'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const M=require('../openscied-b1-field-notebook-logic.js');

test('five unique stations with lesson source references, and no automatic evidence on entry',()=>{
  assert.deepEqual(M.stations.map(s=>s.id),['habitats','biodiversity','movement','conservation','people']);
  assert.equal(new Set(M.stations.map(s=>s.place)).size,5);
  assert.ok(M.stations.every(s=>s.evidence && s.prompt && M.references[s.id]));
  assert.deepEqual(M.progress(M.clean(null)),{questions:false,used:0,evidence:false,ready:false,complete:false,started:false,done:0});
});

test('every station has a matching illustrated plate and a distinct plain-text caption',()=>{
  for(const {id} of M.stations){
    const asset=fs.readFileSync(path.join(__dirname,'../assets/serengeti-field-station-'+id+'.svg'),'utf8');
    assert.match(asset,/<svg[^>]+viewBox="0 0 560 200"/);
    const ids=new Set([...asset.matchAll(/\bid="([\w-]+)"/g)].map(m=>m[1]));
    for(const match of asset.matchAll(/(?:href="#|url\(#)([\w-]+)/g)){
      assert.ok(ids.has(match[1]),'SVG reference must be local: '+id+'/'+match[1]);
    }
    assert.doesNotMatch(asset,/href="(?!#)/);
  }
  const captions=M.stations.map(s=>s.artCaption);
  assert.ok(captions.every(c=>typeof c==='string'&&c.length>40));
  assert.equal(new Set(captions).size,captions.length);
});

test('duplicate questions do not unlock stations, and a note plus pin on one station counts once',()=>{
  const s=M.clean({v:1,fields:{question1:'Who decided?',question2:' who decided? ',movement:'Herds moved beyond the park.'},
    pins:['movement','movement','nope'],finished:true});
  assert.equal(M.progress(s).questions,false);
  assert.equal(M.progress(s).used,1);
  s.fields.question2='What did researchers notice?';
  assert.equal(M.progress(s).evidence,false);
  s.pins.push('people');
  assert.equal(M.progress(s).evidence,true);
  assert.equal(M.progress(s).complete,false);
});

test('completion requires two distinct stations, a claim, a question, and Finish',()=>{
  const s=M.clean({v:1,fields:{question1:'Why protect it?',question2:'What changed?',claim:'The herds left the park.',wonder:'Where did they head?'},pins:['movement','people']});
  assert.equal(M.progress(s).done,2);
  assert.equal(M.progress(s).ready,true);
  s.finished=true;assert.equal(M.progress(s).done,3);
  assert.equal(M.progress(M.clean(JSON.parse(JSON.stringify(s)))).complete,true);
  s.pins.pop();assert.equal(M.progress(s).complete,false);
});

test('malformed work is not treated as empty and unknown fields do not affect the notebook',()=>{
  assert.throws(()=>M.clean({v:1,fields:[]}),/Invalid notebook/);
  assert.throws(()=>M.clean({v:99,fields:{}}),/Invalid notebook/);
  const s=M.clean({v:1,fields:{unrelated:'unknown',wonder:'€'.repeat(2000)}, step:'missing'});
  assert.deepEqual(Object.keys(s.fields),['wonder']);
  assert.equal(s.fields.wonder.length,M.limit);
  assert.equal(s.step,'orient');
});

test('all four original videos are optional, caption-preferred in-page players with a fallback',()=>{
  const html=fs.readFileSync(path.join(__dirname,'../openscied-b1-field-notebook.html'),'utf8');
  const ids=['Pg35n6elF3Y','iPyB3Gw6fBY','7JOk6ivcuco','cVj4883yzeO'];
  const frames=[...html.matchAll(/<template><iframe[^>]+\/embed\/([\w-]+)\?cc_load_policy=1[^>]*><\/iframe><\/template>/g)].map(m=>m[1]);
  assert.deepEqual(frames,ids);
  ids.forEach(id=>assert.ok(html.includes('https://youtu.be/'+id+'"')));
});

test('exhibits retain provenance, preserve earlier pins and count distinct stations',()=>{
  const old=M.clean({v:1,fields:{question1:'Why protect this land?',question2:'What changed?'},pins:['people']});
  assert.deepEqual(M.pinList(old,'people'),[0],'legacy station pin remains visible on the first exhibit');
  assert.equal(M.togglePin(old,'people',1),true);
  assert.deepEqual(M.pinList(old,'people'),[0,1]);
  assert.equal(M.progress(old).used,1);
  assert.equal(M.togglePin(old,'movement',3),true);
  assert.equal(M.progress(old).evidence,true);
  assert.equal(M.togglePin(old,'people',0),false);
  assert.deepEqual(M.pinList(M.clean(JSON.parse(JSON.stringify(old))),'people'),[1]);
  assert.ok(Object.values(M.exhibits).every(group=>group.length>=3&&group.every(c=>c[2])));
  assert.equal(new Set(M.months.map(m=>m[0])).size,12);
});

test('all activity element lookups resolve to unique HTML IDs or explicit generated fields',()=>{
  const files=['openscied-b1-field-notebook.html','openscied-b1-field-notebook.js'];
  const [html,js]=files.map(f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8'));
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
  assert.equal(new Set(ids).size,ids.length);
  for(const m of js.matchAll(/\$\('([a-z-]+)'\)/g))assert.ok(ids.includes('sf-'+m[1]),'Missing element: '+m[1]);
});

test('the real activity script initializes and drives exhibits and map controls from the HTML contract',()=>{
  const vm=require('node:vm');
  const raw=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
  const source=raw('openscied-b1-field-notebook.html');
  const data={};
  const storage={getItem:k=>data[k]??null,setItem:(k,v)=>{data[k]=v;},removeItem:k=>delete data[k]};
  const entries=[];
  function el(attrs={}){
    const dataset=Object.fromEntries(Object.keys(attrs).filter(k=>k.startsWith('data-')).map(k=>[k.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase()),attrs[k]]));
    const e={attrs,dataset,mounted:Object.keys(attrs).length>0,style:{setProperty(){}},hidden:Object.hasOwn(attrs,'hidden'),value:attrs.id==='sf-boundary'?'both':'',
      children:[],events:{},append(...a){a.forEach(n=>{n.mounted=true});this.children.push(...a);},replaceChildren(...a){this.children.forEach(n=>{n.mounted=false});a.forEach(n=>{n.mounted=true});this.children=a;},
      setAttribute(k,v){this.attrs[k]=String(v);},toggleAttribute(k,v){if(v)this.attrs[k]='';else delete this.attrs[k];},
      focus(){},addEventListener(k,fn){this.events[k]=fn;},showModal(){this.open=true;},close(){this.open=false;},
      cloneNode(){return el({...this.attrs});},removeAttribute(k){delete this.attrs[k];}};
    entries.push(e);return e;
  }
  const ids={};
  for(const m of source.matchAll(/<([a-z][a-z0-9-]*)\b([^<>]*)>/gi)){
    const attrs=Object.fromEntries([...m[2].matchAll(/([\w-]+)(?:="([^"]*)")?/g)].map(a=>[a[1],a[2]??'']));
    if(attrs.id||Object.keys(attrs).some(k=>k.startsWith('data-'))||attrs.class?.includes('sf-map-visual')){
      const n=el(attrs);if(attrs.id)ids[attrs.id]=n;
    }
  }
  const element=id=>ids['sf-'+id];
  const match=(e,css)=>{
    const m=css.match(/^\[data-([a-z-]+)\]$/);
    if(m)return Object.hasOwn(e.dataset,m[1].replace(/-([a-z])/g,(_,c)=>c.toUpperCase()));
    return css==='.sf-map .sf-map-visual'&&e.attrs.class?.includes('sf-map-visual');
  };
  let collect;
  const doc={createElement:()=>el(),getElementById:id=>ids[id],querySelector:sel=>entries.find(n=>match(n,sel)),
    querySelectorAll:sel=>entries.filter(n=>n.mounted&&sel.split(',').some(q=>match(n,q)))};
  const window={SerengetiFieldNotebook:M,OpenSciEdSaveSession:require('../openscied-save-session.js'),
    OpenSciEdSubmission:{mount(c){collect=c.collect;}},addEventListener(){}};
  vm.runInNewContext(raw('openscied-b1-field-notebook.js'),{window,document:doc,localStorage:storage,location:{reload(){}}});
  assert.equal(element('stations').children.length,5);
  assert.equal(typeof collect,'function');
  for(const [key,value] of [['question1','What changed?'],['question2','Why?']]){
    const n=element(key);n.value=value;n.events.input();
  }
  M.stations.forEach((st,i)=>{
    element('stations').children[i].onclick();
    assert.equal(element('art').attrs.src,'assets/serengeti-field-station-'+st.id+'.svg');
    assert.equal(element('art-caption').textContent,st.artCaption);
  });
  element('stations').children[2].onclick();
  assert.match(element('map-caption').textContent,/Jan:/);
  element('month').value='9';element('month').onchange();
  assert.match(element('map-caption').textContent,/Oct: Maasai Mara/);
  element('exhibits').children[1].onclick();element('pin').onclick();
  element('stations').children[4].onclick();element('pin').onclick();
  const report=collect();
  assert.match(JSON.stringify(report.sections),/800–1,000 km/);
  assert.match(JSON.stringify(report.sections),/Nata elder/);
  assert.deepEqual(JSON.parse(data['aplab:openscied:b1-field-notebook:v1']).pinnedCards,{movement:[1],people:[0]});
  assert.match(element('collected').textContent,/2 of 2 stations collected/);
  element('stations').children[3].onclick();
  assert.ok(element('pin').disabled);
  assert.doesNotMatch(element('exhibit-text').textContent,/farther southeast/);
  entries.find(n=>n.dataset.boundaryPick==='west').onclick();
  assert.ok(element('pin').disabled);
  assert.match(element('map-observation').textContent,/overlap/);
  entries.find(n=>n.dataset.boundaryPick==='north').onclick();
  assert.equal(element('boundary-marker').attrs.cx,'392');
  assert.equal(element('pin').disabled,false);
  assert.match(element('exhibit-text').textContent,/farther southeast/);
  element('pin').onclick();
  entries.find(n=>n.dataset.go==='explain').onclick();
  assert.deepEqual(element('question-recap').children.map(n=>n.textContent),['What changed?','Why?']);
  assert.match(JSON.stringify(collect().sections),/Area I marked.*North, near the Kenya border/);
});
