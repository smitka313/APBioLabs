/* Play-test Nov 20, item 2: after "End this round now" the page said "Every player has used 75 turns" although the
   players had used 45 and 47. Every round-end message now states the actual reason (turn limit or ended early) and the
   real turn counts, and the rules say that a division does not end the round (behavior unchanged: a round ends only
   at the turn limit or with "End this round now"). */
const T = require('./_h');
const KEY = 'aplab:openscied:b3-cell-cycle:v1';
const full = () => ({g1:{nutrients:3,proteins:3,organelles:3},s:{chromosomes:4},g2:{nutrients:1,proteins:1,organelles:1}});
const pl = (id, pos, extra) => Object.assign({id,pos,score:full(),status:'playing',turnsUsed:0,blue:0,red:0,destroyed:0,sentBack:0,skipped:0,skipTurns:0,bonusRolls:0,lastChip:null}, extra||{});
const game = players => ({schema:3,mode:players.length>1?'group':'solo',players:players.length,round:1,active:0,turns:92,complete:false,playersState:players,chanceDeck:[],logs:[],lastDice:[],lastRollSummary:'',roundResults:{},chanceNotice:null,event:{title:'Ready',copy:'Test',icon:'',kicker:'Cell cycle'}});
(async () => {
  const browser = await T.launch(), server = await T.serve();
  const ctx = await T.ctxFor(browser, {width:1919,height:1000,reduced:true});
  const p = await T.open(ctx,'openscied-b3-cell-cycle.html','cell-game',server.url);
  const read = () => p.evaluate(key => JSON.parse(localStorage.getItem(key)).game, KEY);
  const seed = async g => { await p.evaluate(({key,g}) => localStorage.setItem(key, JSON.stringify({v:1,trials:[],fields:{},game:g})), {key:KEY,g}); await p.reload(); await p.locator('.step-nav a[href="#cell-game"]').click(); await p.waitForTimeout(200); };
  const roll = async values => {
    await p.evaluate(values => { let i = 0; Math.random = () => (values[i++ % values.length] - .5) / 6; }, values);
    const before = (await read()).turns;
    await p.locator('#roll-dice').click();
    await p.waitForFunction(({key,before}) => JSON.parse(localStorage.getItem(key)).game.turns > before, {key:KEY,before}, {timeout:5000});
    if (await p.locator('#checkpoint-reveal-ack').isVisible()) await p.locator('#checkpoint-reveal-ack').click();   // a checkpoint card: follow it
    return read();
  };
  const closeEnd = async () => { if (await p.locator('#round-end-dialog').evaluate(d => d.open).catch(() => false)) await p.keyboard.press('Escape'); };
  try {
    // Ended early at 45 and 47 turns.
    await seed(game([pl(1,3,{turnsUsed:45}),pl(2,5,{turnsUsed:47})]));
    await p.locator('#end-round').click(); await p.locator('#confirm-game-reset').click(); await p.waitForTimeout(150);
    await closeEnd();
    const early = await p.locator('#turn-instruction').textContent();
    T.ok(!/Every player has used 75/.test(early), `ended early: no claim that every player used 75 turns ("${early}")`);
    T.ok(/ended early/.test(early) && /Player 1 45, Player 2 47/.test(early), 'ended early: the reason and the real turn counts (45 and 47) are stated');
    T.ok(/ended early/.test(await p.locator('#round-summary').textContent()) && /Player 1 45, Player 2 47/.test(await p.locator('#round-summary').textContent()), 'the results panel states the same reason and counts');
    const r = (await read()).roundResults[1];
    T.ok(r.endedBy === 'early' && r.playerTurns.join() === '45,47', 'the saved round result records why it ended and the turn counts');
    // A division in the middle of the round does not end it.
    await seed(game([pl(1,29,{turnsUsed:10})]));
    let g = await roll([5,6,6,6]);
    T.ok(g.playersState[0].blue === 1 && !g.complete, 'a division (blue chip) does not end the round');
    // The turn limit ends it, and the message says so.
    await seed(game([pl(1,3,{turnsUsed:74})]));
    g = await roll([6,6,6,6]);
    await closeEnd();
    const cap = await p.locator('#turn-instruction').textContent();
    T.ok(g.complete && g.roundResults[1].endedBy === 'turns' && /used all 75 turns \(the turn limit\)/.test(cap) && /A division does not end the round/.test(cap), `turn limit: the message names the turn limit ("${cap}")`);
    // The rules say when a round ends.
    const rules = await p.locator('.game-rules').textContent(), setup = await p.locator('.game-setup-copy').textContent();
    T.ok(/Dividing does not end the round/.test(rules) && /75 turns/.test(rules) && /End this round now/.test(rules), 'How to play: a division does not end the round; the turn limit or "End this round now" does');
    T.ok(/a division does not end the round/.test(setup) && /End this round now/.test(setup), 'setup text says the same');
    T.ok(p.errors.length === 0, 'no page errors: ' + p.errors.join('; '));
  } catch (e) { T.ok(false, 'unexpected error: ' + e.message.split('\n')[0]); }
  await browser.close(); server.close(); T.done('t89-round-end-reason');
})();
