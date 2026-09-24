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
  assert.match(html.canvas, /class="film is-in"/);
  assert.match(html.spotify, /A &amp; B/);
  assert.match(html.spotify, /Cover &quot;one&quot;/);
});

test('manager renders every agreed section with escaped values and labelled controls', function () {
  var html = render.managerHtml({
    portrait: { id: 'p1', title: 'Portrait' },
    youtube: { id: 'y1', title: 'YouTube', externalUrl: 'https://www.youtube-nocookie.com/embed/VriyhA6ayys' },
    canvasVideos: [{ id: 'v1', title: 'Dream 8' }],
    spotifyGroups: [{ name: 'A & B', items: [{ id: 's1', title: '<Untitled>' }] }],
    cv: { exhibition: [{ id: 'e1', year: '2025', description: 'London' }], project: [], fair: [] }
  }, 'spotify');
  assert.match(html, /Portrait/);
  assert.match(html, /Canvas/);
  assert.match(html, /YouTube/);
  assert.match(html, /A &amp; B/);
  assert.match(html, /&lt;Untitled&gt;/);
  assert.match(html, /Selected Exhibitions/);
  assert.match(html, /data-manager-section="spotify"[^>]*aria-current="page"/);
  assert.doesNotMatch(html, /tabindex="-1"/);
  assert.doesNotMatch(html, /<Untitled>/);
});

test('clears removed singleton media and offers portrait creation when absent', function () {
  var slots = {
    'youtube-slot': { innerHTML: 'stale youtube' },
    'films-grid': { innerHTML: 'stale films' },
    'spotify-galleries': { innerHTML: 'stale spotify' },
    'portrait-frame': { innerHTML: 'stale portrait' }
  };
  var root = { getElementById: function (id) { return slots[id] || null; } };
  render.renderMedia(root, { youtube: null, canvasVideos: [], spotifyGroups: [] });
  render.renderPortrait(root, null);
  assert.equal(slots['youtube-slot'].innerHTML, '');
  assert.equal(slots['portrait-frame'].innerHTML, '');

  var html = render.managerHtml({
    portrait: null, youtube: null, canvasVideos: [], spotifyGroups: [],
    cv: { exhibition: [], project: [], fair: [] }
  }, 'portrait');
  assert.match(html, /data-kind="portrait" data-new="true"/);
  assert.match(html, /type="file"[^>]*required/);
});
