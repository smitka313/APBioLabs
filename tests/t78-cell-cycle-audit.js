/* Targeted regressions from the independent post-153 audit, updated to the OpenSciEd Cell Game rules (board indices:
   G1 1-6, G1 Checkpoint 7, S 8-15, G2 16-23, G2 Checkpoint 24, M 25-29, M Checkpoint 30, FINISH 31). */
const T = require('./_h');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const KEY = 'aplab:openscied:b3-cell-cycle:v1';
const score = () => ({g1:{nutrients:3,proteins:3,organelles:3},s:{chromosomes:4},g2:{nutrients:1,proteins:1,organelles:1}});
const player = () => ({id:1,pos:0,score:score(),status:'playing',turnsUsed:0,blue:0,red:0,destroyed:0,sentBack:0,skipped:0,skipTurns:0,bonusRolls:0,lastChip:null});
function savedGame(round = 2) {
  return {v:1,trials:[],fields:{'analysis-design':'Keep my answer'},game:{schema:3,mode:'solo',players:1,
    round,active:0,turns:0,complete:false,playersState:[player()],chanceDeck:[11],logs:[],lastDice:[],lastRollSummary:'',
    roundResults:round===2?{1:{blue:1,red:0,destroyed:0,sentBack:0,skipped:0,turns:75,players:1}}:{},chanceNotice:null,event:{title:'Ready',copy:'Test setup',icon:'',kicker:'Cell cycle'}}};
}
(async () => {
  const browser = await T.launch(), server = await T.serve();
  const ctx = await T.ctxFor(browser, {width:1440,height:900,reduced:true});
  const p = await T.open(ctx,'openscied-b3-cell-cycle.html','cell-game',server.url);
  const read = () => p.evaluate(key => JSON.parse(localStorage.getItem(key)),KEY);
  const go = async id => { await p.locator('.step-nav a[href="#'+id+'"]').click(); await p.waitForFunction(id => document.getElementById(id).classList.contains('is-current'),id); };
  async function seed(saved) {
    await p.evaluate(({key,saved}) => localStorage.setItem(key,JSON.stringify(saved)),{key:KEY,saved});
    await p.reload();
    await go('cell-game');
  }
  async function roll(values = [1,2,3,4]) {
    await p.evaluate(values => {let i=0;Math.random=()=> (values[i++%values.length]-.5)/6;},values);
    const before=(await read()).game.turns;
    await p.locator('#roll-dice').click();
    await p.waitForFunction(({key,before}) => JSON.parse(localStorage.getItem(key)).game.turns>before,{key:KEY,before});
  }
  try {
    await p.locator('#start-round1').click();
    await roll();
    await p.locator('#restart-round').click();
    assert.equal(await p.locator('#game-reset-dialog').isVisible(),true);
    await p.locator('#cancel-game-reset').click();
    assert.equal((await read()).game.turns,1,'Cancel preserves the round');
    await p.locator('#restart-round').click(); await p.keyboard.press('Escape');
    assert.equal((await read()).game.turns,1,'Escape preserves the round');
    await p.locator('#restart-round').click(); await p.locator('#confirm-game-reset').click();
    assert.equal((await read()).game.turns,0,'Visible confirmation restarts the round');
    await p.locator('#reset-game').click(); await p.locator('#confirm-game-reset').click();
    await p.locator('input[name="game-mode"][value="group"]').check();
    await p.locator('#group-size').selectOption('4'); await p.locator('#start-round1').click();
    for(let i=0;i<4;i++) {
      assert.equal((await read()).game.active,i);
      assert.match(await p.locator('.player-score.is-active .score-player').textContent(),new RegExp('Player '+(i+1)));
      await roll();
    }
    const group=(await read()).game;
    assert.equal(group.active,0); assert.equal(group.playersState.length,4);
    group.playersState.forEach(player => {assert.equal(player.pos,1);assert.equal(player.score.g1.nutrients,1);});
    const firstDivision=savedGame(1);firstDivision.game.mode='group';firstDivision.game.players=4;
    firstDivision.game.playersState=Array.from({length:4},(_,i)=>Object.assign(player(),{id:i+1,pos:i===0?29:0}));
    await seed(firstDivision);await roll();
    assert.equal((await read()).game.playersState[0].blue,1);
    assert.equal((await read()).game.complete,false,'one player dividing must not end the group round');
    assert.equal((await read()).game.active,1);
    T.ok(true,'Visible reset/cancel controls and four independent player turns');

    fs.mkdirSync(path.join(T.ROOT,'test-artifacts'),{recursive:true});
    for(const [width,height] of [[1920,1000],[1440,900],[1366,768],[390,844],[768,1024],[1024,768]]) {
      await p.setViewportSize({width,height}); await go('cell-game'); await p.waitForTimeout(150);
      await p.screenshot({path:path.join(T.ROOT,'test-artifacts','cell-cycle-'+width+'x'+height+'.png')});
      assert.equal(await p.evaluate(() => document.documentElement.scrollWidth>innerWidth),false,width+'px: no page overflow');
      if(width>=1100) {
        const button=await p.locator('#roll-dice').boundingBox(),board=await p.locator('#cell-board').boundingBox();
        assert.ok(button.y>=0&&button.y+button.height<=height,width+'px: Roll stays above the fold '+JSON.stringify({button,board,height}));
        assert.ok(board.y>=0&&board.y+board.height<=height,width+'px: full board stays above the fold');
        assert.equal(await p.locator('#cycle-scene').evaluate(el => getComputedStyle(el).objectFit),'contain');
        const question=await p.locator('.mechanism-check').boundingBox();
        assert.ok(question.y>=board.y+board.height,width+'px: reasoning question stays below the play area');
      }
    }
    T.ok(true,'Six desktop/tablet/mobile viewports; full canvas and Roll visible on desktop');
    await p.setViewportSize({width:1440,height:900});

    // First light-blue square (G1 space 2): a card fires even though no die has a 5. Card 11 skips two checkpoints:
    // it skips the G1 Checkpoint and checks at the G2 Checkpoint.
    const first=savedGame();first.game.playersState[0].pos=1;
    await seed(first); await roll([1,2,3,4]);
    assert.equal((await read()).game.playersState[0].skipped,1);
    assert.equal((await read()).game.playersState[0].pos,24);
    assert.equal(await p.locator('#chance-reveal').isVisible(),true);
    await p.locator('#chance-reveal-ack').click();
    await go('analyze');
    assert.match(await p.locator('#analysis-reference-data').textContent(),/Round 2 \(in progress\).*Checkpoints skipped: 1/);
    await go('submit');
    assert.match(await p.locator('.report-round').last().textContent(),/Round 2 \(in progress\).*Checkpoints skipped: 1/);
    // A square that is not light blue draws no card even with four 5s.
    const plain=savedGame();plain.game.playersState[0].pos=2;
    await seed(plain); await roll([5,5,5,5]);
    assert.equal((await read()).game.playersState[0].pos,3);
    assert.equal((await read()).game.chanceNotice,null);
    // Matching the M-phase number and landing on a light-blue square (M space 2) draws a card.
    const mitosis=savedGame();mitosis.game.playersState[0].pos=25;mitosis.game.chanceDeck=[7];
    await seed(mitosis);await roll([2,6,6,6]);
    assert.equal((await read()).game.playersState[0].pos,26);
    assert.equal(await p.locator('#chance-reveal').isVisible(),true);
    await p.locator('#chance-reveal-ack').click();
    const missed=savedGame();missed.game.playersState[0].pos=25;
    await seed(missed);await roll([1,3,4,5]);
    assert.equal((await read()).game.playersState[0].pos,25);
    assert.equal((await read()).game.chanceNotice,null);
    T.ok(true,'Cards follow light-blue landings, including M phase; dice values and missed moves do not trigger cards');

    // M phase: each space needs its number; the M Checkpoint double-checks the scorecard and divides into a blue chip.
    const mphase=savedGame(1);mphase.game.playersState[0].pos=24;
    await seed(mphase);
    for(const need of [1,2,3,4,5]) {
      await roll([6,6,6,6]);
      assert.equal((await read()).game.playersState[0].pos,23+need,'a miss does not move');
      await roll([need,6,6,6]);
      assert.equal((await read()).game.playersState[0].pos,24+need);
    }
    await roll([1]);
    assert.equal((await read()).game.playersState[0].blue,1);
    assert.equal((await read()).game.playersState[0].pos,31);
    T.ok(true,'M phase needs 1-5 in order; the M Checkpoint divides a complete cell into a blue chip');

    const damaged=savedGame();damaged.game.playersState[0].pos=25;damaged.game.chanceDeck=[5];
    await seed(damaged);await roll([2,1,3,4]);
    assert.equal((await read()).game.playersState[0].pos,0);
    assert.equal((await read()).game.playersState[0].destroyed,1);
    assert.match(await p.locator('#dice-result').textContent(),/destroys your cell/);
    await p.locator('#chance-reveal-ack').click();
    // Short DNA sends the cell back to the first S space; a missing G2 material destroys it (G2 card).
    for(const [missing,pos] of [['dna',8],['organelle',0]]) {
      const saved=savedGame(1);saved.game.playersState[0].pos=23;
      if(missing==='dna')saved.game.playersState[0].score.s.chromosomes=3;
      else saved.game.playersState[0].score.g2.organelles=0;
      await seed(saved);await roll();
      const current=(await read()).game;
      assert.equal(current.playersState[0].pos,pos);
      assert.equal(current.turns,1);assert.ok(current.logs.length>=1);
      assert.equal(await p.locator('#history-count').textContent(),'1 turn');
    }
    T.ok(true,'Damage card clears stale result text; both G2 Checkpoint outcomes and the turn-only history count');
    const finish=savedGame();finish.game.playersState[0].pos=1;finish.game.playersState[0].turnsUsed=74;finish.game.chanceDeck=[12];
    await seed(finish);await roll();
    assert.equal((await read()).game.complete,true);
    assert.equal((await read()).game.roundResults[2].red,1);
    await p.locator('#chance-reveal-ack').click();
    assert.match(await p.locator('#round-summary').textContent(),/Round 1 and Round 2/);
    T.ok(true,'Round 2 can end on a red chip from "Move directly to Finish" and records the comparison');
    assert.deepEqual(p.errors,[]);
  } finally {await ctx.close();await browser.close();server.close();}
  T.done('cell-cycle-audit');
})().catch(error => {console.error(error);process.exitCode=1;});
