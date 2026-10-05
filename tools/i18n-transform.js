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

  return {
    collectKeys: collectKeys,
    parseAttrSpec: parseAttrSpec
  };
});
