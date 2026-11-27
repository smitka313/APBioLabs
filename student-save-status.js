/* One browser-local save receipt in the same position on both course activity types. */
(() => {
  'use strict';
  const isAP = /(?:^|\/)lab(?:0[1-9]|1[0-3])(?:\.html)?\/?$/i.test(location.pathname);
  let status = null, readout = null, announcement = null, last = '', priorState = '';
  function render() {
    if (!status) return;
    const state = window.BiologyBenchSaveState || {};
    const failures = state.failed === true;
    const at = Number(state.at) || 0;
    const kind = failures ? 'bad' : at > 0 ? 'ok' : 'idle';
    const text = failures ? (isAP ? 'Latest work not saved. Download a progress file before closing.' : 'Latest work not saved. Use Preview report to keep a copy before closing.') : at > 0 ? 'Saved to this browser' : 'No save confirmed yet';
    status.dataset.state = kind;
    if (last === text) return;
    readout.textContent = text;
    if (last && kind !== priorState) announcement.textContent = text;
    last = text;
    priorState = kind;
  }
  function setup() {
    const host = document.querySelector('body > .bench-activity-bar');
    if (!host || document.getElementById('bench-save-receipt')) return false;
    status = document.createElement('aside');
    status.id = 'bench-save-receipt';
    status.setAttribute('aria-label', 'Activity saving');
    readout = document.createElement('span');
    announcement = document.createElement('span');
    announcement.className = 'sr-only';
    announcement.setAttribute('role', 'status');
    announcement.setAttribute('aria-live', 'polite');
    status.append(readout, announcement);
    host.after(status);
    render();
    return true;
  }
  const style = document.createElement('style');
  style.textContent = '#bench-save-receipt{display:flex;flex-wrap:wrap;gap:.25rem .85rem;padding:.4rem max(.7rem,calc((100% - 1150px)/2));background:var(--surface);border-block-end:1px solid var(--line);color:var(--muted);font:600 .8rem/1.45 system-ui,sans-serif}#bench-save-receipt[data-state=bad]{color:var(--bad);font-weight:700}@media print{#bench-save-receipt{display:none!important}}';
  document.head.append(style);
  window.addEventListener('blb:save-state', render);
  if (!setup()) {
    const observer = new MutationObserver(() => { if (setup()) observer.disconnect(); });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    window.setTimeout(() => observer.disconnect(), 10000);
  }
})();
