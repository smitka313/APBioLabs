/* Rules-derived, pure read-only queries used by the Play/expanded board. */
const assert = require('node:assert/strict');
const test = require('node:test');
const L = require('../serengeti-logic');
const go = (s,type,optionId) => L.act(s,{type,optionId});
const edge=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y)===1;

function rawPairs(s,role) {
  const anchor = role==='hyena'?'clan':'pride';
  const homes = new Set(s.tokens.filter(t=>t.species===role && t.type===anchor).map(t=>t.territory));
  const prey = s.tokens.filter(t=>t.species==='wildebeest');
  return s.tokens.filter(t=>t.species===role && ['individual','smallGroup'].includes(t.type) && homes.has(t.territory))
    .flatMap(pred=>prey.filter(w=>edge(pred.cell,w.cell)).map(w=>pred.id+':'+w.id));
}
function tokenPairs(q) { return q.pairings.map(b=>b.predatorId+':'+b.preyId); }

test('readiness matches independently calculated edge-adjacent pairs for both species; does not mutate engine state', () => {
  for(let seed=1;seed<17;seed++) {
    const s=go(L.create(seed),'migrate'), before=JSON.stringify(s);
    for(const role of ['hyena','lion']){
      const q=L.huntReadiness(s,role);
      assert.deepEqual(tokenPairs(q),rawPairs(s,role));
      assert.ok(q.pairings.every(b=>edge(b.predatorCell,b.preyCell)));
      if(q.pairings.length) q.pairings[0].preyCell.x=-10;
    }
    assert.equal(JSON.stringify(s),before);
  }
});

test('readiness ignores already-used active pairs and respects an event hunter, but previews the other species without those restrictions', () => {
  const s=go(L.create(256),'migrate');
  const all=rawPairs(s,'hyena');
  assert.ok(all.length);
  s.step='hunt'; s.huntRole='hyena'; s.eventHunter=all[0].split(':')[0]; s.usedPairs=[all[0]];
  assert.deepEqual(tokenPairs(L.huntReadiness(s,'hyena')),all.filter(k=>k.startsWith(s.eventHunter+':')&&k!==all[0]));
  assert.deepEqual(tokenPairs(L.huntReadiness(s,'lion')),rawPairs(s,'lion'));
});
test('readiness distinguishes no prey, no hunters, and hunters blocked by a missing anchor', () => {
  const s=go(L.create(5),'migrate');
  const without = filter=>({...s,tokens:s.tokens.filter(filter)});
  assert.equal(L.huntReadiness(without(t=>t.species!=='wildebeest'),'hyena').blocked,'noPrey');
  assert.equal(L.huntReadiness(without(t=>t.species!=='hyena'||t.type==='clan'),'hyena').blocked,'noHunters');
  assert.equal(L.huntReadiness(without(t=>t.species!=='hyena'||t.type!=='clan'),'hyena').blocked,'noEligibleHunters');
});
test('flooded cells are exactly the colored connected region of the removed pride', () => {
  let s=go(L.create(5),'migrate');
  assert.deepEqual(L.floodedCells(s),[]);
  s.deck=['flood-a',...s.deck.filter(id=>id!=='flood-a')]; s=go(s,'draw');
  const p=L.phase(s), pride=s.tokens.find(t=>t.id===p.options[0].tokenId);
  const gone=go(s,'resolveCard',pride.id);
  const cells=L.floodedCells(gone);
  const board=require('../serengeti-scene').BOARD;
  const expected=[pride.cell];
  for (const c of expected) {
    for (const [x,y] of [[c.x+1,c.y],[c.x-1,c.y],[c.x,c.y+1],[c.x,c.y-1]]) {
      if(board[y]?.[x]?.territory==='lion'&&!expected.some(e=>e.x===x&&e.y===y))expected.push({x,y});
    }
  }
  const str=a=>a.map(c=>c.x+':'+c.y).sort();
  assert.deepEqual(str(cells),str(expected));
  assert.deepEqual(L.floodedCells(s),[]);
});
