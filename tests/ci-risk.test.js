/* Exercise the real classifier against small Git histories; no network/browser needed. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const classifier = path.resolve(__dirname, '../tools/classify-ci-risk.js');
function classify(files, mode) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'aplab-ci-routing-'));
  const git = args => execFileSync('git', args, { cwd: directory, encoding: 'utf8', stdio: ['ignore','pipe','pipe'] }).trim();
  try {
    git(['init', '-q']);
    git(['-c','user.name=CI Test','-c','user.email=ci-test@example.invalid','commit','--allow-empty','-qm','Base']);
    const base = git(['rev-parse','HEAD']);
    for (const [name, content] of Object.entries(files)) {
      const file = path.join(directory,name); fs.mkdirSync(path.dirname(file),{recursive:true}); fs.writeFileSync(file,content);
    }
    git(['add','.']);
    git(['-c','user.name=CI Test','-c','user.email=ci-test@example.invalid','commit','--allow-empty','-qm','Fixture']);
    if (mode === 'rename') { git(['mv','openscied-dashboard.js','unrelated.js']); git(['-c','user.name=CI Test','-c','user.email=ci-test@example.invalid','commit','-qm','Rename']); }
    const outputFile = path.join(directory,'outputs');
    execFileSync(process.execPath,[classifier,base,'HEAD'],{cwd:directory,env:{...process.env,GITHUB_OUTPUT:outputFile},encoding:'utf8'});
    return fs.readFileSync(outputFile,'utf8').trim();
  } finally { fs.rmSync(directory,{recursive:true,force:true}); }
}
test('OpenSciEd-only gameplay, dashboard, and regression changes select focused checks', () => {
  for (const file of ['openscied-b3-cell-cycle.js','openscied-dashboard.html','cell-cycle-scene.css','growth-cell-types.js','tests/t78-cell-cycle-audit.js']) {
    assert.equal(classify({[file]:'fixture'}),'level=openscied',file);
  }
  assert.equal(classify({'openscied-dashboard.js':'fixture','docs/notes.md':'notes'}),'level=openscied');
});
test('shared code, CI/dependency changes, and unknown files retain broad checks', () => {
  for (const file of ['lab.js','tests/_h.js','package-lock.json','.github/workflows/tests.yml','unrecognized.js']) {
    assert.equal(classify({'openscied-dashboard.js':'fixture',[file]:'fixture'}),'level=full',file);
  }
  assert.notEqual(classify({'openscied-dashboard.js':'fixture','style.css':'body{}'}),'level=openscied');
});
test('documentation stays quick and renames cannot bypass broad checks', () => {
  assert.equal(classify({'README.md':'notes'}),'level=quick');
  assert.equal(classify({'openscied-dashboard.js':'fixture'},'rename'),'level=full');
  assert.equal(classify({}),'level=full');
});
