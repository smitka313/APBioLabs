/* In-page players: keep third-party requests off until a student opens a clip. */
(function () {
  'use strict';
  const videos = Array.from(document.querySelectorAll('details.ose-video')).map(panel => ({
    panel,
    source: panel.querySelector('template'),
    frame: null,
  })).filter(video => video.source?.content.querySelector('iframe'));
  if (!videos.length) return;

  const refresh = () => {
    for (const video of videos) {
      const { panel, source } = video;
      // Dialogs, disclosures and activity sections can hide a running player.
      // Unmount it so playback stops and reopening the page never resumes it by surprise.
      const visible = !panel.closest('[hidden], [inert], dialog:not([open])') && panel.getClientRects().length > 0;
      if (!visible && panel.open) panel.open = false;
      if (panel.open && visible) {
        if (video.frame) continue;
        const frame = source.content.querySelector('iframe').cloneNode(true);
        video.frame = frame;
        source.after(frame);
      } else if (video.frame) {
        video.frame.remove();
        video.frame = null;
      }
    }
  };
  const observer = new MutationObserver(refresh);
  const watched = new Set();
  for (const { panel } of videos) {
    panel.addEventListener('toggle', refresh);
    for (let ancestor = panel; ancestor; ancestor = ancestor.parentElement) {
      if (watched.has(ancestor)) break;
      watched.add(ancestor);
      observer.observe(ancestor, { attributes: true, attributeFilter: ['open', 'hidden', 'inert', 'class'] });
    }
  }
  refresh();
})();
