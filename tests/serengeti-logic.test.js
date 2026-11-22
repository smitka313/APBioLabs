'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../serengeti-logic');
const { BOARD } = require('../serengeti-scene');
const of = (s, species, type) => s.tokens.filter(t => t.species === species && (!type || t.type === type));
const addr = c => c.x + ',' + c.y;
const edge = (a,b) => Math.abs(a.x-b.x)+Math.abs(a.y-b.y) === 1;
const corner = (a,b) => a!==b && Math.max(Math.abs(a.x-b.x),Math.abs(a.y-b.y)) === 1;
const go = (s,type,optionId) => L.act(s,{type,...(optionId===undefined?{}:{optionId})});
const card = (id, season=0) => {
  let s = L.create(42);
  s.season = season;
  s = go(s,'migrate');
  const index = s.deck.indexOf(id);
  [s.deck[0], s.deck[index]] = [s.deck[index],s.deck[0]];
  return go(s,'draw');
};

test('official board has 21 wildebeest, 22 hyena and 28 lion tokens and one anchor per territory', () => {
  const s = L.create(42), {groups} = L.results(s);
  assert.deepEqual(groups,{individual:11,smallGroup:6,herd:4});
  assert.equal(L.results(s).change,0);
  for (const [species,type,count,anchors,individuals,groups] of [['hyena','clan',22,9,8,5],['lion','pride',28,14,7,7]]) {
    assert.equal(of(s,species).length,count);
    assert.equal(of(s,species,'individual').length,individuals);
    assert.equal(of(s,species,'smallGroup').length,groups);
    assert.equal(of(s,species,type).length,anchors);
    assert.equal(new Set(of(s,species,type).map(t=>t.territory)).size,anchors);
  }
  assert.equal(new Set(s.tokens.map(t=>addr(t.cell))).size,71);
  assert.ok(of(s,'wildebeest').every(t=>BOARD[t.cell.y][t.cell.x].season===0));
});

test('all 21 can migrate to every season; only Summer needs and logs corner fallback', () => {
  for (let season=0;season<4;season++) {
    const s={...L.create(42),season};
    const options=L.phase(s).options;
    assert.ok(options.length>0);
    for (const p of options) {
      assert.equal(p.cells.length,21);
      assert.equal(p.cornerFallback,season===2);
      assert.equal(new Set(p.cells.map(addr)).size,21);
      assert.ok(p.cells.every(c=>BOARD[c.y][c.x].season===season && !BOARD[c.y][c.x].territory));
      assert.ok(p.cells.every(c=>p.cells.some(n=>p.cornerFallback?corner(c,n):edge(c,n))));
    }
    const next=go(s,'migrate',options.at(-1).id);
    assert.equal(next.log.at(-1).cornerFallback,season===2);
    assert.equal(next.log.at(-1).change,0);
    assert.equal(L.phase(next).kind,'card');
  }
});

test('shared 17-card pile preserves the printed duplicate cards and seeds replay', () => {
  const a=L.create(3), b=L.create(3), c=L.create(9);
  assert.deepEqual(a,b);
  assert.notDeepEqual(a.deck,c.deck);
  assert.equal(L.CARDS.length,17);
  assert.equal(new Set(a.deck).size,17);
  for (const label of ['flood','drought']) {
    const cards=L.CARDS.filter(c=>c.id.startsWith(label));
    assert.equal(cards.length,2);
    assert.equal(cards[0].text,cards[1].text);
  }
});

test('draw order and source-specific card apply preserve log roles and only selected token dies', () => {
  let s=card('old-sick');
  assert.equal(L.phase(s).role,'wildebeest');
  const options=L.phase(s).options;
  assert.equal(options.length,11);
  assert.throws(()=>go(s,'resolveCard','h000'),/unavailable/);
  const target=options.at(-1).tokenId;
  const old=s.tokens;
  s=go(s,'resolveCard',target);
  assert.equal(old.length,71);
  assert.equal(s.tokens.length,70);
  assert.equal(s.tokens.some(t=>t.id===target),false);
  assert.equal(s.log.at(-1).change,-1);
  assert.equal(s.log.at(-1).cardId,'old-sick');
  assert.equal(s.log.at(-1).role,'wildebeest');
  assert.equal(L.phase(go(s,'draw')).role,'hyena');
});

test('hyena clan removal disables hunts by other tokens in the vacated territory', () => {
  let s=card('landslide');
  const options=L.phase(s).options;
  const anchor=s.tokens.find(t=>t.id===options.find(p=>s.tokens.some(t=>t.id===p.tokenId && of(s,'hyena','individual').some(i=>i.territory===t.territory))).tokenId);
  const residents=of(s,'hyena').filter(t=>t.territory===anchor.territory && t.type!=='clan');
  s=go(s,'resolveCard',anchor.id);
  s={...s,step:'move',huntRole:'hyena',moved:[]};
  assert.ok(residents.length>0);
  assert.ok(residents.every(resident=>s.tokens.some(t=>t.id===resident.id)));
  assert.ok(L.phase(s).options.every(p=>!residents.some(t=>t.id===p.tokenId)));
});

test('hunting compares every ranked pair; ties and unpaired dice stay', () => {
  assert.deepEqual(L.compareDice([2,6],[1,5,4]),{
    predator:[6,2],prey:[5,4,1],
    pairs:[{predator:6,prey:5,winner:'predator'},{predator:2,prey:4,winner:'prey'}],
    predatorRemaining:1,preyRemaining:2
  });
  assert.deepEqual(L.compareDice([3],[3,1]),{
    predator:[3],prey:[3,1],pairs:[{predator:3,prey:3,winner:'tie'}],predatorRemaining:1,preyRemaining:2
  });
});

test('adjacent small-group hunt can lose one individual while preserving the attacked group', () => {
  function run(mode) {
    const s=go(L.create(256),'migrate'), predator=of(s,'hyena','individual')[0], prey=of(s,'wildebeest','smallGroup')[0];
    const oldGroupIds=of(s,'wildebeest','smallGroup').map(t=>t.id);
    if(mode!=='individual') s.tokens=s.tokens.filter(t=>t.species!=='wildebeest'||t.type!=='individual');
    if(mode==='herd') s.tokens=s.tokens.filter(t=>t.species!=='wildebeest'||t.type==='herd');
    s.step='hunt';s.huntRole='hyena';
    s.battle={preyId:prey.id,predatorId:predator.id,preyDice:1,predatorDice:1,preyType:prey.type,predatorType:predator.type,rounds:[]};
    // A deterministic fixture seed for a predator win; exact comparison is checked above.
    for(let seed=10000;seed<10300;seed++){
      const n=go({...s,rng:seed},'roll');
      if(n.lastBattle?.winner==='predator') return [s,n,prey,oldGroupIds];
    }
    assert.fail('No predator-winning RNG fixture');
  }
  const [,a,target]=run('individual');
  assert.equal(a.log.at(-1).preyType,'smallGroup');
  assert.equal(a.log.at(-1).attackedId,target.id);
  assert.notEqual(a.log.at(-1).removedId,target.id);
  assert.equal(a.log.at(-1).change,-1);
  assert.ok(a.tokens.some(t=>t.id===target.id));
  const [before,b]=run('group');
  assert.equal(of(b,'wildebeest','smallGroup').length,of(before,'wildebeest','smallGroup').length-1);
  assert.equal(of(b,'wildebeest','individual').length,2);
  assert.equal(b.log.at(-1).change,-1);
  const [,c]=run('herd');
  assert.equal(of(c,'wildebeest','herd').length,4);
  assert.equal(c.log.at(-1).change,0);
  assert.match(c.log.at(-1).description,/No legal removal/);
});

test('20 seeded seasons complete with 12 draw rows, valid roll logs, and save round-trips', () => {
  for(let seed=1;seed<=20;seed++) {
    let s=L.create(seed), steps=0, activeSeen=false;
    while(L.phase(s).kind!=='complete' && steps++<500) {
      const p=L.phase(s);
      const type={migration:'migrate',card:p.card?'resolveCard':'draw',hyenaMove:'beginHunts',lionMove:'beginHunts',hunt:'roll',seasonEnd:'nextSeason'}[p.kind];
      if(p.battle?.rounds.length && !activeSeen) {assert.deepEqual(L.restore(JSON.stringify(s)),s);activeSeen=true;}
      s=go(s,type);
    }
    assert.equal(L.phase(s).kind,'complete');
    assert.equal(s.log.filter(r=>r.kind==='card').length,12);
    assert.equal(new Set(s.log.filter(r=>r.kind==='card').map(r=>r.cardId)).size,12);
    for(let season=0;season<4;season++){
      assert.deepEqual(s.log.filter(r=>r.kind==='card'&&r.season===season).map(r=>r.role),L.ROLES);
      assert.equal(s.log.filter(r=>r.kind==='migration'&&r.season===season).length,1);
    }
    assert.equal(L.results(s).seasons.length,4);
    assert.equal(L.results(s).change,s.log.reduce((n,r)=>n+r.change,0));
    assert.ok(s.log.filter(r=>r.kind==='hunt').every(r=>r.preyType&&r.predatorType&&r.rounds.length));
    assert.deepEqual(L.restore(JSON.stringify(s)),s);
  }
  assert.equal(L.restore('not a save'),null);
});
