'use strict';
const test=require('node:test'), assert=require('node:assert/strict');
const R=require('../serengeti-field-report'), L=require('../serengeti-logic'), {BOARD}=require('../serengeti-scene');

test('four snapshots use the exact encoded official ranges and no predator cells as active grazing squares',()=>{
  for (const [index,size,grazingCount] of [[0,37,25],[1,36,22],[2,30,21],[3,49,29]]) {
    const snap=R.seasonSnapshot(index);
    assert.equal(snap.cols,17);assert.equal(snap.rows,21);
    assert.equal(snap.range.length,size);assert.equal(snap.grazing.length,grazingCount);
    assert.deepEqual(snap.range,BOARD.flat().filter(c=>c.season===index));
    assert.ok(snap.grazing.every(c=>c.season===index&&!c.territory));
  }
  assert.throws(()=>R.seasonSnapshot(4),RangeError);
});

test('report uses records and season net changes, not assumed absolute herd counts',()=>{
  assert.deepEqual(R.summarize(null).seasons.map(s=>s.status),Array(4).fill('Not started'));
  let game=L.create(32737);
  for(const type of ['migrate','draw','resolveCard']) game=L.act(game,{type});
  const report=R.summarize(game);
  assert.equal(report.seasons[0].status,'In progress');
  assert.equal(report.seasons[0].start,0);
  assert.deepEqual(report.seasons[0].records.map(r=>r.kind),['migration','card']);
  assert.equal(report.seasons[1].delta,null);
  while(L.phase(game).kind!=='complete'){
    const p=L.phase(game);
    const type={migration:'migrate',card:p.card?'resolveCard':'draw',hyenaMove:'beginHunts',lionMove:'beginHunts',hunt:'roll',seasonEnd:'nextSeason'}[p.kind];
    game=L.act(game,{type});
  }
  const finished=R.summarize(game);
  assert.ok(finished.totalChange<=0);
  assert.deepEqual(finished.seasons.map(s=>s.status),Array(4).fill('Complete'));
  assert.equal(finished.seasons.reduce((n,s)=>n+s.delta,0),finished.totalChange);
  for(const season of finished.seasons) {
    assert.equal(season.cardChange+season.huntChange,season.delta);
    assert.equal(season.records.filter(r=>r.kind==='card').length,3);
    assert.ok(season.records.every(r=>r.season===season.index));
  }
});

test('mounted season and record filters remain interactive without mutating the game',()=>{
  let focus=null;
  class Element {
    constructor(tag){this.tag=tag;this.children=[];this.attrs={};this.dataset={};this.events={};}
    append(...nodes){this.children.push(...nodes);}
    setAttribute(k,v){this.attrs[k]=String(v);}
    replaceChildren(...nodes){this.children=nodes;}
    addEventListener(name,callback){this.events[name]=callback;}
    focus(){focus=this;}
  }
  function find(node,predicate) {
    if(predicate(node))return node;
    for(const child of node.children||[]){const item=find(child,predicate);if(item)return item;}
  }
  const prior=global.document;
  global.document={createElement:tag=>new Element(tag),createElementNS:(_,tag)=>new Element(tag),
    createTextNode:textContent=>({textContent})};
  try {
    const root=new Element('main'), selected=[];
    const result=R.mount(root,{onEvidence:i=>selected.push(i)});
    let game=L.create(32737);
    for(const type of ['migrate','draw','resolveCard'])game=L.act(game,{type});
    const raw=JSON.stringify(game);
    result.update(game);
    const button=i=>find(root,n=>n.className==='sg-field-season'&&Number(n.dataset.season)===i);
    const filter=kind=>find(root,n=>n.dataset?.filter===kind);
    assert.equal(button(0).attrs['aria-pressed'],'true');
    filter('hunt').events.click();
    assert.equal(filter('hunt').attrs['aria-pressed'],'true');
    assert.match(find(root,n=>n.className==='sg-field-empty').textContent,/No matching records/);
    filter('card').events.click();
    assert.equal(find(root,n=>n.className==='sg-field-ledger').children.length,1);
    assert.equal(find(root,n=>n.textContent==='A hyena cub survives').textContent,'A hyena cub survives');
    button(0).events.keydown({key:'End',preventDefault(){}});
    assert.equal(button(3).attrs['aria-pressed'],'true');
    assert.equal(focus,button(3));
    assert.match(find(root,n=>n.className==='sg-field-empty').textContent,/Play this season/);
    button(1).events.click();
    assert.deepEqual(selected,[3,1]);
    assert.equal(button(1).attrs['aria-pressed'],'true');
    assert.equal(JSON.stringify(game),raw);
  } finally {
    if(prior===undefined)delete global.document;
    else global.document=prior;
  }
});
