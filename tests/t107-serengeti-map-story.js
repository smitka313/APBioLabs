/* Make sure the expedition paints the real formation and real rolled pairing, not decorative examples. */
const assert=require('node:assert/strict');
const T=require('./_h');
const L=require('../serengeti-logic');
const key='aplab:openscied-b1-serengeti:preview-v1';
const xy=c=>c.x+':'+c.y;
(async()=>{
  const browser=await T.launch(),server=await T.serve();
  let context;
  try{
    context=await T.ctxFor(browser,{width:390,height:844,dark:true,reduced:true});
    const page=await context.newPage();
    await page.goto(server.url+'openscied-b1-serengeti.html');
    const restore=async game=>{
      await page.evaluate(([k,v])=>localStorage.setItem(k,JSON.stringify({v:1,game:v,answers:{},page:'play'})),[key,game]);
      await page.reload();await page.locator('#sg-next').waitFor();
    };
    let state=L.act(L.create(32737),{type:'migrate'});
    state.season=1;state.step='migration';state.huntRole=null;state.cardId=null;
    state.seasons[1]={season:1,start:0,end:null};
    let survivors=0;
    state.tokens=state.tokens.filter(t=>t.species!=='wildebeest'||++survivors<=10);
    const formation=L.phase(state).options[1];
    await restore(state);
    await page.locator('#sg-options').selectOption(formation.id);
    const map=page.locator('#sg-scene .sg-map');
    const preview=map.locator('[data-map-route="preview"]');
    assert.equal(await preview.count(),1);
    const before=state.tokens.filter(t=>t.species==='wildebeest');
    const actualMoves=before.map((t,i)=>[t.cell,formation.cells[i]]).filter(([from,to])=>xy(from)!==xy(to))
      .sort(([fromA,toA],[fromB,toB])=>fromA.x-fromB.x||fromA.y-fromB.y||toA.x-toB.x||toA.y-toB.y);
    assert(actualMoves.length>0);
    const visible=actualMoves.length<=3?actualMoves:[actualMoves[0],actualMoves[Math.floor(actualMoves.length/2)],actualMoves.at(-1)];
    const expected=visible.map(([from,to])=>xy(from)+'>'+xy(to)).sort();
    assert.equal(await map.getAttribute('data-map-season'),'1');
    const hops=source=>source.locator('[data-route-hop]').evaluateAll(elements=>elements.map(el=>el.dataset.fromCell+'>'+el.dataset.toCell).sort());
    assert.deepEqual(await hops(preview),expected);
    assert.match(await page.locator('#sg-map-proximity').textContent(),/This placement/);
    await page.locator('#sg-next[data-action="migrate"]').click();
    assert.deepEqual(await hops(map.locator('[data-map-route="committed"]')),expected,'committed route shows the same genuine representative moves with reduced motion');
    assert.match(await page.locator('#sg-map-proximity').textContent(),/At this range/);
    state=L.act(L.create(256),{type:'migrate'});
    const prey=state.tokens.find(t=>t.species==='wildebeest'&&t.type==='smallGroup');
    const predator=state.tokens.find(t=>t.species==='hyena'&&t.type==='individual');
    state.step='hunt';state.huntRole='hyena';state.battle={preyId:prey.id,predatorId:predator.id,
      preyDice:1,predatorDice:1,predatorCell:predator.cell,preyCell:prey.cell,preyType:prey.type,predatorType:predator.type,rounds:[]};
    let after;
    for(let i=10000;i<10300;i++){state.rng=i;after=L.act(state,{type:'roll'});if(after.lastBattle?.winner)break;}
    assert(after.lastBattle);
    await restore(state);
    const expectedPair=xy(predator.cell)+'>'+xy(prey.cell);
    assert.equal(await map.locator('[data-map-hunt-pair="'+expectedPair+'"]').count(),1);
    await page.locator('#sg-next[data-action="roll"]').click();
    const result=map.locator('[data-map-hunt-round="1"][data-map-hunt-state="result"]');
    assert.equal(await result.count(),1);
    const rank=after.lastBattle.rounds[0];
    for(const side of ['prey','predator']){
      const vals=await result.locator('[data-map-die="'+side+'"]').evaluateAll(els=>els.map(e=>Number(e.dataset.value)));
      assert.deepEqual(vals,rank[side]);
    }
    assert.equal(await map.locator('[data-map-hunt-pair="'+expectedPair+'"]').count(),1);
    console.log('PASS: faithful migration paths and exact ranked dice shown beside the active map pairing');
  }finally{if(context)await context.close();await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
