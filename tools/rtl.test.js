'use strict';

var assert = require('node:assert/strict');
var test = require('node:test');
var fs = require('node:fs');

var css = fs.readFileSync(__dirname + '/../css/site.css', 'utf8');

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
// Isolation keeps "2025 · 4:12" and "Historia Art Studio" readable.
test('numeric runs are bidi-isolated under rtl', function () {
  assert.match(css, /\[dir="rtl"\][\s\S]*unicode-bidi:\s*isolate/);
});

test('arabic page gets an arabic display face', function () {
  assert.match(css, /\[dir="rtl"\][\s\S]*'Amiri'/);
});

test('arabic page gets an arabic body face', function () {
  assert.match(css, /\[dir="rtl"\][\s\S]*'Noto Sans Arabic'/);
});
