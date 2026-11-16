#!/usr/bin/env node
/* Conservative PR classifier. Unknown changes always run the full checklist. */
const fs = require('fs');
const cp = require('child_process');
const base = process.argv[2], head = process.argv[3] || 'HEAD';
if (!base) { console.error('Missing base SHA'); process.exit(2); }
const diff = cp.execFileSync('git', ['diff', '--no-ext-diff', '--unified=0', base, head, '--'], { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
const files = [];
let file = null;
for (const line of diff.split('\n')) {
  if (line.startsWith('diff --git ')) {
    const m = /^diff --git a\/(.+) b\/(.+)$/.exec(line);
    if (!m || m[1] !== m[2]) { file = null; files.push({ path: '', lines: ['?'] }); continue; }
    file = { path: m[2], lines: [] }; files.push(file);
  } else if (file && /^[+-]/.test(line) && !/^(---|\+\+\+)/.test(line)) file.lines.push(line.slice(1));
}
let level = 'quick';
const rank = { quick: 0, standard: 1, full: 2 };
const bump = x => { if (rank[x] > rank[level]) level = x; };
for (const f of files) {
  const p = f.path, lines = f.lines;
  if (!p) { bump('full'); continue; }
  if (/^(docs\/|.*\.(md|txt)$)/.test(p)) continue;
  if (p === 'style.css' || /\.css$/.test(p)) { bump('standard'); continue; }
  if (/^lab\d\d\.html$/.test(p)) {
    // Only prose inside plain HTML elements; any structural or script change is full.
    if (lines.length && lines.every(x => /^\s*<(p|li|h[1-6]|span)\b[^>]*>[^<>]*<\/(p|li|h[1-6]|span)>\s*$/.test(x))) bump('quick');
    else bump('full');
    continue;
  }
  if (p === 'lab.js') {
    // A shared JS file is high risk unless every changed line is one approved tour copy field.
    if (lines.length && lines.every(x => /^\s*(body|plain): '[^']*',?\s*$/.test(x))) bump('quick');
    else bump('full');
    continue;
  }
  bump('full');
}
if (!files.length) level = 'full';
console.log('Risk level:', level, 'Files:', files.map(f => f.path).join(', '));
if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, 'level=' + level + '\n');
