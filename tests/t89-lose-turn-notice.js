/* Play-test Nov 20, item 5: the lose-a-turn card ("p53 will not let you pass. You lose a turn!") was invisible when
   the skip was applied: the turn counter jumped by 2 with no message. Now the turn event, the live announcer and the
   history all say "Player N loses this turn (chance card)." when the skipped turn is used up. Card 8 = lose a turn. */
const T = require('./_h');
const KEY = 'aplab:openscied:b3-cell-cycle:v1';
const sc = () => ({g1:{nutrients:3,proteins:3,organelles:3},s:{chromosomes:4},g2:{nutrients:1,proteins:1,organelles:1}});
const pl = (id, pos) => ({id,pos,score:sc(),status:'playing',turnsUsed:3,blue:0,red:0,destroyed:0,sentBack:0,skipped:0,skipTurns:0,bonusRolls:0,lastChip:null});
const saved = players => ({v:1,trials:[],fields:{},game:{schema:3,mode:players.length>1?'group':'solo',players:players.length,round:2,active:0,turns:3,complete:false,playersState:players,chanceDeck:[8,0,0,0],logs:[],lastDice:[],lastRollSummary:'',
  roundResults:{1:{blue:1,red:0,destroyed:0,sentBack:0,skipped:0,turns:75,players:1}},chanceNotice:null,event:{title:'Ready',copy:'Test',icon:'',kicker:'Cell cycle'}}});
const NOTE = 'Player 1 loses this turn (chance card).';
(async () => {
  const browser = await T.launch(), server = await T.serve();
  const ctx = await T.ctxFor(browser, {width:1919,height:1000,reduced:true});
  const p = await T.open(ctx,'openscied-b3-cell-cycle.html','cell-game',server.url);
  const read = () => p.evaluate(key => JSON.parse(localStorage.getItem(key)).game, KEY);
  const seed = async s => { await p.evaluate(({key,s}) => localStorage.setItem(key, JSON.stringify(s)), {key:KEY,s}); await p.reload(); await p.locator('.step-nav a[href="#cell-game"]').click(); await p.waitForTimeout(150); };
  const roll = async () => {
    await p.evaluate(() => { let i = 0; const v = [5,6,5,6]; Math.random = () => (v[i++ % 4] - .5) / 6; });
    const before = (await read()).turns;
    await p.locator('#roll-dice').click();
    await p.waitForFunction(({key,before}) => JSON.parse(localStorage.getItem(key)).game.turns > before, {key:KEY,before});
    await p.waitForTimeout(60);
  };
  const views = async () => ({notice: await p.locator('#event-notice').isVisible() ? await p.locator('#event-notice').textContent() : '', said: await p.locator('#game-announcer').textContent(), hist: await p.locator('#turn-history').textContent()});
  try {
    // Solo: the skipped turn is used as soon as the card is followed.
    await seed(saved([pl(1,1)])); await roll();
    T.ok((await p.locator('#chance-reveal-copy').textContent()) === 'p53 will not let you pass. You lose a turn!', 'setup: the lose-a-turn card is drawn');
    await p.locator('#chance-reveal-ack').click(); await p.waitForTimeout(80);
    let g = await read(), v = await views();
    T.ok(g.playersState[0].turnsUsed === 5, `solo: the lost turn is used (turns 3 → 5, got ${g.playersState[0].turnsUsed})`);
    T.ok(v.notice === NOTE, `solo: the turn event says "${NOTE}" (got "${v.notice}")`);
    T.ok(v.said.includes(NOTE), 'solo: the live announcer says it');
    T.ok(v.hist.includes(NOTE), 'solo: the history records it');
    // The notice belongs to that turn: the next roll clears it.
    await roll();
    T.ok(!(await views()).notice, 'the notice does not linger on the next turn');
    // Two players: the skip is applied after Player 2's roll.
    await seed(saved([pl(1,1),pl(2,10)])); await roll(); await p.locator('#chance-reveal-ack').click(); await p.waitForTimeout(60);
    T.ok(!(await views()).notice, 'two players: nothing is skipped yet when Player 1 follows the card');
    await roll();
    g = await read(); v = await views();
    T.ok(g.active === 1 && g.playersState[0].turnsUsed === 5, 'two players: after Player 2 rolls, Player 1 loses the turn and Player 2 rolls again');
    T.ok(v.notice === NOTE && v.said.includes(NOTE) && v.said.includes('Player 2’s turn') && v.hist.includes(NOTE), 'two players: event, announcer and history all name the lost turn');
    T.ok(p.errors.length === 0, 'no page errors: ' + p.errors.join('; '));
  } catch (e) { T.ok(false, 'unexpected error: ' + e.message.split('\n')[0]); }
  await browser.close(); server.close(); T.done('t89-lose-turn-notice');
})();
