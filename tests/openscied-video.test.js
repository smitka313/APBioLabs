const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const pages = {
  'openscied-b1-migration.html': ['PGGslSmDlCI'],
  'openscied-b1-serengeti.html': ['6-ooaGN1lSk'],
  'openscied-b3-inheritance-environment.html': ['U1Zifbvvl0Q', 'ux7obpTlkbU', '-NhqJRIJJsw'],
};
for (const [file, clips] of Object.entries(pages)) {
  const src = fs.readFileSync(path.join(root, file), 'utf8');
  const players = [...src.matchAll(/<template>\s*<iframe\b([^>]+)>\s*<\/iframe>\s*<\/template>/g)];
  assert.equal(players.length, clips.length, file + ' has one on-page player per original video');
  for (const [i, [, attrs]] of players.entries()) {
    assert.ok(attrs.includes('https://www.youtube-nocookie.com/embed/' + clips[i] + '?cc_load_policy=1'), file + ' preserves video IDs, privacy-enhanced host and caption preference');
    assert.match(attrs, /title="[^"]+"/);
    assert.match(attrs, /allowfullscreen/);
    assert.match(attrs, /referrerpolicy="strict-origin-when-cross-origin"/);
    assert.doesNotMatch(attrs, /autoplay/);
    assert.ok(src.includes('https://youtu.be/' + clips[i] + '"'), file + ' keeps a fallback for blocked players');
  }
  assert.match(src, /<script defer src="openscied-video.js"><\/script>/);
}
console.log('OpenSciEd video markup: all five previously linked clips have optional embedded players.');
