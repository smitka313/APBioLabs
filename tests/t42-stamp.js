/* "Bench-verified" stamp: a canvas-drawn PNG in the .docx page header and at the top of the PDF report view, never over content.
   Run: NODE_PATH=$(npm root -g) node tests/t42-stamp.js  (OUT=dir keeps screenshots) */
const T = require('./_h');
const path = require('path');
const JSZip = require(path.join(__dirname, 'fixtures/jszip-3.10.1.min.js'));
const OUT = process.env.OUT || '';

(async () => {
  const srv = await T.serve(), b = await T.launch();
  const ctx = await T.ctxFor(b);
  const p = await T.open(ctx, 'tests/fixtures/lab99.html', '', srv.url);

  console.log('The PNG');
  const info = await p.evaluate(async () => {
    const a = Lab.stamp.png({ datasetId: 'K7M-2QX', date: new Date(2026, 10, 13), color: 'blue' });
    const a2 = Lab.stamp.png({ datasetId: 'K7M-2QX', date: new Date(2026, 10, 13), color: 'blue' });
    const b = Lab.stamp.png({ datasetId: 'ZZZ-999', date: new Date(2026, 10, 13), color: 'blue' });
    const r = Lab.stamp.png({ datasetId: 'K7M-2QX', date: new Date(2026, 10, 13), color: 'red' });
    const im = new Image(); im.src = a.dataUrl; await im.decode();
    const cv = document.createElement('canvas'); cv.width = im.width; cv.height = im.height; const x = cv.getContext('2d'); x.drawImage(im, 0, 0);
    const d = x.getImageData(0, 0, cv.width, cv.height).data; let op = 0, rs = 0, gs = 0, bs = 0, partial = 0;
    for (let i = 0; i < d.length; i += 4) { if (d[i + 3] > 200) { op++; rs += d[i]; gs += d[i + 1]; bs += d[i + 2]; } else if (d[i + 3] > 20) partial++; }
    const corner = d[3] + d[(cv.width - 1) * 4 + 3] + d[((cv.height - 1) * cv.width) * 4 + 3];
    const rim = []; for (let px = 0; px < cv.width; px++) { rim.push(d[(Math.round(cv.height / 2) * cv.width + px) * 4 + 3] > 128 ? 1 : 0); }
    return { png: a.dataUrl.startsWith('data:image/png;base64,'), w: im.width, h: im.height, same: a.dataUrl === a2.dataUrl, diff: a.dataUrl !== b.dataUrl, redDiff: a.dataUrl !== r.dataUrl, cover: op / (cv.width * cv.height), partial: partial / (cv.width * cv.height), mean: [rs / op, gs / op, bs / op], corner, alt: a.alt, bytes: a.bytes.length, sig: Array.from(a.bytes.slice(0, 4)) };
  });
  T.ok(info.png && info.w >= 400 && info.sig.join() === '137,80,78,71', `a ${info.w}×${info.h} PNG (${info.bytes} bytes)`);
  T.ok(info.corner === 0, 'transparent corners (the rotated seal sits on no white box)');
  T.ok(info.cover > 0.05 && info.cover < 0.35, 'ink coverage is a stamp, not a blob or a ghost (' + (info.cover * 100).toFixed(1) + '% solid)');
  T.ok(info.partial > 0.004, 'rough edges: ' + (info.partial * 100).toFixed(2) + '% semi-transparent pixels');
  T.ok(info.mean[2] > info.mean[0] + 40 && info.mean[0] < 100, 'stamp blue, dark enough to print (mean rgb ' + info.mean.map(Math.round).join(',') + ')');
  T.ok(info.same && info.diff && info.redDiff, 'deterministic for the same ID and date, different for another ID or colour');
  T.ok(/Bench-verified stamp: Dataset ID K7M-2QX, 13 NOV 2026/.test(info.alt), 'alt text: ' + info.alt);
  if (OUT) {
    const html = await p.evaluate(() => ['blue', 'red'].map(c => `<img src="${Lab.stamp.png({ datasetId: 'K7M-2QX', date: new Date(2026, 10, 13), color: c }).dataUrl}" width="300">`).join(''));
    const q = await ctx.newPage(); await q.setContent('<body style="margin:0;background:#fff">' + html + '</body>'); await q.screenshot({ path: OUT + '/t42-stamp.png', clip: { x: 0, y: 0, width: 600, height: 300 } }); await q.close();
  }

  console.log('In the .docx header');
  await p.evaluate(() => Lab.pages.go('part-a')); await p.waitForTimeout(300);
  await p.fill('#p-a1', 'Answer A'); await p.evaluate(() => Lab.pages.go('part-b')); await p.waitForTimeout(300); await p.fill('#p-b1', 'Answer B');
  const b64 = await p.evaluate(async () => { const blob = await Lab.report.docx(); const buf = new Uint8Array(await blob.arrayBuffer()); let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000)); return btoa(s); });
  const zip = await JSZip.loadAsync(Buffer.from(b64, 'base64'));
  const names = Object.keys(zip.files);
  const hdrName = names.find(n => /^word\/header\d*\.xml$/.test(n));
  T.ok(!!hdrName, 'the .docx has a header part (' + hdrName + ')');
  const hx = await zip.file(hdrName).async('string');
  T.ok(/<w:drawing>/.test(hx) && /<pic:pic/.test(hx), 'the header XML contains a drawing');
  T.ok(/Bench-verified stamp/.test(hx), 'with the "Bench-verified stamp" name and alt text');
  T.ok(/descr="Bench-verified stamp: Dataset ID [A-Z0-9-]+, \d+ [A-Z]{3} \d{4}"/.test(hx), 'alt text carries the Dataset ID and date');
  T.ok(/wp:inline/.test(hx) && !/wp:anchor/.test(hx), 'inline (flows with the header; cannot sit on top of body text)');
  const relsName = names.find(n => /^word\/_rels\/header\d*\.xml\.rels$/.test(n));
  const rels = relsName ? await zip.file(relsName).async('string') : '';
  const target = (/Target="(media\/[^"]+)"/.exec(rels) || [])[1];
  T.ok(!!target && /\.png$/.test(target), 'the header relationship points at a PNG: ' + target);
  const png = target ? await zip.file('word/' + target).async('uint8array') : new Uint8Array();
  T.ok(png.length > 3000 && png[1] === 0x50 && png[2] === 0x4e && png[3] === 0x47, 'media is a real PNG (' + png.length + ' bytes)');
  const sz = /<wp:extent cx="(\d+)" cy="(\d+)"/.exec(hx) || [];
  T.ok(+sz[1] > 600000 && +sz[1] < 1100000 && sz[1] === sz[2], 'sized about 0.8 in so the ID and date stay legible (' + (sz[1] / 914400).toFixed(2) + ' in)');
  const doc = await zip.file('word/document.xml').async('string');
  T.ok(!/Bench-verified/.test(doc), 'the stamp is only in the header, not in the body');
  T.ok(/<w:pgMar[^>]*w:header="360"/.test(doc), 'header distance trimmed so the seal costs little page');

  console.log('In the PDF report view');
  await p.evaluate(() => Lab.report.open({}));
  await p.waitForSelector('.rv-stamp'); await p.waitForTimeout(300);
  const geo = await p.evaluate(() => {
    const st = document.querySelector('.rv-stamp'), s = st.getBoundingClientRect();
    const boxes = Array.from(document.querySelectorAll('.rv-head h1, .rv-head .rv-eyebrow, .rv-info div, .rv-sec h2, .rv-sec p, .rv-table')).map(e => ({ t: e.textContent.slice(0, 20), r: e.getBoundingClientRect() }));
    const hit = []; boxes.forEach(({ t, r }) => { // text boxes of blocks that wrap around a float: measure the line boxes, not the full-width block
      const rng = document.createRange(); rng.selectNodeContents(Array.from(document.querySelectorAll('.rv-head h1, .rv-head .rv-eyebrow, .rv-info div, .rv-sec h2, .rv-sec p, .rv-table')).find(e => e.textContent.slice(0, 20) === t));
      Array.from(rng.getClientRects()).forEach(q => { if (q.width && q.height && q.left < s.right && q.right > s.left && q.top < s.bottom && q.bottom > s.top) hit.push(t); });
    });
    const paper = document.querySelector('.rv-paper').getBoundingClientRect();
    return { w: s.width, h: s.height, nat: st.naturalWidth, hit, inside: s.left >= paper.left && s.right <= paper.right, visible: getComputedStyle(st).display !== 'none', alt: st.alt };
  });
  T.ok(geo.visible && geo.nat >= 400 && geo.w > 90 && geo.w < 130, `the report view shows it at ${Math.round(geo.w)} px`);
  T.ok(geo.inside, 'inside the page, not hanging off the paper');
  T.ok(geo.hit.length === 0, 'it overlaps no text in the report (' + geo.hit.join(',') + ')');
  T.ok(/Bench-verified/.test(geo.alt), 'has alt text');
  if (OUT) await p.screenshot({ path: OUT + '/t42-report.png', clip: { x: 0, y: 0, width: 1366, height: 560 } });
  T.ok(p.errors.length === 0, 'no console errors ' + p.errors.join('|'));

  console.log('Phone width');
  const m = await T.ctxFor(b, { width: 400, height: 800 });
  const q = await T.open(m, 'tests/fixtures/lab99.html', '', srv.url);
  await q.evaluate(() => Lab.report.open({})); await q.waitForSelector('.rv-stamp'); await q.waitForTimeout(300);
  T.ok(await q.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'no sideways page scroll at 400 px');
  await m.close();

  await b.close(); srv.close();
  T.done('t42-stamp');
})();
