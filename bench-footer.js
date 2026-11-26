/* Shared site branding and privacy copy. Reports and printable directions keep their layout. */
(function () {
  'use strict';
  var script = document.currentScript;
  if (!script || !script.src) return;
  var base = new URL('.', script.src);

  function linkTo(path) { return new URL(path, base).href; }
  function activityMasthead() {
    var slug = location.pathname.split('/').filter(Boolean).pop() || '';
    var ap = /^lab(?:0[1-9]|1[0-3])(?:\.html)?$/i.test(slug);
    var ose = slug.match(/^openscied-b([1-5])-[a-z0-9-]+(?:\.html)?$/i);
    if ((!ap && !ose) || document.querySelector('.bench-activity-bar')) return;
    var header = document.createElement('header');
    header.className = 'bench-activity-bar';
    header.setAttribute('aria-label', 'Biology Lab Bench');
    var wrap = document.createElement('div');
    wrap.className = 'bench-activity-inner';
    var home = document.createElement('a');
    home.className = 'bench-activity-home';
    home.href = linkTo('index.html');
    home.setAttribute('aria-label', 'Biology Lab Bench home');
    ['light', 'dark'].forEach(function (theme) {
      var logo = document.createElement('img');
      logo.className = 'bench-footer-' + theme;
      logo.src = linkTo('assets/biology-lab-bench-logo' + (theme === 'dark' ? '-dark' : '') + '.svg');
      logo.alt = '';
      logo.width = 550;
      logo.height = 144;
      home.appendChild(logo);
    });
    var course = document.createElement('span');
    course.className = 'bench-activity-course';
    course.textContent = ap ? 'AP Biology labs' : 'Biology Companion Activities · Unit ' + ose[1];
    wrap.append(home, course);
    header.appendChild(wrap);
    // Keep the existing skip link the first keyboard stop.
    var skip = Array.from(document.body.children).find(function (el) {
      return el.matches('a.skip-link, a[class$="-skip"]');
    });
    if (skip) skip.after(header); else document.body.prepend(header);
  }

  function privacyCopy(wrap) {
    if (!document.querySelector('script[data-goatcounter]')) return;
    var standard = 'This site counts anonymous page visits without cookies. Nothing you type, including your name and answers, is sent anywhere.';
    var found = false;
    var variants = /This site counts anonymous page visits (?:with GoatCounter \(no cookies\)|without cookies)\. Nothing you type, including your name and answers, is sent anywhere\.|(?:Analytics count page visits only|Anonymous page visits (?:only|are counted without cookies))\./gi;
    wrap.querySelectorAll('p').forEach(function (p) {
      // Update copy without replacing credits, links or other footer markup.
      var nodes = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
      for (var node = nodes.nextNode(); node; node = nodes.nextNode()) {
        node.nodeValue = node.nodeValue.replace(variants, function () {
          if (found) return '';
          found = true;
          return standard;
        });
      }
      if (!p.textContent.trim() && !p.children.length) p.remove();
    });
    if (!found) {
      var line = document.createElement('p');
      line.textContent = standard;
      wrap.appendChild(line);
    }
  }

  function signature() {
    activityMasthead();
    if (document.querySelector('.bench-footer-home')) return;
    // A nested article or report footer is not the site-wide footer.
    var footer = document.querySelector('footer.site-footer') || document.querySelector('body > footer') || document.querySelector('body > main > footer');
    if (!footer) {
      footer = document.createElement('footer');
      footer.className = 'bench-footer-created';
      var credit = document.createElement('p');
      credit.textContent = 'Created by Robert Smitka. Licensed under ';
      var license = document.createElement('a');
      license.href = 'https://creativecommons.org/licenses/by-nc-sa/4.0/';
      license.rel = 'license';
      license.textContent = 'CC BY-NC-SA 4.0';
      credit.append(license, '.');
      footer.appendChild(credit);
      document.body.appendChild(footer);
    }

    // Self-contained for worksheet and teacher pages that do not use style.css.
    var styles = document.createElement('style');
    styles.textContent = [
      '.bench-footer-created{box-sizing:border-box;margin-block-start:1.5rem;padding:1rem max(16px,calc((100% - 1088px)/2));background:var(--surface,#f5f4eb);border-top:1px solid var(--line,#cdd5c6);color:var(--ink,#163a31);font:normal .84rem/1.5 system-ui,sans-serif}',
      '.bench-footer-created p{margin:0}',
      '.bench-footer-created a{color:inherit}',
      'a.bench-footer-home{display:block;width:min(196px,100%);min-height:35px;margin-block:0 .65rem;line-height:0}',
      'a.bench-footer-home:focus-visible{outline:3px solid var(--accent,#397c5c);outline-offset:3px}',
      '.bench-footer-home img{display:block;width:100%;height:auto;max-width:100%;margin:0;padding:0;border:0}',
      '.bench-footer-home .bench-footer-dark,:root[data-theme=dark] .bench-footer-home .bench-footer-light{display:none}',
      ':root[data-theme=dark] .bench-footer-home .bench-footer-dark{display:block}',
      // Shared-style pages follow system appearance when there is no explicit preference.
      '@media(prefers-color-scheme:dark){:root:not([data-theme=light]):has(link[href^="style.css"],link[href="/style.css"],link[href="/APBioLabs/style.css"]) .bench-footer-home .bench-footer-light{display:none}:root:not([data-theme=light]):has(link[href^="style.css"],link[href="/style.css"],link[href="/APBioLabs/style.css"]) .bench-footer-home .bench-footer-dark{display:block}}',
      '@media print{.bench-footer-home,.bench-footer-created{display:none!important}}'
    ].join('\n');
    document.head.appendChild(styles);

    var home = document.createElement('a');
    home.className = 'bench-footer-home';
    home.href = linkTo('index.html');
    home.setAttribute('aria-label', 'Return to the Biology Lab Bench welcome page');
    ['light', 'dark'].forEach(function (theme) {
      var mark = document.createElement('img');
      mark.className = 'bench-footer-' + theme;
      mark.src = linkTo('assets/biology-lab-bench-logo' + (theme === 'dark' ? '-dark' : '') + '.svg');
      mark.alt = '';
      mark.width = 550;
      mark.height = 144;
      mark.loading = 'lazy';
      mark.decoding = 'async';
      home.appendChild(mark);
    });
    var wrap = footer.querySelector('.wrap') || footer;
    wrap.prepend(home);
    privacyCopy(wrap);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', signature, { once: true });
  else signature();
}());
