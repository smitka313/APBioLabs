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
      };
      p.on('dialog', dialog => dialog.accept());
      assert.deepEqual(p.errors, [], 'startup must not throw');
      assert.match(await p.locator('#analysis-page-status').textContent(), /Part 1 of 3/);
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
      assert.equal((await read()).game.turns, 0);
      // Use deterministic dice, while still clicking the real Roll control each turn.
      for (let turns = 0; !(await read()).game.complete && turns < 80; turns++) {
        const pos = (await read()).game.playersState[0].pos;
        const need = pos >= 24 && pos <= 27 ? 5 : 4;
        await p.evaluate(need => {
          let i = 0; const values = [1, 2, 3, need];
          Math.random = () => (values[i++ % 4] - 0.5) / 6;
        }, need);
        await roll();
      }
      assert.equal((await read()).game.complete, true, 'Round 1 reaches division');
      await p.locator('#start-round2-from-summary').click();
      assert.equal((await read()).game.round, 2);
      await roll();
      assert.equal(await p.locator('#chance-reveal').isVisible(), true);
      await p.locator('#chance-reveal-ack').click();
      assert.equal((await read()).game.chanceNotice, null);
      await p.locator('#reset-game').click();
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
      await go('analyze');
      for (const [button, part] of [['analysis-next', 2], ['analysis-next-bottom', 3],
        ['analysis-prev', 2], ['analysis-prev-bottom', 1]]) {
        await p.locator('#' + button).click();
        assert.match(await p.locator('#analysis-page-status').textContent(), new RegExp('Part ' + part));
        assert.ok(await p.locator('[data-analysis-page]').evaluateAll((els, part) =>
          els.every(el => el.hidden === (Number(el.dataset.analysisPage) !== part - 1)), part));
      }
      await p.locator('#analysis-design').fill('I kept cell type and body size constant.');
      await go('submit');
      const downloaded = p.waitForEvent('download');
      await p.locator('#download-work').click();
      assert.equal((await downloaded).suggestedFilename(), 'cell-cycle-cancer-model-work.json');
      await p.evaluate(() => { window.print = () => { window.printCalled = true; }; });
      await p.locator('#print-work').click();
      assert.equal(await p.evaluate(() => window.printCalled), true);
      await go('growth-model');
      await p.locator('#clear-trials').click();
      assert.equal((await read()).trials.length, 0);
      assert.deepEqual(p.errors, [], 'controls must not produce page errors');
      T.ok(true, width + 'px: game rounds, turns, reset, growth, analysis, export, and reload work');
      await ctx.close();
    }
  } finally { await browser.close(); }
  T.done('cell-cycle-controls');
})().catch(e => { console.error(e); process.exitCode = 1; });
