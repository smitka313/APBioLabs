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
    const all = trackedKeys(keys);
    const mark = invalidate(storage, scope, nonce);
    if (!mark.ok) return mark;
    try {
      all.forEach(key => storage.removeItem(key));
      return success();
    } catch (_) { return { ...unavailable(), partial:true }; }
  }

  // Initialize synchronously before restoring/creating the in-memory activity. Session
  // read() returns the exact snapshot used for that tab, not a later record it can't merge.
  function open(storage, scope, keys, nonce = newNonce) {
    checkScope(scope);
    const all = trackedKeys(keys);
    const baseline = new Map(all.map(key => [key, { raw:null, epoch:null }]));
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
        if (current !== slot.raw) return slot.raw !== null && current === null ? erased() : changed();
        return success();
      } catch (_) { return unavailable(); }
    }
    function write(key, raw) {
      if (typeof raw !== 'string') throw new TypeError('A serialized OpenSciEd record is required.');
      const result = check(key);
      if (!result.ok) return result;
      try {
        storage.setItem(key, raw);
        state(key).raw = raw;
        return success();
      } catch (_) { return unavailable(); }
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

  return Object.freeze({ open, erase, invalidate, isActivityKey, globalKey, scopeKey, resetKey });
});
