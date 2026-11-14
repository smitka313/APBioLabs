#!/usr/bin/env node
/* Encrypts the private teacher-notes pages into password-protected pages for the public site.
   The plaintext sources are NOT stored in this repository.

   Usage:  NOTES_PASSWORD='…' node tools/encrypt-notes.js <source-folder> <output-folder>

   Each <source>/<name>.html becomes <output>/<name>.html: a small page that asks for the password,
   derives a key with PBKDF2-SHA256 (310,000 iterations), decrypts the page with AES-256-GCM in the
   browser (Web Crypto), and replaces itself with the decrypted page. Without the password the
   published file contains only ciphertext.
   The password form says plainly that this is page encryption, not a school login. The password is kept
   (sessionStorage 'tn-pw', this tab only) only when "Keep unlocked in this tab" is ticked, so a teacher
   can move between the linked notes pages; it is off by default. Every unlocked page gets a "Lock notes"
   button that forgets the password and shows the form again. Test: tests/t58-notes-lock.js. */
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const [src, out] = process.argv.slice(2);
const pw = process.env.NOTES_PASSWORD;
if (!src || !out || !pw) { console.error('Usage: NOTES_PASSWORD=… node tools/encrypt-notes.js <src> <out>'); process.exit(1); }
const ITER = 310000;
const CONTACT = 'rsmitka@roseville.k12.mi.us';

function encrypt(text) {
  const salt = crypto.randomBytes(16), iv = crypto.randomBytes(12);
  const key = crypto.pbkdf2Sync(pw, salt, ITER, 32, 'sha256');
  const c = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([c.update(text, 'utf8'), c.final(), c.getAuthTag()]);
  return { s: salt.toString('base64'), i: iv.toString('base64'), c: ct.toString('base64'), n: ITER };
}

function shell(title, payload) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex">
<title>${title}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700&family=Source+Sans+3:wght@400;600&display=swap">
<style>
:root { --bg:#f3f6f4; --surface:#fff; --ink:#14211c; --muted:#56665f; --line:#cfd9d3; --accent:#0d6e55; --accent-ink:#fff; --bad:#b3261e;
  padding-top: env(safe-area-inset-top, 0px); padding-bottom: env(safe-area-inset-bottom, 0px); }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --bg:#0f1613; --surface:#17211d; --ink:#e4ece8; --muted:#9db0a7; --line:#2f3d37; --accent:#4cc39b; --accent-ink:#06231a; --bad:#f2867f; color-scheme: dark; } }
:root[data-theme="dark"] { --bg:#0f1613; --surface:#17211d; --ink:#e4ece8; --muted:#9db0a7; --line:#2f3d37; --accent:#4cc39b; --accent-ink:#06231a; --bad:#f2867f; color-scheme: dark; }
*, *::before, *::after { box-sizing: border-box; }
body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: var(--bg); color: var(--ink);
  font: 17px/1.5 "Source Sans 3", "Segoe UI", system-ui, sans-serif;
  padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); padding-block: 24px; }
.card { width: 100%; max-width: 440px; background: var(--surface); border: 1px solid var(--line); border-radius: 14px; padding: 28px; display: grid; gap: 14px; }
h1 { font-family: "Bricolage Grotesque", "Segoe UI", sans-serif; font-size: 1.6rem; margin: 0; line-height: 1.15; }
p { margin: 0; color: var(--muted); font-size: .95rem; }
label { font-weight: 600; font-size: .9rem; }
input { font: inherit; width: 100%; padding: 9px 12px; border: 1px solid var(--line); border-radius: 8px; background: var(--surface); color: var(--ink); }
button { font: inherit; font-weight: 600; padding: 9px 14px; border-radius: 8px; border: 1px solid var(--accent); background: var(--accent); color: var(--accent-ink); cursor: pointer; }
:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }
.err { color: var(--bad); font-size: .9rem; min-height: 1.2em; }
.contact { user-select: all; font-weight: 600; color: var(--ink); }
a { color: var(--accent); }
.row { display: flex; gap: 8px; }
.row input { flex: 1; min-width: 0; }
.keep { display: flex; gap: 8px; align-items: flex-start; font-weight: 400; margin-top: 10px; }
.keep input { width: auto; margin: 4px 0 0; accent-color: var(--accent); }
.keep small { display: block; color: var(--muted); font-size: .85rem; }
.honest { border-left: 3px solid var(--line); padding-left: 10px; }
</style>
</head>
<body>
<main class="card">
  <h1>Teacher notes</h1>
  <p>These notes include answer keys, so they are password protected.</p>
  <form id="f" autocomplete="off">
    <label for="pw">Password</label>
    <div class="row"><input id="pw" type="password" autocomplete="current-password" required><button type="submit">Unlock</button></div>
    <label class="keep" for="keep"><input id="keep" type="checkbox"><span>Keep unlocked in this tab<small>So you can move between notes pages without typing the password again. Leave it off on a shared computer.</small></span></label>
  </form>
  <div class="err" id="err" role="alert"></div>
  <p class="honest">These notes are encrypted in the page, not behind a school login. Anyone with the password can open them.</p>
  <p>Teachers can request the password by emailing <a href="mailto:${CONTACT}?subject=AP%20Bio%20Digital%20Lab%20Bench%20teacher%20notes"><span class="contact">${CONTACT}</span></a>.</p>
  <p><a href="index.html">Back to the labs</a></p>
</main>
<script>
const P = ${JSON.stringify(payload)};
const b64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
async function unlock(pw) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: b64(P.s), iterations: P.n, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64(P.i) }, key, b64(P.c));
  return new TextDecoder().decode(pt);
}
/* The password is kept (sessionStorage 'tn-pw', this tab only) only when "Keep unlocked in this tab" is ticked.
   "Lock notes" forgets it and reloads, which shows this form again. */
function lock() { try { sessionStorage.removeItem('tn-pw'); } catch (x) {} location.reload(); }
function show(html) {
  document.open(); document.write(html); document.close();
  const add = () => {
    if (document.getElementById('tn-lock') || !document.body) return;
    const st = document.createElement('style');
    st.textContent = '#tn-lock{position:fixed;right:max(16px,env(safe-area-inset-right,0px));bottom:max(16px,env(safe-area-inset-bottom,0px));z-index:2147483000;font:600 15px/1.2 "Source Sans 3","Segoe UI",system-ui,sans-serif;padding:9px 14px;border-radius:999px;border:1px solid #0d6e55;background:#0d6e55;color:#fff;cursor:pointer;box-shadow:0 2px 10px rgba(0,0,0,.25)}#tn-lock:hover{background:#0a5743}#tn-lock:focus-visible{outline:3px solid #4cc39b;outline-offset:2px}@media print{#tn-lock{display:none!important}}';
    const b = document.createElement('button');
    b.id = 'tn-lock'; b.type = 'button'; b.textContent = 'Lock notes'; b.title = 'Forget the password in this tab and close the notes';
    b.addEventListener('click', lock);
    document.head.append(st); document.body.append(b);
  };
  add(); if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', add);
}
const err = document.getElementById('err');
document.getElementById('f').addEventListener('submit', async e => {
  e.preventDefault(); err.textContent = 'Checking…';
  const pw = document.getElementById('pw').value, keep = document.getElementById('keep').checked;
  try {
    const html = await unlock(pw);
    try { if (keep) sessionStorage.setItem('tn-pw', pw); else sessionStorage.removeItem('tn-pw'); } catch (x) {}
    show(html);
  }
  catch (x) { err.textContent = window.crypto && crypto.subtle ? 'That password is not correct.' : 'This browser cannot unlock the notes. Open the page over https in a current browser.'; }
});
(async () => { let pw = null; try { pw = sessionStorage.getItem('tn-pw'); } catch (x) {}
  if (pw) { try { show(await unlock(pw)); } catch (x) { try { sessionStorage.removeItem('tn-pw'); } catch (y) {} } } })();
</script>
</body>
</html>
`;
}

fs.mkdirSync(out, { recursive: true });
let n = 0;
for (const f of fs.readdirSync(src).filter(f => f.endsWith('.html'))) {
  const html = fs.readFileSync(path.join(src, f), 'utf8');
  const title = (html.match(/<title>([^<]*)<\/title>/) || [, 'Teacher notes'])[1];
  fs.writeFileSync(path.join(out, f), shell(title, encrypt(html)));
  n++;
}
console.log(`Encrypted ${n} page(s) into ${out}`);
