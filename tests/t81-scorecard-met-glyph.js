/* Scorecard (review L3): a met requirement shows a check mark (and "met" for screen readers), not colour alone.
   Before the fix the active player's tint covered every cell and met status had no glyph. */
const T = require('./_h');
const KEY = 'aplab:openscied:b3-cell-cycle:v1';
(async () => {
  const browser = await T.launch(), server = await T.serve();
  const ctx = await T.ctxFor(browser, {width:1440,height:900,reduced:true});
  const p = await T.open(ctx,'openscied-b3-cell-cycle.html','cell-game',server.url);
  try {
    const score = {g1:{nutrients:3,proteins:1,organelles:4},s:{chromosomes:4},g2:{nutrients:0,proteins:1,organelles:0}};
    const game = {schema:3,mode:'solo',players:1,round:1,active:0,turns:0,complete:false,playersState:[{id:1,pos:9,score,status:'playing',turnsUsed:0,blue:0,red:0,destroyed:0,sentBack:0,skipped:0,skipTurns:0,bonusRolls:0,lastChip:null}],
      chanceDeck:[],logs:[],lastDice:[],lastRollSummary:'',roundResults:{},event:{title:'Ready',copy:'Test',icon:'',kicker:'Cell cycle'}};
    await p.evaluate(({key,game}) => localStorage.setItem(key, JSON.stringify({v:1,trials:[],fields:{},game})), {key:KEY,game});
    await p.reload();
    const cells = await p.locator('.player-score.is-active .score-phase-row > span:not(.score-na)').evaluateAll(els => els.map(el => ({met: el.classList.contains('score-met'), text: el.textContent})));
    const met = cells.filter(c => c.met), unmet = cells.filter(c => !c.met);
    T.ok(met.length === 4 && unmet.length === 3, `setup: 4 met and 3 unmet requirement cells (${met.length}/${unmet.length})`);
    T.ok(met.every(c => c.text.includes('✓')), 'every met cell shows a check mark: ' + met.map(c => c.text).join(' | '));
    T.ok(met.every(c => /met/.test(c.text)), 'every met cell says "met" for screen readers');
    T.ok(unmet.every(c => !c.text.includes('✓') && !/met/.test(c.text)), 'unmet cells show no check mark');
    const bg = await p.locator('.player-score.is-active .score-phase-row > span').evaluateAll(els => els.map(el => [el.classList.contains('score-met'), getComputedStyle(el).backgroundColor]));
    const metBg = new Set(bg.filter(b => b[0]).map(b => b[1])), otherBg = new Set(bg.filter(b => !b[0]).map(b => b[1]));
    T.ok([...metBg].every(c => !otherBg.has(c)), 'met cells keep a distinct background in the active player\'s scorecard');
    T.ok(p.errors.length === 0, 'no page errors: ' + p.errors.join('; '));
  } catch (e) { T.ok(false, 'unexpected error: ' + e.message.split('\n')[0]); }
  await browser.close(); server.close(); T.done('t81-scorecard-met-glyph');
})();
