/* Dashboard identity uses the same name and class period as the rest of Lab Bench. */
(function () {
  'use strict';
  const PREFIX = 'aplab:openscied:';
  const $ = selector => document.querySelector(selector);
  function init() {
    Lab.identity.mount('#openscied-student-identity');
    const status = $('#openscied-results-status');
    const dialog = $('#clear-openscied-dialog');
    const confirmation = $('#openscied-erase-confirmation');
    const confirmButton = $('#confirm-openscied-clear');
    function savedKeys() {
      return Object.keys(localStorage).filter(key => key.startsWith(PREFIX));
    }
    function refresh(message) {
      try {
        const count = savedKeys().length;
        $('#download-openscied-results').disabled = !count;
        $('#clear-openscied-results').disabled = !count;
        status.textContent = message || (count
          ? 'OpenSciEd work is saved on this device. You can download a copy or clear it for a fresh start.'
          : 'No OpenSciEd results saved on this device. Choose an activity to get started.');
      } catch (e) {
        status.textContent = 'This browser cannot access saved work. Allow site storage to save or clear results.';
        $('#download-openscied-results').disabled = true;
        $('#clear-openscied-results').disabled = true;
      }
    }
    function downloadWork() {
      try {
        const work = {};
        savedKeys().forEach(key => { work[key] = localStorage.getItem(key); });
        const payload = { format: 'openscied-saved-work-v1', exportedAt: new Date().toISOString(), student: Lab.identity.get(), work };
        const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
        const link = document.createElement('a');
        link.href = url; link.download = 'openscied-saved-work.json';
        document.body.appendChild(link); link.click(); link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        status.textContent = 'Downloaded a copy of your OpenSciEd work.';
      } catch (e) {
        status.textContent = 'Could not download your OpenSciEd work. Your saved results have not been cleared.';
      }
    }
    $('#download-openscied-results').addEventListener('click', downloadWork);
    $('#backup-before-openscied-clear').addEventListener('click', downloadWork);
    $('#clear-openscied-results').addEventListener('click', () => {
      confirmation.value = ''; confirmButton.disabled = true;
      $('#openscied-clear-error').textContent = '';
      dialog.showModal();
    });
    confirmation.addEventListener('input', () => { confirmButton.disabled = confirmation.value !== 'ERASE'; });
    $('#cancel-openscied-clear').addEventListener('click', () => dialog.close());
    $('#clear-openscied-form').addEventListener('submit', event => {
      event.preventDefault();
      if (confirmation.value !== 'ERASE') return;
      try {
        savedKeys().forEach(key => localStorage.removeItem(key));
        dialog.close();
        refresh('OpenSciEd results cleared. Your name, class period, and AP Biology work are still saved.');
      } catch (e) {
        $('#openscied-clear-error').textContent = 'Could not clear all saved results. Check your browser storage settings and try again.';
      }
    });
    // The dashboard can remain open while an activity saves in another tab.
    window.addEventListener('storage', event => { if (!event.key || event.key.startsWith(PREFIX)) refresh(); });
    refresh();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
