/* Browser smoke test for the draft openscied-b1-serengeti activity.
   Set SERENGETI_SCREENSHOTS to save page captures. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const T = require('./_h');
const L = require('../serengeti-logic');
const SAVE_KEY = 'aplab:openscied-b1-serengeti:preview-v1';

(async () => {
  const browser = await T.launch(), server = await T.serve();
  const shotDir = process.env.SERENGETI_SCREENSHOTS;
  if (shotDir) fs.mkdirSync(shotDir, { recursive: true });
  async function shot(page, label) { if (shotDir) await page.screenshot({ animations: 'disabled', path: path.join(shotDir, label + '.png') }); }
  async function fit(page) { return page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1); }
  try {
    for (const [width, height, dark] of [[390, 844, true],[768, 960, false],[1366, 900, false],[1920, 1080, false]]) {
      const reduced = width === 390;
      const context = await T.ctxFor(browser, { width, height, dark, reduced });
      try {
        await context.addInitScript(() => {
          const original = crypto.getRandomValues.bind(crypto);
          crypto.getRandomValues = (array) => {
            if (array instanceof Uint32Array && array.length === 1) { array[0] = 32737; return array; }
            return original(array);
          };
        });
        const page = await context.newPage(), errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(server.url + 'openscied-b1-serengeti.html');
        await page.locator('#sg-start').waitFor();
        T.ok(await fit(page), width + ' px: no horizontal overflow before play');
        T.ok((await page.locator('meta[name="robots"]').getAttribute('content')).includes('noindex'), 'draft is not indexed');
        await shot(page, width + '-setup');
        await page.locator('#sg-start').click();
        const next = page.locator('#sg-next');
        await next.waitFor();
        T.ok(await fit(page), width + ' px: game fits the page');
        T.ok(await page.locator('#sg-phase').isVisible(), 'season phase is visible');
        await shot(page, width + '-game');
        const expand = page.locator('#sg-board-open');
        const dialog = page.locator('#sg-board-dialog');
        const inlineBoard = await page.locator('#sg-scene .sg-map').boundingBox();
        await expand.click();
        await dialog.waitFor();
        const enlarged = dialog.locator('#sg-board-slot #sg-scene');
        T.ok(await enlarged.isVisible(), width + ' px: enlarged board shows the live map');
        T.ok(await dialog.locator('#sg-expanded-next').isVisible(), width + ' px: the expanded board has its current turn action');
        const bounds = await dialog.boundingBox();
        T.ok(bounds && bounds.x >= -1 && bounds.y >= -1 && bounds.x + bounds.width <= width + 1 && bounds.y + bounds.height <= height + 1,
          width + ' px: expanded board stays inside the screen');
        const fitBoard = await enlarged.locator('.sg-map').boundingBox();
        T.ok(fitBoard && inlineBoard && fitBoard.width > inlineBoard.width + 5,
          width + ' px: the fit-to-screen map is larger than the inline map');
        await dialog.locator('#sg-board-zoom-in').click();
        const zoomBoard = await enlarged.locator('.sg-map').boundingBox();
        T.ok(await dialog.locator('#sg-board-viewport[data-zoomed]').count() === 1 && zoomBoard.width > fitBoard.width,
          width + ' px: zoom makes the board actually larger');
        await shot(page, width + '-board-zoom');
        await dialog.locator('#sg-board-fit').click();
        await shot(page, width + '-board-fit');
        await page.keyboard.press('Escape');
        await dialog.waitFor({state:'hidden'});
        await page.waitForFunction(() => document.activeElement?.id === 'sg-board-open');
        T.ok(await expand.evaluate(el => el === document.activeElement), width + ' px: closing the board returns focus');
        T.ok(await page.locator('#sg-play #sg-scene').count() === 1, width + ' px: closing restores the one original board');
        if (width === 390 || width === 1366) {
          const actions = new Set();
          let draws = 0, movedOnBoard = false, checkedDice = false;
          for (let attempt = 0; attempt < 500; attempt++) {
            if (!await next.isVisible()) break;
            if (!await next.isEnabled()) {
              const travel = page.locator('#sg-travel-piece');
              if (!await travel.isVisible()) break;
              await travel.selectOption('stay');
            }
            const action = await next.getAttribute('data-action');
            if (!action) break;
            actions.add(action);
            if (action === 'draw') draws++;
            if (action === 'beginHunts' && !movedOnBoard) {
              const readGame = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)).game, SAVE_KEY);
              const before = L.restore(await readGame());
              const selectedMove = L.phase(before).options[0];
              const oldPiece = before.tokens.find(t => t.id === selectedMove.tokenId);
              await expand.click();
              await dialog.waitFor();
              const cell = ({x,y}) => dialog.locator('.sg-map [data-cell="' + x + ':' + y + '"]');
              const piece = dialog.locator('.sg-map [data-token-id="' + selectedMove.tokenId + '"]');
              await piece.evaluate(el => { window.serengetiTestPiece = el; });
              T.ok(await cell(oldPiece.cell).getAttribute('data-source') === 'true', 'legal piece is marked on the board');
              await cell(oldPiece.cell).click();
              T.ok(await cell(selectedMove.to).getAttribute('data-destination') === 'true', 'selecting a piece marks its legal destination');
              await cell(selectedMove.to).click();
              T.ok(await piece.evaluate(el => el.getAnimations().length > 0) === !reduced,
                'real piece motion follows the browser motion preference');
              const after = L.restore(await readGame());
              const newPiece = after.tokens.find(t => t.id === selectedMove.tokenId);
              T.ok(newPiece.cell.x === selectedMove.to.x && newPiece.cell.y === selectedMove.to.y, 'tapping a destination moves the real token');
              T.ok(await piece.evaluate(el => window.serengetiTestPiece === el), 'the map preserves the piece element when it moves');
              T.ok(await dialog.locator('#sg-expanded-next').getAttribute('data-action') === 'beginHunts', 'expanded turn action follows live game state after a move');
              await shot(page, width + '-board-after-move');
              await dialog.locator('#sg-board-close').click();
              await dialog.waitFor({state:'hidden'});
              movedOnBoard = true;
            }
            if (action === 'roll' && !checkedDice) {
              await expand.click();
              await dialog.waitFor();
              const roll = dialog.locator('#sg-expanded-next[data-action="roll"]');
              await roll.click();
              const tray = dialog.locator('#sg-expanded-dice');
              const faces = tray.locator('.sg-pip-die[data-value]');
              await faces.first().waitFor();
              const values = await faces.evaluateAll(items => items.map(el => ({
                value:+el.dataset.value, pips:el.querySelectorAll('.sg-die-pip').length,
                label:el.getAttribute('aria-label'), result:el.dataset.result, motion:el.hasAttribute('data-dice-animate')
              })));
              T.ok(values.length >= 2 && values.every(d => d.value === d.pips && d.value >= 1 && d.value <= 6),
                'the expanded dice display the exact rolled values as pips');
              T.ok(values.every(d => d.label.startsWith(d.value + ', ') && ['kept','removed','tie','unmatched'].includes(d.result)),
                'roll results have a spoken value and a clear outcome');
              T.ok(values.every(d => d.motion === !reduced), 'dice animation follows the browser motion preference');
              T.ok(await tray.locator('.sg-dice-comparisons').isVisible(), 'the expanded turn explains the matched dice');
              await shot(page, width + '-hunt-dice');
              await dialog.locator('#sg-board-close').click();
              await dialog.waitFor({state:'hidden'});
              checkedDice = true;
              continue;
            }
            const drawExpanded = action === 'draw' && draws === 1;
            if (drawExpanded) {
              await expand.click();
              await dialog.waitFor();
              const expandedNext = dialog.locator('#sg-expanded-next');
              T.ok(await expandedNext.getAttribute('data-action') === 'draw', 'expanded board can draw event cards');
              await expandedNext.click();
            } else {
              await next.click();
            }
            if (action === 'draw') {
              const card = page.locator('#sg-event-modal');
              await card.waitFor();
              if (draws === 1) {
                const animation = await card.evaluate(el => getComputedStyle(el).animationName);
                T.ok(reduced ? animation === 'none' : animation.split(', ').includes('sg-card-deal'),
                  'card reveal follows the browser motion preference');
                await shot(page, width + '-event-card');
              }
              await card.locator('.sg-event-continue').click();
              await card.waitFor({state:'hidden'});
              if (drawExpanded) {
                T.ok(await dialog.isVisible(), 'closing the event card leaves the expanded board open');
                const ready = dialog.locator('#sg-expanded-next');
                T.ok(await ready.getAttribute('data-action') === 'resolveCard', 'the event is still pending after the pop-up closes');
                const reopen = dialog.locator('#sg-expanded-view-card');
                await dialog.locator('#sg-expanded-summary').click();
                T.ok(await dialog.locator('#sg-expanded-details').evaluate(el => el.open), 'details can be opened without covering the card button');
                await reopen.click();
                await card.waitFor();
                await page.keyboard.press('Escape');
                await card.waitFor({state:'hidden'});
                await page.waitForFunction(() => document.activeElement?.id === 'sg-expanded-view-card');
                T.ok(await dialog.isVisible(), 'Escape closes only the top card, not the game board');
                await ready.click();
                await dialog.locator('#sg-expanded-last').waitFor();
                T.ok(/Wildebeest.+cumulative/i.test(await dialog.locator('#sg-expanded-last-text').textContent()), 'expanded board shows the applied event result and cumulative change');
                await shot(page, width + '-board-result');
                await dialog.locator('#sg-board-close').click();
                await dialog.waitFor({state:'hidden'});
              }
            }
            if (attempt === 4) {
              await shot(page, width + '-early');
              const phase = await page.locator('#sg-phase').textContent();
              await page.reload();
              T.ok(await page.locator('#sg-phase').textContent() === phase, 'reload resumes the current phase');
            }
          }
          T.ok(draws === 12, 'three cards are drawn in each of four seasons (got ' + draws + ')');
          T.ok(movedOnBoard, 'the playthrough exercises direct on-board movement');
          T.ok(checkedDice, 'the playthrough exercises the expanded dice animation');
          T.ok(actions.has('nextSeason'), 'later seasons can be reached');
          T.ok(/year complete/i.test(await page.locator('#sg-phase').textContent()), 'fall ends the four-season model');
          await page.locator('.sg-tabs [data-page="evidence"]').click();
          const evidence = page.locator('#sg-evidence-body');
          await evidence.waitFor();
          T.ok((await evidence.innerText()).trim().length > 0, 'data log has generated results');
          await shot(page, width + '-evidence');
          await page.locator('.sg-tabs [data-page="analyze"]').click();
          await page.locator('#sg-analysis-data').waitFor();
          T.ok(await page.locator('#sg-analysis-data').isVisible(), 'analysis references game data');
          T.ok(await fit(page), width + ' px: analysis fits the page');
          await shot(page, width + '-analysis');
          if (width === 390) {
            const key = SAVE_KEY;
            const unreadable = ' {"v":99,"fictional":"exact original"} ';
            await page.evaluate(([k,raw]) => localStorage.setItem(k,raw), [key,unreadable]);
            await page.reload();
            await page.locator('#sg-recover').waitFor();
            const download = page.waitForEvent('download');
            await page.locator('#sg-recover').click();
            const saved = await download;
            T.ok(fs.readFileSync(await saved.path(), 'utf8') === unreadable, 'recovery downloads the original bytes');
            await page.locator('.sg-tabs [data-page="evidence"]').click();
            T.ok(await page.evaluate(k => localStorage.getItem(k),key) === unreadable, 'changing sections leaves unreadable saved work untouched');
          }
        }
        assert.deepEqual(errors, [], 'no page errors at ' + width + ' px');
      } finally { await context.close(); }
    }
  } finally { await browser.close(); server.close(); }
  T.done('t107-serengeti');
})().catch(e => { console.error(e); process.exitCode = 1; });
