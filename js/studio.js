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

  function create(options) {
    options = options || {};
    var auth = options.auth;
    var isStudioUser = options.isStudioUser || function () { return Promise.resolve(false); };
    var onStudioChange = options.onStudioChange || function () {};
    var onRecovery = options.onRecovery || function () {};
    var onLoginRequest = options.onLoginRequest || function () {};
    var studioOn = false;
    var subscription = null;

    function setStudio(on) {
      studioOn = Boolean(on);
      onStudioChange(studioOn);
    }

    function authorize(session) {
      var user = session && session.user;
      if (!user || !user.id) {
        setStudio(false);
        return Promise.resolve(result(false, ''));
      }
      return Promise.resolve(isStudioUser(user.id)).then(function (allowed) {
        if (!allowed) {
          return Promise.resolve(auth.signOut()).catch(function () {}).then(function () {
            setStudio(false);
            return result(false, 'Studio access is not enabled for this account.');
          });
        }
        setStudio(true);
        return result(true, 'Signed in.');
      }).catch(function () {
        return Promise.resolve(auth.signOut()).catch(function () {}).then(function () {
          setStudio(false);
          return result(false, 'Studio access could not be verified.');
        });
      });
    }

    function observeAuth() {
      if (!auth || typeof auth.onAuthStateChange !== 'function' || subscription) return;
      var observed = auth.onAuthStateChange(function (event, session) {
        if (event === 'PASSWORD_RECOVERY') {
          onRecovery();
          return Promise.resolve();
        }
        if (event === 'SIGNED_OUT') {
          setStudio(false);
          return Promise.resolve();
        }
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') return authorize(session);
        return Promise.resolve();
      });
      subscription = observed && observed.data ? observed.data.subscription : null;
    }

    return {
      init: function () {
        if (!auth) return Promise.resolve(result(false, 'Supabase is not configured.'));
        observeAuth();
        return Promise.resolve(auth.getSession()).then(function (data) {
          return authorize(data && data.session);
        }).catch(function (error) {
          setStudio(false);
          return result(false, messageFor(error, 'Studio session could not be restored.'));
        });
      },
      openLogin: function () { onLoginRequest(); },
      login: function (email, password) {
        if (!auth) return Promise.resolve(result(false, 'Supabase is not configured.'));
        return Promise.resolve(auth.signIn(email, password)).then(function (data) {
          return authorize(data && data.session);
        }).catch(function (error) {
          setStudio(false);
          return result(false, messageFor(error, 'Email or password was not accepted.'));
        });
      },
      signOut: function () {
        if (!auth) { setStudio(false); return Promise.resolve(result(true, 'Signed out.')); }
        return Promise.resolve(auth.signOut()).then(function () {
          setStudio(false);
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

  return { create: create };
});
