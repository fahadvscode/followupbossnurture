const SESSION_SALT = 'drip-admin-session-v1';

function getAuthSecret(): string {
  return process.env.ADMIN_PASSWORD?.trim() || process.env.CRON_SECRET?.trim() || '';
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function timingSafeEqualString(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

export async function computeSessionToken(): Promise<string> {
  const secret = getAuthSecret();
  if (!secret) return '';

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(SESSION_SALT));
  return base64UrlEncode(new Uint8Array(sig));
}

export async function isValidSessionCookie(value: string | undefined): Promise<boolean> {
  if (!value) return false;
  const expected = await computeSessionToken();
  if (!expected) return false;
  return timingSafeEqualString(value, expected);
}
