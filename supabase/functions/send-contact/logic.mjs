const PRODUCTION_ORIGINS = new Set(['https://nazlibelgin.com', 'https://www.nazlibelgin.com']);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isAllowedOrigin(origin) {
  if (PRODUCTION_ORIGINS.has(origin)) return true;
  try {
    const url = new URL(origin);
    return url.origin === origin && url.protocol === 'http:' &&
      (url.hostname === 'localhost' || url.hostname === '127.0.0.1') && /^\d+$/.test(url.port);
  } catch {
    return false;
  }
}

export function validateContactBody(body) {
  if (!body || Array.isArray(body) || typeof body !== 'object') {
    return { ok: false, status: 400, code: 'invalid_body' };
  }
  for (const key of ['name', 'email', 'message', 'website']) {
    if (typeof body[key] !== 'string') return { ok: false, status: 400, code: 'invalid_body' };
  }
  const value = {
    name: body.name.trim(),
    email: body.email.trim(),
    message: body.message.trim(),
    website: body.website.trim()
  };
  if (value.website) return { ok: false, status: 400, code: 'spam' };
  if (!value.name || !value.email || !value.message) {
    return { ok: false, status: 400, code: 'required' };
  }
  if (value.name.length > 100 || value.email.length > 254 || value.message.length > 5000) {
    return { ok: false, status: 400, code: 'too_long' };
  }
  if (!EMAIL.test(value.email)) return { ok: false, status: 400, code: 'invalid_email' };
  return { ok: true, status: 200, code: 'valid', value };
}

const escapeHtml = (value) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export function buildEmail(value, from, to) {
  const safeSubjectName = value.name.replace(/[\r\n:]+/g, ' ').replace(/\s+/g, ' ').trim();
  const escapedName = escapeHtml(value.name);
  const escapedEmail = escapeHtml(value.email);
  const escapedMessage = escapeHtml(value.message);
  return {
    from,
    to: [to],
    reply_to: value.email,
    subject: `Studio enquiry — ${safeSubjectName}`,
    text: `Name: ${value.name}\nEmail: ${value.email}\n\n${value.message}`,
    html: `<p><strong>Name:</strong> ${escapedName}</p>` +
      `<p><strong>Email:</strong> ${escapedEmail}</p>` +
      `<p>${escapedMessage.replace(/\n/g, '<br>')}</p>`
  };
}
