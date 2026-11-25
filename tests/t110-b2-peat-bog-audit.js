/* Peat Bog Carbon Lab: fixes from the outside play-test audit (C1 to C5). Each group fails on the code before the fix.
   C1 peat carbon = displayed P - D - B (meters, table, CSV, balanced verdict); C2 the status text never lags a change;
   C3 frozen peat does not burn; C4 the dashboard remembers that warming was used; C5 clamp messages, one CO2 source of truth, long labels.
   Run: NODE_PATH=$(npm root -g) node tests/t110-b2-peat-bog-audit.js */
const T = require('./_h');
const L = require('../openscied-b2-peat-bog-logic.js');
const PAGE = 'openscied-b2-peat-bog-lab.html', KEY = 'aplab:openscied:b2-peat-bog:v1';
const stub = pg => pg.route(/gc\.zgo\.at|fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, contentType: /gc\.zgo\.at/.test(r.request().url()) ? 'application/javascript' : 'text/css', body: '' }));
const meters = p => p.evaluate(() => ['pVal', 'dVal', 'bVal', 'nVal'].map(i => document.getElementById(i).textContent.replace(/[✓✕\s]/g, '').replace('−', '-')).map(Number));
const bar = p => p.evaluate(() => ['nbP', 'nbD', 'nbB', 'nbN'].map(i => document.getElementById(i).textContent.replace(/\s/g, '').replace('−', '-')).map(Number));
const ann = p => p.locator('#announcer').textContent();
(async () => {
  // ---------- C1 logic: the budget closes on the numbers shown ----------
  const D = L.DEFAULTS; let bad = 0, n = 0, offByOne = 0;
  for (const wet of [10, 25, 40, 50, 60, 70, 75, 90]) for (const temp of [-5, 0, 5, 10, 15, 20, 25, 30]) for (const co2 of [200, 420, 800]) for (const burn of [0, 30, 60]) {
    const m = L.model(Object.assign({}, D, { wet, temp, co2, burn })), o = L.trialOutputs(m.s), r = L.trialRow(m.s, 1);
    n++; if (o.N !== o.P - o.D - o.B || Math.round(m.N) !== Math.round(m.P) - Math.round(m.D) - Math.round(m.B) || +r.N.replace('−', '-') !== o.N) bad++;
    if (Math.round(m.P - m.D - m.B) !== Math.round(m.P) - Math.round(m.D) - Math.round(m.B)) offByOne++;
  }
  T.ok(bad === 0 && n === 8 * 8 * 3 * 3, 'C1: Peat carbon equals the displayed P - D - B in all ' + n + ' settings (off: ' + bad + ')');
  T.ok(offByOne > 20, 'C1: the grid includes many settings where unrounded and displayed budgets differ (' + offByOne + '), so the check is meaningful');
  let cancel = null;
  for (let w = 0; w <= 100 && !cancel; w++) for (let t = -5; t <= 30 && !cancel; t++) for (const c of [200, 300, 420, 600, 800, 1200]) {
    const m = L.model(Object.assign({}, D, { wet: w, temp: t, co2: c }));
    if (Math.round(m.P) === Math.round(m.D) && m.B === 0 && Math.round(m.P) >= 20 && Math.round(m.P - m.D) !== 0) { cancel = { wet: w, temp: t, co2: c }; break; }
  }
  T.ok(!!cancel, 'C1: found settings where displayed P equals D but the unrounded gap rounds to +-1: ' + JSON.stringify(cancel));
  const mc = L.model(Object.assign({}, D, cancel));
  T.ok(mc.N === 0 && L.verdict(mc.N) === 'balanced', 'C1: P = D with no fire is exactly 0 and "balanced"');
  T.ok(L.verdict(1) === 'sink' && L.verdict(-1) === 'source' && L.verdict(0) === 'balanced', 'C1: verdict is by the sign of the whole number');

  // ---------- C3 logic: frozen peat does not burn ----------
  const fz = t => L.model(Object.assign({}, D, { temp: t, burn: 50 }));
  T.ok(fz(-5).B === 0 && fz(0).B === 0 && fz(3).B === 0, 'C3: burning is 0 at -5, 0 and 3 C (all peat frozen), burn slider 50% (B at -5 = ' + fz(-5).B + ')');
  T.ok(fz(5).B > 0 && fz(5).B < fz(11).B, 'C3: burning returns as the peat thaws (5 C: ' + fz(5).B.toFixed(1) + ', 11 C: ' + fz(11).B.toFixed(1) + ')');
  const ex = L.exploreSeries(Object.assign({}, D, { burn: 50 }), 'temp', 35);
  T.ok(ex.xs[0] === -5 && Math.round(ex.B[0]) === 0, 'C3: the Test-one-variable table shows burning 0 at -5 C (' + Math.round(ex.B[0]) + ')');
  T.ok(L.zombie(Object.assign({}, D, { temp: -5, burn: 50 })).chance === 0 && L.model(Object.assign({}, D, { temp: -5, burn: 50 })).N <= 0, 'C3: zombie chance is 0 on frozen ground');
  // C4 logic lives in the dashboard (below). C5: one source of truth for the CO2 sent to the bog.
  const rows = L.climate(10, 100);
  T.ok(L.bogForYear(rows, 2100).co2 === 520 && Math.round(rows[75].C) === 521, 'C5: section 5 shows 521 ppm, the bog gets 520 (rounded to its 10 ppm step)');

  const browser = await T.launch(), server = await T.serve();
  try {
    const ctx = await T.ctxFor(browser, { width: 1366, height: 900 });
    const p = await ctx.newPage(); await stub(p);
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(server.url + PAGE + '#bog'); await p.waitForFunction(() => window.B2Peat && document.querySelector('.step.is-current'));

    // ---------- C1 page: meters, table, CSV ----------
    const sets = [{}, { wet: 70 }, { wet: 50 }, { temp: 20 }, { co2: 800 }, cancel, { wet: 10, burn: 70, temp: 16 }, { temp: 25 }, { tilt: 24.2 }];
    let allClose = true; const detail = [];
    for (const s of sets) {
      await p.evaluate(v => B2Peat.setState(Object.assign({}, B2Peat.logic.DEFAULTS, v)), s);
      const [P, Dd, B, N] = await meters(p), [bP, bD, bB, bN] = await bar(p);
      if (N !== P - Dd - B || bN !== bP - bD - bB) { allClose = false; detail.push(JSON.stringify(s) + ' ' + [P, Dd, B, N]); }
    }
    T.ok(allClose, 'C1: on the page, Peat carbon = P - D - B in meters and the sticky bar for 9 settings ' + detail.join(' | '));
    await p.evaluate(v => B2Peat.setState(Object.assign({}, B2Peat.logic.DEFAULTS, v)), cancel);
    T.ok(/Balanced/.test(await p.locator('#nText').innerText()) && (await meters(p))[3] === 0, 'C1: opposites cancel shows 0 and "Balanced"');
    await p.evaluate(() => B2Peat.record('bog'));
    const csv = await p.evaluate(() => B2Peat.logic.csv(B2Peat.state.trials));
    const cols = csv.split('\r\n')[1].split(',');
    T.ok(+cols[8] - +cols[9] - +cols[10] === +cols[12], 'C1: the CSV row closes: ' + cols.slice(8, 13).join(' '));

    // ---------- The student-facing reaction table reads in one direction ----------
    await p.evaluate(() => { location.hash = 'overview'; }); await p.waitForFunction(() => document.querySelector('#overview.is-current'));
    const flow=p.locator('#peat-reaction-flow');
    const cells=await flow.locator('tbody tr').last().locator('td').allTextContents();
    T.ok(await flow.isVisible() && cells.length===2 && /Peat.*oxygen/.test(cells[0]) &&
      /Carbon dioxide.*water.*heat and light/.test(cells[1]) && !/glucose/i.test(cells[1]), 'burning row labels peat as an input and never shows glucose as a product');
    await p.evaluate(() => { location.hash = 'bog'; }); await p.waitForFunction(() => document.querySelector('#bog.is-current'));

    // ---------- C2: status text updates at once ----------
    await p.evaluate(() => B2Peat.setState(B2Peat.logic.DEFAULTS, true));
    await p.waitForTimeout(900);
    await p.fill('#n-wet', '70');
    T.ok(await p.locator('#s-wet').inputValue() === '70' &&
      await p.evaluate(k => JSON.parse(localStorage.getItem(k))?.settings.wet, KEY) === 70,
      'C2: a valid typed setting updates and saves the displayed simulation before Enter or blur');
    await p.press('#n-wet', 'Enter');
    const w70 = L.model(Object.assign({}, D, { wet: 70 }));
    let live = true; try { await p.waitForFunction(t => document.getElementById('announcer').textContent.indexOf(t) === 0, 'Photosynthesis ' + Math.round(w70.P), { timeout: 400 }); } catch (e) { live = false; }
    T.ok(live, 'C2: the live status shows the new rates within 400 ms of typing 70 in the water box: ' + await ann(p));
    await p.fill('#n-wet', '50'); await p.press('#n-wet', 'Enter');
    const w50 = L.model(Object.assign({}, D, { wet: 50 }));
    live = true; try { await p.waitForFunction(t => document.getElementById('announcer').textContent.indexOf(t) === 0, 'Photosynthesis ' + Math.round(w50.P), { timeout: 400 }); } catch (e) { live = false; }
    T.ok(live, 'C2: a second typed change also shows at once, not one change behind: ' + await ann(p));
    await p.click('#presets .btn:has-text("Drained bog")');
    const dr = L.model(L.PRESETS[3].values);
    live = true; try { await p.waitForFunction(t => document.getElementById('announcer').textContent.indexOf(t) >= 0, 'Photosynthesis ' + Math.round(dr.P), { timeout: 400 }); } catch (e) { live = false; }
    T.ok(live, 'C2: choosing a preset puts the new rates in the status text at once: ' + await ann(p));
    await p.click('#presets .btn:has-text("Reset")');
    live = true; try { await p.waitForFunction(t => document.getElementById('announcer').textContent.indexOf(t) >= 0, 'Photosynthesis 29', { timeout: 400 }); } catch (e) { live = false; }
    T.ok(live, 'C2: Reset shows the starting rates at once: ' + await ann(p));
    await p.evaluate(() => { location.hash = 'warming'; }); await p.waitForFunction(() => document.querySelector('#warming.is-current'));
    await p.fill('#n-year', '2050'); await p.press('#n-year', 'Enter');
    live = true; try { await p.waitForFunction(() => /^2050: /.test(document.getElementById('announcer').textContent), null, { timeout: 400 }); } catch (e) { live = false; }
    T.ok(live, 'C2: typing a year updates the status text at once: ' + await ann(p));

    await p.evaluate(() => { location.hash = 'bog'; }); await p.waitForFunction(() => document.querySelector('#bog.is-current'));
    await p.evaluate(() => B2Peat.setState({temp:-5,burn:0}, true));
    await p.locator('#s-burn').evaluate(el => {
      el.value='50'; el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true}));
    });
    let warned = true;
    try { await p.waitForFunction(() => /Frozen peat won.t burn/.test(document.getElementById('announcer').textContent),null,{timeout:400}); }
    catch (_) { warned = false; }
    T.ok(warned && /Frozen peat won.t burn/.test(await p.locator('#notes').innerText()),
      'a committed slider change promptly announces the same current fire warning as the visible note');

    // ---------- C3 page ----------
    await p.evaluate(() => { location.hash = 'bog'; }); await p.waitForFunction(() => document.querySelector('#bog.is-current'));
    await p.evaluate(() => B2Peat.setState({ temp: -5, burn: 50 }));
    T.ok((await meters(p))[2] === 0 && /Frozen peat won.t burn/.test(await p.locator('#notes').innerText()), 'C3: -5 C with Burning 50%: burning meter 0 and the note says frozen peat won\'t burn: ' + await meters(p));
    await p.evaluate(() => { location.hash = 'graph'; }); await p.waitForFunction(() => document.querySelector('#graph.is-current'));
    await p.selectOption('#xVar', 'temp'); await p.locator('#graph summary').click();
    T.ok(await p.locator('#explore-table tbody tr').first().locator('td').nth(2).innerText() === '0', 'C3: the section 3 table reads Burning 0 at -5 C');

    // ---------- C5: typed values that change are announced and shown ----------
    await p.evaluate(() => { location.hash = 'bog'; }); await p.waitForFunction(() => document.querySelector('#bog.is-current'));
    const commitTwice = async value => {
      await p.fill('#n-temp', value);
      // Enter plus a subsequent native change can commit one edit twice. Trigger
      // both in one browser task so we never observe only the first announcement.
      await p.locator('#n-temp').evaluate(e => {
        e.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
        e.dispatchEvent(new Event('change', { bubbles: true }));
      });
    };
    const clampNote = () => p.locator('#n-temp').evaluate(e => {
      const n = e.closest('.ctrl').querySelector('.clamp-note');
      return n && !n.hidden ? n.textContent : '';
    });
    const sayClamp = async prefix => {
      try {
        await p.waitForFunction(t => document.getElementById('announcer').textContent.startsWith(t), prefix, { timeout: 750 });
        return true;
      } catch (e) { return false; }
    };
    await commitTwice('-10');
    const note = await clampNote(), clamped = await sayClamp('Set to -5 °C, the lowest allowed.');
    T.ok(note.startsWith('Set to -5 °C, the lowest allowed.') && clamped && await p.locator('#n-temp').inputValue() === '-5',
      'C5: Enter plus change keeps the visible and live lower-bound correction: ' + note + ' | live: ' + await ann(p));
    await commitTwice('20.5');
    const note2 = await clampNote(), rounded = await sayClamp('Rounded to 21 °C');
    T.ok(note2.startsWith('Rounded to 21 °C') && rounded && await p.locator('#n-temp').inputValue() === '21',
      'C5: Enter plus change keeps the visible and live rounding correction: ' + note2 + ' | live: ' + await ann(p));
    await p.locator('#n-temp').evaluate(e => {
      // An explicit new edit to the same accepted number is not a duplicate.
      e.value = '21'; e.dispatchEvent(new Event('input', { bubbles: true }));
      e.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    });
    T.ok(await clampNote() === '' && await sayClamp('Photosynthesis '), 'C5: retyping the accepted value clears the old correction');
    await p.fill('#n-temp', '12'); await p.press('#n-temp', 'Enter'); await p.waitForTimeout(100);
    const exact = await p.locator('#n-temp').evaluate(e => { const n = e.closest('.ctrl').querySelector('.clamp-note'); return n && !n.hidden ? n.textContent : ''; });
    T.ok(exact === '', 'C5: an exact value (12 C) leaves no stale note (' + exact + ')');
    await p.evaluate(() => { location.hash = 'warming'; }); await p.waitForFunction(() => document.querySelector('#warming.is-current'));
    await p.fill('#n-year', '2100'); await p.press('#n-year', 'Enter');
    T.ok(/Test the bog in 2100 sets the bog to 520 ppm CO₂ \(521 ppm rounded/.test(await p.locator('#sendInfo').innerText()), 'C5: section 5 says what the bog will get: ' + await p.locator('#sendInfo').innerText());
    await p.click('#sendBog'); await p.waitForFunction(() => document.querySelector('#bog.is-current'));
    T.ok(+await p.locator('#s-co2').inputValue() === 520, 'C5: and the bog does get 520 ppm');
    // long trial label shows in full, with no sideways overflow of the cell and no clipped text
    await p.evaluate(() => { B2Peat.state.trialLabel = 'Experiment B2: raising the water level with burning held hig'; B2Peat.record('table'); });
    await p.evaluate(() => { location.hash = 'trials'; }); await p.waitForFunction(() => document.querySelector('#trials.is-current'));
    const lab = await p.locator('#logWrap .lbl-input').last().evaluate(e => ({ v: e.value, clipped: e.scrollHeight > e.clientHeight + 1 || e.scrollWidth > e.clientWidth + 1, title: e.title }));
    T.ok(lab.v.length === 60 && !lab.clipped && lab.title === lab.v, 'C5: a ' + lab.v.length + '-character label is fully visible (not clipped) and has the full text as its title');
    T.ok(errs.length === 0, 'no page errors ' + errs.join());
    await ctx.close();

    // ---------- C4: the dashboard remembers that warming was used ----------
    const c2 = await T.ctxFor(browser, { width: 1366, height: 900 });
    const q = await c2.newPage(); await stub(q);
    await q.goto(server.url + PAGE + '#warming'); await q.waitForFunction(() => window.B2Peat && document.querySelector('.step.is-current'));
    await q.fill('#n-year', '2060'); await q.press('#n-year', 'Enter');
    await q.fill('#n-year', '2100'); await q.press('#n-year', 'Enter');
    const saved = await q.evaluate(k => JSON.parse(localStorage.getItem(k)), KEY);
    T.ok(saved.warmingUsed === true && saved.climate.year === 2100 && saved.climate.fossil === 10 && saved.climate.forest === 100, 'C4: the page saves warmingUsed even though the climate ends on today\'s values');
    const d = await c2.newPage(); await stub(d);
    await d.goto(server.url + 'openscied-dashboard.html'); await d.waitForSelector('#peat-bog-progress');
    T.ok(/warming explored/.test(await d.locator('#peat-bog-progress').innerText()), 'C4: dashboard says warming explored: ' + await d.locator('#peat-bog-progress').innerText());
    T.ok(!/warming not explored/.test(await d.locator('body').innerText()), 'C4: "warming not explored" appears nowhere on the dashboard (including the Continue banner)');
    T.ok(Array.isArray(saved.responseIds) && saved.responseIds.length === 0 && !/answers saved/.test(await d.locator('#peat-bog-progress').innerText()), 'D1: the Peat Bog Lab has no written answers, so it saves an empty responseIds and the dashboard shows no answer count (nothing to disagree)');
    // old saves (no flag) still work: changed climate counts, untouched climate does not
    await d.evaluate(k => localStorage.setItem(k, JSON.stringify({ v: 1, settings: { wet: 30 }, climate: { fossil: 10, forest: 100, year: 2100 }, trials: [] })), KEY);
    await d.reload(); await d.waitForSelector('#peat-bog-progress');
    T.ok(/warming not explored/.test(await d.locator('#peat-bog-progress').innerText()), 'C4: an old save with untouched climate still reads "not explored"');
    await d.evaluate(k => localStorage.setItem(k, JSON.stringify({ v: 1, settings: { wet: 30 }, climate: { fossil: 14, forest: 100, year: 2100 }, trials: [] })), KEY);
    await d.reload(); await d.waitForSelector('#peat-bog-progress');
    T.ok(/warming explored/.test(await d.locator('#peat-bog-progress').innerText()), 'C4: an old save with a changed climate still reads "explored"');
    await c2.close();
  } finally { await browser.close(); server.close(); }
  T.done('t110-b2-peat-bog-audit');
})().catch(e => { console.error(e); process.exit(1); });
