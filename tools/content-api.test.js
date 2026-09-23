'use strict';

var assert = require('node:assert/strict');
var test = require('node:test');
var apiModule = require('../js/content-api.js');
var studio = require('../js/studio.js');

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

function fakeMutationApi(options) {
  options = options || {};
  return {
    removedPaths: [],
    upload: async function () { return {}; },
    insertArtwork: async function (row) {
      if (options.insertError) throw options.insertError;
      return row;
    },
    updateArtwork: async function (id, patch) {
      if (options.updateError) throw options.updateError;
      return Object.assign({ id: id }, patch);
    },
    reorderArtworks: async function () {
      if (options.reorderError) throw options.reorderError;
    },
    remove: async function (paths) { this.removedPaths = this.removedPaths.concat(paths); }
  };
}

test('removes a new object and preserves confirmed state when artwork insert fails', async function () {
  var api = fakeMutationApi({ insertError: new Error('row rejected') });
  var previous = [{ id: 'existing' }];
  var got = await studio.createArtworkTransaction(api, previous, {
    id: 'new-id', file: { type: 'image/jpeg', size: 100 }, blob: { type: 'image/jpeg' },
    width: 900, height: 1200, title: 'New work', year: 2026, series: 'Monsters',
    medium: 'Oil on canvas', dimensions: '40 × 30 cm'
  });
  assert.equal(got.ok, false);
  assert.deepEqual(got.works, previous);
  assert.deepEqual(api.removedPaths, ['artworks/new-id.jpg']);
});

test('restores confirmed order when reorder RPC rejects duplicate IDs', async function () {
  var previous = [{ id: 'a' }, { id: 'b' }];
  var got = await studio.persistOrder(fakeMutationApi({ reorderError: new Error('duplicate') }), previous, ['a', 'a']);
  assert.equal(got.ok, false);
  assert.deepEqual(got.works, previous);
});

test('replaces an artwork object only after its database row is updated', async function () {
  var api = fakeMutationApi();
  var previous = [{ id: 'a', src: 'old.jpg' }];
  var got = await studio.replaceArtworkImageTransaction(api, previous, {
    id: 'a', storage_path: 'artworks/a.jpg'
  }, {
    blob: { type: 'image/webp' }, width: 1200, height: 800, storagePath: 'artworks/a-2.webp'
  });
  assert.equal(got.ok, true);
  assert.deepEqual(api.removedPaths, ['artworks/a.jpg']);
});

test('removes the replacement object and keeps the old object when row update fails', async function () {
  var api = fakeMutationApi({ updateError: new Error('row rejected') });
  var previous = [{ id: 'a', src: 'old.jpg' }];
  var got = await studio.replaceArtworkImageTransaction(api, previous, {
    id: 'a', storage_path: 'artworks/a.jpg'
  }, {
    blob: { type: 'image/webp' }, width: 1200, height: 800, storagePath: 'artworks/a-2.webp'
  });
  assert.equal(got.ok, false);
  assert.deepEqual(got.works, previous);
  assert.deepEqual(api.removedPaths, ['artworks/a-2.webp']);
});
