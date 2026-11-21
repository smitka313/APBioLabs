/* Muse audit (Nov 21): after a round ended early the board's text description still said the player "used all 75 turns";
   the "Next checkpoint" panel jumped ahead to G2 while the G1 checkpoint card was still waiting; a round with no new cells
   printed a bare dash as a percent. Run: NODE_PATH=$(npm root -g) node tests/t101-cell-cycle-audit.js */
const T = require('./_h');
const KEY = 'aplab:openscied:b3-cell-cycle:v1';
const full = () => ({g1:{nutrients:3,proteins:3,organelles:3},s:{chromosomes:4},g2:{nutrients:1,proteins:1,organelles:1}});
const none = () => ({g1:{nutrients:0,proteins:0,organelles:0},s:{chromosomes:0},g2:{nutrients:0,proteins:0,organelles:0}});
const pl = (id, pos, extra) => Object.assign({id,pos,score:full(),status:'playing',turnsUsed:0,blue:0,red:0,destroyed:0,sentBack:0,skipped:0,skipTurns:0,bonusRolls:0,lastChip:null}, extra||{});
const game = (players, extra) => Object.assign({schema:3,mode:'solo',players:players.length,round:1,active:0,turns:60,complete:false,playersState:players,chanceDeck:[],logs:[],lastDice:[],lastRollSummary:'',roundResults:{},chanceNotice:null,checkpointNotice:null}, extra||{});
(async () => {
  const browser = await T.launch(), server = await T.serve();
  const ctx = await T.ctxFor(browser, {width:1366,height:1000,reduced:true});
  const p = await T.open(ctx,'openscied-b3-cell-cycle.html','cell-game',server.url);
  const seed = async g => { await p.evaluate(({key,g}) => localStorage.setItem(key, JSON.stringify({v:1,trials:[],fields:{},game:g})), {key:KEY,g}); await p.reload(); await p.waitForTimeout(300); if (!(g.checkpointNotice && g.checkpointNotice.pending)) await p.locator('.step-nav a[href="#cell-game"]').click(); await p.waitForTimeout(200); };
  try {
    // 1. Ended early: the screen-reader description must not claim 75 turns were used.
    await seed(game([pl(1,3,{turnsUsed:41})]));
    await p.locator('#end-round').click(); await p.locator('#confirm-game-reset').click(); await p.waitForTimeout(200);
    if (await p.locator('#round-end-dialog').evaluate(d => d.open).catch(() => false)) await p.keyboard.press('Escape');
    const desc = await p.locator('#scene-description').textContent();
    T.ok(!/used all 75 turns/.test(desc), 'after ending early the board description does not say all 75 turns were used: ' + desc.slice(0, 160));
    T.ok(/41 of 75/.test(desc), 'the description gives the real count (41 of 75)');
    T.ok(/Round over/.test(await p.locator('#checkpoint-status').textContent()), 'the checkpoint panel says "Round over", not "Turns used up"');
    // 2. Next checkpoint: find the G1 checkpoint square, then keep a waiting G1 card on screen.
    let g1 = -1;
    for (let pos = 1; pos < 40 && g1 < 0; pos++) { await seed(game([pl(pos,pos)].map(x => Object.assign(x,{id:1})))); if (/is on G1 Checkpoint/i.test(await p.locator('#scene-description').textContent())) g1 = pos; }
    T.ok(g1 > 0, 'found the G1 checkpoint square (' + g1 + ')');
    await seed(game([pl(1,g1,{score:none()})], {checkpointNotice:{pending:true,player:1,pos:g1,phase:'g1',outcome:'back5',label:'GO BACK 5',effect:'',round:1}}));
    T.ok(/G1/.test(await p.locator('#checkpoint-title').textContent()) && !/G2/.test(await p.locator('#checkpoint-title').textContent()), 'while the G1 card is waiting the panel still shows the G1 checkpoint: ' + await p.locator('#checkpoint-title').textContent());
    await seed(game([pl(1,g1)], {checkpointNotice:{pending:true,player:1,pos:g1,phase:'g1',outcome:'pass',label:'Pass',effect:'',round:1}}));
    T.ok(/G2/.test(await p.locator('#checkpoint-title').textContent()), 'a waiting card that passes the cell moves the panel on to G2 straight away');
    await seed(game([pl(1,g1)]));
    T.ok(/G2/.test(await p.locator('#checkpoint-title').textContent()), 'with no card waiting, a piece past G1 sees the next checkpoint (G2)');
    // 3. No new cells: words, not a bare dash.
    await seed(game([pl(1,3,{turnsUsed:75,status:'done'})]));
    T.ok(!/(^|\s)— of the 0/.test(await p.locator('#round-summary').textContent()), 'no "— of the 0 new cells" line');
    T.ok(p.errors.length === 0, 'no page errors: ' + p.errors.join('; '));
  } catch (e) { T.ok(false, 'unexpected error: ' + e.message.split('\n')[0]); }
  await browser.close(); server.close(); T.done('t101-cell-cycle-audit');
})();
