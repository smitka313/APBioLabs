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
      const context = await T.ctxFor(browser, { width, height, dark, reduced, touch:width===390 });
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
        const playMode=page.getByRole('group',{name:'How are you playing?'});
        const shared=playMode.getByRole('radio',{name:'Shared device'}), solo=playMode.getByRole('radio',{name:'Solo'});
        const herdSeat=playMode.getByRole('combobox',{name:'Wildebeest'}), hyenaSeat=playMode.getByRole('combobox',{name:'Hyenas'});
        const lionsSeat=playMode.getByRole('combobox',{name:'Lions'});
        T.ok(await shared.isChecked() && await herdSeat.inputValue()==='1' && await hyenaSeat.inputValue()==='2' &&
          await lionsSeat.inputValue()==='3' && await page.locator('#sg-rolebar').isHidden(),
          width+' px: shared-device defaults are clearly labeled on setup');
        if(width===390){
          await herdSeat.selectOption('3');
          await lionsSeat.selectOption('1');
          await page.reload();
          T.ok(await shared.isChecked() && await herdSeat.inputValue()==='3' && await lionsSeat.inputValue()==='1' &&
            await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).game===null,SAVE_KEY),
            'numbered role edits persist without starting a game');
        }
        if(width===768){
          await shared.focus();
          await page.keyboard.press('ArrowRight');
          T.ok(await solo.isChecked() && await herdSeat.isHidden(),'keyboard can select Solo, which hides the seat assignments');
          await page.reload();
          T.ok(await solo.isChecked() && await herdSeat.isHidden(),'Solo persists on reload');
        }
        T.ok(await fit(page), width + ' px: no horizontal overflow before play');
        T.ok((await page.locator('meta[name="robots"]').getAttribute('content')).includes('noindex'), 'draft is not indexed');
        await shot(page, width + '-setup');
        if (width === 390) {
          await page.locator('.sg-tabs [data-page="analyze"]').click();
          T.ok(await page.locator('#sg-evidence-choice').isDisabled() && await page.locator('#sg-selected').isHidden() &&
            /record evidence/i.test(await page.locator('#sg-analysis-record-note').textContent()),
            'Analyze explains that no evidence is available before the first turn');
          await page.locator('.sg-tabs [data-page="play"]').click();
        }
        if(width===390) await page.locator('#sg-start').tap();
        else await page.locator('#sg-start').click();
        const activeSeat=page.locator('#sg-rolebar .sg-role[aria-current=true]');
        T.ok(await playMode.isHidden() && (await activeSeat.innerText()).includes('Wildebeest'),
          'play keeps the official roles and hides setup-only controls');
        if(width===390){
          T.ok((await activeSeat.innerText()).includes('Player or team 3') &&
            (await page.locator('#sg-live').textContent()).includes('Player or team 3 (Wildebeest), your turn.'),
            'the reassigned team gets the first turn visually and in the announcement');
        }
        if(width===768){
          T.ok(!(await activeSeat.innerText()).includes('Player or team'),'Solo never asks for a team handoff');
        }
        const next = page.locator('#sg-next');
        await next.waitFor();
        const firstPath=page.locator('#sg-season-path');
        T.ok(await firstPath.locator('li').first().getAttribute('aria-current')==='step' &&
          await firstPath.getByText('Cards 0/3').isVisible(), width + ' px: season checklist starts at migration');
        T.ok(await fit(page), width + ' px: game fits the page');
        T.ok(await page.locator('#sg-phase').isVisible(), 'season phase is visible');
        await shot(page, width + '-game');
        if(width===390){
          await page.locator('[data-jump="turn"]').click();
          T.ok(await page.locator('#sg-action-title').evaluate(el=>document.activeElement===el && el.getBoundingClientRect().top>=0 && el.getBoundingClientRect().top<innerHeight),
            'phone can jump straight from map to current turn without swiping past the board');
          await page.locator('[data-jump="map"]').click();
          T.ok(await page.locator('#sg-board-title').evaluate(el=>document.activeElement===el && el.getBoundingClientRect().top>=0 && el.getBoundingClientRect().top<innerHeight),
            'phone can jump straight back to useful board context');
        }
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
              const example = dialog.locator('#sg-expanded-dice-example[open]');
              await example.waitFor();
              T.ok(await example.getByRole('cell',{name:'Both 2s (tie)'}).isVisible()
                && await example.getByRole('cell',{name:'1 (no match)'}).isVisible(),
                'before first roll the expanded board shows a worked tie and unmatched die');
              T.ok(await example.evaluate(el=>Boolean(el.compareDocumentPosition(document.querySelector('#sg-expanded-next')) & Node.DOCUMENT_POSITION_FOLLOWING)),
                'the worked dice example precedes the real roll action');
              await shot(page, width + '-before-first-hunt');
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
              T.ok(await example.count()===0 && await dialog.locator('#sg-expanded-dice-example summary').isVisible(),
                'after the first roll the example is folded and can be reopened');

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
              if(width===390) T.ok((await page.locator('#sg-rolebar .sg-role-seat').allTextContents()).join('|')===
                'Player or team 3|Player or team 2|Player or team 1','reload restores the role assignment midgame');
            }
          }
          T.ok(draws === 12, 'three cards are drawn in each of four seasons (got ' + draws + ')');
          T.ok(movedOnBoard, 'the playthrough exercises direct on-board movement');
          T.ok(checkedDice, 'the playthrough exercises the expanded dice animation');
          T.ok(actions.has('nextSeason'), 'later seasons can be reached');
          T.ok(/year complete/i.test(await page.locator('#sg-phase').textContent()), 'fall ends the four-season model');
          const seasonCards=page.locator('#sg-finish-totals .sg-totals li');
          const seasonDeltas=await page.evaluate(key=>SerengetiLogic.results(JSON.parse(localStorage.getItem(key)).game)
            .seasons.map(s=>s.end-s.start),SAVE_KEY);
          const format=n=>n<0?'−'+Math.abs(n):n>0?'+'+n:'0';
          T.ok((await seasonCards.locator('strong').allTextContents()).join('|')===seasonDeltas.map(format).join('|') &&
            (await seasonCards.getByText(/Cards|Hunts|→/).count())===0,
            'the final recap shows each season’s net change only; breakdown stays in the maps and export');
          const fieldReport=page.locator('#sg-finish-report');
          T.ok(await fieldReport.isHidden(),'final tally does not start with four full maps and a record list');
          await page.locator('#sg-finish-details > summary').click();
          await fieldReport.waitFor();
          T.ok(await page.locator('#sg-finish-totals .sg-totals').isHidden(), 'opening the interactive map breakdown hides the duplicate plain season totals');
          T.ok(await fieldReport.locator('.sg-field-season svg').count()===4, 'final report includes four official grazing maps');
          await fieldReport.locator('.sg-field-season[data-season="0"]').click();
          T.ok(await fieldReport.getByRole('heading',{name:'Winter evidence'}).isVisible(), 'selecting a map opens evidence from that season');
          T.ok((await fieldReport.locator('.sg-field-metrics dt').allTextContents()).join('|')==='Cumulative change|Event cards|Hunts',
            'expanded evidence keeps cumulative and source totals without repeating the season picker’s net change');
          await fieldReport.locator('[data-filter="migration"]').click();
          T.ok(await fieldReport.locator('.sg-field-records .sg-field-kind').allTextContents().then(kinds=>kinds.length===1&&kinds[0]==='Migration'),
            'field report filters the actual season record');
          await shot(page,width+'-field-report');
          await page.locator('.sg-tabs [data-page="evidence"]').click();
          T.ok(await page.locator('#sg-evidence-report .sg-field-season').count()===4, 'season maps are also available in Evidence');
          const evidence = page.locator('#sg-evidence-body');
          await evidence.waitFor();
          T.ok((await evidence.innerText()).trim().length > 0, 'data log has generated results');
          const records=page.locator('#sg-history-select');
          T.ok(await records.locator('option').count()>12 && await evidence.locator('.sg-rows li').count()===1,
            'full-year Evidence shows one detailed record while keeping all records selectable');
          const labels=await records.locator('option').allTextContents();
          T.ok(labels.every((label,index)=>label.startsWith('Record '+(index+1)+' · ')) &&
            new Set(labels).size===labels.length,
            'record labels are unique even when the season and event outcome repeat');
          const newest=await page.locator('#sg-history-detail').innerText();
          await records.selectOption('0');
          T.ok(await page.locator('#sg-history-detail').innerText()!==newest && /Winter/.test(await page.locator('#sg-history-detail').innerText()),
            'history selector retrieves the first season without scrolling the entire ledger');
          T.ok(await page.locator('#sg-evidence-report').isHidden(), 'maps are on demand rather than pushing the record controls below the fold');
          await shot(page, width + '-evidence');
          await page.locator('#sg-evidence-maps > summary').click();
          T.ok(await page.locator('.sg-evidence-totals').isHidden() && await records.isVisible(),
            'Evidence shows the expanded breakdown without a duplicate plain list and keeps the event picker');
          await page.locator('#sg-evidence-maps > summary').click();
          T.ok(await page.locator('.sg-evidence-totals').isVisible(), 'closing the maps restores the quick season totals');
          await page.locator('.sg-tabs [data-page="analyze"]').click();
          await page.locator('#sg-analysis-data').waitFor();
          T.ok(await page.locator('#sg-analysis-data').isVisible(), 'analysis references game data');
          T.ok(await fit(page), width + ' px: analysis fits the page');
          const answerRecord=page.locator('#sg-evidence-choice'), source=page.locator('#sg-selected');
          T.ok(await answerRecord.locator('option').count()===await records.locator('option').count()+1 &&
            await answerRecord.inputValue()==='' && await source.innerText()===newest,
            'Analyze provides every record and previews the latest without choosing for the student');
          const activePrompt=page.locator('[data-answer-panel]:visible');
          T.ok(await activePrompt.count()===1 && await activePrompt.getAttribute('data-answer-panel')==='evidence',
            'analysis starts with one focused evidence prompt');
          await shot(page, width + '-analysis-choose');
          await answerRecord.selectOption('0');
          await page.locator('#sg-answer-next').click();
          T.ok(await activePrompt.count()===1 && await activePrompt.getAttribute('data-answer-panel')==='claim' &&
            await source.isVisible() && await page.locator('#sg-analysis-data').isVisible(),
            'explanation step keeps the selected record and season totals without stacking the other prompts');
          await page.locator('#sg-claim').fill('A fictional draft about the hunt.');
          const huntIndex=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).game.log.findIndex(r=>r.kind==='hunt'),SAVE_KEY);
          T.ok(huntIndex>=0,'the completed run has a hunt to inspect inside Analyze');
          await answerRecord.selectOption(String(huntIndex));
          T.ok((await source.innerText()).includes('· Hunt') && /this record[\s\S]*→.*cumulative/.test(await source.innerText()) &&
            await source.locator('.sg-rows li p').isVisible() && await page.locator('#sg-claim').inputValue()==='A fictional draft about the hunt.' &&
            await page.locator('#sg-evidence').isHidden(),
            'switching to the detailed hunt shows the exact change and cumulative before/after alongside untouched writing without leaving Analyze');
          if (width===390) {
            await page.reload();
            T.ok(await answerRecord.inputValue()===String(huntIndex) && await activePrompt.getAttribute('data-answer-panel')==='claim' &&
              (await source.innerText()).includes('· Hunt'),
              'reload restores the chosen hunt beside the active explanation');
          }
          await shot(page, width + '-analysis');
          await page.locator('#sg-answer-next').click();
          T.ok(await activePrompt.count()===1 && await activePrompt.getAttribute('data-answer-panel')==='limits' &&
            await page.locator('#sg-selected').isVisible(), 'follow-up test stays focused on one prompt with the chosen record');
          T.ok(await page.locator('#sg-analysis-scope').isVisible() &&
            /births.*carrying capacity.*real population size/.test(await page.locator('#sg-analysis-scope').textContent()),
            'the follow-up writing prompt explains model limits in place');
          await shot(page, width + '-analysis-test');
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
        if(width===768){
          await page.locator('#sg-restart').click();
          await page.locator('#sg-confirm').getByRole('button',{name:'Restart game'}).click();
          T.ok(await shared.isChecked() && await herdSeat.inputValue()==='1' && await lionsSeat.inputValue()==='3' &&
            await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).game===null,SAVE_KEY),
            'confirmed restart returns to the shared defaults with no game started');
        }
        assert.deepEqual(errors, [], 'no page errors at ' + width + ' px');
      } finally { await context.close(); }
    }
  } finally { await browser.close(); server.close(); }
  T.done('t107-serengeti');
})().catch(e => { console.error(e); process.exitCode = 1; });

