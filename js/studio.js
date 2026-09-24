(function (root, factory) {
  'use strict';

  var model = typeof module === 'object' && module.exports
    ? require('./content-model.js')
    : root.NBContentModel;
  var api = factory(model);
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
    return;
  }
  root.NBStudio = api;
})(typeof window !== 'undefined' ? window : globalThis, function (model) {
  'use strict';

  function result(ok, message) {
    return { ok: ok, message: message };
  }

  function messageFor(error, fallback) {
    if (!error) return fallback;
    return error.message || fallback;
  }

  function nextSortOrder(rows) {
    return (rows || []).reduce(function (next, row, index) {
      var order = Number(row && (row.sort_order == null ? row.sortOrder : row.sort_order));
      return Number.isFinite(order) ? Math.max(next, order + 1) : Math.max(next, index + 1);
    }, 0);
  }

  function createArtworkTransaction(api, previousWorks, prepared) {
    var path = model.storagePath('artwork', prepared.id, prepared.blob.type || prepared.file.type);
    var row = {
      id: prepared.id,
      slug: 'work-' + prepared.id,
      title: prepared.title || null,
      year: prepared.year || null,
      series: prepared.series,
      medium: prepared.medium || null,
      dimensions: prepared.dimensions || null,
      storage_path: path,
      legacy_path: null,
      aspect_width: prepared.width,
      aspect_height: prepared.height,
      sort_order: prepared.sortOrder == null ? nextSortOrder(previousWorks) : prepared.sortOrder,
      published: true
    };
    return Promise.resolve(api.upload(path, prepared.blob)).then(function () {
      return api.insertArtwork(row);
    }).then(function (inserted) {
      return { ok: true, works: previousWorks.concat([inserted]), row: inserted };
    }).catch(function (error) {
      return Promise.resolve(api.remove([path])).catch(function (cleanupError) {
        error.cleanupError = cleanupError;
      }).then(function () {
        return { ok: false, works: previousWorks, error: error };
      });
    });
  }

  function persistOrder(api, previousWorks, orderedIds) {
    return Promise.resolve(api.reorderArtworks(orderedIds)).then(function () {
      var byId = {};
      previousWorks.forEach(function (work) { byId[work.id] = work; });
      return { ok: true, works: orderedIds.map(function (id) { return byId[id]; }) };
    }).catch(function (error) {
      return { ok: false, works: previousWorks, error: error };
    });
  }

  function replaceArtworkImageTransaction(api, previousWorks, row, prepared) {
    var path = prepared.storagePath;
    return Promise.resolve(api.upload(path, prepared.blob)).then(function () {
      return api.updateArtwork(row.id, {
        storage_path: path,
        legacy_path: null,
        aspect_width: prepared.width,
        aspect_height: prepared.height
      });
    }).then(function (updated) {
      if (!row.storage_path || row.storage_path === path) {
        return { ok: true, works: previousWorks, row: updated };
      }
      return Promise.resolve(api.remove([row.storage_path])).then(function () {
        return { ok: true, works: previousWorks, row: updated };
      }).catch(function (cleanupError) {
        return { ok: true, works: previousWorks, row: updated, cleanupError: cleanupError };
      });
    }).catch(function (error) {
      return Promise.resolve(api.remove([path])).catch(function (cleanupError) {
        error.cleanupError = cleanupError;
      }).then(function () {
        return { ok: false, works: previousWorks, error: error };
      });
    });
  }

  function createMediaFileTransaction(api, previousRows, prepared) {
    var row = Object.assign({}, prepared.fields, {
      id: prepared.id,
      storage_path: prepared.storagePath,
      legacy_path: null,
      mime_type: prepared.blob.type,
      aspect_width: prepared.width || null,
      aspect_height: prepared.height || null
    });
    return Promise.resolve(api.upload(prepared.storagePath, prepared.blob)).then(function () {
      return api.insertMedia(row);
    }).then(function (inserted) {
      return { ok: true, rows: previousRows.concat([inserted]), row: inserted };
    }).catch(function (error) {
      return Promise.resolve(api.remove([prepared.storagePath])).catch(function (cleanupError) {
        error.cleanupError = cleanupError;
      }).then(function () {
        return { ok: false, rows: previousRows, error: error };
      });
    });
  }

  function replaceMediaFileTransaction(api, previousRows, row, prepared) {
    var fields = Object.assign({}, prepared.fields || {}, {
      storage_path: prepared.storagePath,
      legacy_path: null,
      mime_type: prepared.blob.type,
      aspect_width: prepared.width || null,
      aspect_height: prepared.height || null
    });
    return Promise.resolve(api.upload(prepared.storagePath, prepared.blob)).then(function () {
      return api.updateMedia(row.id, fields);
    }).then(function (updated) {
      if (!row.storage_path || row.storage_path === prepared.storagePath) {
        return { ok: true, rows: previousRows, row: updated };
      }
      return Promise.resolve(api.remove([row.storage_path])).then(function () {
        return { ok: true, rows: previousRows, row: updated };
      }).catch(function (cleanupError) {
        return { ok: true, rows: previousRows, row: updated, cleanupError: cleanupError };
      });
    }).catch(function (error) {
      return Promise.resolve(api.remove([prepared.storagePath])).catch(function (cleanupError) {
        error.cleanupError = cleanupError;
      }).then(function () {
        return { ok: false, rows: previousRows, error: error };
      });
    });
  }

  function saveYouTube(api, row, value, fields) {
    var normalized = model.normalizeYoutubeUrl(value);
    if (!normalized) return Promise.resolve({ ok: false, error: new Error('Enter a valid YouTube URL.') });
    return Promise.resolve(api.updateMedia(row.id, Object.assign({}, fields || {}, {
      external_url: normalized,
      storage_path: null,
      legacy_path: null,
      mime_type: null
    }))).then(function (updated) {
      return { ok: true, row: updated };
    }).catch(function (error) {
      return { ok: false, error: error };
    });
  }

  function confirmedOrder(request, previousRows, orderedIds) {
    return Promise.resolve(request()).then(function () {
      var byId = {};
      previousRows.forEach(function (row) { byId[row.id] = row; });
      return { ok: true, rows: orderedIds.map(function (id) { return byId[id]; }) };
    }).catch(function (error) {
      return { ok: false, rows: previousRows, error: error };
    });
  }

  function persistMediaOrder(api, previousRows, kind, groupName, orderedIds) {
    return confirmedOrder(function () {
      return api.reorderMedia(kind, groupName || null, orderedIds);
    }, previousRows, orderedIds);
  }

  function persistCvOrder(api, previousRows, category, orderedIds) {
    return confirmedOrder(function () {
      return api.reorderCv(category, orderedIds);
    }, previousRows, orderedIds);
  }

  function deleteFileBackedRecord(deleteRow, removeObject) {
    return Promise.resolve().then(deleteRow).then(function (deleted) {
      return Promise.resolve().then(removeObject).then(function () {
        return { ok: true, row: deleted };
      }).catch(function (cleanupError) {
        return { ok: true, row: deleted, cleanupError: cleanupError };
      });
    }).catch(function (error) {
      return { ok: false, error: error };
    });
  }

  function create(options) {
    options = options || {};
    var auth = options.auth;
    var isStudioUser = options.isStudioUser || function () { return Promise.resolve(false); };
    var onStudioChange = options.onStudioChange || function () {};
    var onRecovery = options.onRecovery || function () {};
    var onLoginRequest = options.onLoginRequest || function () {};
    var studioOn = false;
    var subscription = null;
    var authGeneration = 0;

    function setStudio(on) {
      studioOn = Boolean(on);
      onStudioChange(studioOn);
    }

    function authorize(session, generation) {
      var user = session && session.user;
      if (!user || !user.id) {
        if (generation === authGeneration) setStudio(false);
        return Promise.resolve(result(false, ''));
      }
      return Promise.resolve(isStudioUser(user.id)).then(function (allowed) {
        if (generation !== authGeneration) return result(false, '');
        if (!allowed) {
          authGeneration += 1;
          setStudio(false);
          return Promise.resolve(auth.signOut()).catch(function () {}).then(function () {
            return result(false, 'Studio access is not enabled for this account.');
          });
        }
        setStudio(true);
        return result(true, 'Signed in.');
      }).catch(function () {
        if (generation !== authGeneration) return result(false, '');
        authGeneration += 1;
        setStudio(false);
        return Promise.resolve(auth.signOut()).catch(function () {}).then(function () {
          return result(false, 'Studio access could not be verified.');
        });
      });
    }

    function observeAuth() {
      if (!auth || typeof auth.onAuthStateChange !== 'function' || subscription) return;
      var observed = auth.onAuthStateChange(function (event, session) {
        var generation = ++authGeneration;
        if (event === 'PASSWORD_RECOVERY') {
          onRecovery();
          return;
        }
        if (event === 'SIGNED_OUT') {
          setStudio(false);
          return;
        }
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          setTimeout(function () { authorize(session, generation); }, 0);
        }
      });
      subscription = observed && observed.data ? observed.data.subscription : null;
    }

    return {
      init: function () {
        if (!auth) return Promise.resolve(result(false, 'Supabase is not configured.'));
        observeAuth();
        return Promise.resolve(auth.getSession()).then(function (data) {
          var generation = ++authGeneration;
          return authorize(data && data.session, generation);
        }).catch(function (error) {
          setStudio(false);
          return result(false, messageFor(error, 'Studio session could not be restored.'));
        });
      },
      openLogin: function () { onLoginRequest(); },
      login: function (email, password) {
        if (!auth) return Promise.resolve(result(false, 'Supabase is not configured.'));
        return Promise.resolve(auth.signIn(email, password)).then(function (data) {
          var generation = ++authGeneration;
          return authorize(data && data.session, generation);
        }).catch(function (error) {
          authGeneration += 1;
          setStudio(false);
          return result(false, messageFor(error, 'Email or password was not accepted.'));
        });
      },
      signOut: function () {
        if (!auth) { setStudio(false); return Promise.resolve(result(true, 'Signed out.')); }
        authGeneration += 1;
        setStudio(false);
        return Promise.resolve(auth.signOut()).then(function () {
          return result(true, 'Signed out.');
        }).catch(function (error) {
          return result(false, messageFor(error, 'Could not sign out.'));
        });
      },
      requestRecovery: function (email, redirectTo) {
        if (!email) return Promise.resolve(result(false, 'Enter the account email first.'));
        return Promise.resolve(auth.sendRecovery(email, redirectTo)).then(function () {
          return result(true, 'If that account exists, Supabase has sent a recovery email.');
        }).catch(function (error) {
          return result(false, messageFor(error, 'Recovery email could not be sent.'));
        });
      },
      requestPasswordChange: function () {
        return Promise.resolve(auth.reauthenticate()).then(function () {
          return result(true, 'Check your email for the six-digit code.');
        }).catch(function (error) {
          return result(false, messageFor(error, 'The verification email could not be sent.'));
        });
      },
      submitPasswordChange: function (nonce, password, confirmation) {
        if (password !== confirmation) return Promise.resolve(result(false, 'Passwords do not match.'));
        if (!model.passwordIsStrong(password)) {
          return Promise.resolve(result(false, 'Use at least 12 characters with upper- and lowercase letters, a number and a symbol.'));
        }
        if (!/^\d{6}$/.test(String(nonce || ''))) {
          return Promise.resolve(result(false, 'Enter the six-digit code from the email.'));
        }
        return Promise.resolve(auth.updatePassword(password, String(nonce))).then(function () {
          return result(true, 'Password changed. Supabase will send a security notification.');
        }).catch(function (error) {
          return result(false, messageFor(error, 'Password could not be changed.'));
        });
      },
      isStudio: function () { return studioOn; }
    };
  }

  return {
    create: create,
    createArtworkTransaction: createArtworkTransaction,
    replaceArtworkImageTransaction: replaceArtworkImageTransaction,
    createMediaFileTransaction: createMediaFileTransaction,
    replaceMediaFileTransaction: replaceMediaFileTransaction,
    saveYouTube: saveYouTube,
    nextSortOrder: nextSortOrder,
    persistMediaOrder: persistMediaOrder,
    persistCvOrder: persistCvOrder,
    persistOrder: persistOrder,
    deleteFileBackedRecord: deleteFileBackedRecord
  };
});
