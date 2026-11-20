/* Play-test Nov 20, item 4: several printed Cellular Chance cards share the title "p53 is working well!" but do
   different things, and the lose-a-turn card's printed title ("p53 is not working!") reads oddly against its body
   ("p53 will not let you pass. You lose a turn!"). The printed title and text stay exactly as on Teacher Reference:
   Game Cards 2; a short effect label now appears under the title in the card dialog, the turn event and the history.
   Card indices: 0-4 extra roll, 5-6 destroy, 7 DNA, 8 lose a turn, 9 move ahead 3, 10 skip next, 11 skip two, 12 finish. */
const T = require('./_h');
const KEY = 'aplab:openscied:b3-cell-cycle:v1';
const sc = () => ({g1:{nutrients:3,proteins:3,organelles:3},s:{chromosomes:4},g2:{nutrients:1,proteins:1,organelles:1}});
const pl = pos => ({id:1,pos,score:sc(),status:'playing',turnsUsed:3,blue:0,red:0,destroyed:0,sentBack:0,skipped:0,skipTurns:0,bonusRolls:0,lastChip:null});
const saved = deck => ({v:1,trials:[],fields:{},game:{schema:3,mode:'solo',players:1,round:2,active:0,turns:3,complete:false,playersState:[pl(1)],chanceDeck:deck,logs:[],lastDice:[],lastRollSummary:'',
  roundResults:{1:{blue:1,red:0,destroyed:0,sentBack:0,skipped:0,turns:75,players:1}},chanceNotice:null,event:{title:'Ready',copy:'Test',icon:'',kicker:'Cell cycle'}}});
const WELL = 'p53 is working well!', NOT = 'p53 is not working!';
const CARDS = [
  [0, WELL, 'You get an extra roll!', 'Extra roll'],
  [5, WELL, 'p53 detects damage to your DNA and destroys your cell. Go back to the start.', 'Cell destroyed'],
  [7, WELL, 'You fill all your DNA requirements for this round!', 'DNA filled'],
  [8, NOT, 'p53 will not let you pass. You lose a turn!', 'Lose a turn'],
  [9, NOT, 'Move ahead 3 spaces.', 'Move ahead 3'],
  [10, NOT, 'Move your game piece to the space after the next checkpoint without checking your scorecard.', 'Skip next checkpoint'],
  [11, NOT, 'Skip ahead two checkpoints and check your scorecard. If there’s only one checkpoint left, skip to the final checkpoint and check your scorecard.', 'Skip two checkpoints'],
  [12, NOT, 'Move directly to Finish. Collect a new RED cell chip and start the game again.', 'Move to FINISH: red chip'],
];
(async () => {
  const browser = await T.launch(), server = await T.serve();
  const ctx = await T.ctxFor(browser, {width:1919,height:1000,reduced:true});
  const p = await T.open(ctx,'openscied-b3-cell-cycle.html','cell-game',server.url);
  const read = () => p.evaluate(key => JSON.parse(localStorage.getItem(key)).game, KEY);
  const seed = async s => { await p.evaluate(({key,s}) => localStorage.setItem(key, JSON.stringify(s)), {key:KEY,s}); await p.reload(); await p.locator('.step-nav a[href="#cell-game"]').click(); await p.waitForTimeout(150); };
  try {
    for (const [idx, title, copy, label] of CARDS) {
      await seed(saved([idx]));
      await p.evaluate(() => { let i = 0; const v = [1,2,3,4]; Math.random = () => (v[i++ % 4] - .5) / 6; });
      await p.locator('#roll-dice').click();
      await p.waitForFunction(key => JSON.parse(localStorage.getItem(key)).game.turns > 3, KEY);
      const t = await p.locator('#chance-reveal-title').textContent(), c = await p.locator('#chance-reveal-copy').textContent(), l = await p.locator('#chance-reveal-label').textContent();
      T.ok(t === title && c === copy, `card ${idx}: printed title and text unchanged ("${t} ${c}")`);
      T.ok(l === label, `card ${idx}: the dialog shows the effect label "${label}" under the title (got "${l}")`);
      T.ok((await p.locator('#event-label').textContent()) === label && await p.locator('#event-label').isVisible(), `card ${idx}: the turn event shows the label`);
      await p.locator('#chance-reveal-ack').click(); await p.waitForTimeout(80);
      T.ok((await p.locator('#event-title').textContent()) === title && (await p.locator('#event-label').textContent()) === label, `card ${idx}: after following the card, the turn event keeps the printed title with the label`);
      await p.locator('.turn-log summary').click();
      const hist = await p.locator('#turn-history').textContent();
      T.ok(hist.includes('Cellular Chance card · ' + label + ': “' + title + ' ' + copy + '”'), `card ${idx}: the history names the label beside the printed card`);
    }
    // The label also appears for a card notice saved before labels existed (matched by its printed text).
    const old = saved([]); old.game.chanceNotice = {player:1,title:NOT,copy:'Move ahead 3 spaces.',effect:'Now on G1 space 5.',icon:''};
    await p.evaluate(({key,s}) => localStorage.setItem(key, JSON.stringify(s)), {key:KEY,s:old}); await p.reload(); await p.waitForTimeout(300);
    T.ok((await p.locator('#chance-reveal-label').textContent()) === 'Move ahead 3', 'a card saved by an older version still shows its label');
    T.ok(p.errors.length === 0, 'no page errors: ' + p.errors.join('; '));
  } catch (e) { T.ok(false, 'unexpected error: ' + e.message.split('\n')[0]); }
  await browser.close(); server.close(); T.done('t89-card-labels');
})();
