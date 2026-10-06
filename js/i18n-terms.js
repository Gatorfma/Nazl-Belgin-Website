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
      'Monsters': { tr: 'Canavarlar', ar: 'وحوش', fr: 'Monstres' },
      'Evolution': { tr: 'Evrim', ar: 'تطور', fr: 'Évolution' },
      'Stone Hills': { tr: 'Taş Tepeler', ar: 'تلال حجرية', fr: 'Collines de pierre' }
    },
    medium: {
      'Acrylic on canvas': { tr: 'Tuval üzerine akrilik', ar: 'أكريليك على قماش', fr: 'Acrylique sur toile' },

      // Data-entry typos present in two rows. Mapped so the translated pages
      // show no stray English; delete once the database rows are corrected.
      'Acrylic  on canvas': { tr: 'Tuval üzerine akrilik', ar: 'أكريليك على قماش', fr: 'Acrylique sur toile' },
      "Acryl'c on canvas": { tr: 'Tuval üzerine akrilik', ar: 'أكريليك على قماش', fr: 'Acrylique sur toile' },

      // Values in the checked-in CATALOGUE fallback, shown before Supabase
      // answers and during an outage.
      'Oil on canvas': { tr: 'Tuval üzerine yağlıboya', ar: 'زيت على قماش', fr: 'Huile sur toile' },
      'Oil and oil stick on canvas': {
        tr: 'Tuval üzerine yağlıboya ve yağlı pastel',
        ar: 'زيت وقلم زيتي على قماش',
        fr: 'Huile et bâton à l\'huile sur toile'
      }
    },

    // Strings built in JS rather than marked in the HTML, so they cannot
    // carry a data-i18n attribute. Same mechanism, one place to look.
    ui: {
      'Untitled': { tr: 'İsimsiz', ar: 'بدون عنوان', fr: 'Sans titre' },
      'All': { tr: 'Tümü', ar: 'الكل', fr: 'Toutes' },
      'Click anywhere to close': {
        tr: 'Kapatmak için herhangi bir yere tıklayın',
        ar: 'انقر في أي مكان للإغلاق',
        fr: 'Cliquez n\'importe où pour fermer'
      },

      // Contact form. This is the site's only conversion point, so a visitor
      // who mistypes an address must not be answered in a language they did
      // not choose.
      'Sending…': { tr: 'Gönderiliyor…', ar: 'جارٍ الإرسال…', fr: 'Envoi en cours…' },
      'Send': { tr: 'Gönder', ar: 'إرسال', fr: 'Envoyer' },
      'Sent — thank you': { tr: 'Gönderildi — teşekkürler', ar: 'تم الإرسال — شكرًا لك', fr: 'Envoyé — merci' },
      'Name, email and a message, please.': {
        tr: 'Ad, e-posta ve bir mesaj gerekiyor.',
        ar: 'الاسم والبريد الإلكتروني والرسالة مطلوبة.',
        fr: 'Un nom, un e-mail et un message, s\'il vous plaît.'
      },
      'That email does not look right.': {
        tr: 'Bu e-posta adresi doğru görünmüyor.',
        ar: 'يبدو أن البريد الإلكتروني غير صحيح.',
        fr: 'Cette adresse e-mail semble incorrecte.'
      },
      'Please shorten the name or message before sending.': {
        tr: 'Göndermeden önce adı veya mesajı kısaltın.',
        ar: 'يُرجى اختصار الاسم أو الرسالة قبل الإرسال.',
        fr: 'Veuillez raccourcir le nom ou le message avant l\'envoi.'
      },
      'Received. A reply comes when the paint allows.': {
        tr: 'Alındı. Boya izin verdiğinde yanıt gelecek.',
        ar: 'تم الاستلام. سيأتي الرد حين يسمح الطلاء.',
        fr: 'Bien reçu. La réponse viendra quand la peinture le permettra.'
      },
      'Too many notes were sent recently. Please wait ten minutes and try again.': {
        tr: 'Kısa sürede çok fazla mesaj gönderildi. On dakika bekleyip tekrar deneyin.',
        ar: 'أُرسلت رسائل كثيرة مؤخرًا. يُرجى الانتظار عشر دقائق والمحاولة مرة أخرى.',
        fr: 'Trop de messages ont été envoyés récemment. Veuillez patienter dix minutes et réessayer.'
      },
      'That did not send. Please try again or use the email link beside the form.': {
        tr: 'Gönderilemedi. Tekrar deneyin ya da formun yanındaki e-posta bağlantısını kullanın.',
        ar: 'لم يتم الإرسال. حاول مرة أخرى أو استخدم رابط البريد الإلكتروني بجانب النموذج.',
        fr: 'L\'envoi a échoué. Réessayez ou utilisez le lien e-mail à côté du formulaire.'
      }
    }
  };

  /*
   * The work counter needs grammar, not a lookup. Turkish takes no plural
   * marker after a numeral ("30 eser"), and Arabic numeral agreement has
   * separate singular, dual and plural cases, so Arabic uses a label form
   * that sidesteps agreement entirely.
   */
  /*
   * Alt text for a work with no title yet. Built per language rather than by
   * joining translated words, because the word order and the connectors
   * differ: English appends "series", Turkish appends "serisi", and Arabic
   * puts "سلسلة" in front after an Arabic comma.
   */
  function untitledAlt(series, lang) {
    var name = series ? translateTerm('series', series, lang) : '';
    if (lang === 'tr') {
      return 'İsimsiz resim' + (name ? ', ' + name + ' serisi' : '');
    }
    if (lang === 'ar') {
      return 'لوحة بدون عنوان' + (name ? '، سلسلة ' + name : '');
    }
    if (lang === 'fr') {
      return 'Peinture sans titre' + (name ? ', série ' + name : '');
    }
    return 'Untitled painting' + (name ? ', ' + name + ' series' : '');
  }

  function countLabel(n, lang) {
    var count = Number(n) || 0;
    if (lang === 'tr') return count + ' eser';
    if (lang === 'ar') return 'الأعمال: ' + count;
    // French pluralises from two: zero takes the singular, unlike English.
    if (lang === 'fr') return count + (count < 2 ? ' œuvre' : ' œuvres');
    return count + (count === 1 ? ' work' : ' works');
  }

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
    countLabel: countLabel,
    untitledAlt: untitledAlt,
    currentLang: currentLang,
    TERMS: TERMS
  };
});
