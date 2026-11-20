/* Checkpoint cards (Teacher Reference: Game Cards 1) and the M phase (Round 1 handout step 8, TE p20).
   G1: 0 in any category -> destroyed by p53, back to the START; 1 -> go back 5 spaces; 2 -> go back 3 spaces; 3+ -> pass.
   G2: 0 in any category -> destroyed by p53; fewer than 4 DNA -> back to the first S space; else pass.
   M: roll 1, 2, 3, 4, 5 in order (a 1 to leave the G2 Checkpoint); the M Checkpoint double-checks the whole scorecard and
   a complete one divides into a new blue chip. Board indices: G1 1-6, G1 Checkpoint 7, S 8-15, G2 16-23, G2 Checkpoint 24,
   M 25-29, M Checkpoint 30, FINISH 31. */
const T = require('./_h');
const KEY = 'aplab:openscied:b3-cell-cycle:v1';
const sc = (g1 = [3,3,3], s = 4, g2 = [1,1,1]) => ({g1:{nutrients:g1[0],proteins:g1[1],organelles:g1[2]},s:{chromosomes:s},g2:{nutrients:g2[0],proteins:g2[1],organelles:g2[2]}});
const pl = (id, pos, score, extra) => Object.assign({id,pos,score:score||sc(),status:'playing',turnsUsed:0,blue:0,red:0,destroyed:0,sentBack:0,skipped:0,skipTurns:0,bonusRolls:0,lastChip:null}, extra||{});
const saved = (round, players, deck) => ({v:1,trials:[],fields:{},game:{schema:3,mode:'solo',players:players.length,round,active:0,turns:0,complete:false,playersState:players,chanceDeck:deck||[],logs:[],lastDice:[],lastRollSummary:'',
  roundResults:round===2?{1:{blue:1,red:0,destroyed:0,sentBack:0,skipped:0,turns:75,players:1}}:{},chanceNotice:null,event:{title:'Ready',copy:'Test',icon:'',kicker:'Cell cycle'}}});
(async () => {
  const browser = await T.launch(), server = await T.serve();
  const ctx = await T.ctxFor(browser, {width:1440,height:900,reduced:true});
  const p = await T.open(ctx,'openscied-b3-cell-cycle.html','cell-game',server.url);
  const read = () => p.evaluate(key => JSON.parse(localStorage.getItem(key)).game, KEY);
  const seed = async s => { await p.evaluate(({key,s}) => localStorage.setItem(key, JSON.stringify(s)), {key:KEY,s}); await p.reload(); await p.locator('.step-nav a[href="#cell-game"]').click(); await p.waitForTimeout(200); };
  const roll = async values => {
    await p.evaluate(values => { let i = 0; Math.random = () => (values[i++ % values.length] - .5) / 6; }, values);
    const before = (await read()).turns;
    await p.locator('#roll-dice').click();
    await p.waitForFunction(({key,before}) => JSON.parse(localStorage.getItem(key)).game.turns > before, {key:KEY,before}, {timeout:5000});
    if (await p.locator('#chance-reveal-ack').isVisible()) await p.locator('#chance-reveal-ack').click();
    return (await read());
  };
  try {
    // G1 Checkpoint: the piece moves onto the checkpoint (no dice) and the card is applied.
    for (const [g1, pos, what] of [[[0,3,3],0,'a 0: destroyed by p53, back to the START'],[[1,4,5],2,'a 1: go back 5 spaces'],[[2,3,3],4,'a 2: go back 3 spaces'],[[2,1,5],2,'lowest category decides (1): go back 5 spaces'],[[3,3,3],7,'3 of each: pass, piece stays on the checkpoint']]) {
      await seed(saved(1, [pl(1,6,sc(g1,0,[0,0,0]))]));
      T.ok(/Turn over the G1 Checkpoint card/.test(await p.locator('#roll-dice').textContent()), `button reads "Turn over the G1 Checkpoint card" (${(await p.locator('#roll-dice').textContent()).trim()})`);
      const g = await roll([1,2,3,4]), q = g.playersState[0];
      T.ok(q.pos === pos, `G1 Checkpoint with ${g1.join('/')}: ${what} (pos ${q.pos})`);
      T.ok(g.lastDice.length === 0, 'no dice are rolled for the checkpoint card');
      if (pos === 0) T.ok(q.destroyed === 1 && q.score.g1.proteins === 0 && /destroyed by p53/i.test(g.event.title), `destroyed: new scorecard and the event names p53 ("${g.event.title}")`);
      else if (pos < 7) T.ok(q.sentBack === 1 && q.score.g1.nutrients === g1[0], `sent back: the scorecard keeps its check marks ("${g.event.title}")`);
      else T.ok(g.event.kicker === 'Checkpoint passed' && /YOU PASS/.test(g.event.title), `passed ("${g.event.title}")`);
    }
    // A cell sent back collects again on the G1 spaces it repeats.
    await seed(saved(1, [pl(1,6,sc([2,3,3],0,[0,0,0]))])); await roll([1]); let g = await roll([1,1,6,6]);
    T.ok(g.playersState[0].pos === 5 && g.playersState[0].score.g1.nutrients === 4, 'after going back 3, the next turns collect again (nutrients 2 -> 4)');
    // G2 Checkpoint.
    for (const [s, g2, pos, what] of [[0,[1,1,1],0,'0 DNA: destroyed by p53'],[4,[0,2,2],0,'a 0 nutrient: destroyed by p53'],[2,[0,1,1],0,'a 0 beats fewer than 4 DNA: destroyed'],[3,[1,1,1],8,'fewer than 4 DNA: back to the first S space'],[4,[1,1,1],24,'4 DNA and 1 of each: pass']]) {
      await seed(saved(1, [pl(1,23,sc([3,3,3],s,g2))]));
      g = await roll([1,2,3,4]); const q = g.playersState[0];
      T.ok(q.pos === pos, `G2 Checkpoint with ${s} DNA and G2 ${g2.join('/')}: ${what} (pos ${q.pos}, "${g.event.title}")`);
      if (pos === 8) T.ok(q.sentBack === 1 && q.score.s.chromosomes === 3 && /FIRST SPACE/.test(g.event.title), 'back to the first S space keeps the 3 chromosomes');
    }
    await seed(saved(1, [pl(1,23,sc([3,3,3],3,[1,1,1]))])); await roll([1]);
    g = await roll([4,1,1,1]);
    T.ok(g.playersState[0].pos === 9 && g.playersState[0].score.s.chromosomes === 4, 'from the first S space, a 4 completes the DNA');
    // M phase: roll 1 to leave the G2 Checkpoint, then 2, 3, 4, 5 in order; a miss does not move.
    await seed(saved(1, [pl(1,24)]));
    T.ok(/must roll a 1/.test(await p.locator('#turn-instruction').textContent()), 'on the G2 Checkpoint the instruction says you must roll a 1');
    g = await roll([2,3,4,5]); T.ok(g.playersState[0].pos === 24, 'no 1: the cell does not move');
    const path = [];
    for (const need of [1,2,3,4,5]) {
      g = await roll([6, 6, 6, 6]); const stayed = g.playersState[0].pos;
      g = await roll([need, 6, 6, 6]); path.push(stayed + '->' + g.playersState[0].pos);
    }
    T.ok(path.join(' ') === '24->25 25->26 26->27 27->28 28->29', `a roll of 6s waits; each M space then needs its own number, in order (${path.join(' ')})`);
    T.ok(JSON.stringify(g.playersState[0].score) === JSON.stringify(sc()), 'M spaces collect nothing on the scorecard');
    await seed(saved(1, [pl(1,25)])); g = await roll([3,4,5,6]);
    T.ok(g.playersState[0].pos === 25, 'M spaces cannot be skipped: from Must roll 1, a 3, 4, 5 and 6 do not move the cell');
    // M Checkpoint double-check.
    await seed(saved(1, [pl(1,29)])); g = await roll([1]);
    T.ok(g.playersState[0].pos === 31 && g.playersState[0].blue === 1 && /SUCCESSFULLY DIVIDED/.test(g.event.title), `complete scorecard: YOU SUCCESSFULLY DIVIDED, blue chip, piece on FINISH ("${g.event.title}")`);
    g = await roll([1,2,3,4]);
    T.ok(g.playersState[0].pos === 1 && g.playersState[0].score.g1.nutrients === 1 && g.playersState[0].score.s.chromosomes === 0, 'the next turn starts a new cell on the first G1 space with a new scorecard');
    for (const [score, what] of [[sc([2,3,3]),'G1 short'],[sc([3,3,3],3),'DNA short'],[sc([3,3,3],4,[1,0,1]),'G2 short']]) {
      await seed(saved(2, [pl(1,29,score)])); g = await roll([1]);
      T.ok(g.playersState[0].pos === 0 && g.playersState[0].destroyed === 1 && g.playersState[0].blue === 0, `M Checkpoint double-check catches ${what}: destroyed by p53, no chip`);
    }
    await seed(saved(1, [pl(1,27)]));
    const mcard = (await p.locator('#checkpoint-requirements').textContent()).replace(/\s+/g,' ');
    T.ok(/G1 · 3 of each.*S · DNA.*G2 · 1 of each/.test(mcard), `in M, the next-checkpoint card lists the whole scorecard ("${mcard}")`);
    T.ok(p.errors.length === 0, 'no page errors: ' + p.errors.join('; '));
  } catch (e) { T.ok(false, 'unexpected error: ' + e.message.split('\n')[0]); }
  await browser.close(); server.close(); T.done('t86-cell-game-checkpoints');
})();
