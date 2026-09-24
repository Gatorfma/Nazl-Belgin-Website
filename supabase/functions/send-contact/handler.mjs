import { buildEmail, isAllowedOrigin, validateContactBody } from './logic.mjs';

const REQUIRED_ENV = ['RESEND_API_KEY', 'CONTACT_TO_EMAIL', 'CONTACT_FROM_EMAIL', 'CONTACT_IP_SALT'];
const corsHeaders = (origin) => ({
  'Access-Control-Allow-Origin': origin,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Vary': 'Origin'
});
const json = (body, status, extra = {}) => new Response(JSON.stringify(body), {
  status,
  headers: { ...extra, 'Content-Type': 'application/json' }
});

export function createContactHandler(deps) {
  return async function handle(request) {
    const origin = request.headers.get('origin') || '';
    if (!isAllowedOrigin(origin)) return json({ ok: false, code: 'origin' }, 403);
    const headers = corsHeaders(origin);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') return json({ ok: false, code: 'method' }, 405, headers);
    if (!(request.headers.get('content-type') || '').toLowerCase().startsWith('application/json')) {
      return json({ ok: false, code: 'content_type' }, 415, headers);
    }
    const declared = Number(request.headers.get('content-length') || 0);
    if (declared > 16384) return json({ ok: false, code: 'too_large' }, 413, headers);
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > 16384) {
      return json({ ok: false, code: 'too_large' }, 413, headers);
    }
    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      return json({ ok: false, code: 'invalid_json' }, 400, headers);
    }
    const checked = validateContactBody(body);
    if (!checked.ok) return json({ ok: false, code: checked.code }, checked.status, headers);
    if (REQUIRED_ENV.some((name) => !deps.env(name))) {
      return json({ ok: false, code: 'unavailable' }, 503, headers);
    }
    const ip = deps.clientIp(request);
    if (!ip) return json({ ok: false, code: 'unavailable' }, 503, headers);
    const clientHash = await deps.hashIp(`${deps.env('CONTACT_IP_SALT')}:${ip}`);
    try {
      if (!await deps.consumeRateLimit(clientHash)) {
        return json({ ok: false, code: 'rate_limited' }, 429, headers);
      }
      const payload = buildEmail(
        checked.value,
        deps.env('CONTACT_FROM_EMAIL'),
        deps.env('CONTACT_TO_EMAIL')
      );
      const sent = await deps.sendEmail(payload);
      if (!sent || typeof sent.id !== 'string' || !sent.id) {
        throw new Error('Resend did not return an id');
      }
      return json({ ok: true }, 200, headers);
    } catch (error) {
      const requestId = crypto.randomUUID();
      deps.log('contact send failed', {
        requestId,
        name: error && error.name ? error.name : 'Error'
      });
      return json({ ok: false, code: 'delivery_failed', requestId }, 502, headers);
    }
  };
}
