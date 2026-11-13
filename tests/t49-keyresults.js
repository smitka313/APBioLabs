/* Key results in the .docx and the PDF report view: "Label: value unit", extra info in a Notes cell, nothing garbled.
   Reproduces Lab 12's "…| 0 df = 1; critical value 3.84" and adds a calculator result (Lab.keyResult('chi2-calc', …)). */
const T = require('./_h');
const fs = require('fs'), os = require('os'), path = require('path');
const JSZip = require(path.join(__dirname, 'fixtures/jszip-3.10.1.min.js'));
(async () => {
  const srv = await T.serve(), b = await T.launch();
  const ctx = await T.ctxFor(b, {}); const p = await T.open(ctx, 'lab12.html', 'submit', srv.url);
  await p.evaluate(() => {
    // the Lab 12 trial result exactly as the page stores it today (unit used as a note)
    Lab.keyResult('chi2', { label: 'χ² for your latest trial (food odor)', value: 0, unit: 'df = 1; critical value 3.84', part: 'Choice chamber' });
    // a standalone calculator result
    Lab.keyResult('chi2-calc', { label: 'χ² calculator', value: 0.133, note: 'df = 1; critical value 3.84; fail to reject H₀', part: 'Analyze' });
    // hostile values
    Lab.keyResult('obj', { label: 'Object | value', value: { a: 1.23456789, b: 'x | y' }, unit: 'cm', part: 'Analyze' });
    Lab.keyResult('arr', { label: 'Array', value: [1, 2.5, null, 'z|w'], unit: '', part: 'Analyze' });
    Lab.keyResult('nan', { label: 'Not a number', value: NaN, unit: 'min', part: 'Analyze' });
    Lab.keyResult('pipe', { label: 'Pipe', value: 'left | right\nnext line', unit: 'mg', part: 'Analyze' });
    // an old record already in storage with a sentence for a unit
    localStorage.setItem('aplab:lab12:keyres:old', JSON.stringify({ label: 'Old record', value: 5, unit: 'df = 2; critical value 5.99', part: 'x', t: 1 }));
  });
  const rows = await p.evaluate(() => Lab.keyResults().map(r => ({ id: r.id, value: r.value, unit: r.unit, note: r.note })));
  const by = Object.fromEntries(rows.map(r => [r.id, r]));
  T.ok(by.chi2.unit === '' && /critical value 3\.84/.test(by.chi2.note) && by.chi2.value === 0, 'unit that is a sentence moves to note: ' + JSON.stringify(by.chi2));
  T.ok(by['chi2-calc'].value === 0.133, 'calculator result is stored');
  T.ok(by.obj.value === 'a: 1.234568, b: x / y' && !/[|]/.test(by.obj.value), 'object value flattened: ' + by.obj.value);
  T.ok(by.arr.value === '1, 2.5, z / w', 'array value flattened: ' + by.arr.value);
  T.ok(by.nan.value === null, 'NaN becomes no value');
  T.ok(by.pipe.value === 'left / right next line', 'pipe and newline cleaned: ' + by.pipe.value);
  T.ok(by.old.unit === '' && /critical value 5\.99/.test(by.old.note), 'old stored record is cleaned on read');

  const b64 = await p.evaluate(async () => { const blob = await Lab.report.docx(); const buf = new Uint8Array(await blob.arrayBuffer()); let s = ''; for (let i = 0; i < buf.length; i += 8192) s += String.fromCharCode.apply(null, buf.subarray(i, i + 8192)); return btoa(s); });
  const zip = await JSZip.loadAsync(Buffer.from(b64, 'base64'));
  const xml = await zip.file('word/document.xml').async('string');
  const i = xml.indexOf('Key results'), kr = xml.slice(i, xml.indexOf('</w:tbl>', i));
  const rowsTxt = (kr.match(/<w:tr[ >][\s\S]*?<\/w:tr>/g) || []).map(r => (r.match(/<w:tc>[\s\S]*?<\/w:tc>/g) || []).map(c => (c.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || []).map(t => t.replace(/<[^>]+>/g, '')).join('')).join(' || '));
  console.log(rowsTxt.map(r => '    docx row: ' + r).join('\n'));
  T.ok(rowsTxt.some(r => /^χ² calculator: 0\.133/.test(r)), 'docx: calculator result 0.133 appears as "Label: value"');
  T.ok(rowsTxt.some(r => /^χ² for your latest trial \(food odor\): 0 \|\| df = 1; critical value 3\.84$/.test(r)), 'docx: trial row is "Label: 0" and the note is not glued to the value');
  T.ok(!rowsTxt.some(r => /: 0 df|[^|]\|[^|]/.test(r)), 'docx: no pipes, no "0 df" garble');
  T.ok(/Notes/.test(kr), 'docx: Notes column present');
  T.ok(rowsTxt.some(r => /^Not a number: —/.test(r)), 'docx: no value shows a dash');

  await p.evaluate(() => Lab.report.open({ print: false }));
  await p.waitForTimeout(500);
  const html = await p.evaluate(() => { const t = [...document.querySelectorAll('.rv-sec')].find(s => /Key results/.test((s.querySelector('h2') || {}).textContent || '')); return t ? [...t.querySelectorAll('tbody tr')].map(r => [...r.cells].map(c => c.textContent)) : null; });
  T.ok(html && html.some(r => /^χ² calculator: 0\.133/.test(r[0])), 'PDF view: calculator result shows as "Label: value"');
  T.ok(html && html.every(r => !/\|/.test(r.join(''))) && html.some(r => /^χ² for your latest trial \(food odor\): 0$/.test(r[0]) && /critical value 3\.84/.test(r[1])), 'PDF view: trial value clean, note in its own cell: ' + JSON.stringify(html && html[0]));
  T.ok(p.errors.length === 0, 'no page errors ' + p.errors.join('|'));
  await b.close(); srv.close();
  T.done('t49-keyresults');
})();
