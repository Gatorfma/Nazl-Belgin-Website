'use strict';

var assert = require('node:assert/strict');
var test = require('node:test');
var terms = require('../js/i18n-terms.js');

test('translates a known series into Turkish', function () {
  assert.equal(terms.translateTerm('series', 'Monsters', 'tr'), 'Canavarlar');
});

test('translates a known series into Arabic', function () {
  assert.equal(terms.translateTerm('series', 'Stone Hills', 'ar'), 'تلال حجرية');
});

test('translates the medium the database actually stores', function () {
  assert.equal(terms.translateTerm('medium', 'Acrylic on canvas', 'tr'),
    'Tuval üzerine akrilik');
});

test('translates the static fallback medium too', function () {
  assert.equal(terms.translateTerm('medium', 'Oil on canvas', 'tr'),
    'Tuval üzerine yağlıboya');
});

// Two rows carry data-entry typos. Until they are fixed in the database,
// mapping them keeps the translated pages free of stray English.
test('tolerates the known typo variants of the medium', function () {
  assert.equal(terms.translateTerm('medium', 'Acrylic  on canvas', 'tr'),
    'Tuval üzerine akrilik');
  assert.equal(terms.translateTerm('medium', "Acryl'c on canvas", 'tr'),
    'Tuval üzerine akrilik');
});

test('returns the stored value for English', function () {
  assert.equal(terms.translateTerm('series', 'Monsters', 'en'), 'Monsters');
});

// Review Focus: the studio can add a series after launch. An unmapped value
// must fall back to the stored English string, never undefined or empty.
test('falls back to the stored value for an unknown series', function () {
  assert.equal(terms.translateTerm('series', 'New Series', 'tr'), 'New Series');
});

test('falls back for an unknown kind or language', function () {
  assert.equal(terms.translateTerm('colour', 'Blue', 'tr'), 'Blue');
  assert.equal(terms.translateTerm('series', 'Monsters', 'de'), 'Monsters');
});

test('returns empty string for empty input rather than undefined', function () {
  assert.equal(terms.translateTerm('series', '', 'tr'), '');
  assert.equal(terms.translateTerm('series', null, 'tr'), '');
});

test('currentLang reads the document language and defaults to en', function () {
  var withLang = { documentElement: { getAttribute: function () { return 'ar'; } } };
  var without = { documentElement: { getAttribute: function () { return null; } } };
  assert.equal(terms.currentLang(withLang), 'ar');
  assert.equal(terms.currentLang(without), 'en');
});

test('every series stored in the database has a translation', function () {
  ['Monsters', 'Evolution', 'Stone Hills'].forEach(function (series) {
    ['tr', 'ar'].forEach(function (lang) {
      assert.notEqual(terms.translateTerm('series', series, lang), series,
        series + ' has no ' + lang + ' translation');
    });
  });
});

// Strings generated in JS rather than marked in the HTML. They live in the
// same dictionary so there is one translation mechanism, not two.
test('translates JS-generated UI strings', function () {
  assert.equal(terms.translateTerm('ui', 'Untitled', 'tr'), 'İsimsiz');
  assert.equal(terms.translateTerm('ui', 'Untitled', 'ar'), 'بدون عنوان');
  assert.equal(terms.translateTerm('ui', 'All', 'tr'), 'Tümü');
  assert.equal(terms.translateTerm('ui', 'All', 'ar'), 'الكل');
});

test('UI strings fall back to English', function () {
  assert.equal(terms.translateTerm('ui', 'All', 'en'), 'All');
  assert.equal(terms.translateTerm('ui', 'Unmapped', 'tr'), 'Unmapped');
});
