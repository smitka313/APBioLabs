/* Bypass counting (review L1): chance cards count only checkpoints the cell actually skips. Before the fix the
   "advance" card counted a checkpoint the cell merely landed on (it is still checked on the next roll), and "two
   checkpoints are missed" counted two even in M phase, where only the M checkpoint is left. A cell parked on the M
   checkpoint with all attachments made also divided as "unchecked". */
const T = require('./_h');
const KEY = 'aplab:openscied:b3-cell-cycle:v1';
const full = a => ({g1:{nutrients:3,proteins:3,organelles:3},s:{chromosomes:4},g2:{nutrients:1,proteins:1,organelles:1},m:{attachments:a||0}});
const pl = (pos, score) => ({id:1,pos,score:score||full(),status:'playing',divisions:0,unchecked:0,restarts:0,bypassed:0,skipTurns:0,bonusRolls:0});
const saved = (player, deck) => ({v:1,trials:[],fields:{},game:{schema:2,mode:'solo',players:1,round:2,active:0,turns:0,complete:false,
  playersState:[player],chanceDeck:deck||[],logs:[],lastDice:[],lastRollSummary:'',roundResults:{1:{divisions:1,unchecked:0,restarts:0,bypassed:0,rolls:40}},
  event:{title:'Ready',copy:'Test setup',icon:'',kicker:'Cell cycle'}}});
const ADVANCE = 8, SKIP_TWO = 11;
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
  };
  try {
    // Advance from G2 space 20 lands on the G2 checkpoint (23): nothing was skipped.
    await seed(saved(pl(19), [ADVANCE])); await roll([1,2,3,4]);
    let q = (await read()).playersState[0];
    T.ok(q.pos === 23 && q.bypassed === 0, `advance onto the G2 checkpoint counts no bypass (pos ${q.pos}, bypassed ${q.bypassed})`);
    // Advance from 22 to 25 jumps over the G2 checkpoint: one bypass.
    await seed(saved(pl(21), [ADVANCE])); await roll([1,2,3,4]);
    q = (await read()).playersState[0];
    T.ok(q.pos === 25 && q.bypassed === 1, `advance past the G2 checkpoint counts one bypass (pos ${q.pos}, bypassed ${q.bypassed})`);
    // Advance from M space 26 lands on the M checkpoint, which still checks attachments.
    await seed(saved(pl(25, full(2)), [ADVANCE])); await roll([5,1,2,3]);
    q = (await read()).playersState[0];
    T.ok(q.pos === 29 && q.bypassed === 0, `advance onto the M checkpoint counts no bypass (pos ${q.pos}, bypassed ${q.bypassed})`);
    // Two-checkpoint card in M phase: only the M checkpoint is left to skip.
    await seed(saved(pl(23, full(0)), [SKIP_TWO])); await roll([5,1,2,3]);
    q = (await read()).playersState[0];
    T.ok(q.status === 'finished' && q.bypassed === 1, `"two checkpoints missed" in M phase counts one bypass (bypassed ${q.bypassed})`);
    // A cell parked on the M checkpoint with all four attachments is checked, not counted as unchecked.
    await seed(saved(pl(29, full(4)), []));
    await p.evaluate(key => { const s = JSON.parse(localStorage.getItem(key)); s.game.round = 1; localStorage.setItem(key, JSON.stringify(s)); }, KEY);
    await p.reload(); await go('cell-game');
    await roll([1,2,3,4]);
    q = (await read()).playersState[0];
    T.ok(q.status === 'finished' && q.unchecked === 0, `a cell waiting on the M checkpoint with four attachments completes a checked division (unchecked ${q.unchecked})`);
    T.ok(p.errors.length === 0, 'no page errors: ' + p.errors.join('; '));
  } catch (e) { T.ok(false, 'unexpected error: ' + e.message.split('\n')[0]); }
  await browser.close(); server.close(); T.done('t81-bypass-count');
})();
