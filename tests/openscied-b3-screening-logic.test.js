'use strict';
const {test}=require('node:test'), assert=require('node:assert/strict'),M=require('../openscied-b3-screening-logic');
const mobile={screen:'mobile',machine:'mobile',operator:'mobile',rides:null};
test('matched designs hold case flags and patient resources fixed',()=>{
  for(let n=0;n<80;n++){
    const base=M.run(n,M.baseline),better=M.run(n,mobile);
    assert.equal(base.patients.length,30);
    assert.deepEqual(base.patients.map(p=>[p.id,p.means,p.hours,p.needed]),better.patients.map(p=>[p.id,p.means,p.hours,p.needed]));
    assert.equal(base.patients.filter(p=>p.needed).length,12);
    for(const r of [base,better]){
      assert.deepEqual([r.screened,r.referred,r.imaged,r.outlay],['screened','referred','imaged','outlay'].map(k=>r.areas.reduce((s,g)=>s+g[k],0)));
      for(const p of r.patients){
        assert.ok(p.paid<=p.means&&p.paid>=0);
        if(p.outcome==='imaged')assert.ok(p.needed&&p.scan.time<=p.hours&&p.paid===p.screen.total+p.scan.total);
        if(p.outcome==='follow-up-missed')assert.equal(p.paid,p.screen.total);
        if(p.outcome==='screen-missed')assert.equal(p.paid,0);
      }
    }
  }
  assert.notDeepEqual(M.cohort(0),M.cohort(1));
});
test('the seeded example reconciles independently and distinguishes money from time',()=>{
  const base=M.run(0,M.baseline);
  assert.deepEqual([base.screened,base.referred,base.imaged,base.clinic,base.outlay],[24,9,4,525,1131]);
  assert.deepEqual(base.costs,{screening:85,acquisition:260,maintenance:40,staffing:140,transport:0});
  const north=base.patients[0];
  const hrs=3+1+north.routeExtra;
  assert.equal(north.screen.time,hrs);
  assert.equal(north.screen.total,8+3*7+north.routeExtra*3+hrs*north.value);
  const assisted=M.run(0,{...M.baseline,rides:'hub'}).patients[0];
  assert.equal(assisted.screen.time,north.screen.time);
  assert.equal(assisted.screen.total,north.screen.total-13);
  const redesign=M.run(0,mobile);
  assert.ok(redesign.imaged>base.imaged);
  assert.equal(redesign.clinic,650);
});
test('co-location and budgets matter',()=>{
  assert.match(M.validate({...M.baseline,machine:'mobile'}),/same site/);
  assert.match(M.validate({...mobile,rides:'mobile'}),/over.*budget/i);
  assert.match(M.validate({...M.baseline,machine:null}),/Place the ultrasound/);
  assert.throws(()=>M.run(0,{...mobile,rides:'hub'}),RangeError);
  assert.throws(()=>M.run(-1,mobile),RangeError);
  assert.throws(()=>M.run(2**32,mobile),RangeError);
});
test('three stable randomized cases cover all towns and both care needs, with coherent incomes and distances',()=>{
  assert.notDeepEqual(M.scenarios(1),M.scenarios(2));
  const screeningOnlyTowns=new Set();
  for(let seed=0;seed<80;seed++){
    const cases=M.scenarios(seed);
    const base=M.run(seed,M.baseline), trial=M.run(seed,mobile);
    assert.deepEqual(cases,M.scenarios(seed));
    assert.deepEqual(cases.map(p=>p.place),M.places);
    assert.equal(cases.filter(p=>p.needed).length,2);
    screeningOnlyTowns.add(cases.find(p=>!p.needed).place);
    for(const p of cases){
      const a=base.patients[p.id-1],b=trial.patients[p.id-1];
      assert.equal(p.monthlyIncome*.02,p.means);
      assert.equal(a.needed,b.needed);
      assert.equal(a.needed,p.needed);
      assert.equal(a.screen.miles,p.distances.hub);
      assert.equal(b.screen.miles,p.distances.mobile);
      if(a.scan)assert.equal(a.scan.miles,p.distances.hub);
      if(b.scan)assert.equal(b.scan.miles,p.distances.mobile);
      const allowed=p.needed?'imaged':'screened';
      assert.equal(M.comparison(a,b),a.outcome===allowed?(b.outcome===allowed?'both':'base'):(b.outcome===allowed?'trial':'neither'));
    }
  }
  assert.equal(screeningOnlyTowns.size,3);
});
test('itemized route quotes include exact drives and same checkout rules as the simulation',()=>{
  const alternate={...M.baseline,machine:'mobile',operator:'mobile',rides:'mobile'};
  for(const seed of [0,1,20,2026]){
    for(const plan of [M.baseline,alternate]){
      for(const p of M.run(seed,plan).patients){
        const s=M.quote(p,plan.screen,'screen',plan);
        assert.deepEqual(s,p.screen);
        assert.equal(s.fee,8);
        assert.equal(s.total,s.fee+s.travel+s.timeCost);
        const first=M.checkout(s,p.means,p.hours);
        if(!first.ok){assert.equal(p.outcome,'screen-missed');assert.equal(first.remaining,p.means);continue;}
        if(!p.needed){assert.equal(p.outcome,'screened');assert.equal(first.remaining,p.means-p.paid);continue;}
        const f=M.quote(p,plan.machine,'scan',plan);
        assert.deepEqual(f,p.scan);
        assert.equal(f.fee,22);
        const second=M.checkout(f,first.remaining,p.hours);
        assert.equal(p.outcome,second.ok?'imaged':'follow-up-missed');
        assert.equal(second.remaining,p.means-p.paid);
      }
    }
  }
  assert.deepEqual(M.checkout({total:20,time:3},15,2),{ok:false,moneyShort:5,timeShort:1,remaining:15});
});
test('dispatch win counts patients newly reaching needed care minus patients losing it, and enforces the clinic cap',()=>{
  const mobile={...M.baseline,machine:'mobile',operator:'mobile'};
  const first=M.mission(M.run(1,M.baseline),M.run(1,mobile));
  assert.ok(first.won);
  assert.equal(first.helped.length-first.lost.length,3);
  assert.equal(first.left,105);
  const second=M.mission(M.run(2,M.baseline),M.run(2,mobile));
  assert.equal(second.won,false);
  assert.ok(second.helped.some(p=>p.id===18));
  assert.ok(second.lost.some(p=>p.id===29));
  const result=M.run(1,mobile);
  assert.equal(M.mission(M.run(1,M.baseline),{...result,clinic:M.budget+1}).won,false);
  assert.equal(M.mission(M.run(1,M.baseline),{...result,clinic:M.budget}).won,true);
});

test('fresh districts have a winning redesign; a legacy district can have a best attainable tie',()=>{
  assert.equal(M.bestGain(354),0);
  assert.equal(M.bestGain(78),2);
  const rolls=[354,78];
  assert.equal(M.guidedSeed(()=>rolls.shift()),78);
  assert.equal(M.guidedSeed(()=>354),1);
  for(let seed=0;seed<300;seed++){
    let next=seed;
    const chosen=M.guidedSeed(()=>next++);
    assert.ok(M.bestGain(chosen)>0);
  }
});
test('equity missions distinguish budgets and have one plan that helps both lower-income cases together',()=>{
  const plans=M.zones.flatMap(screen=>M.zones.flatMap(machine=>[null,...M.zones].map(rides=>
    ({screen,machine,operator:machine,rides})).filter(plan=>!M.validate(plan))));
  const start=(candidate)=>{let n=candidate;return M.equitySeed(()=>n++);};
  const seen=new Set(), approaches=new Set();
  for(let i=0;i<300;i++){
    const seed=start(i), trio=M.equityCases(seed);
    assert.deepEqual(M.equityCases(seed),trio);
    assert.deepEqual(trio.map(p=>p.z),[0,1,2]);
    seen.add(seed);
    const base=M.run(seed,M.baseline);
    assert.equal(trio.filter(p=>p.needed).length,2);
    const higher=trio.filter(p=>p.means>=100), lower=trio.filter(p=>p.means<=80);
    assert.equal(higher.length,1);assert.equal(lower.length,2);
    assert.equal(base.patients[higher[0].id-1].outcome,'imaged');
    for(const p of lower){
      assert.match(base.patients[p.id-1].outcome,/missed/);
      const total=M.quote(p,'hub','screen',M.baseline).total+(p.needed?M.quote(p,'hub','scan',M.baseline).total:0);
      assert.ok(total>p.means);
    }
    const winners=plans.filter(plan=>M.mission(base,M.run(seed,plan),trio).won);
    assert.ok(winners.length);
    winners.forEach(p=>approaches.add(JSON.stringify(p)));
    assert.equal(M.mission(base,base,trio).featuredComplete,1);
  }
  assert.ok(seen.size>30);
  assert.ok(approaches.size>2);
  assert.equal(M.equitySeed(()=>354),419);
  assert.equal(M.equityCases(419).length,3);
});
