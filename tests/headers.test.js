/* _headers must make browsers revalidate scripts, styles and pages: the JS/CSS names are not fingerprinted, so a stale cached
   copy next to fresh HTML breaks pages (seen on iOS Safari: blank DNA fork scene, unstyled choice cards).
   Run: node --test tests/headers.test.js */
const test = require('node:test'), assert = require('node:assert'), fs = require('fs'), path = require('path');
const text = fs.readFileSync(path.join(__dirname, '..', '_headers'), 'utf8');
const rules = {}; let cur = null;
text.split('\n').forEach(l => { if (/^\s*#/.test(l) || !l.trim()) return; if (/^\S/.test(l)) cur = rules[l.trim()] = []; else if (cur) cur.push(l.trim()); });
for (const pat of ['/*']) {  // one rule covers scripts, styles and pages served at clean (no .html) addresses
  test(pat + ' is revalidated on every visit', () => {
    assert.ok((rules[pat] || []).some(h => /^Cache-Control:\s*no-cache/i.test(h)), pat + ' needs Cache-Control: no-cache in _headers');
  });
}
