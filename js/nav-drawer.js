(function (root, factory) {
  'use strict';

  var api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
    return;
  }
  root.NBNavDrawer = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  /*
   * The mobile header: a side drawer holding the nav links, and a language
   * dropdown beside it.
   *
   * Both panels are the SAME elements the desktop header uses — .nav__links
   * becomes the drawer and .nav__langs becomes the dropdown, repositioned by
   * CSS below the breakpoint. Nothing is duplicated, so the link list and the
   * translation markers stay in one place.
   *
   * Only one panel is open at a time: opening either closes the other.
   */

  var OPEN = 'is-open';

  function create(refs) {
    if (!refs || !refs.drawer || !refs.burger) return null;

    var state = { drawer: false, lang: false };
    var wired = false;

    function sync() {
      refs.drawer.classList.toggle(OPEN, state.drawer);
      refs.burger.setAttribute('aria-expanded', String(state.drawer));

      if (refs.langPanel) refs.langPanel.classList.toggle(OPEN, state.lang);
      if (refs.langButton) {
        refs.langButton.setAttribute('aria-expanded', String(state.lang));
      }
      if (refs.scrim) refs.scrim.hidden = !state.drawer;

      // Hold the page still behind the drawer; the dropdown is small enough
      // not to need it.
      if (refs.body) refs.body.style.overflow = state.drawer ? 'hidden' : '';
    }

    function set(which, open) {
      state.drawer = which === 'drawer' ? open : false;
      state.lang = which === 'lang' ? open : false;
      sync();
    }

    function openDrawer() { set('drawer', true); }
    function closeDrawer() { set('drawer', false); }
    function openLang() { set('lang', true); }
    function closeLang() { set('lang', false); }
    function closeAll() { set(null, false); }
    function toggleDrawer() { set('drawer', !state.drawer); }
    function toggleLang() { set('lang', !state.lang); }

    function handleKey(event) {
      if (!event || event.key !== 'Escape') return;
      if (state.drawer || state.lang) closeAll();
    }

    function wire(win) {
      if (wired) return;
      wired = true;

      refs.burger.addEventListener('click', toggleDrawer);
      if (refs.langButton) refs.langButton.addEventListener('click', toggleLang);
      if (refs.scrim) refs.scrim.addEventListener('click', closeDrawer);

      // Following a link inside the drawer should close it; a tap on the
      // panel's own padding should not.
      refs.drawer.addEventListener('click', function (event) {
        var target = event && event.target;
        if (target && typeof target.closest === 'function' && target.closest('a')) {
          closeDrawer();
        }
      });

      if (win && win.addEventListener) win.addEventListener('keydown', handleKey);
    }

    sync();

    return {
      openDrawer: openDrawer,
      closeDrawer: closeDrawer,
      toggleDrawer: toggleDrawer,
      openLang: openLang,
      closeLang: closeLang,
      toggleLang: toggleLang,
      closeAll: closeAll,
      handleKey: handleKey,
      wire: wire
    };
  }

  // The button shows the active language code. Reading it from the marked
  // link means adding a language needs no new translation key.
  function activeLangLabel(doc) {
    var active = doc && doc.querySelector
      ? doc.querySelector('.nav__langs a[aria-current="true"]')
      : null;
    var text = active && active.textContent ? active.textContent.trim() : '';
    return text || 'EN';
  }

  return { create: create, activeLangLabel: activeLangLabel };
});
