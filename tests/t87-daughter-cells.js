/* After a division the magnified cell shows two daughter cells (OpenSciEd B.3 Lesson 3, Multiple Models). A blue chip:
   both daughters have the same chromosome set, caption "Daughter cells · identical DNA". A red chip: one daughter carries
   a changed chromosome, drawn red with a dashed outline and a CHANGED label, caption "Daughter cells · one carries
   changed DNA (game model)". The scene description and the canvas label say the same, with and without reduced motion. */
const T = require('./_h');
const KEY = 'aplab:openscied:b3-cell-cycle:v1';
const sc = () => ({ g1: { nutrients: 3, proteins: 3, organelles: 3 }, s: { chromosomes: 4 }, g2: { nutrients: 1, proteins: 1, organelles: 1 } });
const seed = chip => ({ v: 1, trials: [], fields: {}, lastSection: 'cell-game', game: { schema: 3, mode: 'solo', players: 1, round: 2, active: 0, turns: 12, complete: false,
  playersState: [{ id: 1, pos: 31, score: sc(), status: 'playing', turnsUsed: 12, blue: chip === 'blue' ? 1 : 0, red: chip === 'red' ? 1 : 0, destroyed: 0, sentBack: 0, skipped: 0, skipTurns: 0, bonusRolls: 0, lastChip: chip }],
  chanceDeck: [1, 2, 3], logs: [], lastDice: [1, 2, 3, 4], lastRollSummary: '', roundResults: {}, chanceNotice: null, event: { title: 'Divided', copy: 'Test', icon: '', kicker: 'Cell divided' } } });
(async () => {
  const browser = await T.launch(), server = await T.serve();
  try {
    for (const reduced of [true, false]) {
      const ctx = await T.ctxFor(browser, { width: 1366, height: 900, reduced });
      const p = await T.open(ctx, 'openscied-b3-cell-cycle.html', 'cell-game', server.url);
      for (const chip of ['blue', 'red']) {
        const tag = (reduced ? 'reduced motion' : 'full motion') + ', ' + chip + ' chip: ';
        await p.evaluate(({ key, s }) => localStorage.setItem(key, JSON.stringify(s)), { key: KEY, s: seed(chip) });
        await p.reload();
        await p.locator('#cycle-scene').scrollIntoViewIfNeeded();
        await p.waitForTimeout(400);
        const state = await p.evaluate(() => window.CellCycleScene.state());
        const description = await p.locator('#scene-description').textContent();
        const label = await p.locator('#cycle-scene').getAttribute('aria-label');
        if (chip === 'blue') {
          T.ok(state.view === 'daughters' && state.caption === 'Daughter cells · identical DNA', tag + 'caption is "Daughter cells · identical DNA"');
          T.ok(state.daughters.length === 2 && !state.daughters.some(d => d.changed) && JSON.stringify(state.daughters[0].chromosomes) === JSON.stringify(state.daughters[1].chromosomes) && state.daughters[0].chromosomes.length === 4,
            tag + 'two daughters with identical four-chromosome sets');
          T.ok(/Daughter cells · identical DNA\. Both daughter cells have the same chromosome set\./.test(description), tag + 'scene description says identical DNA');
          T.ok(/^The Cell Game board/.test(label) && /Magnified view now: Daughter cells · identical DNA/.test(label), tag + 'canvas aria-label says identical DNA');
          T.ok(state.changedAt === null, tag + 'no changed chromosome is marked');
        } else {
          T.ok(state.caption === 'Daughter cells · one carries changed DNA (game model)', tag + 'caption is "Daughter cells · one carries changed DNA (game model)"');
          T.ok(JSON.stringify(state.daughters.map(d => d.changed)) === '[true,false]' && state.daughters[0].chromosomes.filter(c => c === 'changed').length === 1, tag + 'exactly one daughter has one changed chromosome');
          T.ok(/one carries changed DNA \(game model\)\. One daughter cell has a changed chromosome, drawn red with a dashed outline and labelled CHANGED/.test(description), tag + 'scene description names the changed chromosome and its non-colour cues');
          T.ok(/Magnified view now: Daughter cells · one carries changed DNA \(game model\)/.test(label) && (label.match(/Magnified view now/g) || []).length === 1, tag + 'canvas aria-label says the same (once)');
          // Canvas pixels at the changed section are red.
          const px = await p.evaluate(at => {
            const c = document.getElementById('cycle-scene'), g = c.getContext('2d'), sx = c.width / 1160, sy = c.height / 760;
            const d = g.getImageData(Math.round(at.x * sx) - 2, Math.round(at.y * sy) - 2, 5, 5).data; let best = [0, 0, 0, -999];
            for (let i = 0; i < d.length; i += 4) { const score = d[i] - Math.max(d[i + 1], d[i + 2]); if (score > best[3]) best = [d[i], d[i + 1], d[i + 2], score]; }
            return best;
          }, state.changedAt);
          T.ok(px[0] > 200 && px[1] < 120 && px[2] < 120, tag + 'canvas pixel at the changed section is red ' + JSON.stringify(px.slice(0, 3)));
        }
        if (chip === 'blue') {
          // The same spot in the blue case is not red: the change appears only after a red-chip division.
          const px = await p.evaluate(() => {
            const c = document.getElementById('cycle-scene'), g = c.getContext('2d'), sx = c.width / 1160, sy = c.height / 760;
            const d = g.getImageData(Math.round(448 * sx), Math.round(297 * sy), Math.round(40 * sx), Math.round(40 * sy)).data; let red = 0;
            for (let i = 0; i < d.length; i += 4) if (d[i] > 200 && d[i + 1] < 90 && d[i + 2] < 90) red++;
            return red;
          });
          T.ok(px === 0, tag + 'no red pixels in the left daughter nucleus (' + px + ')');
        }
      }
      // A new cell after the division returns the magnified view to one cell and the plain label.
      await p.evaluate(({ key, s }) => { s.game.playersState[0].pos = 1; s.game.playersState[0].lastChip = null; localStorage.setItem(key, JSON.stringify(s)); }, { key: KEY, s: seed('red') });
      await p.reload();
      T.ok((await p.evaluate(() => window.CellCycleScene.state())).view === 'cell' && !/Magnified view now/.test(await p.locator('#cycle-scene').getAttribute('aria-label')) && !/Daughter cells/.test(await p.locator('#scene-description').textContent()),
        (reduced ? 'reduced' : 'full') + ' motion: away from FINISH the view, description and label go back to one cell');
      T.ok(p.errors.length === 0, 'no page errors ' + JSON.stringify(p.errors));
      await ctx.close();
    }
  } finally { await browser.close(); server.close(); }
  T.done('t87-daughter-cells');
})().catch(e => { console.error(e); process.exitCode = 1; });
