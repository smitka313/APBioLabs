/* Exercise exact production collectors for the openscied-b3-cancer-rates saved evidence. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const D = require('../openscied-b3-cancer-rates-data.js');
const L = require('../openscied-b3-cancer-rates-logic.js');
const root = path.join(__dirname,'..');
const source = fs.readFileSync(path.join(root,'openscied-b3-cancer-rates.js'),'utf8');
function fn(name, nextMarker) {
  const start = source.indexOf('  function '+name+'(');
  assert.ok(start>=0, 'production '+name+' exists');
  const end = source.indexOf(nextMarker,start+1);
  assert.ok(end>start);
  return source.slice(start,end);
}
const spec = {michigan:{title:'Michigan: screening and diagnosis',measures:['income','screening','late-rate']},poverty:{title:'State income, poverty and cancer'}};
const labels = {income:'Median household income',screening:'Mammography use','late-rate':'Late-stage rate',incidence:'Diagnosis rate'};
const context = {D,L,spec,labels,finite:Number.isFinite,str:(s,n)=>typeof s==='string'?s.slice(0,n):'',
  full:String,formatPair:(row,key)=>String(row[key])};
vm.createContext(context);
vm.runInContext([
  fn('cleanContext','\n  function suggestedDataset('),
  fn('suggestedDataset','\n  try{const saved='),
  fn('evidenceText','\n  const testCostEvidence'),
].join('\n'),context);
let n=0;
function same(got,want,msg){assert.equal(got,want,msg);n++;console.log('ok: '+msg);}
function has(output,regex,msg){assert.match(output,regex,msg);n++;console.log('ok: '+msg);}
same(context.suggestedDataset('Do states with higher poverty have higher diagnosis rates?').view,'poverty','A state-poverty question recommends the source that measures both');
const rec=context.suggestedDataset('How does income compare with late-stage diagnoses in Michigan counties?');
same(rec.view+':'+rec.x,'michigan:income','A Michigan income question recommends the county-income axis');
same(context.suggestedDataset('Which cancer types head the new cases ranking?').view,'types','The types ranking stays available for the questions it answers');
same(context.suggestedDataset('What do you wonder about these results?'),null,'Unspecific questions do not claim a dataset match');
const ruralRows=D.michigan.rows.filter(row=>row.region.toLowerCase()==='rural'&&Number.isFinite(row.income)&&Number.isFinite(row['late-rate']));
const expectedFit=L.fitLine(ruralRows,'income','late-rate');
assert.ok(expectedFit && ruralRows.length>=3);
const pin={view:'michigan',measure:'late-rate',a:ruralRows[0].id,b:ruralRows[1].id,context:{x:'michigan:income',region:'rural',query:'',trend:true}};
const readback=context.cleanContext(JSON.parse(JSON.stringify(pin.context)),pin.view);
same(readback.x,'michigan:income','A restored pin still records the selected Michigan axis');
const described=context.evidenceText({...pin,context:readback});
has(described,/Median household income \(x\) and Late-stage rate \(y\), rural counties/,'Report and evidence ledger describe the exact rural income scatter');
has(described,new RegExp('Trend line: '+expectedFit.n+' counties, '+(expectedFit.slope<0?'downward':'upward')),'The fitted count and direction come from actual published rows and the saved filter');
const noFit=context.evidenceText({...pin,context:{...readback,query:ruralRows[0].id}});
has(noFit,/No line could be fitted/,'A one-county search cannot claim a fit');
has(context.evidenceText({...pin,context:{...readback,trend:false}}),/Scatterplot: Median household income/,'Without the trend control, the pair still records the axes');
same(context.evidenceText({...pin,context:{...readback,trend:false}}).includes('Trend line:'),false,'Turning trend off does not claim a trend was displayed');
const legacy=context.evidenceText({...pin,context:{x:'income',trend:true,region:'all'}});
has(legacy,/older pin did not record which horizontal axis/,'Legacy Michigan pins keep their data without inventing what was on the horizontal axis');
same(legacy.includes('Trend line:'),false,'Legacy Michigan pins cannot invent a fitted trend');
console.log('t138-openscied-b3-cancer-pin-provenance: '+n+' checks passed');
