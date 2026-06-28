import twilio from 'twilio';

export interface TwilioListedNumber {
  sid: string;
  phoneNumber: string;
  friendlyName: string | null;
  smsCapable: boolean;
}

function getClient() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  if (!accountSid || !authToken) {
    throw new Error('TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN must be set');
  }
  return twilio(accountSid, authToken);
}

/** All incoming phone numbers on the account (SMS-capable flagged). */
export async function listTwilioPhoneNumbers(): Promise<TwilioListedNumber[]> {
  try {
    const client = getClient();
    const list = await client.incomingPhoneNumbers.list({ pageSize: 1000 });
    return list.map((n) => ({
      sid: n.sid,
      phoneNumber: n.phoneNumber,
      friendlyName: n.friendlyName || null,
      smsCapable: Boolean(n.capabilities?.sms),
    }));
  } catch {
    return [];
  }
}

export async function sendSMS(
  to: string,
  body: string,
  fromOverride?: string | null
): Promise<{
  sid: string;
  status: string;
}> {
  const client = getClient();
  const from = (fromOverride?.trim() || process.env.TWILIO_PHONE_NUMBER?.trim() || '').trim();
  if (!from) {
    throw new Error(
      'No sending number: pick a Twilio number on the campaign or set TWILIO_PHONE_NUMBER in env'
    );
  }

  const statusCallback = resolveTwilioStatusCallbackUrl();
  const message = await client.messages.create({
    to,
    from,
    body,
    ...(statusCallback ? { statusCallback } : {}),
  });

  return { sid: message.sid, status: message.status };
}

export async function sendMMS(
  to: string,
  body: string,
  mediaUrl: string,
  fromOverride?: string | null
): Promise<{ sid: string; status: string }> {
  const client = getClient();
  const from = (fromOverride?.trim() || process.env.TWILIO_PHONE_NUMBER?.trim() || '').trim();
  if (!from) {
    throw new Error(
      'No sending number: pick a Twilio number on the campaign or set TWILIO_PHONE_NUMBER in env'
    );
  }

  const statusCallback = resolveTwilioStatusCallbackUrl();
  const message = await client.messages.create({
    to,
    from,
    body,
    mediaUrl: [mediaUrl],
    ...(statusCallback ? { statusCallback } : {}),
  });

  return { sid: message.sid, status: message.status };
}

export function renderTemplate(template: string, variables: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value || '');
  }
  return result;
}

const STOP_WORDS = ['stop', 'unsubscribe', 'cancel', 'end', 'quit', 'stopall', 'opt out', 'optout'];

export function isOptOut(message: string): boolean {
  const normalized = message.trim().toLowerCase();
  return STOP_WORDS.includes(normalized);
}

/** Resolve the public origin Twilio should use when validating webhook signatures. */
export function resolveTwilioWebhookOrigin(): string {
  const explicit = process.env.TWILIO_WEBHOOK_BASE_URL?.trim();
  const vercelHost = process.env.VERCEL_URL?.trim();
  const fromVercel = vercelHost ? `https://${vercelHost}` : '';
  const fromPublic = process.env.NEXT_PUBLIC_BASE_URL?.trim() || '';
  const raw = (explicit || fromPublic || fromVercel).replace(/\/$/, '');
  if (!raw) return '';

  try {
    const u = new URL(raw.includes('://') ? raw : `https://${raw}`);
    return u.origin;
  } catch {
    return '';
  }
}

export function formDataToTwilioParams(formData: FormData): Record<string, string> {
  const params: Record<string, string> = {};
  formData.forEach((value, key) => {
    params[key] = String(value);
  });
  return params;
}

/** Reject forged Twilio callbacks unless running locally in development. */
export function validateTwilioWebhookRequest(
  request: { url: string; headers: { get(name: string): string | null } },
  params: Record<string, string>
): boolean {
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  if (!authToken) {
    console.error('TWILIO_AUTH_TOKEN not set; rejecting Twilio webhook');
    return false;
  }

  if (process.env.NODE_ENV === 'development') {
    return true;
  }

  const signature = request.headers.get('X-Twilio-Signature');
  if (!signature) return false;

  const pathname = new URL(request.url).pathname;
  const origin = resolveTwilioWebhookOrigin();
  const url = origin ? `${origin}${pathname}` : request.url;

  return twilio.validateRequest(authToken, signature, url, params);
}

/**
 * Twilio rejects StatusCallback URLs that are not publicly reachable (e.g. localhost).
 * On Vercel, VERCEL_URL is set automatically so callbacks work after deploy.
 * For local dev without a tunnel, we omit StatusCallback — SMS still sends; delivery webhooks won't fire.
 */
function resolveTwilioStatusCallbackUrl(): string | undefined {
  const origin = resolveTwilioWebhookOrigin();
  if (!origin) return undefined;

  try {
    const h = new URL(origin).hostname.toLowerCase();
    if (h === 'localhost' || h === '127.0.0.1' || h === '[::1]') return undefined;
  } catch {
    return undefined;
  }

  return `${origin}/api/webhooks/twilio/status`;
}
