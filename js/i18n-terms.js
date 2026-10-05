(function (root, factory) {
  'use strict';

  var api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
    return;
  }
  root.NBI18nTerms = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  /*
   * Closed vocabularies that reach the UI from Supabase. Keying on the stored
   * English value means no schema change and no studio change: the database
   * keeps one canonical value and only the label is translated.
   *
   * The Turkish series names are the artist's own folder names from the
   * original delivery (Canavarlar / Evrim / Taş tepeler), not inventions.
   *
   * Values were read from the live `artworks` table, not from the seed file,
   * which had drifted: the stored medium is acrylic, while the seed and the
   * design canvas both said oil.
   */
  var TERMS = {
    series: {
      'Monsters': { tr: 'Canavarlar', ar: 'وحوش' },
      'Evolution': { tr: 'Evrim', ar: 'تطور' },
      'Stone Hills': { tr: 'Taş Tepeler', ar: 'تلال حجرية' }
    },
    medium: {
      'Acrylic on canvas': { tr: 'Tuval üzerine akrilik', ar: 'أكريليك على قماش' },

      // Data-entry typos present in two rows. Mapped so the translated pages
      // show no stray English; delete once the database rows are corrected.
      'Acrylic  on canvas': { tr: 'Tuval üzerine akrilik', ar: 'أكريليك على قماش' },
      "Acryl'c on canvas": { tr: 'Tuval üzerine akrilik', ar: 'أكريليك على قماش' },

      // Values in the checked-in CATALOGUE fallback, shown before Supabase
      // answers and during an outage.
      'Oil on canvas': { tr: 'Tuval üzerine yağlıboya', ar: 'زيت على قماش' },
      'Oil and oil stick on canvas': {
        tr: 'Tuval üzerine yağlıboya ve yağlı pastel',
        ar: 'زيت وقلم زيتي على قماش'
      }
    },

    // Strings built in JS rather than marked in the HTML, so they cannot
    // carry a data-i18n attribute. Same mechanism, one place to look.
    ui: {
      'Untitled': { tr: 'İsimsiz', ar: 'بدون عنوان' },
      'All': { tr: 'Tümü', ar: 'الكل' }
    }
  };

  // An unmapped value returns unchanged, so a series added through the studio
  // after launch shows its English name rather than blank.
  function translateTerm(kind, value, lang) {
    if (!value) return '';
    var table = TERMS[kind];
    if (!table) return value;
    var entry = table[value];
    if (!entry) return value;
    return entry[lang] || value;
  }

  function currentLang(doc) {
    var target = doc || (typeof document !== 'undefined' ? document : null);
    if (!target) return 'en';
    return target.documentElement.getAttribute('lang') || 'en';
  }

  return {
    translateTerm: translateTerm,
    currentLang: currentLang,
    TERMS: TERMS
  };
});
