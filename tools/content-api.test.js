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
          getPublicUrl: function (path) { return { data: { publicUrl: 'https://cdn.test/' + path } }; },
          remove: function (paths) {
            var value = Object.prototype.hasOwnProperty.call(options, 'removeResult')
              ? options.removeResult
              : paths.map(function (path) { return { name: path }; });
            return Promise.resolve(queryResult(value));
          }
        };
      }
    },
    auth: options.auth || {},
    functions: {
      invoke: options.invoke || function () { return Promise.resolve({ data: null, error: null }); }
    },
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

test('invokes the contact Edge Function with the submitted fields', async function () {
  var calls = [];
  var api = apiModule.create({ url: 'https://project.supabase.co', publishableKey: 'key' }, fakeSupabase({}, {
    invoke: async function (name, options) {
      calls.push({ name: name, body: options.body });
      return { data: { ok: true }, error: null };
    }
  }));
  var fields = { name: 'A', email: 'a@b.co', message: 'Hi', website: '' };
  assert.deepEqual(await api.sendContact(fields), { ok: true });
  assert.deepEqual(calls, [{ name: 'send-contact', body: fields }]);
});

test('preserves the Edge Function HTTP status and rejects when unconfigured', async function () {
  var api = apiModule.create({ url: 'https://project.supabase.co', publishableKey: 'key' }, fakeSupabase({}, {
    invoke: async function () {
      return { data: null, error: { message: 'rate limited', context: { status: 429 } } };
    }
  }));
  await assert.rejects(api.sendContact({}), function (error) { return error.status === 429; });
  var unavailable = apiModule.create({ url: '', publishableKey: '' }, fakeSupabase({}));
  await assert.rejects(unavailable.sendContact({}), /not configured/i);
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

test('rejects storage deletion when Supabase confirms fewer objects than requested', async function () {
  var api = apiModule.create({ url: 'https://project.supabase.co', publishableKey: 'key' },
    fakeSupabase({}, { removeResult: [] }));
  await assert.rejects(api.remove(['artworks/a.jpg']), /could not be removed/i);
});

test('assigns new rows after the greatest confirmed sort order', function () {
  assert.equal(studio.nextSortOrder([{ sort_order: 0 }, { sort_order: 2 }]), 3);
  assert.equal(studio.nextSortOrder([{ id: 'a' }, { id: 'b' }]), 2);
  assert.equal(studio.nextSortOrder([]), 0);
});

function fakeMutationApi(options) {
  options = options || {};
  return {
    removedPaths: [],
    objects: new Set(options.initialObjects || []),
    upload: async function (path) { this.objects.add(path); return {}; },
    insertArtwork: async function (row) {
      if (options.insertError) throw options.insertError;
      return row;
    },
    updateArtwork: async function (id, patch) {
      if (options.updateError) throw options.updateError;
      return Object.assign({ id: id }, patch);
    },
    updateMedia: async function (id, patch) {
      if (options.updateMediaError) throw options.updateMediaError;
      return Object.assign({ id: id }, patch);
    },
    insertMedia: async function (row) {
      if (options.insertMediaError) throw options.insertMediaError;
      return row;
    },
    reorderArtworks: async function () {
      if (options.reorderError) throw options.reorderError;
    },
    reorderMedia: async function () {
      if (options.reorderMediaError) throw options.reorderMediaError;
    },
    reorderCv: async function () {
      if (options.reorderCvError) throw options.reorderCvError;
    },
    remove: async function (paths) {
      var self = this;
      this.removedPaths = this.removedPaths.concat(paths);
      paths.forEach(function (path) { self.objects.delete(path); });
    }
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

test('media replacement keeps the confirmed record when its row update fails', async function () {
  var api = fakeMutationApi({ updateMediaError: new Error('row rejected') });
  var previous = [{ id: 'p1', storage_path: 'media/portrait/p1.jpg' }];
  var got = await studio.replaceMediaFileTransaction(api, previous, previous[0], {
    blob: { type: 'image/webp' }, storagePath: 'media/portrait/p1-2.webp',
    width: 800, height: 1000, fields: { title: 'New portrait' }
  });
  assert.equal(got.ok, false);
  assert.deepEqual(got.rows, previous);
  assert.deepEqual(api.removedPaths, ['media/portrait/p1-2.webp']);
});

test('media replacement returns the confirmed row and removes only the old object', async function () {
  var api = fakeMutationApi({ initialObjects: ['media/portrait/p1.jpg'] });
  var previous = [{ id: 'p1', storage_path: 'media/portrait/p1.jpg' }];
  var got = await studio.replaceMediaFileTransaction(api, previous, previous[0], {
    blob: { type: 'image/webp' }, storagePath: 'media/portrait/p1-2.webp',
    width: 800, height: 1000, fields: { title: 'New portrait' }
  });
  assert.equal(got.ok, true);
  assert.equal(got.row.storage_path, 'media/portrait/p1-2.webp');
  assert.deepEqual(Array.from(api.objects), ['media/portrait/p1-2.webp']);
});

test('media and CV order helpers preserve confirmed rows when an RPC fails', async function () {
  var media = [{ id: 'm1' }, { id: 'm2' }];
  var cv = [{ id: 'c1' }, { id: 'c2' }];
  var mediaResult = await studio.persistMediaOrder(
    fakeMutationApi({ reorderMediaError: new Error('duplicate') }), media, 'spotify_image', 'Artist', ['m2', 'm1']
  );
  var cvResult = await studio.persistCvOrder(
    fakeMutationApi({ reorderCvError: new Error('duplicate') }), cv, 'project', ['c2', 'c1']
  );
  assert.equal(mediaResult.ok, false);
  assert.deepEqual(mediaResult.rows, media);
  assert.equal(cvResult.ok, false);
  assert.deepEqual(cvResult.rows, cv);
});

test('invalid YouTube URLs are rejected before any database update', async function () {
  var calls = 0;
  var got = await studio.saveYouTube({
    updateMedia: async function () { calls += 1; }
  }, { id: 'y1' }, 'https://example.com/not-youtube');
  assert.equal(got.ok, false);
  assert.equal(calls, 0);
});

test('deletes a database row before storage and keeps cleanup failure recoverable', async function () {
  var order = [];
  var rowError = new Error('row rejected');
  var failed = await studio.deleteFileBackedRecord(
    async function () { order.push('row'); throw rowError; },
    async function () { order.push('object'); }
  );
  assert.equal(failed.ok, false);
  assert.equal(failed.error, rowError);
  assert.deepEqual(order, ['row']);

  var cleanupError = new Error('object cleanup failed');
  var retried = await studio.deleteFileBackedRecord(
    async function () { order.push('row retry'); },
    async function () { order.push('object retry'); throw cleanupError; }
  );
  assert.equal(retried.ok, true);
  assert.equal(retried.cleanupError, cleanupError);
  assert.deepEqual(order, ['row', 'row retry', 'object retry']);
});
