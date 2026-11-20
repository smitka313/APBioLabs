/* Checkpoint card dialogs (owner request: "Add pop up cards for the checkpoints"). Turning over the G1, G2 or M
   Checkpoint card opens a card dialog like the Round 2 chance cards: the printed card text (Teacher Reference: Game
   Cards 1), the player's scorecard checked against it with ✓/✗ and words, the line that applies with an effect label,
   and why the checkpoint matters. While it is open the board shows the cell before the card; "Follow the card &
   continue" (or Escape) applies it once, and the result still goes to the turn event, the history and the one live
   region. The rules are unchanged (tests/t86-cell-game-checkpoints.js). Board indices: G1 1-6, G1 Checkpoint 7,
   S 8-15, G2 16-23, G2 Checkpoint 24, M 25-29, M Checkpoint 30, FINISH 31. */
const T = require('./_h');
const KEY = 'aplab:openscied:b3-cell-cycle:v1';
const sc = (g1 = [3,3,3], s = 4, g2 = [1,1,1]) => ({g1:{nutrients:g1[0],proteins:g1[1],organelles:g1[2]},s:{chromosomes:s},g2:{nutrients:g2[0],proteins:g2[1],organelles:g2[2]}});
const pl = (id, pos, score, extra) => Object.assign({id,pos,score:score||sc(),status:'playing',turnsUsed:0,blue:0,red:0,destroyed:0,sentBack:0,skipped:0,skipTurns:0,bonusRolls:0,lastChip:null}, extra||{});
// An older save: no checkpointNotice field at all.
const saved = (round, players) => ({v:1,trials:[],fields:{},game:{schema:3,mode:players.length>1?'group':'solo',players:players.length,round,active:0,turns:0,complete:false,playersState:players,chanceDeck:[],logs:[],lastDice:[],lastRollSummary:'',
  roundResults:round===2?{1:{blue:1,red:0,destroyed:0,sentBack:0,skipped:0,turns:75,players:1}}:{},chanceNotice:null,event:{title:'Ready',copy:'Test',icon:'',kicker:'Cell cycle'}}});
// The printed cards, word for word (Teacher Reference: Game Cards 1).
const DESTROYED = 'A 0 in any category, YOU HAVE BEEN DESTROYED by p53 AND MUST GO BACK TO THE START.';
const PRINTED = {
  'G1 Checkpoint': {intro:'Check your scorecard. If you have:', lines:['At least 3 nutrients, 3 proteins, and 3 organelles, YOU PASS THE CHECKPOINT.','2 in any category, GO BACK 3 SPACES.','1 in any category, GO BACK 5 SPACES.',DESTROYED]},
  'G2 Checkpoint': {intro:'Check your scorecard. If you have:', lines:['At least 4 DNA and at least 1 nutrient, 1 protein, and 1 organelle, YOU PASS THE CHECKPOINT.','Fewer than 4 DNA, GO BACK TO THE FIRST SPACE.',DESTROYED]},
  'M Checkpoint': {intro:'Double-check your scorecard. Make sure you have:', lines:['G1: at least 3 nutrients, 3 proteins, and 3 organelles.','S: at least 4 DNA.','G2: at least 1 nutrient, 1 protein, and 1 organelle.','YOU SUCCESSFULLY DIVIDED! Take a new blue cell chip!']},
};
// [name, round, start pos, scorecard, card title, printed line that applies (null: the M card's unprinted rule), label,
//  expected ✓/✗ per scorecard row, position after following, extra check on the player afterwards]
const CASES = [
  ['G1 pass', 1, 6, sc([3,4,3],0,[0,0,0]), 'G1 Checkpoint', 0, 'Pass', '✓✓✓', 7, q => q.sentBack === 0 && q.destroyed === 0],
  ['G1 a 2: back 3', 1, 6, sc([2,3,5],0,[0,0,0]), 'G1 Checkpoint', 1, 'Back 3 spaces', '✗✓✓', 4, q => q.sentBack === 1 && q.score.g1.nutrients === 2],
  ['G1 a 1: back 5', 2, 6, sc([3,1,4],0,[0,0,0]), 'G1 Checkpoint', 2, 'Back 5 spaces', '✓✗✓', 2, q => q.sentBack === 1 && q.score.g1.proteins === 1],
  ['G1 a 0: destroyed', 1, 6, sc([0,3,3],0,[0,0,0]), 'G1 Checkpoint', 3, 'Destroyed by p53: back to START', '✗✓✓', 0, q => q.destroyed === 1 && q.score.g1.proteins === 0],
  ['G2 pass', 1, 23, sc([3,3,3],4,[1,2,1]), 'G2 Checkpoint', 0, 'Pass', '✓✓✓✓', 24, q => q.sentBack === 0 && q.destroyed === 0],
  ['G2 fewer than 4 DNA: back to S', 2, 23, sc([3,3,3],3,[1,1,1]), 'G2 Checkpoint', 1, 'Back to first S space', '✗✓✓✓', 8, q => q.sentBack === 1 && q.score.s.chromosomes === 3],
  ['G2 a 0: destroyed', 1, 23, sc([3,3,3],4,[0,2,2]), 'G2 Checkpoint', 2, 'Destroyed by p53: back to START', '✓✗✓✓', 0, q => q.destroyed === 1],
  ['M pass', 1, 29, sc([4,3,5],4,[2,1,1]), 'M Checkpoint', 3, 'Divided: blue cell chip', '✓✓✓', 31, q => q.blue === 1],
  ['M fail (G1 short)', 2, 29, sc([3,2,3],4,[1,1,1]), 'M Checkpoint', null, 'Destroyed by p53: back to START', '✗✓✓', 0, q => q.destroyed === 1 && q.blue === 0 && q.red === 0],
];
(async () => {
  const browser = await T.launch(), server = await T.serve();
  try {
    const ctx = await T.ctxFor(browser, {width:1366,height:768,reduced:true});
    const p = await T.open(ctx,'openscied-b3-cell-cycle.html','cell-game',server.url);
    const read = () => p.evaluate(key => JSON.parse(localStorage.getItem(key)).game, KEY);
    const seed = async s => { await p.evaluate(({key,s}) => localStorage.setItem(key, JSON.stringify(s)), {key:KEY,s}); await p.reload(); await p.locator('.step-nav a[href="#cell-game"]').click(); await p.waitForTimeout(150); };
    const turnOver = async () => {
      const before = (await read()).turns;
      await p.locator('#roll-dice').click();
      await p.waitForFunction(({key,before}) => JSON.parse(localStorage.getItem(key)).game.turns > before, {key:KEY,before}, {timeout:5000});
    };
    const texts = sel => p.locator(sel).evaluateAll(els => els.map(e => e.textContent.replace(/\s+/g,' ').trim()));
    for (const [name, round, pos, score, title, applies, label, marks, after, extra] of CASES) {
      await seed(saved(round, [pl(1,pos,score)]));
      await turnOver();
      const dlg = p.locator('#checkpoint-reveal');
      T.ok(await dlg.isVisible(), `${name}: the checkpoint card opens`);
      T.ok(await p.locator('#checkpoint-reveal-title').textContent() === title, `${name}: card title "${title}"`);
      T.ok(new RegExp('ROUND ' + round + ' · CHECKPOINT CARD').test(await p.locator('#checkpoint-reveal-kicker').textContent()), `${name}: kicker names Round ${round}`);
      T.ok(await p.evaluate(() => document.activeElement && document.activeElement.id) === 'checkpoint-reveal-ack', `${name}: focus is on "Follow the card & continue"`);
      // Printed text, word for word.
      const printed = PRINTED[title];
      T.ok(await p.locator('#checkpoint-reveal-intro').textContent() === printed.intro, `${name}: printed intro "${printed.intro}"`);
      const lines = await texts('#checkpoint-reveal-lines .checkpoint-card-text');
      T.ok(JSON.stringify(lines) === JSON.stringify(printed.lines), `${name}: every printed line, exactly (${JSON.stringify(lines)})`);
      // The applying line: highlighted, with a text marker (not colour alone) and the effect label.
      const on = await p.locator('#checkpoint-reveal-lines li.is-applies').evaluateAll(els => els.map(e => ({text: e.querySelector('.checkpoint-card-text').textContent, marker: (e.querySelector('.checkpoint-card-marker')||{}).textContent, label: (e.querySelector('.checkpoint-card-label')||{}).textContent})));
      const house = await p.locator('#checkpoint-reveal-house').isVisible();
      if (applies === null) {
        T.ok(on.length === 0 && house, `${name}: no printed line applies; the game's unprinted rule is shown instead`);
        const h = await p.locator('#checkpoint-reveal-house').textContent();
        T.ok(/Not printed on the card/.test(h) && /Applies to you/.test(h) && h.includes(label), `${name}: the rule is marked "Not printed on the card" with "${label}" ("${h}")`);
      } else {
        T.ok(on.length === 1 && on[0].text === printed.lines[applies] && /Applies to you/.test(on[0].marker) && on[0].label === label && !house,
          `${name}: the line that applies is highlighted with "▶ Applies to you" and the label "${label}" (${JSON.stringify(on)})`);
      }
      // The player's scorecard, checked against the card: a glyph and a word in each row.
      const rows = await p.locator('#checkpoint-reveal-checks li').evaluateAll(els => els.map(e => ({glyph: e.querySelector('.checkpoint-check-glyph').textContent, verdict: e.querySelector('.checkpoint-check-verdict').textContent, text: e.textContent})));
      T.ok(rows.map(r => r.glyph).join('') === marks && rows.every(r => r.verdict === (r.glyph === '✓' ? 'Met' : 'Not met')), `${name}: scorecard rows ${marks} with "Met"/"Not met" (${rows.map(r => r.text).join(' | ')})`);
      const effect = await p.locator('#checkpoint-reveal-effect').textContent();
      T.ok(effect.startsWith('Result: ' + label + '.'), `${name}: the result line names the effect ("${effect}")`);
      T.ok(/^Why this checkpoint matters: \S/.test(await p.locator('#checkpoint-reveal-why').textContent()), `${name}: a "why this checkpoint matters" line`);
      // Before following: the board shows the cell on the checkpoint, scorecard untouched, nothing applied.
      let g = await read(), q = g.playersState[0];
      const cp = {'G1 Checkpoint':7,'G2 Checkpoint':24,'M Checkpoint':30}[title];
      T.ok(q.pos === cp && JSON.stringify(q.score) === JSON.stringify(score) && q.sentBack === 0 && q.destroyed === 0 && q.blue === 0 && g.checkpointNotice && g.checkpointNotice.pending,
        `${name}: while the card is open the piece is on the checkpoint and nothing is applied yet`);
      // Reload with the card open: it is still open and still not applied.
      await p.reload(); await p.waitForTimeout(150);
      g = await read(); q = g.playersState[0];
      T.ok(await dlg.isVisible() && q.pos === cp && (await p.locator('#checkpoint-reveal-title').textContent()) === title, `${name}: the open card survives a reload, unapplied`);
      await p.locator('#checkpoint-reveal-ack').click();
      g = await read(); q = g.playersState[0];
      T.ok(!(await dlg.isVisible()) && g.checkpointNotice === null, `${name}: following the card closes it`);
      T.ok(q.pos === after && extra(q), `${name}: the card is applied as the rules say (pos ${q.pos})`);
      T.ok(g.event.label === label && (await p.locator('#event-label').textContent()) === label, `${name}: the turn event carries the label "${label}" ("${g.event.title}")`);
      const said = await p.locator('#game-announcer').textContent();
      T.ok(said.includes(g.event.title) && said.split(g.event.title).length === 2, `${name}: the result is announced once ("${said}")`);
      T.ok(g.logs.length >= 1 && (await p.locator('#turn-history li').first().textContent()) === g.logs[g.logs.length - 1], `${name}: the result is in the history ("${g.logs.join(' / ')}")`);
      // Reload after following: applied exactly once.
      await p.reload(); await p.waitForTimeout(150);
      const g2 = await read();
      T.ok(!(await dlg.isVisible()) && JSON.stringify(g2.playersState[0]) === JSON.stringify(q) && g2.logs.length === g.logs.length, `${name}: after a reload the card is not shown or applied again`);
    }
    // The announcer is the only live region: the card opening says it briefly, without the result.
    await seed(saved(1, [pl(1,6,sc([2,3,3],0,[0,0,0]))]));
    await turnOver();
    const opening = await p.locator('#game-announcer').textContent();
    T.ok(/Turned over the G1 Checkpoint card/.test(opening) && !/GO BACK/.test(opening), `opening the card is announced without the result ("${opening}")`);
    T.ok(await p.locator('#checkpoint-reveal [aria-live], #checkpoint-reveal [role="status"]').count() === 0, 'the card dialog adds no second live region');
    // The roll button does nothing while the card is open.
    await p.evaluate(() => document.getElementById('roll-dice').click()); await p.waitForTimeout(300);
    T.ok((await read()).turns === 1 && (await read()).checkpointNotice, 'Roll is ignored while the card is open');
    // Keyboard: Tab stays in the card; Escape follows it and does not close the enlarged board behind it.
    await p.keyboard.press('Tab'); await p.keyboard.press('Tab'); await p.keyboard.press('Shift+Tab');
    T.ok(await p.evaluate(() => !!document.activeElement.closest('#checkpoint-reveal')), 'Tab keeps focus inside the card');
    await p.evaluate(() => document.getElementById('checkpoint-reveal-ack').focus());
    await p.keyboard.press('Escape');
    let g = await read();
    T.ok(!(await p.locator('#checkpoint-reveal').isVisible()) && g.checkpointNotice === null && g.playersState[0].pos === 4 && g.playersState[0].sentBack === 1, 'Escape follows the card (back 3 spaces) and closes it');
    await seed(saved(1, [pl(1,23,sc([3,3,3],4,[1,1,1]))]));
    await p.locator('#enlarge-scene').click();
    await turnOver();
    T.ok(await p.locator('#checkpoint-reveal').isVisible(), 'in the enlarged board the card opens');
    const box = await p.locator('#checkpoint-card-panel').boundingBox(), vp = p.viewportSize();
    T.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= vp.width && box.y + box.height <= vp.height, 'in the enlarged board the card fits the window');
    T.ok(await p.locator('#checkpoint-reveal').evaluate(el => { const r = el.querySelector('#checkpoint-reveal-ack').getBoundingClientRect(); return document.elementFromPoint(r.x + r.width/2, r.y + r.height/2) === el.querySelector('#checkpoint-reveal-ack'); }), 'the card sits above the enlarged board (its button is on top)');
    await p.keyboard.press('Escape');
    T.ok(!(await p.locator('#checkpoint-reveal').isVisible()) && (await p.locator('#enlarge-scene').getAttribute('aria-pressed')) === 'true' && (await read()).playersState[0].pos === 24,
      'Escape follows the card but leaves the enlarged board open');
    await p.keyboard.press('Escape');
    T.ok((await p.locator('#enlarge-scene').getAttribute('aria-pressed')) === 'false', 'a second Escape closes the enlarged board');
    // Old save: no checkpointNotice field, and an event saved before labels; play continues normally.
    T.ok(p.errors.length === 0, 'no page errors: ' + p.errors.join('; '));
    await ctx.close();
    // 390 px, dark mode: the card fits without sideways scrolling and its button is on screen.
    for (const [w, h, dark] of [[390, 844, true], [390, 640, true], [1366, 768, false]]) {
      const c2 = await T.ctxFor(browser, {width:w,height:h,dark,reduced:true});
      const q = await T.open(c2,'openscied-b3-cell-cycle.html','cell-game',server.url);
      await q.evaluate(({key,s}) => localStorage.setItem(key, JSON.stringify(s)), {key:KEY,s:saved(2,[pl(1,29,sc([3,2,3],3,[1,1,0]))])});
      await q.reload(); await q.locator('.step-nav a[href="#cell-game"]').click(); await q.waitForTimeout(150);
      await q.locator('#roll-dice').click(); await q.locator('#checkpoint-reveal-ack').waitFor({state:'visible'});
      const m = await q.evaluate(() => { const panel = document.getElementById('checkpoint-card-panel').getBoundingClientRect(), b = document.getElementById('checkpoint-reveal-ack').getBoundingClientRect(), t = document.getElementById('checkpoint-reveal-title').getBoundingClientRect();
        const over = Array.from(document.querySelectorAll('#checkpoint-reveal *')).filter(e => { const r = e.getBoundingClientRect(); return r.width && (r.right > innerWidth + 0.5 || r.left < -0.5); }).length;
        return {panel:[panel.left,panel.top,panel.right,panel.bottom], b:[b.top,b.bottom,b.height], t:t.top, sw:document.documentElement.scrollWidth, over, iw:innerWidth, ih:innerHeight}; });
      T.ok(m.sw <= m.iw && m.over === 0 && m.panel[0] >= 0 && m.panel[2] <= m.iw && m.panel[3] <= m.ih, `${w}×${h}${dark?' dark':''}: the M card fits with no sideways scroll (${JSON.stringify(m)})`);
      T.ok(m.b[0] >= 0 && m.b[1] <= m.ih && m.b[2] >= 24 && m.t >= 0, `${w}×${h}: the title and the "Follow the card" button are on screen when it opens`);
      T.ok(q.errors.length === 0, `${w}×${h}: no page errors ` + q.errors.join('; '));
      await c2.close();
    }
  } catch (e) { T.ok(false, 'unexpected error: ' + e.message.split('\n')[0]); }
  await browser.close(); server.close(); T.done('t90-checkpoint-cards');
})();
