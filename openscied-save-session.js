/* OpenSciEd storage guard. Records a reset marker, never student data or a second copy of work. */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.OpenSciEdSaveSession = api;
})(typeof window === 'object' ? window : globalThis, function () {
  'use strict';

  const base = 'aplab:pref:openscied-save-session:v1:';
  const globalKey = base + 'global';
  const scopeKey = scope => base + 'scope:' + scope;
  const resetKey = key => base + 'key:' + key;
  const knownExtra = new Set([
    'aplab:openscied-b1-carrying-capacity:run-v1',
    'aplab:openscied-b1-serengeti:preview-v1'
  ]);
  const isActivityKey = key => typeof key === 'string' &&
    (key.startsWith('aplab:openscied:') || knownExtra.has(key));
  const newNonce = () => globalThis.crypto?.randomUUID?.() ??
    Date.now().toString(36) + ':' + Math.random().toString(36).slice(2);
  const unavailable = () => ({ ok:false, reason:'unavailable' });
  const erased = () => ({ ok:false, reason:'erased' });
  const changed = () => ({ ok:false, reason:'changed' });
  const success = () => ({ ok:true });

  function checkScope(scope) {
    if (typeof scope !== 'string' || !/^b[1-5]-[a-z0-9-]+$/.test(scope)) {
      throw new TypeError('An OpenSciEd activity scope is required.');
    }
  }
  function ownerOf(key) {
    if (key === 'aplab:openscied-b1-carrying-capacity:run-v1') return 'b1-carrying-capacity';
    if (key === 'aplab:openscied-b1-serengeti:preview-v1') return 'b1-serengeti';
    const activity = /^aplab:openscied:(b[1-5]-[a-z0-9-]+):/.exec(key)?.[1];
    return activity === 'b2-peat-bog' ? 'b2-peat-bog-lab' : activity;
  }
  function trackedKeys(keys) {
    const all = [...new Set(keys)];
    if (all.some(key => !isActivityKey(key))) throw new TypeError('Only OpenSciEd work may be tracked.');
    return all;
  }
  // Dashboard/Site sign-out calls before deleting any records. No writes should be
  // attempted if the marker did not persist; otherwise a stale empty tab could start over.
  function invalidate(storage, scope = null, nonce = newNonce) {
    if (scope !== null) checkScope(scope);
    try {
      storage.setItem(scope === null ? globalKey : scopeKey(scope), nonce());
      return success();
    } catch (_) { return unavailable(); }
  }
  // This only erases OpenSciEd records. Site-wide identity deletion remains in Lab.data.
  function erase(storage, scope, keys, nonce = newNonce) {
    if (scope !== null) checkScope(scope);
    const all = trackedKeys(keys);
    if (scope !== null && all.some(key => ownerOf(key) !== scope)) return changed();
    const mark = invalidate(storage, scope, nonce);
    if (!mark.ok) return mark;
    try {
      all.forEach(key => storage.removeItem(key));
      return success();
    } catch (_) { return { ...unavailable(), partial:true }; }
  }

  // A write can be denied even while controls and local model state still work.
  // Keep the recovery route visible without touching the record or prompting a reload.
  function warn(key, reason) {
    const doc = typeof document === 'object' && document;
    if (!doc?.body?.prepend || !doc.createElement || !doc.querySelector) return;
    const message = reason === 'erased' ? 'Saved work was reset after this tab opened.' :
      reason === 'changed' ? 'A newer version is saved in another tab.' : 'This browser could not write to storage.';
    let notice = doc.querySelector('#ose-save-warning');
    const text = 'This tab could not save your latest work. ' + message +
      ' Use Preview report or the activity’s backup option to keep a copy before reloading or closing this tab.';
    if (!notice) {
      notice = doc.createElement('aside');
      notice.id = 'ose-save-warning';
      notice.setAttribute('role','alert');
      notice.style.cssText = 'position:sticky;top:0;z-index:6;color:var(--ink,#223229);background:var(--surface,#fcf9ec);border:2px solid var(--accent,#307657);border-radius:.5rem;padding:.6rem .8rem;margin:.5rem;line-height:1.4';
      (doc.querySelector('main') || doc.body).prepend(notice);
    }
    notice.dataset.workKey = key;
    if (notice.textContent !== text) notice.textContent = text;
  }
  function clearWarning(key) {
    const notice = typeof document === 'object' && document?.getElementById?.('ose-save-warning');
    if (notice?.dataset?.workKey === key) notice.remove();
  }

  // Route changes timestamp the whole saved record in some activities. They can
  // be ignored for conflict checks only when an activity opts in and all its
  // non-route data still matches the opening snapshot. Never ignore resets.
  function sameWork(previous, current, routeMetadata) {
    if (!routeMetadata.size || previous === null || current === null) return false;
    try {
      const a = JSON.parse(previous), b = JSON.parse(current);
      const record = value => value && typeof value === 'object' && !Array.isArray(value);
      if (!record(a) || !record(b)) return false;
      const keys = value => Object.keys(value).filter(key => !routeMetadata.has(key));
      const left = keys(a), right = keys(b);
      return left.length === right.length && left.every(key =>
        Object.hasOwn(b, key) && JSON.stringify(a[key]) === JSON.stringify(b[key]));
    } catch (_) { return false; }
  }

  // Initialize synchronously before restoring/creating the in-memory activity. Session
  // read() returns the exact snapshot used for that tab, not a later record it can't merge.
  function open(storage, scope, keys, nonce = newNonce, { routeMetadata = [] } = {}) {
    checkScope(scope);
    const all = trackedKeys(keys);
    const baseline = new Map(all.map(key => [key, { raw:null, epoch:null }]));
    const routeFields = new Set(routeMetadata);
    let globalEpoch, scopeEpoch, ready = false;
    try {
      globalEpoch = storage.getItem(globalKey);
      scopeEpoch = storage.getItem(scopeKey(scope));
      all.forEach(key => baseline.set(key, {
        epoch:storage.getItem(resetKey(key)), raw:storage.getItem(key)
      }));
      ready = true;
    } catch (_) { baseline.forEach(slot => { slot.raw = null; }); }

    function state(key) {
      if (!baseline.has(key)) throw new TypeError('OpenSciEd key is not registered with this editor.');
      return baseline.get(key);
    }
    function read(key) { return state(key).raw; }
    function check(key) {
      const slot = state(key);
      if (!ready) return unavailable();
      try {
        if (storage.getItem(globalKey) !== globalEpoch ||
            storage.getItem(scopeKey(scope)) !== scopeEpoch ||
            storage.getItem(resetKey(key)) !== slot.epoch) return erased();
        const current = storage.getItem(key);
        if (current !== slot.raw && !sameWork(slot.raw, current, routeFields)) return slot.raw !== null && current === null ? erased() : changed();
        return success();
      } catch (_) { return unavailable(); }
    }
    function write(key, raw) {
      if (typeof raw !== 'string') throw new TypeError('A serialized OpenSciEd record is required.');
      const result = check(key);
      if (!result.ok) { warn(key, result.reason); return result; }
      try {
        if (raw === state(key).raw) { clearWarning(key); return success(); }
        storage.setItem(key, raw);
        state(key).raw = raw;
        clearWarning(key);
        // Fresh evidence is observable even if the editor has not left the page.
        // Resume bookkeeping failure must not demote a successful saved activity.
        try { globalThis.OpenSciEdResume?.recordSave?.(); } catch (_) {}
        return success();
      } catch (_) { warn(key, 'unavailable'); return unavailable(); }
    }
    // Confirmed in-activity reset: invalidate older editors of this key (including a
    // previously empty editor), but keep sibling keys such as Journey and Budget distinct.
    function reset(key, raw = null) {
      if (raw !== null && typeof raw !== 'string') throw new TypeError('A serialized OpenSciEd record is required.');
      const result = check(key);
      if (!result.ok) return result;
      try {
        const epoch = nonce();
        storage.setItem(resetKey(key), epoch);
        // If writing/removing the record is denied after bumping the marker,
        // this same editor may retry. The other tabs stay invalidated.
        const slot = state(key);
        slot.epoch = epoch;
        if (raw === null) storage.removeItem(key);
        else storage.setItem(key, raw);
        slot.raw = raw;
        return success();
      } catch (_) { return unavailable(); }
    }
    return { read, check, write, reset };
  }

  // Keep recovery labels with the open editor, not whoever signs in next.
  // The snapshot is in memory only; no identity is added to a saved activity record.
  function reportIdentity(session, keys, getCurrent) {
    let trusted = null, conflicted = false;
    function get(forceRecovery = false) {
      if (!conflicted && !forceRecovery && session && keys.length) {
        try {
          // Read the label first, then check ownership before trusting it.
          const current = getCurrent();
          const results = keys.map(key => session.check(key));
          conflicted = results.some(result => result.reason === 'erased' || result.reason === 'changed');
          if (!conflicted && results.every(result => result.ok)) {
            if (typeof current?.name !== 'string' || !current.name.trim()) return null;
            trusted = { name: current.name, period: typeof current.period === 'string' ? current.period : '' };
          }
        } catch (_) { /* No verified current identity; use the last trusted label. */ }
      }
      return trusted ? { ...trusted } : null;
    }
    get();
    return get;
  }

  return Object.freeze({ open, erase, invalidate, isActivityKey, globalKey, scopeKey, resetKey, reportIdentity });
});
