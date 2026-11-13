/* Projector mode (projector.html + projector-data.js).
   Run: NODE_PATH=$(npm root -g) node tests/t37-projector.js */
const T = require('./_h');
const fs = require('fs'), path = require('path');
const { ok, done } = T;
const slugify = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const KEY = 'aplab:pref:projector';
const PAGES = 'https://smitka313.github.io/APBioLabs/';

(async () => {
  /* ---- 1. generated data vs the live lab pages ---- */
  console.log('data');
  global.window = {}; require('../projector-data.js'); const D = global.window.PROJECTOR_LABS;
  ok(D.length === 13 && D.every((l, i) => l.id === T.LABS[i] && l.n === i + 1), 'data covers labs 1-13 in order');
  let slugsOk = true, minsOk = true, titlesOk = true, dqOk = true, badSlug = '';
  for (const l of D) {
    const html = fs.readFileSync(path.join(T.ROOT, l.id + '.html'), 'utf8');
    const secs = [...html.matchAll(/<section class="step[^"]*"[^>]*data-step="([^"]+)"([^>]*)>/g)];
    const slugs = secs.map(m => slugify(m[1].replace(/&amp;/g, '&')));
    if (JSON.stringify(slugs) !== JSON.stringify(l.parts.map(p => p.slug))) { slugsOk = false; badSlug += ' ' + l.id; }
    if (secs.some((m, i) => (+(m[2].match(/data-minutes="(\d+)"/) || [])[1] || 0) !== l.parts[i].minutes)) minsOk = false;
    if (!l.title || html.indexOf('<h1>' + l.title.split(' ')[0]) < 0) titlesOk = false;
    if (!l.dq || l.dq.length < 15) dqOk = false;
  }
  ok(slugsOk, 'part slugs match every lab page' + badSlug);
  ok(minsOk, 'part minutes match data-minutes');
  ok(titlesOk, 'titles present'); ok(dqOk, 'driving questions present');
  ok(D.filter(l => l.safety.some(s => !s.virtual && s.items.length)).length === 11 && D.filter(l => !l.safety.some(s => !s.virtual)).map(l => l.n).join() === '2,3', 'real-bench safety text for 11 labs; labs 2 and 3 are computer-only');
  ok(D.every(l => l.parts.some(p => p.steps.length)), 'every lab has Lab.steps text for some part');
  ok(D[4].parts.find(p => p.slug === 'sink-disks').steps[0] === 'Add a drop of soap to each cup', 'lab 5 step text extracted');
  ok(D[8].parts.find(p => p.slug === 'run-a-gel').steps.length >= 3, 'lab 9 templated gel steps extracted');
  ok(D.every(l => l.parts.every(p => p.steps.every(s => s && !/[<>]|&\w+;/.test(s)))), 'step text is plain text');

  const b = await T.launch();
  const mk = o => T.ctxFor(b, Object.assign({ width: 1366, height: 768 }, o));
  const go = async (ctx, hash, base, clock) => {
    const p = await ctx.newPage(); p.errors = [];
    p.on('pageerror', e => p.errors.push(e.message));
    if (clock) await p.clock.install({ time: new Date('2026-01-05T09:00:00Z') });
    await p.goto((base || 'file://' + T.ROOT + '/') + 'projector.html' + (hash ? '#' + hash : ''));
    await p.waitForSelector('#lab option', { state: 'attached' });
    return p;
  };
  { /* the slugs in the data are the real section ids on the live lab pages (what labNN.html#slug scrolls to) */
    const c0 = await mk(); let bad = '';
    for (const l of D) { const lp = await T.open(c0, l.id + '.html'); const ids = await lp.evaluate(() => [...document.querySelectorAll('section.step')].map(s => s.id)); if (ids.join() !== l.parts.map(x => x.slug).join()) bad += ' ' + l.id; await lp.close(); }
    ok(!bad, 'data slugs equal the live section ids on all 13 lab pages' + bad); await c0.close();
  }
  const time = p => p.textContent('#time');
  const cls = p => p.evaluate(() => document.getElementById('timer').className.replace('box timer', '').trim());
  const stored = p => p.evaluate(k => JSON.parse(localStorage.getItem(k) || 'null'), KEY);
  /* choose exactly these parts: tick the wanted ones first, then untick the rest (the list never goes empty) */
  const pick = async (p, slugs) => { for (const s of slugs) if (!(await p.isChecked('#parts input[value="' + s + '"]'))) await p.check('#parts input[value="' + s + '"]'); for (const v of await p.locator('#parts input:checked').evaluateAll(l => l.map(x => x.value))) if (!slugs.includes(v)) await p.uncheck('#parts input[value="' + v + '"]'); };

  /* ---- 2. setup -> display ---- */
  console.log('setup and display');
  let ctx = await mk(); let p = await go(ctx, 'lab05');
  ok(await p.title() === 'Projector Mode — AP Bio Lab Bench', 'title');
  ok(await p.inputValue('#lab') === 'lab05', '#lab05 hash preselects the lab');
  ok(await p.locator('#lab option').count() === 13, 'lab picker has 13 labs');
  ok(await p.locator('#parts input').count() === D[4].parts.length, 'part list matches the lab');
  ok(/≈ 15 min/.test(await p.textContent('#parts')), 'parts show minute estimates');
  ok(await p.locator('#parts input:checked').count() === 1, 'one default part chosen');
  await p.check('#parts input[value="float-assay"]');
  await p.uncheck('#parts input[value="float-assay"]');
  await p.check('#parts input[value="float-assay"]');
  ok(await p.inputValue('#mins') === '40', 'timer defaults to the sum of chosen parts (15 + 25)');
  await p.fill('#notes', 'Due Friday: Part 3');
  await p.click('#start');
  ok(await p.isVisible('#display') && !(await p.isVisible('#setup')), 'Start shows the display');
  ok(await p.textContent('#d-title') === 'Photosynthesis' && /rate of photosynthesis/.test(await p.textContent('#d-dq')), 'lab title and driving question');
  ok((await p.locator('#d-chips .chipx').allTextContents()).join('|') === 'Sink disks15 min|Float assay25 min', 'chips for chosen parts, in lab order');
  ok(await p.locator('#d-steps li').count() === 4 && /soap/.test(await p.textContent('#d-steps li')), 'first 4 steps of the first chosen part');
  ok(/goggles/.test(await p.textContent('#d-safec')) && await p.locator('#d-safec li').count() >= 3, 'bench safety callouts shown');
  ok(await p.textContent('#d-notes') === 'Due Friday: Part 3', 'notes line shown');
  ok(/Sign in with your name and class on your laptop\./.test(await p.textContent('.signin')), 'sign-in note');
  ok(await time(p) === '40:00', 'timer starts at 40:00');
  ok(await p.evaluate(() => parseFloat(getComputedStyle(document.getElementById('time')).fontSize)) >= 90, 'timer type is huge at 1366');
  ok(await p.locator('#qr svg').count() === 1, 'QR drawn');
  await p.click('#b-setup'); await p.selectOption('#lab', 'lab02'); await p.click('#start');
  ok(/computer investigation/.test(await p.textContent('#d-safec')), 'computer-only lab says no bench hazards');
  ok(p.errors.length === 0, 'no page errors: ' + p.errors.join(';'));

  /* ---- 3. QR deep link ---- */
  console.log('QR');
  await p.click('#b-setup'); await p.selectOption('#lab', 'lab09');
  await pick(p, ['design-crime-scene', 'run-a-gel']);
  await p.click('#start');
  ok(await p.getAttribute('#qr', 'data-url') === PAGES + 'lab09.html#run-a-gel', 'file:// falls back to the GitHub Pages URL, first chosen part slug');
  ok(await p.textContent('#d-url') === 'smitka313.github.io/APBioLabs/lab09.html#run-a-gel', 'short URL printed under the QR');
  const same = await p.evaluate(() => { const q = qrcode(0, 'M'); q.addData(document.getElementById('qr').getAttribute('data-url')); q.make(); const n = q.getModuleCount(); let d = ''; for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += 'M' + (c + 2) + ' ' + (r + 2) + 'h1v1h-1z'; return document.querySelector('#qr path').getAttribute('d') === d; });
  ok(same, 'QR modules encode the deep-link URL');
  await p.close();
  const srv = await T.serve();
  p = await go(ctx, 'lab07', srv.url);
  await p.click('#start');
  const u = await p.getAttribute('#qr', 'data-url');
  ok(/^http:\/\/127\.0\.0\.1:\d+\/lab07\.html#[a-z0-9-]+$/.test(u) && u.startsWith(srv.url), 'hosted: URL built from location (' + u.replace(srv.url, '/') + ')');
  await p.close(); srv.close();

  /* ---- 4. timer with a fake clock ---- */
  console.log('timer');
  await ctx.close(); ctx = await mk();
  p = await go(ctx, 'lab05', null, true);
  await p.fill('#mins', '10'); await p.click('#start');
  ok(await time(p) === '10:00' && await cls(p) === '', 'ready at 10:00, normal color');
  await p.click('#t-go'); await p.clock.runFor(60000);
  ok(await time(p) === '9:00', 'counts down: 9:00 after 60 s');
  await p.clock.runFor(235000);
  ok(await time(p) === '5:05' && await cls(p) === '', 'still normal just above 5 min');
  await p.clock.runFor(6000);
  ok(await time(p) === '4:59' && await cls(p) === 'amber', 'amber under 5 min');
  await p.click('#t-go'); const frozen = await time(p); await p.clock.runFor(30000);
  ok(await time(p) === frozen && await p.textContent('#t-go') === 'Resume', 'pause holds the time');
  await p.click('#t-plus');
  ok(await time(p) === '9:59' && await cls(p) === '', '+5 min adds five minutes and clears amber');
  await p.click('#t-minus'); await p.click('#t-minus');
  ok(await time(p) === '0:00' && await cls(p) === 'red', '-5 min twice floors at 0:00 and turns red');
  await p.click('#t-plus'); await p.click('#t-go'); await p.clock.runFor(305000);
  ok(await time(p) === '0:00' && await cls(p) === 'red' && await p.textContent('#tstate') === "Time's up", "runs out to 0:00, red, Time's up");
  await p.click('#t-reset');
  ok(await time(p) === '10:00' && await cls(p) === '', 'reset returns to the set length');
  ok(await p.isChecked('#chime') === false, 'chime is off by default');
  await p.evaluate(() => { window.__beeps = 0; const O = window.AudioContext; window.AudioContext = function () { const c = new O(); const co = c.createOscillator.bind(c); c.createOscillator = () => { window.__beeps++; return co(); }; return c; }; });
  await p.click('#t-go'); await p.clock.runFor(601000);
  ok(await p.evaluate(() => window.__beeps) === 0, 'no sound while chime is off');
  await p.click('#t-reset'); await p.check('#chime');
  ok((await stored(p)).chime === true, 'chime setting saved');
  const b0 = await p.evaluate(() => window.__beeps);
  await p.click('#t-go'); await p.clock.runFor(601000);
  ok(await p.evaluate(() => window.__beeps) > b0, 'chime plays (Web Audio) when enabled');
  ok(p.errors.length === 0, 'no page errors: ' + p.errors.join(';'));

  /* ---- 5. persistence ---- */
  console.log('settings');
  await p.close(); await ctx.close(); ctx = await mk();
  p = await go(ctx, 'lab05');
  await pick(p, ['design']); await p.fill('#notes', 'Bring goggles'); await p.fill('#mins', '33');
  const s1 = await stored(p);
  ok(s1.lab === 'lab05' && s1.parts.join() === 'design' && s1.notes === 'Bring goggles' && s1.minutes === 33 && s1.auto === false, 'last setup stored in aplab:pref:projector');
  await p.goto('file://' + T.ROOT + '/projector.html'); await p.waitForSelector('#lab option', { state: 'attached' });
  ok(await p.inputValue('#lab') === 'lab05' && await p.isChecked('#parts input[value="design"]') && await p.inputValue('#notes') === 'Bring goggles' && await p.inputValue('#mins') === '33', 'reload restores lab, parts, notes and timer length');
  await p.goto('file://' + T.ROOT + '/projector.html#lab11'); await p.reload(); await p.waitForSelector('#lab option', { state: 'attached' });
  ok(await p.inputValue('#lab') === 'lab11' && await p.locator('#parts input:checked').count() === 1, 'hash lab overrides the stored lab and resets parts');
  await p.evaluate(() => localStorage.setItem('aplab:pref:projector', '{bad json'));
  await p.goto('file://' + T.ROOT + '/projector.html'); await p.reload(); await p.waitForSelector('#lab option', { state: 'attached' });
  ok(await p.locator('#parts input').count() > 0 && p.errors.length === 0, 'corrupt stored value is ignored');

  /* ---- 6. keyboard ---- */
  console.log('keyboard');
  await p.close(); p = await go(ctx, 'lab05', null, true);
  await p.fill('#mins', '3'); await p.click('#start'); await p.locator('#display').click({ position: { x: 5, y: 300 } });
  await p.keyboard.press('Space'); await p.clock.runFor(10000);
  ok(await time(p) === '2:50', 'Space starts the timer');
  await p.keyboard.press('Space'); await p.clock.runFor(10000);
  ok(await time(p) === '2:50', 'Space pauses the timer');
  await p.keyboard.press('f'); await p.waitForTimeout(300);
  const fs1 = await p.evaluate(() => !!document.fullscreenElement);
  await p.keyboard.press('F'); await p.waitForTimeout(300);
  ok(p.errors.length === 0, 'F toggles full screen without errors (entered: ' + fs1 + ')');
  await p.keyboard.press('Escape');
  ok(await p.isVisible('#setup') && !(await p.isVisible('#display')), 'Esc (outside full screen) returns to setup');
  await p.focus('#notes'); await p.keyboard.type('f x');
  ok((await p.inputValue('#notes')).endsWith('f x') && await p.isVisible('#setup'), 'typing in a field does not trigger shortcuts');
  await p.evaluate(() => { document.documentElement.requestFullscreen = () => Promise.reject(new Error('no')); document.documentElement.webkitRequestFullscreen = undefined; });
  await p.click('#start'); await p.click('#b-full'); await p.waitForTimeout(100);
  ok(p.errors.length === 0, 'rejected fullscreen request is handled');

  /* ---- 7. every lab renders; widths; dark ---- */
  console.log('all labs and layouts');
  for (const w of [1920, 1366, 400]) {
    await ctx.close(); ctx = await mk({ width: w, height: w > 1500 ? 1080 : 768, dark: w === 400 });
    p = await go(ctx, 'lab01'); let bad = '';
    for (let i = 1; i <= 13; i++) {
      await p.evaluate(() => { if (!document.getElementById('display').hidden) document.getElementById('b-setup').click(); });
      await p.selectOption('#lab', 'lab' + String(i).padStart(2, '0')); await p.click('#start');
      const r = await p.evaluate(() => ({ ov: document.documentElement.scrollWidth - innerWidth, t: document.getElementById('d-title').textContent, qr: !!document.querySelector('#qr svg'), steps: document.querySelectorAll('#d-steps li').length, safe: document.querySelectorAll('#d-safec li, #d-safec p').length, h: document.documentElement.scrollHeight }));
      if (r.ov > 0 || !r.t || !r.qr || !r.steps || !r.safe) bad += ` lab${i}:${JSON.stringify(r)}`;
      if (w === 1920 && r.h > 1080) bad += ` lab${i} taller than 1080 (${r.h})`;
    }
    ok(!bad, `all 13 labs render with no overflow at ${w}${w === 1920 ? ' and fit 1080 high' : ''}${bad}`);
    ok(p.errors.length === 0, 'no page errors at ' + w);
  }
  await b.close();
  done('t37-projector');
})().catch(e => { console.error(e); process.exit(1); });
