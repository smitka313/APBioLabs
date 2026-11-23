'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const L=require('../migration-logic.js');
// Independent transcription checked against all 18 supplied student card images,
// not the inconsistent teacher summary key. Values are monthly group averages.
const reference=[
  [4,0,95,0,'Healthy'],[4,1,75,0,'Healthy'],[4,2,90,0,'Healthy'],
  [5,0,92,20,'Healthy'],[5,1,68,20,'Nutritionally stressed'],[5,2,60,20,'Nutritionally stressed'],
  [6,0,89,20,'Healthy'],[6,1,51,20,'Nutritionally stressed'],[6,2,31,20,'Nutritionally starved'],
  [7,0,73,0,'Healthy'],[7,1,48,0,'Nutritionally stressed'],[7,2,23,0,'Nutritionally starved'],
  [8,0,76,0,'Healthy'],[8,1,46,0,'Nutritionally stressed'],[8,2,31,0,'Nutritionally starved'],
  [9,0,77,0,'Healthy'],[9,1,54,0,'Nutritionally stressed'],[9,2,55,0,'Nutritionally stressed']
];
for(const [month,group,fat,anthrax,health] of reference)test(`source card ${month+1}, group ${group}`,()=>{const c=L.CARDS.find(c=>c.month===month&&c.group===group);assert.ok(c);assert.equal(c.fat,fat);assert.equal(c.anthrax,anthrax);assert.equal(c.health,health);assert.equal(c.location,month-3);});
test('no fabricated health data outside supplied six months',()=>{assert.equal(L.CARDS.length,18);for(const m of [0,1,2,3,10,11])assert.deepEqual(L.forMonth(m),[]);});
test('source exceptions preserved rather than replaced by key summaries',()=>{assert.equal(L.CARDS.filter(c=>c.health==='Healthy').length,8);assert.equal(L.CARDS.find(c=>c.month===4&&c.group===2).fat,90);assert.equal(L.CARDS.find(c=>c.month===6&&c.group===1).fat,51);});
test('all sorting methods retain every unique source card',()=>{for(const sort of ['month','group','health','anthrax']){const grouped=L.groups(sort),cards=grouped.flatMap(g=>g.cards);assert.equal(cards.length,18);assert.equal(new Set(cards.map(c=>c.id)).size,18);}});
test('anthrax groups describe samples, not cause of death',()=>{assert.equal(L.groups('anthrax').find(g=>g.label==='20% anthrax').cards.length,6);for(const m of [5,6])assert.deepEqual(L.forMonth(m).map(c=>c.anthrax),[20,20,20]);});
test('all month positions are finite, inside schematic, southern in Jan and northern in Sep',()=>{assert.equal(L.POSITIONS.length,12);for(const p of L.POSITIONS){assert.ok(p.every(Number.isFinite));assert.ok(p[0]>0&&p[0]<1000&&p[1]>0&&p[1]<660);}assert.ok(L.POSITIONS[0][1]>L.POSITIONS[8][1]);});
test('invalid month input cannot generate undefined coordinates',()=>{for(const value of [-1,12,NaN,Infinity,null,'5',1.5])assert.equal(L.monthIndex(value),0);assert.equal(L.monthIndex(11),11);});
function dashboard(){let src=fs.readFileSync(path.join(__dirname,'../openscied-dashboard.js'),'utf8');src=src.replace('  function init() {','  globalThis.migrationTest = { migrationProgress, migrationResponseIds };\n  function init() {');const context={document:{readyState:'loading',addEventListener(){}}};vm.runInNewContext(src,context);return context.migrationTest;}
test('dashboard recognizes real work and resumes correct section',()=>{const {migrationProgress}=dashboard();assert.equal(migrationProgress(null).summary,'Not started');const result=migrationProgress(JSON.stringify({v:1,month:7,page:'explain',visited:[4,7],notes:[{id:'card'}],answers:{claim:'Evidence-based response'},lastVisitedAt:123}));assert.equal(result.started,true);assert.equal(result.section,'explain');assert.equal(result.visited,123);assert.match(result.summary,/2 of 12 months explored.*1 notebook entries.*1 of 10/);});
test('dashboard preserves unreadable work and rejects unknown schemas',()=>{const {migrationProgress}=dashboard();for(const raw of ['{','null','{}',JSON.stringify({v:2,month:0,visited:[],notes:[],answers:{}}),JSON.stringify({v:1,month:50,visited:[],notes:[],answers:{}})])assert.match(migrationProgress(raw).summary,/could not be read/);});
test('opening the explorer alone does not claim completed work',()=>{const {migrationProgress}=dashboard();assert.equal(migrationProgress(JSON.stringify({v:1,month:0,visited:[],notes:[],answers:{},observations:{},lastVisitedAt:1})).started,false);});
test('dashboard exports all ten explorer responses and recognizes observation-only work',()=>{const api=dashboard();assert.equal(api.migrationResponseIds().length,10);assert.equal(api.migrationProgress(JSON.stringify({v:1,month:0,visited:[],notes:[],answers:{},observations:{0:'My question'}})).started,true);});
test('source image and all local activity dependencies exist',()=>{const html=fs.readFileSync(path.join(__dirname,'../openscied-b1-migration.html'),'utf8');for(const match of html.matchAll(/(?:src|href)="([^"#]+)"/g)){if(/^https?:/.test(match[1])||match[1]==='openscied-dashboard.html')continue;assert.ok(fs.existsSync(path.join(__dirname,'..',match[1])),match[1]);}assert.ok(!html.includes('Answer Key'));});
