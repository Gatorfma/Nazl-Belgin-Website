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

var HEAD_FIXTURE = [
  '<!DOCTYPE html>',
  '<html lang="en">',
  '<head>',
  '<link rel="canonical" href="https://nazlibelgin.com/">',
  '<meta property="og:url" content="https://nazlibelgin.com/">',
  '<meta property="og:locale" content="en_US">',
  '</head><body></body></html>'
].join('\n');

test('rewriteHead sets lang and rtl direction for Arabic', function () {
  var out = transform.rewriteHead(HEAD_FIXTURE, 'ar');
  assert.match(out, /<html lang="ar" dir="rtl">/);
});

test('rewriteHead sets lang without dir for Turkish', function () {
  var out = transform.rewriteHead(HEAD_FIXTURE, 'tr');
  assert.match(out, /<html lang="tr">/);
  assert.doesNotMatch(out, /dir="rtl"/);
});

test('rewriteHead makes canonical self-referential', function () {
  assert.match(transform.rewriteHead(HEAD_FIXTURE, 'tr'),
    /<link rel="canonical" href="https:\/\/nazlibelgin\.com\/tr\/">/);
});

test('rewriteHead sets og:locale per language', function () {
  assert.match(transform.rewriteHead(HEAD_FIXTURE, 'ar'), /content="ar_AR"/);
  assert.match(transform.rewriteHead(HEAD_FIXTURE, 'tr'), /content="tr_TR"/);
});

test('rewriteHead injects four reciprocal hreflang links', function () {
  var out = transform.rewriteHead(HEAD_FIXTURE, 'tr');
  assert.match(out, /hreflang="en" href="https:\/\/nazlibelgin\.com\/"/);
  assert.match(out, /hreflang="tr" href="https:\/\/nazlibelgin\.com\/tr\/"/);
  assert.match(out, /hreflang="ar" href="https:\/\/nazlibelgin\.com\/ar\/"/);
  assert.match(out, /hreflang="x-default" href="https:\/\/nazlibelgin\.com\/"/);
});

test('urlFor returns the root for English', function () {
  assert.equal(transform.urlFor('en'), 'https://nazlibelgin.com/');
  assert.equal(transform.urlFor('ar'), 'https://nazlibelgin.com/ar/');
});

test('localizeJsonLd replaces only the description field', function () {
  var html = '<script type="application/ld+json">\n' +
    '{ "@type": "Person", "name": "Nazlı Belgin", "description": "English text" }\n' +
    '</script>';
  var out = transform.localizeJsonLd(html, { 'meta.jsonLdDescription': 'Türkçe metin' });
  assert.match(out, /"description": "Türkçe metin"/);
  assert.match(out, /"name": "Nazlı Belgin"/);
  assert.doesNotMatch(out, /English text/);
});

test('localizeJsonLd leaves the block alone when the key is absent', function () {
  var html = '<script type="application/ld+json">{ "description": "English" }</script>';
  assert.equal(transform.localizeJsonLd(html, {}), html);
});

// Ruling (Task 6): manifesto beats hold several lines separated by <br>.
// Translations carry a real newline and the text path turns it into <br>,
// so a dictionary never has to contain raw HTML.
test('applyTranslations turns newlines into line breaks in text', function () {
  var html = '<p data-i18n="k">a<br>b</p>';
  var out = transform.applyTranslations(html, { k: 'bir\niki\nüç' });
  assert.match(out, /<p data-i18n="k">bir<br>iki<br>üç<\/p>/);
});

test('applyTranslations does not turn newlines into breaks in attributes', function () {
  var html = '<img data-i18n-attr="alt:k" alt="x">';
  var out = transform.applyTranslations(html, { k: 'bir\niki' });
  assert.doesNotMatch(out, /<br>/);
});

// Review Focus: a key present in one language file but missing from another
// must fail the build naming the key, not emit a half-translated page.
test('validateKeys reports keys missing from the dictionary', function () {
  var html = '<p data-i18n="a">x</p><meta data-i18n-attr="content:b" content="y">';
  var result = transform.validateKeys(html, { a: 'A' });
  assert.deepEqual(result.missing, ['b']);
});

test('validateKeys reports orphaned dictionary keys', function () {
  var html = '<p data-i18n="a">x</p>';
  var result = transform.validateKeys(html, { a: 'A', stale: 'S' });
  assert.deepEqual(result.orphaned, ['stale']);
});

test('validateKeys ignores _source companion keys', function () {
  var html = '<p data-i18n="a">x</p>';
  var result = transform.validateKeys(html, { a: 'A', 'a._source': 'original' });
  assert.deepEqual(result.orphaned, []);
  assert.deepEqual(result.missing, []);
});

// Ruling (Task 6): meta.jsonLdDescription is consumed by localizeJsonLd, not
// by a data-i18n marker, so the orphan check must exempt it or every build
// would warn about it forever.
test('validateKeys does not call build-consumed keys orphaned', function () {
  var html = '<p data-i18n="a">x</p>';
  var result = transform.validateKeys(html, {
    a: 'A',
    'meta.jsonLdDescription': 'Açıklama'
  });
  assert.deepEqual(result.orphaned, []);
  assert.deepEqual(result.missing, []);
});

test('validateKeys passes when html and dictionary agree', function () {
  var html = '<p data-i18n="a">x</p>';
  assert.deepEqual(transform.validateKeys(html, { a: 'A' }),
    { missing: [], orphaned: [] });
});

test('absolutizeAssets rewrites relative asset paths', function () {
  var html = '<link href="css/site.css?v=1"><script src="js/site.js"></script>' +
             '<img src="art/portrait/x.jpg"><link href="favicon.svg">';
  var out = transform.absolutizeAssets(html);
  assert.match(out, /href="\/css\/site\.css\?v=1"/);
  assert.match(out, /src="\/js\/site\.js"/);
  assert.match(out, /src="\/art\/portrait\/x\.jpg"/);
  assert.match(out, /href="\/favicon\.svg"/);
});

test('absolutizeAssets leaves external and anchor links alone', function () {
  var html = '<a href="#work">w</a><script src="https://cdn.example.com/a.js"></script>' +
             '<a href="mailto:x@y.com">m</a><link href="//cdn.example.com/b.css">';
  var out = transform.absolutizeAssets(html);
  assert.match(out, /href="#work"/);
  assert.match(out, /src="https:\/\/cdn\.example\.com\/a\.js"/);
  assert.match(out, /href="mailto:x@y\.com"/);
  assert.match(out, /href="\/\/cdn\.example\.com\/b\.css"/);
});

test('absolutizeAssets is idempotent', function () {
  var once = transform.absolutizeAssets('<link href="css/site.css">');
  assert.equal(transform.absolutizeAssets(once), once);
});

test('localizeJsonLd output is still valid JSON', function () {
  var html = '<script type="application/ld+json">\n' +
    '{ "@type": "Person", "description": "English text" }\n</script>';
  var out = transform.localizeJsonLd(html, { 'meta.jsonLdDescription': 'Ödül "x" & <y>' });
  var body = out.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1];
  assert.doesNotThrow(function () { JSON.parse(body); });
  assert.equal(JSON.parse(body).description, 'Ödül "x" & <y>');
});
