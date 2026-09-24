'use strict';

var assert = require('node:assert/strict');
var test = require('node:test');
var contact = require('../js/contact.js');

var valid = { name: ' Furkan ', email: 'furkan@example.com', message: ' Hello ', website: '' };

test('validates required fields, email shape and length limits locally', function () {
  assert.equal(contact.validate({ name: '', email: '', message: '' }).message, 'Name, email and a message, please.');
  assert.equal(contact.validate({ name: 'A', email: 'bad', message: 'Hi' }).message, 'That email does not look right.');
  assert.equal(contact.validate({ name: 'x'.repeat(101), email: 'a@b.co', message: 'Hi' }).message,
    'Please shorten the name or message before sending.');
  assert.equal(contact.validate({ name: 'A', email: 'a@b.co', message: 'x'.repeat(5001) }).ok, false);
  assert.deepEqual(contact.validate(valid).value, {
    name: 'Furkan', email: 'furkan@example.com', message: 'Hello', website: ''
  });
});

test('invalid local input never calls the sender', async function () {
  var calls = 0;
  var result = await contact.submit(function () { calls += 1; }, { name: '', email: 'bad', message: '' });
  assert.equal(result.ok, false);
  assert.equal(calls, 0);
});

test('passes the honeypot through to the server and reports success', async function () {
  var received;
  var result = await contact.submit(async function (fields) {
    received = fields;
    return { ok: true };
  }, { ...valid, website: 'bot value' });
  assert.equal(result.ok, true);
  assert.equal(received.website, 'bot value');
  assert.equal(result.message, 'Received. A reply comes when the paint allows.');
});

test('maps rate limiting separately from a generic send failure', async function () {
  var rateError = new Error('rate limited');
  rateError.status = 429;
  var rate = await contact.submit(async function () { throw rateError; }, valid);
  assert.equal(rate.ok, false);
  assert.match(rate.message, /wait ten minutes/i);

  var generic = await contact.submit(async function () { throw new Error('offline'); }, valid);
  assert.equal(generic.ok, false);
  assert.match(generic.message, /did not send/i);
});

test('maps a missing sender function to inline failure instead of throwing', async function () {
  var result = await contact.submit(undefined, valid);
  assert.equal(result.ok, false);
  assert.match(result.message, /did not send/i);
});
