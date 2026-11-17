const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const code = fs.readFileSync(path.join(root, 'domain-redirect.js'), 'utf8');

function visit(url, keys = [], blocked = false, session = new Map()) {
  let redirected = null;
  const notices = [];
  const location = new URL(url);
  location.replace = target => { redirected = target; };
  const element = () => ({ style: {}, children: [], setAttribute() {}, appendChild(el) { this.children.push(el); } });
  const context = {
    URL, URLSearchParams, location,
    sessionStorage: { getItem: k => session.get(k), setItem: (k, v) => session.set(k, v) },
    localStorage: { get length() { if (blocked) throw Error('blocked'); return keys.length; }, key: i => keys[i] },
    document: { readyState: 'complete', createElement: element, body: { firstChild: null, insertBefore: el => notices.push(el) } }
  };
  vm.runInNewContext(code, context);
  return { redirected, notices, session };
}

test('old homepage, bare project path and lab links preserve paths, queries and hashes', () => {
  for (const [input, output] of [
    ['/APBioLabs', '/'], ['/APBioLabs/', '/'], ['/APBioLabs/index.html', '/index.html'],
    ['/APBioLabs/lab09.html?mode=projector#analysis', '/lab09.html?mode=projector#analysis'],
    ['/APBioLabs/lab05.html#resume=ABC_123.xyz', '/lab05.html#resume=ABC_123.xyz'],
    ['/APBioLabs/missing/page.html', '/missing/page.html'],
    ['/APBioLabs/%2Fexample.com', '/%2Fexample.com']
  ]) assert.equal(visit('https://smitka313.github.io' + input).redirected, 'https://biologylabbench.com' + output);
});

test('new domains, previews, local development and unrelated GitHub projects never redirect', () => {
  for (const url of ['https://biologylabbench.com/lab09.html', 'https://www.biologylabbench.com/',
    'https://apbiolabs.pages.dev/', 'http://localhost/APBioLabs/',
    'https://smitka313.github.io/ClassPulse/', 'https://smitka313.github.io/APBioLabsOther/',
    'https://smitka313.github.io.evil.example/APBioLabs/']) {
    const result = visit(url);
    assert.equal(result.redirected, null);
    assert.equal(result.notices.length, 0);
  }
});

test('saved work and unreadable storage stay accessible with an explicit migration link', () => {
  for (const [keys, blocked] of [[['aplab:lab09:field:cer'], false], [['aplab:backup:lab05'], false],
    [['aplab:progress:lab01'], false], [[], true]]) {
    const result = visit('https://smitka313.github.io/APBioLabs/lab09.html#analysis', keys, blocked);
    assert.equal(result.redirected, null);
    assert.equal(result.notices.length, 1);
    assert.equal(result.notices[0].children[1].href, 'https://biologylabbench.com/lab09.html#analysis');
    assert.match(result.notices[0].children[0].textContent, /progress file/);
  }
});

test('theme preferences alone do not hold a new visitor on the old site', () => {
  assert.equal(visit('https://smitka313.github.io/APBioLabs/', ['aplab:pref:theme']).redirected,
    'https://biologylabbench.com/');
});

test('legacy override stays for the tab and is removed from destination links', () => {
  const first = visit('https://smitka313.github.io/APBioLabs/?legacy=1&x=2#labs');
  assert.equal(first.redirected, null);
  assert.equal(first.notices[0].children[1].href, 'https://biologylabbench.com/?x=2#labs');
  assert.equal(visit('https://smitka313.github.io/APBioLabs/lab01.html', [], false, first.session).redirected, null);
});

test('every published HTML page loads the redirect before existing scripts; 404 works at nested paths', () => {
  for (const file of fs.readdirSync(root).filter(p => p.endsWith('.html'))) {
    const html = fs.readFileSync(path.join(root, file), 'utf8');
    if (file === '404.html') assert.ok(html.includes('<meta charset="utf-8">\n<script>\n' + code + '</script>'), file);
    else assert.ok(html.includes('<meta charset="utf-8">\n<script src="domain-redirect.js"></script>'), file);
  }
});
