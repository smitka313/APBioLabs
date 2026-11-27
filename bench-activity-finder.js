/* Filter the existing cards in place. No network calls, tracking, or saved state. */
(function () {
  'use strict';

  function tokens(value) {
    return value.normalize('NFKD').toLowerCase().replace(/\p{M}/gu, '')
      .match(/[a-z]+|[0-9]+/g) || [];
  }

  function numberedLessons(value) {
    const lessons = new Set();
    const phrase = value.match(/\blessons?\s*(\d+(?:(?:\s*[–—,-]\s*|\s+and\s+)\d+)*)/i)?.[1];
    if (!phrase) return lessons;
    const parts = phrase.split(/\s*(?:,|\band\b)\s*/);
    for (const part of parts) {
      const [first, last = first] = part.split(/\s*[–—-]\s*/).map(Number);
      // The lesson text is authored on the card, not fetched. Keep expansion bounded.
      if (first > 0 && last >= first && last <= 99) {
        for (let i = first; i <= last; i++) lessons.add(i);
      }
    }
    return lessons;
  }

  function queryFor(value, ap) {
    const query = { terms: [], group: null, lab: null, lessons: new Set() };
    let normal = value.trim();
    if (ap) {
      const namedLab = normal.match(/\b(?:lab|investigation)\s*#?\s*([0-9]+)\b/i) || normal.match(/^([0-9]+)$/);
      if (namedLab) {
        normal = normal.replace(/^ap(?:\s+biology)?\s+/i, '');
        query.lab = Number(namedLab[1]);
        normal = normal.replace(namedLab[0], '');
      }
      normal = normal.replace(/\bbig\s+idea\s*#?\s*([0-9]+)\b/i, (_, id) => {
        query.group = 'bi' + Number(id);
        return '';
      });
    } else {
      normal = normal.replace(/^openscied\s+/i, '');
      normal = normal.replace(/\b(?:unit\s+(?:b\s*\.?\s*)?|b\s*\.\s*)([0-9]+)\b/i, (_, id) => {
        query.group = 'unit' + Number(id);
        return '';
      });
      query.lessons = numberedLessons(normal);
      if (query.lessons.size) {
        normal = normal.replace(/\blessons?\s*\d+(?:(?:\s*[–—,-]\s*|\s+and\s+)\d+)*/i, '');
      }
    }
    query.terms = tokens(normal);
    return query;
  }

  function matches(card, query, filter) {
    if (filter && card.group !== filter) return false;
    if (query.group && card.group !== query.group) return false;
    if (query.lab !== null && card.lab !== query.lab) return false;
    if ([...query.lessons].some(lesson => !card.lessons.has(lesson))) return false;
    return query.terms.every(term => card.words.some(word =>
      /^\d+$/.test(term) ? word === term : word.startsWith(term)));
  }

  function mount(doc) {
    const form = doc.querySelector('[data-activity-finder]');
    if (!form) return;
    const ap = form.dataset.activityFinder === 'ap';
    const search = form.querySelector('#activity-search');
    const group = form.querySelector('#activity-group');
    const clear = form.querySelector('.activity-finder-clear');
    const status = form.querySelector('[role="status"]');
    if (!search || !group || !clear || !status) return;
    const sectionSelector = ap ? '#labs > .bi[aria-labelledby^="bi"]' : '#activities > .dashboard-unit';
    const cardSelector = ap ? '.cards > a.card' : 'article.dashboard-activity';
    const fieldSelector = ap ? 'h3, .dq, .sim-line, .meta .tag' : 'h3, .dashboard-meta + p, .dashboard-caption-text, .dashboard-caption .dashboard-badge';
    const groups = Array.from(doc.querySelectorAll(sectionSelector), section => {
      const id = section.getAttribute('aria-labelledby');
      const context = doc.getElementById(id)?.textContent || '';
      const cards = [...section.querySelectorAll(cardSelector)].map(element => {
        const texts = Array.from(element.querySelectorAll(fieldSelector), node => node.textContent);
        return {
          element, group: id,
          lab: ap ? Number(element.getAttribute('href')?.match(/lab(\d+)\.html$/i)?.[1]) : null,
          lessons: ap ? new Set() : numberedLessons(element.querySelector('.dashboard-meta')?.textContent || ''),
          words: [...new Set(tokens([context, ...texts].join(' ')))],
        };
      });
      return { section, id, cards };
    });
    if (!groups.length) return;
    const total = groups.reduce((sum, { cards }) => sum + cards.length, 0);

    function update() {
      const query = queryFor(search.value, ap);
      let count = 0;
      for (const { section, cards } of groups) {
        let visible = 0;
        for (const card of cards) {
          const show = matches(card, query, group.value);
          card.element.toggleAttribute('data-activity-finder-excluded', !show);
          if (show) visible++;
        }
        section.toggleAttribute('data-activity-finder-excluded', !visible);
        count += visible;
      }
      const summary = count === 0 ? 'No matches. Try a different search or clear filters.'
        : count === total ? total + ' activities'
          : count + ' of ' + total + ' activities';
      if (status.textContent !== summary) status.textContent = summary;
    }

    function reset() {
      search.value = '';
      group.value = '';
      update();
    }

    search.addEventListener('input', update);
    group.addEventListener('change', update);
    form.addEventListener('submit', event => {
      event.preventDefault();
      update();
    });
    clear.addEventListener('click', () => {
      reset();
      search.focus();
    });
    // Explicit unit jumps beat a filter that would otherwise hide their target.
    // Do this before the link's native fragment navigation, without rewriting it.
    doc.addEventListener('click', event => {
      if (event.defaultPrevented || event.button !== 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      const href = event.target.closest?.('.dashboard-unit-jumps a')?.getAttribute('href');
      const section = groups.find(item => '#' + item.id === href)?.section;
      if (section?.hasAttribute('data-activity-finder-excluded')) reset();
    });
    update();
  }

  if (typeof module === 'object' && module.exports) module.exports = { tokens, numberedLessons, queryFor, matches };
  else mount(document);
})();
