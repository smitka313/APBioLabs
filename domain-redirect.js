/* Keep old bookmarks useful without stranding work saved on the GitHub origin. */
(function () {
  'use strict';
  // OpenSciEd has a few pages whose own fallback theme script follows CSS.
  // Apply the saved choice in this shared head script, before those sheets.
  // This changes no storage and deliberately leaves AP lab startup alone.
  if (/\/openscied-[^/]+\/?$/i.test(location.pathname)) {
    document.documentElement.setAttribute('data-openscied', '');
    try {
      var opensciedTheme = localStorage.getItem('aplab:pref:theme');
      if (opensciedTheme === 'light' || opensciedTheme === 'dark') {
        document.documentElement.setAttribute('data-theme', opensciedTheme);
      }
    } catch (_) { /* Match the system theme when storage is unavailable. */ }
  }

  var oldHost = 'smitka313.github.io';
  var prefix = '/APBioLabs';
  if (location.hostname !== oldHost ||
      (location.pathname !== prefix && location.pathname.indexOf(prefix + '/') !== 0)) return;

  var destination = new URL('https://biologylabbench.com');
  destination.pathname = location.pathname.slice(prefix.length) || '/';
  destination.search = location.search;
  destination.searchParams.delete('legacy');
  destination.hash = location.hash;

  var stay = new URLSearchParams(location.search).get('legacy') === '1';
  try {
    if (stay) sessionStorage.setItem('aplab:legacy-site', '1');
    stay = stay || sessionStorage.getItem('aplab:legacy-site') === '1';
  } catch (_) { /* The explicit legacy link still works when storage is blocked. */ }

  var saved = false;
  try {
    for (var i = 0; i < localStorage.length; i++) {
      var key = localStorage.key(i);
      if (/^aplab:(?:lab\d\d:|backup:lab\d\d|progress:lab\d\d)/.test(key || '')) {
        saved = true;
        break;
      }
    }
  } catch (_) { saved = true; } // Do not send a student away when their storage cannot be checked.

  if (!saved && !stay) {
    location.replace(destination.href);
    return;
  }

  function showNotice() {
    var notice = document.createElement('aside');
    notice.id = 'domain-move-notice';
    notice.setAttribute('aria-label', 'New website address');
    notice.style.cssText = 'padding:16px;margin:12px;border:2px solid #275c45;border-radius:8px;background:#f1faf4;color:#173c2c;font:16px/1.5 system-ui,sans-serif;position:relative;z-index:10';
    var message = document.createElement('p');
    message.style.margin = '0 0 8px';
    message.textContent = 'Our new address is biologylabbench.com. Work saved on this old address stays here. Before switching, open each lab you want to keep and use “Move your work to another computer” to download a progress file or get a transfer code. Load it on the new site to continue. Download any timelapse recordings separately.';
    var link = document.createElement('a');
    link.href = destination.href;
    link.style.cssText = 'color:#174c39;text-decoration:underline;font-weight:700';
    link.textContent = 'Go to biologylabbench.com';
    notice.appendChild(message);
    notice.appendChild(link);
    document.body.insertBefore(notice, document.body.firstChild);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', showNotice, { once: true });
  else showNotice();
}());


/* Track visits and real work on OpenSciEd activity routes, without touching saved answers. */
(function () {
  'use strict';
  if (location.hostname === 'smitka313.github.io' ||
      !/(?:^|\/)openscied-b[1-5]-[a-z0-9-]+(?:\.html)?\/?$/.test(location.pathname) ||
      !document.currentScript || !document.currentScript.src) return;
  var script = document.createElement('script');
  script.src = new URL('openscied-resume.js', document.currentScript.src).href;
  document.head.appendChild(script);
}());

/* Shared visual labels mirror confirmed activity navigation states. */
(function () {
  'use strict';
  var source = document.currentScript;
  if (!source || !source.src || location.hostname === 'smitka313.github.io' ||
      !/(?:^|\/)(?:lab(?:0[1-9]|1[0-3])|openscied-b[1-5]-[a-z0-9-]+)(?:\.html)?\/?$/i.test(location.pathname)) return;
  var css = document.createElement('link');
  css.rel = 'stylesheet';
  css.href = new URL('student-step-nav.css', source.src).href;
  var script = document.createElement('script');
  script.src = new URL('student-step-nav.js', source.src).href;
  document.head.appendChild(css);
  document.head.appendChild(script);
}());

/* The welcome signature is shared by the catalog, labs, guides and teacher pages. */
(function () {
  'use strict';
  var source = document.currentScript;
  if (!source || !source.src) return;
  var footer = document.createElement('script');
  footer.src = new URL('bench-footer.js', source.src).href;
  document.head.appendChild(footer);
}());


/* On the three course entrances, start new visitors in Dark without overriding a chosen mode. */
(function () {
  'use strict';
  if (!document.currentScript || !document.currentScript.src) return;
  var source = new URL(document.currentScript.src);
  var root = source.pathname.replace(/domain-redirect\.js$/, '');
  if (location.pathname.indexOf(root) !== 0) return;
  var relative = location.pathname.slice(root.length);
  if (relative && !/^(?:index|ap-biology|openscied-dashboard)(?:\.html)?\/?$/i.test(relative)) return;
  var key = 'aplab:pref:theme';
  var mode = 'dark';
  try {
    var saved = localStorage.getItem(key);
    if (saved === 'light' || saved === 'dark' || saved === 'auto') mode = saved;
    else localStorage.setItem(key, mode);
  } catch (_) { /* Follow the default for this page when storage is unavailable. */ }
  if (mode === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', mode);
}());
