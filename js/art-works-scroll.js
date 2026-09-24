(function (root, factory) {
  'use strict';

  var api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
    return;
  }

  root.ArtWorksScroll = api;
  api.init(root.document, root);
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function progressFromPosition(sectionTop, scrollDistance) {
    if (!Number.isFinite(scrollDistance) || scrollDistance <= 0) return 0;
    return clamp(-sectionTop / scrollDistance, 0, 1);
  }

  function translationForProgress(progress, maxShift) {
    if (!Number.isFinite(maxShift) || maxShift <= 0) return 0;
    var boundedProgress = clamp(progress, 0, 1);
    return boundedProgress === 0 ? 0 : -boundedProgress * maxShift;
  }

  var activeController = null;

  function init(document, window) {
    var section = document.getElementById('art-works-showcase');
    var viewport = document.getElementById('art-works-viewport');
    var track = document.getElementById('art-works-track');
    if (!section || !viewport || !track) return;

    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    var hoverPointer = window.matchMedia('(hover: hover) and (pointer: fine)');
    var scrollDisclosures = [];
    var artistDisclosures = [];
    var wiredHover = [];
    var wiredArtists = [];
    var maxShift = 0;
    var scrollDistance = 0;
    var frame = 0;

    function canPin() {
      return window.innerWidth > 720 && !reduceMotion.matches;
    }

    function paint() {
      frame = 0;
      if (!canPin()) return;
      var progress = progressFromPosition(section.getBoundingClientRect().top, scrollDistance);
      var translation = translationForProgress(progress, maxShift);
      var activeIndex = Math.round(progress * Math.max(0, scrollDisclosures.length - 1));
      track.style.transform = 'translate3d(' + translation + 'px, 0, 0)';
      Array.prototype.forEach.call(scrollDisclosures, function (disclosure, index) {
        disclosure.open = index === activeIndex;
      });
    }

    function requestPaint() {
      if (!frame) frame = window.requestAnimationFrame(paint);
    }

    function measure() {
      if (!canPin()) {
        section.style.removeProperty('height');
        track.style.removeProperty('transform');
        return;
      }

      maxShift = Math.max(0, track.scrollWidth - viewport.clientWidth);
      scrollDistance = maxShift;
      section.style.height = window.innerHeight + scrollDistance + 'px';
      requestPaint();
    }

    function closeAfterFocusLeaves(disclosure) {
      window.setTimeout(function () {
        if (!disclosure.contains(document.activeElement)) disclosure.open = false;
      }, 0);
    }

    function openArtistDisclosure(activeDisclosure) {
      Array.prototype.forEach.call(artistDisclosures, function (artistDisclosure) {
        artistDisclosure.open = artistDisclosure === activeDisclosure;
      });
    }

    function wireHoverDisclosures() {
      Array.prototype.forEach.call(section.querySelectorAll('[data-hover-disclosure]'), function (disclosure) {
        if (wiredHover.indexOf(disclosure) !== -1) return;
        wiredHover.push(disclosure);
        disclosure.addEventListener('mouseenter', function () {
          if (hoverPointer.matches) disclosure.open = true;
        });
        disclosure.addEventListener('mouseleave', function () {
          if (hoverPointer.matches && !disclosure.contains(document.activeElement)) {
            disclosure.open = false;
          }
        });
        disclosure.addEventListener('focusout', function () {
          closeAfterFocusLeaves(disclosure);
        });
      });
    }

    function wireArtistDisclosures() {
      Array.prototype.forEach.call(artistDisclosures, function (disclosure) {
        if (wiredArtists.indexOf(disclosure) !== -1) return;
        wiredArtists.push(disclosure);
        disclosure.addEventListener('toggle', function () {
          if (disclosure.open) openArtistDisclosure(disclosure);
        });
      });
    }

    function refresh() {
      scrollDisclosures = section.querySelectorAll('[data-scroll-disclosure]');
      artistDisclosures = section.querySelectorAll('[data-artist-disclosure]');
      wireHoverDisclosures();
      wireArtistDisclosures();
      measure();
    }

    window.addEventListener('scroll', requestPaint, { passive: true });
    window.addEventListener('resize', measure);
    if (typeof reduceMotion.addEventListener === 'function') {
      reduceMotion.addEventListener('change', measure);
    }
    window.addEventListener('load', measure, { once: true });
    if (typeof document.addEventListener === 'function') {
      document.addEventListener('nb:content-updated', refresh);
    }
    activeController = { refresh: refresh };
    refresh();
    return activeController;
  }

  return {
    init: init,
    refresh: function () { if (activeController) activeController.refresh(); },
    progressFromPosition: progressFromPosition,
    translationForProgress: translationForProgress
  };
});
