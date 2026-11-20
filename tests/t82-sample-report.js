/* sample-report.html shows a REAL Lab 5 export (tools/make-sample-report.js): the sample files exist, and everything the page
   displays (student, Dataset ID, date, every table cell and every written answer) is exactly what the .docx holds.
   Run: NODE_PATH=$(npm root -g) node tests/t82-sample-report.js */
const T = require('./_h');
const fs = require('fs'), path = require('path');
const JSZip = require(path.join(__dirname, 'fixtures/jszip-3.10.1.min.js'));
const S = path.join(T.ROOT, 'samples');
const unxml = s => s.replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
const norm = s => String(s).replace(/\s+/g, ' ').trim();

(async () => {
  console.log('Sample files');
  const docxPath = path.join(S, 'sample-report-lab05.docx'), pdfPath = path.join(S, 'sample-report-lab05.pdf');
  T.ok(fs.existsSync(docxPath) && fs.statSync(docxPath).size > 10000, 'samples/sample-report-lab05.docx exists');
  T.ok(fs.existsSync(pdfPath) && fs.readFileSync(pdfPath).slice(0, 5).toString() === '%PDF-', 'samples/sample-report-lab05.pdf exists and is a PDF');
  T.ok(fs.existsSync(path.join(T.ROOT, 'tools/make-sample-report.js')), 'tools/make-sample-report.js (the generator) exists');

  const zip = await JSZip.loadAsync(fs.readFileSync(docxPath));
  const xml = await zip.file('word/document.xml').async('string');
  const paraText = p => norm(unxml((p.match(/<w:t(?:\s[^>]*)?>[^<]*<\/w:t>/g) || []).join('')));
  const paras = (xml.match(/<w:p[ >][\s\S]*?<\/w:p>/g) || []).map(paraText).filter(Boolean);
  const docRows = (xml.match(/<w:tr[ >][\s\S]*?<\/w:tr>/g) || []).map(tr => (tr.match(/<w:tc>[\s\S]*?<\/w:tc>/g) || []).map(paraText));
  const allText = norm(paras.join(' '));
  const custom = zip.file('docProps/custom.xml') ? await zip.file('docProps/custom.xml').async('string') : '';
  T.ok(/aplab_payload_000/.test(custom), '.docx carries the dashboard payload (it is a real export)');

  const html = fs.readFileSync(path.join(T.ROOT, 'sample-report.html'), 'utf8');
  T.ok(/<!-- sample-report:start -->[\s\S]*rv-head[\s\S]*<!-- sample-report:end -->/.test(html), 'the page holds the generated report preview between its markers');
  T.ok(/fictional/i.test(html) && /simulat/i.test(html) && /real (Lab 5 report|export)/i.test(html), 'the page says plainly: a real export, a fictional student, simulated data');
  T.ok(!/illustrative example/i.test(html), 'the old hand-written "illustrative example" is gone');

  const b = await T.launch(); const srv = await T.serve();
  const ctx = await T.ctxFor(b, { width: 1366, height: 900 });
  const p = await T.open(ctx, 'sample-report.html', '', srv.url);
  const pg = await p.evaluate(() => {
    const paper = document.querySelector('.sample-paper');
    const info = Object.fromEntries([...paper.querySelectorAll('.rv-info > div')].map(d => [d.querySelector('dt').textContent, d.querySelector('dd').textContent]));
    const rows = [...paper.querySelectorAll('table.rv-table tbody tr, table.rv-table tfoot tr')].map(tr => [...tr.children].map(td => td.textContent));
    const answers = [...paper.querySelectorAll('.rv-qa')].map(q => ({ q: q.querySelector('.rv-q').textContent, a: [...q.querySelectorAll('p:not(.rv-q)')].map(x => x.textContent) }));
    const quiz = [...paper.querySelectorAll('.rv-quiz li')].map(li => li.textContent);
    const imgs = [...paper.querySelectorAll('img')].map(i => ({ src: i.getAttribute('src'), alt: i.alt, ok: i.complete || i.loading === 'lazy' }));
    const links = [...document.querySelectorAll('a[href^="samples/"]')].map(a => a.getAttribute('href'));
    return { info, rows, answers, quiz, imgs, links, title: paper.querySelector('#rv-title').textContent };
  });
  console.log('Page vs .docx');
  T.ok(pg.info.Name === 'Sample Student' && pg.info['Class period'] === 'Demo', 'the page names the fictional student (Sample Student, class Demo)');
  for (const k of ['Name', 'Class period', 'Date', 'Dataset ID']) T.ok(pg.info[k] && allText.includes(norm(pg.info[k])), `${k} "${pg.info[k]}" is in the .docx`);
  T.ok(allText.includes(norm(pg.title)), 'report title is in the .docx');
  T.ok(pg.rows.length > 40, `page shows the report tables (${pg.rows.length} rows)`);
  // Every table row on the page appears, cell for cell and in the same order, as a row of a .docx table.
  const key = r => r.map(norm).join(' | ');
  const docKeys = docRows.map(key);
  let at = 0, missing = [];
  for (const r of pg.rows) { const i = docKeys.indexOf(key(r), at); if (i < 0) missing.push(key(r)); else at = i + 1; }
  T.ok(!missing.length, 'every table row on the page is in the .docx, in order' + (missing.length ? ': missing ' + missing.slice(0, 3).join(' / ') : ''));
  const nums = pg.rows.flat().filter(c => /\d/.test(c)).length;
  T.ok(nums > 100, `${nums} numeric cells compared`);
  T.ok(pg.answers.length >= 25, `page shows the written answers (${pg.answers.length})`);
  const badA = pg.answers.filter(x => !x.a.every(l => !norm(l) || allText.includes(norm(l))) || !allText.includes(norm(x.q)));
  T.ok(!badA.length, 'every question and answer on the page is word for word in the .docx' + (badA.length ? ': ' + badA[0].q.slice(0, 60) : ''));
  T.ok(pg.quiz.length === 8, 'pre-lab quiz answers shown');
  // Numbers quoted inside answers (ET50s, rates) must be in the .docx too: covered by the word-for-word check above.
  console.log('Images and downloads');
  T.ok(pg.imgs.length >= 3 && pg.imgs.every(i => i.alt && i.alt.length > 15), 'graphs and stamp have descriptive alt text');
  T.ok(pg.imgs.every(i => /^samples\/sample-report-lab05-[\w-]+\.png$/.test(i.src) && fs.existsSync(path.join(T.ROOT, i.src))), 'every image is a file under samples/');
  const media = Object.keys(zip.files).filter(n => /^word\/media\//.test(n));
  T.ok(media.length >= pg.imgs.length, `.docx holds the graph and stamp images too (${media.length})`);
  T.ok(pg.links.includes('samples/sample-report-lab05.docx') && pg.links.includes('samples/sample-report-lab05.pdf'), 'Download .docx and Download PDF links');
  for (const href of ['samples/sample-report-lab05.docx', 'samples/sample-report-lab05.pdf']) {
    const r = await p.request.get(srv.url + href); T.ok(r.ok(), href + ' is served');
  }
  T.ok(!p.errors.length, 'no page errors' + (p.errors.length ? ': ' + p.errors.join(' | ') : ''));
  await b.close(); srv.close();
  T.done('t82-sample-report');
})().catch(e => { console.error(e); process.exit(1); });
