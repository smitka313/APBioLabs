/*
 * scope.js — procedural bright-field microscope optics for AP Bio Digital Lab Bench pages.   Global: Scope
 * ------------------------------------------------------------------------------------------------
 * No photos, no external images, no network. Works on its own; load it after lab.js.
 *
 * HOW IT WORKS
 *   A slide is rendered ONCE (per slide, per focal layer) into an offscreen canvas at up to
 *   `maxRes` device pixels per base unit, and a small blur pyramid is precomputed from it by
 *   repeated half-size downscale/upscale passes (no ctx.filter, so Safari/iPad behave).
 *   Each frame only composites: lamp → specimen layers (pan crop, focus cross-fade between
 *   pyramid levels, multiplied onto the lamp) → page overlay (marks) → grain → eyepiece frame → HUD.
 *   Lamp, frame (field stop, vignette, chromatic fringe, dust motes, pointer) and grain are
 *   pre-rendered whenever the canvas changes size. Panning or focusing never re-renders the slide.
 *
 * COORDINATES
 *   "Base units": the canvas is viewW × viewH units wide (default 640 × 480) whatever its CSS size.
 *   The slide ("world") is world.w × world.h units; pan = top-left of the view in world units.
 *
 * Scope.view(canvas, opts) → view
 *   opts.aspect      canvas height ÷ width (default 0.75)
 *   opts.viewW/viewH base units across the canvas (default 640 × 480)
 *   opts.field       {x, y, r} field-stop circle in view units (default {x:320, y:240, r:226})
 *   opts.world       {w, h} slide size in base units (default = view size, i.e. no panning)
 *   opts.layers      [{z}] focal planes. z = focus offset of that plane as a fraction of knob travel
 *                    (0 = main plane, 0.05 = slightly deeper, 0.2 = far out of focus). Default [{z:0}].
 *   opts.render(ctx, layerIndex, view)  draws ONE layer in world units onto an opaque white slide.
 *                    Use absorbing (transmitted-light) colours: each layer is MULTIPLIED onto the lamp,
 *                    so white = clear glass and overlapping layers darken like stacked tissue.
 *   opts.overlay(ctx, view)  optional; called every frame in world units, normal compositing,
 *                    clipped visually by the field stop (use for marks and answer-key outlines).
 *   opts.hud         {mag: string | () => string, bar: {units, label}} camera-style overlay,
 *                    or a function(ctx, view) drawing in view units.
 *   opts.onClick(x, y, event)  a click (pointer moved < 5 CSS px) at world coordinates.
 *   opts.controls    element to put the focus knob in (default: a new div inserted after the canvas)
 *   opts.focusLabel  knob label (default 'Focus')
 *   opts.seed        seed for frame irregularity, dust motes and best-focus point (default random)
 *   opts.maxRes      max offscreen device pixels per base unit (default 1.5)
 *   view.setSpecimen({render, layers, world, seed, refocus = true, recenter = true})  new slide;
 *                    refocus picks a new best-focus point near the knob centre and sets the knob
 *                    slightly off it (students must focus).
 *   view.redraw()    composite again (rAF-throttled); call after marks change or on theme change.
 *   view.pan         {x, y}; view.setPan(x, y); view.panBy(dx, dy, animate); view.center(animate)
 *   view.toWorld(clientX, clientY) → {x, y}   (accounts for pan and canvas CSS scale)
 *   view.focus       {value, best}; view.setFocus(v); view.blurOf(layerIndex) → 0…3
 *   view.canvas, view.focusInput, view.hint, view.controls   (also reachable as canvas.scopeView)
 *   Created elements: #<canvasId>-focus (range 0–100), #<canvasId>-center (button),
 *   #<canvasId>-hint (description, linked by aria-describedby). The canvas gets tabindex=0;
 *   arrow keys pan (Shift = bigger steps). Drag (mouse/touch/pen) pans; a click still clicks.
 *
 * Scope.still(canvas, opts) → {redraw()}   one cropped micrograph (thumbnail), no frame/pan.
 *   opts.aspect, opts.viewW, opts.viewH (default 70 × 70), opts.render(ctx) in view units on white,
 *   opts.blur (0–3, default 0.3), opts.vignette (default true).
 *
 * Helpers: Scope.rng(seed) → {uniform, normal, int, chance}; Scope.pyramid(canvas, levels);
 *          Scope.bubble(ctx, x, y, r) (air bubble with dark refractive rim, for render callbacks);
 *          Scope.grainTile(size, seed); Scope.reducedMotion().
 *
 * Colours: the specimen, lamp, frame and HUD are physical images and use literal colours so they
 * look identical in light and dark themes. The injected control CSS uses theme tokens only.
 */
(function () {
  'use strict';
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const reducedMotion = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  function rng(seed) {
    let s = (seed == null ? Math.floor(Math.random() * 2 ** 31) : seed) >>> 0;
    const uniform = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const normal = (m = 0, sd = 1) => { let u = 0, v = 0; while (!u) u = uniform(); while (!v) v = uniform(); return m + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v); };
    return { uniform, normal, int: (a, b) => a + Math.floor(uniform() * (b - a + 1)), chance: p => uniform() < p };
  }
  function mk(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; }
  function smooth(x) { x.imageSmoothingEnabled = true; try { x.imageSmoothingQuality = 'high'; } catch (e) { /* older Safari */ } return x; }

  /* Blur pyramid: level 0 = the sharp canvas; level k = downscaled to 1/2^(k+1) by halving passes,
     then upscaled once to 1/2^k. Drawn back at full size with bilinear smoothing it reads as a
     Gaussian-like blur of roughly 2^k device pixels. */
  function pyramid(src, levels = 3) {
    const out = [{ c: src, s: 1 }], downs = [src]; let cur = src;
    for (let k = 1; k <= levels + 1; k++) { const d = mk(cur.width / 2, cur.height / 2); smooth(d.getContext('2d')).drawImage(cur, 0, 0, d.width, d.height); downs.push(d); cur = d; }
    for (let k = 1; k <= levels; k++) { const t = mk(downs[k].width, downs[k].height); smooth(t.getContext('2d')).drawImage(downs[k + 1], 0, 0, t.width, t.height); out.push({ c: t, s: t.width / src.width }); }
    return out;
  }
  function grainTile(size = 128, seed) {
    const R = rng(seed), c = mk(size, size), x = c.getContext('2d'), im = x.createImageData(size, size), d = im.data;
    for (let i = 0; i < d.length; i += 4) { const v = 128 + (R.uniform() + R.uniform() + R.uniform() - 1.5) * 70; d[i] = v + 4; d[i + 1] = v; d[i + 2] = v - 4; d[i + 3] = 255; }
    x.putImageData(im, 0, 0); return c;
  }
  /* Air bubble trapped under the cover slip: clear centre, thick dark refractive rim, faint bright halo. */
  function bubble(ctx, x, y, r) {
    const g = ctx.createRadialGradient(x - r * 0.08, y - r * 0.1, r * 0.1, x, y, r * 1.08);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.68, 'rgba(120,118,112,0.06)'); g.addColorStop(0.8, 'rgba(70,66,60,0.55)');
    g.addColorStop(0.9, 'rgba(35,32,28,0.92)'); g.addColorStop(0.965, 'rgba(60,56,50,0.6)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 1.08, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(40,38,34,0.35)'; ctx.lineWidth = Math.max(0.6, r * 0.015); ctx.beginPath(); ctx.arc(x + r * 0.03, y + r * 0.02, r * 0.62, 0, TAU); ctx.stroke();
  }

  /* ---------- control styling (tokens only; injected once) ---------- */
  let styled = false;
  function injectCSS() {
    if (styled) return; styled = true;
    const st = document.createElement('style');
    st.textContent = `.scope-canvas{touch-action:none;cursor:crosshair;-webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent}
.scope-canvas.is-panning{cursor:grabbing}
.scope-canvas:focus-visible{outline:3px solid var(--accent);outline-offset:2px}
.scope-ctl{display:flex;flex-wrap:wrap;align-items:center;gap:6px 12px;margin-top:8px;font-size:.9rem}
.scope-ctl label{font-weight:600;color:var(--ink);white-space:nowrap}
.scope-ctl input[type=range]{flex:1 1 140px;min-width:0;accent-color:var(--accent)}
.scope-ctl .scope-hint{flex:1 1 100%;margin:0;color:var(--muted);font-size:.82rem}`;
    document.head.appendChild(st);
  }

  /* ---------- eyepiece pieces, pre-rendered at device size ---------- */
  function edgeShape(R) {
    const h = [3, 5, 7, 11, 17].map((f, i) => ({ f, a: [0.006, 0.004, 0.003, 0.002, 0.0012][i] * (0.6 + R.uniform() * 0.8), p: R.uniform() * TAU }));
    return th => 1 + h.reduce((s, q) => s + q.a * Math.sin(q.f * th + q.p), 0);
  }
  function buildLamp(W, H, f, R) {
    const c = mk(W, H), x = c.getContext('2d');
    x.fillStyle = 'rgb(236,214,176)'; x.fillRect(0, 0, W, H);
    const g = x.createRadialGradient(f.x - f.r * 0.14, f.y - f.r * 0.18, f.r * 0.04, f.x, f.y, f.r * 1.04);
    g.addColorStop(0, 'rgb(255,252,243)'); g.addColorStop(0.5, 'rgb(252,243,224)'); g.addColorStop(0.85, 'rgb(243,226,195)'); g.addColorStop(1, 'rgb(229,205,166)');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    for (let i = 0; i < 16; i++) {   // faintly uneven illumination (condenser dirt, slide thickness)
      const a = R.uniform() * TAU, d = Math.sqrt(R.uniform()) * f.r, rr = f.r * (0.15 + R.uniform() * 0.4), px = f.x + Math.cos(a) * d, py = f.y + Math.sin(a) * d;
      const b = x.createRadialGradient(px, py, 0, px, py, rr), warm = R.chance(0.5);
      b.addColorStop(0, warm ? 'rgba(214,176,124,0.075)' : 'rgba(255,255,255,0.11)'); b.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = b; x.fillRect(px - rr, py - rr, rr * 2, rr * 2);
    }
    return c;
  }
  function buildFrame(W, H, f, sc, R, shape) {
    const c = mk(W, H), x = c.getContext('2d');
    // vignette: warm darkening toward the field stop
    const v = x.createRadialGradient(f.x, f.y, f.r * 0.5, f.x, f.y, f.r);
    v.addColorStop(0, 'rgba(60,35,10,0)'); v.addColorStop(0.75, 'rgba(60,35,10,0.10)'); v.addColorStop(1, 'rgba(45,25,8,0.42)');
    x.fillStyle = v; x.fillRect(0, 0, W, H);
    // chromatic fringing at the edge of the field (blue inside, amber at the stop)
    const cf = x.createRadialGradient(f.x, f.y, f.r * 0.86, f.x, f.y, f.r * 1.01);
    cf.addColorStop(0, 'rgba(70,130,255,0)'); cf.addColorStop(0.55, 'rgba(70,130,255,0.09)'); cf.addColorStop(0.8, 'rgba(255,150,60,0.16)'); cf.addColorStop(1, 'rgba(40,20,5,0.35)');
    x.fillStyle = cf; x.fillRect(0, 0, W, H);
    // out-of-focus dust motes in the eyepiece (fixed: they do not move with the slide)
    const nm = 4 + Math.floor(R.uniform() * 3);
    for (let i = 0; i < nm; i++) {
      const a = R.uniform() * TAU, d = Math.sqrt(R.uniform()) * f.r * 0.85, rr = (5 + R.uniform() * 12) * sc, px = f.x + Math.cos(a) * d, py = f.y + Math.sin(a) * d;
      const g = x.createRadialGradient(px, py, 0, px, py, rr);
      g.addColorStop(0, 'rgba(80,70,60,0.035)'); g.addColorStop(0.62, 'rgba(80,70,60,0.07)'); g.addColorStop(0.84, 'rgba(55,45,35,0.15)'); g.addColorStop(1, 'rgba(55,45,35,0)');
      x.fillStyle = g; x.beginPath(); x.arc(px, py, rr, 0, TAU); x.fill();
    }
    // eyepiece pointer: thin tapered dark line entering from the right
    const pa = -0.32, base = f.r * 1.05, tip = f.r * 0.5, bw = 1.6 * sc;
    const ux = Math.cos(pa), uy = Math.sin(pa), nx = -uy, ny = ux;
    x.fillStyle = 'rgba(14,11,8,0.88)'; x.beginPath();
    x.moveTo(f.x + ux * base + nx * bw, f.y + uy * base + ny * bw); x.lineTo(f.x + ux * tip, f.y + uy * tip); x.lineTo(f.x + ux * base - nx * bw, f.y + uy * base - ny * bw); x.closePath(); x.fill();
    // field stop: black surround with a soft, slightly irregular edge (mask built small, blurred up)
    const q = 4, m = mk(W / q, H / q), mx = m.getContext('2d');
    mx.fillStyle = '#000'; mx.fillRect(0, 0, m.width, m.height); mx.globalCompositeOperation = 'destination-out'; mx.beginPath();
    for (let i = 0; i <= 180; i++) { const th = i / 180 * TAU, rr = f.r * shape(th) / q; const px = f.x / q + Math.cos(th) * rr, py = f.y / q + Math.sin(th) * rr; i ? mx.lineTo(px, py) : mx.moveTo(px, py); }
    mx.fill();
    const lv = pyramid(m, 1)[1].c;
    smooth(x).drawImage(lv, 0, 0, W, H);
    x.drawImage(m, 0, 0, W, H);   // keep the far surround solid black
    x.globalCompositeOperation = 'source-over';
    return c;
  }
  function buildGrain(W, H, seed) {
    const c = mk(W, H), x = c.getContext('2d'); x.fillStyle = x.createPattern(grainTile(128, seed), 'repeat'); x.fillRect(0, 0, W, H); return c;
  }
  function supports(ctx, op) { const old = ctx.globalCompositeOperation; ctx.globalCompositeOperation = op; const ok = ctx.globalCompositeOperation === op; ctx.globalCompositeOperation = old; return ok; }

  function drawHud(ctx, hud, sc) {
    ctx.save(); ctx.scale(sc, sc);
    ctx.shadowColor = 'rgba(0,0,0,0.75)'; ctx.shadowBlur = 3; ctx.shadowOffsetY = 1;
    ctx.fillStyle = 'rgba(255,255,255,0.94)'; ctx.font = '600 17px "JetBrains Mono", ui-monospace, monospace'; ctx.textAlign = 'left';
    const mag = typeof hud.mag === 'function' ? hud.mag() : hud.mag; if (mag) ctx.fillText(mag, 18, 32);
    if (hud.bar) {
      const b = hud.bar.units, x1 = 612, x0 = x1 - b, y = 454;
      ctx.fillRect(x0, y - 2, b, 4); ctx.fillRect(x0, y - 7, 1.6, 14); ctx.fillRect(x1 - 1.6, y - 7, 1.6, 14);
      ctx.textAlign = 'right'; ctx.font = '600 15px "JetBrains Mono", ui-monospace, monospace'; ctx.fillText(hud.bar.label, x1, y - 12);
    }
    ctx.restore();
  }

  /* =========================== Scope.view =========================== */
  function view(canvas, opts) {
    if (typeof canvas === 'string') canvas = document.querySelector(canvas);
    injectCSS();
    const o = Object.assign({ aspect: 0.75, viewW: 640, viewH: 480, field: { x: 320, y: 240, r: 226 }, layers: [{ z: 0 }], maxRes: 1.5, focusLabel: 'Focus' }, opts || {});
    o.world = o.world || { w: o.viewW, h: o.viewH };
    const ctx = canvas.getContext('2d'), R0 = rng(o.seed), frameSeed = R0.int(1, 1e9);
    const shape = edgeShape(rng(frameSeed));
    const canMultiply = supports(ctx, 'multiply'), canOverlay = supports(ctx, 'overlay');
    canvas.classList.add('scope-canvas'); canvas.tabIndex = 0;
    const id = canvas.id || ('scope' + frameSeed);

    // controls: focus knob, centre button, description
    const box = o.controls || document.createElement('div'); box.classList.add('scope-ctl');
    if (!o.controls) canvas.insertAdjacentElement('afterend', box);
    box.innerHTML = `<label for="${id}-focus">${o.focusLabel}</label><input type="range" id="${id}-focus" min="0" max="100" step="0.5" value="50" aria-describedby="${id}-hint"><button type="button" class="btn btn--sm btn--ghost" id="${id}-center">Center slide</button><p class="scope-hint" id="${id}-hint">Turn the focus knob until the specimen is sharp. Drag the slide to move it, or select the view and use the arrow keys.</p>`;
    const knob = box.querySelector('input'), hint = box.querySelector('.scope-hint');
    const prevDesc = canvas.getAttribute('aria-describedby'); canvas.setAttribute('aria-describedby', (prevDesc ? prevDesc + ' ' : '') + id + '-hint');

    let W = 0, H = 0, cssW = 0, dpr = 1, sc = 1, lamp = null, frame = null, grain = null, temp = null, tctx = null;
    let res = 1, levels = [], pan = { x: 0, y: 0 }, best = 50, raf = 0, rerenderT = 0, anim = 0;
    const maxPan = () => ({ x: Math.max(0, o.world.w - o.viewW), y: Math.max(0, o.world.h - o.viewH) });

    function wantRes() { return clamp((cssW / o.viewW) * dpr, 0.75, o.maxRes); }
    function size() {
      cssW = Math.max(200, canvas.clientWidth || (canvas.parentElement && canvas.parentElement.clientWidth) || 640);
      const cssH = Math.round(cssW * o.aspect); dpr = window.devicePixelRatio || 1;
      W = Math.round(cssW * dpr); H = Math.round(cssH * dpr); canvas.width = W; canvas.height = H; canvas.style.height = cssH + 'px';
      sc = W / o.viewW;
      const f = { x: o.field.x * sc, y: o.field.y * sc, r: o.field.r * sc };
      lamp = buildLamp(W, H, f, rng(frameSeed + 1)); frame = buildFrame(W, H, f, sc, rng(frameSeed + 2), shape); grain = buildGrain(W, H, frameSeed + 3);
      temp = mk(W, H); tctx = smooth(temp.getContext('2d'));
    }
    function renderSpecimen() {
      res = wantRes();
      const px = o.world.w * o.world.h * res * res * o.layers.length; if (px > 7e6) res *= Math.sqrt(7e6 / px);
      levels = o.layers.map((L, i) => {
        const c = mk(o.world.w * res, o.world.h * res), x = c.getContext('2d');
        x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.setTransform(res, 0, 0, res, 0, 0);
        x.lineCap = 'round'; x.lineJoin = 'round';
        if (o.render) { try { o.render(x, i, api); } catch (e) { console.error(e); } }
        return pyramid(c, 3);
      });
    }
    function blurOf(i) { const L = o.layers[i] || { z: 0 }; return clamp(Math.abs(+knob.value - (best + L.z * 100)) / 6, 0, 3); }
    function crop(img, s, alpha) {
      const k = s * res, sw = o.viewW * k, sh = o.viewH * k; let sx = pan.x * k, sy = pan.y * k;
      sx = clamp(sx, 0, Math.max(0, img.width - 1)); sy = clamp(sy, 0, Math.max(0, img.height - 1));
      const w = Math.min(sw, img.width - sx), h = Math.min(sh, img.height - sy); if (w <= 0 || h <= 0) return;
      tctx.globalAlpha = alpha; tctx.drawImage(img, sx, sy, w, h, 0, 0, w / sw * W, h / sh * H);
    }
    function composite() {
      raf = 0; if (!W) return;
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(lamp, 0, 0);
      levels.forEach((lv, i) => {
        // pyramid steps are in device pixels; shift by resolution so blur looks the same at any canvas size
        const raw = blurOf(i), b = raw < 0.05 ? 0 : clamp(raw + Math.log2(res / 1.25), 0, 3), k = Math.min(3, Math.floor(b)), fr = b - k;
        tctx.globalAlpha = 1; tctx.fillStyle = '#fff'; tctx.fillRect(0, 0, W, H);
        crop(lv[k].c, lv[k].s, 1); if (fr > 0.02 && k < 3) crop(lv[k + 1].c, lv[k + 1].s, fr);
        tctx.globalAlpha = 1;
        if (canMultiply) { ctx.globalCompositeOperation = 'multiply'; ctx.drawImage(temp, 0, 0); }
        else { ctx.globalAlpha = i ? 0.5 : 1; ctx.drawImage(temp, 0, 0); ctx.globalAlpha = 0.14; ctx.drawImage(lamp, 0, 0); ctx.globalAlpha = 1; }
        ctx.globalCompositeOperation = 'source-over';
      });
      if (o.overlay) { ctx.save(); ctx.setTransform(sc, 0, 0, sc, -pan.x * sc, -pan.y * sc); try { o.overlay(ctx, api); } catch (e) { console.error(e); } ctx.restore(); }
      if (canOverlay) { ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = 0.16; ctx.drawImage(grain, 0, 0); }
      else { ctx.globalAlpha = 0.04; ctx.drawImage(grain, 0, 0); }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(frame, 0, 0);
      if (typeof o.hud === 'function') { ctx.save(); ctx.scale(sc, sc); o.hud(ctx, api); ctx.restore(); } else if (o.hud) drawHud(ctx, o.hud, sc);
    }
    function redraw() { if (!raf) raf = requestAnimationFrame(composite); }
    function sharpText() { const b = blurOf(0); return b < 0.3 ? 'sharp' : b < 1 ? 'slightly soft' : b < 2 ? 'blurry' : 'very blurry'; }
    function syncKnob() { knob.setAttribute('aria-valuetext', `${(+knob.value).toFixed(1)}: ${sharpText()}`); }
    function setPan(x, y) { const m = maxPan(); pan.x = clamp(x, 0, m.x); pan.y = clamp(y, 0, m.y); redraw(); }
    function glide(tx, ty, animate) {
      cancelAnimationFrame(anim); const m = maxPan(); tx = clamp(tx, 0, m.x); ty = clamp(ty, 0, m.y);
      if (!animate || reducedMotion()) { setPan(tx, ty); return; }
      const fx = pan.x, fy = pan.y, t0 = performance.now(), dur = 180;
      const step = t => { const e = Math.min(1, (t - t0) / dur), q = 1 - (1 - e) * (1 - e); setPan(fx + (tx - fx) * q, fy + (ty - fy) * q); if (e < 1) anim = requestAnimationFrame(step); };
      anim = requestAnimationFrame(step);
    }
    function center(animate) { const m = maxPan(); glide(m.x / 2, m.y / 2, animate); }
    function toWorld(cx, cy) { const r = canvas.getBoundingClientRect(), k = o.viewW / r.width; return { x: (cx - r.left) * k + pan.x, y: (cy - r.top) * k + pan.y }; }
    function refocus(seed) {
      const R = rng(seed); best = 50 + (R.uniform() - 0.5) * 30;
      const off = (6.5 + R.uniform() * 4.5) * (R.chance(0.5) ? 1 : -1); let v = best + off; if (v < 2 || v > 98) v = best - off;
      knob.value = String(Math.round(v * 2) / 2); syncKnob();
    }
    function setSpecimen(s = {}) {
      if (s.render) o.render = s.render; if (s.layers) o.layers = s.layers; if (s.world) o.world = s.world;
      if (s.refocus !== false) refocus(s.seed != null ? s.seed + 17 : undefined);
      if (s.recenter !== false) { const m = maxPan(); pan.x = m.x / 2; pan.y = m.y / 2; }
      renderSpecimen(); syncKnob(); redraw();
    }

    // pointer: drag pans, a short press is a click
    let ptr = null;
    canvas.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (ptr) { ptr.multi = true; return; }
      ptr = { id: e.pointerId, x: e.clientX, y: e.clientY, px: pan.x, py: pan.y, drag: false };
      try { canvas.setPointerCapture(e.pointerId); } catch (er) { /* ignore */ }
    });
    canvas.addEventListener('pointermove', e => {
      if (!ptr || e.pointerId !== ptr.id) return;
      const dx = e.clientX - ptr.x, dy = e.clientY - ptr.y;
      if (!ptr.drag && Math.hypot(dx, dy) > 5) { ptr.drag = true; canvas.classList.add('is-panning'); cancelAnimationFrame(anim); }
      if (ptr.drag) { const k = o.viewW / canvas.getBoundingClientRect().width; setPan(ptr.px - dx * k, ptr.py - dy * k); e.preventDefault(); }
    });
    const up = e => {
      if (!ptr || e.pointerId !== ptr.id) return; const p = ptr; ptr = null; canvas.classList.remove('is-panning');
      if (e.type === 'pointerup' && !p.drag && !p.multi && o.onClick) { const w = toWorld(e.clientX, e.clientY); o.onClick(w.x, w.y, e); }
    };
    canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('keydown', e => {
      const st = e.shiftKey ? 72 : 24, d = { ArrowLeft: [-st, 0], ArrowRight: [st, 0], ArrowUp: [0, -st], ArrowDown: [0, st] }[e.key];
      if (!d) return; e.preventDefault(); glide(pan.x + d[0], pan.y + d[1], true);
    });
    knob.addEventListener('input', () => { syncKnob(); redraw(); });
    box.querySelector('button').addEventListener('click', () => center(true));

    const api = {
      canvas, controls: box, focusInput: knob, hint, setSpecimen, redraw, setPan, center, toWorld, blurOf,
      panBy: (dx, dy, animate) => glide(pan.x + dx, pan.y + dy, animate),
      setFocus: v => { knob.value = String(clamp(v, 0, 100)); syncKnob(); redraw(); },
      get pan() { return { x: pan.x, y: pan.y }; },
      get focus() { return { value: +knob.value, best }; },
      get world() { return o.world; }, get viewW() { return o.viewW; }, get viewH() { return o.viewH; }
    };
    canvas.scopeView = api;   // for tests and page scripts (not a DOM attribute)
    size(); center(false); refocus(frameSeed + 5);
    if (o.render) renderSpecimen();
    redraw();
    if ('ResizeObserver' in window) new ResizeObserver(() => {
      const pw = canvas.clientWidth; if (!pw || Math.abs(pw - cssW) <= 1) return;
      size(); redraw();
      if (Math.abs(wantRes() - res) / res > 0.3) { clearTimeout(rerenderT); rerenderT = setTimeout(() => { renderSpecimen(); redraw(); }, 250); }
    }).observe(canvas);
    return api;
  }

  /* =========================== Scope.still =========================== */
  function still(canvas, opts) {
    const o = Object.assign({ aspect: 1, viewW: 70, viewH: 70, blur: 0.3, vignette: true }, opts || {});
    const ctx = canvas.getContext('2d'); let cssW = 0;
    function draw() {
      cssW = Math.max(40, canvas.clientWidth || (canvas.parentElement && canvas.parentElement.clientWidth) || 100);
      const dpr = window.devicePixelRatio || 1, cssH = Math.round(cssW * o.aspect), W = Math.round(cssW * dpr), H = Math.round(cssH * dpr);
      canvas.width = W; canvas.height = H; canvas.style.height = cssH + 'px';
      const sc = W / o.viewW, spec = mk(W, H), sx = spec.getContext('2d');
      sx.fillStyle = '#fff'; sx.fillRect(0, 0, W, H); sx.setTransform(sc, 0, 0, sc, 0, 0); sx.lineCap = 'round'; sx.lineJoin = 'round';
      if (o.render) o.render(sx, sc);
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      const g = ctx.createRadialGradient(W * 0.42, H * 0.38, 0, W / 2, H / 2, Math.hypot(W, H) * 0.62);
      g.addColorStop(0, 'rgb(255,251,240)'); g.addColorStop(1, 'rgb(232,210,172)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      let img = spec;
      if (o.blur > 0) { const p = pyramid(spec, 1), t = mk(W, H), tx = smooth(t.getContext('2d')); tx.drawImage(spec, 0, 0); tx.globalAlpha = Math.min(1, o.blur); tx.drawImage(p[1].c, 0, 0, W, H); img = t; }
      if (supports(ctx, 'multiply')) ctx.globalCompositeOperation = 'multiply';
      ctx.drawImage(img, 0, 0); ctx.globalCompositeOperation = 'source-over';
      if (supports(ctx, 'overlay')) { ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = 0.16; ctx.fillStyle = ctx.createPattern(grainTile(96, 7), 'repeat'); ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
      if (o.vignette) { const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.hypot(W, H) * 0.56); v.addColorStop(0, 'rgba(50,30,10,0)'); v.addColorStop(1, 'rgba(50,30,10,0.35)'); ctx.fillStyle = v; ctx.fillRect(0, 0, W, H); }
    }
    draw();
    if ('ResizeObserver' in window) { const ro = new ResizeObserver(() => { if (!canvas.isConnected) { ro.disconnect(); return; } const pw = canvas.clientWidth; if (pw && Math.abs(pw - cssW) > 1) draw(); }); ro.observe(canvas); }
    return { redraw: draw };
  }

  window.Scope = { view, still, rng, pyramid, bubble, grainTile, reducedMotion };
})();
