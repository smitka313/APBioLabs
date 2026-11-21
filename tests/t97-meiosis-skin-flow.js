/* Meiosis and skin-data scenes (openscied-b3-inheritance-environment.html): mounting, gamete kinds with crossing over off and on,
   the distance slider and the exit-ticket answer "ab", the seeded tally, the which-gametes check, saving and restoring, keyboard use,
   no free-text boxes, skin values and data table, same scale, polls, framing note, viewed marks.
   Run: NODE_PATH=$(npm root -g) node tests/t97-meiosis-skin-flow.js */
const T = require('./_h');
const PAGE = 'openscied-b3-inheritance-environment.html', KEY = 'aplab:openscied:b3-inheritance-environment:v1';
const stub = pg => pg.route(/gc\.zgo\.at|fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, contentType: /gc\.zgo\.at/.test(r.request().url()) ? 'application/javascript' : 'text/css', body: '' }));
const SKIN = { white: { Hawaii: 46, Atlanta: 28, 'New Mexico': 26, 'San Jose': 25, Connecticut: 24.5, Seattle: 25, 'Los Angeles': 25, 'San Francisco': 23.5, Utah: 23, Detroit: 20.5, Iowa: 18 },
  black: { Utah: 1.7, Connecticut: 1.5, Seattle: 1.4, 'New Mexico': 1.4, Atlanta: 1.2, 'Los Angeles': 1.1, Iowa: 0.9, Detroit: 0.9, 'San Francisco': 0.8, Hawaii: 0.2, 'San Jose': 0.1 },
  hispanic: { Atlanta: 10, Utah: 9.6, 'San Francisco': 5.9, Connecticut: 5.7, Seattle: 4.7, Iowa: 4.5, 'San Jose': 4.3, 'Los Angeles': 3.7, 'New Mexico': 3.4, Detroit: 2.5, Hawaii: 0 } };
(async () => {
  const browser = await T.launch(), server = await T.serve();
  try {
    const ctx = await T.ctxFor(browser, { width: 1366, height: 900, reduced: true });
    await stub(ctx);
    const p = await ctx.newPage(), problems = [];
    p.on('pageerror', e => problems.push('pageerror: ' + e.message));
    p.on('console', m => { if (m.type() === 'error' && !/gc\.zgo\.at|fonts\.g|net::/.test(m.text())) problems.push('console: ' + m.text()); });
    await p.goto(server.url + PAGE + '#passing');
    await p.waitForSelector('#meiosis-scene[data-ms]');
    const M = '#meiosis-scene';

    // --- mounting ---
    T.ok(await p.locator('#meiosis-notice').isHidden(), 'meiosis: coming-soon notice is gone');
    T.ok(await p.locator(M + ' canvas').count() === 0 && await p.locator(M + ' svg[role="img"][aria-label]').count() === 1, 'meiosis: the placeholder canvas is replaced by a labelled drawing');
    T.ok((await p.locator('#meiosis-desc').innerText()).length > 80, 'meiosis: text description is filled');
    T.ok(await p.locator('[aria-live], [role=status], [role=alert]').count() === 1, 'still exactly one live region on the page');
    T.ok(await p.locator(M + ' input:not([type=range]), ' + M + ' textarea, ' + M + ' select').count() === 0, 'meiosis: no free-text boxes');

    // --- gamete kinds: 2 without, 4 with crossing over ---
    await p.click(M + ' [data-step="5"]');
    T.ok(await p.getAttribute(M, 'data-kinds') === '2' && await p.getAttribute(M, 'data-crossing') === 'off', 'crossing over off: two kinds of gamete');
    T.ok(/2 kinds/.test(await p.locator(M + ' .ms-caption').innerText()), 'caption says 2 kinds');
    const typesOff = await p.$$eval(M + ' [data-gamete]', n => [...new Set(n.map(x => x.dataset.type))].sort());
    T.ok(typesOff.join() === 'AC,BD', 'gamete labels with crossing over off: ' + typesOff);
    await p.click(M + ' .ms-switch');
    T.ok(await p.getAttribute(M, 'data-kinds') === '4' && await p.getAttribute(M, 'data-crossing') === 'on', 'crossing over on: four kinds of gamete');
    const typesOn = await p.$$eval(M + ' [data-gamete]', n => [...new Set(n.map(x => x.dataset.type))].sort());
    T.ok(typesOn.join() === 'AC,AD,BC,BD', 'gamete labels with crossing over on: ' + typesOn);
    T.ok(await p.locator(M + ' [data-pop="A"] .ms-token').count() === 2 && await p.locator(M + ' [data-pop="B"] .ms-token').count() === 4, 'Population A shows 2 kinds, Population B shows 4');
    await p.click(M + ' [data-step="3"]');
    T.ok(await p.locator(M + ' .ms-swapped').evaluateAll(n => n.filter(x => x.style.opacity === '1').length) === 2, 'step 4: two swapped sections are marked when crossing over is on');
    T.ok(await p.locator(M + ' svg').getAttribute('aria-label').then(t => /Crossing over/.test(t)), 'drawing label describes the current step');

    // --- distance slider ties to the exit-ticket answer "ab" ---
    const together = {};
    for (const id of ['ab', 'ac', 'ad']) { await p.click(M + ' [data-pair="' + id + '"]'); together[id] = parseFloat((await p.locator(M + ' [data-together="' + id + '"]').innerText()).replace(/\D/g, '')); }
    T.ok(together.ab > together.ac && together.ac > together.ad, 'a and b stay together most often, a and d least: ' + JSON.stringify(together));
    T.ok(await p.locator(M + ' input[type=range]').inputValue() === '73', 'the pair chips move the slider');
    await p.locator(M + ' input[type=range]').fill('9');
    T.ok(/about 8 in 100/.test(await p.locator(M + ' .ms-readout').innerText()), 'slider readout at 9 map units');

    // --- seeded tally ---
    await p.click(M + ' >> text=Make 10 gametes');
    const first = await p.getAttribute(M, 'data-tally');
    T.ok(first.split(',').length === 10 && first.split(',').every(g => ['AC', 'AD', 'BC', 'BD'].includes(g)), '10 valid gametes: ' + first);
    T.ok(/of 10/.test(await p.locator(M + ' [data-role=tally-summary]').innerText()), 'tally summary counts');
    await p.click(M + ' >> text=Clear tally');
    await p.click(M + ' >> text=Make 10 gametes');
    T.ok(await p.getAttribute(M, 'data-tally') === first, 'same Dataset ID gives the same first ten gametes after clearing');
    await p.locator(M + ' input[type=range]').fill('100');
    await p.click(M + ' >> text=Clear tally');
    await p.click(M + ' >> text=Make 10 gametes');
    await p.click(M + ' >> text=Make 10 gametes');

    // --- which gametes check ---
    await p.click(M + ' .ms-switch');   // off
    for (const t of ['AC', 'BD']) await p.click(M + ' [data-pick="' + t + '"]');
    await p.click(M + ' >> text=Check');
    T.ok(await p.locator(M + ' [data-role=check-feedback]').getAttribute('data-state') === 'correct', 'AC and BD are right with crossing over off');
    await p.click(M + ' .ms-switch');   // on
    for (const t of ['AC', 'BD']) await p.click(M + ' [data-pick="' + t + '"]');
    await p.click(M + ' >> text=Check');
    T.ok(await p.locator(M + ' [data-role=check-feedback]').getAttribute('data-state') === 'wrong' && /missing AD and BC/.test(await p.locator(M + ' [data-role=check-feedback]').innerText()), 'with crossing over on, two picks are not enough: friendly hint');

    // --- saved state ---
    const st = await p.evaluate(k => JSON.parse(localStorage.getItem(k)).meiosis, KEY);
    T.ok(Array.isArray(st.runs) && st.runs.length >= 3 && st.runs.every(r => Array.isArray(r.gametes) && typeof r.crossing === 'boolean' && Array.isArray(r.parent)), 'meiosis state has runs in the contract shape');
    T.ok(st.runs.some(r => r.kind === 'animation' && r.crossing && r.gametes.length === 4) && st.runs.some(r => r.kind === 'animation' && !r.crossing), 'both animation runs were saved');
    T.ok(st.distanceCM === 100, 'distance saved');
    const lastTally = await p.getAttribute(M, 'data-tally');
    T.ok(/Kinds of gametes you made/.test(await p.locator('#data-meiosis-body').innerText()), 'the page "Your data" box fills from the scene');
    await p.reload(); await p.waitForSelector(M + '[data-ms]');
    T.ok(await p.getAttribute(M, 'data-tally') === lastTally && await p.locator(M + ' input[type=range]').inputValue() === '100', 'tally and slider are restored after a reload');

    // --- keyboard only ---
    await p.click(M + ' [data-step="0"]');
    await p.locator(M + ' .btn--primary', { hasText: 'Next step' }).focus();
    await p.keyboard.press('Enter'); await p.keyboard.press('Enter');
    T.ok(await p.getAttribute(M, 'data-stage') === '2', 'Next step works with the keyboard');
    await p.locator(M + ' .ms-switch').focus(); await p.keyboard.press('Space');
    T.ok(await p.getAttribute(M + ' .ms-switch', 'aria-checked') !== null, 'switch toggles with the keyboard');

    // --- skin scene ---
    await p.evaluate(() => { location.hash = 'skindata'; });
    await p.waitForSelector('#skin-data-scene[data-sk]');
    const K = '#skin-data-scene';
    T.ok(await p.locator('#skin-data-notice').isHidden() && await p.locator(K + ' canvas').count() === 0, 'skin: notice gone, placeholder replaced');
    T.ok(await p.locator(K + ' input, ' + K + ' textarea').count() === 0, 'skin: no free-text boxes (a native dropdown per poll is the only form control)');
    T.ok(await p.locator(K + ' .sk-fig:not([hidden])').count() === 3, 'three graphs visible at 1366');
    const dots = await p.$$eval(K + ' .sk-pt', n => n.map(x => [x.dataset.group, x.dataset.site, +x.dataset.rate, +x.dataset.uv]));
    T.ok(dots.length === 33 && dots.every(([g, s, r]) => SKIN[g][s] === r), 'all 33 plotted points equal the verified table');
    await p.click(K + ' [data-toggle="table"]');
    const rows = await p.$$eval(K + ' .sk-table tbody tr', trs => trs.map(tr => ({ site: tr.dataset.site, v: [...tr.querySelectorAll('td[data-group]')].map(td => [td.dataset.group, td.textContent]) })));
    T.ok(rows.length === 11 && rows.every(r => r.v.every(([g, t]) => parseFloat(t) === SKIN[g][r.site])), 'the data table equals the verified table');
    T.ok(dots.every(([g, s, r]) => parseFloat(rows.find(x => x.site === s).v.find(v => v[0] === g)[1]) === r), 'the data table equals the chart data');
    T.ok(await p.locator(K + ' .sk-pt[data-group="white"] text, ' + K + ' text.sk-name').count() >= 15, 'point labels show site names');
    await p.click(K + ' .sk-fig[data-group="white"] .sk-pt[data-site="Hawaii"]');
    T.ok(/Hawaii \(White graph\)/.test(await p.locator(K + ' [data-role=readout]').innerText()) && /about 46/.test(await p.locator(K + ' [data-role=readout]').innerText()), 'tapping a point shows its site and value');
    await p.click(K + ' .sk-table [data-site="Utah"] button');
    T.ok(/Utah/.test(await p.locator(K + ' [data-role=readout]').innerText()), 'tapping a table row selects the site');
    // own and same scale
    const yBefore = await p.locator(K + ' .sk-fig[data-group="black"] .sk-pt[data-site="Utah"] .sk-mark').getAttribute('y');
    await p.click(K + ' [data-scale="same"]');
    const yAfter = await p.locator(K + ' .sk-fig[data-group="black"] .sk-pt[data-site="Utah"] .sk-mark').getAttribute('y');
    T.ok(+yAfter > +yBefore + 100 && /about 25 times/.test(await p.locator(K + ' [data-role=scale-note]').innerText()), 'same scale pushes the Black-labeled points to the bottom and says by how much');
    await p.click(K + ' [data-scale="own"]');
    // viewed marks and keyboard
    T.ok(/White ✓/.test(await p.locator(K + ' [data-role=explored]').innerText()), 'White graph marked as explored');
    await p.locator(K + ' .sk-fig[data-group="black"] .sk-pt').first().focus();
    await p.keyboard.press('ArrowRight'); await p.keyboard.press('Enter');
    T.ok(/Black ✓/.test(await p.locator(K + ' [data-role=explored]').innerText()) && /Black graph/.test(await p.locator(K + ' [data-role=readout]').innerText()), 'keyboard: arrow keys move between points, Enter selects');
    // polls
    await p.selectOption(K + ' [data-poll-select="high-white"]', 'Atlanta');
    T.ok(/^Try again/.test(await p.locator(K + ' [data-poll-feedback="high-white"]').innerText()), 'wrong poll answer gets a friendly retry');
    await p.selectOption(K + ' [data-poll-select="high-white"]', 'Hawaii');
    T.ok(await p.locator(K + ' [data-poll-feedback="high-white"]').getAttribute('data-state') === 'correct', 'right poll answer is marked');
    await p.selectOption(K + ' [data-poll-select="top-both"]', 'Atlanta');
    // framing note
    const sceneText = await p.locator(K).innerText(), pageText = await p.locator('#skindata').innerText();
    T.ok(/not a biological split/.test(pageText) && /not a biological split/.test(sceneText), 'framing note (labels are not a biological split) is on the page and in the scene');
    T.ok(/Death statistics are not shown/.test(sceneText) && /approximate readings/.test(sceneText) && /Eide MJ, Weinstock MA/.test(sceneText) && /unit/.test(sceneText), 'scene says: approximate, citation, no mortality, y unit not stated');
    // saved and restored
    const sk = await p.evaluate(k => JSON.parse(localStorage.getItem(k)).skin, KEY);
    T.ok(sk.viewed.white && sk.viewed.black && !sk.viewed.hispanic && sk.scale === 'own' && sk.polls['high-white'] === 'Hawaii', 'skin state saved in the contract shape');
    T.ok(/White-labeled graph/.test(await p.locator('#data-skin-body').innerText()), 'the page "Your data" box fills from the scene');
    await p.reload(); await p.waitForSelector(K + '[data-sk]');
    T.ok(/White ✓\s+Black ✓\s+Hispanic –/.test(await p.locator(K + ' [data-role=explored]').innerText()) && await p.locator(K + ' [data-poll-feedback="high-white"]').getAttribute('data-state') === 'correct', 'viewed marks and poll answers survive a reload');

    T.ok(problems.length === 0, 'no page errors ' + problems.join(' | '));
    await ctx.close();
  } finally { await browser.close(); server.close(); }
  T.done('t97-meiosis-skin-flow');
})();
