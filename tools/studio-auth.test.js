'use strict';

var assert = require('node:assert/strict');
var test = require('node:test');
var studio = require('../js/studio.js');

function fakeAuth(initialSession) {
  var state = {
    session: initialSession || null,
    signedOut: false,
    recovery: null,
    reauthenticated: false,
    passwordUpdate: null,
    listener: null
  };
  return {
    state: state,
    getSession: async function () { return { session: state.session }; },
    onAuthStateChange: function (listener) {
      state.listener = listener;
      return { data: { subscription: { unsubscribe: function () {} } } };
    },
    signIn: async function () { return { session: state.session, user: state.session && state.session.user }; },
    signOut: async function () { state.signedOut = true; state.session = null; },
    sendRecovery: async function (email, redirectTo) { state.recovery = { email: email, redirectTo: redirectTo }; },
    reauthenticate: async function () { state.reauthenticated = true; },
    updatePassword: async function (password, nonce) { state.passwordUpdate = { password: password, nonce: nonce }; }
  };
}

test('signs out an authenticated account that is not allowlisted', async function () {
  var uiStates = [];
  var auth = fakeAuth({ user: { id: 'outsider' } });
  var controller = studio.create({
    auth: auth,
    isStudioUser: async function () { return false; },
    onStudioChange: function (on) { uiStates.push(on); }
  });
  var result = await controller.login('outsider@example.com', 'Correct9!Password');
  assert.equal(result.ok, false);
  assert.equal(result.message, 'Studio access is not enabled for this account.');
  assert.deepEqual(uiStates, [false]);
  assert.equal(auth.state.signedOut, true);
  assert.equal(controller.isStudio(), false);
});

test('restores only an allowlisted session and observes sign-out', async function () {
  var auth = fakeAuth({ user: { id: 'artist' } });
  var controller = studio.create({
    auth: auth,
    isStudioUser: async function (id) { return id === 'artist'; }
  });
  assert.deepEqual(await controller.init(), { ok: true, message: 'Signed in.' });
  assert.equal(controller.isStudio(), true);
  await auth.state.listener('SIGNED_OUT', null);
  assert.equal(controller.isStudio(), false);
});

test('rejects mismatched and weak passwords before calling Supabase', async function () {
  var auth = fakeAuth({ user: { id: 'artist' } });
  var controller = studio.create({ auth: auth, isStudioUser: async function () { return true; } });
  assert.deepEqual(await controller.submitPasswordChange('123456', 'weak', 'different'),
    { ok: false, message: 'Passwords do not match.' });
  assert.deepEqual(await controller.submitPasswordChange('123456', 'weak', 'weak'),
    { ok: false, message: 'Use at least 12 characters with upper- and lowercase letters, a number and a symbol.' });
  assert.equal(auth.state.passwordUpdate, null);
});

test('reauthenticates by email and submits a verified strong password', async function () {
  var auth = fakeAuth({ user: { id: 'artist' } });
  var controller = studio.create({ auth: auth, isStudioUser: async function () { return true; } });
  assert.deepEqual(await controller.requestPasswordChange(), { ok: true, message: 'Check your email for the six-digit code.' });
  assert.equal(auth.state.reauthenticated, true);
  assert.deepEqual(await controller.submitPasswordChange('123456', 'Long-enough9!', 'Long-enough9!'),
    { ok: true, message: 'Password changed. Supabase will send a security notification.' });
  assert.deepEqual(auth.state.passwordUpdate, { password: 'Long-enough9!', nonce: '123456' });
});

test('sends recovery to the canonical page without revealing account existence', async function () {
  var auth = fakeAuth(null);
  var controller = studio.create({ auth: auth, isStudioUser: async function () { return false; } });
  var got = await controller.requestRecovery('artist@example.com', 'https://nazlibelgin.com/');
  assert.deepEqual(got, { ok: true, message: 'If that account exists, Supabase has sent a recovery email.' });
  assert.deepEqual(auth.state.recovery, { email: 'artist@example.com', redirectTo: 'https://nazlibelgin.com/' });
});
