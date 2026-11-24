'use strict';
const assert=require('node:assert/strict');
const test=require('node:test');
const F=require('../carrying-field');
const Save=require('../openscied-save-session');

test('classroom scatter values are exactly the 20 nonblank source entries',()=>{
  assert.deepEqual(F.DATA.map(p=>[p.year,p.population]),[
    [1961,263362],[1963,356124],[1965,439124],[1967,483292],[1971,692777],
    [1972,773014],[1977,1400000],[1978,1248934],[1980,1337979],[1982,1208711],
    [1984,1337879],[1986,1146340],[1991,1221783],[1994,917204],[1999,1296944],
    [2000,1245222],[2003,1183966],[2006,1239164],[2009,1272233],[2012,1361548]
  ]);
  assert.equal(F.rate(1978,2004),null);
  assert.equal(F.rate(1993,1994),null);
  for(const no of [1960,1966,1993,1995,1996,1997,1998,2004])assert(!F.DATA.some(p=>p.year===no));
});
test('interval rates independently match signed endpoint differences',()=>{
  assert.deepEqual(F.TIME.slice(0,3).map(p=>p.id),['1961-1977','1977-1978','1978-2012']);
  assert.equal(F.rate(1961,1977).rate,(1400000-263362)/16);
  assert.equal(F.rate(1977,1978).rate,1248934-1400000);
  assert.equal(F.rate(1978,2012).rate,(1361548-1248934)/34);
  assert.equal(F.rate(2012,1978),null);
});
test('signed typed rates support standard formatting without quietly dropping a minus sign',()=>{
  assert.equal(F.parseRate('−151,066'),-151066);
  assert.equal(F.parseRate('+71,040'),71040);
  for(const bad of ['','--1','7,10','1e5','-','wrong','1.2.3'])assert.equal(F.parseRate(bad),null);
  assert.equal(F.checkRate('1961-1977','71039').code,'correct');
  assert.equal(F.checkRate('1961-1977','71040').code,'correct');
  assert.equal(F.checkRate('1977-1978','151066').code,'incorrect');
  assert.match(F.checkRate('1977-1978','151066').detail,/negative/);
  assert.equal(F.checkRate('1977-1978','−151,066').code,'correct');
  assert.match(F.checkRate('1978-2012','3312').detail,/1,361,548.*1,248,934.*34/);
  assert.match(F.checkRate('1978-2012','3312').hint,/within the interval/);
  assert.equal(F.checkRate('1978-2012','112614').code,'incorrect');
});
test('1999 is higher, but the beginning of the rebound is not known',()=>{
  assert.equal(F.checkGap('by-1999').code,'correct');
  assert.equal(F.checkGap('1998').code,'incorrect');
  assert.equal(F.checkGap('every-year').code,'incorrect');
  assert.match(F.checkGap('1998').detail,/cannot show when the rebound began or when the drought ended/);
  assert.equal(F.checkRate('1994-1999','75948'),null);
});

test('mounted activity keeps independent rates, checks, reasoning and reset on one key',()=>{
  const db=new Map();
  function fixture(){
    const listeners={}, nodes={};
    const localStorage={getItem:key=>db.get(key)??null,setItem:(key,value)=>db.set(key,value),removeItem:key=>db.delete(key)};
    const host={classList:{add(){}},ownerDocument:{defaultView:{localStorage}},innerHTML:'',
      querySelector(selector){return nodes[selector]??={dataset:{},focus(){}};},
      addEventListener(type,fn){listeners[type]=fn;}};
    const scope='b1-carrying-capacity';
    let session=Save.open(localStorage,scope,[F.key]);
    const api=F.mount(host,{getSaveSession:()=>session});
    const reset=()=>{
      // The page now erases its shared scope before resetting the mounted studies.
      assert.equal(session.check(F.key).ok,true);
      assert.equal(Save.erase(localStorage,scope,[F.key]).ok,true);
      session=Save.open(localStorage,scope,[F.key]);
      api.reset();
    };
    return {api,host,reset,change:(id,value,checked)=>listeners.change({target:{id,value,checked}}),
      input:(id,value)=>listeners.input({target:{id,value}}),
      check:()=>listeners.click({target:{closest:s=>s==='#cc-rate-check'}})};
  }
  let view=fixture();
  assert.equal((view.host.innerHTML.match(/data-field-year=/g)||[]).length,20);
  assert(!view.host.innerHTML.includes('id="cc-field-secant"'));
  view.input('cc-rate-answer','+71,040');
  view.input('cc-field-reasoning','The populations differ at the endpoints.');
  assert.equal(view.host.querySelector('#cc-rate-hint').hidden,true);
  view.check();
  assert.equal(view.host.querySelector('#cc-rate-feedback').dataset.fieldState,'correct');
  assert.equal(view.host.querySelector('#cc-rate-hint').hidden,false);
  view.change('cc-field-show-secant','on',true);
  assert(view.host.innerHTML.includes('id="cc-field-secant"'));
  view.change('cc-interval','1977-1978');
  view.input('cc-rate-answer','151066');view.check();
  assert.equal(view.host.querySelector('#cc-rate-feedback').dataset.fieldState,'incorrect');
  view.input('cc-rate-answer','-151066');
  assert.equal(view.host.querySelector('#cc-rate-feedback').dataset.fieldState,'unchecked');
  view.check();
  view.change('cc-interval','1994-1999');
  assert(!view.host.innerHTML.includes('id="cc-field-secant"'));
  view.change('cc-field-gap-choice','by-1999');
  view.check();
  view=fixture();
  assert.match(view.api.report(),/Student rate: \+71,040 wildebeest\/year/);
  assert.match(view.api.report(),/Reasoning: The populations differ/);
  assert.match(view.api.report(),/Student rate: -151066 wildebeest\/year/);
  assert.match(view.api.report(),/next plotted estimate was higher in 1999.*missing years do not show when the rebound began/);
  view.change('cc-interval','1961-1977');
  assert.match(view.host.innerHTML,/value="\+71,040"/);
  assert.equal(view.host.querySelector('#cc-rate-feedback').dataset.fieldState,'correct');
  view.reset();
  assert.equal(view.api.report(),'');
  assert(!db.has(F.key));
  db.set(F.key,'{bad record');
  view=fixture();view.input('cc-rate-answer','71,040');
  assert.equal(db.get(F.key),'{bad record');
});
