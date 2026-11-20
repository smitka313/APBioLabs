/* Chance spaces (review L4): the rules list the Round 2 chance-space numbers in text, matching the board.
   Before the fix they were marked only by a blue diamond drawn on the canvas. */
const T = require('./_h');
const KEY = 'aplab:openscied:b3-cell-cycle:v1';
(async () => {
  const browser = await T.launch(), server = await T.serve();
  const ctx = await T.ctxFor(browser, {width:1440,height:900,reduced:true});
  const p = await T.open(ctx,'openscied-b3-cell-cycle.html','cell-game',server.url);
  try {
    // Ask the board which spaces draw cards: land on each space with a one-card deck and see whether a card appears.
    const expected = [2,4,6,10,12,14,17,19,21,23,25,27,29];
    const rule = (await p.locator('#chance-space-rule').textContent()).replace(/\s+/g,' ');
    const listed = (rule.match(/Spaces? ([\d, and]+)/) || [,''])[1].match(/\d+/g) || [];
    T.ok(listed.join(',') === expected.join(','), `rules list the chance spaces in text (${listed.join(', ') || 'none'})`);
    // Check the list against the game itself: a cell landing on a listed space draws a card; others do not.
    const drew = [];
    for (const space of [2,3,10,11,23,24]) {
      const pos = space - 1, score = {g1:{nutrients:3,proteins:3,organelles:3},s:{chromosomes:4},g2:{nutrients:1,proteins:1,organelles:1},m:{attachments:0}};
      const game = {schema:2,mode:'solo',players:1,round:2,active:0,turns:0,complete:false,playersState:[{id:1,pos:pos-1,score,status:'playing',divisions:0,unchecked:0,restarts:0,bypassed:0,skipTurns:0,bonusRolls:0}],
        chanceDeck:[10],logs:[],lastDice:[],lastRollSummary:'',roundResults:{1:{divisions:1,unchecked:0,restarts:0,bypassed:0,rolls:40}},event:{title:'Ready',copy:'Test',icon:'',kicker:'Cell cycle'}};
      await p.evaluate(({key,game}) => localStorage.setItem(key, JSON.stringify({v:1,trials:[],fields:{},game})), {key:KEY,game});
      await p.reload();
      await p.evaluate(() => { let i = 0; const v = [5,1,2,3]; Math.random = () => (v[i++ % 4] - .5) / 6; });
      await p.locator('#roll-dice').click();
      await p.waitForFunction(key => JSON.parse(localStorage.getItem(key)).game.turns > 0, KEY);
      const g = await p.evaluate(key => JSON.parse(localStorage.getItem(key)).game, KEY);
      if (g.chanceNotice) drew.push(space);
    }
    T.ok(drew.join(',') === '2,10,23', `landing draws a card exactly on the listed spaces among 2, 3, 10, 11, 23, 24 (drew on ${drew.join(', ')})`);
    T.ok(p.errors.length === 0, 'no page errors: ' + p.errors.join('; '));
  } catch (e) { T.ok(false, 'unexpected error: ' + e.message.split('\n')[0]); }
  await browser.close(); server.close(); T.done('t81-chance-space-list');
})();
