/* Targeted regressions from the independent post-153 audit. */
const T = require('./_h');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const KEY = 'aplab:openscied:b3-cell-cycle:v1';
const score = () => ({g1:{nutrients:3,proteins:3,organelles:3},s:{chromosomes:4},g2:{nutrients:1,proteins:1,organelles:1},m:{attachments:4}});
const player = () => ({id:1,pos:0,score:score(),status:'playing',divisions:0,unchecked:0,restarts:0,bypassed:0,skipTurns:0,bonusRolls:0});
function savedGame(round = 2) {
  return {v:1,trials:[],fields:{'analysis-design':'Keep my answer'},game:{schema:2,mode:'solo',players:1,
    round,active:0,turns:0,complete:false,playersState:[player()],chanceDeck:[11],logs:[],lastDice:[],lastRollSummary:'',
    roundResults:round===2?{1:{divisions:1,unchecked:0,restarts:0,bypassed:0,rolls:40}}:{},event:{title:'Ready',copy:'Test setup',icon:'',kicker:'Cell cycle'}}};
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
    firstDivision.game.playersState=Array.from({length:4},(_,i)=>Object.assign(player(),{id:i+1,pos:i===0?28:0}));
    await seed(firstDivision);await roll();
    assert.equal((await read()).game.playersState[0].status,'finished');
    assert.equal((await read()).game.complete,false,'one player finishing must not end the group round');
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

    // First diamond: a card fires even though no die has a 5. Card 11 bypasses two checkpoints.
    await seed(savedGame()); await roll([1,2,3,4]);
    assert.equal((await read()).game.playersState[0].bypassed,2);
    assert.equal(await p.locator('#chance-reveal').isVisible(),true);
    await p.locator('#chance-reveal-ack').click();
    await go('analyze');
    assert.match(await p.locator('#analysis-reference-data').textContent(),/Round 2 \(in progress\).*2 checkpoints bypassed/);
    await go('submit');
    assert.match(await p.locator('.report-round').last().textContent(),/Round 2 \(in progress\).*2 checkpoints bypassed/);
    // A circle does not draw a card even with four 5s. Index 2 is status Space 3.
    const circle=savedGame();circle.game.playersState[0].pos=1;
    await seed(circle); await roll([5,5,5,5]);
    assert.equal((await read()).game.playersState[0].pos,2);
    assert.equal((await read()).game.chanceNotice,undefined);
    // Matching the M-phase target and landing on a diamond draws a card.
    const mitosis=savedGame();mitosis.game.playersState[0].pos=23;mitosis.game.chanceDeck=[10];
    await seed(mitosis);await roll([1,2,3,4]);
    assert.equal((await read()).game.playersState[0].pos,24);
    assert.equal(await p.locator('#chance-reveal').isVisible(),true);
    await p.locator('#chance-reveal-ack').click();
    const missed=savedGame();missed.game.playersState[0].pos=24;
    await seed(missed);await roll([1,2,3,4]);
    assert.equal((await read()).game.playersState[0].pos,24);
    assert.equal((await read()).game.chanceNotice,undefined);
    T.ok(true,'Cards follow diamond landings, including M phase; dice 5s and missed moves do not trigger cards');

    // An incomplete spindle checkpoint holds the cell until all four modeled attachments are made.
    const spindle=savedGame(1);spindle.game.playersState[0].pos=28;spindle.game.playersState[0].score.m.attachments=0;
    await seed(spindle);await roll([1,2,3,4]);
    assert.equal((await read()).game.playersState[0].pos,29);
    assert.equal((await read()).game.playersState[0].status,'playing');
    await roll([1,2,3,4]);
    assert.equal((await read()).game.playersState[0].score.m.attachments,0);
    for(let attachments=1;attachments<=4;attachments++) {
      await roll([5,1,2,3]);
      const current=(await read()).game.playersState[0];
      assert.equal(current.score.m.attachments,attachments);
      assert.equal(current.status,attachments===4?'finished':'playing');
    }
    T.ok(true,'M checkpoint waits for four attachments; unsuccessful rolls keep the cell paused');

    const damaged=savedGame();damaged.game.playersState[0].pos=25;damaged.game.chanceDeck=[5];
    await seed(damaged);await roll([5,1,2,4]);
    assert.equal((await read()).game.playersState[0].pos,0);
    assert.equal((await read()).game.playersState[0].restarts,1);
    assert.match(await p.locator('#dice-result').textContent(),/DNA damage/);
    assert.doesNotMatch(await p.locator('#dice-result').textContent(),/Matched the required/);
    await p.locator('#chance-reveal-ack').click();
    // Short DNA at G2 returns to S; missing G2 material restarts the cell.
    for(const missing of ['dna','organelle']) {
      const saved=savedGame(1);saved.game.playersState[0].pos=22;
      if(missing==='dna')saved.game.playersState[0].score.s.chromosomes=0;
      else saved.game.playersState[0].score.g2.organelles=0;
      await seed(saved);await roll();
      const current=(await read()).game;
      assert.equal(current.playersState[0].pos,missing==='dna'?8:0);
      assert.equal(current.turns,1);assert.ok(current.logs.length>1);
      assert.equal(await p.locator('#history-count').textContent(),'1 roll');
    }
    T.ok(true,'Damage clears stale result text; both G2 failure paths and the roll-only history count');
    const unchecked=savedGame();unchecked.game.chanceDeck=[12];
    await seed(unchecked);await roll();
    assert.equal((await read()).game.complete,true);
    assert.equal((await read()).game.roundResults[2].unchecked,1);
    await p.locator('#chance-reveal-ack').click();
    assert.match(await p.locator('#round-summary').textContent(),/Round 1 and Round 2 comparison/);
    T.ok(true,'Round 2 can finish through an unchecked division and records the comparison');
    assert.deepEqual(p.errors,[]);
  } finally {await ctx.close();await browser.close();server.close();}
  T.done('cell-cycle-audit');
})().catch(error => {console.error(error);process.exitCode=1;});
