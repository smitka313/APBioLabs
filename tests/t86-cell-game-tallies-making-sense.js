/* Continuous play and outcomes (TE p13 math extension) plus the Lesson 3 Making Sense work (Round 1/2 handouts p4,
   TE p16 limits). Each player has 75 turns per round; the round ends when all have used them (or "End this round
   now"); blue and red chips are tallied with percentages in the results, the analysis evidence and the report; the
   Making Sense table and questions save, restore, print in the report and export in the download. Saves from the
   earlier game rules keep their written answers and which rounds were completed. */
const T = require('./_h');
const fs = require('node:fs');
const KEY = 'aplab:openscied:b3-cell-cycle:v1';
const sc = (g1 = [3,3,3], s = 4, g2 = [1,1,1]) => ({g1:{nutrients:g1[0],proteins:g1[1],organelles:g1[2]},s:{chromosomes:s},g2:{nutrients:g2[0],proteins:g2[1],organelles:g2[2]}});
const pl = (id, pos, extra) => Object.assign({id,pos,score:sc(),status:'playing',turnsUsed:0,blue:0,red:0,destroyed:0,sentBack:0,skipped:0,skipTurns:0,bonusRolls:0,lastChip:null}, extra||{});
const saved = (round, players, results) => ({v:1,trials:[],fields:{},game:{schema:3,mode:'group',players:players.length,round,active:0,turns:140,complete:false,playersState:players,chanceDeck:[7],logs:[],lastDice:[],lastRollSummary:'',
  roundResults:results||{},chanceNotice:null,event:{title:'Ready',copy:'Test',icon:'',kicker:'Cell cycle'}}});
const MS = ['ms-r1-g1-happened','ms-r1-g1-represent','ms-r1-g1cp-happened','ms-r1-g1cp-represent','ms-r1-s-happened','ms-r1-s-represent','ms-r1-g2-happened','ms-r1-g2-represent',
  'ms-r1-g2cp-happened','ms-r1-g2cp-represent','ms-r1-m-happened','ms-r1-m-represent','ms-r1-mcp-happened','ms-r1-mcp-represent','ms-r2-q1','ms-r2-q2','ms-r2-q3','ms-r2-q4','ms-limits-explain','ms-limits-could-not','ms-limits-progress'];
(async () => {
  const browser = await T.launch(), server = await T.serve();
  const ctx = await T.ctxFor(browser, {width:1440,height:900,reduced:true});
  const p = await T.open(ctx,'openscied-b3-cell-cycle.html','cell-game',server.url);
  const read = () => p.evaluate(key => JSON.parse(localStorage.getItem(key)), KEY);
  const go = async id => { await p.locator('.step-nav a[href="#'+id+'"]').click(); await p.waitForFunction(id => document.getElementById(id).classList.contains('is-current'), id); };
  const seed = async s => { await p.evaluate(({key,s}) => localStorage.setItem(key, JSON.stringify(s)), {key:KEY,s}); await p.reload(); await go('cell-game'); };
  const roll = async values => {
    await p.evaluate(values => { let i = 0; Math.random = () => (values[i++ % values.length] - .5) / 6; }, values);
    const before = (await read()).game.turns;
    await p.locator('#roll-dice').click();
    await p.waitForFunction(({key,before}) => JSON.parse(localStorage.getItem(key)).game.turns > before, {key:KEY,before}, {timeout:5000});
    if (await p.locator('#chance-reveal-ack').isVisible()) await p.locator('#chance-reveal-ack').click();
    return (await read()).game;
  };
  try {
    // Fresh Round 1: 75 turns each, stated on screen.
    await p.locator('#start-round1').click();
    T.ok(/Turn 1 of 75/.test(await p.locator('#turn-count').textContent()), 'the turn counter shows the 75-turn round');
    // Play continues after a division: Player 1 divides on turn 10 and keeps the dice order.
    await seed(saved(1, [pl(1,29,{turnsUsed:9}), pl(2,3,{turnsUsed:9})]));
    let g = await roll([1]);
    T.ok(g.playersState[0].blue === 1 && g.playersState[0].status === 'playing' && !g.complete && g.active === 1, 'after a division the player keeps playing; the dice pass to Player 2');
    // Last turns: Player 1 on its 75th turn, Player 2 finishes the round.
    const r1 = [pl(1,10,{turnsUsed:74,blue:2,destroyed:1,sentBack:3}), pl(2,29,{turnsUsed:74,blue:1})];
    await seed(saved(1, r1));
    g = await roll([1,2,3,4]);
    T.ok(g.playersState[0].status === 'done' && !g.complete && g.active === 1, 'Player 1 used all 75 turns; the round continues for Player 2');
    g = await roll([1]);
    T.ok(g.complete && g.roundResults[1].blue === 4 && g.roundResults[1].red === 0, `when every player has used 75 turns the round ends and records 4 blue chips (${JSON.stringify(g.roundResults[1])})`);
    let summary = (await p.locator('#round-summary').innerText()).replace(/\s+/g,' ');
    T.ok(/Blue chips · non-cancer cells 4/.test(summary) && /Percent of new cells that were non-cancer 100%/.test(summary) && /Cells destroyed by p53 1/.test(summary), 'Round 1 results: blue chips, percentages and p53 outcomes');
    T.ok(await p.locator('#end-round').isHidden(), '"End this round now" is hidden once the round is over');
    // Round 2 from the summary; end it early with the button (class timer), after a red chip.
    await p.locator('#start-round2-from-summary').click();
    g = (await read()).game;
    T.ok(g.round === 2 && g.playersState.length === 2 && g.roundResults[1].blue === 4, 'Round 2 starts with the same group and keeps the Round 1 tallies');
    await p.evaluate(key => { const s = JSON.parse(localStorage.getItem(key)); Object.assign(s.game.playersState[0], {pos:1,blue:1}); Object.assign(s.game.playersState[1], {red:2,destroyed:2,skipped:3}); s.game.chanceDeck = [12]; localStorage.setItem(key, JSON.stringify(s)); }, KEY);
    await p.reload(); await go('cell-game');
    g = await roll([1,2,3,4]);
    T.ok(g.playersState[0].red === 1, 'Player 1 drew "Move directly to Finish" and has a red chip');
    await p.locator('#end-round').click(); await p.locator('#confirm-game-reset').click();
    g = (await read()).game;
    T.ok(g.complete && g.roundResults[2].blue === 1 && g.roundResults[2].red === 3, `"End this round now" records the chips so far (${JSON.stringify(g.roundResults[2])})`);
    summary = (await p.locator('#round-summary').innerText()).replace(/\s+/g,' ');
    T.ok(/Round 1 and Round 2/.test(summary) && /Red chips · cancer cells \(game model\) 0 3/.test(summary) && /Percent of new cells that were cancer cells 0% 75%/.test(summary), 'Round 2 summary compares both rounds with counts and percentages');
    T.ok(/not inevitable/.test(summary) && /not a diagnosis/.test(summary), 'the summary keeps the TE framing: game model, cancer not inevitable, not a diagnosis');
    // Making Sense: fill, reload, report, export.
    T.ok(await p.locator('#making-sense').isVisible(), 'the Lesson 3 Making Sense section is on the game step');
    T.ok(await p.locator('.making-sense-table tbody tr').count() === 7, 'the Round 1 table has the handout’s 7 rows');
    const heads = (await p.locator('.making-sense-table thead').textContent()).replace(/\s+/g,' ');
    T.ok(/What happened in the game during this phase\/checkpoint\?/.test(heads) && /What do you think it could represent in a cell\?/.test(heads), 'table columns use the handout wording');
    const q = (await p.locator('#making-sense').textContent()).replace(/\s+/g,' ');
    T.ok(/How was the role of p53 different\?/.test(q) && /How do non-cancer cells become cancer cells\?/.test(q) && /COULD NOT help us answer/.test(q), 'Round 2 questions and the limits prompt are present');
    for (const id of MS) await p.locator('#'+id).fill('Answer for '+id);
    await p.reload(); await go('cell-game');
    const restored = await p.evaluate(ids => ids.filter(id => document.getElementById(id).value === 'Answer for ' + id).length, MS);
    T.ok(restored === MS.length, `all ${MS.length} Making Sense answers save and restore (${restored})`);
    await go('analyze');
    const ref = (await p.locator('#analysis-reference-data').textContent()).replace(/\s+/g,' ');
    T.ok(/Round 2 \(complete\): 1 blue chip .*3 red chips.*75% of the 4 new cells were cancer cells/.test(ref), 'the analysis evidence lists the Round 2 chips and percentage');
    await go('submit');
    const report = (await p.locator('#investigation-report').textContent()).replace(/\s+/g,' ');
    T.ok(/21 of 21 Lesson 3 Making Sense responses written/.test(report) && /Answer for ms-r1-g2cp-represent/.test(report) && /Answer for ms-limits-could-not/.test(report), 'the report includes the Making Sense table and questions');
    const dl = p.waitForEvent('download'); await p.locator('#download-work').click();
    const payload = JSON.parse(fs.readFileSync(await (await dl).path(), 'utf8'));
    T.ok(payload.answers['ms-r2-q3'] === 'Answer for ms-r2-q3' && payload.lesson3MakingSense.round1Table.length === 7 && payload.lesson3MakingSense.round1Table[1].row === 'G1 Checkpoint' && payload.lesson3MakingSense.round1Table[1].couldRepresent === 'Answer for ms-r1-g1cp-represent', 'the download exports the Making Sense answers, also as a labelled table');
    T.ok(payload.cellChips.round2.red === 3 && payload.cellChips.round1.blue === 4, 'the download exports the blue and red chip tallies');
    // Earlier saves: answers keep working; completed rounds stay listed; the old board state is not reused.
    const legacy = {v:1,trials:[],fields:{'analysis-design':'Old answer','analysis-checkpoints':'Old game answer'},game:{schema:2,mode:'solo',players:1,round:2,active:0,turns:30,complete:true,
      playersState:[{id:1,pos:30,score:{g1:{nutrients:3,proteins:3,organelles:3},s:{chromosomes:4},g2:{nutrients:1,proteins:1,organelles:1},m:{attachments:4}},status:'finished',divisions:1,unchecked:1,restarts:0,bypassed:2,skipTurns:0,bonusRolls:0}],
      chanceDeck:[],logs:[],lastDice:[],lastRollSummary:'',roundResults:{1:{divisions:1,unchecked:0,restarts:0,bypassed:0,rolls:40},2:{divisions:1,unchecked:1,restarts:0,bypassed:2,rolls:30}},event:{title:'x',copy:'x',icon:'',kicker:'x'}}};
    await seed(legacy);
    const s = await read();
    T.ok(s.fields['analysis-design'] === 'Old answer' && await p.locator('#analysis-checkpoints').inputValue() === 'Old game answer', 'earlier written answers still load and save');
    T.ok(s.game.schema === 3 && s.game.round === 0 && s.game.roundResults[1].legacy && s.game.roundResults[2].legacy, 'earlier game: completed rounds kept (marked earlier rules); the board starts fresh');
    T.ok(await p.locator('#legacy-game-note').isVisible() && await p.locator('#start-round1').isVisible(), 'the setup explains the new rules and offers Round 1');
    T.ok(p.errors.length === 0, 'no page errors: ' + p.errors.join('; '));
  } catch (e) { T.ok(false, 'unexpected error: ' + e.message.split('\n')[0]); }
  await browser.close(); server.close(); T.done('t86-cell-game-tallies-making-sense');
})();
