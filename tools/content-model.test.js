'use strict';

var assert = require('node:assert/strict');
var test = require('node:test');
var model = require('../js/content-model.js');

test('normalizes a migrated artwork to the existing painting view model', function () {
  var row = {
    id: '11111111-1111-4111-8111-111111111111', title: null, year: null,
    series: 'Evolution', medium: null, dimensions: null,
    storage_path: 'artworks/11111111-1111-4111-8111-111111111111.jpg',
    legacy_path: 'art/evolution-1861.jpg', aspect_width: 1591, aspect_height: 2000
  };
  var got = model.normalizeArtwork(row, function (path) { return 'https://cdn.test/' + path; });
  assert.deepEqual(got, {
    id: row.id, title: '', year: null, series: 'Evolution', medium: '', dims: '',
    src: 'https://cdn.test/artworks/11111111-1111-4111-8111-111111111111.jpg',
    ratio: '1591 / 2000'
  });
});

test('uses the legacy path until an object has migrated', function () {
  var got = model.normalizeMedia({
    id: '2', kind: 'portrait', title: 'Portrait', alt_text: 'Portrait of Nazlı Belgin',
    storage_path: null, legacy_path: 'art/portrait/nazlı.jpg', external_url: null,
    group_name: null, mime_type: 'image/jpeg', aspect_width: 1929, aspect_height: 2411,
    sort_order: 0
  }, function () { throw new Error('must not resolve Storage'); });
  assert.equal(got.src, 'art/portrait/nazlı.jpg');
  assert.equal(got.ratio, '1929 / 2411');
});

test('normalizes supported YouTube URL shapes and rejects unrelated hosts', function () {
  assert.equal(model.normalizeYoutubeUrl('https://youtu.be/VriyhA6ayys?t=4'), 'https://www.youtube-nocookie.com/embed/VriyhA6ayys');
  assert.equal(model.normalizeYoutubeUrl('https://www.youtube.com/watch?v=VriyhA6ayys'), 'https://www.youtube-nocookie.com/embed/VriyhA6ayys');
  assert.equal(model.normalizeYoutubeUrl('https://www.youtube-nocookie.com/embed/VriyhA6ayys'), 'https://www.youtube-nocookie.com/embed/VriyhA6ayys');
  assert.equal(model.normalizeYoutubeUrl('https://vimeo.com/123'), null);
  assert.equal(model.normalizeYoutubeUrl('javascript:alert(1)'), null);
});

test('rejects a disguised video and applies file size ceilings', function () {
  assert.deepEqual(model.validateFile({ type: 'image/jpeg', size: 20 }, 'canvas_video'), { ok: false, message: 'Choose an MP4 or WebM video.' });
  assert.deepEqual(model.validateFile({ type: 'video/mp4', size: 104857601 }, 'canvas_video'), { ok: false, message: 'Videos must be 100 MB or smaller.' });
  assert.deepEqual(model.validateFile({ type: 'image/webp', size: 15728641 }, 'artwork'), { ok: false, message: 'Images must be 15 MB or smaller.' });
  assert.deepEqual(model.validateFile({ type: 'image/png', size: 25 }, 'spotify_image'), { ok: true, message: '' });
});

test('builds object paths and enforces the agreed password policy', function () {
  assert.equal(model.storagePath('spotify_image', 'abc-123', 'image/png'), 'media/spotify-image/abc-123.png');
  assert.equal(model.storagePath('artwork', 'abc-123', 'image/jpeg'), 'artworks/abc-123.jpg');
  assert.equal(model.passwordIsStrong('Long-enough9!'), true);
  assert.equal(model.passwordIsStrong('long-enough9!'), false);
});

test('groups ordered media without losing first-seen Spotify artist order', function () {
  var grouped = model.groupMedia([
    { id: 's2', kind: 'spotify_image', groupName: 'Irmak', sortOrder: 2 },
    { id: 'v2', kind: 'canvas_video', sortOrder: 2 },
    { id: 's1', kind: 'spotify_image', groupName: 'Irmak', sortOrder: 1 },
    { id: 'h1', kind: 'spotify_image', groupName: 'Hümeyra', sortOrder: 0 },
    { id: 'v1', kind: 'canvas_video', sortOrder: 1 },
    { id: 'p', kind: 'portrait' },
    { id: 'y', kind: 'youtube' }
  ]);
  assert.equal(grouped.portrait.id, 'p');
  assert.equal(grouped.youtube.id, 'y');
  assert.deepEqual(grouped.canvasVideos.map(function (item) { return item.id; }), ['v1', 'v2']);
  assert.deepEqual(grouped.spotifyGroups.map(function (group) {
    return [group.name, group.items.map(function (item) { return item.id; })];
  }), [['Irmak', ['s1', 's2']], ['Hümeyra', ['h1']]]);
});

test('escapes every HTML metacharacter used by managed content', function () {
  assert.equal(model.escapeHtml('<a title="x">Tom & \'Nazlı\'</a>'), '&lt;a title=&quot;x&quot;&gt;Tom &amp; &#39;Nazlı&#39;&lt;/a&gt;');
});
