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

// Final review, Important #4: these reach every visitor on /tr/ and /ar/ but
// were still English. The contact form is the site's only conversion point.
test('translates the public lightbox and form strings', function () {
  assert.equal(terms.translateTerm('ui', 'Click anywhere to close', 'tr'),
    'Kapatmak için herhangi bir yere tıklayın');
  assert.equal(terms.translateTerm('ui', 'Send', 'ar'), 'إرسال');
  assert.equal(terms.translateTerm('ui', 'That email does not look right.', 'tr'),
    'Bu e-posta adresi doğru görünmüyor.');
});

test('every contact outcome message has both translations', function () {
  [
    'Name, email and a message, please.',
    'That email does not look right.',
    'Please shorten the name or message before sending.',
    'Received. A reply comes when the paint allows.',
    'Too many notes were sent recently. Please wait ten minutes and try again.',
    'That did not send. Please try again or use the email link beside the form.'
  ].forEach(function (msg) {
    ['tr', 'ar'].forEach(function (lang) {
      assert.notEqual(terms.translateTerm('ui', msg, lang), msg,
        'no ' + lang + ' translation for: ' + msg);
    });
  });
});

// Turkish takes no plural marker after a numeral; Arabic numeral agreement
// has singular/dual/plural cases, so it uses a label form instead.
test('countLabel reads correctly in each language', function () {
  assert.equal(terms.countLabel(30, 'en'), '30 works');
  assert.equal(terms.countLabel(1, 'en'), '1 work');
  assert.equal(terms.countLabel(30, 'tr'), '30 eser');
  assert.equal(terms.countLabel(1, 'tr'), '1 eser');
  assert.equal(terms.countLabel(30, 'ar'), 'الأعمال: 30');
});

test('countLabel falls back to English for an unknown language', function () {
  assert.equal(terms.countLabel(5, 'de'), '5 works');
});

// Final review, Minor #6 (re-graded): the English alt text regressed from
// "Untitled painting, Monsters series" to "Untitled — Monsters", losing both
// "painting" and "series" for screen-reader users on the site that already
// worked. Compose per language rather than gluing translated words.
test('untitledAlt reads as a sentence in each language', function () {
  assert.equal(terms.untitledAlt('Monsters', 'en'),
    'Untitled painting, Monsters series');
  assert.equal(terms.untitledAlt('Monsters', 'tr'),
    'İsimsiz resim, Canavarlar serisi');
  assert.equal(terms.untitledAlt('Monsters', 'ar'),
    'لوحة بدون عنوان، سلسلة وحوش');
});

test('untitledAlt omits the series clause when there is no series', function () {
  assert.equal(terms.untitledAlt('', 'en'), 'Untitled painting');
  assert.equal(terms.untitledAlt(null, 'tr'), 'İsimsiz resim');
  assert.doesNotMatch(terms.untitledAlt('', 'en'), /—|,\s*$/);
});

test('untitledAlt keeps an unmapped series name', function () {
  assert.equal(terms.untitledAlt('New Series', 'tr'),
    'İsimsiz resim, New Series serisi');
});
