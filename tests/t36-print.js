/* Printing: Ctrl+P page, Print worksheet and Save as PDF (report) on all 13 labs, site in dark mode:
   light pages, no blank canvases (static snapshots), images present in the PDF. Needs poppler (pdftoppm, pdfimages). */
const T = require('./_h');
const { execSync } = require('child_process');
const fs = require('fs'), os = require('os'), path = require('path');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aplab-print-'));
const labs = process.env.LABS ? process.env.LABS.split(',') : T.LABS;
function pdfStats(f) {
  const n = +/Pages:\s+(\d+)/.exec(execSync(`pdfinfo ${f}`).toString())[1];
  const imgs = execSync(`pdfimages -list ${f}`).toString().split('\n').slice(2).filter(l => /\simage\s/.test(l)).length;
  execSync(`pdftoppm -r 20 -gray -png ${f} ${f.replace('.pdf', '')}`);
  let darkPages = 0, worst = 0;
  fs.readdirSync(tmp).filter(x => x.startsWith(path.basename(f, '.pdf') + '-') && x.endsWith('.png')).forEach(x => {
    /* A dark page shows in the margins (outer 4% strips) and in the average; a dark photo inside the page does not count. */
    const out = execSync(`python3 -I -c "from PIL import Image;import numpy as n,sys;a=n.asarray(Image.open(sys.argv[1]).convert('L')).astype(float);h,w=a.shape;m=n.concatenate([a[:max(1,h//25)].ravel(),a[-max(1,h//25):].ravel(),a[:,:max(1,w//25)].ravel(),a[:,-max(1,w//25):].ravel()]);print(max((m<80).mean(),1.0 if a.mean()<150 else 0))" ${path.join(tmp, x)}`).toString();
    const frac = +out; worst = Math.max(worst, frac); if (frac > 0.3) darkPages++;
  });
  return { n, imgs, darkPages, worst };
}
(async () => {
  const b = await T.launch(), ctx = await T.ctxFor(b, { dark: true });
  for (const lab of labs) {
    const p = await T.open(ctx, lab + '.html');
    // 1. Ctrl+P: prepare() as the beforeprint handler does it
    const snap = await p.evaluate(async () => {
      Lab.pages.suspend(); const n = Lab.print.prepare();
      const imgs = Lab.print.snapshots;
      const res = [];
      for (const im of imgs) {
        await im.decode().catch(() => {});
        const c = document.createElement('canvas'); c.width = Math.min(im.naturalWidth, 200); c.height = Math.min(im.naturalHeight, 200);
        const x = c.getContext('2d'); x.drawImage(im, 0, 0, c.width, c.height);
        const d = x.getImageData(0, 0, c.width, c.height).data; let lo = 255, hi = 0, dark = 0, opaque = 0;
        for (let i = 0; i < d.length; i += 4) { if (d[i + 3] > 0) { opaque++; const v = (d[i] + d[i + 1] + d[i + 2]) / 3; lo = Math.min(lo, v); hi = Math.max(hi, v); if (v < 40) dark++; } }
        res.push({ id: im.getAttribute('alt') || im.className, opaque: opaque / (d.length / 4), range: hi - lo, dark: dark / Math.max(1, opaque) });
      }
      const visibleCanvases = Array.from(document.querySelectorAll('canvas')).filter(c => c.getClientRects().length).length;
      Lab.print.restore(); Lab.pages.resume();
      return { n, res, visibleCanvases, restored: document.querySelectorAll('.print-snap').length === 0 };
    });
    T.ok(snap.visibleCanvases === 0, `${lab}: every visible canvas is replaced by a snapshot (${snap.n} snapshots)`);
    const blank = snap.res.filter(r => r.opaque < 0.02 || r.range < 4);
    T.ok(blank.length === 0, `${lab}: no blank canvas snapshots ${JSON.stringify(blank.slice(0, 3))}`);
    const darkBg = snap.res.filter(r => r.dark > 0.6);
    T.ok(darkBg.length === 0, `${lab}: no dark-background snapshots ${JSON.stringify(darkBg.slice(0, 3))}`);
    T.ok(snap.restored, `${lab}: snapshots removed after printing`);
    const f1 = path.join(tmp, lab + '-page.pdf');
    await p.pdf({ path: f1, format: 'Letter', printBackground: true });
    const s1 = pdfStats(f1);
    T.ok(s1.darkPages === 0, `${lab}: page PDF ${s1.n} pages, none dark (worst dark fraction ${s1.worst.toFixed(3)})`);
    T.ok(snap.n === 0 || s1.imgs >= snap.n, `${lab}: page PDF holds ${s1.imgs} images for ${snap.n} canvases`);
    // 2. worksheet
    await p.evaluate(() => Lab.worksheet.enter()); await p.waitForTimeout(500);
    const ws = await p.evaluate(() => ({ canvases: document.querySelectorAll('.ws-paper canvas').length, imgs: document.querySelectorAll('.ws-paper img.ws-img').length }));
    const f2 = path.join(tmp, lab + '-ws.pdf');
    await p.pdf({ path: f2, format: 'Letter', printBackground: true, preferCSSPageSize: true });
    const s2 = pdfStats(f2);
    T.ok(ws.canvases === 0 && s2.darkPages === 0, `${lab}: worksheet ${s2.n} pages, none dark, ${ws.imgs} pictures, no canvases`);
    await p.evaluate(() => Lab.worksheet.exit());
    // 3. report (Save as PDF)
    await p.evaluate(() => Lab.report.open()); await p.waitForTimeout(800);
    const rp = await p.evaluate(() => ({ imgs: document.querySelectorAll('#lab-report img').length, bad: Array.from(document.querySelectorAll('#lab-report img')).filter(i => !i.naturalWidth).length }));
    const f3 = path.join(tmp, lab + '-report.pdf');
    await p.pdf({ path: f3, format: 'Letter', printBackground: true, preferCSSPageSize: true });
    const s3 = pdfStats(f3);
    T.ok(s3.darkPages === 0 && rp.bad === 0, `${lab}: report ${s3.n} pages, none dark, ${rp.imgs} chart pictures all decoded`);
    T.ok(rp.imgs === 0 || s3.imgs >= rp.imgs, `${lab}: report PDF holds ${s3.imgs} images for ${rp.imgs} charts`);
    if (process.env.KEEP) for (const f of [f1, f2, f3]) fs.copyFileSync(f, path.join(process.env.KEEP, path.basename(f)));
    T.ok(p.errors.length === 0, `${lab}: no errors ${p.errors.join(';')}`);
    await p.close();
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  await b.close(); T.done('t36-print');
})();
