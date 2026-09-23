'use strict';

var assert = require('node:assert/strict');
var test = require('node:test');
var render = require('../js/content-render.js');

test('escapes CV descriptions and groups them by category', function () {
  var html = render.cvHtml([
    { category: 'exhibition', year: '2025', description: '<img src=x onerror=alert(1)>', sort_order: 0 }
  ]);
  assert.match(html.exhibition, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.doesNotMatch(html.exhibition, /<img/);
  assert.equal(html.project, '');
  assert.equal(html.fair, '');
});

test('keeps failed-section fallback while applying successful section data', function () {
  var state = render.mergeLoadResult({ artworks: ['fallback-a'], media: ['fallback-m'], cv: ['fallback-c'] }, {
    artworks: { rows: ['remote-a'], error: null },
    media: { rows: null, error: new Error('offline') },
    cv: { rows: ['remote-c'], error: null }
  });
  assert.deepEqual(state, { artworks: ['remote-a'], media: ['fallback-m'], cv: ['remote-c'] });
});

test('renders privacy-enhanced YouTube, Canvas video and escaped Spotify groups', function () {
  var html = render.mediaHtml({
    youtube: { externalUrl: 'https://www.youtube-nocookie.com/embed/VriyhA6ayys', title: 'Nazlı video' },
    canvasVideos: [{ id: 'v1', src: 'https://cdn.test/v.mp4', title: 'Dream <8>' }],
    spotifyGroups: [{ name: 'A & B', items: [{ src: 'https://cdn.test/i.png', altText: 'Cover "one"' }] }]
  });
  assert.match(html.youtube, /youtube-nocookie\.com\/embed\/VriyhA6ayys/);
  assert.match(html.canvas, /Dream &lt;8&gt;/);
  assert.match(html.spotify, /A &amp; B/);
  assert.match(html.spotify, /Cover &quot;one&quot;/);
});
