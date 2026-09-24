(function (root, factory) {
  'use strict';

  var api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
    return;
  }
  root.NBContentModel = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  var IMAGE_TYPES = { 'image/jpeg': true, 'image/png': true, 'image/webp': true };
  var VIDEO_TYPES = { 'video/mp4': true, 'video/webm': true };
  var EXTENSIONS = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'video/mp4': 'mp4',
    'video/webm': 'webm'
  };
  var IMAGE_LIMIT = 15 * 1024 * 1024;
  var VIDEO_LIMIT = 100 * 1024 * 1024;

  function text(value) {
    return value == null ? '' : String(value);
  }

  function escapeHtml(value) {
    return text(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function sourceFor(row, publicUrlFor) {
    if (row.storage_path) return publicUrlFor(row.storage_path);
    return row.legacy_path || '';
  }

  function ratioFor(row) {
    return row.aspect_width && row.aspect_height
      ? String(row.aspect_width) + ' / ' + String(row.aspect_height)
      : '';
  }

  function normalizeArtwork(row, publicUrlFor) {
    return {
      id: row.id,
      title: text(row.title),
      year: row.year == null ? null : row.year,
      series: text(row.series),
      medium: text(row.medium),
      dims: text(row.dimensions),
      src: sourceFor(row, publicUrlFor),
      ratio: ratioFor(row)
    };
  }

  function normalizeMedia(row, publicUrlFor) {
    return {
      id: row.id,
      slug: text(row.slug),
      kind: row.kind,
      groupName: text(row.group_name),
      title: text(row.title),
      altText: text(row.alt_text),
      externalUrl: text(row.external_url),
      src: row.kind === 'youtube' ? '' : sourceFor(row, publicUrlFor),
      storagePath: text(row.storage_path),
      legacyPath: text(row.legacy_path),
      mimeType: text(row.mime_type),
      ratio: ratioFor(row),
      sortOrder: Number(row.sort_order) || 0,
      published: row.published !== false
    };
  }

  function byOrder(a, b) {
    return a.sortOrder - b.sortOrder;
  }

  function groupMedia(rows) {
    var result = { portrait: null, youtube: null, canvasVideos: [], spotifyGroups: [] };
    var groups = {};
    (rows || []).forEach(function (row) {
      if (row.kind === 'portrait' && !result.portrait) result.portrait = row;
      if (row.kind === 'youtube' && !result.youtube) result.youtube = row;
      if (row.kind === 'canvas_video') result.canvasVideos.push(row);
      if (row.kind !== 'spotify_image') return;
      var name = row.groupName || '';
      if (!groups[name]) {
        groups[name] = { name: name, items: [] };
        result.spotifyGroups.push(groups[name]);
      }
      groups[name].items.push(row);
    });
    result.canvasVideos.sort(byOrder);
    result.spotifyGroups.forEach(function (group) { group.items.sort(byOrder); });
    return result;
  }

  function youtubeId(value) {
    var url;
    try { url = new URL(text(value).trim()); } catch (error) { return null; }
    var host = url.hostname.toLowerCase().replace(/^www\./, '');
    var id = null;
    if (host === 'youtu.be') id = url.pathname.split('/').filter(Boolean)[0];
    if (host === 'youtube.com') {
      if (url.pathname === '/watch') id = url.searchParams.get('v');
      if (url.pathname.indexOf('/embed/') === 0) id = url.pathname.split('/')[2];
      if (url.pathname.indexOf('/shorts/') === 0) id = url.pathname.split('/')[2];
    }
    if (host === 'youtube-nocookie.com' && url.pathname.indexOf('/embed/') === 0) {
      id = url.pathname.split('/')[2];
    }
    return id && /^[A-Za-z0-9_-]{6,20}$/.test(id) ? id : null;
  }

  function normalizeYoutubeUrl(value) {
    var id = youtubeId(value);
    return id ? 'https://www.youtube-nocookie.com/embed/' + id : null;
  }

  function validateFile(file, kind) {
    if (!file) return { ok: false, message: 'Choose a file.' };
    if (kind === 'canvas_video') {
      if (!VIDEO_TYPES[file.type]) return { ok: false, message: 'Choose an MP4 or WebM video.' };
      if (file.size > VIDEO_LIMIT) return { ok: false, message: 'Videos must be 100 MB or smaller.' };
      return { ok: true, message: '' };
    }
    if (!IMAGE_TYPES[file.type]) return { ok: false, message: 'Choose a JPEG, PNG or WebP image.' };
    if (file.size > IMAGE_LIMIT) return { ok: false, message: 'Images must be 15 MB or smaller.' };
    return { ok: true, message: '' };
  }

  function storagePath(kind, id, mimeType) {
    var ext = EXTENSIONS[mimeType];
    var prefix = kind === 'artwork' ? 'artworks' : 'media/' + kind.replace(/_/g, '-');
    if (!ext) throw new Error('Unsupported media type: ' + mimeType);
    return prefix + '/' + id + '.' + ext;
  }

  function passwordIsStrong(value) {
    return typeof value === 'string' && value.length >= 12 && /[a-z]/.test(value) &&
      /[A-Z]/.test(value) && /[0-9]/.test(value) && /[^A-Za-z0-9]/.test(value);
  }

  return {
    escapeHtml: escapeHtml,
    normalizeArtwork: normalizeArtwork,
    normalizeMedia: normalizeMedia,
    groupMedia: groupMedia,
    normalizeYoutubeUrl: normalizeYoutubeUrl,
    validateFile: validateFile,
    storagePath: storagePath,
    passwordIsStrong: passwordIsStrong
  };
});
