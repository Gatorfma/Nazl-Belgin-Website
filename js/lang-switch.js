(function (root, factory) {
  'use strict';

  var api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
    return;
  }
  root.NBLangSwitch = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  function hrefWithHash(base, hash) {
    if (typeof hash !== 'string') return base;
    var trimmed = hash.trim();
    if (trimmed.length < 2 || trimmed.charAt(0) !== '#') return base;
    return base + trimmed;
  }

  /*
   * Carries the reader's section across a language change: #about on the
   * English page lands on /tr/#about.
   *
   * The base comes from data-lang-base, not from href, because href is what
   * we rewrite — reading it back would give /tr/#about#about on a second
   * click without navigation.
   *
   * Rewriting href on click rather than calling preventDefault keeps the
   * links working with JavaScript disabled; they just land at the top.
   */
  function wire(doc, win) {
    var links = doc.querySelectorAll('[data-lang-link]');
    Array.prototype.forEach.call(links, function (link) {
      link.addEventListener('click', function () {
        var base = link.getAttribute('data-lang-base') || link.getAttribute('href');
        link.setAttribute('href', hrefWithHash(base, win.location.hash));
      });
    });
  }

  return { hrefWithHash: hrefWithHash, wire: wire };
});
