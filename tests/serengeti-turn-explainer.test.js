const {test}=require('node:test');
const assert=require('node:assert/strict');
const L=require('../serengeti-logic');
const {explain}=require('../serengeti-turn-explainer');
const base=(row,extras={})=>({season:0,tokens:[{species:'wildebeest',type:'individual'},{species:'wildebeest',type:'smallGroup'}],log:row?[{season:0,...row}]:[],...extras});
test('setup and a migration preview provide next steps without claiming a move occurred',()=>{
  assert.match(explain().why,/not pick an overall winner/);
  const out=explain({state:base(null,{season:2}),phase:{kind:'migration'},selected:{cells:[{},{}],cornerFallback:true},nextLabel:'Migrate wildebeest'});
  assert.match(out.what,/No pieces have moved yet/);assert.match(out.why,/side-touching groups/);assert.match(out.next,/Migrate wildebeest/);
});
test('season transition reports actual homeward hyena movements; placement completion shows cumulative change',()=>{
  const state=base(null,{season:2});
  const ret=explain({state,phase:{kind:'migration'},decision:{type:'nextSeason',season:2,logLength:0,moved:[{before:{species:'hyena'},after:{species:'hyena'}}]}});
  assert.match(ret.what,/returned to its home territory/);
  const placed=explain({state:base({kind:'migration',change:0,population:0}),phase:{kind:'card',role:'wildebeest'}});
  assert.match(placed.what,/winter range.*0 cumulative/i);assert.match(placed.why,/does not directly change/);
});
test('drawn card differs from applying it, and travel directs players away from a disabled Apply button',()=>{
  const out=explain({state:base(),phase:{kind:'card',role:'wildebeest',card:L.CARDS.find(x=>x.id==='hyena-commute'),options:[{id:'move'}]},primaryDisabled:true,nextLabel:'Apply event'});
  assert.match(out.what,/Wildebeest drew.*has not been applied/);assert.match(out.why,/small hyena group travel/);
  assert.match(out.next,/Choose a legal piece and destination/);assert.doesNotMatch(out.next,/Apply event/);
});
test('a voluntary stay is not called a lack of legal moves; ineligible cards are reported separately',()=>{
  const context={state:base({kind:'card',cardId:'short-grasses',description:'No token moved.',change:0,population:-2}),phase:{kind:'card',role:'hyena'}};
  const stayed=explain({...context,decision:{type:'resolveCard',season:0,logLength:1,option:{id:'stay'}}});
  assert.match(stayed.why,/Staying was an available choice/);assert.match(stayed.what,/Wildebeest 0 · −2 cumulative/);
  const unavailable=explain({...context,decision:{type:'resolveCard',season:0,logLength:1,option:{id:'stay'},noCardTarget:true}});
  assert.match(unavailable.why,/no predator token for the group to move away from/);assert.doesNotMatch(unavailable.why,/available choice/);
});
test('skipping the last species finishes the season and explains the actual missing pair',()=>{
  const out=explain({state:base({kind:'card',change:-1,population:-1}),phase:{kind:'seasonEnd'},decision:{type:'beginHunts',role:'lion',season:0,logLength:1,count:0,skippedReason:'noAdjacentPair'},nextLabel:'Continue to Spring'});
  assert.match(out.what,/Winter is complete/);assert.match(out.why,/Lions did not hunt.*share a side/);assert.match(out.next,/Continue to Spring/);
});
test('a card-triggered hunt names the preceding action and actual dice without resolving it',()=>{
  const desc='Hyena · Small group moved to square 3, 4.';
  const out=explain({state:base({kind:'card',description:desc,change:0,population:-2}),phase:{kind:'hunt',role:'hyena',event:true,battle:{rounds:[],predatorDice:2,preyDice:3}}});
  assert.match(out.what,/square 3, 4.*starts a hunt/);assert.match(out.why,/share a side.*wildebeest 3 dice, hyenas 2 dice/i);assert.match(out.next,/Roll the hunt dice/);
});
test('hunt dice explain literal rankings, ties, unmatched and resolved population outcome',()=>{
  const round=L.compareDice([6,4],[4,2,1]);
  const tied=L.compareDice([6,4],[5,4,1]);
  const ongoing=explain({state:base(),phase:{kind:'hunt',role:'lion',battle:{rounds:[tied]}}});
  assert.match(ongoing.why,/Lion 6 beat wildebeest 5.*4 vs 4: both stay.*1 unmatched die stays/i);
  assert.match(ongoing.next,/Roll the remaining dice/);
  const note='Population: −1. Replaced one small group with two individual wildebeest.';
  const out=explain({state:base(),phase:{kind:'huntReview',role:'lion'},review:{row:{winner:'predator',change:-1},battle:{rounds:[{...round,preyRemaining:0}]},message:note},nextLabel:'Acknowledge hunt'});
  assert(out.what.includes(note));assert.match(out.why,/wildebeest ran out of dice/);assert.match(out.next,/Choose Acknowledge hunt to continue the season/);
});
test('escape narration appears once and review names what Done opens',()=>{
  const out=explain({state:base(),phase:{kind:'huntReview',role:'hyena'},underlying:{kind:'lionMove'},nextLabel:'Done',review:{row:{winner:'prey',change:0},message:'The wildebeest escaped. No change to tokens or population.'}});
  assert.equal((out.what.match(/wildebeest escaped/ig)||[]).length,1);
  assert.match(out.next,/Choose Done to check lion hunting positions/);
});
test('a removal card without individuals explains why a herd is not a substitute',()=>{
  const p={kind:'card',role:'hyena',card:L.CARDS.find(c=>c.id==='old-sick'),options:[]};
  const out=explain({state:base(null,{tokens:[{species:'wildebeest',type:'herd'}]}),phase:p});
  assert.match(out.why,/individual wildebeest.*none remain.*herd does not count/);
});
test('moving a predator reports only an actual token change; complete uses the sum of observed changes',()=>{
  const a=explain({state:base(),phase:{kind:'hyenaMove',role:'hyena'},readiness:{count:1},decision:{type:'movePredator',role:'hyena',season:0,logLength:0,moved:[{before:{species:'hyena',type:'smallGroup',cell:{x:1,y:0}},after:{species:'hyena',type:'smallGroup',cell:{x:2,y:0}}}]}});
  assert.match(a.what,/small group moved to square 3, 1/);assert.match(a.why,/1 eligible pair/);
  const z=explain({state:base(null,{log:[{change:-1},{change:-1},{change:0}]}),phase:{kind:'complete'}});
  assert.match(z.what,/All four seasons.*−2/);assert.match(z.why,/not a real population forecast/);
});
test('every explanation across a real seeded playthrough is complete and never mutates its inputs',()=>{
  let s=L.create(9911), rounds=0; const kinds=new Set();
  while(rounds++<500){
    const p=L.phase(s), kind=p.kind; kinds.add(kind);
    const before=JSON.stringify(s);const out=explain({state:s,phase:p,readiness:p.role?L.huntReadiness(s,p.role):null});
    for(const key of ['what','why','next'])assert(out[key].length>4,kind+': '+key);
    assert.equal(JSON.stringify(s),before);
    if(kind==='complete')break;
    const type={migration:'migrate',card:p.card?'resolveCard':'draw',hyenaMove:'beginHunts',lionMove:'beginHunts',hunt:'roll',seasonEnd:'nextSeason'}[kind];
    s=L.act(s,{type});
  }
  assert.deepEqual([...kinds].sort(),['card','complete','hunt','hyenaMove','lionMove','migration','seasonEnd']);
});
