/* Independent reference maths for the t59 science tests, written from scratch (no code shared with lab.js or the labs),
   plus a helper that lifts one function's source out of a lab page so it can be called directly in Node.
   Not a test on its own. */
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');

const sum = a => a.reduce((s, x) => s + x, 0);
const mean = a => sum(a) / a.length;
const sd = a => { const m = mean(a); return Math.sqrt(sum(a.map(x => (x - m) ** 2)) / (a.length - 1)); };
const se = a => sd(a) / Math.sqrt(a.length);
const median = a => { const b = a.slice().sort((x, y) => x - y), n = b.length; return n % 2 ? b[(n - 1) / 2] : (b[n / 2 - 1] + b[n / 2]) / 2; };
function linreg(xs, ys) {
  const n = xs.length, mx = mean(xs), my = mean(ys);
  let sxy = 0, sxx = 0; for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; }
  const m = sxy / sxx; return { m, b: my - m * mx };
}
/* chi-square goodness of fit */
const chi2 = (obs, exp) => sum(obs.map((o, i) => (o - exp[i]) ** 2 / exp[i]));
/* Hardy-Weinberg chi-square from genotype counts (p estimated from the counts, df = 1) */
function hw(aa, ab, bb) { const n = aa + ab + bb, p = (2 * aa + ab) / (2 * n), q = 1 - p; const exp = [p * p * n, 2 * p * q * n, q * q * n]; return { p, q, exp, chi2: chi2([aa, ab, bb], exp) }; }

/* log-gamma (Lanczos), regularized lower incomplete gamma, regularized incomplete beta (continued fractions; Numerical Recipes style) */
function lgamma(x) {
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let y = x, t = x + 5.5; t -= (x + 0.5) * Math.log(t); let s = 1.000000000190015; for (const k of c) s += k / ++y; return -t + Math.log(2.5066282746310005 * s / x);
}
function gammaP(a, x) {
  if (x <= 0) return 0;
  if (x < a + 1) { let ap = a, s = 1 / a, d = s; for (let i = 0; i < 500; i++) { ap++; d *= x / ap; s += d; if (Math.abs(d) < Math.abs(s) * 1e-15) break; } return s * Math.exp(-x + a * Math.log(x) - lgamma(a)); }
  let b = x + 1 - a, c = 1e300, d = 1 / b, h = d;
  for (let i = 1; i < 500; i++) { const an = -i * (i - a); b += 2; d = an * d + b; if (Math.abs(d) < 1e-300) d = 1e-300; c = b + an / c; if (Math.abs(c) < 1e-300) c = 1e-300; d = 1 / d; const del = d * c; h *= del; if (Math.abs(del - 1) < 1e-15) break; }
  return 1 - Math.exp(-x + a * Math.log(x) - lgamma(a)) * h;
}
function betacf(a, b, x) {
  let qab = a + b, qap = a + 1, qam = a - 1, c = 1, d = 1 - qab * x / qap; if (Math.abs(d) < 1e-300) d = 1e-300; d = 1 / d; let h = d;
  for (let m = 1; m <= 300; m++) {
    const m2 = 2 * m; let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < 1e-300) d = 1e-300; c = 1 + aa / c; if (Math.abs(c) < 1e-300) c = 1e-300; d = 1 / d; h *= d * c;
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < 1e-300) d = 1e-300; c = 1 + aa / c; if (Math.abs(c) < 1e-300) c = 1e-300; d = 1 / d; const del = d * c; h *= del; if (Math.abs(del - 1) < 1e-15) break;
  }
  return h;
}
function ibeta(a, b, x) {
  if (x <= 0) return 0; if (x >= 1) return 1;
  const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? bt * betacf(a, b, x) / a : 1 - bt * betacf(b, a, 1 - x) / b;
}
const chi2cdf = (x, df) => gammaP(df / 2, x / 2);
const tcdf = (t, df) => { const x = df / (df + t * t), p = 0.5 * ibeta(df / 2, 0.5, x); return t > 0 ? 1 - p : p; };
function bisect(f, lo, hi) { for (let i = 0; i < 200; i++) { const m = (lo + hi) / 2; if (f(m) > 0) hi = m; else lo = m; } return (lo + hi) / 2; }
const chi2crit = (df, alpha = 0.05) => bisect(x => chi2cdf(x, df) - (1 - alpha), 0, 200);
const tcrit = (df, alpha = 0.05) => bisect(t => tcdf(t, df) - (1 - alpha / 2), 0, 100);
/* Welch t (b minus a), Welch-Satterthwaite df, two-sided p */
function welch(a, b) {
  const va = sd(a) ** 2 / a.length, vb = sd(b) ** 2 / b.length, t = (mean(b) - mean(a)) / Math.sqrt(va + vb);
  const df = (va + vb) ** 2 / (va * va / (a.length - 1) + vb * vb / (b.length - 1));
  return { t, df, p: 2 * (1 - tcdf(Math.abs(t), df)) };
}
/* Smith-Waterman local alignment score with affine gaps (Gotoh): gap of length L costs open + L*ext */
function swScore(q, s, P) {
  const n = q.length, m = s.length; let best = 0;
  let Hp = new Array(m + 1).fill(0), Fp = new Array(m + 1).fill(-1e9);
  for (let i = 1; i <= n; i++) {
    const H = new Array(m + 1).fill(0), F = new Array(m + 1).fill(-1e9); let E = -1e9;
    for (let j = 1; j <= m; j++) {
      E = Math.max(H[j - 1] - P.open - P.ext, E - P.ext);
      F[j] = Math.max(Hp[j] - P.open - P.ext, Fp[j] - P.ext);
      H[j] = Math.max(0, Hp[j - 1] + (q[i - 1] === s[j - 1] ? P.match : P.mis), E, F[j]);
      if (H[j] > best) best = H[j];
    }
    Hp = H; Fp = F;
  }
  return best;
}

/* Lift `function name(...) {...}` (or `const name = ...;` on one line) out of a page's source. */
function fnSrc(file, name) {
  const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
  let i = src.search(new RegExp('function ' + name + '\\s*\\('));
  if (i >= 0) {
    let j = src.indexOf('{', i), depth = 0;
    for (; j < src.length; j++) { if (src[j] === '{') depth++; else if (src[j] === '}' && --depth === 0) break; }
    return src.slice(i, j + 1);
  }
  const m = new RegExp('const ' + name + ' = [^\\n]*').exec(src);
  if (!m) throw new Error('no ' + name + ' in ' + file);
  return m[0].replace(/;\s*$/, '') + ';';
}
/* Build callable functions from page source: load('lab01.html', ['TC', 'tcrit', 'welch'], {S}) → {welch, ...} */
function load(file, names, scope = {}) {
  const body = names.map(n => fnSrc(file, n)).join('\n') + '\nreturn {' + names.join(',') + '};';
  return new Function(...Object.keys(scope), body)(...Object.values(scope));
}
const near = (a, b, tol) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
module.exports = { sum, mean, sd, se, median, linreg, chi2, hw, chi2cdf, tcdf, chi2crit, tcrit, welch, swScore, fnSrc, load, near };
