/* One browser-local save receipt inside the existing activity masthead. */
(() => {
  'use strict';
  const isAP = /(?:^|\/)lab(?:0[1-9]|1[0-3])(?:\.html)?\/?$/i.test(location.pathname);
  let status = null;
  function render() {
    if (!status) return;
    const state = window.BiologyBenchSaveState || {};
    const failed = state.failed === true;
    const confirmed = Number(state.at) > 0;
    status.dataset.state = failed ? 'bad' : confirmed ? 'ok' : 'idle';
    const text = failed ? 'Latest work not saved' : confirmed ? 'Saved to this browser' : 'No save confirmed yet';
    const help = failed
      ? isAP ? 'Download a progress file before closing.' : 'Use Preview report to keep a copy before closing.'
      : '';
    if (status.textContent !== text) status.textContent = text;
    if (help) status.setAttribute('aria-label', text + '. ' + help);
    else status.removeAttribute('aria-label');
    if (help) status.setAttribute('title', help);
    else status.removeAttribute('title');
    // The existing activity warning/alert still gives recovery instructions and
    // announces failure. Do not add a competing live region to the page.
  }
  function setup() {
    const host = document.querySelector('body > .bench-activity-bar .bench-activity-inner');
    if (!host || document.getElementById('bench-save-receipt')) return false;
    status = document.createElement('span');
    status.id = 'bench-save-receipt';
    host.append(status);
    render();
    return true;
  }
  const style = document.createElement('style');
  style.textContent = '#bench-save-receipt{flex:0 1 10ch;min-width:0;margin:0;text-align:end;align-self:center;color:var(--muted);font:650 clamp(.64rem,2vw,.8rem)/1.13 system-ui,sans-serif}#bench-save-receipt[data-state=bad]{color:var(--bad);font-weight:750}@media print{#bench-save-receipt{display:none!important}}';
  document.head.append(style);
  window.addEventListener('blb:save-state', render);
  if (!setup()) {
    const observer = new MutationObserver(() => { if (setup()) observer.disconnect(); });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    window.setTimeout(() => observer.disconnect(), 10000);
  }
})();
