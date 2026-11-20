/* Round 2 Cellular Chance cards (Teacher Reference: Game Cards 2; Round 2 handout). Checks the 13-card deck (the printed
   set has 14 with three "destroys your cell" cards; the handout and TE say 13, so the deck keeps two), each card's exact
   wording and effect, red chips, and that cards go back on the bottom of the stack.
   Card indices: 0-4 extra roll, 5-6 destroy, 7 DNA, 8 lose a turn, 9 move ahead 3, 10 skip the next checkpoint,
   11 skip two checkpoints, 12 move directly to Finish. Board: G1 1-6, G1 Checkpoint 7, S 8-15, G2 16-23,
   G2 Checkpoint 24, M 25-29, M Checkpoint 30, FINISH 31. Light-blue squares: 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 26, 28. */
const T = require('./_h');
const KEY = 'aplab:openscied:b3-cell-cycle:v1';
const sc = (g1 = [3,3,3], s = 4, g2 = [1,1,1]) => ({g1:{nutrients:g1[0],proteins:g1[1],organelles:g1[2]},s:{chromosomes:s},g2:{nutrients:g2[0],proteins:g2[1],organelles:g2[2]}});
const empty = () => sc([0,0,0],0,[0,0,0]);
const pl = (id, pos, score, extra) => Object.assign({id,pos,score:score||sc(),status:'playing',turnsUsed:0,blue:0,red:0,destroyed:0,sentBack:0,skipped:0,skipTurns:0,bonusRolls:0,lastChip:null}, extra||{});
const saved = (players, deck) => ({v:1,trials:[],fields:{},game:{schema:3,mode:players.length>1?'group':'solo',players:players.length,round:2,active:0,turns:0,complete:false,playersState:players,chanceDeck:deck,logs:[],lastDice:[],lastRollSummary:'',
  roundResults:{1:{blue:1,red:0,destroyed:0,sentBack:0,skipped:0,turns:75,players:1}},chanceNotice:null,event:{title:'Ready',copy:'Test',icon:'',kicker:'Cell cycle'}}});
const WELL = 'p53 is working well!', NOT = 'p53 is not working!';
const TEXT = {
  extra: 'You get an extra roll!',
  destroy: 'p53 detects damage to your DNA and destroys your cell. Go back to the start.',
  dna: 'You fill all your DNA requirements for this round!',
  lose: 'p53 will not let you pass. You lose a turn!',
  ahead3: 'Move ahead 3 spaces.',
  skipNext: 'Move your game piece to the space after the next checkpoint without checking your scorecard.',
  skipTwo: 'Skip ahead two checkpoints and check your scorecard. If there’s only one checkpoint left, skip to the final checkpoint and check your scorecard.',
  finish: 'Move directly to Finish. Collect a new RED cell chip and start the game again.'};
(async () => {
  const browser = await T.launch(), server = await T.serve();
  const ctx = await T.ctxFor(browser, {width:1440,height:900,reduced:true});
  const p = await T.open(ctx,'openscied-b3-cell-cycle.html','cell-game',server.url);
  const read = () => p.evaluate(key => JSON.parse(localStorage.getItem(key)).game, KEY);
  const seed = async s => { await p.evaluate(({key,s}) => localStorage.setItem(key, JSON.stringify(s)), {key:KEY,s}); await p.reload(); await p.locator('.step-nav a[href="#cell-game"]').click(); await p.waitForTimeout(200); };
  let lastCard = null;
  const roll = async (values, keepCard) => {
    await p.evaluate(values => { let i = 0; Math.random = () => (values[i++ % values.length] - .5) / 6; }, values);
    const before = (await read()).turns;
    await p.locator('#roll-dice').click();
    await p.waitForFunction(({key,before}) => JSON.parse(localStorage.getItem(key)).game.turns > before, {key:KEY,before}, {timeout:5000});
    lastCard = null;
    if (await p.locator('#chance-reveal').isVisible()) {
      lastCard = {title: await p.locator('#chance-reveal-title').textContent(), copy: await p.locator('#chance-reveal-copy').textContent(),
        notWorking: await p.locator('#chance-reveal').evaluate(el => el.classList.contains('is-not-working'))};
      if (!keepCard) await p.locator('#chance-reveal-ack').click();
    }
    if (await p.locator('#checkpoint-reveal-ack').isVisible()) await p.locator('#checkpoint-reveal-ack').click();   // a checkpoint card: follow it
    return read();
  };
  const ONE = [1,2,3,4];
  try {
    // Deck: 13 cards, one of each index, shuffled at the start of Round 2.
    await seed(saved([pl(1,0)], []));
    await p.evaluate(key => { const s = JSON.parse(localStorage.getItem(key)); s.game.round = 1; s.game.roundResults = {}; s.game.complete = true; s.game.roundResults[1] = {blue:1,red:0,destroyed:0,sentBack:0,skipped:0,turns:75,players:1}; localStorage.setItem(key, JSON.stringify(s)); }, KEY);
    await p.reload(); await p.locator('.step-nav a[href="#cell-game"]').click();
    await p.locator('#start-round2-from-summary').click();
    const deck = (await read()).chanceDeck;
    T.ok(deck.length === 13 && [...deck].sort((a,b)=>a-b).join() === '0,1,2,3,4,5,6,7,8,9,10,11,12', `Round 2 starts with a 13-card Cellular Chance deck (${deck.join(',')})`);
    // Wording and composition: draw each card once from G1 space 1 onto the light-blue G1 space 2.
    const counts = {};
    for (let i = 0; i < 13; i++) {
      await seed(saved([pl(1,1)], [i])); await roll(ONE);
      const key = lastCard.title + ' ' + lastCard.copy; counts[key] = (counts[key] || 0) + 1;
      T.ok((lastCard.title === NOT) === lastCard.notWorking, `card ${i}: "${lastCard.title}" ${lastCard.notWorking ? 'shows the "not working" style' : 'shows the "working well" style'}`);
    }
    const want = {[WELL+' '+TEXT.extra]:5,[WELL+' '+TEXT.destroy]:2,[WELL+' '+TEXT.dna]:1,[NOT+' '+TEXT.lose]:1,[NOT+' '+TEXT.ahead3]:1,[NOT+' '+TEXT.skipNext]:1,[NOT+' '+TEXT.skipTwo]:1,[NOT+' '+TEXT.finish]:1};
    T.ok(JSON.stringify(Object.keys(want).sort().map(k => [k, counts[k]])) === JSON.stringify(Object.keys(want).sort().map(k => [k, want[k]])) && Object.keys(counts).length === 8,
      'deck composition and exact card text: 5 extra roll, 2 destroy, 1 DNA, lose a turn, move ahead 3, skip the next checkpoint, skip two checkpoints, move directly to Finish');
    // The card goes back on the bottom of the stack.
    await seed(saved([pl(1,1)], [7,0,1])); await roll(ONE);
    T.ok((await read()).chanceDeck.join() === '0,1,7', 'the drawn card goes to the bottom of the stack');
    // Extra roll: roll again without moving; it does not use one of the round's turns.
    await seed(saved([pl(1,1)], [0])); let g = await roll(ONE);
    T.ok(g.playersState[0].bonusRolls === 1 && g.active === 0 && /Take your extra roll/.test(await p.locator('#roll-dice').textContent()), 'extra roll: the same player rolls again');
    g = await roll([1,1,1,1]); let q = g.playersState[0];
    T.ok(q.pos === 2 && q.score.g1.nutrients === 5 && q.turnsUsed === 1 && q.bonusRolls === 0, `extra roll: no move, collects for G1, does not use a turn (pos ${q.pos}, nutrients ${q.score.g1.nutrients}, turns ${q.turnsUsed})`);
    // Destroy: back to the START with a new scorecard.
    await seed(saved([pl(1,1)], [5])); q = (await roll(ONE)).playersState[0];
    T.ok(q.pos === 0 && q.destroyed === 1 && q.score.g1.nutrients === 0, 'p53 detects DNA damage: the cell is destroyed and goes back to the START with a new scorecard');
    // DNA: fills the S chromosomes in any phase.
    await seed(saved([pl(1,1,empty())], [7])); q = (await roll(ONE)).playersState[0];
    T.ok(q.score.s.chromosomes === 4 && q.pos === 2, 'You fill all your DNA requirements: all 4 chromosomes checked even in G1');
    // Lose a turn (two players): Player 1's next turn is skipped.
    await seed(saved([pl(1,1),pl(2,10)], [8])); await roll(ONE); g = await roll(ONE);
    T.ok(g.active === 1 && g.playersState[0].turnsUsed === 2 && g.playersState[0].pos === 2 && g.playersState[0].skipTurns === 0, `lose a turn: after Player 2 rolls, Player 1 is skipped and Player 2 rolls again (active ${g.active})`);
    // Move ahead 3: over a checkpoint (skipped, not checked) or onto one (checked).
    await seed(saved([pl(1,5,empty())], [9])); q = (await roll(ONE)).playersState[0];
    T.ok(q.pos === 9 && q.skipped === 1, `move ahead 3 from G1 space 6 jumps the G1 Checkpoint without a check (pos ${q.pos}, skipped ${q.skipped})`);
    await seed(saved([pl(1,3,sc([2,3,3],0,[0,0,0]))], [9])); q = (await roll([6,6,6,6])).playersState[0];
    T.ok(q.pos === 4 && q.sentBack === 1 && q.skipped === 0, `move ahead 3 from G1 space 4 lands on the G1 Checkpoint, which checks: a 2 sends it back 3 (pos ${q.pos})`);
    // Skip the next checkpoint without checking.
    await seed(saved([pl(1,1,empty())], [10])); q = (await roll([6,6,6,6])).playersState[0];
    T.ok(q.pos === 8 && q.skipped === 1 && q.destroyed === 0, 'skip the next checkpoint: an empty cell moves to the first S space, unchecked');
    await seed(saved([pl(1,25,sc([3,3,3],4,[0,1,1]))], [10])); q = (await roll([2,6,6,6])).playersState[0];
    T.ok(q.pos === 31 && q.red === 1 && q.lastChip === 'red', 'skip the M Checkpoint with a requirement missing: FINISH and a red chip');
    await seed(saved([pl(1,25)], [10])); q = (await roll([2,6,6,6])).playersState[0];
    T.ok(q.pos === 31 && q.blue === 1 && q.red === 0, 'skip the M Checkpoint with a complete scorecard: FINISH and a blue chip');
    // Skip two checkpoints and check: lands on the second one, which checks.
    await seed(saved([pl(1,1)], [11])); q = (await roll(ONE)).playersState[0];
    T.ok(q.pos === 24 && q.skipped === 1, `skip two checkpoints from G1: skips the G1 Checkpoint and checks at the G2 Checkpoint, which passes (pos ${q.pos})`);
    await seed(saved([pl(1,1,sc([3,3,3],0,[1,1,1]))], [11])); q = (await roll([6,6,6,6])).playersState[0];
    T.ok(q.pos === 0 && q.destroyed === 1, 'skip two checkpoints with no DNA: the G2 Checkpoint check destroys the cell');
    await seed(saved([pl(1,27)], [11])); q = (await roll([4,6,6,6])).playersState[0];
    T.ok(q.blue === 1 && q.skipped === 0 && q.pos === 31, 'only one checkpoint left: skip to the M Checkpoint, check, and divide (blue chip)');
    // Move directly to Finish: red chip, then start again.
    await seed(saved([pl(1,1)], [12])); g = await roll(ONE, true);
    T.ok(/RED cell chip/.test(await p.locator('#chance-reveal-effect').textContent()), 'the card reveal explains the red chip');
    await p.locator('#chance-reveal-ack').click(); g = await read(); q = g.playersState[0];
    T.ok(q.pos === 31 && q.red === 1 && q.lastChip === 'red', 'move directly to Finish: a RED cell chip');
    T.ok(/1 red/.test(await p.locator('.player-score').first().textContent()), 'the scorecard shows the red chip with its count in text');
    q = (await roll(ONE)).playersState[0];
    T.ok(q.pos === 1 && q.score.g1.nutrients === 1 && q.score.s.chromosomes === 0, 'start the game again: the next turn begins a new cell on the first G1 space');
    // Chance cards are drawn only on a normal move: not on a missed M roll, not after a checkpoint, not on an extra roll.
    await seed(saved([pl(1,25)], [7])); g = await roll([6,6,6,6]);
    T.ok(!g.chanceNotice && !lastCard, 'a missed M roll on the way to a light-blue square draws no card');
    // Checkpoint cards still apply in Round 2.
    await seed(saved([pl(1,6,sc([1,3,3],0,[0,0,0]))], [7])); q = (await roll(ONE)).playersState[0];
    T.ok(q.pos === 2 && !lastCard, 'checkpoint cards still apply in Round 2 (G1 Checkpoint: a 1 sends the cell back 5 spaces; landing there by card draws nothing)');
    T.ok(p.errors.length === 0, 'no page errors: ' + p.errors.join('; '));
  } catch (e) { T.ok(false, 'unexpected error: ' + e.message.split('\n')[0]); }
  await browser.close(); server.close(); T.done('t86-cell-game-chance-cards');
})();
