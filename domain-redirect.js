/* Keep old bookmarks useful without stranding work saved on the GitHub origin. */
(function () {
  'use strict';
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
