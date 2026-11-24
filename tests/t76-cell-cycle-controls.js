/* Exercise the real companion page: startup errors must fail this test. */
const T = require('./_h');
const assert = require('node:assert/strict');
const KEY = 'aplab:openscied:b3-cell-cycle:v1';
(async () => {
  const browser = await T.launch();
  try {
    for (const width of [1440, 390]) {
      const ctx = await T.ctxFor(browser, { width, height: 1000, reduced: true });
      const p = await T.open(ctx, 'openscied-b3-cell-cycle.html', 'cell-game');
      const read = () => p.evaluate(key => JSON.parse(localStorage.getItem(key)), KEY);
      const go = async id => {
        await p.locator('.step-nav a[href="#' + id + '"]').click();
        await p.waitForFunction(id => document.getElementById(id).classList.contains('is-current'), id);
      };
      const roll = async () => {
        const before = (await read()).game.turns;
        await p.locator('#roll-dice').click();
        await p.waitForFunction(({key, before}) => JSON.parse(localStorage.getItem(key)).game.turns > before,
          {key: KEY, before});
        if (await p.locator('#checkpoint-reveal-ack').isVisible()) await p.locator('#checkpoint-reveal-ack').click();   // a checkpoint card: follow it
      };
      p.on('dialog', dialog => dialog.accept());
      assert.deepEqual(p.errors, [], 'startup must not throw');
      assert.match(await p.locator('#analysis-page-status').textContent(), /Part 1 of 4/);
      await p.locator('#start-round1').click();
      assert.equal((await read()).game.round, 1);
      await roll();
      assert.equal((await read()).game.playersState[0].pos, 1);
      assert.equal((await read()).game.lastDice.length, 4);
      if (width === 1440) {
        const board = await p.locator('#cell-board').boundingBox();
        const hud = await p.locator('.game-play-grid').boundingBox();
        assert.ok(hud.x >= board.x + board.width, 'desktop HUD sits beside the board');
      }
      await p.locator('#enlarge-scene').click();
      assert.equal(await p.locator('#enlarge-scene').getAttribute('aria-pressed'), 'true');
      await p.keyboard.press('Escape');
      assert.equal(await p.locator('#enlarge-scene').getAttribute('aria-pressed'), 'false');
      await p.reload();
      assert.equal((await read()).game.turns, 1, 'reload preserves progress');
      await roll();
      await p.locator('#restart-round').click();
      await p.locator('#confirm-game-reset').click();
      assert.equal((await read()).game.turns, 0);
      // Use deterministic dice, while still clicking the real Roll control each turn: 1-4 collects everything; in M, roll
      // the number the turn asks for. Stop after the first division and end the round with the visible button.
      for (let turns = 0; !(await read()).game.playersState[0].blue && turns < 60; turns++) {
        const m = /must roll a (\d)/.exec(await p.locator('#turn-instruction').textContent());
        await p.evaluate(need => {
          let i = 0; const values = need ? [need, 6, 6, 6] : [1, 2, 3, 4];
          Math.random = () => (values[i++ % 4] - 0.5) / 6;
        }, m ? Number(m[1]) : 0);
        await roll();
      }
      assert.equal((await read()).game.playersState[0].blue, 1, 'Round 1 reaches division and a blue chip');
      assert.equal((await read()).game.complete, false, 'play continues after a division');
      await p.locator('#end-round').click();
      await p.locator('#confirm-game-reset').click();
      assert.equal((await read()).game.complete, true, 'End this round now records the round');
      assert.equal((await read()).game.roundResults[1].blue, 1);
      await p.keyboard.press('Escape');   // close the Round complete / Game over dialog (play-test item 17)
      await p.locator('#start-round2-from-summary').click();
      assert.equal((await read()).game.round, 2);
      await p.evaluate(() => { let i = 0; const values = [1, 2, 3, 4]; Math.random = () => (values[i++ % 4] - 0.5) / 6; });
      await roll();
      assert.equal(await p.locator('#chance-reveal').isVisible(), false, 'G1 space 1 is not a light-blue square');
      await p.evaluate(key => { const s = JSON.parse(localStorage.getItem(key)); s.game.chanceDeck = [7]; localStorage.setItem(key, JSON.stringify(s)); }, KEY);
      await p.reload();
      await roll();
      assert.equal(await p.locator('#chance-reveal').isVisible(), true, 'G1 space 2 (light blue) draws a Cellular Chance card');
      await p.locator('#chance-reveal-ack').click();
      assert.equal((await read()).game.chanceNotice, null);
      await p.locator('#reset-game').click();
      await p.locator('#confirm-game-reset').click();
      await p.locator('input[name="game-mode"][value="group"]').check();
      await p.locator('#group-size').selectOption('3');
      await p.locator('#start-round1').click();
      assert.equal((await read()).game.playersState.length, 3);
      await roll();
      assert.equal((await read()).game.active, 1, 'turn passes to player 2');
      await go('background');
      await p.locator('input[name="quick-check"][value="b"]').check();
      await p.locator('#check-background').click();
      assert.match(await p.locator('#background-feedback').textContent(), /^Yes/);
      await go('growth-model');
      await p.locator('#tissue-rate').selectOption('colon');
      await p.locator('#run-trials').click();
      assert.equal((await read()).trials.length, 3);
      const playbackLabel = await p.locator('#pause-growth').textContent();
      await p.locator('#pause-growth').click();
      assert.notEqual(await p.locator('#pause-growth').textContent(), playbackLabel);
      await p.locator('#replay-growth').click();
      await p.locator('#enlarge-growth').click();
      await p.keyboard.press('Escape');
      assert.equal(await p.locator('#enlarge-growth').getAttribute('aria-pressed'), 'false');
      await go('cell-game');
      await p.locator('#ms-r1-g1-represent').fill('The cell grows and gathers what it needs.');
      assert.equal((await read()).fields['ms-r1-g1-represent'], 'The cell grows and gathers what it needs.', 'Making Sense answers save');
      await go('analyze');
      assert.equal((await read()).lastSection, 'analyze', 'current section is saved for dashboard Resume');
      for (const [button, part] of [['analysis-next', 2], ['analysis-next-bottom', 3], ['analysis-next', 4],
        ['analysis-prev', 3], ['analysis-prev-bottom', 2], ['analysis-prev', 1]]) {
        await p.locator('#' + button).click();
        assert.match(await p.locator('#analysis-page-status').textContent(), new RegExp('Part ' + part));
        assert.ok(await p.locator('[data-analysis-page]').evaluateAll((els, part) =>
          els.every(el => el.hidden === (Number(el.dataset.analysisPage) !== part - 1)), part));
      }
      await p.locator('#analysis-design').fill('I kept cell type and body size constant.');
      await go('submit');
      assert.match(await p.locator('.report-student').textContent(), /Test Student.*Class period: 3/);
      await p.locator("details.ose-report-other > summary").click();
      const downloaded = p.waitForEvent('download');
      await p.locator('#download-work').click();
      const file = await downloaded;
      assert.equal(file.suggestedFilename(), 'cell-cycle-cancer-model-work.json');
      const payload = JSON.parse(require('node:fs').readFileSync(await file.path(), 'utf8'));
      assert.deepEqual(payload.student, { name: 'Test Student', period: '3' });
      assert.equal(payload.answers['ms-r1-g1-represent'], 'The cell grows and gathers what it needs.');
      assert.equal(payload.lesson3MakingSense.round1Table[0].couldRepresent, 'The cell grows and gathers what it needs.');
      await p.evaluate(() => { window.print = () => { window.printCalled = true; }; });
      await p.locator('#print-work').click();
      assert.equal(await p.evaluate(() => window.printCalled), true);
      await go('growth-model');
      await p.locator('#clear-trials').click();
      await p.locator('#confirm-game-reset').click();   // the page's confirm dialog, not window.confirm
      assert.equal((await read()).trials.length, 0);
      assert.deepEqual(p.errors, [], 'controls must not produce page errors');
      T.ok(true, width + 'px: game rounds, turns, reset, growth, analysis, export, and reload work');
      await ctx.close();
    }
  } finally { await browser.close(); }
  T.done('cell-cycle-controls');
})().catch(e => { console.error(e); process.exitCode = 1; });
