/* OpenSciEd B.3 Lesson 3 Cell Game board (Reference: Game Board). Walks one cell around the board and checks the space
   order (START, 6 G1, G1 Checkpoint, 8 S, 8 G2, G2 Checkpoint, 5 M "Must Roll" 1-5, M Checkpoint, FINISH), one space per
   turn whatever the dice show, what each die value collects in each phase (Round 1 handout steps 3-6), and in Round 2
   that exactly the board's light-blue squares draw a Cellular Chance card. */
const T = require('./_h');
const KEY = 'aplab:openscied:b3-cell-cycle:v1';
const sc = (g1 = [0,0,0], s = 0, g2 = [0,0,0]) => ({g1:{nutrients:g1[0],proteins:g1[1],organelles:g1[2]},s:{chromosomes:s},g2:{nutrients:g2[0],proteins:g2[1],organelles:g2[2]}});
const pl = (id, pos, score, extra) => Object.assign({id,pos,score:score||sc(),status:'playing',turnsUsed:0,blue:0,red:0,destroyed:0,sentBack:0,skipped:0,skipTurns:0,bonusRolls:0,lastChip:null}, extra||{});
const saved = (round, players, deck) => ({v:1,trials:[],fields:{},game:{schema:3,mode:'solo',players:players.length,round,active:0,turns:0,complete:false,playersState:players,chanceDeck:deck||[],logs:[],lastDice:[],lastRollSummary:'',
  roundResults:round===2?{1:{blue:1,red:0,destroyed:0,sentBack:0,skipped:0,turns:75,players:1}}:{},chanceNotice:null,event:{title:'Ready',copy:'Test',icon:'',kicker:'Cell cycle'}}});
const EXPECTED = ['G1 space 1 of 6','G1 space 2 of 6','G1 space 3 of 6','G1 space 4 of 6','G1 space 5 of 6','G1 space 6 of 6','G1 Checkpoint',
  ...[1,2,3,4,5,6,7,8].map(n => 'S space '+n+' of 8'), ...[1,2,3,4,5,6,7,8].map(n => 'G2 space '+n+' of 8'), 'G2 Checkpoint',
  ...[1,2,3,4,5].map(n => 'M space '+n+' of 5'), 'FINISH'];
const LIGHT_BLUE = ['G1 space 2 of 6','G1 space 4 of 6','G1 space 6 of 6','S space 1 of 8','S space 3 of 8','S space 5 of 8','S space 7 of 8','G2 space 1 of 8','G2 space 3 of 8','G2 space 5 of 8','G2 space 7 of 8','M space 2 of 5','M space 4 of 5'];
(async () => {
  const browser = await T.launch(), server = await T.serve();
  const ctx = await T.ctxFor(browser, {width:1440,height:900,reduced:true});
  const p = await T.open(ctx,'openscied-b3-cell-cycle.html','cell-game',server.url);
  const read = () => p.evaluate(key => JSON.parse(localStorage.getItem(key)).game, KEY);
  const seed = async s => { await p.evaluate(({key,s}) => localStorage.setItem(key, JSON.stringify(s)), {key:KEY,s}); await p.reload(); await p.locator('.step-nav a[href="#cell-game"]').click(); await p.waitForTimeout(200);
    await p.evaluate(() => { const st = window.setTimeout; window.setTimeout = (f, ms, ...a) => st(f, Math.min(ms, 5), ...a); }); };
  const roll = async values => {
    await p.evaluate(values => { let i = 0; Math.random = () => (values[i++ % values.length] - .5) / 6; }, values);
    const before = (await read()).turns;
    await p.locator('#roll-dice').click();
    await p.waitForFunction(({key,before}) => JSON.parse(localStorage.getItem(key)).game.turns > before, {key:KEY,before}, {timeout:5000});
    const card = await p.locator('#chance-reveal-ack').isVisible();
    if (card) await p.locator('#chance-reveal-ack').click();
    return card;
  };
  // Dice: [1,2,3,4] collects one of each G1/G2 material and one chromosome; in M, roll the number the turn asks for.
  const diceFor = async () => { const m = /must roll a (\d)/.exec(await p.locator('#turn-instruction').textContent()); return m ? [Number(m[1]),6,6,6] : [1,2,3,4]; };
  try {
    // Round 1: walk the board.
    await seed(saved(1, [pl(1,0)]));
    T.ok(/START/.test(await p.locator('#position-label').textContent()), 'the cell starts on START');
    const seen = [];
    let g = await read();
    for (let turn = 0; turn < 60 && g.playersState[0].blue === 0; turn++) {
      const prev = g.playersState[0].pos;
      await roll(await diceFor()); g = await read();
      if (g.playersState[0].pos !== prev) seen.push((await p.locator('#position-label').textContent()).trim());
      if (turn === 0) {
        const q = g.playersState[0];
        T.ok(q.pos === 1 && q.score.g1.nutrients === 1 && q.score.g1.proteins === 1 && q.score.g1.organelles === 1 && q.score.s.chromosomes === 0, 'first turn: move to the first G1 space; 1, 2 and 3 check off a nutrient, protein and organelle; the 4 is ignored in G1');
      }
    }
    T.ok(seen.join('|') === EXPECTED.join('|'), `spaces in board order, one per turn (${seen.length} moves):\n      ${seen.join(', ')}`);
    const q = g.playersState[0];
    T.ok(q.blue === 1 && q.pos === 31, `after the M Checkpoint the cell divides and collects a blue chip (blue ${q.blue})`);
    T.ok(q.score.g1.nutrients === 5 && q.score.s.chromosomes === 4 && q.score.g2.organelles === 5, `scorecard boxes cap like the handout: 5 per G1/G2 material, 4 chromosomes (${JSON.stringify(q.score)})`);
    // S counts only 4s; G2 counts only 1-3; 5 and 6 count nothing.
    await seed(saved(1, [pl(1,9)])); await roll([4,4,1,5]);
    let s = (await read()).playersState[0].score;
    T.ok(s.s.chromosomes === 2 && s.g1.nutrients === 0 && s.g2.nutrients === 0, 'in S, each 4 checks off a chromosome and 1-3 are ignored');
    await seed(saved(1, [pl(1,17)])); await roll([3,4,6,5]);
    s = (await read()).playersState[0].score;
    T.ok(s.g2.organelles === 1 && s.s.chromosomes === 0 && s.g2.nutrients === 0, 'in G2, a 3 checks off an organelle; 4, 5 and 6 are ignored');
    await seed(saved(1, [pl(1,3)])); await roll([6,6,6,6]);
    T.ok((await read()).playersState[0].pos === 4, 'the dice never set the distance: a roll of four 6s still moves one space');
    // Round 2: exactly the light-blue squares draw a card (card 7, "You fill all your DNA requirements", changes no position).
    await seed(saved(2, [pl(1,0,sc([3,3,3],4,[1,1,1]))], [7]));
    const drew = [];
    g = await read();
    for (let turn = 0; turn < 60 && g.playersState[0].pos !== 31; turn++) {
      const prev = g.playersState[0].pos, card = await roll(await diceFor()); g = await read();
      if (card && g.playersState[0].pos !== prev) drew.push((await p.locator('#position-label').textContent()).trim());
    }
    T.ok(drew.join('|') === LIGHT_BLUE.join('|'), `cards are drawn on exactly the 13 light-blue squares (${drew.join(', ')})`);
    const rule = (await p.locator('#chance-space-rule').textContent()).replace(/\s+/g,' ');
    T.ok(/G1 spaces 2, 4 and 6; S spaces 1, 3, 5 and 7; G2 spaces 1, 3, 5 and 7; and M spaces 2 and 4/.test(rule) && /light blue/.test(rule), 'the rules list the light-blue squares in text, as students see them on the board');
    const route = (await p.locator('.board-route-note').textContent()).replace(/\s+/g,' ');
    T.ok(/START.*G1 ×6.*G1 Checkpoint.*S ×8.*G2 ×8.*G2 Checkpoint.*M ×5.*M Checkpoint.*FINISH/.test(route), 'the route note shows the board order with START and FINISH');
    T.ok(p.errors.length === 0, 'no page errors: ' + p.errors.join('; '));
  } catch (e) { T.ok(false, 'unexpected error: ' + e.message.split('\n')[0]); }
  await browser.close(); server.close(); T.done('t86-cell-game-board');
})();
