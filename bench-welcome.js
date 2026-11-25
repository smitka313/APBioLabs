'use strict';
(() => {
  // Existing AP directory bookmarks still lead to the same section, on its new URL.
  const legacy = /^#(?:labs|bi[1-4]|resume|using-labs)$/;
  if (legacy.test(location.hash)) {
    location.replace('ap-biology.html' + location.search + location.hash);
    return;
  }
  const key = 'aplab:pref:theme', root = document.documentElement;
  const buttons = [...document.querySelectorAll('[data-bench-theme]')];
  const apply = (value) => {
    if (value === 'light' || value === 'dark') root.dataset.theme = value;
    else delete root.dataset.theme;
    buttons.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.benchTheme === (root.dataset.theme || 'auto'))));
  };
  apply(root.dataset.theme);
  for (const button of buttons) button.addEventListener('click', () => {
    const next = button.dataset.benchTheme;
    try { localStorage.setItem(key, next); } catch (_) {}
    apply(next);
  });
  window.addEventListener('storage', event => { if (event.key === key) apply(event.newValue ?? 'dark'); });
  // A page restored by the Back button may have missed a preference change while frozen.
  window.addEventListener('pageshow', event => {
    if (!event.persisted) return;
    try { apply(localStorage.getItem(key) ?? 'dark'); } catch (_) {}
  });
})();
