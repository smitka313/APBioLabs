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
