/* Regression: Lab 9 instructional references remain present near the relevant workflow. */
const fs = require('node:fs');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '..', 'lab09.html'), 'utf8');
const checks = [
 ['known marker sizes are supplied', /You do not calculate the known marker sizes/],
 ['standard curve formula is visible', /bp = 10<sup>\(m × distance \+ b\)<\/sup>/],
 ['EcoRI reference', /EcoRI G↓AATTC/],
 ['dilution formula', /C₁V₁ = C₂V₂/],
 ['gel and buffer concentrations distinguished', /different materials with different concentration units/],
 ['selected tube explained', /highlighted, open tube is the currently selected sample/],
 ['background quick-reference link', /href="#lab9-quick-references">Review the quick references in Background/]
];
let failed = 0;
for (const [name, pattern] of checks) {
 const ok = pattern.test(html); console.log((ok ? 'ok: ' : 'FAIL: ') + name); if (!ok) failed++;
}
console.log('t61-lab09-guidance: ' + (checks.length-failed) + '/' + checks.length + ' checks passed');
if (failed) process.exitCode = 1;
