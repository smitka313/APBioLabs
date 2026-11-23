/* Serengeti phase captions: fictional local state only; no production saved work. */
const assert=require('node:assert/strict');
const T=require('./_h');
const L=require('../serengeti-logic');
const key='aplab:openscied-b1-serengeti:preview-v1';
const initial=()=>L.create(32737);
const go=(g,type)=>L.act(g,{type});
const putFirst=(g,card)=>{g.deck=[card.id,...g.deck.filter(id=>id!==card.id)];return g;};

function emptyTarget(){
  const g=go(initial(),'migrate');
  g.tokens=g.tokens.filter(t=>t.species!=='wildebeest'||t.type!=='individual');
  const next=go(putFirst(g,L.CARDS.find(c=>c.effect==='removeWildebeest')),'draw');
  assert.equal(L.phase(next).options.length,0);
  return next;
}

function noPredatorPairings(){
  const g=go(initial(),'migrate');
  g.tokens=g.tokens.filter(t=>t.species==='wildebeest'||t.type==='clan'||t.type==='pride');
  g.step='move';g.huntRole='hyena';g.moved=[];
  assert.equal(L.phase(g).kind,'hyenaMove');
  return g;
}

function roundFixture(){
  const g=go(initial(),'migrate'), predator=g.tokens.find(t=>t.species==='hyena'&&t.type==='individual'),prey=g.tokens.find(t=>t.species==='wildebeest'&&t.type==='individual');
  g.step='hunt';g.huntRole='hyena';
  g.battle={preyId:prey.id,predatorId:predator.id,preyDice:1,predatorDice:1,predatorCell:predator.cell,preyCell:prey.cell,preyType:prey.type,predatorType:predator.type,rounds:[]};
  for(let rng=10000;rng<14000;rng++){
    const before={...g,rng};
    const tie=go(before,'roll');
    if(tie.battle?.rounds[0]?.pairs[0]?.winner!=='tie')continue;
    const decided=go(tie,'roll');
    if(decided.lastBattle?.winner)return {before,tie,decided};
  }
  assert.fail('expected a seed with a tied first roll and a decided second roll');
}

function endFixtures(){
  let g=initial(), winter=null;
  for(let i=0;i<1000;i++){
    const p=L.phase(g);
    if(p.kind==='complete')return {winter,finished:g};
    if(!winter&&p.kind==='seasonEnd')winter=g;
    const type={migration:'migrate',card:p.card?'resolveCard':'draw',hyenaMove:'beginHunts',lionMove:'beginHunts',hunt:'roll',seasonEnd:'nextSeason'}[p.kind];
    g=go(g,type);
  }
  assert.fail('expected a complete fictional year');
}

(async()=>{
  const {before,tie,decided}=roundFixture(), endpoints=endFixtures();
  const browser=await T.launch(), server=await T.serve();
  let ctx;
  try{
    ctx=await T.ctxFor(browser,{width:390,height:844,dark:true,reduced:true});
    await ctx.addInitScript(()=>{
      const actual=crypto.getRandomValues.bind(crypto);
      crypto.getRandomValues=array=>{
        if(array instanceof Uint32Array&&array.length===1){array[0]=32737;return array;}
        return actual(array);
      };
    });
    const page=await ctx.newPage(), errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(server.url+'openscied-b1-serengeti.html');
    const panel=page.locator('#sg-board-latest');
    const next=page.locator('#sg-next');
    const get=async()=>{
      await panel.waitFor();
      const labels=await panel.locator('dt').allTextContents();
      assert(labels.some(t=>/what happened/i.test(t)));
      assert(labels.some(t=>/^why[?\s]*$/i.test(t.trim())));
      assert(labels.some(t=>/what to do next/i.test(t)));
      const text=async selector=>{
        const node=panel.locator(selector);
        assert(await node.isVisible(),selector+' visible');
        const body=(await node.textContent()).trim();
        assert(body.length>6,selector+' offers meaningful text');
        return body;
      };
      return {what:await text('#sg-last'),why:await text('#sg-update-why'),next:await text('#sg-update-next')};
    };
    const seed=async game=>{
      await page.evaluate(([k,g])=>localStorage.setItem(k,JSON.stringify({v:1,game:g,answers:{},page:'play'})),[key,game]);
      await page.reload();
      await next.waitFor();
    };
    const saved=()=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)).game,key);
    const press=async action=>{
      assert.equal(await next.getAttribute('data-action'),action);
      await next.click();
    };

    const start=await get();
    assert.match(start.next,/start|winter/i);
    await page.locator('#sg-start').click();
    const migration=await get();
    assert.match(migration.next,/place|formation|migrat|winter/i);
    assert.notEqual(migration.why,start.why);
    await press('migrate');
    const draw=await get();
    assert.match(draw.next,/draw|card/i);
    assert.notEqual(draw.what,start.what);
    await page.locator('#sg-board-open').click();
    const board=page.locator('#sg-board-dialog');
    await board.locator('#sg-expanded-last-why').waitFor();
    assert.equal((await board.locator('#sg-expanded-last-text').textContent()).trim(),draw.what);
    assert.equal((await board.locator('#sg-expanded-last-why').textContent()).trim(),draw.why);
    assert.equal((await board.locator('#sg-expanded-last-next').textContent()).trim(),draw.next);
    await board.locator('#sg-board-close').click();
    await board.waitFor({state:'hidden'});
    await press('draw');
    const popup=page.locator('#sg-event-modal');
    await popup.waitFor();
    await popup.locator('.sg-event-continue').click();
    await popup.waitFor({state:'hidden'});
    const drawn=await get();
    assert.match(drawn.next,/apply|choos|select|token|square/i);
    assert.notEqual(drawn.next,draw.next);
    await press('resolveCard');
    const applied=await get();
    assert.match(applied.what,/hyena|cub|event/i);
    assert.notEqual(applied.what,draw.what);

    await seed(emptyTarget());
    const noTarget=await get();
    assert.match(noTarget.why+' '+noTarget.what,/no (?:legal|eligible|individual)|can't|cannot|none (?:avail|remain)/i);
    assert.match(noTarget.next,/continue|without|no change/i);
    const oldBoard=(await saved()).tokens;
    await press('resolveCard');
    assert.deepEqual((await saved()).tokens,oldBoard);
    assert.match((await get()).what,/no legal|didn't|unchanged|no change|without/i);

    await seed(noPredatorPairings());
    const hyena=await get();
    assert.match(hyena.why,/no |0 |side|adjacen|eligible/i);
    assert.match(hyena.next,/without|continue|lion/i);
    await press('beginHunts');
    const lion=await get();
    assert.notEqual(lion.what+' '+lion.next,hyena.what+' '+hyena.next);
    assert.match(lion.next,/without|continue|season|finish/i);

    await seed(before);
    const hunt=await get();
    assert.match(hunt.next,/roll/i);
    await press('roll');
    const tied=await get();
    assert.match(tied.what+' '+tied.why,/tie|tied|both .*keep|both .*stay/i);
    assert.match(tied.next,/roll/i);
    assert.deepEqual(await saved(),tie);
    await press('roll');
    const review=await get();
    assert.match(review.what+' '+review.why,/hunt|escap|success|predator|wildebeest/i);
    assert.match(review.next,/done|next hunt|continue|review/i);
    assert.deepEqual(await saved(),decided);
    await page.reload();
    const restoredReview=await get();
    assert.match(restoredReview.what+' '+restoredReview.why,/hunt|escap|success|predator|wildebeest/i);
    assert.equal(restoredReview.next,review.next,'the same review action remains after reload');
    await press('huntReview');
    assert.deepEqual(await saved(),decided,'review acknowledgment does not change the completed hunt');

    await seed(endpoints.winter);
    const season=await get();
    assert.match(season.what+' '+season.why,/winter|season/i);
    assert.match(season.next,/spring|evidence|continue|season/i);
    await press('nextSeason');
    assert.match((await get()).next,/spring|migrat|formation|place/i);

    await seed(endpoints.finished);
    const final=await get();
    assert.match(final.what+' '+final.why,/year|four season|complete/i);
    assert.match(final.next,/evidence|report|analy/i);
    await page.setViewportSize({width:844,height:390});
    assert.deepEqual(await get(),final,'turning the phone does not hide or change the current captions');
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'landscape captions fit without sideways overflow');
    assert.deepEqual(errors,[]);
    console.log('PASS: persistent captions from setup to year end; no target, tied dice, and reloadable review; phone portrait and landscape.');
  } finally {if(ctx)await ctx.close();await browser.close();server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
