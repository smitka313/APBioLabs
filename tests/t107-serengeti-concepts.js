/* The optional seasonal checks mirror on both maps, teach on retry, and do not alter the game. */
const assert = require('node:assert/strict');
const T = require('./_h');
const L = require('../serengeti-logic');
const key = 'aplab:openscied-b1-serengeti:preview-v1';
const file = 'openscied-b1-serengeti.html';
const act = (s, type) => L.act(s, { type });

function fixtures() {
  let s = L.create(641);
  const out = { winterBefore: s };
  for (let i = 0; i < 400; i++) {
    const p = L.phase(s), season = p.kind === 'migration' ? s.season : -1;
    if (p.kind === 'complete') break;
    if (season === 1) out.springBefore = s;
    if (season === 3) out.fallBefore = s;
    const type = ({ migration:'migrate', hyenaMove:'beginHunts', lionMove:'beginHunts', hunt:'roll', seasonEnd:'nextSeason' })[p.kind] ||
      (p.card ? 'resolveCard' : 'draw');
    const n = act(s, type);
    if (s.season === 0 && type === 'roll' && n.log.length > s.log.length && !out.winterAfter) {
      out.winterAfter = n;
      out.winterRoll = s;
    }
    if (season === 1) out.springAfter = n;
    if (s.season === 2 && type === 'draw' && !out.summerDrawn) out.summerDrawn = n;
    if (s.season === 2 && type === 'resolveCard' && !out.summerAfter) out.summerAfter = n;
    if (s.season === 3 && p.kind === 'seasonEnd') out.fallAfter = s;
    s = n;
  }
  assert.equal(L.phase(s).kind, 'complete');
  for (const id of ['winterAfter','winterRoll','springBefore','springAfter','summerDrawn','summerAfter','fallBefore','fallAfter']) assert.ok(out[id], id);
  return out;
}

(async () => {
  const games = fixtures(), browser = await T.launch();
  let server, context;
  try {
    server = await T.serve();
    context = await T.ctxFor(browser, { width:390, height:844, dark:true, reduced:true });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(server.url + file);
    const seed = async game => {
      await page.evaluate(([k,g]) => localStorage.setItem(k, JSON.stringify({ v:1, game:g, answers:{}, page:'play' })), [key,game]);
      await page.reload();
      await page.locator('#sg-next').waitFor();
    };
    const read = () => page.evaluate(k => JSON.parse(localStorage.getItem(k)), key);
    const inline = page.locator('#sg-concept');
    const expanded = page.locator('#sg-expanded-concept');
    const select = inline.locator('select');
    const next = page.locator('#sg-next');
    const ids = () => select.locator('option').evaluateAll(options => options.map(o => o.value));
    const question = (panel,id) => page.waitForFunction(([selector,id]) => {
      const panel = document.querySelector(selector);
      return panel && !panel.hidden && panel.dataset.question === id;
    }, ['#' + panel, id]);
    const ensureOpen = async panel => {
      if (!(await panel.evaluate(el => el.open))) await panel.locator('summary').click();
    };

    await seed(games.winterBefore);
    assert.equal(await inline.isHidden(), true, 'setup does not unlock the Winter hunt check');
    await seed(games.winterRoll);
    assert.equal(await inline.isHidden(), true, 'a pending or partially rolled hunt is not a completed hunt');
    assert.equal(await next.isEnabled(), true);
    await next.click();
    await question('sg-concept','hunt');
    assert.equal(await next.isEnabled(), true, 'an unanswered check cannot block Next');
    const actual = (await read()).game;
    assert.deepEqual(actual,games.winterAfter,'clicking the Hunt action gives the expected engine transition');
    const readyCue=page.locator('[data-concept-cue][aria-controls="sg-concept"]');
    assert.equal(await readyCue.isVisible(),true,'a cue near turn actions calls attention to the new check');
    await readyCue.click();
    assert.equal(await inline.evaluate(el=>el.open),true);
    await inline.locator('fieldset [data-choice="automatic-loss"]').click();
    const feedback = inline.locator('.sg-concept-feedback');
    assert.match(await feedback.textContent(), /Try again.*removes a die, not an animal/i);
    assert.equal(await feedback.getAttribute('data-correct'), 'false');
    assert.equal(await inline.locator('[data-choice="automatic-loss"]').evaluate(el => el === document.activeElement), true, 'answer repaint returns keyboard focus');
    assert.equal(await next.isEnabled(), true, 'incorrect answers do not block Next');
    assert.deepEqual((await read()).game, actual);

    await page.locator('#sg-board-open').click();
    await question('sg-expanded-concept','hunt');
    await ensureOpen(expanded);
    assert.match(await expanded.locator('.sg-concept-feedback').textContent(), /Try again/i);
    const expandedNext = page.locator('#sg-expanded-next');
    assert.equal(await expandedNext.isEnabled(), true, 'expanded Next stays enabled');
    await expanded.locator('fieldset [data-choice="one-die"]').click();
    assert.match(await expanded.locator('.sg-concept-feedback').textContent(), /Correct.*higher roll/i);
    assert.equal(await expanded.locator('.sg-concept-feedback').getAttribute('data-correct'), 'true');
    assert.match(await feedback.textContent(), /Correct.*higher roll/i, 'the inline board mirrors the expanded answer');
    assert.deepEqual((await read()).conceptProgress, { hunt:{choiceId:'one-die',correct:true,attempts:2} });
    assert.deepEqual((await read()).game, actual, 'correct answers do not alter RNG, tokens, phase or history');
    await page.locator('#sg-board-close').click();
    await page.reload();
    await question('sg-concept','hunt');
    await ensureOpen(inline);
    assert.match(await feedback.textContent(), /Correct.*higher roll/i);
    assert.equal(await inline.locator('[data-choice="one-die"]').getAttribute('aria-pressed'), 'true');
    assert.deepEqual((await read()).game, actual, 'reloading a completed check preserves the engine state');

    await seed(games.springBefore);
    await question('sg-concept','hunt');
    assert.equal(await select.count(), 0, 'Spring’s check waits for committed migration');
    await seed(games.springAfter);
    await question('sg-concept','migration');
    assert.deepEqual(await ids(), ['hunt','migration']);
    await seed(games.summerDrawn);
    await question('sg-concept','migration');
    assert.deepEqual(await ids(), ['hunt','migration'], 'drawing alone does not unlock the event check');
    await seed(games.summerAfter);
    await question('sg-concept','event');
    assert.deepEqual(await ids(), ['hunt','migration','event']);
    await seed(games.fallBefore);
    await question('sg-concept','event');
    assert.deepEqual(await ids(), ['hunt','migration','event'], 'Fall comparison waits for end of season');
    await seed(games.fallAfter);
    await question('sg-concept','comparison');
    assert.deepEqual(await ids(), ['hunt','migration','event','comparison']);
    await ensureOpen(inline);
    await select.selectOption('migration');
    await question('sg-concept','migration');
    assert.match(await inline.locator('legend').textContent(), /grazing area/);
    const backdrop=locator=>locator.evaluate(el=>getComputedStyle(el).backgroundImage);
    assert.doesNotMatch(await backdrop(page.locator('#sg-scene')),/serengeti-surround/,'portrait board has no decorative art on the grid');
    await page.setViewportSize({width:1366,height:900});
    const inlineMat=await backdrop(page.locator('#sg-scene'));
    assert.match(inlineMat,/serengeti-surround-left\.svg/);
    assert.match(inlineMat,/serengeti-surround-right\.svg/);
    await page.locator('#sg-board-open').click();
    const expandedMat=await backdrop(page.locator('#sg-board-viewport'));
    assert.match(expandedMat,/serengeti-surround-left\.svg/);
    assert.match(expandedMat,/serengeti-surround-right\.svg/);
    assert.deepEqual(errors, []);
    console.log('PASS: optional concept checks, immediate retry, mirror/reload persistence, engine isolation, and four seasonal milestones');
  } finally {
    if(context) await context.close();
    await browser.close();
    if(server) server.close();
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
