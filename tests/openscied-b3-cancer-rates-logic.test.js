'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const data=require('../openscied-b3-cancer-rates-data.js');
const {sortRows,rankRows,fitLine,comparison}=require('../openscied-b3-cancer-rates-logic.js');
const find=(view,id)=>data[view].rows.find(row=>row.id===id);

test('2021 lesson figures remain two distinct top-ten lists with known missing categories',()=>{
  const rows=data.types.rows;
  assert.equal(rows.filter(row=>Number.isFinite(row.incidence)).length,10);
  assert.equal(rows.filter(row=>Number.isFinite(row.mortality)).length,10);
  assert.deepEqual([find('types','breast').incidence,find('types','lung').mortality],[133.8,29.9]);
  assert.equal(find('types','melanoma').mortality,null);
  assert.equal(find('types','breast').group,'female');
  assert.equal(find('types','prostate').group,'male');
});

test('rank ties share published rank while missing rates stay last in either sort direction',()=>{
  const rows=data.types.rows;
  const diagnosis=rankRows(rows,'incidence'), deaths=rankRows(rows,'mortality');
  assert.equal(diagnosis.breast,1);
  assert.equal(deaths.lung,1);
  assert.equal(deaths.breast,2);
  assert.equal(deaths.prostate,2);
  assert.equal(deaths.colorectal,4);
  assert.equal(Object.hasOwn(deaths,'melanoma'),false);
  for(const direction of ['asc','desc']){
    const sorted=sortRows(rows,'mortality',direction);
    assert.ok(sorted.slice(0,10).every(row=>Number.isFinite(row.mortality)));
    assert.ok(sorted.slice(10).every(row=>row.mortality===null));
  }
  assert.deepEqual(sortRows(rows,'incidence','desc','  MeLaNoMA ').map(row=>row.id),['melanoma']);
  assert.equal(rows[0].id,'breast','sorting does not mutate the source array');
});

test('State Cancer Profiles counts and incidence stay separate and the Census join is one to one',()=>{
  assert.equal(data.states.rows.length,51);
  assert.equal(new Set(data.states.rows.map(row=>row.id)).size,51);
  assert.equal(data.poverty.rows.length,51);
  assert.equal(new Set(data.poverty.rows.map(row=>row.id)).size,51);
  for(const {id,incidence,count} of data.states.rows){
    assert.ok(incidence>0&&count>0&&Number.isInteger(count),id);
    const joined=find('poverty',id);
    assert.equal(joined?.incidence,incidence,id);
    assert.ok(joined.poverty>0&&joined.poverty<100,id);
  }
  assert.deepEqual([find('states','MI').incidence,find('states','MI').count,find('poverty','MI').poverty],[457.4,60488,13.5]);
  assert.deepEqual([find('states','OR').incidence,find('states','OR').count],[414.8,23043]);
});

test('reported-value comparison is correct and never turns missing data into zero',()=>{
  assert.equal(comparison(data,{view:'states',measure:'incidence',a:'MI',b:'OR'}).difference,42.6);
  assert.equal(comparison(data,{view:'states',measure:'count',a:'MI',b:'OR'}).difference,37445);
  assert.equal(comparison(data,{view:'types',measure:'mortality',a:'melanoma',b:'lung'}).difference,null);
  assert.equal(comparison(data,{view:'states',measure:'incidence',a:'MI',b:'MI'}),null);
  assert.equal(comparison(data,{view:'states',measure:'mortality',a:'MI',b:'OR'}),null);
  assert.equal(comparison(data,{view:'__proto__',measure:'incidence',a:'MI',b:'OR'}),null);
});

test('trend math recovers the exact known line and rejects insufficient or constant coordinates',()=>{
  const rows=[{poverty:1,incidence:3},{poverty:2,incidence:5},{poverty:3,incidence:7},{poverty:null,incidence:900}];
  assert.deepEqual(fitLine(rows),{slope:2,intercept:1,n:3,min:1,max:3});
  assert.equal(fitLine(rows.slice(0,2)),null);
  assert.equal(fitLine(rows.slice(0,3).map(row=>({...row,poverty:2}))),null);
});

test('published national race and ethnicity rates preserve age adjustment and coverage caveat',()=>{
  assert.match(data.race.period,/2018.{0,4}2022/);
  assert.match(data.race.unit,/age-adjusted/i);
  assert.match(data.race.scope,/designated counties/i);
  assert.deepEqual([find('race','black').incidence,find('race','black').mortality],[467.7,168.6]);
  assert.deepEqual([find('race','white').incidence,find('race','white').mortality],[482.2,151.3]);
});

test('Michigan comparisons distinguish a rate, a share, and screening uptake; a missing measure stays unknown',()=>{
  const fixture={michigan:{rows:[
    {id:'first','late-rate':34,'late-share':24,screening:80},
    {id:'second','late-rate':31,'late-share':30,screening:70},
    {id:'third','late-rate':32,'late-share':25,screening:null}
  ]}};
  const pins=measure=>({view:'michigan',measure,a:'first',b:'second'});
  assert.equal(comparison(fixture,pins('late-rate')).difference,3);
  assert.equal(comparison(fixture,pins('late-share')).difference,6);
  assert.equal(comparison(fixture,pins('screening')).difference,10);
  assert.equal(comparison(fixture,{...pins('screening'),b:'third'}).difference,null);
  assert.equal(comparison(fixture,pins('mortality')),null);
  assert.equal(fitLine(fixture.michigan.rows,'screening','late-share'),null);
});

test('Michigan combines county records by FIPS and retains suppressed diagnosis rates as missing',()=>{
  const rows=data.michigan.rows;
  assert.equal(rows.length,83);
  assert.equal(new Set(rows.map(row=>row.id)).size,83);
  assert.ok(rows.every(row=>/^26\d{3}$/.test(row.id)&&row.screening>0&&row.screening<=100));
  assert.equal(rows.filter(row=>Number.isFinite(row['late-rate'])).length,72);
  const macomb=find('michigan','26099');
  assert.deepEqual([macomb.incidence,macomb['late-rate'],macomb['late-share'],macomb.screening],[141.7,46.6,31.1,75.4]);
  const suppressed=find('michigan','26083');
  assert.equal(suppressed.incidence,null);
  assert.equal(suppressed['late-rate'],null);
  assert.ok(Number.isFinite(suppressed.screening));
});

