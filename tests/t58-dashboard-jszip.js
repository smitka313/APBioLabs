/* Audit 5 #4: the class dashboard reads .docx with its own copy of JSZip 3.10.1 (vendor/jszip.min.js), so it works when
   the CDNs are blocked; malformed .docx files give a friendly reason and never remove records already loaded.
   Run: NODE_PATH=$(npm root -g) node tests/t58-dashboard-jszip.js */
const T = require('./_h');
const fs = require('fs'), path = require('path');
(async () => {
  const vend = path.join(T.ROOT, 'vendor/jszip.min.js');
  T.ok(fs.existsSync(vend), 'vendor/jszip.min.js exists');
  const txt = fs.existsSync(vend) ? fs.readFileSync(vend, 'utf8') : '';
  T.ok(/^\/\*!\s+JSZip v3\.10\.1 - A JavaScript class for generating and reading zip files/.test(txt) && /Dual licenced under the MIT license or GPLv3/.test(txt), 'it is JSZip 3.10.1 with its license header');
  T.ok(!!txt && txt === fs.readFileSync(path.join(__dirname, 'fixtures/jszip-3.10.1.min.js'), 'utf8'), 'byte-identical to the npm dist file');

  const b = await T.launch();
  const ctx = await b.newContext({ viewport: { width: 1366, height: 900 } });
  await ctx.addInitScript(() => { try { if (!localStorage.getItem('aplab:student')) localStorage.setItem('aplab:student', JSON.stringify({ name: 'Test Student', period: '3' })); localStorage.setItem('aplab:tour', JSON.stringify({ seen: true, v: 1 })); } catch (e) { /* ignore */ } });
  const cdn = [];
  await ctx.route(/cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|unpkg\.com/, r => { cdn.push(r.request().url()); r.abort(); });   // CDNs blocked
  const p = await T.open(ctx, 'teacher-dashboard.html');
  await p.waitForFunction(() => !!window.JSZip, null, { timeout: 5000 }).catch(() => {});
  T.ok(await p.evaluate(() => !!window.JSZip && JSZip.version === '3.10.1'), 'JSZip loads from the local copy with the CDNs blocked');
  T.ok(!cdn.some(u => /jszip/.test(u)), 'no CDN request needed for JSZip');
  T.ok(/ready/.test(await p.textContent('#reader')), 'reader says ready');

  // Real records first: a .docx made by a lab page, plus the sample class.
  const lp = await T.open(ctx, 'lab05.html');
  await lp.addScriptTag({ path: path.join(__dirname, 'fixtures/jszip-3.10.1.min.js') });
  const docx = await lp.evaluate(async () => { const pl = Lab.progressFile.payload(true); const code = await Lab.progressFile.makeCode(pl);
    const z = new JSZip(); z.file('[Content_Types].xml', '<Types/>'); z.file('docProps/custom.xml', `<?xml version="1.0"?><Properties xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><property name="aplab_payload_000"><vt:lpwstr>${code}</vt:lpwstr></property></Properties>`);
    return Array.from(new Uint8Array(await z.generateAsync({ type: 'uint8array' }))); });
  const before = await p.evaluate(async bytes => { await Dash.addFiles([new File([new Uint8Array(bytes)], 'good.docx')]); return Dash.state.recs.length; }, docx);
  T.ok(before === 1, 'a real .docx is read with the local JSZip');

  // Malformed files: random bytes, truncated zip, corrupted entry, no data, bad payload.
  const res = await p.evaluate(async good => {
    const z = (files) => { const zz = new JSZip(); Object.entries(files).forEach(([k, v]) => zz.file(k, v)); return zz.generateAsync({ type: 'uint8array', compression: 'DEFLATE' }); };
    const g = new Uint8Array(good);
    const corrupt = await z({ 'docProps/custom.xml': '<Properties>' + 'x'.repeat(5000) + '</Properties>' });
    for (let i = 60; i < 140; i++) corrupt[i] ^= 0xff;   // damage the compressed bytes of the entry
    const files = [
      new File([crypto.getRandomValues(new Uint8Array(2000))], 'random.docx'),
      new File([g.slice(0, Math.floor(g.length / 2))], 'cut-short.docx'),
      new File([corrupt], 'corrupt-entry.docx'),
      new File([await z({ 'word/document.xml': '<w:document/>' })], 'no-data.docx'),
      new File([await z({ 'docProps/custom.xml': '<Properties xmlns:vt="urn:vt"><property name="aplab_payload_000"><vt:lpwstr>LB1z.not-real</vt:lpwstr></property></Properties>' })], 'bad-payload.docx'),
      new File([await z({ 'docProps/custom.xml': '<Properties><broken' })], 'bad-xml.docx'),
      new File([], 'empty.docx'),
    ];
    const n0 = Dash.state.skipped.length;
    await Dash.addFiles(files);
    return { recs: Dash.state.recs.length, names: Dash.state.recs.map(r => r.name), skipped: Dash.state.skipped.slice(n0), live: document.getElementById('live').textContent };
  }, docx);
  T.ok(res.recs === before, 'malformed files did not remove or add records (' + res.recs + ')');
  T.ok(res.skipped.length === 7, 'every malformed file is listed as skipped (' + res.skipped.length + ')');
  res.skipped.forEach(s => T.ok(s.why && !/undefined|TypeError|Error:|Could not be read: /.test(s.why) && s.why.length < 200, `${s.file}: friendly reason — ${s.why}`));
  T.ok(await p.locator('table').count() >= 1 && /Test Student/.test(await p.textContent('main')), 'the loaded record is still shown');
  T.ok(p.errors.length === 0, 'no page errors ' + p.errors.join(' | '));
  await b.close(); T.done('t58-dashboard-jszip');
})();
