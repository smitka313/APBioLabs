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
