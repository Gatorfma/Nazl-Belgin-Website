'use strict';

var assert = require('node:assert/strict');
var test = require('node:test');
var langSwitch = require('../js/lang-switch.js');

test('appends the current hash to the target href', function () {
  assert.equal(langSwitch.hrefWithHash('/tr/', '#about'), '/tr/#about');
  assert.equal(langSwitch.hrefWithHash('/', '#contact'), '/#contact');
});

test('returns the base href when there is no hash', function () {
  assert.equal(langSwitch.hrefWithHash('/tr/', ''), '/tr/');
  assert.equal(langSwitch.hrefWithHash('/tr/', '#'), '/tr/');
});

test('ignores a non-string hash', function () {
  assert.equal(langSwitch.hrefWithHash('/ar/', null), '/ar/');
  assert.equal(langSwitch.hrefWithHash('/ar/', undefined), '/ar/');
});

test('repeated clicks do not compound the hash', function () {
  var attrs = { 'data-lang-base': '/tr/', href: '/tr/' };
  var handlers = [];
  var link = {
    getAttribute: function (name) { return attrs[name]; },
    setAttribute: function (name, value) { attrs[name] = value; },
    addEventListener: function (_event, fn) { handlers.push(fn); }
  };
  var doc = { querySelectorAll: function () { return [link]; } };

  langSwitch.wire(doc, { location: { hash: '#about' } });
  handlers[0]();
  handlers[0]();

  assert.equal(attrs.href, '/tr/#about');
});

test('wire reads the hash at click time, not at wiring time', function () {
  var attrs = { 'data-lang-base': '/ar/', href: '/ar/' };
  var handlers = [];
  var link = {
    getAttribute: function (name) { return attrs[name]; },
    setAttribute: function (name, value) { attrs[name] = value; },
    addEventListener: function (_event, fn) { handlers.push(fn); }
  };
  var doc = { querySelectorAll: function () { return [link]; } };
  var win = { location: { hash: '' } };

  langSwitch.wire(doc, win);
  win.location.hash = '#manifesto';
  handlers[0]();

  assert.equal(attrs.href, '/ar/#manifesto');
});
