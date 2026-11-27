/* Runs only after the notes unlock. The printable document is built locally from
   the opened exemplar, never from the lab's saved work or a public answer URL. */
(() => {
  'use strict';
  const ap = /(?:^|\/)teacher-lab(\d{2})(?:\.html)?\/?$/.exec(location.pathname);
  const ose = /(?:^|\/)openscied-teacher-notes(?:\.html)?\/?$/.test(location.pathname);
  if (!ap && !ose) return;
  const clean = el => el?.textContent.replace(/\s+/g, ' ').trim() || '';
  const make = (doc, tag, text, className) => {
    const el = doc.createElement(tag);
    if (text) el.textContent = text;
    if (className) el.className = className;
    return el;
  };

  function prepare(details) {
    const card = details.closest('.ose-teacher-card');
    const activity = ap ? 'lab' + ap[1] : /^guide-(b\d-.*)$/.exec(card?.id || '')?.[1];
    if (!activity) return null;
    const richSample = details.querySelector(':scope > .rv-paper');
    const divSample = details.matches('.full-model-report') && details.querySelector(':scope > div');
    const source = richSample || divSample || details;
    const report = make(document, 'div', '', 'tn-exemplar-paper');
    const originalMeta = richSample?.querySelector('.rv-info');
    const original = {};
    originalMeta?.querySelectorAll('dt').forEach(term => { original[clean(term)] = clean(term.nextElementSibling); });
    const paragraphs = [...source.querySelectorAll(':scope > p')].map(clean);
    const parts = paragraphs.flatMap(line => line.split(/\s+·\s+/));
    const periodSlot = parts.findIndex(part => /^Period\s+\S+/i.test(part));
    const exampleName = (parts[periodSlot - 1] || '').replace(/\s*\(fictional\)\s*/i, '').trim();
    const period = original['Class period'] || parts[periodSlot]?.match(/^Period\s+([\w-]+)/i)?.[1] || '';
    const datasetId = original['Dataset ID'] || paragraphs.join(' ').match(/\b(?:[Ee]xample [Dd]ataset|[Dd]ataset(?: [Ii][Dd])?)\s*:?\s+([A-Z]{2,5}(?:-[A-Z0-9]{3,}){1,3})\b/)?.[1] ||
      (activity === 'b3-screening' ? paragraphs.join(' ').match(/\bSD-[A-Z0-9]+\b/)?.[0] : '') || '';
    const title = clean(richSample?.querySelector('.rv-head h3')) ||
      (ap ? clean(document.querySelector('h1')).replace(/^Lab\s+\d+\s*[·:—–-]\s*/i, '').replace(/\s*[·—–-]\s*teacher notes$/i, '') : clean(card.querySelector('h3')));
    const date = new Date();
    const name = original.Name || exampleName;
    if (!title || !name || !period) return null;
    const sample = {
      title, name, period, datasetId, date,
      dateLabel: original.Date || date.toLocaleDateString(undefined, { dateStyle: 'long' }),
      unit: 'Unit ' + activity[1],
      source: 'Fictional exemplar. Published and simulated evidence are identified in the report.',
      recorder: activity === 'b1-serengeti' ? { name, period } : null
    };
    if (ap && !sample.datasetId) sample.datasetId = 'EXEMPLAR-' + activity.toUpperCase();
    const content = [...source.children].filter(el => !el.matches('summary, header, .tn-exemplar-actions'));
    let section = null;
    function startSection(text) {
      section = make(document, 'section', '', ap ? 'rv-sec' : 'osr-section');
      if (text) section.append(make(document, ap ? 'h2' : 'h3', text));
      report.append(section);
    }
    const preamble = make(document, 'p', ap
      ? 'Teacher exemplar · fictional work, not a student submission. A Dataset ID beginning with EXEMPLAR identifies a sample without an ID in the source.'
      : 'Fictional model report. Use the explanations as an example; activity results can differ.', ap ? 'rv-sim' : 'osr-text');
    report.append(preamble);
    for (const el of content) {
      if (el.matches('section')) {
        const head = el.querySelector(':scope > h4, :scope > h3');
        startSection(clean(head));
        for (const child of el.children) if (child !== head) section.append(child.cloneNode(true));
      } else if (el.matches('h3,h4')) {
        startSection(clean(el));
      } else {
        (section || report).append(el.cloneNode(true));
      }
    }
    // Match the student table and headings without flattening any evidence.
    report.querySelectorAll('table').forEach(table => {
      table.classList.add(ap ? 'rv-table' : 'osr-table');
      if (!ap) table.parentElement?.classList.add('osr-table-wrap');
    });
    report.querySelectorAll('h5').forEach(heading => {
      const replacement = make(document, ap ? 'p' : 'h4', clean(heading), ap ? 'rv-q' : '');
      heading.replaceWith(replacement);
    });
    if (!ap) report.querySelectorAll('p').forEach(p => p.classList.add('osr-text'));
    // Exclude teacher-only grading notes while keeping the original exemplar on the notes page.
    report.querySelectorAll('.rv-sec,.osr-section').forEach(sec => {
      if (/^teacher grading notes?\b/i.test(clean(sec.firstElementChild))) sec.remove();
    });
    report.querySelectorAll('p').forEach(p => { if (/^teacher grading notes?:/i.test(clean(p))) p.remove(); });
    return { sample, report };
  }

  function openAP(sample, content) {
    const tab = window.open('', '_blank');
    if (!tab) return false;
    try {
      tab.opener = null;
      const view = tab.document;
      view.title = sample.title + ' — Teacher exemplar';
      view.documentElement.lang = 'en';
      view.documentElement.dataset.theme = 'light';
      const viewport = make(view, 'meta');
      viewport.name = 'viewport'; viewport.content = 'width=device-width, initial-scale=1';
      const base = make(view, 'base');
      base.href = document.baseURI;
      const cssUrl = new URL('style.css', document.baseURI).href;
      let sheetText = '';
      for (const sheet of document.styleSheets) {
        if (sheet.href !== cssUrl) continue;
        try { sheetText = Array.from(sheet.cssRules, rule => rule.cssText).join('\n'); }
        catch (_) { /* Keep the direct stylesheet fallback. */ }
        break;
      }
      const css = make(view, sheetText ? 'style' : 'link', sheetText);
      if (!sheetText) { css.rel = 'stylesheet'; css.href = cssUrl; }
      const extras = make(view, 'style', '.tn-exemplar-paper > * + *{margin-top:10px}.rv-table td,.rv-table th{overflow-wrap:anywhere}.rv-table thead{display:table-header-group}.rv-sec h4,.rv-q{break-after:avoid}.rv-paper figure img{max-width:100%;height:auto}.tn-exemplar-paper dt{font-weight:700}.tn-exemplar-paper dd{margin:0 0 .4rem .6rem}');
      const tools = make(view, 'div', '', 'rv-tools');
      const print = make(view, 'button', 'Print or save as PDF', 'btn btn--primary');
      print.type = 'button'; print.disabled = !sheetText;
      const hint = make(view, 'p', 'Choose “Save as PDF” in the print window. Close this tab to return to the teacher notes.', 'small');
      const status = make(view, 'p', '', 'rv-status');
      status.setAttribute('role', 'status');
      tools.append(print, hint, status);
      print.addEventListener('click', () => { try { tab.print(); } catch (_) { status.textContent = 'Try your browser’s Print command, then choose “Save as PDF”.'; } });
      if (!sheetText) {
        css.onload = () => { print.disabled = false; };
        css.onerror = () => { status.textContent = 'Could not load the report layout. Close this tab and open the exemplar again.'; };
      }
      const reportFonts = [...document.querySelectorAll('link[rel="stylesheet"]')].filter(link =>
        new URL(link.href, document.baseURI).hostname === 'fonts.googleapis.com');
      view.head.append(base, viewport, ...reportFonts.map(link => view.importNode(link, true)), css, extras);
      const shell = make(view, 'main', '', 'report-view');
      shell.id = 'lab-report';
      shell.append(tools, window.Lab.report.exemplarPaper(view, sample, content));
      view.body.classList.add('report-mode');
      view.body.append(shell);
      return true;
    } catch (_) {
      tab.close();
      return false;
    }
  }

  function mount() {
    const exportReport = ap ? openAP : window.OpenSciEdSubmission?.openExemplar;
    if (typeof exportReport !== 'function' || (ap && !window.Lab?.report?.exemplarPaper)) return;
    document.querySelectorAll('details.grade-report, details.full-model-report, details#lab5-model-report').forEach(details => {
      const summary = details.querySelector(':scope > summary');
      if (!summary) return;
      if (details.querySelector(':scope > .tn-exemplar-actions')) return;
      const controls = make(document, 'div', '', 'tn-exemplar-actions');
      const button = make(document, 'button', 'Print or save as PDF', 'btn btn--sm');
      button.type = 'button';
      const status = make(document, 'p', '', 'small');
      status.setAttribute('role', 'status');
      controls.append(button, status);
      summary.after(controls);
      button.addEventListener('click', () => {
        status.textContent = '';
        try {
          const payload = prepare(details);
          if (!payload) { status.textContent = 'Could not prepare this exemplar.'; return; }
          if (!exportReport(payload.sample, payload.report)) status.textContent = 'Could not open the preview. Allow pop-ups for this site and try again.';
        } catch (_) {
          status.textContent = 'Could not prepare the PDF. Try reloading the teacher notes.';
        }
      });
    });
  }

  if (ose) {
    const href = new URL('openscied-submission-report.css', document.baseURI).href;
    const complete = [...document.styleSheets].some(sheet => sheet.href === href);
    const getStyles = complete ? Promise.resolve() : new Promise((resolve, reject) => {
      const css = make(document, 'link');
      css.rel = 'stylesheet'; css.href = href;
      css.addEventListener('load', resolve, { once: true });
      css.addEventListener('error', reject, { once: true });
      document.head.append(css);
    });
    const getRenderer = window.OpenSciEdSubmission ? Promise.resolve() : new Promise((resolve, reject) => {
      const script = make(document, 'script');
      script.src = 'openscied-submission-report.js';
      script.addEventListener('load', resolve, { once: true });
      script.addEventListener('error', reject, { once: true });
      document.head.append(script);
    });
    Promise.all([getStyles, getRenderer]).then(mount, () => {
      const message = make(document, 'p', 'The exemplar PDF layout did not load. Reload the teacher notes to try again.', 'small');
      message.setAttribute('role', 'status');
      document.querySelector('main')?.prepend(message);
    });
  } else if (ap && !window.Lab?.report?.exemplarPaper) {
    const script = make(document, 'script');
    script.src = 'lab.js';
    script.addEventListener('load', mount, { once: true });
    document.head.append(script);
  } else mount();
})();
