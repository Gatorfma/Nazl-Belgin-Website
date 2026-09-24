'use strict';

var assert = require('node:assert/strict');
var test = require('node:test');
var scroll;

try {
  scroll = require('../js/art-works-scroll.js');
} catch (error) {
  assert.fail('Art Works scroll behavior module is missing.');
}

test('maps vertical travel to bounded horizontal progress', function () {
  assert.equal(scroll.progressFromPosition(120, 1000), 0);
  assert.equal(scroll.progressFromPosition(-500, 1000), 0.5);
  assert.equal(scroll.progressFromPosition(-1400, 1000), 1);
  assert.equal(scroll.progressFromPosition(-500, 0), 0);
});

test('maps progress to a leftward track translation', function () {
  assert.equal(scroll.translationForProgress(0, 900), 0);
  assert.equal(scroll.translationForProgress(0.5, 900), -450);
  assert.equal(scroll.translationForProgress(1, 900), -900);
});

test('first click opens a closed disclosure after it receives focus', function () {
  var listeners = {};
  var disclosure = {
    open: false,
    addEventListener: function (type, listener) {
      listeners[type] = listener;
    },
    contains: function () {
      return true;
    }
  };
  var style = {
    removeProperty: function () {}
  };
  var section = {
    style: style,
    querySelectorAll: function () {
      return [disclosure];
    },
    getBoundingClientRect: function () {
      return { top: 0 };
    }
  };
  var viewport = { clientWidth: 500 };
  var track = { scrollWidth: 900, style: style };
  var document = {
    activeElement: disclosure,
    getElementById: function (id) {
      return {
        'art-works-showcase': section,
        'art-works-viewport': viewport,
        'art-works-track': track
      }[id];
    }
  };
  var window = {
    innerHeight: 800,
    innerWidth: 1024,
    addEventListener: function () {},
    matchMedia: function (query) {
      return {
        matches: query.includes('hover: hover'),
        addEventListener: function () {}
      };
    },
    requestAnimationFrame: function () {
      return 1;
    },
    setTimeout: function (callback) {
      callback();
    }
  };

  scroll.init(document, window);
  if (listeners.focusin) listeners.focusin();
  disclosure.open = !disclosure.open;

  assert.equal(disclosure.open, true);
});

test('scrolling across Art Works switches the open top-level disclosure', function () {
  var sectionTop = 0;
  var pendingFrame = null;
  var windowListeners = {};
  var style = {
    removeProperty: function () {}
  };
  var disclosures = [
    { open: false, addEventListener: function () {}, contains: function () { return false; } },
    { open: false, addEventListener: function () {}, contains: function () { return false; } }
  ];
  var section = {
    style: style,
    querySelectorAll: function (selector) {
      return selector === '[data-scroll-disclosure]' ? disclosures : [];
    },
    getBoundingClientRect: function () {
      return { top: sectionTop };
    }
  };
  var viewport = { clientWidth: 500 };
  var track = { scrollWidth: 1100, style: style };
  var document = {
    activeElement: null,
    getElementById: function (id) {
      return {
        'art-works-showcase': section,
        'art-works-viewport': viewport,
        'art-works-track': track
      }[id];
    }
  };
  var window = {
    innerHeight: 800,
    innerWidth: 1024,
    addEventListener: function (type, listener) {
      windowListeners[type] = listener;
    },
    matchMedia: function (query) {
      return {
        matches: query.includes('hover: hover'),
        addEventListener: function () {}
      };
    },
    requestAnimationFrame: function (callback) {
      pendingFrame = callback;
      return 1;
    },
    setTimeout: function (callback) {
      callback();
    }
  };
  function flushFrame() {
    var callback = pendingFrame;
    pendingFrame = null;
    callback();
  }

  scroll.init(document, window);
  flushFrame();
  assert.deepEqual(disclosures.map(function (item) { return item.open; }), [true, false]);

  sectionTop = -360;
  windowListeners.scroll();
  flushFrame();
  assert.deepEqual(disclosures.map(function (item) { return item.open; }), [false, true]);
});

test('artist disclosures ignore hover and use a one-at-a-time click accordion', function () {
  function createDisclosure() {
    var listeners = {};
    return {
      open: false,
      addEventListener: function (type, listener) {
        listeners[type] = listener;
      },
      contains: function () {
        return false;
      },
      fire: function (type) {
        if (listeners[type]) listeners[type]();
      }
    };
  }

  var artists = [createDisclosure(), createDisclosure(), createDisclosure()];
  var style = { removeProperty: function () {} };
  var section = {
    style: style,
    querySelectorAll: function (selector) {
      if (selector === '[data-hover-disclosure]') return [];
      if (selector === '[data-artist-disclosure]') return artists;
      return [];
    },
    getBoundingClientRect: function () {
      return { top: 0 };
    }
  };
  var viewport = { clientWidth: 500 };
  var track = { scrollWidth: 900, style: style };
  var document = {
    activeElement: null,
    getElementById: function (id) {
      return {
        'art-works-showcase': section,
        'art-works-viewport': viewport,
        'art-works-track': track
      }[id];
    }
  };
  var window = {
    innerHeight: 800,
    innerWidth: 1024,
    addEventListener: function () {},
    matchMedia: function (query) {
      return {
        matches: query.includes('hover: hover'),
        addEventListener: function () {}
      };
    },
    requestAnimationFrame: function () {
      return 1;
    },
    setTimeout: function (callback) {
      callback();
    }
  };

  scroll.init(document, window);
  artists[0].fire('mouseenter');
  assert.deepEqual(artists.map(function (item) { return item.open; }), [false, false, false]);

  artists[0].open = true;
  artists[0].fire('toggle');
  assert.deepEqual(artists.map(function (item) { return item.open; }), [true, false, false]);

  artists[0].fire('mouseleave');
  assert.deepEqual(artists.map(function (item) { return item.open; }), [true, false, false]);

  artists[1].open = true;
  artists[1].fire('toggle');
  assert.deepEqual(artists.map(function (item) { return item.open; }), [false, true, false]);

  artists[1].open = false;
  artists[1].fire('toggle');
  assert.deepEqual(artists.map(function (item) { return item.open; }), [false, false, false]);
});

test('content refresh wires new artist disclosures without duplicating existing handlers', function () {
  function createDisclosure() {
    var listeners = {};
    return {
      open: false,
      addEventListener: function (type, listener) {
        if (!listeners[type]) listeners[type] = [];
        listeners[type].push(listener);
      },
      contains: function () { return false; },
      fire: function (type) {
        (listeners[type] || []).forEach(function (listener) { listener(); });
      },
      listenerCount: function (type) { return (listeners[type] || []).length; }
    };
  }

  var documentListeners = {};
  var artists = [createDisclosure()];
  var style = { removeProperty: function () {} };
  var section = {
    style: style,
    querySelectorAll: function (selector) {
      return selector === '[data-artist-disclosure]' ? artists : [];
    },
    getBoundingClientRect: function () { return { top: 0 }; }
  };
  var document = {
    activeElement: null,
    addEventListener: function (type, listener) { documentListeners[type] = listener; },
    getElementById: function (id) {
      return {
        'art-works-showcase': section,
        'art-works-viewport': { clientWidth: 500 },
        'art-works-track': { scrollWidth: 900, style: style }
      }[id];
    }
  };
  var window = {
    innerHeight: 800,
    innerWidth: 1024,
    addEventListener: function () {},
    matchMedia: function () { return { matches: false, addEventListener: function () {} }; },
    requestAnimationFrame: function () { return 1; },
    setTimeout: function (callback) { callback(); }
  };

  scroll.init(document, window);
  var added = createDisclosure();
  artists.push(added);
  documentListeners['nb:content-updated']();

  assert.equal(artists[0].listenerCount('toggle'), 1);
  assert.equal(added.listenerCount('toggle'), 1);
  artists[0].open = true;
  added.open = true;
  added.fire('toggle');
  assert.deepEqual(artists.map(function (item) { return item.open; }), [false, true]);
});
