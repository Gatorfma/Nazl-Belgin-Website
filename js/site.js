/* Nazlı Belgin — portfolio behaviour
 *
 * Ported from the source design canvas (x-dc / DCLogic) to plain ES2018.
 * No build step, no dependencies.
 *
 * Public content comes from Supabase when configured, with checked-in
 * content as the startup/outage fallback. Studio access uses Supabase Auth.
 */
(function () {
  'use strict';

  /* ---------- configuration ---------- */

  var SLIDE_MS = 5200;               // hero crossfade interval
  var MAX_EDGE = 1800;               // uploads are downscaled to this longest edge

  /* ---------- source data ---------- */

  // `ratio` must match the delivered file's real pixel dimensions, not the
  // camera original — tools/heic-to-web.py prints the value to use here.
  //
  // Titles, dates, media and dimensions are recorded only where they are
  // actually known. Blank means unknown, never invented: these are real
  // paintings and a placeholder title would read as a real attribution.
  var FALLBACK_CATALOGUE = [
    // The three works whose titles and details are known.
    { src: 'art/sweet-devil.jpg', title: 'My Sweet Devil', year: 2025, series: 'Monsters', medium: 'Oil on canvas', dims: '60 × 60 cm', ratio: '1995 / 2000' },
    { src: 'art/darwin.jpg', title: 'Darwin Was Just Guessing', year: 2025, series: 'Evolution', medium: 'Oil on canvas', dims: '100 × 81 cm', ratio: '1667 / 2000' },
    { src: 'art/too-horny.jpg', title: 'Too Horny to Die', year: 2025, series: 'Monsters', medium: 'Oil and oil stick on canvas', dims: '25 × 25 cm', ratio: '1952 / 1892' },

    // Awaiting titles, dates, media and dimensions from the artist. Series is
    // known from how she foldered the originals; nothing else is invented.
    { src: 'art/monsters-4880.jpg', title: '', year: null, series: 'Monsters', medium: '', dims: '', ratio: '1643 / 2000' },
    { src: 'art/monsters-4914.jpg', title: '', year: null, series: 'Monsters', medium: '', dims: '', ratio: '1530 / 2000' },
    { src: 'art/monsters-4915.jpg', title: '', year: null, series: 'Monsters', medium: '', dims: '', ratio: '1547 / 2000' },
    { src: 'art/monsters-4917.jpg', title: '', year: null, series: 'Monsters', medium: '', dims: '', ratio: '2000 / 1997' },
    { src: 'art/monsters-4921.jpg', title: '', year: null, series: 'Monsters', medium: '', dims: '', ratio: '1485 / 2000' },
    { src: 'art/monsters-4940.jpg', title: '', year: null, series: 'Monsters', medium: '', dims: '', ratio: '1579 / 2000' },
    { src: 'art/monsters-4943.jpg', title: '', year: null, series: 'Monsters', medium: '', dims: '', ratio: '1984 / 2000' },
    { src: 'art/monsters-4945.jpg', title: '', year: null, series: 'Monsters', medium: '', dims: '', ratio: '2000 / 1998' },
    { src: 'art/monsters-4946.jpg', title: '', year: null, series: 'Monsters', medium: '', dims: '', ratio: '1952 / 2000' },
    { src: 'art/monsters-4947.jpg', title: '', year: null, series: 'Monsters', medium: '', dims: '', ratio: '1966 / 2000' },
    { src: 'art/monsters-4948.jpg', title: '', year: null, series: 'Monsters', medium: '', dims: '', ratio: '1979 / 2000' },
    { src: 'art/monsters-4949.jpg', title: '', year: null, series: 'Monsters', medium: '', dims: '', ratio: '1955 / 2000' },
    { src: 'art/monsters-4950.jpg', title: '', year: null, series: 'Monsters', medium: '', dims: '', ratio: '1983 / 2000' },
    { src: 'art/monsters-4951.jpg', title: '', year: null, series: 'Monsters', medium: '', dims: '', ratio: '1991 / 2000' },
    { src: 'art/monsters-4952.jpg', title: '', year: null, series: 'Monsters', medium: '', dims: '', ratio: '2000 / 1986' },
    { src: 'art/monsters-4953.jpg', title: '', year: null, series: 'Monsters', medium: '', dims: '', ratio: '1996 / 2000' },
    { src: 'art/monsters-4955.jpg', title: '', year: null, series: 'Monsters', medium: '', dims: '', ratio: '1962 / 2000' },
    { src: 'art/monsters-4956.jpg', title: '', year: null, series: 'Monsters', medium: '', dims: '', ratio: '2000 / 1974' },
    { src: 'art/monsters-4957.jpg', title: '', year: null, series: 'Monsters', medium: '', dims: '', ratio: '2000 / 1928' },
    { src: 'art/monsters-4958.jpg', title: '', year: null, series: 'Monsters', medium: '', dims: '', ratio: '1606 / 2000' },
    { src: 'art/evolution-1861.jpg', title: '', year: null, series: 'Evolution', medium: '', dims: '', ratio: '1591 / 2000' },
    { src: 'art/evolution-1862.jpg', title: '', year: null, series: 'Evolution', medium: '', dims: '', ratio: '1569 / 2000' },
    { src: 'art/evolution-1863.jpg', title: '', year: null, series: 'Evolution', medium: '', dims: '', ratio: '1740 / 1770' },
    { src: 'art/evolution-1866.jpg', title: '', year: null, series: 'Evolution', medium: '', dims: '', ratio: '2000 / 1973' },
    { src: 'art/evolution-1867.jpg', title: '', year: null, series: 'Evolution', medium: '', dims: '', ratio: '1980 / 2000' },
    { src: 'art/evolution-1868.jpg', title: '', year: null, series: 'Evolution', medium: '', dims: '', ratio: '1970 / 2000' },
    { src: 'art/evolution-1869.jpg', title: '', year: null, series: 'Evolution', medium: '', dims: '', ratio: '1926 / 1948' },
    { src: 'art/stone-hills-1849.jpg', title: '', year: null, series: 'Stone Hills', medium: '', dims: '', ratio: '1599 / 2000' },
    { src: 'art/stone-hills-1850.jpg', title: '', year: null, series: 'Stone Hills', medium: '', dims: '', ratio: '1683 / 2000' },
    { src: 'art/stone-hills-1852.jpg', title: '', year: null, series: 'Stone Hills', medium: '', dims: '', ratio: '1674 / 2000' },
    { src: 'art/stone-hills-1854.jpg', title: '', year: null, series: 'Stone Hills', medium: '', dims: '', ratio: '2000 / 1613' },
    { src: 'art/stone-hills-1855.jpg', title: '', year: null, series: 'Stone Hills', medium: '', dims: '', ratio: '1559 / 2000' },
    { src: 'art/stone-hills-1894.jpg', title: '', year: null, series: 'Stone Hills', medium: '', dims: '', ratio: '1588 / 2000' },
    { src: 'art/stone-hills-1895.jpg', title: '', year: null, series: 'Stone Hills', medium: '', dims: '', ratio: '1619 / 2000' },
    { src: 'art/stone-hills-1896.jpg', title: '', year: null, series: 'Stone Hills', medium: '', dims: '', ratio: '2000 / 1585' },
    { src: 'art/stone-hills-1897.jpg', title: '', year: null, series: 'Stone Hills', medium: '', dims: '', ratio: '1593 / 2000' },
    { src: 'art/stone-hills-1898.jpg', title: '', year: null, series: 'Stone Hills', medium: '', dims: '', ratio: '1604 / 2000' },
    { src: 'art/stone-hills-1900.jpg', title: '', year: null, series: 'Stone Hills', medium: '', dims: '', ratio: '2000 / 1588' }
  ];

  var SERIES_ORDER = ['All', 'Monsters', 'Evolution', 'Stone Hills'];

  function buildWorks() {
    return FALLBACK_CATALOGUE.map(function (r, i) {
      return assign({}, r, { id: 'w' + i });
    });
  }

  /* ---------- small helpers ---------- */

  function assign(target) {
    for (var i = 1; i < arguments.length; i++) {
      var s = arguments[i];
      if (!s) continue;
      for (var k in s) if (Object.prototype.hasOwnProperty.call(s, k)) target[k] = s[k];
    }
    return target;
  }

  function $(id) { return document.getElementById(id); }

  // Work metadata is user-editable and persisted, so everything that reaches
  // innerHTML goes through here.
  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // Most of the archive has no title yet, so fall back to "Untitled" for
  // display while leaving the stored value empty for the studio editor.
  function shownTitle(w) {
    return (w.title && String(w.title).trim()) ? w.title : 'Untitled';
  }

  // Alt text should still say something useful for an untitled work.
  function altText(w) {
    return (w.title && String(w.title).trim())
      ? w.title
      : 'Untitled painting, ' + w.series + ' series';
  }

  function titleFromFile(name) {
    var base = String(name).replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim();
    return base ? base.charAt(0).toUpperCase() + base.slice(1) : 'Untitled';
  }

  // Reads a File and returns an uploadable Blob plus its real dimensions.
  function readScaled(file, max) {
    return new Promise(function (resolve) {
      var fr = new FileReader();
      fr.onload = function () {
        var img = new Image();
        img.onload = function () {
          var w = img.naturalWidth, h = img.naturalHeight;
          var sc = Math.min(1, max / Math.max(w, h));
          if (sc >= 1) { resolve({ blob: file, width: w, height: h }); return; }
          var cw = Math.round(w * sc), ch = Math.round(h * sc);
          var c = document.createElement('canvas');
          c.width = cw; c.height = ch;
          c.getContext('2d').drawImage(img, 0, 0, cw, ch);
          var mime = /^(image\/png|image\/webp|image\/jpeg)$/.test(file.type) ? file.type : 'image/jpeg';
          c.toBlob(function (blob) {
            resolve(blob ? { blob: blob, width: w, height: h } : null);
          }, mime, 0.88);
        };
        img.onerror = function () { resolve(null); };
        img.src = fr.result;
      };
      fr.onerror = function () { resolve(null); };
      fr.readAsDataURL(file);
    });
  }

  /* ---------- state ---------- */

  var state = {
    works: buildWorks(),
    artworkRows: [],
    media: [],
    mediaRows: [],
    cv: [],
    slide: 0,
    series: 'All',
    year: 'All',
    lbId: null,
    studio: false,
    managerOpen: false,
    managerSection: 'portrait',
    status: '',
    dragId: null,
    overId: null,
    sent: false
  };

  var seen = {};        // reveal keys already animated in
  var replaceId = null; // work awaiting an image replacement
  var slideTimer = null;
  var badSrc = {};      // sources that failed to load, so we stop offering them

  var contentApi = window.NBContentApi
    ? window.NBContentApi.create(window.NB_SUPABASE_CONFIG || {}, window.supabase)
    : {
        configured: false,
        sendContact: function () { return Promise.reject(new Error('Supabase is not configured.')); }
      };
  var studioController = null;
  var studioReturnFocus = null;

  function loadRemoteContent() {
    if (!contentApi.configured) return Promise.resolve(false);
    return contentApi.loadAll().then(function (result) {
      if (!result.artworks.error) {
        state.artworkRows = result.artworks.rows;
        state.works = result.artworks.rows.map(function (row) {
          return window.NBContentModel.normalizeArtwork(row, contentApi.publicUrl);
        });
      } else if (window.console) {
        console.error('Artwork content could not be loaded.', result.artworks.error);
      }

      if (!result.media.error) {
        state.mediaRows = result.media.rows;
        state.media = result.media.rows.map(function (row) {
          return window.NBContentModel.normalizeMedia(row, contentApi.publicUrl);
        });
        window.NBContentRender.renderMedia(document, window.NBContentModel.groupMedia(state.media));
      } else if (window.console) {
        console.error('Media content could not be loaded.', result.media.error);
      }

      if (!result.cv.error) {
        state.cv = result.cv.rows;
        window.NBContentRender.renderCv(document, state.cv);
      } else if (window.console) {
        console.error('CV content could not be loaded.', result.cv.error);
      }

      render();
      document.dispatchEvent(new CustomEvent('nb:content-updated'));
      return true;
    }).catch(function (error) {
      if (window.console) console.error('Remote content could not be loaded.', error);
      return false;
    });
  }

  function patch(id, fields, note) {
    if (!state.studio || !contentApi.configured) return Promise.resolve(false);
    var dbFields = {};
    Object.keys(fields).forEach(function (key) {
      var dbKey = key === 'dims' ? 'dimensions' : key;
      var value = fields[key];
      if (key === 'year') value = String(value).trim() ? Number(value) : null;
      dbFields[dbKey] = value === '' ? null : value;
    });
    setStatus('Saving…');
    return contentApi.updateArtwork(id, dbFields).then(function (updated) {
      var rowIndex = state.artworkRows.map(function (row) { return row.id; }).indexOf(id);
      var workIndex = state.works.map(function (work) { return work.id; }).indexOf(id);
      if (rowIndex >= 0) state.artworkRows[rowIndex] = updated;
      if (workIndex >= 0) {
        state.works[workIndex] = window.NBContentModel.normalizeArtwork(updated, contentApi.publicUrl);
      }
      renderFilters();
      renderWorks();
      renderHero();
      renderStudio();
      paintSlides();
      document.dispatchEvent(new CustomEvent('nb:content-updated'));
      setStatus(note || 'Saved');
      return true;
    }).catch(function (error) {
      setStatus(error.message || 'Could not save this work.');
      return false;
    });
  }

  function canDrag() {
    return state.studio && state.series === 'All' && state.year === 'All';
  }

  function visibleWorks() {
    return state.works.filter(function (w) {
      return (state.series === 'All' || w.series === state.series) &&
             (state.year === 'All' || String(w.year) === state.year);
    });
  }

  /* ---------- reveal on scroll ---------- */

  var observer = null;
  if ('IntersectionObserver' in window) {
    observer = new IntersectionObserver(function (entries) {
      var hit = false;
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var key = en.target.getAttribute('data-reveal');
        if (key && !seen[key]) { seen[key] = true; hit = true; }
        en.target.classList.add('is-in');
        observer.unobserve(en.target);
      });
      if (hit) { /* class already applied; nothing more to do */ }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.01 });
  }

  function watch(root) {
    var nodes = (root || document).querySelectorAll('[data-reveal]');
    Array.prototype.forEach.call(nodes, function (el) {
      var key = el.getAttribute('data-reveal');
      if (seen[key]) { el.classList.add('is-in'); return; }
      if (observer) observer.observe(el);
      else el.classList.add('is-in');
    });
  }

  /* ---------- hero ---------- */

  function heroSources() {
    return state.works.filter(function (w) {
      return w.src && !badSrc[w.src];
    }).slice(0, 3);
  }

  var heroKey = null; // sources currently mounted, so we rebuild only on change

  function renderHero() {
    var stage = $('hero-stage');
    var list = heroSources();

    // Rebuilding the stage restarts every crossfade and re-creates the img
    // elements, so leave it alone unless the source list actually changed.
    var key = list.map(function (w) { return w.src; }).join('|');
    if (key === heroKey) { paintSlides(); return; }
    heroKey = key;

    if (!list.length) {
      stage.innerHTML = '<div class="slot">Work to come</div>';
      return;
    }
    stage.innerHTML = list.map(function (w, n) {
      return '<div class="hero__slide" data-slide="' + n + '">' +
               '<img src="' + esc(w.src) + '" alt="' + esc(w.title) + '"' +
               (n === 0 ? '' : ' loading="lazy"') + '>' +
             '</div>';
    }).join('');

    // If an artwork file is missing, blacklist the source and re-render. This
    // converges (the source is excluded next time round) and stays correct
    // even when several renders overlap.
    Array.prototype.forEach.call(stage.querySelectorAll('img'), function (img) {
      img.addEventListener('error', function () {
        badSrc[img.getAttribute('src')] = true;
        renderHero();
      });
    });
    paintSlides();
  }

  function paintSlides() {
    var slides = $('hero-stage').querySelectorAll('.hero__slide');
    if (!slides.length) return;
    var active = state.slide % slides.length;
    Array.prototype.forEach.call(slides, function (el, n) {
      el.classList.toggle('is-on', n === active);
    });
  }

  function startSlides() {
    if (slideTimer) clearInterval(slideTimer);
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    slideTimer = setInterval(function () {
      state.slide++;
      paintSlides();
    }, SLIDE_MS);
  }

  /* ---------- filters ---------- */

  function renderFilters() {
    // Undated works contribute no year — without the guard, String(null)
    // would produce a literal "null" filter button.
    var years = [];
    state.works.forEach(function (w) {
      if (!w.year) return;
      var y = String(w.year);
      if (years.indexOf(y) === -1) years.push(y);
    });
    years.sort(function (a, b) { return b.localeCompare(a); });

    // A single known year makes the row pointless; it reappears on its own
    // once the archive carries real dates.
    $('year-group').hidden = years.length < 2;
    if (years.length < 2 && state.year !== 'All') state.year = 'All';

    $('series-filters').innerHTML = SERIES_ORDER.map(function (s) {
      return '<button class="filter' + (state.series === s ? ' is-on' : '') +
             '" type="button" data-filter="series" data-value="' + esc(s) + '"' +
             (state.series === s ? ' aria-current="true"' : '') +
             '>' + esc(s) + '</button>';
    }).join('');

    $('year-filters').innerHTML = ['All'].concat(years).map(function (y) {
      return '<button class="filter filter--num' + (state.year === y ? ' is-on' : '') +
             '" type="button" data-filter="year" data-value="' + esc(y) + '"' +
             (state.year === y ? ' aria-current="true"' : '') +
             '>' + esc(y) + '</button>';
    }).join('');
  }

  /* ---------- work grid ---------- */

  function renderWorks() {
    var list = visibleWorks();
    var drag = canDrag();

    $('count-label').textContent = list.length + (list.length === 1 ? ' work' : ' works');

    $('works-grid').innerHTML = list.map(function (w) {
      var ratio = w.ratio || '1 / 1';
      var inner = (w.src && !badSrc[w.src])
        ? '<img src="' + esc(w.src) + '" alt="' + esc(altText(w)) + '" loading="lazy">'
        : '<div class="slot">' + esc(shownTitle(w)) + '</div>';

      return '<figure class="work' + (seen[w.id] ? ' is-in' : '') +
               (drag ? ' is-draggable' : '') +
               (state.overId === w.id ? ' is-over' : '') +
               '" data-id="' + esc(w.id) + '" data-reveal="' + esc(w.id) + '"' +
               (drag ? ' draggable="true"' : '') + '>' +
               '<button class="work__btn" type="button" data-open="' + esc(w.id) + '">' +
                 '<div class="work__img frame" style="aspect-ratio: ' + esc(ratio) + ';">' +
                   inner +
                 '</div>' +
               '</button>' +
               '<figcaption class="work__cap">' +
                 '<span class="work__title">' + esc(shownTitle(w)) + '</span>' +
                 (w.year ? '<span class="work__year">' + esc(w.year) + '</span>' : '') +
                 (drag ? '<span class="work__drag">Drag ⠿</span>' : '') +
               '</figcaption>' +
             '</figure>';
    }).join('');

    // Fall back to a placeholder when an artwork file is missing, and refine
    // the frame ratio from the image's true dimensions once known.
    Array.prototype.forEach.call($('works-grid').querySelectorAll('.work__img img'), function (img) {
      img.addEventListener('error', function () {
        badSrc[img.getAttribute('src')] = true;
        var box = img.parentNode;
        var fig = img.closest ? img.closest('figure') : null;
        var title = fig ? fig.querySelector('.work__title') : null;
        box.innerHTML = '<div class="slot">' + esc(title ? title.textContent : 'Image to come') + '</div>';
      });
      img.addEventListener('load', function () {
        if (img.naturalWidth && img.naturalHeight) {
          img.parentNode.style.aspectRatio = img.naturalWidth + ' / ' + img.naturalHeight;
        }
      });
      if (img.complete && img.naturalWidth) {
        img.parentNode.style.aspectRatio = img.naturalWidth + ' / ' + img.naturalHeight;
      }
    });

    watch($('works-grid'));
  }

  /* ---------- lightbox ---------- */

  var LB_FIELDS = [
    { label: 'Title', key: 'title' },
    { label: 'Year', key: 'year' },
    { label: 'Series', key: 'series' },
    { label: 'Medium', key: 'medium' },
    { label: 'Dimensions', key: 'dims' }
  ];

  function currentWork() {
    if (!state.lbId) return null;
    for (var i = 0; i < state.works.length; i++) {
      if (state.works[i].id === state.lbId) return state.works[i];
    }
    return null;
  }

  function renderLightbox() {
    var box = $('lightbox');
    var w = currentWork();

    if (!w) {
      box.hidden = true;
      document.body.style.overflow = '';
      return;
    }

    box.hidden = false;
    document.body.style.overflow = 'hidden';

    $('lightbox-stage').innerHTML = (w.src && !badSrc[w.src])
      ? '<img src="' + esc(w.src) + '" alt="' + esc(altText(w)) + '">'
      : '<div class="lightbox__empty">Image to come</div>';

    var img = $('lightbox-stage').querySelector('img');
    if (img) {
      img.addEventListener('error', function () {
        badSrc[img.getAttribute('src')] = true;
        $('lightbox-stage').innerHTML = '<div class="lightbox__empty">Image to come</div>';
      });
    }

    var meta = $('lightbox-meta');
    if (state.studio) {
      meta.hidden = true;
    } else {
      meta.hidden = false;
      // Only show the fields we actually have; an empty slot would otherwise
      // read as a gap in the record.
      var parts = ['<span class="lb-title">' + esc(shownTitle(w)) + '</span>'];
      if (w.year) parts.push('<span class="lb-num">' + esc(w.year) + '</span>');
      if (w.medium) parts.push('<span>' + esc(w.medium) + '</span>');
      if (w.dims) parts.push('<span>' + esc(w.dims) + '</span>');
      if (w.series) parts.push('<span class="lb-series">' + esc(w.series) + '</span>');
      parts.push('<span class="lb-hint">Click anywhere to close</span>');
      meta.innerHTML = parts.join('');
    }

    var edit = $('lightbox-edit');
    edit.hidden = !state.studio;
    if (state.studio) {
      $('lightbox-fields').innerHTML = LB_FIELDS.map(function (f) {
        var val = w[f.key] == null ? '' : String(w[f.key]);
        return '<label class="field">' +
                 '<span class="field__label">' + esc(f.label) + '</span>' +
                 '<input class="field__input" type="text" data-field="' + esc(f.key) +
                   '" value="' + esc(val) + '">' +
               '</label>';
      }).join('');
    }
  }

  function closeLightbox() {
    state.lbId = null;
    renderLightbox();
  }

  /* ---------- studio chrome ---------- */

  function renderStudio() {
    var on = state.studio;
    var drag = canDrag();

    $('studiobar').hidden = !on;
    $('studio-add').hidden = !on;
    $('studio-toggle').textContent = on ? 'Studio — on' : 'Studio';

    $('studio-status').textContent = state.status ||
      (drag ? 'Drag any work to reorder · click a work to edit' : 'Clear the filters to reorder');

    $('studio-hint').textContent = drag
      ? 'Uploads keep each painting’s own proportions. Drag to rearrange, click a work to edit its details or replace the image.'
      : 'Set both filters back to All to rearrange works.';

    document.body.style.paddingBottom = on ? '64px' : '';
  }

  function groupedCv() {
    var grouped = { exhibition: [], project: [], fair: [] };
    state.cv.slice().sort(function (a, b) {
      return Number(a.sort_order) - Number(b.sort_order);
    }).forEach(function (entry) {
      if (grouped[entry.category]) grouped[entry.category].push(entry);
    });
    return grouped;
  }

  function renderManager() {
    var gate = $('managergate');
    if (!gate) return;
    gate.hidden = !state.managerOpen;
    if (!state.managerOpen) return;
    var grouped = window.NBContentModel.groupMedia(state.media);
    grouped.cv = groupedCv();
    $('manager-body').innerHTML = window.NBContentRender.managerHtml(grouped, state.managerSection);
  }

  /* ---------- uploads ---------- */

  function setStatus(msg) {
    state.status = msg;
    $('studio-status').textContent = msg;
  }

  function artworkRow(id) {
    for (var i = 0; i < state.artworkRows.length; i++) {
      if (state.artworkRows[i].id === id) return state.artworkRows[i];
    }
    return null;
  }

  function uniqueId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
    return '00000000-0000-4000-8000-' + Date.now().toString(16).padStart(12, '0').slice(-12);
  }

  function replacementPath(id, mime) {
    return window.NBContentModel.storagePath('artwork', id, mime)
      .replace(/(\.[^.]+)$/, '-' + Date.now() + '$1');
  }

  function ingest(files, targetId) {
    var list = Array.prototype.slice.call(files || []);
    if (!list.length) return Promise.resolve();

    if (!state.studio || !contentApi.configured) {
      setStatus('Sign in to Studio before uploading.');
      return Promise.resolve();
    }

    var invalid = list.map(function (file) {
      return window.NBContentModel.validateFile(file, 'artwork');
    }).filter(function (check) { return !check.ok; })[0];
    if (invalid) {
      setStatus(invalid.message);
      return Promise.resolve();
    }

    setStatus('Processing ' + list.length + ' image' + (list.length > 1 ? 's' : '') + '…');

    return list.reduce(function (chain, f) {
      return chain.then(function (acc) {
        return readScaled(f, MAX_EDGE).then(function (r) {
          if (r) acc.push({ file: f, r: r });
          return acc;
        });
      });
    }, Promise.resolve([])).then(function (done) {
      if (!done.length) { setStatus('Nothing could be read.'); return false; }

      if (targetId) {
        var oldRow = artworkRow(targetId);
        if (!oldRow) { setStatus('This work could not be found.'); return false; }
        setStatus('Uploading replacement…');
        return window.NBStudio.replaceArtworkImageTransaction(contentApi, state.works, oldRow, {
          blob: done[0].r.blob,
          width: done[0].r.width,
          height: done[0].r.height,
          storagePath: replacementPath(targetId, done[0].r.blob.type)
        }).then(function (outcome) {
          if (!outcome.ok) throw outcome.error;
          return loadRemoteContent();
        }).then(function () {
          setStatus('Image replaced');
          renderLightbox();
          return true;
        }).catch(function (error) {
          setStatus(error.message || 'The image could not be replaced.');
          return false;
        });
      }

      var added = 0;
      return done.reduce(function (chain, item) {
        return chain.then(function () {
          var id = uniqueId();
          return window.NBStudio.createArtworkTransaction(contentApi, state.works, {
            id: id,
            file: item.file,
            blob: item.r.blob,
            width: item.r.width,
            height: item.r.height,
            title: titleFromFile(item.file.name),
            year: new Date().getFullYear(),
            series: 'Monsters',
            medium: 'Oil on canvas',
            dimensions: '',
            sortOrder: window.NBStudio.nextSortOrder(state.artworkRows)
          }).then(function (outcome) {
            if (!outcome.ok) throw outcome.error;
            added += 1;
            return loadRemoteContent();
          });
        });
      }, Promise.resolve()).then(function () {
        setStatus(added + ' work' + (added === 1 ? '' : 's') + ' added — click one to edit it');
        return true;
      }).catch(function (error) {
        setStatus((error && error.message) || 'An image could not be uploaded.');
        return false;
      });
    });
  }

  function deleteArtwork(id) {
    var row = artworkRow(id);
    if (!row) { setStatus('This work could not be found.'); return Promise.resolve(false); }
    if (!window.confirm('Delete this work permanently? This cannot be undone.')) return Promise.resolve(false);
    setStatus('Deleting…');
    return window.NBStudio.deleteFileBackedRecord(
      function () { return contentApi.deleteArtwork(id); },
      function () { return row.storage_path ? contentApi.remove([row.storage_path]) : Promise.resolve(); }
    ).then(function (outcome) {
      if (!outcome.ok) throw outcome.error;
      state.lbId = null;
      return loadRemoteContent().then(function () { return outcome; });
    }).then(function (outcome) {
      setStatus(outcome.cleanupError ? 'Work removed; its old file still needs cleanup.' : 'Work removed');
      return true;
    }).catch(function (error) {
      setStatus(error.message || 'The work could not be removed.');
      return false;
    });
  }

  function managerStatus(message) {
    $('manager-status').textContent = message || '';
  }

  function managerMediaRow(id) {
    for (var i = 0; i < state.mediaRows.length; i++) {
      if (state.mediaRows[i].id === id) return state.mediaRows[i];
    }
    return null;
  }

  function setManagerPending(form, pending) {
    Array.prototype.forEach.call(form.querySelectorAll('button, input, select'), function (control) {
      control.disabled = pending;
    });
  }

  function managerFormValue(form, name) {
    return form.elements[name] ? form.elements[name].value.trim() : '';
  }

  function managerMediaFields(form, kind) {
    return {
      title: managerFormValue(form, 'title') || null,
      alt_text: managerFormValue(form, 'alt_text') || null,
      group_name: kind === 'spotify_image' ? managerFormValue(form, 'group_name') : null,
      external_url: null,
      published: true
    };
  }

  function managerRowsFor(kind, groupName) {
    return state.mediaRows.filter(function (row) {
      return row.kind === kind && (row.group_name || '') === (groupName || '');
    }).sort(function (a, b) { return Number(a.sort_order) - Number(b.sort_order); });
  }

  function prepareManagerFile(file, kind) {
    var check = window.NBContentModel.validateFile(file, kind);
    if (!check.ok) return Promise.reject(new Error(check.message));
    if (kind === 'canvas_video') {
      return Promise.resolve({ blob: file, width: null, height: null });
    }
    return readScaled(file, MAX_EDGE).then(function (prepared) {
      if (!prepared) throw new Error('The selected image could not be read.');
      return prepared;
    });
  }

  function managerStoragePath(kind, id, mimeType, replacement) {
    var path = window.NBContentModel.storagePath(kind, id, mimeType);
    return replacement ? path.replace(/(\.[^.]+)$/, '-' + Date.now() + '$1') : path;
  }

  function managerFormKey(form) {
    return [
      form.getAttribute('data-kind') || '',
      form.getAttribute('data-id') || 'new',
      form.getAttribute('data-category') || ''
    ].join('|');
  }

  function captureManagerDrafts(excludedForm) {
    var root = $('manager-body');
    var snapshot = { values: {}, fileInputs: {}, focus: null };
    if (!root) return snapshot;
    Array.prototype.forEach.call(root.querySelectorAll('.manager__row'), function (form) {
      var key = managerFormKey(form);
      if (form !== excludedForm) {
        snapshot.values[key] = {};
        snapshot.fileInputs[key] = {};
        Array.prototype.forEach.call(form.querySelectorAll('input[name], select[name], textarea[name]'), function (control) {
          if (control.type === 'file') {
            if (control.files && control.files.length) snapshot.fileInputs[key][control.name] = control;
          } else {
            snapshot.values[key][control.name] = control.value;
          }
        });
      }
      if (form.contains(document.activeElement)) {
        var controls = Array.prototype.slice.call(form.querySelectorAll('input, select, textarea, button'));
        snapshot.focus = { key: key, index: controls.indexOf(document.activeElement) };
      }
    });
    return snapshot;
  }

  function restoreManagerDrafts(snapshot) {
    if (!snapshot) return;
    var forms = Array.prototype.slice.call($('manager-body').querySelectorAll('.manager__row'));
    forms.forEach(function (form) {
      var values = snapshot.values[managerFormKey(form)];
      if (!values) return;
      Object.keys(values).forEach(function (name) {
        if (form.elements[name] && form.elements[name].type !== 'file') form.elements[name].value = values[name];
      });
      Object.keys(snapshot.fileInputs[managerFormKey(form)] || {}).forEach(function (name) {
        var current = form.elements[name];
        if (current && current.type === 'file') current.replaceWith(snapshot.fileInputs[managerFormKey(form)][name]);
      });
    });
    if (!snapshot.focus) return;
    var focusForm = forms.filter(function (form) { return managerFormKey(form) === snapshot.focus.key; })[0];
    if (!focusForm) return;
    var controls = focusForm.querySelectorAll('input, select, textarea, button');
    if (controls[snapshot.focus.index]) controls[snapshot.focus.index].focus();
  }

  function refreshAfterManagerWrite(message, submittedForm) {
    var drafts = captureManagerDrafts(submittedForm);
    return loadRemoteContent().then(function (loaded) {
      if (!loaded) throw new Error('The content was saved, but the page could not refresh.');
      restoreManagerDrafts(drafts);
      managerStatus(message);
      return true;
    });
  }

  function saveMediaManagerForm(form, kind, isNew) {
    var fields = managerMediaFields(form, kind);
    var fileInput = form.elements.file;
    var file = fileInput && fileInput.files ? fileInput.files[0] : null;
    var id = isNew ? uniqueId() : form.getAttribute('data-id');
    var row = isNew ? null : managerMediaRow(id);
    if (!isNew && !row) return Promise.reject(new Error('This content record could not be found.'));
    if (isNew && !file) return Promise.reject(new Error('Choose a file first.'));
    if (!isNew && kind === 'spotify_image' && (row.group_name || '') !== (fields.group_name || '')) {
      fields.sort_order = window.NBStudio.nextSortOrder(managerRowsFor(kind, fields.group_name));
    }

    if (!file) {
      return contentApi.updateMedia(id, fields).then(function () {
        return refreshAfterManagerWrite('Changes saved.', form);
      });
    }

    return prepareManagerFile(file, kind).then(function (prepared) {
      prepared.id = id;
      prepared.storagePath = managerStoragePath(kind, id, prepared.blob.type, !isNew);
      prepared.fields = fields;
      if (isNew) {
        prepared.fields.slug = kind.replace(/_/g, '-') + '-' + id;
        prepared.fields.kind = kind;
        prepared.fields.sort_order = window.NBStudio.nextSortOrder(managerRowsFor(kind, fields.group_name));
        return window.NBStudio.createMediaFileTransaction(contentApi, state.mediaRows, prepared);
      }
      return window.NBStudio.replaceMediaFileTransaction(contentApi, state.mediaRows, row, prepared);
    }).then(function (outcome) {
      if (!outcome.ok) throw outcome.error;
      return refreshAfterManagerWrite(isNew ? 'Content added.' : 'File and details replaced.', form);
    });
  }

  function saveYouTubeManagerForm(form) {
    var id = form.getAttribute('data-id');
    var url = managerFormValue(form, 'external_url');
    var title = managerFormValue(form, 'title') || 'YouTube';
    if (id) {
      return window.NBStudio.saveYouTube(contentApi, { id: id }, url, {
        title: title, alt_text: null, group_name: null, published: true
      }).then(function (outcome) {
        if (!outcome.ok) throw outcome.error;
        return refreshAfterManagerWrite('YouTube video saved.', form);
      });
    }
    var normalized = window.NBContentModel.normalizeYoutubeUrl(url);
    if (!normalized) return Promise.reject(new Error('Enter a valid YouTube URL.'));
    id = uniqueId();
    return contentApi.insertMedia({
      id: id,
      slug: 'youtube-' + id,
      kind: 'youtube',
      group_name: null,
      title: title,
      alt_text: null,
      external_url: normalized,
      storage_path: null,
      legacy_path: null,
      mime_type: null,
      aspect_width: null,
      aspect_height: null,
      sort_order: 0,
      published: true
    }).then(function () { return refreshAfterManagerWrite('YouTube video saved.', form); });
  }

  function saveCvManagerForm(form, isNew) {
    var category = isNew ? managerFormValue(form, 'category') : form.getAttribute('data-category');
    var fields = {
      category: category,
      year: managerFormValue(form, 'year'),
      description: managerFormValue(form, 'description'),
      published: true
    };
    if (!fields.year || !fields.description) return Promise.reject(new Error('Enter both a year and description.'));
    if (!isNew) {
      return contentApi.updateCv(form.getAttribute('data-id'), fields)
        .then(function () { return refreshAfterManagerWrite('CV entry saved.', form); });
    }
    var id = uniqueId();
    fields.id = id;
    fields.slug = 'cv-' + id;
    fields.sort_order = window.NBStudio.nextSortOrder(groupedCv()[category]);
    return contentApi.insertCv(fields).then(function () { return refreshAfterManagerWrite('CV entry added.', form); });
  }

  function saveManagerForm(form) {
    var kind = form.getAttribute('data-kind');
    var isNew = form.getAttribute('data-new') === 'true';
    setManagerPending(form, true);
    managerStatus('Saving…');
    var operation;
    if (kind === 'cv') operation = saveCvManagerForm(form, isNew);
    else if (kind === 'youtube') operation = saveYouTubeManagerForm(form);
    else operation = saveMediaManagerForm(form, kind, isNew);
    return operation.catch(function (error) {
      managerStatus(error.message || 'The content could not be saved.');
      return false;
    }).then(function (outcome) {
      setManagerPending(form, false);
      return outcome;
    });
  }

  function deleteManagerRow(form) {
    var kind = form.getAttribute('data-kind');
    var id = form.getAttribute('data-id');
    var isCv = kind === 'cv';
    var row = isCv ? state.cv.filter(function (entry) { return entry.id === id; })[0] : managerMediaRow(id);
    if (!row) { managerStatus('This content record could not be found.'); return Promise.resolve(false); }
    var label = row.title || row.description || kind;
    if (!window.confirm('Delete “' + label + '” permanently? This cannot be undone.')) return Promise.resolve(false);
    setManagerPending(form, true);
    managerStatus('Deleting…');
    var deletion = isCv
      ? Promise.resolve(contentApi.deleteCv(id)).then(function () { return { ok: true }; })
      : window.NBStudio.deleteFileBackedRecord(
          function () { return contentApi.deleteMedia(id); },
          function () { return row.storage_path ? contentApi.remove([row.storage_path]) : Promise.resolve(); }
        );
    return deletion.then(function (outcome) {
      if (!outcome.ok) throw outcome.error;
      var message = outcome.cleanupError
        ? 'Content deleted; its old file still needs cleanup.'
        : 'Content deleted.';
      return refreshAfterManagerWrite(message, form);
    }).catch(function (error) {
      managerStatus(error.message || 'The content could not be deleted.');
      setManagerPending(form, false);
      return false;
    });
  }

  function moveManagerRow(form, direction) {
    var kind = form.getAttribute('data-kind');
    var id = form.getAttribute('data-id');
    var rows;
    var category = null;
    var groupName = null;
    var operation;
    if (kind === 'cv') {
      category = form.getAttribute('data-category');
      rows = groupedCv()[category];
    } else {
      var row = managerMediaRow(id);
      if (!row) { managerStatus('This content record could not be found.'); return Promise.resolve(false); }
      groupName = row.group_name;
      rows = managerRowsFor(kind, groupName);
    }
    var index = rows.map(function (item) { return item.id; }).indexOf(id);
    var target = direction === 'up' ? index - 1 : index + 1;
    if (index < 0 || target < 0 || target >= rows.length) return Promise.resolve(false);
    var ids = rows.map(function (item) { return item.id; });
    var moved = ids.splice(index, 1)[0];
    ids.splice(target, 0, moved);
    setManagerPending(form, true);
    managerStatus('Saving order…');
    operation = kind === 'cv'
      ? window.NBStudio.persistCvOrder(contentApi, rows, category, ids)
      : window.NBStudio.persistMediaOrder(contentApi, rows, kind, groupName, ids);
    return operation.then(function (outcome) {
      if (!outcome.ok) throw outcome.error;
      return refreshAfterManagerWrite('Order saved.');
    }).catch(function (error) {
      managerStatus(error.message || 'The order could not be saved.');
      setManagerPending(form, false);
      return false;
    });
  }

  /* ---------- render ---------- */

  function render() {
    renderFilters();
    renderWorks();
    renderHero();
    renderStudio();
    renderLightbox();
    renderManager();
    paintSlides();
  }

  /* ---------- events ---------- */

  function wire() {
    // filters
    ['series-filters', 'year-filters'].forEach(function (id) {
      $(id).addEventListener('click', function (e) {
        var btn = e.target.closest('.filter');
        if (!btn) return;
        state[btn.getAttribute('data-filter')] = btn.getAttribute('data-value');
        state.status = '';
        render();
      });
    });

    // open a work
    var grid = $('works-grid');
    grid.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-open]');
      if (!btn) return;
      state.lbId = btn.getAttribute('data-open');
      renderLightbox();
    });

    // drag to reorder (studio, unfiltered only)
    grid.addEventListener('dragstart', function (e) {
      var fig = e.target.closest('.work');
      if (!fig || !canDrag()) return;
      state.dragId = fig.getAttribute('data-id');
      fig.classList.add('is-dragging');
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move';
        try { e.dataTransfer.setData('text/plain', state.dragId); } catch (err) {}
      }
    });

    grid.addEventListener('dragover', function (e) {
      var fig = e.target.closest('.work');
      if (!fig || !canDrag() || !state.dragId) return;
      e.preventDefault();
      var id = fig.getAttribute('data-id');
      if (state.overId === id) return;
      var prev = grid.querySelector('.work.is-over');
      if (prev) prev.classList.remove('is-over');
      state.overId = id;
      fig.classList.add('is-over');
    });

    grid.addEventListener('drop', function (e) {
      var fig = e.target.closest('.work');
      if (!fig || !canDrag()) return;
      e.preventDefault();
      moveTo(fig.getAttribute('data-id'));
    });

    grid.addEventListener('dragend', function () {
      var d = grid.querySelector('.work.is-dragging');
      if (d) d.classList.remove('is-dragging');
      var o = grid.querySelector('.work.is-over');
      if (o) o.classList.remove('is-over');
      state.dragId = null;
      state.overId = null;
    });

    // lightbox
    var box = $('lightbox');
    box.addEventListener('click', function (e) {
      if (e.target.closest('.lightbox__edit')) return;  // editing panel is not a close target
      closeLightbox();
    });

    $('lightbox-fields').addEventListener('change', function (e) {
      var input = e.target.closest('[data-field]');
      var w = currentWork();
      if (!input || !w) return;
      var fields = {};
      fields[input.getAttribute('data-field')] = input.value;
      patch(w.id, fields, 'Saved');
    });

    $('lb-done').addEventListener('click', closeLightbox);

    $('lb-replace').addEventListener('click', function () {
      replaceId = state.lbId;
      var el = $('nb-replace-file');
      el.value = '';
      el.click();
    });

    $('lb-delete').addEventListener('click', function () {
      var id = state.lbId;
      if (!id) return;
      deleteArtwork(id);
    });

    // studio access
    $('studio-toggle').addEventListener('click', function () {
      if (state.studio) {
        studioController.signOut();
      } else {
        openGate();
      }
    });

    $('pass-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var button = $('studio-submit');
      button.disabled = true;
      $('pass-error').textContent = 'Signing in…';
      studioController.login($('studio-email').value.trim(), $('studio-password').value)
        .then(function (outcome) {
          $('pass-error').textContent = outcome.message;
          if (outcome.ok) closeGate();
        }).then(function () { button.disabled = false; });
    });

    $('pass-cancel').addEventListener('click', closeGate);

    $('studio-forgot').addEventListener('click', function () {
      var email = $('studio-email').value.trim();
      $('pass-error').textContent = 'Requesting recovery email…';
      studioController.requestRecovery(email, window.location.origin + window.location.pathname)
        .then(function (outcome) { $('pass-error').textContent = outcome.message; });
    });

    $('bar-signout').addEventListener('click', function () {
      studioController.signOut();
    });

    $('bar-password').addEventListener('click', function () {
      openPasswordGate();
    });

    $('bar-manage').addEventListener('click', openManager);
    $('manager-close').addEventListener('click', closeManager);
    $('manager-body').addEventListener('submit', function (e) {
      var form = e.target.closest('.manager__row');
      if (!form) return;
      e.preventDefault();
      saveManagerForm(form);
    });
    $('manager-body').addEventListener('click', function (e) {
      var section = e.target.closest('[data-manager-section]');
      if (section) {
        state.managerSection = section.getAttribute('data-manager-section');
        renderManager();
        var selected = $('manager-body').querySelector('[data-manager-section="' + state.managerSection + '"]');
        if (selected) selected.focus();
        return;
      }
      var action = e.target.closest('[data-manager-action]');
      if (!action) return;
      var form = action.closest('.manager__row');
      if (!form) return;
      var name = action.getAttribute('data-manager-action');
      if (name === 'delete') deleteManagerRow(form);
      if (name === 'up' || name === 'down') moveManagerRow(form, name);
    });

    $('password-send-code').addEventListener('click', function () {
      $('password-status').textContent = 'Sending verification code…';
      studioController.requestPasswordChange().then(function (outcome) {
        $('password-status').textContent = outcome.message;
      });
    });

    $('password-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var button = $('password-submit');
      button.disabled = true;
      studioController.submitPasswordChange(
        $('password-nonce').value.trim(), $('password-new').value, $('password-confirm').value
      ).then(function (outcome) {
        $('password-status').textContent = outcome.message;
        if (outcome.ok) {
          $('password-nonce').value = '';
          $('password-new').value = '';
          $('password-confirm').value = '';
        }
      }).then(function () { button.disabled = false; });
    });

    $('password-cancel').addEventListener('click', closePasswordGate);

    // uploads
    $('bar-upload').addEventListener('click', pickAdd);
    $('btn-upload-works').addEventListener('click', pickAdd);

    $('nb-add-files').addEventListener('change', function (e) {
      ingest(e.target.files, null);
    });

    $('nb-replace-file').addEventListener('change', function (e) {
      ingest(e.target.files, replaceId);
      replaceId = null;
    });

    // keyboard
    window.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      if (!$('passgate').hidden) { closeGate(); return; }
      if (!$('passwordgate').hidden) { closePasswordGate(); return; }
      if (!$('managergate').hidden) { closeManager(); return; }
      if (state.lbId) closeLightbox();
    });

    // contact
    $('contact-form').addEventListener('submit', onSubmit);
  }

  function pickAdd() {
    var el = $('nb-add-files');
    el.value = '';
    el.click();
  }

  function moveTo(targetId) {
    var from = state.dragId;
    if (!from || from === targetId) return;
    var arr = state.works.slice();
    var fi = -1, ti = -1;
    arr.forEach(function (w, n) {
      if (w.id === from) fi = n;
      if (w.id === targetId) ti = n;
    });
    if (fi < 0 || ti < 0) return;
    var item = arr.splice(fi, 1)[0];
    arr.splice(ti, 0, item);
    state.dragId = null;
    state.overId = null;
    setStatus('Saving order…');
    window.NBStudio.persistOrder(contentApi, state.works, arr.map(function (work) {
      return work.id;
    })).then(function (outcome) {
      if (!outcome.ok) {
        setStatus(outcome.error.message || 'The order could not be saved.');
        render();
        return;
      }
      state.works = outcome.works;
      state.status = 'Order saved';
      render();
    });
  }

  function openGate() {
    studioReturnFocus = document.activeElement;
    $('pass-error').textContent = contentApi.configured ? '' : 'Studio needs Supabase configuration before sign-in.';
    $('studio-password').value = '';
    $('passgate').hidden = false;
    $('studio-email').focus();
  }

  function closeGate() {
    $('passgate').hidden = true;
    $('pass-error').textContent = '';
    $('studio-password').value = '';
    if (studioReturnFocus && studioReturnFocus.focus) studioReturnFocus.focus();
  }

  function openPasswordGate() {
    studioReturnFocus = document.activeElement;
    $('password-status').textContent = '';
    $('passwordgate').hidden = false;
    $('password-send-code').focus();
  }

  function closePasswordGate() {
    $('passwordgate').hidden = true;
    $('password-status').textContent = '';
    if (studioReturnFocus && studioReturnFocus.focus) studioReturnFocus.focus();
  }

  function openManager() {
    if (!state.studio || !contentApi.configured) return;
    state.managerOpen = true;
    managerStatus('');
    renderManager();
    var selected = $('manager-body').querySelector('[data-manager-section][aria-current="page"]');
    if (selected) selected.focus();
  }

  function closeManager() {
    state.managerOpen = false;
    $('managergate').hidden = true;
    managerStatus('');
    $('bar-manage').focus();
  }

  function setupStudioAuth() {
    studioController = window.NBStudio.create({
      auth: contentApi.configured ? contentApi.auth : null,
      isStudioUser: contentApi.configured ? contentApi.isStudioUser : function () { return Promise.resolve(false); },
      onStudioChange: function (on) {
        state.studio = on;
        if (!on) {
          state.lbId = null;
          state.managerOpen = false;
          $('managergate').hidden = true;
        }
        state.status = on ? 'Signed in' : '';
        render();
      },
      onRecovery: openPasswordGate,
      onLoginRequest: openGate
    });
    return studioController.init();
  }

  /* ---------- contact form ---------- */

  function onSubmit(e) {
    e.preventDefault();
    var form = e.currentTarget;
    var status = $('form-status');
    var btn = $('send-btn');

    var fields = {
      name: form.elements.name.value,
      email: form.elements.email.value,
      message: form.elements.message.value,
      website: form.elements.website.value
    };
    btn.disabled = true;
    btn.textContent = 'Sending…';
    status.textContent = 'Sending…';
    window.NBContact.submit(contentApi.sendContact, fields).then(function (outcome) {
      status.textContent = outcome.message;
      btn.textContent = outcome.ok ? 'Sent — thank you' : 'Send';
      if (outcome.ok) form.reset();
      btn.disabled = false;
    });
  }

  /* ---------- boot ---------- */

  function init() {
    $('year').textContent = String(new Date().getFullYear());

    watch($('films-grid'));
    render();
    wire();
    setupStudioAuth();
    startSlides();
    loadRemoteContent();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
