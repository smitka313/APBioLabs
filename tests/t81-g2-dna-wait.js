/* G2 Checkpoint with too little DNA (Teacher Reference: Game Cards 1, G2 card): "Fewer than 4 DNA, GO BACK TO THE FIRST
   SPACE" of Phase S. The cell keeps its scorecard, collects chromosomes again in S (each 4), and passes the G2 Checkpoint
   on its next visit. (Earlier rules held the cell on the checkpoint instead.) Board: S 8-15, G2 16-23, G2 Checkpoint 24. */
const T = require('./_h');
const KEY = 'aplab:openscied:b3-cell-cycle:v1';
const sc = () => ({g1:{nutrients:3,proteins:3,organelles:3},s:{chromosomes:2},g2:{nutrients:1,proteins:1,organelles:1}});
(async () => {
  const browser = await T.launch(), server = await T.serve();
  const ctx = await T.ctxFor(browser, {width:1440,height:900,reduced:true});
  const p = await T.open(ctx,'openscied-b3-cell-cycle.html','cell-game',server.url);
  const read = () => p.evaluate(key => JSON.parse(localStorage.getItem(key)).game, KEY);
  const go = async id => { await p.locator('.step-nav a[href="#'+id+'"]').click(); await p.waitForFunction(id => document.getElementById(id).classList.contains('is-current'), id); };
  const roll = async values => {
    await p.evaluate(values => { let i = 0; Math.random = () => (values[i++ % values.length] - .5) / 6; }, values);
    const before = (await read()).turns; await p.locator('#roll-dice').click({timeout: 5000});
    await p.waitForFunction(({key,before}) => JSON.parse(localStorage.getItem(key)).game.turns > before, {key:KEY,before}, {timeout: 8000});
    await p.evaluate(() => { const st = window.setTimeout; window.setTimeout = (f, ms, ...a) => st(f, Math.min(ms, 5), ...a); });
  };
  try {
    const player = {id:1,pos:23,score:sc(),status:'playing',turnsUsed:0,blue:0,red:0,destroyed:0,sentBack:0,skipped:0,skipTurns:0,bonusRolls:0,lastChip:null};
    const game = {schema:3,mode:'solo',players:1,round:1,active:0,turns:0,complete:false,playersState:[player],chanceDeck:[],logs:[],lastDice:[],lastRollSummary:'',roundResults:{},chanceNotice:null,event:{title:'Ready',copy:'Test',icon:'',kicker:'Cell cycle'}};
    await p.evaluate(({key,game}) => localStorage.setItem(key, JSON.stringify({v:1,trials:[],fields:{},game})), {key:KEY,game});
    await p.reload(); await go('cell-game');
    await roll([1,2,3,5]); let g = await read(), q = g.playersState[0];
    T.ok(q.pos === 8, `2 DNA at the G2 Checkpoint: back to the first S space (pos ${q.pos})`);
    T.ok(q.destroyed === 0 && q.sentBack === 1 && q.score.s.chromosomes === 2 && q.score.g2.nutrients === 1, 'not destroyed; the scorecard keeps its check marks');
    T.ok(/GO BACK TO THE FIRST SPACE/.test(g.event.title) && /p53/.test(g.event.copy), `the event uses the card wording and names p53 ("${g.event.title}")`);
    await roll([4,1,2,3]); q = (await read()).playersState[0];
    T.ok(q.pos === 9 && q.score.s.chromosomes === 3, `a 4 on S space 2 checks off one more chromosome (now ${q.score.s.chromosomes})`);
    await roll([4,4,4,2]); q = (await read()).playersState[0];
    T.ok(q.score.s.chromosomes === 4, `Chromosomes stop at the scorecard's 4 boxes (${q.score.s.chromosomes})`);
    for (let i = 0; i < 20 && q.pos !== 24; i++) { await roll([1,2,3,5]); q = (await read()).playersState[0]; }
    g = await read();
    T.ok(q.pos === 24 && g.event.kicker === 'Checkpoint passed', `back at the G2 Checkpoint with 4 DNA, the cell passes ("${g.event.title}")`);
    T.ok(p.errors.length === 0, 'no page errors: ' + p.errors.join('; '));
  } catch (e) { T.ok(false, 'unexpected error: ' + e.message.split('\n')[0]); }
  await browser.close(); server.close && server.close(); T.done('t81-g2-dna-wait');
})();
