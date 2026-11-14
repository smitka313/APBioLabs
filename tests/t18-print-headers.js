/* Name, class, lab, Dataset ID and page number on every page: .docx header/footer, report PDF, worksheet */
const T = require('./_h');
const fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');
const OUT = process.env.OUT || os.tmpdir();
const DOCX = T.docxFile();

function pdfPages(file) {
  const txt = cp.execFileSync('pdftotext', ['-layout', file, '-']).toString();
  return txt.split('\f').filter(s => s.trim());
}

(async () => {
  const b = await T.launch(), ctx = await T.ctxFor(b);
  await ctx.route(/cdn\.jsdelivr\.net\/npm\/docx|unpkg\.com\/docx/, r => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(DOCX) }));
  const p = await T.open(ctx, 'lab05.html', 'analyze');
  await p.evaluate(() => { document.querySelectorAll('textarea[data-save]').forEach((t, i) => { t.value = ('Answer number ' + i + '. ' + 'The disks floated sooner with more bicarbonate because more CO2 was available. ').repeat(14); t.dispatchEvent(new Event('input', { bubbles: true })); }); });
  await p.waitForTimeout(600);
  const ds = await p.evaluate(() => Lab.identity.datasetId);
  console.log('dataset id', ds);

  // ---- docx ----
  const b64 = await p.evaluate(async () => { const blob = await Lab.report.docx(); const buf = new Uint8Array(await blob.arrayBuffer()); let s = ''; for (let i = 0; i < buf.length; i += 8192) s += String.fromCharCode.apply(null, buf.subarray(i, i + 8192)); return btoa(s); });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'docx-')), zip = path.join(dir, 'r.docx');
  fs.writeFileSync(zip, Buffer.from(b64, 'base64'));
  const ex = path.join(dir, 'x'); fs.mkdirSync(ex);
  cp.execFileSync('unzip', ['-q', zip, '-d', ex]);
  const files = fs.readdirSync(path.join(ex, 'word'));
  const hdr = files.filter(f => /^header\d*\.xml$/.test(f)).map(f => fs.readFileSync(path.join(ex, 'word', f), 'utf8')).join('');
  const ftr = files.filter(f => /^footer\d*\.xml$/.test(f)).map(f => fs.readFileSync(path.join(ex, 'word', f), 'utf8')).join('');
  T.ok(/Test Student/.test(hdr) && /Class 3/.test(hdr) && /Lab 5/.test(hdr) && /Photosynthesis/.test(hdr), 'docx header: name, class, lab number and title');
  T.ok(!/AP Bio Lab Bench/.test(hdr), 'docx header has no site suffix');
  T.ok(ftr.includes('Dataset ID: ' + ds), 'docx footer: Dataset ID');
  T.ok(/PAGE/.test(ftr) && /NUMPAGES/.test(ftr), 'docx footer: page number fields');
  const sect = fs.readFileSync(path.join(ex, 'word/document.xml'), 'utf8');
  T.ok(/headerReference/.test(sect) && /footerReference/.test(sect), 'document.xml references header and footer');

  // ---- PDF report ----
  await p.evaluate(() => Lab.report.open());
  await p.waitForTimeout(800);
  await p.emulateMedia({ media: 'print' });
  const pdf = path.join(dir, 'report.pdf');
  await p.pdf({ path: pdf, format: 'Letter', preferCSSPageSize: true, printBackground: true });
  let pages = pdfPages(pdf);
  console.log('report pages', pages.length);
  T.ok(pages.length >= 2, 'report spans several pages');
  T.ok(pages.every(t => /Test Student/.test(t) && /Class 3/.test(t) && /Lab 5/.test(t) && t.includes(ds)), 'every report page has name, class, lab and Dataset ID');
  T.ok(pages.every((t, i) => new RegExp('Page ' + (i + 1) + ' of ' + pages.length).test(t)), 'every report page has "Page n of N"');
  // fallback header (browsers without margin boxes): force it and print again
  await p.evaluate(() => { document.getElementById('rv-page-style').textContent = '@page { size: letter; margin: .7in .6in .6in; }'; document.body.classList.add('pr-fallback'); });
  const pdf2 = path.join(dir, 'report-fb.pdf');
  await p.pdf({ path: pdf2, format: 'Letter', preferCSSPageSize: true, printBackground: true });
  pages = pdfPages(pdf2);
  T.ok(pages.length >= 2 && pages.every(t => /Test Student/.test(t) && /Class 3/.test(t) && /Lab 5/.test(t) && t.includes(ds)), `fallback repeated header on all ${pages.length} pages`);
  await p.evaluate(() => Lab.report.close());
  await p.emulateMedia({ media: 'screen' });
  await p.evaluate(() => Lab.report.open()); await p.waitForTimeout(500);
  T.ok(await p.evaluate(() => getComputedStyle(document.querySelector('.print-run')).display === 'none'), 'run header hidden on screen');
  await p.evaluate(() => Lab.report.close());

  // ---- worksheet ----
  await p.evaluate(() => Lab.worksheet.enter()); await p.waitForTimeout(500);
  await p.emulateMedia({ media: 'print' });
  const pdf3 = path.join(dir, 'ws.pdf');
  await p.pdf({ path: pdf3, format: 'Letter', preferCSSPageSize: true, printBackground: true });
  pages = pdfPages(pdf3);
  console.log('worksheet pages', pages.length);
  T.ok(pages.length >= 2 && pages.every((t, i) => /Name _+\s+Class _+/.test(t) && /Lab 5/.test(t) && /Dataset ID _+/.test(t) && new RegExp('Page ' + (i + 1) + ' of ' + pages.length).test(t)), 'every worksheet page: Name ___ Class ___, lab, Dataset ID ___, page n of N');
  await p.evaluate(() => { document.getElementById('ws-page-style').textContent = '@page { size: letter; margin: .7in .6in .6in; }'; document.body.classList.add('pr-fallback'); });
  const pdf4 = path.join(dir, 'ws-fb.pdf');
  await p.pdf({ path: pdf4, format: 'Letter', preferCSSPageSize: true, printBackground: true });
  pages = pdfPages(pdf4);
  T.ok(pages.length >= 2 && pages.every(t => /Name _+\s+Class _+/.test(t) && /Lab 5/.test(t)), `worksheet fallback header on all ${pages.length} pages`);
  await p.emulateMedia({ media: 'screen' });
  T.ok(p.errors.length === 0, 'no errors ' + p.errors.join('|'));
  console.log(dir);
  await b.close();
  T.done('t18-print-headers');
})();
