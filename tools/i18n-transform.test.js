'use strict';

var assert = require('node:assert/strict');
var test = require('node:test');
var transform = require('./i18n-transform.js');

test('collectKeys finds text keys', function () {
  var html = '<p data-i18n="hero.note">Hello</p><a data-i18n="nav.work">Work</a>';
  assert.deepEqual(transform.collectKeys(html).text, ['hero.note', 'nav.work']);
});

test('collectKeys finds attribute keys', function () {
  var html = '<meta data-i18n-attr="content:meta.description" content="x">';
  assert.deepEqual(transform.collectKeys(html).attr, ['meta.description']);
});

test('collectKeys handles multiple attributes in one spec', function () {
  var html = '<img data-i18n-attr="alt:a.alt,title:a.title" alt="x" title="y">';
  assert.deepEqual(transform.collectKeys(html).attr, ['a.alt', 'a.title']);
});

test('collectKeys de-duplicates and sorts', function () {
  var html = '<p data-i18n="b">1</p><p data-i18n="a">2</p><p data-i18n="b">3</p>';
  assert.deepEqual(transform.collectKeys(html).text, ['a', 'b']);
});

test('parseAttrSpec tolerates spaces', function () {
  assert.deepEqual(transform.parseAttrSpec(' alt:a.alt , content:b.c '), [
    { attribute: 'alt', key: 'a.alt' },
    { attribute: 'content', key: 'b.c' }
  ]);
});
