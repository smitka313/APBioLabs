/* #15 Lab.validate */
const T = require('./_h');
(async () => {
  const b = await T.launch(), ctx = await T.ctxFor(b);
  const p = await T.open(ctx, 'lab01.html');
  const r = await p.evaluate(() => {
    const host = document.createElement('div'); host.id = 'vt';
    host.innerHTML = '<div class="field"><label for="vn">Number of measurements</label><input id="vn" type="number"></div><div class="row" style="display:flex"><input id="vp" type="number" aria-label="p"><button>Go</button></div>';
    document.body.append(host);
    const n = document.getElementById('vn'), pp = document.getElementById('vp'), V = Lab.validate, out = {};
    const msg = el => { const m = el.parentElement.querySelector('.field-msg') || (el.parentElement.nextElementSibling && el.parentElement.nextElementSibling.classList.contains('field-msg') ? el.parentElement.nextElementSibling : null); return m ? { text: m.textContent, role: m.getAttribute('role'), cls: m.className } : null; };
    n.value = ''; out.empty = { v: V.number(n, { min: 2, integer: true }), m: msg(n), inv: n.getAttribute('aria-invalid'), desc: n.getAttribute('aria-describedby') };
    n.value = '0'; out.zero = { v: V.number(n, { min: 2, integer: true }), m: msg(n) };
    n.value = '2.5'; out.frac = { v: V.number(n, { min: 2, integer: true }), m: msg(n) };
    n.value = '1'; out.low = { v: V.number(n, { min: 2, integer: true, label: 'Number of measurements' }), m: msg(n) };
    n.value = '-3'; out.neg = { v: V.number(n, { min: 0 }), m: msg(n) };
    pp.value = '1.5'; out.p15 = { v: V.number(pp, { min: 0, max: 1, label: 'p' }), m: msg(pp), kept: pp.value };
    // fixing the field clears the message by itself
    n.value = '1'; V.number(n, { min: 2 }); n.value = '5'; n.dispatchEvent(new Event('input', { bubbles: true }));
    out.fixedOnInput = { m: msg(n), inv: n.getAttribute('aria-invalid'), desc: n.getAttribute('aria-describedby') };
    n.value = '7'; out.good = { v: V.number(n, { min: 2, integer: true }), m: msg(n), inv: n.getAttribute('aria-invalid') };
    n.value = ''; out.optional = { v: V.number(n, { required: false }), m: msg(n) };
    V.show(n, 'Enter at least 2 measurements for each group.'); out.custom = { m: msg(n), inv: n.getAttribute('aria-invalid') };
    V.clear(n); out.cleared = { m: msg(n), inv: n.getAttribute('aria-invalid') };
    return out;
  });
  T.ok(r.empty.v === null && /Enter a value for number of measurements/.test(r.empty.m.text), 'empty: no value, message "' + (r.empty.m && r.empty.m.text) + '"');
  T.ok(r.empty.m.role === 'alert' && /feedback bad/.test(r.empty.m.cls), 'message uses .feedback.bad and role=alert');
  T.ok(r.empty.inv === 'true' && /vn-err/.test(r.empty.desc), 'aria-invalid and aria-describedby set');
  T.ok(r.zero.v === null && /at least 2/.test(r.zero.m.text), 'n = 0 rejected: ' + r.zero.m.text);
  T.ok(r.frac.v === null && /whole number/.test(r.frac.m.text), 'n = 2.5 rejected: ' + r.frac.m.text);
  T.ok(r.low.v === null && /^Number of measurements must be at least 2/.test(r.low.m.text), 'n = 1 rejected: ' + r.low.m.text);
  T.ok(r.neg.v === null && /at least 0/.test(r.neg.m.text), 'negative rejected: ' + r.neg.m.text);
  T.ok(r.p15.v === null && /^p must be between 0 and 1/.test(r.p15.m.text) && r.p15.kept === '1.5', 'p = 1.5 rejected, not clamped (field still 1.5): ' + r.p15.m.text);
  T.ok(r.fixedOnInput.m === null && r.fixedOnInput.inv === null && r.fixedOnInput.desc === null, 'message and aria-invalid clear as soon as the value is valid');
  T.ok(r.good.v === 7 && r.good.m === null && r.good.inv === null, 'valid value returned, nothing shown');
  T.ok(r.optional.v === null && r.optional.m === null, 'required:false and empty: null, no message');
  T.ok(r.custom.m && r.custom.inv === 'true', 'show() with a custom message');
  T.ok(r.cleared.m === null && r.cleared.inv === null, 'clear() removes it');
  await b.close();
  T.done('t15-validate');
})();
