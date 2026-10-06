'use strict';

var assert = require('node:assert/strict');
var test = require('node:test');
var fs = require('node:fs');

var css = fs.readFileSync(__dirname + '/../css/site.css', 'utf8');

// Pull one rule out of the stylesheet by a property it declares, so the
// assertions below are about THAT rule's selector list rather than about the
// two strings happening to appear somewhere in the file in the right order.
function ruleDeclaring(property, selectorMustContain) {
  var re = /([^{}]+)\{([^}]*)\}/g;
  var match;
  while ((match = re.exec(css)) !== null) {
    if (match[2].indexOf(property) === -1) continue;
    var selectors = match[1].trim();
    if (selectorMustContain && selectors.indexOf(selectorMustContain) === -1) continue;
    return { selectors: selectors, body: match[2] };
  }
  return null;
}

test('no physical inline margins remain', function () {
  assert.doesNotMatch(css, /margin-(left|right)\s*:/);
});

test('no physical inline padding remains', function () {
  assert.doesNotMatch(css, /padding-(left|right)\s*:/);
});

test('no physical text alignment remains', function () {
  assert.doesNotMatch(css, /text-align:\s*(left|right)\s*;/);
});

// Review Focus: Latin runs and digits inside Arabic reorder under RTL.
// Isolation keeps "2025 · 4:12" and the Latin studio names readable.
test('the bidi-isolation rule is scoped to rtl and names the mixed-content elements', function () {
  var rule = ruleDeclaring('unicode-bidi: isolate', '.film__meta');
  assert.ok(rule, 'no rtl rule declares unicode-bidi: isolate');
  assert.match(rule.selectors, /\[dir="rtl"\]/);
  ['.film__meta', '.cv__year', '.work__year', '.lb-num'].forEach(function (sel) {
    assert.ok(rule.selectors.indexOf(sel) !== -1,
      sel + ' is not bidi-isolated');
  });
});

// Final review, Minor #10: .count is on two elements — #count-label, whose
// text is a Latin numeral, and the noscript paragraph, which in Arabic is
// two full sentences. Forcing direction: ltr on Arabic prose is wrong.
test('direction is forced only on the numeric counter, not on every .count', function () {
  var rule = ruleDeclaring('unicode-bidi: isolate', '.film__meta');
  assert.ok(rule.selectors.indexOf('#count-label') !== -1,
    'the numeric counter should be isolated by id');
  assert.ok(!/(^|[\s,])\.count(?![a-zA-Z_-])/.test(rule.selectors),
    'the bare .count class forces ltr on the Arabic noscript paragraph too');
});

test('arabic page gets an arabic display face', function () {
  var rule = ruleDeclaring("'Amiri'");
  assert.ok(rule, "no rule declares the 'Amiri' family");
  assert.match(rule.selectors, /\[dir="rtl"\]/);
  assert.match(rule.selectors, /\.hero__title/);
});

test('arabic page gets an arabic body face', function () {
  var rule = ruleDeclaring("'Noto Sans Arabic'");
  assert.ok(rule, "no rule declares the 'Noto Sans Arabic' family");
  assert.match(rule.selectors, /\[dir="rtl"\]\s*body/);
});

// Found in the browser on /ar/: the drawer's Instagram handle rendered as
// "art.nazlibelgin@" because the leading '@' is a neutral character and RTL
// placed it at the far end. Addresses are Latin runs and must be isolated.
test('drawer contact links are bidi-isolated', function () {
  var rule = /\.nav__contact a \{([^}]*)\}/.exec(css);
  assert.ok(rule, 'no .nav__contact a rule found');
  assert.match(rule[1], /unicode-bidi:\s*isolate/);
  assert.match(rule[1], /direction:\s*ltr/);
});
