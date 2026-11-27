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

const localEvidence = {
  'openscied-b1-field-notebook.html': ['history timeline', 'animal movement exhibits', 'Herd movement', 'people station exhibits'],
  'openscied-b1-migration.html': ['health cards below'],
  'openscied-b3-inheritance-environment.html': ['on-page model of Lakita’s family'],
  'openscied-b5-wapusk.html': ['sightings map below', 'minimum-extent chart', 'ice region above'],
};
let localCount = 0;
for (const [file, tasks] of Object.entries(localEvidence)) {
  const src = fs.readFileSync(path.join(root, file), 'utf8');
  const alternatives = [...src.matchAll(/<p\b[^>]*\bdata-local-media-alternative(?=[\s>])[^>]*>([\s\S]*?)<\/p>/g)].map(([, body]) => body);
  assert.equal(alternatives.length, tasks.length, file + ' has a local alternative for each targeted viewing task');
  for (const [i, task] of tasks.entries()) {
    assert.ok(alternatives[i].includes(task), file + ' directs students to ' + task);
    assert.doesNotMatch(alternatives[i], /https?:|<iframe/i, 'the alternative does not need a third-party site or frame');
    assert.match(alternatives[i], /Continue without video/);
    localCount++;
  }
}
console.log('OpenSciEd video alternatives: ' + localCount + ' classroom tasks can use local evidence.');
