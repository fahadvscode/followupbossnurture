import crypto from 'node:crypto';
import { resolvePublicBaseUrl } from '@/lib/public-base-url';

/** Secret used to sign unsubscribe tokens. Set UNSUBSCRIBE_SECRET, or falls back to CRON_SECRET. */
function unsubscribeSecret(): string {
  const s =
    process.env.UNSUBSCRIBE_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    '';
  if (!s) {
    throw new Error(
      'UNSUBSCRIBE_SECRET (or CRON_SECRET) must be set to generate opt-out links'
    );
  }
  return s;
}

/** URL-safe HMAC of the contact id. Idempotent for the same contact. */
export function signContactUnsubscribe(contactId: string): string {
  return crypto
    .createHmac('sha256', unsubscribeSecret())
    .update(`unsubscribe:${contactId}`)
    .digest('base64url');
}

/** Verify token using constant-time comparison. */
export function verifyContactUnsubscribe(contactId: string, token: string): boolean {
  try {
    const expected = signContactUnsubscribe(contactId);
    const a = Buffer.from(expected);
    const b = Buffer.from(token);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/** Public unsubscribe URL a lead can click. */
export function unsubscribeUrl(contactId: string): string {
  const origin = resolvePublicBaseUrl();
  if (!origin) return '';
  const token = signContactUnsubscribe(contactId);
  return `${origin}/unsubscribe?c=${encodeURIComponent(contactId)}&t=${token}`;
}

/** Endpoint that mail providers can POST to for one-click unsubscribe (RFC 8058). */
export function unsubscribeOneClickUrl(contactId: string): string {
  const origin = resolvePublicBaseUrl();
  if (!origin) return '';
  const token = signContactUnsubscribe(contactId);
  return `${origin}/api/unsubscribe?c=${encodeURIComponent(contactId)}&t=${token}`;
}
