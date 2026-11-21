#!/usr/bin/env node
/* Conservative PR classifier. Unknown/shared changes always run the full checklist. */
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
const rank = { quick: 0, ui: 1, standard: 2, full: 3 };
const bump = x => { if (rank[x] > rank[level]) level = x; };
for (const f of files) {
  const p = f.path, lines = f.lines;
  if (!p) { bump('full'); continue; }
  if (/^(docs\/|.*\.(md|txt)$)/.test(p)) continue;
  if (p === 'style.css' || /\.css$/.test(p)) { bump('standard'); continue; }
  if (/^lab\d\d\.html$/.test(p)) {
    // Never classify changes to inline scripts or styles as copy/UI changes.
    const read = ref => cp.execFileSync('git', ['show', ref + ':' + p], { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
    let before, after;
    try { before = read(base); after = read(head); } catch (_) { bump('full'); continue; }
    const blocks = html => [...html.matchAll(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi)].map(m => m[0]);
    if (JSON.stringify(blocks(before)) !== JSON.stringify(blocks(after))) { bump('full'); continue; }
    const allowed = /^(?:p|li|h[1-6]|span|strong|em|b|i|small|sub|sup|ol|ul|div|details|summary|a)$/i;
    const unsafe = /\bon\w+\s*=|javascript:|\$\{|<\/?(?:script|style|iframe|form|input|button|select|textarea|canvas|svg)\b/i;
    const classifyLine = x => {
      if (unsafe.test(x)) return 'full';
      const tags = [...x.matchAll(/<\/?([a-z][\w-]*)\b([^>]*)>/gi)];
      if (tags.some(m => !allowed.test(m[1]) || /\b(?:style|src|contenteditable|tabindex|autofocus)\s*=/.test(m[2]))) return 'full';
      if (/<|>/.test(x.replace(/<\/?[a-z][\w-]*\b[^>]*>/gi, ''))) return 'full';
      if (tags.some(m => /^(?:details|summary|div|ol|ul|a)$/i.test(m[1]))) return 'ui';
      return 'quick';
    };
    if (!lines.length) bump('full');
    else for (const line of lines) bump(classifyLine(line));
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
// These companions own their scripts/styles and saved-work keys. Their dedicated browser
// job checks gameplay, persistence, resets, and exports. Shared toolkit or CI edits stay full.
const opensciedFiles = new Set([
  'openscied-dashboard.html', 'openscied-dashboard.js',
  'openscied-b3-cell-cycle.html', 'openscied-b3-cell-cycle.css', 'openscied-b3-cell-cycle.js',
  'openscied-b3-dna-p53.html', 'openscied-b3-dna-p53.css', 'openscied-b3-dna-p53.js', 'openscied-b3-dna-p53-logic.js',
  'openscied-b3-inheritance-environment.html', 'openscied-b3-inheritance-environment.css', 'openscied-b3-inheritance-environment.js', 'openscied-b3-inheritance-logic.js',
  'openscied-b2-fires.html', 'openscied-b2-fires.css', 'openscied-b2-fires.js', 'openscied-b2-fires-logic.js', 'matter-energy-scene.js', 'decomposition-scene.js', 'tilt-scene.js',
  'openscied-b2-peat-bog-lab.html', 'openscied-b2-peat-bog-lab.css', 'openscied-b2-peat-bog-lab.js', 'openscied-b2-peat-bog-logic.js',
  'pedigree-scene.js', 'two-gene-scene.js', 'meiosis-scene.js', 'skin-data-scene.js', 'investigation-planner-scene.js', 'yeast-uv-scene.js', 'yeast-uv-scene.css', 'pedigree-scene.css',
  'dna-replication-scene.js', 'dna-replication-scene.css', 'gene-expression-scene.js', 'gene-expression-scene.css',
  'cell-cycle-scene.js', 'cell-cycle-scene.css',
  'growth-cell-types.js', 'growth-model-scene.js', 'growth-model-scene.css',
  'assets/openscied-banner.jpg', 'assets/openscied-phenomena-hero.svg',
  'tests/t76-cell-cycle-controls.js', 'tests/t77-openscied-dashboard.js', 'tests/t78-cell-cycle-audit.js',
  'tests/openscied-dashboard.test.js', 'tests/cell-cycle-scene.test.js', 'tests/openscied-b3-dna-p53-logic.test.js', 'tests/openscied-b3-inheritance-logic.test.js', 'tests/pedigree-scenes.test.js', 'tests/openscied-b3-meiosis-skin-logic.test.js', 'tests/openscied-b3-planner-yeast.test.js', 'tests/openscied-b2-fires-logic.test.js', 'tests/openscied-b2-peat-bog-logic.test.js'
]);
const documentation = p => /^(docs\/|.*\.(md|txt)$)/.test(p);
// Any test file that opens only OpenSciEd pages (same rule as the "openscied" group in tests/run-all.js).
const isOpensciedTest = p => {
  if (!/^tests\/[^/]+\.js$/.test(p)) return false;
  let src = '';
  try { src = cp.execFileSync('git', ['show', head + ':' + p], { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }); } catch (_) { return false; }
  return /openscied-|cell-cycle/.test(src) && !/lab\d\d\.html|\bLABS\b/.test(src);
};

const isOpenscied = p => opensciedFiles.has(p) || isOpensciedTest(p);
if (files.some(f => isOpenscied(f.path)) &&
    files.every(f => isOpenscied(f.path) || documentation(f.path))) level = 'openscied';
console.log('Risk level:', level, 'Files:', files.map(f => f.path).join(', '));
if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, 'level=' + level + '\n');
