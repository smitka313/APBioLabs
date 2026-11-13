/* Lab 4 Procedures 1 and 2: "Check my ..." must not leave the step marked done once rows are blank again.
   Reviewer's steps: fill every row correctly, press Check (step done), then run another trial / clear a value;
   the blank rows must not still count as checked.
   Run: NODE_PATH=$(npm root -g) node tests/t54-lab4-check-blank.js */
const { ok, done, launch, ctxFor, open } = require('./_h');
const stepState = (p, box, id) => p.evaluate(([b, i]) => { const li = Array.from(document.querySelectorAll(b + ' li')).find(l => l.textContent.toLowerCase().includes(i)); return li ? /\(done\)/.test(li.textContent) : null; }, [box, id]);
const setVal = async (p, sel, v) => { await p.fill(sel, String(v)); await p.dispatchEvent(sel, 'change'); await p.dispatchEvent(sel, 'blur'); };
(async () => {
  const b = await launch(), ctx = await ctxFor(b, { reduced: true }), p = await open(ctx, 'lab04.html');
  const pred = async k => p.evaluate(k => { const t = document.getElementById('p-' + k); t.value = 'I predict the smallest block gets the most acid.'; t.dispatchEvent(new Event('input', { bubbles: true })); t.dispatchEvent(new Event('change', { bubbles: true })); }, k);
  await pred('predict-sav'); await pred('predict-bags');

  // ---------- Procedure 1 ----------
  await p.evaluate(() => Lab.pages.go(document.getElementById('p1-sim'))); await p.waitForTimeout(500);
  await p.click('#p1-run'); await p.waitForTimeout(1500);
  const fill1 = async () => {
    const rows = await p.evaluate(() => Array.from(document.querySelectorAll('#p1-table tbody tr')).map(tr => Array.from(tr.cells).map(c => c.textContent.trim())));
    for (let i = 0; i < rows.length; i++) {
      const dims = rows[i][1].split(/[×x]/).map(x => parseFloat(x)), [L, W, H] = dims, d = parseFloat(rows[i][3]) / 10;
      const sa = 2 * (L * W + L * H + W * H), v = L * W * H, pct = 100 * (1 - ((L - 2 * d) * (W - 2 * d) * (H - 2 * d)) / v);
      const has = await p.inputValue(`#p1-table input[data-r="${i}"][data-k="sa"]`);
      if (has === '') for (const [k, val] of [['sa', sa], ['v', v], ['ratio', sa / v], ['pct', pct]]) await setVal(p, `#p1-table input[data-r="${i}"][data-k="${k}"]`, val.toFixed(3));
    }
    return rows.length;
  };
  const n1 = await fill1();
  await p.click('#p1-check'); await p.waitForTimeout(600);
  console.log('P1 feedback:', (await p.textContent('#p1-fb')).slice(0, 160));
  ok(await stepState(p, '#p1-steps', 'check my calculations') === true, 'P1: step "Check my calculations" is done after all rows are filled and checked (' + n1 + ' rows)');
  await p.click('#p1-run'); await p.waitForTimeout(1500);   // second trial: three new blank rows
  const rowsNow = await p.evaluate(() => document.querySelectorAll('#p1-table tbody tr').length);
  const blank = await p.evaluate(() => Array.from(document.querySelectorAll('#p1-table tbody tr')).filter(tr => Array.from(tr.querySelectorAll('input')).some(i => i.value === '')).length);
  console.log('P1 rows after second trial:', rowsNow, 'with blank cells:', blank);
  ok(blank > 0 && await stepState(p, '#p1-steps', 'fill in sa') === false, 'P1: new blank rows make "Fill in SA, V, SA:V and %" not done');
  ok(await stepState(p, '#p1-steps', 'check my calculations') === false, 'P1: "Check my calculations" is NOT done while rows are blank');

  // ---------- Procedure 2 ----------
  await p.evaluate(() => Lab.pages.go(document.getElementById('p2-sim'))); await p.waitForTimeout(500);
  await p.click('#p2-run'); await p.waitForTimeout(1500);
  const fill2 = async () => {
    const rows = await p.evaluate(() => Array.from(document.querySelectorAll('#p2-table tbody tr')).map(tr => Array.from(tr.cells).map(c => c.textContent.trim())));
    for (let i = 0; i < rows.length; i++) {
      const has = await p.inputValue(`#p2-table input[data-r="${i}"][data-k="pct"]`);
      if (has === '') { const m0 = parseFloat(rows[i][3]), m1 = parseFloat(rows[i][4]); await setVal(p, `#p2-table input[data-r="${i}"][data-k="pct"]`, (100 * (m1 - m0) / m0).toFixed(2)); }
    }
  };
  await fill2(); await p.click('#p2-check'); await p.waitForTimeout(600);
  console.log('P2 feedback:', (await p.textContent('#p2-fb')).slice(0, 120));
  ok(await stepState(p, '#p2-steps', 'check my % changes') === true, 'P2: step "Check my % changes" done after all rows filled and checked');
  await p.click('#p2-run'); await p.waitForTimeout(1800);
  ok(await stepState(p, '#p2-steps', 'check my % changes') === false, 'P2: "Check my % changes" is NOT done after a new set adds blank rows');
  // clear one value in an already-checked state
  await fill2(); await p.click('#p2-check'); await p.waitForTimeout(600);
  ok(await stepState(p, '#p2-steps', 'check my % changes') === true, 'P2: done again once every row is filled and re-checked');
  await setVal(p, '#p2-table input[data-r="0"][data-k="pct"]', ''); await p.waitForTimeout(600);
  ok(await stepState(p, '#p2-steps', 'check my % changes') === false, 'P2: blanking a checked value un-does the check step');
  ok(p.errors.length === 0, 'no page errors ' + p.errors.join('|'));
  await b.close(); done('t54-lab4-check-blank');
})();
