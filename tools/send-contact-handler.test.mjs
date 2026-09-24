import assert from 'node:assert/strict';
import test from 'node:test';
import { createContactHandler } from '../supabase/functions/send-contact/handler.mjs';

const validBody = { name: 'Furkan', email: 'furkan@example.com', message: 'Hello', website: '' };
const request = (body = validBody, init = {}) => new Request('https://project.supabase.co/functions/v1/send-contact', {
  method: init.method || 'POST',
  headers: {
    Origin: init.origin || 'http://localhost:8000',
    'Content-Type': init.contentType || 'application/json',
    ...(init.headers || {})
  },
  body: ['GET', 'HEAD', 'OPTIONS'].includes(init.method) ? undefined : (init.rawBody ?? JSON.stringify(body))
});

function dependencies(overrides = {}) {
  const calls = { hash: 0, limit: 0, send: 0, logs: [] };
  const values = {
    RESEND_API_KEY: 'test-key',
    CONTACT_TO_EMAIL: 'owner@example.com',
    CONTACT_FROM_EMAIL: 'Website <website@example.com>',
    CONTACT_IP_SALT: 'test-salt',
    ...(overrides.values || {})
  };
  const deps = {
    env: (name) => values[name] || '',
    clientIp: () => '203.0.113.5',
    hashIp: async (value) => { calls.hash += 1; return `hash:${value}`; },
    consumeRateLimit: async () => { calls.limit += 1; return true; },
    sendEmail: async () => { calls.send += 1; return { id: 'email-id' }; },
    log: (...args) => calls.logs.push(args),
    ...overrides
  };
  delete deps.values;
  return { deps, calls };
}

async function body(response) {
  return response.json();
}

test('answers allowed preflight and rejects disallowed origins', async () => {
  const { deps } = dependencies();
  const handler = createContactHandler(deps);
  const preflight = await handler(request(validBody, { method: 'OPTIONS' }));
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('access-control-allow-origin'), 'http://localhost:8000');
  assert.equal(preflight.headers.get('vary'), 'Origin');
  const denied = await handler(request(validBody, { origin: 'https://evilnazlibelgin.com' }));
  assert.equal(denied.status, 403);
  assert.equal((await body(denied)).code, 'origin');
});

test('rejects method and content type with CORS headers', async () => {
  const handler = createContactHandler(dependencies().deps);
  for (const [input, status] of [
    [request(validBody, { method: 'GET' }), 405],
    [request(validBody, { contentType: 'text/plain' }), 415]
  ]) {
    const response = await handler(input);
    assert.equal(response.status, status);
    assert.equal(response.headers.get('access-control-allow-origin'), 'http://localhost:8000');
  }
});

test('rejects malformed, invalid, spam and oversized bodies before dependencies', async () => {
  const { deps, calls } = dependencies();
  const handler = createContactHandler(deps);
  const cases = [
    [request(null, { rawBody: '{' }), 400],
    [request(null), 400],
    [request([]), 400],
    [request({ ...validBody, website: 'bot' }), 400],
    [request(validBody, { headers: { 'Content-Length': '16385' } }), 413],
    [request(validBody, { rawBody: JSON.stringify({ ...validBody, message: 'x'.repeat(17000) }) }), 413]
  ];
  for (const [input, status] of cases) {
    const response = await handler(input);
    assert.equal(response.status, status);
    assert.equal(response.headers.get('access-control-allow-origin'), 'http://localhost:8000');
  }
  assert.deepEqual({ hash: calls.hash, limit: calls.limit, send: calls.send }, { hash: 0, limit: 0, send: 0 });
});

test('stops reading an unknown-length stream immediately after 16 KiB', async () => {
  let streamController;
  const stream = new ReadableStream({
    start(controller) {
      streamController = controller;
      controller.enqueue(new Uint8Array(16385));
    }
  });
  const input = new Request('https://project.supabase.co/functions/v1/send-contact', {
    method: 'POST',
    headers: { Origin: 'http://localhost:8000', 'Content-Type': 'application/json' },
    body: stream,
    duplex: 'half'
  });
  const pending = createContactHandler(dependencies().deps)(input);
  const early = await Promise.race([
    pending,
    new Promise((resolve) => setTimeout(() => resolve('still-reading'), 50))
  ]);
  if (early === 'still-reading') streamController.close();
  assert.notEqual(early, 'still-reading');
  assert.equal(early.status, 413);
  assert.equal(early.headers.get('access-control-allow-origin'), 'http://localhost:8000');
});

test('maps body stream read errors to a CORS-bearing 400', async () => {
  const stream = new ReadableStream({
    start(controller) { controller.error(new Error('stream failed')); }
  });
  const input = new Request('https://project.supabase.co/functions/v1/send-contact', {
    method: 'POST',
    headers: { Origin: 'http://localhost:8000', 'Content-Type': 'application/json' },
    body: stream,
    duplex: 'half'
  });
  const response = await createContactHandler(dependencies().deps)(input);
  assert.equal(response.status, 400);
  assert.equal((await body(response)).code, 'invalid_body');
  assert.equal(response.headers.get('access-control-allow-origin'), 'http://localhost:8000');
});

test('returns unavailable for missing configuration without logging secret values', async () => {
  const { deps, calls } = dependencies({ values: { RESEND_API_KEY: '' } });
  const response = await createContactHandler(deps)(request());
  assert.equal(response.status, 503);
  assert.equal((await body(response)).code, 'unavailable');
  assert.equal(calls.logs.length, 0);
});

test('returns 429 without sending when the rate limit denies', async () => {
  const { deps, calls } = dependencies({ consumeRateLimit: async () => { calls.limit += 1; return false; } });
  const response = await createContactHandler(deps)(request());
  assert.equal(response.status, 429);
  assert.equal((await body(response)).code, 'rate_limited');
  assert.equal(calls.send, 0);
});

test('maps provider failures and missing ids to generic 502 responses', async () => {
  for (const sendEmail of [
    async () => { throw new Error('network failure'); },
    async () => { throw new Error('provider status 422'); },
    async () => ({})
  ]) {
    const { deps, calls } = dependencies({ sendEmail });
    const response = await createContactHandler(deps)(request());
    const value = await body(response);
    assert.equal(response.status, 502);
    assert.equal(value.code, 'delivery_failed');
    assert.equal(typeof value.requestId, 'string');
    assert.equal(calls.logs.length, 1);
    assert.doesNotMatch(JSON.stringify(calls.logs), /network failure|provider status 422/);
    assert.equal(response.headers.get('access-control-allow-origin'), 'http://localhost:8000');
  }
});

test('returns success only when the provider returns a nonempty id', async () => {
  const response = await createContactHandler(dependencies().deps)(request());
  assert.equal(response.status, 200);
  assert.deepEqual(await body(response), { ok: true });
});

test('maps five allowed attempts and a denied sixth without a sixth send', async () => {
  let attempts = 0;
  const { deps, calls } = dependencies({
    consumeRateLimit: async () => { calls.limit += 1; attempts += 1; return attempts <= 5; },
    sendEmail: async () => { calls.send += 1; return { id: `email-${calls.send}` }; }
  });
  const handler = createContactHandler(deps);
  const statuses = [];
  for (let index = 0; index < 6; index += 1) statuses.push((await handler(request())).status);
  assert.deepEqual(statuses, [200, 200, 200, 200, 200, 429]);
  assert.equal(calls.send, 5);
});
