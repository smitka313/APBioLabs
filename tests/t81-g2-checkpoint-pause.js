/* G2 Checkpoint, missing material (Teacher Reference: Game Cards 1, G2 card): "A 0 in any category, YOU HAVE BEEN
   DESTROYED by p53 AND MUST GO BACK TO THE START." A complete card passes, and the cell then needs a 1 to enter M.
   The Round 2 "p53 detects damage to your DNA" card also destroys the cell. The rules text matches.
   (Earlier rules paused the cell on the checkpoint.) Board: G2 16-23, G2 Checkpoint 24, M 25-29. */
const T = require('./_h');
const KEY = 'aplab:openscied:b3-cell-cycle:v1';
const full = () => ({g1:{nutrients:3,proteins:3,organelles:3},s:{chromosomes:4},g2:{nutrients:1,proteins:1,organelles:1}});
const pl = (pos, score) => ({id:1,pos,score:score||full(),status:'playing',turnsUsed:0,blue:0,red:0,destroyed:0,sentBack:0,skipped:0,skipTurns:0,bonusRolls:0,lastChip:null});
const saved = (round, player, deck) => ({v:1,trials:[],fields:{},game:{schema:3,mode:'solo',players:1,round,active:0,turns:0,complete:false,
  playersState:[player],chanceDeck:deck||[],logs:[],lastDice:[],lastRollSummary:'',roundResults:round===2?{1:{blue:1,red:0,destroyed:0,sentBack:0,skipped:0,turns:75,players:1}}:{},chanceNotice:null,
  event:{title:'Ready',copy:'Test setup',icon:'',kicker:'Cell cycle'}}});
(async () => {
  const browser = await T.launch(), server = await T.serve();
  const ctx = await T.ctxFor(browser, {width:1440,height:900,reduced:true});
  const p = await T.open(ctx,'openscied-b3-cell-cycle.html','cell-game',server.url);
  const read = () => p.evaluate(key => JSON.parse(localStorage.getItem(key)).game, KEY);
  const go = async id => { await p.locator('.step-nav a[href="#'+id+'"]').click(); await p.waitForFunction(id => document.getElementById(id).classList.contains('is-current'), id); };
  const seed = async s => { await p.evaluate(({key,s}) => localStorage.setItem(key, JSON.stringify(s)), {key:KEY,s}); await p.reload(); await go('cell-game'); };
  const roll = async values => {
    await p.evaluate(values => { let i = 0; Math.random = () => (values[i++ % values.length] - .5) / 6; }, values);
    const before = (await read()).turns;
    await p.locator('#roll-dice').click();
    await p.waitForFunction(({key,before}) => JSON.parse(localStorage.getItem(key)).game.turns > before, {key:KEY,before}, {timeout:5000}).catch(() => {});
    const ack = p.locator('#chance-reveal-ack'); if (await ack.isVisible()) await ack.click();
    if (await p.locator('#checkpoint-reveal-ack').isVisible()) await p.locator('#checkpoint-reveal-ack').click();   // a checkpoint card: follow it
  };
  try {
    const score = full(); score.g2.organelles = 0;
    await seed(saved(1, pl(23, score)));
    T.ok(/G2 Checkpoint/.test(await p.locator('#turn-instruction').textContent()), 'the turn instruction says the next move is onto the G2 Checkpoint');
    await roll([1,2,4,4]);
    let g = await read(), q = g.playersState[0];
    T.ok(q.pos === 0 && q.destroyed === 1, `0 organelles at the G2 Checkpoint: destroyed by p53, back to the START (pos ${q.pos})`);
    T.ok(q.score.g1.nutrients === 0 && q.score.s.chromosomes === 0, 'the destroyed cell is replaced by a new cell with an empty scorecard');
    T.ok(/YOU HAVE BEEN DESTROYED by p53/.test(g.event.title), `event uses the card wording ("${g.event.title}")`);
    T.ok(/destroyed by p53/i.test(await p.locator('#game-announcer').textContent()), 'the outcome is announced');
    await seed(saved(1, pl(23)));
    await roll([1,2,3,4]); g = await read();
    T.ok(g.playersState[0].pos === 24 && g.event.kicker === 'Checkpoint passed', 'a complete G2 card passes; the cell waits on the checkpoint');
    await roll([2,3,4,5]);
    T.ok((await read()).playersState[0].pos === 24, 'without a 1 the cell stays on the G2 Checkpoint');
    await roll([1,6,6,6]);
    T.ok((await read()).playersState[0].pos === 25, 'a 1 moves it to M space 1 (Must roll 1)');
    // Round 2: "p53 detects damage to your DNA and destroys your cell. Go back to the start." (card 5) from M space 1 onto M space 2.
    await seed(saved(2, pl(25), [5]));
    await roll([2,6,6,6]);
    q = (await read()).playersState[0];
    T.ok(q.pos === 0 && q.destroyed === 1, 'the Round 2 DNA-damage card destroys the cell and sends it to the START');
    const rules = (await p.locator('.game-rules').textContent()).replace(/\s+/g,' ');
    T.ok(/a 0 in any category means destroyed by p53, back to the START/.test(rules) && /fewer than 4 DNA sends you back to the first S space/.test(rules) && !/never sends it back/.test(rules), 'rules text gives the G2 card outcomes');
    T.ok(p.errors.length === 0, 'no page errors: ' + p.errors.join('; '));
  } catch (e) { T.ok(false, 'unexpected error: ' + e.message.split('\n')[0]); }
  await browser.close(); server.close(); T.done('t81-g2-checkpoint-pause');
})();
