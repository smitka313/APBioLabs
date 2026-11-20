/* Owner item 17: a clear end-of-round and end-of-game notification.
   Round 1 ends -> a "Round 1 complete" dialog: the reason (turn limit or ended early) with real turn counts, each
   player's results (blue/red chips, destroyed by p53, sent back, checkpoints skipped, turns) and one next step,
   "Start Round 2". Round 2 ends -> "Game over": both rounds side by side per player, class-style totals (% non-cancer,
   % cancer), and next steps (Making Sense questions, Set up a new game). No winner. The single live announcer reads it,
   focus moves to its heading, Escape dismisses it, and it fits at 390px (dark) and over the enlarged board. */
const T = require('./_h');
const KEY = 'aplab:openscied:b3-cell-cycle:v1';
const sc = () => ({g1:{nutrients:3,proteins:3,organelles:3},s:{chromosomes:4},g2:{nutrients:1,proteins:1,organelles:1}});
const pl = (id, pos, extra) => Object.assign({id,pos,score:sc(),status:'playing',turnsUsed:74,blue:0,red:0,destroyed:0,sentBack:0,skipped:0,skipTurns:0,bonusRolls:0,lastChip:null}, extra||{});
const game = (round, players, r1) => ({schema:3,mode:players.length>1?'group':'solo',players:players.length,round,active:0,turns:200,complete:false,playersState:players,chanceDeck:[0],logs:[],lastDice:[],lastRollSummary:'',roundResults:r1?{1:r1}:{},chanceNotice:null,event:{title:'Ready',copy:'Test',icon:'',kicker:'Cell cycle'}});
(async () => {
  const browser = await T.launch(), server = await T.serve();
  let ctx = await T.ctxFor(browser, {width:1919,height:1000,reduced:true});
  let p = await T.open(ctx,'openscied-b3-cell-cycle.html','cell-game',server.url);
  const read = () => p.evaluate(key => JSON.parse(localStorage.getItem(key)).game, KEY);
  const seed = async g => { await p.evaluate(({key,g}) => localStorage.setItem(key, JSON.stringify({v:1,trials:[],fields:{},game:g})), {key:KEY,g}); await p.reload(); await p.locator('.step-nav a[href="#cell-game"]').click(); await p.waitForTimeout(150); };
  const rollAll = async n => { for (let i = 0; i < n; i++) {
    await p.evaluate(() => { Math.random = () => (6 - .5) / 6; });
    const before = (await read()).turns; await p.locator('#roll-dice').click();
    await p.waitForFunction(({key,before}) => JSON.parse(localStorage.getItem(key)).game.turns > before, {key:KEY,before}); await p.waitForTimeout(60);
  } };
  const isOpen = () => p.locator('#round-end-dialog').evaluate(d => d.open);
  const fits = async w => p.locator('#round-end-dialog').evaluate((d, w) => { const r = d.getBoundingClientRect(); return r.left >= 0 && r.right <= w + 0.5 && d.scrollWidth <= d.clientWidth + 1 && [...d.querySelectorAll('.table-wrap')].every(t => t.scrollWidth <= t.clientWidth + 1); }, w);
  try {
    // Round 1, two players, both on their 75th turn: the turn limit ends the round.
    await seed(game(1, [pl(1,3,{blue:3,destroyed:1,sentBack:2}), pl(2,12,{blue:2,sentBack:1})]));
    await rollAll(2);
    T.ok(await isOpen(), 'Round 1 ends: the dialog opens');
    T.ok((await p.locator('#round-end-title').textContent()) === 'Round 1 complete' && await p.evaluate(() => document.activeElement.id) === 'round-end-title', 'title "Round 1 complete"; focus is on the heading');
    const body = (await p.locator('#round-end-dialog').innerText()).replace(/\s+/g, ' ');
    T.ok(/used all 75 turns \(the turn limit\)/.test(body), 'the dialog names the reason (turn limit)');
    T.ok(/Blue chips · non-cancer cells 3 2 5/.test(body) && /Cells destroyed by p53 1 0 1/.test(body) && /Times sent back by a checkpoint 2 1 3/.test(body) && /Checkpoints skipped 0 0 0/.test(body) && /Turns used 75 75 150/.test(body) && /Red chips · cancer cells \(game model\) 0 0 0/.test(body), 'per-player results: chips, destroyed, sent back, skipped, turns (with an all-players column)');
    T.ok(!/winner|wins|won\b/i.test(body.replace(/There is no winner/, '')) && /There is no winner/.test(body), 'no winner is picked');
    T.ok((await p.locator('#round-end-dialog button').allTextContents()).join('|') === 'Start Round 2|Close', 'one clear next step: Start Round 2 (and Close)');
    const said = await p.locator('#game-announcer').textContent();
    T.ok(/Round 1 complete\. The round ended when every player had used all 75 turns/.test(said) && /Player 2: 2 blue chips/.test(said) && /Start Round 2/.test(said), 'the single live announcer reads the result: ' + said.slice(0, 90));
    T.ok(await p.locator('[aria-live]').evaluateAll(els => els.every(e => !e.closest('#round-end-dialog'))), 'the dialog itself is not a second live region');
    await p.keyboard.press('Escape');
    T.ok(!(await isOpen()) && (await read()).endNotice === false, 'Escape dismisses it, and that is saved');
    await p.reload(); await p.waitForTimeout(300);
    T.ok(!(await isOpen()), 'a dismissed dialog does not come back on reload');
    // Not dismissed: it is still there after a reload; "Start Round 2" starts Round 2 with the same group.
    await seed(game(1, [pl(1,3,{blue:1})])); await rollAll(1);
    await p.reload(); await p.waitForTimeout(300);
    T.ok(await isOpen(), 'an undismissed Round complete dialog is shown again after a reload');
    await p.locator('#round-end-next').click(); await p.waitForTimeout(100);
    let g = await read();
    T.ok(g.round === 2 && !g.complete && g.roundResults[1].blue === 1 && !(await isOpen()), '"Start Round 2" closes the dialog and starts Round 2');
    // Round 2 ended early: Game over with both rounds per player and class-style totals.
    const r1 = {blue:5,red:0,destroyed:1,sentBack:3,skipped:0,turns:150,players:2,endedBy:'turns',playerTurns:[75,75],perPlayer:[{id:1,blue:3,red:0,destroyed:1,sentBack:2,skipped:0,turns:75},{id:2,blue:2,red:0,destroyed:0,sentBack:1,skipped:0,turns:75}]};
    await seed(game(2, [pl(1,3,{turnsUsed:45,blue:1,red:2,skipped:3}), pl(2,5,{turnsUsed:47,red:1,destroyed:2})], r1));
    await p.locator('#end-round').click(); await p.locator('#confirm-game-reset').click(); await p.waitForTimeout(150);
    T.ok(await isOpen() && (await p.locator('#round-end-title').textContent()) === 'Game over' && await p.evaluate(() => document.activeElement.id) === 'round-end-title', 'Round 2 ends: "Game over", focus on its heading');
    const over = (await p.locator('#round-end-dialog').innerText()).replace(/\s+/g, ' ');
    T.ok(/ended early/.test(over) && /Player 1 45, Player 2 47/.test(over), 'Game over names the reason with the real turn counts');
    T.ok(/Player 1 Result Round 1 Round 2 Blue chips · non-cancer cells 3 1 Red chips · cancer cells \(game model\) 0 2/.test(over) && /Checkpoints skipped 0 3 Turns used 75 45/.test(over) && /Player 2 .*Cells destroyed by p53 0 2/.test(over), 'each player\'s results for both rounds, side by side');
    T.ok(/New cells made 5 4/.test(over) && /Percent non-cancer cells 100% 25%/.test(over) && /Percent cancer cells 0% 75%/.test(over), 'class-style totals: % non-cancer and % cancer per round');
    T.ok(/There is no winner/.test(over) && /not a diagnosis/.test(over), 'no winner; game-model framing kept');
    T.ok((await p.locator('#round-end-dialog button').allTextContents()).join('|') === 'Answer the Making Sense questions|Set up a new game|Close', 'next steps: Making Sense questions, Set up a new game');
    T.ok(/^Game over\./.test(await p.locator('#game-announcer').textContent()) && /25% non-cancer cells, 75% cancer cells/.test(await p.locator('#game-announcer').textContent()), 'the announcer reads "Game over" with the totals');
    await p.locator('#round-end-next').click(); await p.waitForTimeout(150);
    T.ok(!(await isOpen()) && await p.evaluate(() => document.activeElement.id) === 'making-sense-title', '"Answer the Making Sense questions" moves to the Making Sense heading');
    await seed(game(2, [pl(1,3,{turnsUsed:45})], r1));
    await p.locator('#end-round').click(); await p.locator('#confirm-game-reset').click(); await p.waitForTimeout(150);
    await p.locator('#round-end-new').click();
    T.ok(await p.locator('#game-reset-dialog').evaluate(d => d.open) && /new game/i.test(await p.locator('#game-reset-title').textContent()), '"Set up a new game" asks to confirm, as the game\'s own button does');
    await p.locator('#cancel-game-reset').click();
    // Over the enlarged board: shown on top; Escape closes the dialog first, not the enlarged view.
    await seed(game(1, [pl(1,3)]));
    await p.locator('#enlarge-scene').click(); await p.waitForTimeout(150);
    await rollAll(1);
    const box = await p.locator('#round-end-dialog').boundingBox();
    T.ok(await isOpen() && await p.evaluate(({x,y}) => !!document.elementFromPoint(x,y).closest('#round-end-dialog'), {x:box.x + box.width / 2, y:box.y + 30}) && await fits(1919), 'over the enlarged board the dialog is on top and fits');
    await p.keyboard.press('Escape');
    T.ok(!(await isOpen()) && await p.locator('#cell-board').evaluate(b => b.classList.contains('scene-expanded')), 'Escape closes the dialog and leaves the enlarged board open');
    await p.keyboard.press('Escape');
    T.ok(p.errors.length === 0, 'no page errors: ' + p.errors.join('; '));
    await ctx.close();
    // 390px, dark: 3 and 4 players, Round 1 and Game over.
    ctx = await T.ctxFor(browser, {width:390,height:844,reduced:true,dark:true});
    p = await T.open(ctx,'openscied-b3-cell-cycle.html','cell-game',server.url);
    for (const n of [3, 4]) {
      const ps = Array.from({length:n}, (_, i) => pl(i + 1, 3 + i, {blue:i, sentBack:i}));
      await seed(game(1, ps)); await rollAll(n);
      T.ok(await isOpen() && await fits(390), `390px dark, ${n} players: Round 1 complete fits with no sideways scroll`);
      const bg = await p.locator('#round-end-dialog').evaluate(d => getComputedStyle(d).backgroundColor);
      T.ok(bg !== 'rgb(255, 255, 255)', `390px dark, ${n} players: the dialog uses the dark surface (${bg})`);
      const per = Array.from({length:n}, (_, i) => ({id:i + 1,blue:1,red:0,destroyed:0,sentBack:0,skipped:0,turns:75}));
      await seed(game(2, Array.from({length:n}, (_, i) => pl(i + 1, 3 + i, {turnsUsed:30, red:1})), {blue:n,red:0,destroyed:0,sentBack:0,skipped:0,turns:75 * n,players:n,endedBy:'turns',playerTurns:per.map(() => 75),perPlayer:per}));
      await p.locator('#end-round').click(); await p.locator('#confirm-game-reset').click(); await p.waitForTimeout(150);
      T.ok(await isOpen() && await fits(390) && (await p.locator('#round-end-dialog table').count()) === n + 1, `390px dark, ${n} players: Game over fits, one table per player plus totals`);
      await p.keyboard.press('Escape');
    }
    T.ok(p.errors.length === 0, 'no page errors at 390px: ' + p.errors.join('; '));
  } catch (e) { T.ok(false, 'unexpected error: ' + e.message.split('\n')[0]); }
  await browser.close(); server.close(); T.done('t89-round-end-dialog');
})();
