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

test('applyTranslations replaces element text', function () {
  var html = '<p data-i18n="hero.note">Hello</p>';
  var out = transform.applyTranslations(html, { 'hero.note': 'Merhaba' });
  assert.match(out, /<p data-i18n="hero\.note">Merhaba<\/p>/);
});

test('applyTranslations replaces attribute values', function () {
  var html = '<meta data-i18n-attr="content:meta.description" content="English">';
  var out = transform.applyTranslations(html, { 'meta.description': 'Türkçe' });
  assert.match(out, /content="Türkçe"/);
  assert.doesNotMatch(out, /English/);
});

// Review Focus: translated text containing HTML-special characters must be
// escaped so it renders as characters and cannot inject markup.
test('applyTranslations escapes special characters in text', function () {
  var html = '<p data-i18n="k">x</p>';
  var out = transform.applyTranslations(html, { k: 'Ödül & <Sergi>' });
  assert.match(out, /Ödül &amp; &lt;Sergi&gt;/);
  assert.doesNotMatch(out, /<Sergi>/);
});

test('applyTranslations escapes quotes in attribute values', function () {
  var html = '<img data-i18n-attr="alt:k" alt="x">';
  var out = transform.applyTranslations(html, { k: 'Nazlı\'nın "portresi"' });
  assert.match(out, /alt="Nazlı&#39;nın &quot;portresi&quot;"/);
});

test('applyTranslations leaves unmarked elements untouched', function () {
  var html = '<a class="nav__mark">Nazlı Belgin</a><p data-i18n="k">x</p>';
  var out = transform.applyTranslations(html, { k: 'y' });
  assert.match(out, /<a class="nav__mark">Nazlı Belgin<\/a>/);
});
