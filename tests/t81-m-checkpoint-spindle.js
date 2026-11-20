/* M phase and M Checkpoint (Round 1 handout step 8; Teacher Reference: Game Cards 1, M card; TE p20). The M spaces are
   "Must Roll" 1 to 5 in order, and the M Checkpoint double-checks the whole scorecard (G1 3 of each, S 4 DNA, G2 1 of
   each): complete -> "YOU SUCCESSFULLY DIVIDED! Take a new blue cell chip!". The earlier spindle-attachment rule (5 or
   6 attaches a chromosome) is gone, so the game does not answer the M-phase card sort in advance.
   Board: G2 Checkpoint 24, M 25-29, M Checkpoint 30, FINISH 31. */
const T = require('./_h');
const KEY = 'aplab:openscied:b3-cell-cycle:v1';
const full = () => ({g1:{nutrients:3,proteins:3,organelles:3},s:{chromosomes:4},g2:{nutrients:1,proteins:1,organelles:1}});
const pl = (pos, score) => ({id:1,pos,score:score||full(),status:'playing',turnsUsed:0,blue:0,red:0,destroyed:0,sentBack:0,skipped:0,skipTurns:0,bonusRolls:0,lastChip:null});
const saved = (round, player) => ({v:1,trials:[],fields:{},game:{schema:3,mode:'solo',players:1,round,active:0,turns:0,complete:false,
  playersState:[player],chanceDeck:[7],logs:[],lastDice:[],lastRollSummary:'',roundResults:round===2?{1:{blue:1,red:0,destroyed:0,sentBack:0,skipped:0,turns:75,players:1}}:{},chanceNotice:null,
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
    await seed(saved(1, pl(26)));
    T.ok(/must roll a 3/.test(await p.locator('#turn-instruction').textContent()), 'on Must roll 2 the instruction asks for a 3');
    await roll([5,6,5,6]);
    T.ok((await read()).playersState[0].pos === 26, '5s and 6s no longer advance M phase (no spindle-attachment rule)');
    await roll([3,6,6,6]);
    T.ok((await read()).playersState[0].pos === 27, 'a 3 moves the cell to Must roll 3');
    await seed(saved(1, pl(29)));
    T.ok(/Turn over the M Checkpoint card/.test(await p.locator('#roll-dice').textContent()), 'on Must roll 5 the next move turns over the M Checkpoint card');
    await roll([1]);
    let g = await read(), q = g.playersState[0];
    T.ok(q.blue === 1 && q.pos === 31 && /YOU SUCCESSFULLY DIVIDED! Take a new blue cell chip!/.test(g.event.title), `a complete scorecard divides with a blue chip ("${g.event.title}")`);
    // The double-check looks at every phase. Only possible after a Round 2 card skipped an earlier checkpoint.
    for (const [what, edit] of [['G1 proteins', s => { s.g1.proteins = 2; }], ['DNA', s => { s.s.chromosomes = 3; }], ['G2 organelles', s => { s.g2.organelles = 0; }]]) {
      const score = full(); edit(score);
      await seed(saved(2, pl(29, score)));
      await roll([1]);
      q = (await read()).playersState[0];
      T.ok(q.blue === 0 && q.red === 0 && q.pos === 0 && q.destroyed === 1, `${what} short at the M Checkpoint: no chip; p53 destroys the cell (pos ${q.pos})`);
    }
    await seed(saved(1, pl(27)));
    const card = (await p.locator('#checkpoint-requirements').textContent()).replace(/\s+/g,' ');
    T.ok(/G1 · 3 of each/.test(card) && /S · DNA/.test(card) && /G2 · 1 of each/.test(card) && !/Spindle/.test(card), `the M Checkpoint card lists the whole scorecard ("${card.trim()}")`);
    const rules = (await p.locator('.game-rules').textContent()).replace(/\s+/g,' ');
    T.ok(/you must roll a 1/.test(rules) && /MUST roll|must roll the number on that space/.test(rules) && !/spindle/i.test(rules), 'rules text gives the 1-5 sequence and no spindle rule');
    T.ok(!/spindle/i.test(await p.locator('#phase-guide').textContent()), 'the phase guide no longer describes spindle attachment');
    T.ok(p.errors.length === 0, 'no page errors: ' + p.errors.join('; '));
  } catch (e) { T.ok(false, 'unexpected error: ' + e.message.split('\n')[0]); }
  await browser.close(); server.close(); T.done('t81-m-checkpoint-spindle');
})();
