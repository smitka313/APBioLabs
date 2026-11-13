/* Timelapse + GIF: the hand-written GIF89a encoder (header, palette, LZW, multiple frames, plays), recording a run, the replay modal,
   persistence across a reload, erase on sign-out, the GIF download and the .docx option.
   Run: NODE_PATH=$(npm root -g) node tests/t44-timelapse.js  (OUT=dir keeps screenshots and the GIF) */
const T = require('./_h');
const path = require('path');
const fs = require('fs');
const JSZip = require(path.join(__dirname, 'fixtures/jszip-3.10.1.min.js'));
const OUT = process.env.OUT || '';
const FIX = 'tests/fixtures/lab98.html';

/* A small independent GIF decoder (blocks, LZW, disposal 1 + transparency) so the test proves the bytes are a real, playable GIF. */
function decodeGif(buf) {
  let p = 0; const sig = buf.slice(0, 6).toString('latin1'); p = 6;
  const W = buf.readUInt16LE(p), H = buf.readUInt16LE(p + 2), flags = buf[p + 4]; p += 7;
  let gct = null; if (flags & 0x80) { const n = 3 << ((flags & 7) + 1); gct = buf.slice(p, p + n); p += n; }
  const info = { sig, W, H, gctSize: gct ? gct.length / 3 : 0, loop: null, frames: [], trailer: false, delays: [] };
  const canvas = new Uint8ClampedArray(W * H * 4); let gce = null;
  while (p < buf.length) {
    const b = buf[p++];
    if (b === 0x3B) { info.trailer = true; break; }
    if (b === 0x21) {
      const label = buf[p++];
      const blocks = []; for (;;) { const n = buf[p++]; if (!n) break; blocks.push(buf.slice(p, p + n)); p += n; }
      if (label === 0xF9) { const d = blocks[0]; gce = { disposal: (d[0] >> 2) & 7, trans: d[0] & 1, delay: d.readUInt16LE(1), ti: d[3] }; }
      if (label === 0xFF && blocks[0].toString('latin1') === 'NETSCAPE2.0') info.loop = blocks[1].readUInt16LE(1);
      continue;
    }
    if (b !== 0x2C) throw new Error('bad block 0x' + b.toString(16) + ' at ' + p);
    const x = buf.readUInt16LE(p), y = buf.readUInt16LE(p + 2), w = buf.readUInt16LE(p + 4), h = buf.readUInt16LE(p + 6), pf = buf[p + 8]; p += 9;
    let ct = gct; if (pf & 0x80) { const n = 3 << ((pf & 7) + 1); ct = buf.slice(p, p + n); p += n; }
    const minCode = buf[p++]; const chunks = []; for (;;) { const n = buf[p++]; if (!n) break; chunks.push(buf.slice(p, p + n)); p += n; }
    const data = Buffer.concat(chunks), idx = new Uint8Array(w * h);
    const clear = 1 << minCode, eoi = clear + 1, prefix = new Int32Array(4096), suffix = new Uint8Array(4096);
    let size = minCode + 1, next = eoi + 1, bits = 0, nb = 0, dp = 0, old = -1, first = 0, op = 0;
    while (op < w * h) {
      while (nb < size && dp < data.length) { bits |= data[dp++] << nb; nb += 8; }
      if (nb < size) break;
      const code = bits & ((1 << size) - 1); bits >>>= size; nb -= size;
      if (code === clear) { size = minCode + 1; next = eoi + 1; old = -1; continue; }
      if (code === eoi) break;
      if (old === -1) { idx[op++] = code; old = code; first = code; continue; }
      const stack = []; let cur = code;
      if (code >= next) { stack.push(first); cur = old; }
      while (cur >= clear) { stack.push(suffix[cur]); cur = prefix[cur]; }
      first = cur; stack.push(cur);
      for (let i = stack.length - 1; i >= 0 && op < w * h; i--) idx[op++] = stack[i];
      if (next < 4096) { prefix[next] = old; suffix[next] = first; next++; if (next === (1 << size) && size < 12) size++; }
      old = code;
    }
    if (op !== w * h) throw new Error(`LZW produced ${op} of ${w * h} pixels`);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const v = idx[j * w + i]; if (gce && gce.trans && v === gce.ti) continue;
      const o = ((y + j) * W + x + i) * 4; canvas[o] = ct[v * 3]; canvas[o + 1] = ct[v * 3 + 1]; canvas[o + 2] = ct[v * 3 + 2]; canvas[o + 3] = 255;
    }
    info.frames.push({ x, y, w, h, rgba: canvas.slice(), delay: gce ? gce.delay : 0, trans: gce ? !!gce.trans : false, disposal: gce ? gce.disposal : 0 });
    info.delays.push(gce ? gce.delay : 0); gce = null;
  }
  return info;
}
const maxDiff = (a, b) => { let m = 0; for (let i = 0; i < a.length; i += 4) for (let k = 0; k < 3; k++) m = Math.max(m, Math.abs(a[i + k] - b[i + k])); return m; };

(async () => {
  const srv = await T.serve(), b = await T.launch();
  let ctx = await T.ctxFor(b);
  let p = await T.open(ctx, FIX, '', srv.url);

  console.log('GIF encoder: synthetic frames');
  const synth = await p.evaluate(async () => {
    const W = 120, H = 80, frames = [];
    for (let f = 0; f < 6; f++) {
      const d = new Uint8ClampedArray(W * H * 4);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const o = (y * W + x) * 4, inSq = x > 10 + f * 14 && x < 40 + f * 14 && y > 20 && y < 55;
        d[o] = inSq ? 220 : 30 + x; d[o + 1] = inSq ? 60 + f * 20 : 40 + y; d[o + 2] = inSq ? 40 : 200 - x; d[o + 3] = 255;
      }
      frames.push({ data: d, width: W, height: H });
    }
    const bytes = await Lab.gif.encode(frames, { delay: 12 });
    // noise: forces the 12-bit LZW table to fill and reset
    const nd = new Uint8ClampedArray(W * H * 4); let s = 7; for (let i = 0; i < nd.length; i += 4) { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; nd[i] = (s >> 8) & 255; nd[i + 1] = (s >> 16) & 255; nd[i + 2] = (s >> 4) & 255; nd[i + 3] = 255; }
    const nbytes = await Lab.gif.encode([{ data: nd, width: W, height: H }, { data: nd, width: W, height: H }]);
    return { bytes: Array.from(bytes), src: frames.map(f => Array.from(f.data)), nbytes: Array.from(nbytes), nsrc: Array.from(nd) };
  });
  const gb = Buffer.from(synth.bytes), g = decodeGif(gb);
  T.ok(g.sig === 'GIF89a', 'signature is GIF89a');
  T.ok(g.W === 120 && g.H === 80, 'logical screen 120×80');
  T.ok(g.gctSize === 256, 'a 256-entry global colour table');
  T.ok(g.loop === 0, 'NETSCAPE2.0 loop extension (repeat forever)');
  T.ok(g.frames.length === 6, 'six image frames, each LZW-decodes to exactly its pixels (' + g.frames.length + ')');
  T.ok(g.trailer, 'ends with the 0x3B trailer');
  T.ok(g.frames.slice(1).every(f => f.trans && f.disposal === 1) && g.frames[0].w === 120 && g.frames[0].h === 80, 'frame 1 is full size; later frames store only what changed (transparent index, do-not-dispose)');
  T.ok(g.frames.slice(1).every(f => f.w * f.h < 120 * 80), 'frame rectangles are smaller than the screen: ' + g.frames.slice(1).map(f => f.w + '×' + f.h).join(', '));
  T.ok(g.delays.every(d => d === 12), 'frame delays are 12/100 s');
  let worst = 0; g.frames.forEach((f, i) => { worst = Math.max(worst, maxDiff(f.rgba, synth.src[i])); });
  T.ok(worst <= 12, 'every decoded frame matches its source (worst channel error ' + worst + ' of 255: palette rounding only)');
  const ng = decodeGif(Buffer.from(synth.nbytes));
  T.ok(ng.frames.length === 1 && maxDiff(ng.frames[0].rgba, synth.nsrc) < 90, 'a noisy frame (table fills and resets) still decodes to its full pixel count; identical frames merge into one with a longer delay (delay ' + ng.delays[0] + ')');
  const sizeRatio = gb.length / (120 * 80 * 6 * 3);
  T.ok(sizeRatio < 0.8, 'compresses: ' + gb.length + ' bytes for 6 frames (' + Math.round(sizeRatio * 100) + '% of raw RGB)');
  const play = await p.evaluate(async bytes => {
    const data = new Uint8Array(bytes), out = {};
    const img = new Image(); img.src = URL.createObjectURL(new Blob([data], { type: 'image/gif' })); await img.decode(); out.img = [img.naturalWidth, img.naturalHeight];
    if (window.ImageDecoder) { const dec = new ImageDecoder({ data, type: 'image/gif' }); await dec.tracks.ready; const t = dec.tracks.selectedTrack; out.frames = t.frameCount; out.animated = t.animated; out.repeat = t.repetitionCount; const f = await dec.decode({ frameIndex: 5 }); out.f5 = [f.image.displayWidth, f.image.displayHeight]; }
    return out;
  }, synth.bytes);
  T.ok(play.img[0] === 120 && play.img[1] === 80, 'the browser loads it as an image (' + play.img.join('×') + ')');
  T.ok(play.frames === 6 && play.animated === true, 'the browser reports ' + play.frames + ' frames, animated=' + play.animated + ', repeat=' + play.repeat);

  console.log('Recording a run');
  await p.evaluate(() => Lab.pages.go('run')); await p.waitForTimeout(300);
  T.ok(await p.locator('.tl-bar .tl-replay').isDisabled() && await p.locator('.tl-bar .tl-gif').isDisabled(), 'before a run both buttons are disabled');
  T.ok(/Run it to record/.test(await p.locator('.tl-status').innerText()), 'status invites a run');
  const timing = await p.evaluate(() => { const r = Lab.timelapse.all()[0]; const t0 = performance.now(); for (let i = 0; i < 20; i++) r.capture(); return (performance.now() - t0) / 20; });
  T.ok(timing < 8, 'one capture (downscale + JPEG encode kickoff) takes ' + timing.toFixed(1) + ' ms on the main thread');
  await p.evaluate(() => Lab.timelapse.all()[0].clear()); await p.waitForTimeout(100);
  await p.click('#run');
  await p.waitForTimeout(900);
  T.ok(/Recording… \d+ frame/.test(await p.locator('.tl-status').innerText()), 'while running the status says "Recording… n frames" (not colour alone)');
  await p.waitForFunction(() => document.getElementById('state').textContent === 'Done', null, { timeout: 30000 });
  await p.waitForFunction(() => /Timelapse ready/.test(document.querySelector('.tl-status').textContent), null, { timeout: 8000 });
  const st = await p.evaluate(() => { const r = Lab.timelapse.all()[0]; return { n: r.count, fps: r.fps, w: r.width, h: r.height, bytes: r.bytes, persisted: r.persisted, blob: r.frames[0].type }; });
  T.ok(st.n >= 20, `${st.n} frames recorded`);
  T.ok(st.w === 360 && st.h === 216, 'downscaled to 360 px wide (' + st.w + '×' + st.h + ')');
  T.ok(st.blob === 'image/jpeg' && st.bytes < 2e6, 'kept as small JPEGs: ' + Math.round(st.bytes / 1024) + ' KB in memory');
  T.ok(st.persisted === true, 'and saved to IndexedDB');
  T.ok(await p.locator('.tl-replay').isEnabled() && await p.locator('.tl-gif').isEnabled(), 'buttons enable');
  T.ok(await p.evaluate(() => !!localStorage.getItem('aplab:lab98:tl:cells')), 'marker aplab:lab98:tl:cells ties the run to this student');
  T.ok(await p.locator('#tl-include').count() === 1, 'the report tools offer "Include my timelapse in the report"');

  console.log('Replay modal');
  await p.click('.tl-replay');
  const dlg = p.locator('.tl-card');
  await dlg.waitFor();
  T.ok(await dlg.getAttribute('role') === 'dialog' && await dlg.getAttribute('aria-modal') === 'true', 'role=dialog, aria-modal');
  T.ok(await p.evaluate(() => document.querySelector('main').hasAttribute('inert')), 'page behind is inert');
  T.ok(await p.locator('.tl-scrub').getAttribute('max') === String(st.n - 1) && await p.locator('.tl-play').count() === 1 && await p.locator('.tl-speed').count() === 1, 'play/pause, scrubber (one stop per frame) and speed');
  const speeds = await p.locator('.tl-speed option').allInnerTexts();
  T.ok(speeds.join() === '10× speed,15× speed,20× speed', 'speeds ' + speeds.join(' / '));
  const hash = async () => p.evaluate(() => { const c = document.querySelector('.tl-canvas'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let h = 0; for (let i = 0; i < d.length; i += 97) h = (h * 31 + d[i]) | 0; return h; });
  const first = await hash();
  T.ok(await p.evaluate(() => { const c = document.querySelector('.tl-canvas'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let nz = 0; for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] > 0) nz++; return nz > 1000; }), 'frame 1 is drawn');
  await p.locator('.tl-scrub').evaluate((el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }, String(Math.floor(st.n / 2)));
  await p.waitForTimeout(150);
  T.ok(await hash() !== first && /Frame \d+ of \d+/.test(await p.locator('.tl-pos').innerText()), 'dragging the scrubber shows another frame: ' + (await p.locator('.tl-pos').innerText()));
  if (OUT) await p.screenshot({ path: OUT + '/t44-replay-modal.png' });
  await p.locator('.tl-scrub').evaluate(el => { el.value = 0; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await p.selectOption('.tl-speed', '20');
  const pos0 = await p.evaluate(() => Lab.timelapse.all()[0]._modal.pos);
  await p.evaluate(() => Lab.timelapse.all()[0]._modal.setPlay(true));
  await p.waitForTimeout(350);
  const pos1 = await p.evaluate(() => Lab.timelapse.all()[0]._modal.pos);
  const rate = (pos1 - pos0) / 0.35;
  T.ok(rate > st.fps * 20 * 0.5 || pos1 >= st.n - 1, `playing at 20× advances about ${Math.round(st.fps * 20)} frames per second (measured ~${Math.round(rate)}, ${pos1.toFixed(0)}/${st.n})`);
  await p.click('.tl-play').catch(() => {});
  const label = (await p.locator('.tl-play').innerText()).trim();
  T.ok(/^(Play|Replay)$/.test(label) || label === 'Pause', 'the play button reads "' + label + '"');
  await p.evaluate(() => Lab.timelapse.all()[0]._modal.setPlay(false)); await p.waitForTimeout(100);
  const pa = await p.evaluate(() => Lab.timelapse.all()[0]._modal.pos); await p.waitForTimeout(250);
  T.ok(await p.evaluate(() => Lab.timelapse.all()[0]._modal.pos) === pa, 'paused stays put');
  // tab trap
  let leaked = false; for (let i = 0; i < 12; i++) { await p.keyboard.press('Tab'); if (!await p.evaluate(() => !!document.activeElement.closest('.tl-card'))) leaked = true; }
  T.ok(!leaked, 'Tab stays inside the player');
  await p.keyboard.press('Escape');
  T.ok(await p.locator('.tl-modal').count() === 0 && !await p.evaluate(() => document.querySelector('main').hasAttribute('inert')), 'Esc closes it and the page is live again');
  T.ok(await p.evaluate(() => document.activeElement.classList.contains('tl-replay')), 'focus returns to "Replay my run"');

  console.log('GIF download');
  const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 60000 }), p.click('.tl-gif')]);
  const gifPath = await dl.path(); const gbuf = fs.readFileSync(gifPath);
  T.ok(/_cell-run_timelapse\.gif$/.test(dl.suggestedFilename()), 'file name ' + dl.suggestedFilename());
  const g2 = decodeGif(gbuf);
  T.ok(g2.sig === 'GIF89a' && g2.W === 360 && g2.H === 216 && g2.trailer, 'GIF89a, 360×216, trailer');
  T.ok(g2.frames.length >= 8, 'multiple frames (' + g2.frames.length + ' stored from ' + st.n + ' recorded)');
  const distinct = new Set(g2.frames.map(f => f.rgba.reduce((h, v, i) => (i % 4093 === 0 ? (h * 31 + v) | 0 : h), 0))).size;
  T.ok(distinct > 4, 'the frames differ (it is a real animation): ' + distinct + ' distinct');
  T.ok(g2.delays.every(d => d >= 3), 'every delay ≥ 3/100 s so browsers do not slow it to 10/100 s (min ' + Math.min(...g2.delays) + ')');
  const total = g2.delays.reduce((a, c) => a + c, 0) / 100, real = st.n / st.fps;
  T.ok(total > real / 15 * 0.5 && total < real / 15 * 3 + 2, `about 15× speed: ${real.toFixed(1)} s of run → ${total.toFixed(1)} s GIF`);
  T.ok(gbuf.length < 3e6, 'size ' + Math.round(gbuf.length / 1024) + ' KB');
  const play2 = await p.evaluate(async bytes => { const data = new Uint8Array(bytes); const dec = new ImageDecoder({ data, type: 'image/gif' }); await dec.tracks.ready; return { n: dec.tracks.selectedTrack.frameCount, anim: dec.tracks.selectedTrack.animated }; }, Array.from(gbuf));
  T.ok(play2.n === g2.frames.length && play2.anim, 'Chromium decodes all ' + play2.n + ' frames of it');
  if (OUT) { fs.copyFileSync(gifPath, OUT + '/t44-timelapse.gif'); const q = await ctx.newPage(); await q.setContent(`<body style="margin:0"><img src="data:image/gif;base64,${gbuf.toString('base64')}"></body>`); await q.waitForTimeout(600); await q.screenshot({ path: OUT + '/t44-gif-frame.png', clip: { x: 0, y: 0, width: 360, height: 216 } }); await q.close(); }

  console.log('Survives a reload, erased with the student');
  await p.reload(); await p.waitForTimeout(1200);
  await p.evaluate(() => Lab.pages.go('run')); await p.waitForTimeout(300);
  T.ok(await p.locator('.tl-replay').isEnabled() && /Timelapse ready/.test(await p.locator('.tl-status').innerText()), 'after a reload the run is back and "Replay my run" works');
  await p.click('.tl-replay'); await p.locator('.tl-card').waitFor(); await p.waitForTimeout(200);
  T.ok(await p.locator('.tl-card').isVisible(), 'replay opens from the restored frames');
  await p.keyboard.press('Escape');
  await p.evaluate(() => Lab.data.wipe(() => false)); // what Sign out does to storage
  await p.reload(); await p.waitForTimeout(1200);
  await p.evaluate(() => Lab.pages.go('run')); await p.waitForTimeout(300);
  T.ok(await p.evaluate(() => Lab.timelapse.all()[0].count) === 0 && await p.locator('.tl-replay').isDisabled(), 'after the erase the recorded run is gone');
  T.ok(await p.evaluate(async () => { try { const dbs = await indexedDB.databases(); return !dbs.some(d => d.name === 'aplab-timelapse' && false); } catch (e) { return true; } }), 'no leftover error');
  T.ok(p.errors.length === 0, 'no console errors ' + p.errors.join('|'));
  await ctx.close();

  console.log('Long runs are decimated, not cut off');
  ctx = await T.ctxFor(b);
  p = await T.open(ctx, FIX + '?max=16', '', srv.url);
  await p.evaluate(() => Lab.pages.go('run')); await p.waitForTimeout(300);
  await p.click('#run');
  await p.waitForFunction(() => document.getElementById('state').textContent === 'Done', null, { timeout: 30000 });
  await p.waitForTimeout(500);
  const dec = await p.evaluate(() => { const r = Lab.timelapse.all()[0]; return { n: r.count, fps: r.fps }; });
  T.ok(dec.n <= 16 && dec.n >= 6 && dec.fps < 8, `maxFrames 16: ${dec.n} frames kept at an effective ${dec.fps} fps, spanning the whole run`);

  console.log('.docx option');
  ctx = await T.ctxFor(b);
  p = await T.open(ctx, FIX, '', srv.url);
  await p.evaluate(() => Lab.pages.go('run')); await p.waitForTimeout(300);
  T.ok(await p.locator('.tl-include').isHidden(), 'the checkbox is hidden until there is a run');
  await p.click('#run');
  await p.waitForFunction(() => document.getElementById('state').textContent === 'Done', null, { timeout: 30000 });
  await p.waitForTimeout(800);
  await p.evaluate(() => Lab.pages.go('submit')); await p.waitForTimeout(300);
  T.ok(await p.locator('.tl-include').isVisible() && /Include my timelapse in the report/.test(await p.locator('.tl-include').innerText()), 'a recorded run shows "Include my timelapse in the report"');
  const readDocx = async () => { const [d] = await Promise.all([p.waitForEvent('download', { timeout: 90000 }), p.getByRole('button', { name: 'Download .docx' }).click()]); return JSZip.loadAsync(fs.readFileSync(await d.path())); };
  let zip = await readDocx();
  T.ok(!Object.keys(zip.files).some(n => /\.gif$/.test(n)), 'unchecked: no GIF in the report');
  await p.locator('#tl-include').check();
  zip = await readDocx();
  const gifName = Object.keys(zip.files).find(n => /^word\/media\/.*\.gif$/.test(n));
  T.ok(!!gifName, 'checked: the .docx carries a GIF (' + gifName + ')');
  const dg = decodeGif(Buffer.from(await zip.file(gifName).async('uint8array')));
  T.ok(dg.sig === 'GIF89a' && dg.frames.length >= 4 && dg.W === 320, `a looping GIF89a with ${dg.frames.length} frames at ${dg.W}×${dg.H}`);
  const body = await zip.file('word/document.xml').async('string');
  T.ok(/My timelapse/.test(body) && /<a:blip /.test(body), 'under a "My timelapse" heading');
  await p.reload(); await p.waitForTimeout(1000);
  await p.evaluate(() => Lab.pages.go('submit')); await p.waitForTimeout(300);
  T.ok(await p.locator('#tl-include').isChecked(), 'the choice is remembered');
  T.ok(p.errors.length === 0, 'no console errors ' + p.errors.join('|'));
  await ctx.close();

  console.log('Reduced motion: the replay waits for Play');
  ctx = await T.ctxFor(b, { reduced: true });
  p = await T.open(ctx, FIX, '', srv.url);
  await p.evaluate(() => Lab.pages.go('run')); await p.waitForTimeout(300);
  await p.click('#run');
  await p.waitForFunction(() => document.getElementById('state').textContent === 'Done', null, { timeout: 30000 });
  await p.waitForTimeout(800);
  await p.click('.tl-replay'); await p.locator('.tl-card').waitFor(); await p.waitForTimeout(500);
  T.ok(await p.evaluate(() => Lab.timelapse.all()[0]._modal.pos) === 0 && await p.locator('.tl-play').innerText() === 'Play', 'starts paused on frame 1');
  await ctx.close();

  console.log('Phone width');
  ctx = await T.ctxFor(b, { width: 400, height: 800, dark: true });
  p = await T.open(ctx, FIX, '', srv.url);
  await p.evaluate(() => Lab.pages.go('run')); await p.waitForTimeout(300);
  await p.click('#run');
  await p.waitForFunction(() => document.getElementById('state').textContent === 'Done', null, { timeout: 30000 });
  await p.waitForTimeout(800);
  await p.click('.tl-replay'); await p.locator('.tl-card').waitFor(); await p.waitForTimeout(400);
  const fit = await p.evaluate(() => { const r = document.querySelector('.tl-card').getBoundingClientRect(); return { ok: r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight, over: document.documentElement.scrollWidth - innerWidth }; });
  T.ok(fit.ok && fit.over <= 0, 'the player fits a 400 px dark phone screen');
  if (OUT) await p.screenshot({ path: OUT + '/t44-replay-400-dark.png' });
  await ctx.close();

  await b.close(); srv.close();
  T.done('t44-timelapse');
})();
