/* Audit regression for resolved hunts, population versus token count, and persistent board context. */
const assert=require('node:assert/strict');
const T=require('./_h');
const L=require('../serengeti-logic');
const key='aplab:openscied-b1-serengeti:preview-v1';
const coords=c=>(c.x+1)+', '+(c.y+1);
const pick=(s,species,type)=>s.tokens.find(t=>t.species===species&&t.type===type);
function fixture(withIndividual){
  const s=L.act(L.create(256),{type:'migrate'});
  if(!withIndividual)s.tokens=s.tokens.filter(t=>t.species!=='wildebeest'||t.type!=='individual');
  const prey=pick(s,'wildebeest','smallGroup'), predator=pick(s,'hyena','individual');
  s.step='hunt';s.huntRole='hyena';
  s.battle={preyId:prey.id,predatorId:predator.id,preyDice:1,predatorDice:1,
    predatorCell:predator.cell,preyCell:prey.cell,preyType:prey.type,predatorType:predator.type,rounds:[]};
  for(let rng=10000;rng<10300;rng++){
    const before={...s,rng},after=L.act(before,{type:'roll'});
    if(after.lastBattle?.winner==='predator')return{before,after,prey,predator};
  }
  assert.fail('fixture must produce a predator win');
}
(async()=>{
  const browser=await T.launch(),server=await T.serve();
  let context;
  try{
    context=await T.ctxFor(browser,{width:390,height:844,dark:true,reduced:true});
    const page=await context.newPage();
    await page.goto(server.url+'openscied-b1-serengeti.html');
    const set=async game=>{
      await page.evaluate(([k,v])=>localStorage.setItem(k,JSON.stringify({v:1,game:v,answers:{},page:'play'})),[key,game]);
      await page.reload();await page.locator('#sg-next').waitFor();
    };
    const read=()=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)).game,key);
    for(const withIndividual of [false,true]){
      const {before,after,prey,predator}=fixture(withIndividual);
      await set(before);
      await page.locator('#sg-board-open').click();
      const dlg=page.locator('#sg-board-dialog');
      await dlg.locator('#sg-expanded-next[data-action="roll"]').click();
      await dlg.locator('#sg-expanded-next[data-action="huntReview"]').waitFor();
      const record=dlg.locator('#sg-expanded-last-text');
      assert.match(await record.textContent(),/Population: −1/);
      assert.equal(await dlg.locator('#sg-expanded-action-title').textContent(),'Hyena vs. wildebeest');
      assert.match(await dlg.locator('#sg-expanded-dice').textContent(),/Final roll · hunt result/);
      const removed=before.tokens.find(t=>t.id===after.lastBattle.removedId);
      assert.equal(await dlg.locator('[data-change-cell="'+removed.cell.x+':'+removed.cell.y+'"][data-change-kind="removed"]').count(),1);
      if(withIndividual){
        assert((await record.textContent()).includes('individual at square '+coords(removed.cell)));
        assert.match(await record.textContent(),/The attacked token stayed/);
      }else{
        assert.match(await record.textContent(),/small-group token/);
        assert.match(await record.textContent(),/\(\+1\)/);
        assert.equal(await dlg.locator('[data-change-kind="added"]').count(),2);
      }
      assert.deepEqual(await read(),after);
      await page.reload();
      await page.locator('#sg-next[data-action="huntReview"]').click();
      assert.deepEqual(await read(),after,'acknowledging the final roll does not roll again');
      assert(await page.locator('#sg-next').getAttribute('data-action')!=='huntReview');
    }
    let flooded=L.act(L.create(256),{type:'migrate'});
    const card=L.CARDS.find(c=>c.effect==='removePride');
    flooded.deck=[card.id,...flooded.deck.filter(id=>id!==card.id)];
    flooded=L.act(L.act(flooded,{type:'draw'}),{type:'resolveCard'});
    await set(flooded);
    const cells=L.floodedCells(flooded);
    assert(cells.length>0);
    assert.equal(await page.locator('[data-flood-cell]').count(),cells.length);
    assert.match(await page.locator('[data-cell="'+cells[0].x+':'+cells[0].y+'"]').getAttribute('aria-label'),/cannot hunt/);
    console.log('PASS: two resolved-hunt bookkeeping cases, exact final dice, review across reload, and persistent flood cells');
  }finally{if(context)await context.close();await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
