#!/usr/bin/env node
/* Test runner for CI and local use. Runs a chosen list of tests, each in its own Node process with a time limit,
   retries the known timing-flaky tests once, prints a summary and exits non-zero if anything failed.

   node tests/run-all.js checklist            the release-checklist set from tests/README.md (what CI runs on push / PR)
   node tests/run-all.js all                  every tests/t*.js file
   node tests/run-all.js core e2e             named groups (see GROUPS below); several may be given
   node tests/run-all.js t05-progress "t59-a11y resp"    single tests, with arguments after the file name
   node tests/run-all.js --list checklist     print what would run, run nothing
   node tests/run-all.js all --shard 2/4      run the 2nd quarter of the list (CI splits the full suite this way)

   Environment:
     JOBS=n          tests run at once (default 1; CI uses 2 for the short tests)
     TEST_TIMEOUT=s  default per-test limit in seconds (default 900; the long suites have their own, larger limits)
     RETRY=all       retry ANY failing test once (default: only the known flaky ones, FLAKY below); RETRY=0 never retries
     NODE_PATH, AXE  passed through. If NODE_PATH is unset the runner uses ./node_modules (after `npm ci`) or the global modules. */
const path = require('path'), fs = require('fs'), { spawn, execSync } = require('child_process');
const DIR = __dirname, ROOT = path.resolve(DIR, '..');

/* Timing-flaky under load: retried once before they count as failed. */
const FLAKY = ['t26-persist-labs1-7', 't21-labs1-7-personal', 't21-transfer', 't05-progress', 't05b-teachers', 't35-lab13-persist', 't35-nudge'];

/* Long suites: their own time limits, in seconds. */
const LIMITS = { 't59-a11y': 3600, 't59-science': 1800, 't59-e2e': 1500, 't59-perf': 900, 't36-lab9-stain': 600, 't60-browsers': 1500 };

/* Groups. CI runs each group as its own job. "checklist" is the union of the groups CI runs on every push. */
const GROUPS = {
  // README release checklist steps 1, 3 and 4 (minus the long suites, which get their own groups)
  core: ['t05-progress', 't30-dataset-id', 't23-dashboard', 't26-persist-labs1-7', 't30-lab9-persist', 't31-lab8-persist', 't32-lab10-persist',
    't33-lab11-persist', 't34-lab12-persist', 't35-lab13-persist', 't49-keyresults', 't21-transfer', 't48-tables', 't04-charts',
    't50-phone', 't25-theme', 't39-colorblind', 't58-dataset-owner', 't60-legacy-owner'],
  e2e: ['t59-e2e'],
  science: ['t59-science'],
  'a11y-axe': ['t59-a11y axe'],
  'a11y-keys': ['t59-a11y keys'],
  'a11y-resp': ['t59-a11y resp'],
};
GROUPS.a11y = [...GROUPS['a11y-axe'], ...GROUPS['a11y-keys'], ...GROUPS['a11y-resp']];
GROUPS.checklist = [...GROUPS.core, ...GROUPS.e2e, ...GROUPS.science, ...GROUPS.a11y];
const HELPERS = new Set(['t59-drive', 't59-lib']);   // modules used by other tests, not tests themselves
GROUPS.all = fs.readdirSync(DIR).filter(f => /^t\d.*\.js$/.test(f)).map(f => f.replace(/\.js$/, '')).filter(n => !HELPERS.has(n)).sort()
  .flatMap(n => n === 't59-a11y' ? GROUPS.a11y : [n]);   // the three a11y parts run as separate tests so shards can split them

function nodePath() {
  if (process.env.NODE_PATH) return process.env.NODE_PATH;
  if (fs.existsSync(path.join(ROOT, 'node_modules/playwright'))) return path.join(ROOT, 'node_modules');
  try { return execSync('npm root -g').toString().trim(); } catch (e) { return ''; }
}
function axe() {
  if (process.env.AXE) return process.env.AXE;
  const f = path.join(ROOT, 'node_modules/axe-core/axe.min.js');
  return fs.existsSync(f) ? f : '';
}

function expand(args) {
  const out = [];
  for (const a of args) {
    if (GROUPS[a]) out.push(...GROUPS[a]);
    else out.push(a.replace(/\.js(\s|$)/, '$1'));
  }
  return [...new Set(out)];
}

function runOne(spec, env) {
  const [name, ...args] = spec.split(/\s+/);
  const file = path.join(DIR, name + '.js');
  const limit = (LIMITS[name] || +process.env.TEST_TIMEOUT || 900) * 1000;
  return new Promise(resolve => {
    if (!fs.existsSync(file)) return resolve({ code: 2, out: `no such test: ${file}\n`, ms: 0, timedOut: false });
    const t0 = Date.now(); let out = '', timedOut = false;
    const ch = spawn(process.execPath, [file, ...args], { cwd: ROOT, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
    ch.stdout.on('data', d => { out += d; }); ch.stderr.on('data', d => { out += d; });
    const timer = setTimeout(() => { timedOut = true; try { process.kill(-ch.pid, 'SIGKILL'); } catch (e) { ch.kill('SIGKILL'); } }, limit);
    ch.on('close', code => { clearTimeout(timer); resolve({ code: timedOut ? 124 : code, out, ms: Date.now() - t0, timedOut }); });
  });
}

const fmt = ms => ms >= 60000 ? `${Math.floor(ms / 60000)}m${String(Math.round(ms / 1000) % 60).padStart(2, '0')}s` : `${(ms / 1000).toFixed(1)}s`;
const summaryLine = out => (out.match(/^[^\n]*: \d+\/\d+ checks passed$/m) || [''])[0];

(async () => {
  let argv = process.argv.slice(2); const listOnly = argv.includes('--list');
  let shard = null; const si = argv.indexOf('--shard');
  if (si >= 0) { const m = /^(\d+)\/(\d+)$/.exec(argv[si + 1] || ''); if (!m) { console.error('--shard needs i/n, e.g. 1/4'); process.exit(2); } shard = [+m[1], +m[2]]; argv.splice(si, 2); }
  argv = argv.filter(a => a !== '--list');
  let specs = expand(argv.length ? argv : ['checklist']);
  /* Shards: the long suites go first, then the rest round-robin, so each shard gets a similar share of the time. */
  if (shard) { const long = specs.filter(s => LIMITS[s.split(/\s+/)[0]]), rest = specs.filter(s => !LIMITS[s.split(/\s+/)[0]]); specs = [...long, ...rest].filter((s, i) => i % shard[1] === shard[0] - 1); }
  if (listOnly) { console.log(specs.join('\n')); return; }
  const env = Object.assign({}, process.env, { NODE_PATH: nodePath() });
  const ax = axe(); if (ax) env.AXE = ax;
  const jobs = Math.max(1, +process.env.JOBS || 1);
  const retryMode = process.env.RETRY || 'flaky';
  const canRetry = name => retryMode === 'all' || (retryMode !== '0' && FLAKY.includes(name));
  console.log(`Running ${specs.length} test(s), ${jobs} at a time. NODE_PATH=${env.NODE_PATH}${env.AXE ? '  AXE=' + env.AXE : ''}  BROWSER=${env.BROWSER || 'chromium'}\n`);
  const results = []; let next = 0;
  async function worker() {
    while (next < specs.length) {
      const spec = specs[next++], name = spec.split(/\s+/)[0];
      let r = await runOne(spec, env), retried = false, first = null;
      if (r.code !== 0 && canRetry(name)) {
        console.log(`-- ${spec}: failed (${r.timedOut ? 'timed out' : 'exit ' + r.code}) in ${fmt(r.ms)}; retrying once`);
        first = r; retried = true; r = await runOne(spec, env);
      }
      const pass = r.code === 0;
      results.push({ spec, pass, retried, ms: r.ms + (first ? first.ms : 0), timedOut: r.timedOut, line: summaryLine(r.out) });
      const tag = pass ? (retried ? 'PASS (after retry)' : 'PASS') : (r.timedOut ? 'FAIL (timed out)' : 'FAIL');
      console.log(`== ${tag.padEnd(18)} ${spec.padEnd(28)} ${fmt(r.ms).padStart(7)}  ${summaryLine(r.out)}`);
      if (!pass || process.env.VERBOSE) {
        if (first) console.log(`---- first attempt output (${spec}) ----\n` + first.out.split('\n').filter(l => /FAIL|Error|error/.test(l)).slice(0, 40).join('\n'));
        console.log(`---- output (${spec}) ----\n${r.out.trimEnd()}\n---- end ----`);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(jobs, specs.length) }, worker));
  const failed = results.filter(r => !r.pass), retried = results.filter(r => r.pass && r.retried);
  console.log('\n================ Summary ================');
  for (const r of results) console.log(`${r.pass ? 'pass' : 'FAIL'}${r.retried ? '*' : ' '} ${r.spec.padEnd(28)} ${fmt(r.ms).padStart(7)}  ${r.line}`);
  console.log(`\n${results.length - failed.length}/${results.length} tests passed.`);
  if (retried.length) console.log(`Passed only after a retry (timing-flaky): ${retried.map(r => r.spec).join(', ')}`);
  if (failed.length) console.log(`FAILED: ${failed.map(r => r.spec).join(', ')}`);
  if (process.env.GITHUB_STEP_SUMMARY) {
    const md = ['| Test | Result | Time | Checks |', '|---|---|---|---|', ...results.map(r => `| \`${r.spec}\` | ${r.pass ? (r.retried ? 'pass after retry' : 'pass') : (r.timedOut ? '**FAIL (timed out)**' : '**FAIL**')} | ${fmt(r.ms)} | ${r.line.replace(/^.*: /, '')} |`)];
    try { fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md.join('\n') + '\n'); } catch (e) { /* ignore */ }
  }
  process.exitCode = failed.length ? 1 : 0;
})();
