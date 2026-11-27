/* Printable classroom briefs: no account, storage, or external library. */
(() => {
  'use strict';
  const book = document.querySelector('.brief-book');
  const dialog = document.getElementById('brief-copy-dialog');
  const textArea = document.getElementById('brief-copy-text');
  const status = document.getElementById('brief-status');
  if (!book || !dialog || !textArea || !status) return;

  let opener = null;
  let timer = 0;
  function report(text) {
    clearTimeout(timer);
    status.textContent = text;
    timer = setTimeout(() => { status.textContent = ''; }, 3500);
  }
  function clearPrint() {
    document.body.removeAttribute('data-print-brief');
    for (const node of book.querySelectorAll('.printing-brief')) node.classList.remove('printing-brief');
  }
  window.addEventListener('afterprint', clearPrint);
  dialog.addEventListener('close', () => { opener?.focus(); opener = null; });

  function printOne(card) {
    clearPrint();
    document.body.setAttribute('data-print-brief', '');
    card.classList.add('printing-brief');
    try { window.print(); }
    catch (_) { clearPrint(); report('Printing was blocked. Copy the assignment text instead.'); }
  }

  function asAssignment(card) {
    const get = selector => card.querySelector(selector).textContent.trim();
    return [
      get('h2'), get('.brief-meta'), get('.brief-question'),
      'In class:', ...Array.from(card.querySelectorAll('.brief-plan li')).map((el, i) => (i + 1) + '. ' + el.textContent.trim()),
      get('.brief-turnin'), get('.brief-fallback'),
      'Open the activity: ' + card.querySelector('.print-link a').getAttribute('href')
    ].join('\n\n');
  }
  async function copy(card, button) {
    const content = asAssignment(card);
    try {
      await navigator.clipboard.writeText(content);
      report('Assignment text copied.');
    } catch (_) {
      opener = button;
      textArea.value = content;
      dialog.showModal();
      textArea.select();
    }
  }
  for (const button of book.querySelectorAll('[data-brief-print], [data-brief-copy]')) {
    button.hidden = false;
    button.addEventListener('click', () => {
      const card = button.closest('.brief-sheet');
      if (button.hasAttribute('data-brief-print')) printOne(card);
      else copy(card, button);
    });
  }
})();
