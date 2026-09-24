(function (root, factory) {
  'use strict';

  var api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
    return;
  }
  root.NBContentApi = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  var BUCKET = 'site-media';

  function validConfig(config, library) {
    if (!config || !config.url || !config.publishableKey || !library || typeof library.createClient !== 'function') return false;
    try {
      var url = new URL(config.url);
      return url.protocol === 'https:' && /\.supabase\.co$/i.test(url.hostname);
    } catch (error) {
      return false;
    }
  }

  function asError(error) {
    var converted = error instanceof Error
      ? error
      : new Error(error && error.message ? error.message : 'Supabase request failed.');
    if (error && error.context && error.context.status) converted.status = error.context.status;
    return converted;
  }

  function unconfigured() {
    function reject() { return Promise.reject(new Error('Supabase is not configured.')); }
    return {
      configured: false,
      loadAll: reject,
      sendContact: reject,
      publicUrl: function () { return ''; },
      isStudioUser: function () { return Promise.resolve(false); },
      auth: {
        getSession: reject,
        onAuthStateChange: function () { return { data: { subscription: { unsubscribe: function () {} } } }; },
        signIn: reject,
        signOut: reject,
        sendRecovery: reject,
        reauthenticate: reject,
        updatePassword: reject
      }
    };
  }

  function create(config, library) {
    if (!validConfig(config, library)) return unconfigured();

    var client = library.createClient(config.url, config.publishableKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });

    function unwrap(request) {
      return Promise.resolve(request).then(function (result) {
        if (result && result.error) throw asError(result.error);
        return result ? result.data : null;
      });
    }

    function section(request) {
      return Promise.resolve(request).then(function (result) {
        if (result && result.error) return { rows: null, error: asError(result.error) };
        return { rows: result && result.data ? result.data : [], error: null };
      }).catch(function (error) {
        return { rows: null, error: asError(error) };
      });
    }

    function ordered(table) {
      return client.from(table).select('*').order('sort_order', { ascending: true }).order('id', { ascending: true });
    }

    function insert(table, row) {
      return unwrap(client.from(table).insert(row).select('*').single());
    }

    function update(table, id, fields) {
      return unwrap(client.from(table).update(fields).eq('id', id).select('*').single());
    }

    function removeRow(table, id) {
      return unwrap(client.from(table).delete().eq('id', id));
    }

    var auth = {
      getSession: function () { return unwrap(client.auth.getSession()); },
      onAuthStateChange: function (callback) { return client.auth.onAuthStateChange(callback); },
      signIn: function (email, password) {
        return unwrap(client.auth.signInWithPassword({ email: email, password: password }));
      },
      signOut: function () { return unwrap(client.auth.signOut()); },
      sendRecovery: function (email, redirectTo) {
        return unwrap(client.auth.resetPasswordForEmail(email, { redirectTo: redirectTo }));
      },
      reauthenticate: function () { return unwrap(client.auth.reauthenticate()); },
      updatePassword: function (password, nonce) {
        return unwrap(client.auth.updateUser({ password: password, nonce: nonce }));
      }
    };

    return {
      configured: true,
      client: client,
      auth: auth,
      loadAll: function () {
        return Promise.all([
          section(ordered('artworks')),
          section(ordered('media_items')),
          section(ordered('cv_entries'))
        ]).then(function (parts) {
          return { artworks: parts[0], media: parts[1], cv: parts[2] };
        });
      },
      publicUrl: function (path) {
        if (!path) return '';
        var result = client.storage.from(BUCKET).getPublicUrl(path);
        return result && result.data ? result.data.publicUrl : '';
      },
      sendContact: function (payload) {
        return unwrap(client.functions.invoke('send-contact', { body: payload }));
      },
      isStudioUser: function (userId) {
        if (!userId) return Promise.resolve(false);
        return unwrap(client.from('studio_users').select('user_id').eq('user_id', userId).limit(1))
          .then(function (rows) { return Array.isArray(rows) && rows.length === 1 && rows[0].user_id === userId; });
      },
      insertArtwork: function (row) { return insert('artworks', row); },
      updateArtwork: function (id, fields) { return update('artworks', id, fields); },
      deleteArtwork: function (id) { return removeRow('artworks', id); },
      insertMedia: function (row) { return insert('media_items', row); },
      updateMedia: function (id, fields) { return update('media_items', id, fields); },
      deleteMedia: function (id) { return removeRow('media_items', id); },
      insertCv: function (row) { return insert('cv_entries', row); },
      updateCv: function (id, fields) { return update('cv_entries', id, fields); },
      deleteCv: function (id) { return removeRow('cv_entries', id); },
      reorderArtworks: function (ids) { return unwrap(client.rpc('reorder_artworks', { ordered_ids: ids })); },
      reorderMedia: function (kind, groupName, ids) {
        return unwrap(client.rpc('reorder_media', { target_kind: kind, target_group: groupName || null, ordered_ids: ids }));
      },
      reorderCv: function (category, ids) {
        return unwrap(client.rpc('reorder_cv', { target_category: category, ordered_ids: ids }));
      },
      upload: function (path, blob) {
        return unwrap(client.storage.from(BUCKET).upload(path, blob, { upsert: false, contentType: blob.type }));
      },
      remove: function (paths) {
        if (!paths || !paths.length) return Promise.resolve([]);
        return unwrap(client.storage.from(BUCKET).remove(paths)).then(function (removed) {
          if (!Array.isArray(removed) || removed.length !== paths.length) {
            throw new Error('One or more storage objects could not be removed.');
          }
          return removed;
        });
      }
    };
  }

  return { create: create };
});
