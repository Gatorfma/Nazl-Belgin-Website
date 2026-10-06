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

  // Total marker occurrences, not distinct keys: a key used by two elements
  // counts twice, so one unreachable occurrence still shows as a shortfall.
  function countMarkers(html) {
    var total = 0;
    var match;

    TEXT_MARKER.lastIndex = 0;
    while ((match = TEXT_MARKER.exec(html)) !== null) total++;

    ATTR_MARKER.lastIndex = 0;
    while ((match = ATTR_MARKER.exec(html)) !== null) {
      total += parseAttrSpec(match[1]).length;
    }

    return total;
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

  // Returns the rewritten HTML together with the keys that were actually
  // substituted. The build compares that list against the markers it found:
  // a marker the regexes cannot reach (void element, nested same tag, an
  // attribute containing '>') would otherwise be skipped in silence.
  function substitute(html, dict) {
    var replaced = Object.create(null);
    var count = 0;

    var out = html.replace(
      /(<([a-zA-Z0-9-]+)\b[^>]*\sdata-i18n="([^"]+)"[^>]*>)([\s\S]*?)(<\/\2>)/g,
      function (whole, open, tag, key, body, close) {
        if (!Object.prototype.hasOwnProperty.call(dict, key)) return whole;
        replaced[key] = true;
        count++;
        // Escape first, then turn newlines into breaks: a translation never
        // contains raw HTML, but multi-line copy still renders as lines.
        return open + escapeText(dict[key]).replace(/\r?\n/g, '<br>') + close;
      }
    );

    out = out.replace(
      /<([a-zA-Z0-9-]+)\b([^>]*\sdata-i18n-attr="([^"]+)"[^>]*)>/g,
      function (whole, tag, attrs, spec) {
        var rewritten = attrs;
        parseAttrSpec(spec).forEach(function (entry) {
          if (!Object.prototype.hasOwnProperty.call(dict, entry.key)) return;
          var pattern = new RegExp('(\\s' + entry.attribute + '=")[^"]*(")');
          if (!pattern.test(rewritten)) return;
          replaced[entry.key] = true;
          count++;
          rewritten = rewritten.replace(
            pattern,
            '$1' + escapeAttr(dict[entry.key]).replace(/\$/g, '$$$$') + '$2'
          );
        });
        return '<' + tag + rewritten + '>';
      }
    );

    return { html: out, replaced: Object.keys(replaced).sort(), count: count };
  }

  function applyTranslations(html, dict) {
    return substitute(html, dict).html;
  }

  var SITE = 'https://nazlibelgin.com/';
  var LANGS = ['en', 'tr', 'ar', 'fr'];
  var LOCALES = { en: 'en_US', tr: 'tr_TR', ar: 'ar_AR', fr: 'fr_FR' };

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

    // index.html carries its own hreflang links so the English page joins the
    // cluster. Strip them before inserting, or the generated pages would
    // advertise every language twice.
    out = out.replace(/\n?[ \t]*<link rel="alternate" hreflang="[^"]*"[^>]*>/g, '');

    out = out.replace(
      /(<link rel="canonical"[^>]*>)/,
      '$1\n' + hreflangBlock()
    );

    // Move aria-current onto this page's own language link.
    out = out.replace(/(\sdata-lang-base="[^"]*") aria-current="true"/g, '$1');
    return out.replace(
      new RegExp('(hreflang="' + lang + '" lang="' + lang +
                 '" data-lang-link data-lang-base="[^"]*")'),
      '$1 aria-current="true"'
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
        // JSON.stringify does not escape '/', so a description containing
        // </script> would terminate the block early and run what follows.
        var json = JSON.stringify(data, null, 2).replace(/</g, '\\u003c');
        return open + '\n' + json + '\n' + close;
      }
    );
  }

  // `foo._source` holds the English original beside a translation so the
  // artist can review an adaptation. It is documentation, not a marker.
  function isSourceKey(key) {
    return /\._source$/.test(key);
  }

  // Keys the build reads directly rather than through a data-i18n marker.
  // Without this the orphan check would flag them on every run.
  var BUILD_CONSUMED = { 'meta.jsonLdDescription': true };

  function validateKeys(html, dict) {
    var found = collectKeys(html);
    var used = found.text.concat(found.attr).filter(function (key, index, list) {
      return list.indexOf(key) === index;
    }).sort();

    // An empty translation would blank the element and still pass a
    // hasOwnProperty check, so it counts as missing rather than as a value.
    var missing = used.filter(function (key) {
      if (!Object.prototype.hasOwnProperty.call(dict, key)) return true;
      return String(dict[key]).trim() === '';
    });

    var orphaned = Object.keys(dict).filter(function (key) {
      return !isSourceKey(key) && !BUILD_CONSUMED[key] && used.indexOf(key) === -1;
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
    countMarkers: countMarkers,
    parseAttrSpec: parseAttrSpec,
    applyTranslations: applyTranslations,
    substitute: substitute,
    escapeText: escapeText,
    absolutizeAssets: absolutizeAssets,
    validateKeys: validateKeys,
    rewriteHead: rewriteHead,
    urlFor: urlFor,
    localizeJsonLd: localizeJsonLd,
    LANGS: LANGS
  };
});
