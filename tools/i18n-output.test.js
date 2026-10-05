'use strict';

var assert = require('node:assert/strict');
var test = require('node:test');
var fs = require('node:fs');
var path = require('node:path');
var transform = require('./i18n-transform.js');

var ROOT = path.join(__dirname, '..');
var source = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

function page(lang) {
  return fs.readFileSync(path.join(ROOT, lang, 'index.html'), 'utf8');
}

test('both translated pages exist', function () {
  assert.ok(page('tr').length > 0);
  assert.ok(page('ar').length > 0);
});

test('arabic page is rtl, turkish is not', function () {
  assert.match(page('ar'), /<html lang="ar" dir="rtl">/);
  assert.match(page('tr'), /<html lang="tr">/);
  assert.doesNotMatch(page('tr'), /dir="rtl"/);
});

test('every page carries reciprocal hreflang', function () {
  ['tr', 'ar'].forEach(function (lang) {
    var html = page(lang);
    ['en', 'tr', 'ar', 'x-default'].forEach(function (tag) {
      assert.match(html, new RegExp('hreflang="' + tag + '"'),
        lang + ' is missing hreflang ' + tag);
    });
  });
  ['en', 'tr', 'ar', 'x-default'].forEach(function (tag) {
    assert.match(source, new RegExp('hreflang="' + tag + '"'),
      'the English page is missing hreflang ' + tag);
  });
});

test('canonical is self-referential on each page', function () {
  assert.match(page('tr'), /canonical" href="https:\/\/nazlibelgin\.com\/tr\/"/);
  assert.match(page('ar'), /canonical" href="https:\/\/nazlibelgin\.com\/ar\/"/);
});

test('no relative asset paths survive in generated pages', function () {
  ['tr', 'ar'].forEach(function (lang) {
    assert.doesNotMatch(page(lang), /\s(href|src)="(css|js|art|favicon)/,
      lang + ' still has a relative asset path');
  });
});

test('each generated page marks exactly its own language', function () {
  [['tr', 'tr'], ['ar', 'ar']].forEach(function (pair) {
    var html = page(pair[0]);
    assert.equal((html.match(/aria-current="true"/g) || []).length, 1);
    assert.match(html, new RegExp('hreflang="' + pair[1] + '"[^>]*aria-current="true"'));
  });
});

// Review Focus: index.html edited without rebuilding leaves tr/ and ar/
// silently stale. Regenerating must reproduce the committed output exactly.
test('generated pages are not stale against index.html', function () {
  ['tr', 'ar'].forEach(function (lang) {
    var dict = JSON.parse(
      fs.readFileSync(path.join(ROOT, 'i18n', lang + '.json'), 'utf8'));
    var expected = transform.absolutizeAssets(
      transform.rewriteHead(
        transform.localizeJsonLd(transform.applyTranslations(source, dict), dict),
        lang));
    var actual = page(lang).replace(/^<!-- GENERATED[^\n]*\r?\n/, '');
    assert.equal(actual, expected,
      lang + '/index.html is stale — run: node tools/build-i18n.js');
  });
});

test('sitemap lists all three language URLs with alternates', function () {
  var xml = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
  ['https://nazlibelgin.com/', 'https://nazlibelgin.com/tr/', 'https://nazlibelgin.com/ar/']
    .forEach(function (url) {
      assert.match(xml, new RegExp('<loc>' + url.replace(/[/.]/g, '\\$&') + '</loc>'),
        'sitemap is missing ' + url);
    });
  assert.equal((xml.match(/<loc>/g) || []).length, 3);
  assert.match(xml, /xmlns:xhtml="http:\/\/www\.w3\.org\/1999\/xhtml"/);
  // four alternates on each of the three URLs
  assert.equal((xml.match(/xhtml:link rel="alternate"/g) || []).length, 12);
});

// Found by loading /ar/ in a browser, not by reading the diff: the build
// absolutises asset paths in the HTML, but the fallback catalogue in
// js/site.js carries relative 'art/...' paths. The same script runs on all
// three pages, so from /tr/ and /ar/ those resolve to /tr/art/... and
// /ar/art/... and every artwork 404s.
test('no JS module references art/ with a relative path', function () {
  ['site.js', 'content-render.js', 'content-model.js', 'studio.js'].forEach(function (name) {
    var file = path.join(ROOT, 'js', name);
    if (!fs.existsSync(file)) return;
    var src = fs.readFileSync(file, 'utf8');
    var hits = src.match(/['"]art\//g) || [];
    assert.equal(hits.length, 0,
      name + ' has ' + hits.length + " relative art/ path(s); they 404 from /tr/ and /ar/");
  });
});
