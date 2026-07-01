/** Public HTTPS origin for webhooks and callbacks. */
export function resolvePublicBaseUrl(): string {
  const explicit =
    process.env.NEXT_PUBLIC_BASE_URL?.trim() ||
    process.env.TWILIO_WEBHOOK_BASE_URL?.trim() ||
    '';
  const vercelHost = process.env.VERCEL_URL?.trim();
  const fromVercel = vercelHost ? `https://${vercelHost}` : '';
  const raw = (explicit || fromVercel).replace(/\/$/, '');
  if (!raw) return '';

  try {
    const u = new URL(raw.includes('://') ? raw : `https://${raw}`);
    return u.origin;
  } catch {
    return '';
  }
}

export function fubWebhookCallbackUrl(): string {
  const origin = resolvePublicBaseUrl();
  return origin ? `${origin}/api/webhooks/fub` : '';
}
