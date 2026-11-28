(() => {
  'use strict';
  const root = document.querySelector('.teacher-hub');
  const status = document.querySelector('#assign-status');
  const dialog = document.querySelector('#assign-copy-dialog');
  const title = document.querySelector('#assign-copy-title');
  const urlField = document.querySelector('#assign-copy-url');
  const urlLabel = document.querySelector('#assign-copy-url-label');
  const textField = document.querySelector('#assign-copy-text');
  const textLabel = document.querySelector('#assign-copy-text-label');
  if (!root || !status || !dialog || !title || !urlField || !urlLabel || !textField || !textLabel) return;

  const site = 'https://biologylabbench.com/';
  const clean = node => node?.textContent.replace(/\s+/g, ' ').trim() || '';
  let timer = 0;
  let opener = null;
  const announce = message => {
    clearTimeout(timer);
    status.textContent = message;
    timer = setTimeout(() => { status.textContent = ''; }, 4500);
  };
  dialog.addEventListener('close', () => {
    urlField.value = '';
    textField.value = '';
    if (opener) opener.focus();
    opener = null;
  });

  function studentDestination(link) {
    const href = link?.getAttribute('href');
    // Only public, same-site student activity URLs belong in a copied assignment.
    if (!/^(?:lab(?:0[1-9]|1[0-3])|openscied-b[1-5]-[a-z0-9-]+)\.html$/.test(href || '')) return null;
    return new URL(href.replace(/\.html$/, ''), site);
  }

  function assignmentText(card, dest) {
    const name = clean(card.querySelector('h4'));
    const time = clean(card.querySelector('.assign-meta span'));
    const turnin = clean(card.querySelector('.assign-turnin')).replace(/^Turn in:\s*/i, '');
    const ap = dest.pathname.startsWith('/lab');
    return [
      name,
      'Open the activity: ' + dest.href,
      'Estimated time: ' + time,
      'Complete the sections your teacher assigned.',
      'Turn in: ' + turnin,
      (ap ? 'In Submit, download your report as Word or save it as a PDF.' :
        'Open your activity report and download it as Word or save it as a PDF.') +
        ' Upload one file to this Schoology assignment.'
    ].join('\n\n');
  }

  root.querySelectorAll('[data-copy], [data-copy-assignment]').forEach(button => {
    const card = button.closest('.assign-card');
    const dest = studentDestination(card?.querySelector('[data-assignment]'));
    if (!dest) return;
    const full = button.hasAttribute('data-copy-assignment');
    button.hidden = false;
    button.addEventListener('click', async () => {
      const value = full ? assignmentText(card, dest) : dest.href;
      try {
        await navigator.clipboard.writeText(value);
        announce(full ? 'Assignment copied. Paste it into Schoology.' : 'Student link copied.');
      } catch {
        opener = button;
        title.textContent = full ? 'Copy assignment' : 'Copy student link';
        urlField.hidden = urlLabel.hidden = full;
        textField.hidden = textLabel.hidden = !full;
        const field = full ? textField : urlField;
        field.value = value;
        dialog.showModal();
        field.focus();
        field.select();
      }
    });
  });
})();
