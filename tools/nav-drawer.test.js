'use strict';

var assert = require('node:assert/strict');
var test = require('node:test');
var navDrawer = require('../js/nav-drawer.js');

function fakeClassList() {
  var names = Object.create(null);
  return {
    add: function (n) { names[n] = true; },
    remove: function (n) { delete names[n]; },
    contains: function (n) { return !!names[n]; },
    toggle: function (n, force) {
      if (force === undefined) force = !names[n];
      if (force) names[n] = true; else delete names[n];
      return force;
    }
  };
}

function fakeEl(tag) {
  var attrs = Object.create(null);
  var handlers = Object.create(null);
  return {
    tagName: (tag || 'div').toUpperCase(),
    hidden: false,
    classList: fakeClassList(),
    style: {},
    getAttribute: function (n) { return n in attrs ? attrs[n] : null; },
    setAttribute: function (n, v) { attrs[n] = String(v); },
    addEventListener: function (type, fn) {
      (handlers[type] = handlers[type] || []).push(fn);
    },
    fire: function (type, event) {
      (handlers[type] || []).forEach(function (fn) { fn(event || {}); });
    },
    handlerCount: function (type) { return (handlers[type] || []).length; }
  };
}

function harness() {
  var refs = {
    drawer: fakeEl(),
    burger: fakeEl('button'),
    langPanel: fakeEl(),
    langButton: fakeEl('button'),
    scrim: fakeEl(),
    body: fakeEl('body')
  };
  return { refs: refs, nav: navDrawer.create(refs) };
}

test('starts closed with both buttons reporting collapsed', function () {
  var h = harness();
  assert.equal(h.refs.drawer.classList.contains('is-open'), false);
  assert.equal(h.refs.burger.getAttribute('aria-expanded'), 'false');
  assert.equal(h.refs.langButton.getAttribute('aria-expanded'), 'false');
  assert.equal(h.refs.scrim.hidden, true);
});

test('opening the drawer sets the class, aria state and scrim', function () {
  var h = harness();
  h.nav.openDrawer();
  assert.equal(h.refs.drawer.classList.contains('is-open'), true);
  assert.equal(h.refs.burger.getAttribute('aria-expanded'), 'true');
  assert.equal(h.refs.scrim.hidden, false);
});

test('the drawer locks page scroll while open and restores it on close', function () {
  var h = harness();
  h.nav.openDrawer();
  assert.equal(h.refs.body.style.overflow, 'hidden');
  h.nav.closeDrawer();
  assert.equal(h.refs.body.style.overflow, '');
});

test('opening the language menu closes the drawer', function () {
  var h = harness();
  h.nav.openDrawer();
  h.nav.openLang();
  assert.equal(h.refs.langPanel.classList.contains('is-open'), true);
  assert.equal(h.refs.drawer.classList.contains('is-open'), false);
  assert.equal(h.refs.burger.getAttribute('aria-expanded'), 'false');
});

test('opening the drawer closes the language menu', function () {
  var h = harness();
  h.nav.openLang();
  h.nav.openDrawer();
  assert.equal(h.refs.drawer.classList.contains('is-open'), true);
  assert.equal(h.refs.langPanel.classList.contains('is-open'), false);
  assert.equal(h.refs.langButton.getAttribute('aria-expanded'), 'false');
});

test('escape closes whichever panel is open', function () {
  var h = harness();
  h.nav.openDrawer();
  h.nav.handleKey({ key: 'Escape' });
  assert.equal(h.refs.drawer.classList.contains('is-open'), false);

  h.nav.openLang();
  h.nav.handleKey({ key: 'Escape' });
  assert.equal(h.refs.langPanel.classList.contains('is-open'), false);
});

test('a key other than escape changes nothing', function () {
  var h = harness();
  h.nav.openDrawer();
  h.nav.handleKey({ key: 'a' });
  assert.equal(h.refs.drawer.classList.contains('is-open'), true);
});

test('closeAll closes both and leaves scroll unlocked', function () {
  var h = harness();
  h.nav.openLang();
  h.nav.closeAll();
  assert.equal(h.refs.langPanel.classList.contains('is-open'), false);
  assert.equal(h.refs.drawer.classList.contains('is-open'), false);
  assert.equal(h.refs.body.style.overflow, '');
});

test('toggles flip state rather than only opening', function () {
  var h = harness();
  h.nav.toggleDrawer();
  assert.equal(h.refs.drawer.classList.contains('is-open'), true);
  h.nav.toggleDrawer();
  assert.equal(h.refs.drawer.classList.contains('is-open'), false);
});

test('wire closes the drawer when the scrim is clicked', function () {
  var h = harness();
  h.nav.wire();
  h.nav.openDrawer();
  h.refs.scrim.fire('click');
  assert.equal(h.refs.drawer.classList.contains('is-open'), false);
});

test('wire closes the drawer when a link inside it is followed', function () {
  var h = harness();
  h.nav.wire();
  h.nav.openDrawer();
  h.refs.drawer.fire('click', { target: { closest: function (sel) {
    return sel === 'a' ? {} : null;
  } } });
  assert.equal(h.refs.drawer.classList.contains('is-open'), false);
});

test('wire leaves the drawer open when the click missed a link', function () {
  var h = harness();
  h.nav.wire();
  h.nav.openDrawer();
  h.refs.drawer.fire('click', { target: { closest: function () { return null; } } });
  assert.equal(h.refs.drawer.classList.contains('is-open'), true);
});

test('wire makes the buttons toggle their own panel', function () {
  var h = harness();
  h.nav.wire();
  h.refs.burger.fire('click');
  assert.equal(h.refs.drawer.classList.contains('is-open'), true);
  h.refs.langButton.fire('click');
  assert.equal(h.refs.langPanel.classList.contains('is-open'), true);
  assert.equal(h.refs.drawer.classList.contains('is-open'), false);
});

test('wire is idempotent so a second call does not double-bind', function () {
  var h = harness();
  h.nav.wire();
  h.nav.wire();
  h.refs.burger.fire('click');
  assert.equal(h.refs.drawer.classList.contains('is-open'), true);
});

test('create tolerates a missing optional element', function () {
  var refs = {
    drawer: fakeEl(), burger: fakeEl('button'),
    langPanel: fakeEl(), langButton: fakeEl('button')
  };
  var nav = navDrawer.create(refs);
  assert.doesNotThrow(function () {
    nav.wire();
    nav.openDrawer();
    nav.closeAll();
  });
});

test('create returns null when a required element is absent', function () {
  assert.equal(navDrawer.create({ drawer: null, burger: fakeEl('button') }), null);
});

// The button label is the active language code, read from the markup rather
// than from a dictionary, so adding a language needs no new translation key.
test('activeLangLabel reads the marked language, falling back to EN', function () {
  var marked = { textContent: ' TR ' };
  assert.equal(navDrawer.activeLangLabel({
    querySelector: function () { return marked; }
  }), 'TR');
  assert.equal(navDrawer.activeLangLabel({
    querySelector: function () { return null; }
  }), 'EN');
});
