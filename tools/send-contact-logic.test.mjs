import assert from 'node:assert/strict';
import test from 'node:test';
import { buildEmail, isAllowedOrigin, validateContactBody } from '../supabase/functions/send-contact/logic.mjs';

test('allows exact production and numeric-port localhost origins only', () => {
  for (const origin of [
    'http://localhost:8000', 'http://localhost:5500',
    'http://127.0.0.1:8080', 'https://nazlibelgin.com', 'https://www.nazlibelgin.com'
  ]) assert.equal(isAllowedOrigin(origin), true, origin);
  for (const origin of [
    '', 'http://localhost', 'https://localhost:8000', 'http://localhost.evil.test:8000',
    'http://nazlibelgin.com', 'https://evilnazlibelgin.com'
  ]) assert.equal(isAllowedOrigin(origin), false, origin);
});

test('normalizes valid input and rejects non-objects, honeypots and length overflow', () => {
  assert.equal(validateContactBody(null).ok, false);
  assert.equal(validateContactBody([]).ok, false);
  assert.equal(validateContactBody({ name: 'A', email: 'bad', message: 'Hi', website: '' }).code, 'invalid_email');
  assert.equal(validateContactBody({ name: 'A', email: 'a@b.co', message: 'Hi', website: 'bot' }).code, 'spam');
  assert.equal(validateContactBody({ name: 'x'.repeat(101), email: 'a@b.co', message: 'Hi', website: '' }).ok, false);
  assert.equal(validateContactBody({ name: ' A ', email: 'a@b.co', message: ' Hi ', website: '' }).value.name, 'A');
});

test('builds escaped email without subject injection and preserves Unicode', () => {
  const email = buildEmail(
    { name: 'Furkan\r\nBcc: bad@example.com — ğ', email: 'furkan@example.com', message: '<hello> & goodbye' },
    'Nazlı Belgin Website <website@nazlibelgin.com>', 'furkanmertaksakal@gmail.com'
  );
  assert.equal(email.reply_to, 'furkan@example.com');
  assert.doesNotMatch(email.subject, /\r|\n|Bcc:/);
  assert.match(email.subject, /ğ/);
  assert.match(email.html, /&lt;hello&gt; &amp; goodbye/);
  assert.doesNotMatch(email.html, /<hello>/);
});
