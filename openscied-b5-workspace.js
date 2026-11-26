/* Local save receipt for the Unit 5 investigations. No additional storage keys. */
(function (root) {
  'use strict';
  function timestamp(value) {
    return typeof value === 'number' && value > 0 && value <= Date.now() ? value : 0;
  }
  function mount({ output, key, session, canSave, restored, getRecord }) {
    const status = document.createElement('span');
    status.setAttribute('role', 'status');
    const last = document.createElement('time');
    last.hidden = true;
    output.replaceChildren(status, last);
    let failed = false;
    function refresh() {
      const at = timestamp(getRecord().lastSavedAt);
      const phase = !canSave() || failed ? 'blocked' : at ? 'saved' : restored() ? 'restored' : 'ready';
      if (output.dataset.saveState !== phase) {
        output.dataset.saveState = phase;
        status.textContent = {
          blocked:'This tab cannot save. Preview or download your work before reloading.',
          saved:'Saved to this browser.',
          restored:'Saved work restored. Last saved time was not recorded.',
          ready:'No work saved yet. Your work will stay in this browser.'
        }[phase];
      }
      last.hidden = phase !== 'saved';
      if (phase === 'saved') {
        const date = new Date(at);
        last.dateTime = date.toISOString();
        last.textContent = ' Last saved: ' + date.toLocaleString(undefined, {dateStyle:'medium', timeStyle:'short'});
      } else {
        last.removeAttribute('datetime');
        last.textContent = '';
      }
    }
    function write(workChanged = true) {
      if (!canSave()) {
        failed = true;
        refresh();
        return false;
      }
      const record = getRecord(), at = workChanged ? Date.now() : timestamp(record.lastSavedAt);
      const payload = { ...record };
      if (at) payload.lastSavedAt = at;
      else delete payload.lastSavedAt;
      const ok = session.write(key, JSON.stringify(payload)).ok;
      failed = !ok;
      // A rejected write must not update the displayed timestamp.
      if (ok && at) record.lastSavedAt = at;
      refresh();
      return ok;
    }
    root.addEventListener('storage', e => {
      if (e.key === null || e.key === key || e.key.startsWith('aplab:pref:openscied-save-session:v1:')) refresh();
    });
    refresh();
    return { write, refresh };
  }
  root.OpenSciEdB5Workspace = Object.freeze({ mount, timestamp });
})(window);
