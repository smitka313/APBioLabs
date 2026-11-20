/* Chance spaces (review L4, now the board's light-blue squares): the rules list the Round 2 Cellular Chance spaces in
   text, the way students see them on the board (phase and space number), and the list matches the game.
   Board indices: G1 1-6, G1 Checkpoint 7, S 8-15, G2 16-23, G2 Checkpoint 24, M 25-29. */
const T = require('./_h');
const KEY = 'aplab:openscied:b3-cell-cycle:v1';
(async () => {
  const browser = await T.launch(), server = await T.serve();
  const ctx = await T.ctxFor(browser, {width:1440,height:900,reduced:true});
  const p = await T.open(ctx,'openscied-b3-cell-cycle.html','cell-game',server.url);
  try {
    const rule = (await p.locator('#chance-space-rule').textContent()).replace(/\s+/g,' ');
    T.ok(/G1 spaces 2, 4 and 6; S spaces 1, 3, 5 and 7; G2 spaces 1, 3, 5 and 7; and M spaces 2 and 4/.test(rule), 'rules list the light-blue squares by phase and space number');
    T.ok(/filled light blue/.test(rule) && !/diamond/.test(rule) && !/Spaces? \d/.test(rule), 'rules describe the squares as students see them (light blue), not by internal space numbers');
    T.ok(/bottom of the stack/.test(rule) && /13 cards/.test(rule), 'rules say the card returns to the bottom of the 13-card stack');
    // Land on a few spaces with a one-card deck (card 7 changes no position) and see whether a card appears.
    const drew = [];
    for (const [pos, label] of [[2,'G1 2'],[3,'G1 3'],[8,'S 1'],[9,'S 2'],[16,'G2 1'],[17,'G2 2']]) {
      const score = {g1:{nutrients:3,proteins:3,organelles:3},s:{chromosomes:4},g2:{nutrients:1,proteins:1,organelles:1}};
      const game = {schema:3,mode:'solo',players:1,round:2,active:0,turns:0,complete:false,playersState:[{id:1,pos:pos-1,score,status:'playing',turnsUsed:0,blue:0,red:0,destroyed:0,sentBack:0,skipped:0,skipTurns:0,bonusRolls:0,lastChip:null}],
        chanceDeck:[7],logs:[],lastDice:[],lastRollSummary:'',roundResults:{1:{blue:1,red:0,destroyed:0,sentBack:0,skipped:0,turns:75,players:1}},chanceNotice:null,event:{title:'Ready',copy:'Test',icon:'',kicker:'Cell cycle'}};
      await p.evaluate(({key,game}) => localStorage.setItem(key, JSON.stringify({v:1,trials:[],fields:{},game})), {key:KEY,game});
      await p.reload();
      await p.evaluate(() => { let i = 0; const v = [5,1,2,3]; Math.random = () => (v[i++ % 4] - .5) / 6; });
      await p.locator('#roll-dice').click();
      await p.waitForFunction(key => JSON.parse(localStorage.getItem(key)).game.turns > 0, KEY);
      const g = await p.evaluate(key => JSON.parse(localStorage.getItem(key)).game, KEY);
      if (g.chanceNotice) drew.push(label);
    }
    T.ok(drew.join(',') === 'G1 2,S 1,G2 1', `a card is drawn exactly on the listed squares among G1 2/3, S 1/2, G2 1/2 (drew on ${drew.join(', ')})`);
    T.ok(p.errors.length === 0, 'no page errors: ' + p.errors.join('; '));
  } catch (e) { T.ok(false, 'unexpected error: ' + e.message.split('\n')[0]); }
  await browser.close(); server.close(); T.done('t81-chance-space-list');
})();
