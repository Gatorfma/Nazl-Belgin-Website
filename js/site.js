/* Nazlı Belgin — portfolio behaviour
 *
 * Ported from the source design canvas (x-dc / DCLogic) to plain ES2018.
 * No build step, no dependencies.
 *
 * Studio mode lives entirely in this browser: works are persisted to
 * localStorage under STORE, the signed-in flag under AUTH. It is an
 * editing convenience for the artist on her own machine, not real
 * server-side auth — see README.
 */
(function () {
  'use strict';

  /* ---------- configuration ---------- */

  var PASSCODE = 'atelier';          // studio passcode
  var STORE    = 'nb-works-v1';      // localStorage key for the work list
  var AUTH     = 'nb-studio-auth';   // localStorage key for the studio flag
  var SLIDE_MS = 5200;               // hero crossfade interval
  var MAX_EDGE = 1800;               // uploads are downscaled to this longest edge

  // Set to a URL that accepts POST JSON to deliver the contact form
  // server-side. While null, the form falls back to a prefilled mailto:.
  var FORM_ENDPOINT = null;
  var CONTACT_EMAIL = 'studio@nazlibelgin.com';

  /* ---------- source data ---------- */

  var REAL = [
    { src: 'art/sweet-devil.jpg', title: 'My Sweet Devil',          year: 2025, series: 'Monsters',  medium: 'Oil on canvas',              dims: '60 × 60 cm',   ratio: '2569 / 2574' },
    { src: 'art/darwin.jpg',      title: 'Darwin Was Just Guessing', year: 2025, series: 'Evolution', medium: 'Oil on canvas',              dims: '100 × 81 cm',  ratio: '2510 / 3012' },
    { src: 'art/too-horny.jpg',   title: 'Too Horny to Die',         year: 2025, series: 'Monsters',  medium: 'Oil and oil stick on canvas', dims: '25 × 25 cm',   ratio: '1952 / 1893' }
  ];

  var TITLES = {
    'Monsters':    ['Little Teeth', 'The Guest', 'Soft Monster, Hard Year', 'He Says He Is Sorry', 'Pink Thing Sleeping', 'Devil Learns to Sit', 'Mouth Full of Weather', 'Nightmare with Ears', 'Good Boy, Bad Century'],
    'Evolution':   ['The Beasts Knew Better', 'First Ancestor', 'Something Grew Legs', 'Adaptation (Failed)', 'Common Descent', 'Warm Blooded, Cold Room', 'Missing Link, Found', 'Selection Pressure', 'A + T, G + C'],
    'Stone Hills': ['Hill with No Name', 'Quarry Light', 'Stone Hills, Evening', 'The Hill Remembers', 'Dry Riverbed', 'Stone Hills, Noon', 'Two Rocks Talking', 'Where the Hills End', 'Stone Hills, Rain']
  };

  var MEDIA  = ['Oil on linen', 'Graphite and ink on paper', 'Pastel and ink on paper', 'Oil and oil stick on canvas', 'Ink on paper'];
  var DIMS   = ['120 × 100 cm', '50 × 40 cm', '162 × 130 cm', '30 × 24 cm', '81 × 65 cm', '200 × 170 cm'];
  var RATIOS = ['4 / 5', '1 / 1', '5 / 4', '3 / 4', '1 / 1.15', '4 / 3'];

  var SERIES_ORDER = ['All', 'Monsters', 'Evolution', 'Stone Hills'];

  var FILMS = [
    { title: 'Underpainting',                  desc: 'Forty minutes of blue going down, cut to four.',            meta: '2025 · 4:12', placeholder: 'Film still' },
    { title: 'The Beasts Knew Better',         desc: 'A canvas argued with for three weeks, in reverse.',         meta: '2024 · 6:40', placeholder: 'Film still' },
    { title: 'Stone Hills (Field Recording)',  desc: 'Walking the quarry road that the series keeps returning to.', meta: '2024 · 9:03', placeholder: 'Film still' },
    { title: 'Studio, Thursday',               desc: 'Nothing happens. Then the teeth happen.',                   meta: '2023 · 2:58', placeholder: 'Film still' }
  ];

  function buildWorks() {
    var out = [];
    var names = Object.keys(TITLES);
    var i = 0;
    REAL.forEach(function (r) {
      out.push(assign({}, r, { id: 'w' + (i++) }));
    });
    for (var k = 0; k < 9; k++) {
      names.forEach(function (s) {
        var idx = names.indexOf(s);
        out.push({
          src: null,
          title: TITLES[s][k],
          series: s,
          year: 2026 - ((k * 2 + idx) % 6),
          medium: MEDIA[(k + idx) % MEDIA.length],
          dims: DIMS[(k * 2 + idx) % DIMS.length],
          ratio: RATIOS[(k + idx * 2) % RATIOS.length],
          id: 'w' + (i++)
        });
      });
    }
    return out.slice(0, 30);
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

  function titleFromFile(name) {
    var base = String(name).replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim();
    return base ? base.charAt(0).toUpperCase() + base.slice(1) : 'Untitled';
  }

  function lsGet(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
  function lsSet(key, val) { try { localStorage.setItem(key, val); return true; } catch (e) { return false; } }
  function lsDel(key) { try { localStorage.removeItem(key); } catch (e) {} }

  // Reads a File, downscales it to MAX_EDGE, and returns a data URL plus the
  // image's true aspect ratio so the grid keeps each painting's proportions.
  function readScaled(file, max) {
    return new Promise(function (resolve) {
      var fr = new FileReader();
      fr.onload = function () {
        var img = new Image();
        img.onload = function () {
          var w = img.naturalWidth, h = img.naturalHeight;
          var sc = Math.min(1, max / Math.max(w, h));
          if (sc >= 1) { resolve({ url: fr.result, ratio: w + ' / ' + h }); return; }
          var cw = Math.round(w * sc), ch = Math.round(h * sc);
          var c = document.createElement('canvas');
          c.width = cw; c.height = ch;
          c.getContext('2d').drawImage(img, 0, 0, cw, ch);
          resolve({ url: c.toDataURL('image/jpeg', 0.88), ratio: w + ' / ' + h });
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
    slide: 0,
    series: 'All',
    year: 'All',
    lbId: null,
    studio: false,
    status: '',
    dragId: null,
    overId: null,
    sent: false
  };

  var seen = {};        // reveal keys already animated in
  var replaceId = null; // work awaiting an image replacement
  var slideTimer = null;
  var badSrc = {};      // sources that failed to load, so we stop offering them

  function save(works, note) {
    state.works = works;
    state.status = note || 'Saved';
    if (!lsSet(STORE, JSON.stringify(works))) {
      state.status = 'Storage full — remove a work or use smaller files.';
    }
    render();
  }

  function patch(id, fields, note) {
    save(state.works.map(function (w) {
      return w.id === id ? assign({}, w, fields) : w;
    }), note);
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

  function renderHero() {
    var stage = $('hero-stage');
    var list = heroSources();
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
    var years = [];
    state.works.forEach(function (w) {
      var y = String(w.year);
      if (years.indexOf(y) === -1) years.push(y);
    });
    years.sort(function (a, b) { return b.localeCompare(a); });

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
        ? '<img src="' + esc(w.src) + '" alt="' + esc(w.title) + '" loading="lazy">'
        : '<div class="slot">' + esc(w.title) + '</div>';

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
                 '<span class="work__title">' + esc(w.title) + '</span>' +
                 '<span class="work__year">' + esc(w.year) + '</span>' +
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

  /* ---------- films ---------- */

  function renderFilms() {
    $('films-grid').innerHTML = FILMS.map(function (f, n) {
      return '<article class="film' + (seen['f' + n] ? ' is-in' : '') +
               '" data-reveal="f' + n + '">' +
               '<div class="frame frame--film">' +
                 '<div class="slot">' + esc(f.placeholder) + '</div>' +
                 '<div class="film__play">' +
                   '<svg viewBox="0 0 64 64" aria-hidden="true">' +
                     '<circle cx="32" cy="32" r="30" fill="none" stroke="#F2EDE3" stroke-width="1.2" opacity="0.9"/>' +
                     '<path d="M26 21l19 11-19 11z" fill="#F2EDE3"/>' +
                   '</svg>' +
                 '</div>' +
               '</div>' +
               '<h3 class="film__title">' + esc(f.title) + '</h3>' +
               '<p class="film__desc">' + esc(f.desc) + '</p>' +
               '<p class="film__meta">' + esc(f.meta) + '</p>' +
             '</article>';
    }).join('');
    watch($('films-grid'));
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
      ? '<img src="' + esc(w.src) + '" alt="' + esc(w.title) + '">'
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
      meta.innerHTML =
        '<span class="lb-title">' + esc(w.title) + '</span>' +
        '<span class="lb-num">' + esc(w.year) + '</span>' +
        '<span>' + esc(w.medium) + '</span>' +
        '<span>' + esc(w.dims) + '</span>' +
        '<span class="lb-series">' + esc(w.series) + '</span>' +
        '<span class="lb-hint">Click anywhere to close</span>';
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

  /* ---------- uploads ---------- */

  function setStatus(msg) {
    state.status = msg;
    $('studio-status').textContent = msg;
  }

  function ingest(files, targetId) {
    var list = Array.prototype.slice.call(files || []);
    if (!list.length) return Promise.resolve();

    setStatus('Processing ' + list.length + ' image' + (list.length > 1 ? 's' : '') + '…');

    return list.reduce(function (chain, f) {
      return chain.then(function (acc) {
        return readScaled(f, MAX_EDGE).then(function (r) {
          if (r) acc.push({ file: f, r: r });
          return acc;
        });
      });
    }, Promise.resolve([])).then(function (done) {
      if (!done.length) { setStatus('Nothing could be read.'); return; }

      if (targetId) {
        patch(targetId, { src: done[0].r.url, ratio: done[0].r.ratio }, 'Image replaced');
        renderLightbox();
        return;
      }

      var stamp = Date.now();
      var added = done.map(function (d, n) {
        return {
          id: 'u' + stamp + '-' + n,
          src: d.r.url,
          ratio: d.r.ratio,
          title: titleFromFile(d.file.name),
          year: new Date().getFullYear(),
          series: 'Monsters',
          medium: 'Oil on canvas',
          dims: ''
        };
      });
      save(added.concat(state.works),
        added.length + ' work' + (added.length > 1 ? 's' : '') + ' added — click one to name it');
    });
  }

  /* ---------- render ---------- */

  function render() {
    renderFilters();
    renderWorks();
    renderHero();
    renderStudio();
    renderLightbox();
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
      state.lbId = null;
      save(state.works.filter(function (w) { return w.id !== id; }), 'Work removed');
    });

    // studio access
    $('studio-toggle').addEventListener('click', function () {
      if (state.studio) {
        state.studio = false;
        state.status = '';
        render();
      } else {
        openGate();
      }
    });

    $('pass-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var val = $('pass-input').value.trim().toLowerCase();
      if (val === String(PASSCODE).toLowerCase()) {
        lsSet(AUTH, '1');
        state.studio = true;
        state.status = 'Signed in';
        closeGate();
        render();
      } else {
        $('pass-error').hidden = false;
      }
    });

    $('pass-cancel').addEventListener('click', closeGate);

    $('bar-signout').addEventListener('click', function () {
      lsDel(AUTH);
      state.studio = false;
      state.lbId = null;
      state.status = '';
      render();
    });

    $('bar-reset').addEventListener('click', function () {
      lsDel(STORE);
      state.works = buildWorks();
      state.status = 'Reset to the original set';
      render();
    });

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
    save(arr, 'Order saved');
  }

  function openGate() {
    $('pass-error').hidden = true;
    $('pass-input').value = '';
    $('passgate').hidden = false;
    $('pass-input').focus();
  }

  function closeGate() {
    $('passgate').hidden = true;
    $('pass-error').hidden = true;
    $('pass-input').value = '';
  }

  /* ---------- contact form ---------- */

  function onSubmit(e) {
    e.preventDefault();
    var form = e.currentTarget;
    var status = $('form-status');
    var btn = $('send-btn');

    var name = form.elements.name.value.trim();
    var email = form.elements.email.value.trim();
    var message = form.elements.message.value.trim();

    if (!name || !email || !message) {
      status.textContent = 'Name, email and a message, please.';
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      status.textContent = 'That email does not look right.';
      return;
    }

    if (FORM_ENDPOINT) {
      btn.disabled = true;
      status.textContent = 'Sending…';
      fetch(FORM_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name, email: email, message: message })
      }).then(function (res) {
        if (!res.ok) throw new Error('bad status');
        btn.textContent = 'Sent — thank you';
        status.textContent = 'Received. A reply comes when the paint allows.';
        form.reset();
      }).catch(function () {
        status.textContent = 'That did not send. Email ' + CONTACT_EMAIL + ' directly.';
      }).then(function () {
        btn.disabled = false;
      });
      return;
    }

    // No endpoint configured: hand the message to the visitor's mail client.
    var subject = 'Studio enquiry — ' + name;
    var body = message + '\n\n— ' + name + '\n' + email;
    window.location.href = 'mailto:' + CONTACT_EMAIL +
      '?subject=' + encodeURIComponent(subject) +
      '&body=' + encodeURIComponent(body);

    btn.textContent = 'Sent — thank you';
    status.textContent = 'Your mail client should be opening. If nothing happens, write to ' + CONTACT_EMAIL + '.';
  }

  /* ---------- boot ---------- */

  function init() {
    var raw = lsGet(STORE);
    if (raw) {
      try {
        var stored = JSON.parse(raw);
        if (stored && stored.length) state.works = stored;
      } catch (err) {}
    }
    state.studio = lsGet(AUTH) === '1';

    $('year').textContent = String(new Date().getFullYear());

    renderFilms();
    render();
    wire();
    startSlides();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
