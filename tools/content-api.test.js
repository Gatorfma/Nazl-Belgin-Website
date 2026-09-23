'use strict';

var assert = require('node:assert/strict');
var test = require('node:test');
var apiModule = require('../js/content-api.js');

function queryResult(value) {
  return value instanceof Error ? { data: null, error: value } : { data: value, error: null };
}

function fakeSupabase(tables, options) {
  options = options || {};
  var client = {
    from: function (table) {
      var result = queryResult(tables[table] || []);
      var builder = {
        select: function () { return builder; },
        order: function () { return builder; },
        eq: function (field, value) {
          if (result.data) result = queryResult(result.data.filter(function (row) { return row[field] === value; }));
          return builder;
        },
        limit: function () { return builder; },
        then: function (resolve) { return Promise.resolve(result).then(resolve); }
      };
      return builder;
    },
    storage: {
      from: function () {
        return {
          getPublicUrl: function (path) { return { data: { publicUrl: 'https://cdn.test/' + path } }; }
        };
      }
    },
    auth: options.auth || {},
    rpc: function () { return Promise.resolve({ data: null, error: null }); }
  };
  return { createClient: function () { return client; } };
}

test('loads successful sections while reporting a failed section independently', async function () {
  var api = apiModule.create({ url: 'https://project.supabase.co', publishableKey: 'key' },
    fakeSupabase({ artworks: [{ id: 'a' }], media_items: new Error('offline'), cv_entries: [{ id: 'c' }] }));
  var got = await api.loadAll();
  assert.deepEqual(got.artworks.rows, [{ id: 'a' }]);
  assert.equal(got.media.error.message, 'offline');
  assert.deepEqual(got.cv.rows, [{ id: 'c' }]);
});

test('stays unconfigured when URL or publishable key is empty or URL is untrusted', function () {
  assert.equal(apiModule.create({ url: '', publishableKey: '' }, fakeSupabase({})).configured, false);
  assert.equal(apiModule.create({ url: 'https://example.com', publishableKey: 'key' }, fakeSupabase({})).configured, false);
});

test('resolves public object URLs from the fixed site-media bucket', function () {
  var api = apiModule.create({ url: 'https://project.supabase.co', publishableKey: 'key' }, fakeSupabase({}));
  assert.equal(api.publicUrl('artworks/a.jpg'), 'https://cdn.test/artworks/a.jpg');
});

test('authorizes only an exact visible studio_users row', async function () {
  var api = apiModule.create({ url: 'https://project.supabase.co', publishableKey: 'key' }, fakeSupabase({
    studio_users: [{ user_id: 'artist-id' }]
  }));
  assert.equal(await api.isStudioUser('artist-id'), true);
  assert.equal(await api.isStudioUser('other-id'), false);
  assert.equal(await api.isStudioUser(''), false);
});
