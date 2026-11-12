/* #14 Microscope zoom (scope.js): buttons, Ctrl+wheel, pinch, and click hit-testing at every zoom level */
const T = require('./_h');
(async () => {
  const b = await T.launch(), ctx = await T.ctxFor(b, { width: 900, height: 900 });

  const p = await ctx.newPage(); p.errors = [];
  p.on('pageerror', e => p.errors.push(e.message));
  await p.goto('file://' + T.ROOT + '/tests/fixtures/zoom.html'); await p.waitForTimeout(500);
  const zoom = () => p.evaluate(() => view.zoom);
  const val = () => p.textContent('#z-cv-zoom-val');

  console.log('Buttons');
  T.ok(await zoom() === 1 && await val() === '1×', 'starts at 1×');
  T.ok(await p.isDisabled('#z-cv-zoom-out'), '− disabled at 1×');
  await p.click('#z-cv-zoom-in'); T.ok(await zoom() === 1.5 && await val() === '1.5×', '+ goes to 1.5×');
  await p.click('#z-cv-zoom-in'); await p.click('#z-cv-zoom-in'); await p.click('#z-cv-zoom-in');
  T.ok(await zoom() === 3 && await p.isDisabled('#z-cv-zoom-in'), '+ stops at 3× and is disabled');
  await p.click('#z-cv-zoom-out'); T.ok(await zoom() === 2.5, '− steps back');
  await p.click('#z-cv-center'); T.ok(await zoom() === 1, 'Center slide resets the zoom');

  console.log('Ctrl + wheel');
  const box = await (await p.$('#z-cv')).boundingBox();
  await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  const scrollBefore = await p.evaluate(() => scrollY);
  await p.keyboard.down('Control'); await p.mouse.wheel(0, -400); await p.waitForTimeout(150); await p.keyboard.up('Control');
  const zw = await zoom();
  T.ok(zw > 1.5 && zw <= 3, 'Ctrl+wheel up zooms in (now ' + zw + '×)');
  T.ok(await p.evaluate(() => scrollY) === scrollBefore, 'the page did not scroll');
  await p.keyboard.down('Control'); await p.mouse.wheel(0, 3000); await p.waitForTimeout(150); await p.keyboard.up('Control');
  T.ok(await zoom() === 1, 'Ctrl+wheel down returns to 1×, never below');
  await p.keyboard.down('Control'); await p.mouse.wheel(0, -9000); await p.waitForTimeout(150); await p.keyboard.up('Control');
  T.ok(await zoom() === 3, 'never above 3×');
  await p.evaluate(() => view.setZoom(1));

  console.log('Pinch (touch)');
  await p.evaluate(() => {
    const cv = document.getElementById('z-cv'), r = cv.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const ev = (t, id, x, y) => cv.dispatchEvent(new PointerEvent(t, { pointerId: id, pointerType: 'touch', isPrimary: id === 1, clientX: x, clientY: y, bubbles: true, cancelable: true }));
    ev('pointerdown', 1, cx - 40, cy); ev('pointerdown', 2, cx + 40, cy);
    for (let i = 1; i <= 10; i++) { ev('pointermove', 1, cx - 40 - i * 8, cy); ev('pointermove', 2, cx + 40 + i * 8, cy); }
    ev('pointerup', 1, cx - 120, cy); ev('pointerup', 2, cx + 120, cy);
  });
  const zp = await zoom();
  T.ok(zp > 2.5 && zp <= 3, 'spreading two fingers zooms in (now ' + zp + '×)');
  T.ok(await p.evaluate(() => clicks.length) === 0, 'a pinch does not register as a click');
  await p.evaluate(() => {
    const cv = document.getElementById('z-cv'), r = cv.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const ev = (t, id, x, y) => cv.dispatchEvent(new PointerEvent(t, { pointerId: id, pointerType: 'touch', isPrimary: id === 1, clientX: x, clientY: y, bubbles: true, cancelable: true }));
    ev('pointerdown', 1, cx - 120, cy); ev('pointerdown', 2, cx + 120, cy);
    for (let i = 1; i <= 10; i++) { ev('pointermove', 1, cx - 120 + i * 10, cy); ev('pointermove', 2, cx + 120 - i * 10, cy); }
    ev('pointerup', 1, cx, cy); ev('pointerup', 2, cx, cy);
  });
  T.ok(await zoom() < 1.5, 'pinching in zooms out (now ' + await zoom() + '×)');
  await p.evaluate(() => view.setZoom(1));

  console.log('Click hit-testing at 1x, 2x, 3x (dark dot at world 900,700, found by reading the pixels)');
  for (const z of [1, 1.5, 2, 3]) {
    await p.evaluate(z => { view.setZoom(z); view.setPan(900 - 250 / z, 700 - 330 / z); }, z);
    await p.waitForTimeout(450);   // the slide re-renders sharper after a zoom
    const cen = await p.evaluate(() => { const zz = view.zoom, ex = (900 - view.pan.x) * zz, ey = (700 - view.pan.y) * zz;
      const cv = document.getElementById('z-cv'), x = cv.getContext('2d'), W = cv.width, H = cv.height, sc = W / 640;
      const d = x.getImageData(0, 0, W, H).data; let n = 0, sx = 0, sy = 0;
      for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
        if (Math.hypot(i / sc - ex, j / sc - ey) > 20 * zz + 14) continue; /* only the dot, not the eyepiece pointer */
        const k = (j * W + i) * 4; if (d[k] + d[k + 1] + d[k + 2] < 200) { n++; sx += i; sy += j; }
      }
      return n ? { fx: sx / n / W, fy: sy / n / H, n } : null;
    });
    T.ok(cen && cen.n > 50, `zoom ${z}: the dot is visible (${cen && cen.n} dark pixels)`);
    if (!cen) continue;
    const bb = await (await p.$('#z-cv')).boundingBox();
    await p.evaluate(() => { clicks.length = 0; });
    await p.mouse.click(bb.x + cen.fx * bb.width, bb.y + cen.fy * bb.height);
    const c = await p.evaluate(() => clicks[0]);
    T.ok(c && Math.hypot(c[0] - 900, c[1] - 700) < 4, `zoom ${z}: click on the dot returns world (${c && c.map(v => v.toFixed(1))}), expected (900, 700)`);
  }
  console.log('Drag pan while zoomed');
  await p.evaluate(() => { view.setZoom(2); view.setPan(300, 300); });
  const pb = await p.evaluate(() => view.pan);
  const bb2 = await (await p.$('#z-cv')).boundingBox();
  await p.mouse.move(bb2.x + 300, bb2.y + 200); await p.mouse.down(); await p.mouse.move(bb2.x + 200, bb2.y + 200, { steps: 5 }); await p.mouse.up();
  const pa = await p.evaluate(() => view.pan);
  // dragging 100 CSS px left moves the slide 100/width*640/zoom world units
  T.ok(Math.abs((pa.x - pb.x) - 100 / bb2.width * 640 / 2) < 1.5, `drag distance is scaled by the zoom (pan moved ${(pa.x - pb.x).toFixed(1)})`);
  T.ok(p.errors.length === 0, 'no page errors ' + p.errors.join(';'));
  await p.screenshot({ path: process.env.SHOT || undefined });

  console.log('Real labs 4, 7, 11, 12');
  for (const lab of ['lab04', 'lab07', 'lab11', 'lab12']) {
    const q = await T.open(ctx, lab + '.html');
    const n = await q.evaluate(() => { const cvs = Array.from(document.querySelectorAll('canvas.scope-canvas')); return { n: cvs.length, btns: document.querySelectorAll('.scope-zoom').length }; });
    T.ok(n.n > 0 && n.btns === n.n, `${lab}: ${n.n} scope canvases, each with zoom controls (${n.btns})`);
    // zoom the first one in a visible part
    const r = await q.evaluate(async () => {
      const cv = Array.from(document.querySelectorAll('canvas.scope-canvas')).find(c => c.clientWidth > 0) || document.querySelector('canvas.scope-canvas');
      const sec = cv.closest('section.step'); if (sec && Lab.pages.on) Lab.pages.go(sec);
      await new Promise(r => setTimeout(r, 400));
      const v = cv.scopeView; v.setZoom(2); await new Promise(r => setTimeout(r, 500));
      const rc = cv.getBoundingClientRect(), z = v.zoom, c = v.toWorld(rc.left + rc.width / 2, rc.top + rc.height / 2);
      const exp = { x: v.pan.x + v.viewW / z / 2, y: v.pan.y + v.viewH / z / 2 };
      return { z, dx: Math.abs(c.x - exp.x), dy: Math.abs(c.y - exp.y), c, exp, pan: v.pan, vw: v.viewW };
    });
    T.ok(r.z === 2 && r.dx < 0.5 && r.dy < 0.5, `${lab}: zoom 2× and the canvas centre maps to the middle of the zoomed window ${JSON.stringify(r)}`);
    T.ok(q.errors.length === 0, `${lab}: no page errors ${q.errors.join(';')}`);
    await q.close();
  }
  await b.close();
  T.done('t14-zoom');
})();
