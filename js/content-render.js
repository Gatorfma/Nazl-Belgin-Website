(function (root, factory) {
  'use strict';

  var model = typeof module === 'object' && module.exports
    ? require('./content-model.js')
    : root.NBContentModel;
  var api = factory(model);
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
    return;
  }
  root.NBContentRender = api;
})(typeof window !== 'undefined' ? window : globalThis, function (model) {
  'use strict';

  var esc = model.escapeHtml;

  function mergeLoadResult(fallback, result) {
    return {
      artworks: result.artworks && !result.artworks.error ? result.artworks.rows : fallback.artworks,
      media: result.media && !result.media.error ? result.media.rows : fallback.media,
      cv: result.cv && !result.cv.error ? result.cv.rows : fallback.cv
    };
  }

  function cvHtml(entries) {
    var html = { exhibition: '', project: '', fair: '' };
    (entries || []).slice().sort(function (a, b) {
      return Number(a.sort_order) - Number(b.sort_order);
    }).forEach(function (entry) {
      if (!Object.prototype.hasOwnProperty.call(html, entry.category)) return;
      html[entry.category] += '<div class="cv__row" data-id="' + esc(entry.id || '') + '">' +
        '<span class="cv__year">' + esc(entry.year) + '</span>' +
        '<span class="cv__text">' + esc(entry.description) + '</span></div>';
    });
    return html;
  }

  function mediaHtml(grouped) {
    grouped = grouped || { canvasVideos: [], spotifyGroups: [] };
    var youtube = '';
    var youtubeUrl = grouped.youtube ? model.normalizeYoutubeUrl(grouped.youtube.externalUrl) : null;
    if (youtubeUrl) {
      youtube = '<iframe src="' + esc(youtubeUrl) + '" title="' +
        esc(grouped.youtube.title || 'Nazlı Belgin video on YouTube') + '" loading="lazy" ' +
        'allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" ' +
        'referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>';
    }

    var canvas = (grouped.canvasVideos || []).map(function (item, index) {
      return '<article class="film" data-id="' + esc(item.id) + '" data-reveal="remote-film-' + index + '">' +
        '<div class="frame frame--film"><video class="film__video" src="' + esc(item.src) +
        '" aria-label="' + esc(item.title || 'Canvas video') +
        '" autoplay muted loop playsinline controls preload="metadata"></video></div></article>';
    }).join('');

    var spotify = (grouped.spotifyGroups || []).map(function (group, groupIndex) {
      var galleryClass = 'artworks__artist-gallery' + (groupIndex === 0 ? ' artworks__artist-gallery--large' : '');
      var images = group.items.map(function (item) {
        return '<img src="' + esc(item.src) + '" alt="' + esc(item.altText || item.title || group.name) +
          '" loading="lazy" data-id="' + esc(item.id) + '">';
      }).join('');
      return '<details class="artworks__artist" data-artist-disclosure data-group="' + esc(group.name) + '">' +
        '<summary>' + esc(group.name) + '</summary><div class="' + galleryClass + '" aria-label="' +
        esc(group.name + ' artworks') + '">' + images + '</div></details>';
    }).join('');

    return { youtube: youtube, canvas: canvas, spotify: spotify };
  }

  function renderMedia(root, grouped) {
    var html = mediaHtml(grouped);
    var changed = false;
    var youtube = root.getElementById('youtube-slot');
    var films = root.getElementById('films-grid');
    var spotify = root.getElementById('spotify-galleries');
    if (youtube && html.youtube) { youtube.innerHTML = html.youtube; changed = true; }
    if (films) { films.innerHTML = html.canvas; changed = true; }
    if (spotify) { spotify.innerHTML = html.spotify; changed = true; }
    if (grouped && grouped.portrait) changed = renderPortrait(root, grouped.portrait) || changed;
    return changed;
  }

  function renderPortrait(root, portrait) {
    var frame = root.getElementById('portrait-frame');
    if (!frame || !portrait || !portrait.src) return false;
    var size = '';
    if (portrait.ratio) {
      var parts = portrait.ratio.split('/').map(function (value) { return value.trim(); });
      if (parts.length === 2) size = ' width="' + esc(parts[0]) + '" height="' + esc(parts[1]) + '"';
    }
    frame.innerHTML = '<img class="about__portrait-img" src="' + esc(portrait.src) + '" alt="' +
      esc(portrait.altText || 'Portrait of Nazlı Belgin') + '"' + size + '>';
    return true;
  }

  function renderCv(root, entries) {
    var html = cvHtml(entries);
    var changed = false;
    ['exhibition', 'project', 'fair'].forEach(function (category) {
      var target = root.getElementById('cv-' + category + (category === 'fair' ? 's' : 's'));
      if (!target) return;
      target.innerHTML = html[category];
      changed = true;
    });
    return changed;
  }

  return {
    mergeLoadResult: mergeLoadResult,
    cvHtml: cvHtml,
    mediaHtml: mediaHtml,
    renderMedia: renderMedia,
    renderPortrait: renderPortrait,
    renderCv: renderCv
  };
});
