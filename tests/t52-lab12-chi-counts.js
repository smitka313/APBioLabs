/* Audit 3, Lab 12: (1) the standalone chi-square calculator result (0.133 for 16 / 14) reaches the exported key results and the .docx,
   follows later edits, and the worked example never exports; (2) a chamber count of 14 + 15 of 30 flies is refused.
   LAB12_FILE overrides the page under test. */
const T = require('./_h');
(async () => {
  const b = await T.launch(), ctx = await T.ctxFor(b);
  const p = await T.open(ctx, process.env.LAB12_FILE || 'lab12.html', 'analyze');
  const krs = () => p.evaluate(() => Lab.keyResults().map(r => r.id + '|' + r.label + '|' + r.value + ' ' + (r.unit || '')));
  const setv = (sel, v) => p.evaluate(([s, v]) => { const e = document.querySelector(s); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); }, [sel, v]);
  await setv('#x-a', '16'); await setv('#x-b', '14'); await p.waitForTimeout(300);
  let k = await krs();
  T.ok(k.some(r => /0\.133/.test(r)), 'calculator 0.133 is a key result');
  const b64 = await p.evaluate(async () => { const blob = await Lab.report.docx(); const buf = new Uint8Array(await blob.arrayBuffer()); let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000)); return btoa(s); });
  const JSZip = require('./fixtures/jszip-3.10.1.min.js');
  const zip = await JSZip.loadAsync(Buffer.from(b64, 'base64')); const xml = await zip.file('word/document.xml').async('string');
  const txt = xml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  T.ok(/0\.133/.test(txt), '.docx contains 0.133');
  // the worked example must not export
  await p.evaluate(() => document.querySelector('#x-example').click()); await p.waitForTimeout(300);
  k = await krs();
  T.ok(k.some(r => /chi-calc.*0\.133/.test(r)) && !k.some(r => /chi-calc.*\b4\.8/.test(r)), 'example mode (21 / 9) does not replace the real result');
  await p.evaluate(() => document.querySelector('.example-banner button').click()); await p.waitForTimeout(200);
  await setv('#x-a', '21'); await setv('#x-b', '9'); await p.waitForTimeout(300);
  k = await krs();
  T.ok(k.some(r => /chi-calc.*\b4\.8/.test(r)) && !k.some(r => /0\.133/.test(r)), 're-entering counts regenerates the result (4.8, not 0.133)');
  await setv('#x-a', ''); await setv('#x-b', ''); await p.waitForTimeout(300);
  k = await krs();
  T.ok(!k.some(r => /chi-calc/.test(r)), 'clearing the counts drops the calculator result');

  // (2) chamber count must total the number of flies
  await p.evaluate(() => { location.hash = '#choice-chamber'; }); await p.waitForTimeout(600);
  await setv('#p-predict', 'The flies will prefer banana.');
  await p.evaluate(() => { const s = document.querySelector('#c-speed button[data-v="40"]'); if (s) s.click(); });
  await p.click('#c-run');
  await p.waitForFunction(() => !document.querySelector('#count-panel').hidden, null, { timeout: 30000 });
  const n = await p.evaluate(() => +document.querySelector('#c-n').value);
  await setv('#cnt-a', String(Math.floor(n / 2))); await setv('#cnt-b', String(Math.floor(n / 2) - 1));
  await p.click('#cnt-rec'); await p.waitForTimeout(300);
  T.ok(await p.evaluate(() => !document.querySelector('#count-panel').hidden), `${Math.floor(n / 2)} + ${Math.floor(n / 2) - 1} of ${n}: count refused, panel stays open`);
  T.ok(await p.evaluate(() => /must add up to/.test(document.querySelector('#count-panel').textContent.replace(/\s+/g, ' '))), 'message says the counts must add up to the number of flies');
  await setv('#cnt-b', String(n - Math.floor(n / 2)));
  await p.click('#cnt-rec'); await p.waitForTimeout(400);
  T.ok(await p.evaluate(() => document.querySelector('#count-panel').hidden), 'a count that totals the flies is accepted');
  T.ok(p.errors.length === 0, 'no page errors ' + p.errors.join(';'));
  await b.close(); T.done('lab12 chi + counts');
})();
