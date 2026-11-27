(() => {
  'use strict';
  const root = document.querySelector('.teacher-hub');
  const status = document.querySelector('#assign-status');
  const dialog = document.querySelector('#assign-copy-dialog');
  const field = document.querySelector('#assign-copy-url');
  if (!root || !status || !dialog || !field) return;

  let timer = 0;
  let opener = null;
  const announce = message => {
    clearTimeout(timer);
    status.textContent = message;
    timer = setTimeout(() => { status.textContent = ''; }, 4500);
  };
  dialog.addEventListener('close', () => {
    if (opener) opener.focus();
    opener = null;
  });
  root.querySelectorAll('[data-copy]').forEach(button => {
    const link = button.closest('.assign-card')?.querySelector('[data-assignment]');
    if (!link) return;
    button.hidden = false;
    button.addEventListener('click', async () => {
      const dest = new URL(link.getAttribute('href'), 'https://biologylabbench.com/');
      if (dest.origin !== 'https://biologylabbench.com') return;
      dest.pathname = dest.pathname.replace(/\.html$/, '');
      try {
        await navigator.clipboard.writeText(dest.href);
        announce('Student link copied.');
      } catch {
        opener = button;
        field.value = dest.href;
        dialog.showModal();
        field.select();
      }
    });
  });
})();
