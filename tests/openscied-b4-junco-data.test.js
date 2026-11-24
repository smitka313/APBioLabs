'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const data = require('../openscied-b4-junco-data.js');

function pearson(rows) {
  const n=rows.length;
  const sx=rows.reduce((total,row)=>total+row.x,0);
  const sy=rows.reduce((total,row)=>total+row.y,0);
  const sxy=rows.reduce((total,row)=>total+row.x*row.y,0);
  const sxx=rows.reduce((total,row)=>total+row.x**2,0);
  const syy=rows.reduce((total,row)=>total+row.y**2,0);
  return (n*sxy-sx*sy)/Math.sqrt((n*sxx-sx**2)*(n*syy-sy**2));
}

test('the field data retain Atwell Figure 1 means and sample sizes for both conditions',()=>{
  const {rows,note,url,unit}=data.field;
  assert.equal(unit,'m');
  assert.match(note,/approximate means/i);
  assert.match(url,/#fig1$/);
  assert.deepEqual(rows.map(({group,site,mean,n})=>[group,site,mean,n]),[
    ['foraging','mountain',13.5,24],['foraging','urban',4.2,30],
    ['incubating','mountain',0.99,17],['incubating','urban',0.36,11]
  ]);
});

test('the aviary data retain the Fig. 3 signed scores, sample sizes, and early-life caveat',()=>{
  const {rows,note,url,unit}=data.aviary;
  assert.match(unit,/PC1/i);
  assert.match(note,/early.life and parental effects/i);
  assert.match(url,/#fig3$/);
  assert.deepEqual(rows.map(({group,site,mean,n})=>[group,site,mean,n]),[
    ['female','mountain',-0.65,10],['female','urban',-0.08,16],
    ['male','mountain',-0.32,13],['male','urban',0.8,15]
  ]);
});

test('the classroom CORT scatterplot is a documented digitization, with no invented origins',()=>{
  const {rows,note,url,xLabel,published}=data.cort;
  assert.equal(rows.length,40);
  assert.match(note,/digitized|reconstructed|approximate/i);
  assert.match(url,/^https:\/\//);
  assert.ok(rows.every(row=>Number.isFinite(row.x)&&Number.isFinite(row.y)&&row.site===null));
  assert.match(xLabel,/Maximum CORT \(ng\/mL\)/);
  const order=[...rows].sort((a,b)=>a.x-b.x);
  assert.deepEqual([order[0].x,order[0].y,order.at(-1).x,order.at(-1).y],[9.2,0.63,38.4,-0.84]);
  assert.ok(Math.abs(pearson(rows)+0.53285)<0.001);
  assert.equal(published.rSquared,0.21);
  assert.ok(Math.abs(pearson(rows)**2-published.rSquared)>0.05,
    'the digitized classroom correlation must remain distinct from the published adjusted result');
});

const flight = require('../openscied-b4-junco-flight.js');
test('walk-up trials are reproducible, use equal steps between sites, and report the crossed distance',()=>{
  const seed=23183, sums={};
  for(const group of ['foraging','incubating']){
    const increment=group==='foraging'?2:0.2;
    for(const site of ['urban','mountain']){
      let sum=0;
      const outcomes=new Set();
      for(let id=1;id<=64;id++){
        const limit=flight.threshold(seed,id,site,group,data.field.rows);
        const end=flight.endStep(seed,id,site,group,data.field.rows);
        const reading=flight.distance(group,end);
        assert.equal(end,flight.endStep(seed,id,site,group,data.field.rows));
        assert.ok(end>=1&&end<=10);
        assert.ok(reading<=limit&&limit<reading+increment+1e-9);
        outcomes.add(reading);sum+=reading;
      }
      assert.ok(outcomes.size>1);
      sums[group+site]=sum;
    }
    assert.ok(sums[group+'mountain']>sums[group+'urban']);
  }
});
test('flight notebook restores validated trials and exports them as simulations',()=>{
  const seed=491,site='mountain',group='foraging';
  const step=flight.endStep(seed,1,site,group,data.field.rows);
  const row={id:1,site,group,step};
  const saved=flight.clean({seed,serial:1,site,group,active:{...row,finished:true},results:[row,row,{...row,step:0}]},data.field.rows);
  assert.deepEqual(saved.results,[row]);
  assert.equal(saved.active.finished,true);
  assert.match(flight.report(saved).join('\n'),/SIMULATED WALK-UP TRIALS.*\nTrial 1:/);
});

const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const vm=require('node:vm');
const ROOT=process.env.JUNCO_SCENE_ROOT||join(__dirname,'..');
const source=name=>readFileSync(join(ROOT,name),'utf8');

test('the home-aviary cutaway repeats the same modeled controls and disclaims invented study details',()=>{
  const html=source('openscied-b4-junco.html');
  const scene=html.match(/<figure class="ju-aviary-art"[\s\S]*?<\/figure>/)?.[0];
  assert.ok(scene,'shared aviary should have an illustrated interactive cutaway');
  for(const part of ['room','bird','food','person']) {
    assert.equal([...scene.matchAll(new RegExp('<use href="#ju-av-'+part+'"','g'))].length,2,part+' is matched in two panels');
  }
  assert.match(scene,/UC San Diego[\s\S]*Mt\. Laguna/);
  assert.match(scene,/lived apart under matched conditions/);
  assert.match(scene,/not a map of the facility or a count/);
  assert.match(html,/measured how quickly and widely each bird explored a test room/);
  assert.match(html,/field walk-up measured a different behavior/);
  assert.match(html,/these birds were collected after hatching/i);
});

test('inspecting a matched control and replay do not persist or reveal results',()=>{
  const js=source('openscied-b4-junco.js');
  const code=js.match(/  function wireAviaryScene\(\)\{[\s\S]*?\n  \}\n  wireAviaryScene\(\);/)?.[0];
  assert.ok(code,'scene must wire its controls');
  const changes=[];
  let reduced=true;
  const mock=attrs=>({dataset:attrs,attrs:{},handlers:{},setAttribute(k,v){this.attrs[k]=v;},addEventListener(k,f){this.handlers[k]=f;}});
  const controls=['housing','food','people'].map(aviaryControl=>mock({aviaryControl}));
  const art={...mock({control:'housing'}),querySelectorAll:()=>controls,classList:new Set(),offsetWidth:540};
  art.classList.remove=art.classList.delete.bind(art.classList);
  const detail={replaceChildren(...args){this.text=args.join('');}};
  const replay=mock({});
  const elements={'aviary-art':art,'aviary-detail':detail,'aviary-replay':replay};
  const context={$:k=>elements[k],mk:(_,s)=>s,document:{createTextNode:s=>s},window:{matchMedia:()=>({matches:reduced})},say:s=>changes.push(s)};
  vm.runInNewContext(code,context);
  controls[1].handlers.click();
  assert.equal(art.dataset.control,'food');
  assert.deepEqual(controls.map(b=>b.attrs['aria-pressed']),['false','true','false']);
  assert.match(detail.text,/home aviaries/);
  assert.match(detail.text,/wood shavings, not food/);
  replay.handlers.click();
  assert.equal(art.dataset.control,'people');
  assert.equal(art.classList.has('is-replaying'),false,'reduced-motion preference is honored');
  assert.match(changes.at(-1),/illustrates that control, not the birds’ measured behavior/);
  reduced=false;
  replay.handlers.click();
  assert.equal(art.classList.has('is-replaying'),true);
  art.handlers.animationend({animationName:'ju-aviary-routine'});
  assert.equal(art.classList.has('is-replaying'),false);
});
