import { createClient } from 'npm:@supabase/supabase-js@2.117.0';
import { createContactHandler } from './handler.mjs';

const env = (name: string) => Deno.env.get(name) || '';
const serverKey = () => {
  const current = env('SUPABASE_SECRET_KEYS');
  if (current) {
    try {
      const parsed = JSON.parse(current);
      if (parsed.default) return parsed.default;
    } catch {}
  }
  return env('SUPABASE_SERVICE_ROLE_KEY');
};
const hashIp = async (value: string) => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
};
const clientIp = (request: Request) =>
  (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() ||
  request.headers.get('cf-connecting-ip') || request.headers.get('x-real-ip') || '';
const consumeRateLimit = async (clientHash: string) => {
  const client = createClient(env('SUPABASE_URL'), serverKey(), { auth: { persistSession: false } });
  const { data, error } = await client.rpc('consume_contact_rate_limit', { client_hash: clientHash });
  if (error) throw error;
  return data === true;
};
const sendEmail = async (payload: object) => {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env('RESEND_API_KEY')}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error('Resend rejected the email');
  return data;
};

Deno.serve(createContactHandler({
  env,
  hashIp,
  clientIp,
  consumeRateLimit,
  sendEmail,
  log: (message: string, details: object) => console.error(message, details)
}));
