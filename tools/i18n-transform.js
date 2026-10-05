(function (root, factory) {
  'use strict';

  var api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
    return;
  }
  root.NBI18nTransform = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  var TEXT_MARKER = /\sdata-i18n="([^"]+)"/g;
  var ATTR_MARKER = /\sdata-i18n-attr="([^"]+)"/g;

  function parseAttrSpec(spec) {
    return String(spec).split(',').map(function (part) {
      var bits = part.split(':');
      return {
        attribute: String(bits[0] || '').trim(),
        key: String(bits[1] || '').trim()
      };
    }).filter(function (entry) {
      return entry.attribute && entry.key;
    });
  }

  function unique(list) {
    var seen = Object.create(null);
    var out = [];
    list.forEach(function (value) {
      if (seen[value]) return;
      seen[value] = true;
      out.push(value);
    });
    return out.sort();
  }

  function collectKeys(html) {
    var text = [];
    var attr = [];
    var match;

    TEXT_MARKER.lastIndex = 0;
    while ((match = TEXT_MARKER.exec(html)) !== null) text.push(match[1]);

    ATTR_MARKER.lastIndex = 0;
    while ((match = ATTR_MARKER.exec(html)) !== null) {
      parseAttrSpec(match[1]).forEach(function (entry) { attr.push(entry.key); });
    }

    return { text: unique(text), attr: unique(attr) };
  }

  function escapeText(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function escapeAttr(value) {
    return escapeText(value)
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function applyTranslations(html, dict) {
    var out = html.replace(
      /(<([a-zA-Z0-9-]+)\b[^>]*\sdata-i18n="([^"]+)"[^>]*>)([\s\S]*?)(<\/\2>)/g,
      function (whole, open, tag, key, body, close) {
        if (!Object.prototype.hasOwnProperty.call(dict, key)) return whole;
        return open + escapeText(dict[key]) + close;
      }
    );

    out = out.replace(
      /<([a-zA-Z0-9-]+)\b([^>]*\sdata-i18n-attr="([^"]+)"[^>]*)>/g,
      function (whole, tag, attrs, spec) {
        var rewritten = attrs;
        parseAttrSpec(spec).forEach(function (entry) {
          if (!Object.prototype.hasOwnProperty.call(dict, entry.key)) return;
          var pattern = new RegExp('(\\s' + entry.attribute + '=")[^"]*(")');
          rewritten = rewritten.replace(
            pattern,
            '$1' + escapeAttr(dict[entry.key]).replace(/\$/g, '$$$$') + '$2'
          );
        });
        return '<' + tag + rewritten + '>';
      }
    );

    return out;
  }

  var SITE = 'https://nazlibelgin.com/';
  var LANGS = ['en', 'tr', 'ar'];
  var LOCALES = { en: 'en_US', tr: 'tr_TR', ar: 'ar_AR' };

  function urlFor(lang) {
    return lang === 'en' ? SITE : SITE + lang + '/';
  }

  function hreflangBlock() {
    var links = LANGS.map(function (lang) {
      return '<link rel="alternate" hreflang="' + lang + '" href="' + urlFor(lang) + '">';
    });
    links.push('<link rel="alternate" hreflang="x-default" href="' + urlFor('en') + '">');
    return links.join('\n');
  }

  function rewriteHead(html, lang) {
    var openTag = lang === 'ar'
      ? '<html lang="ar" dir="rtl">'
      : '<html lang="' + lang + '">';

    var out = html.replace(/<html[^>]*>/, openTag);

    out = out.replace(
      /(<link rel="canonical" href=")[^"]*(")/,
      '$1' + urlFor(lang) + '$2'
    );
    out = out.replace(
      /(<meta property="og:url" content=")[^"]*(")/,
      '$1' + urlFor(lang) + '$2'
    );
    out = out.replace(
      /(<meta property="og:locale" content=")[^"]*(")/,
      '$1' + LOCALES[lang] + '$2'
    );

    return out.replace(
      /(<link rel="canonical"[^>]*>)/,
      '$1\n' + hreflangBlock()
    );
  }

  // JSON-LD is a JSON document inside a <script> tag, so the element-text path
  // above would destroy it. Parse, change one field, re-serialize.
  function localizeJsonLd(html, dict) {
    if (!Object.prototype.hasOwnProperty.call(dict, 'meta.jsonLdDescription')) {
      return html;
    }
    return html.replace(
      /(<script type="application\/ld\+json">)([\s\S]*?)(<\/script>)/,
      function (whole, open, body, close) {
        var data;
        try {
          data = JSON.parse(body);
        } catch (err) {
          return whole;
        }
        data.description = dict['meta.jsonLdDescription'];
        return open + '\n' + JSON.stringify(data, null, 2) + '\n' + close;
      }
    );
  }

  // `foo._source` holds the English original beside a translation so the
  // artist can review an adaptation. It is documentation, not a marker.
  function isSourceKey(key) {
    return /\._source$/.test(key);
  }

  function validateKeys(html, dict) {
    var found = collectKeys(html);
    var used = found.text.concat(found.attr).filter(function (key, index, list) {
      return list.indexOf(key) === index;
    }).sort();

    var missing = used.filter(function (key) {
      return !Object.prototype.hasOwnProperty.call(dict, key);
    });

    var orphaned = Object.keys(dict).filter(function (key) {
      return !isSourceKey(key) && used.indexOf(key) === -1;
    }).sort();

    return { missing: missing, orphaned: orphaned };
  }

  // The English page uses relative asset paths, which resolve to /tr/css/...
  // from a subdirectory and 404. Root-absolute works from all three locations.
  function absolutizeAssets(html) {
    return html.replace(
      /\s(href|src)="(css\/|js\/|art\/|favicon\.)/g,
      ' $1="/$2'
    );
  }

  return {
    collectKeys: collectKeys,
    parseAttrSpec: parseAttrSpec,
    applyTranslations: applyTranslations,
    escapeText: escapeText,
    absolutizeAssets: absolutizeAssets,
    validateKeys: validateKeys,
    rewriteHead: rewriteHead,
    urlFor: urlFor,
    localizeJsonLd: localizeJsonLd,
    LANGS: LANGS
  };
});
