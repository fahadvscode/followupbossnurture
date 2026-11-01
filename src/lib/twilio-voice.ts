import twilio from 'twilio';
import { normalizePhone } from '@/lib/utils';

/** Twilio drip line that forwards inbound voice calls. */
export const DEFAULT_VOICE_FORWARD_FROM = '+16475605822';
const DEFAULT_FORWARD_TO = '+12895369724';

function getClient() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  if (!accountSid || !authToken) {
    throw new Error('TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN must be set');
  }
  return twilio(accountSid, authToken);
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function resolveVoiceForwardFromNumber(): string {
  return normalizePhone(
    process.env.TWILIO_VOICE_FORWARD_FROM?.trim() || DEFAULT_VOICE_FORWARD_FROM
  );
}

/** Any drip Twilio number that hits this webhook forwards to the office phone. */
export function resolveVoiceForwardTarget(calledNumber: string): string | null {
  const forwardTo = normalizePhone(
    process.env.TWILIO_VOICE_FORWARD_TO?.trim() || DEFAULT_FORWARD_TO
  );
  const called = normalizePhone(calledNumber);
  if (!called || !forwardTo) return null;
  return forwardTo;
}

/** Forward an inbound drip call. `callerId` should be the original caller's number. */
export function buildVoiceForwardTwiml(forwardTo: string, callerId?: string): string {
  const normalizedCaller = callerId?.trim() ? normalizePhone(callerId) : '';
  const dialAttrs = /^\+\d{8,15}$/.test(normalizedCaller)
    ? ` callerId="${escapeXml(normalizedCaller)}"`
    : '';
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial${dialAttrs}>${escapeXml(forwardTo)}</Dial>
</Response>`;
}

/** Point these Twilio numbers' voice webhooks at the drip forward. SMS webhooks are left alone. */
export async function configureVoiceWebhooks(
  phoneNumbers: string[],
  voiceUrl: string
): Promise<{ phoneNumber: string; updated: boolean }[]> {
  const client = getClient();
  const wanted = new Set(phoneNumbers.map((n) => normalizePhone(n)).filter(Boolean));
  const list = await client.incomingPhoneNumbers.list({ pageSize: 1000 });
  const results: { phoneNumber: string; updated: boolean }[] = [];

  for (const number of list) {
    const normalized = normalizePhone(number.phoneNumber);
    if (!wanted.has(normalized)) continue;
    if (number.voiceUrl === voiceUrl && number.voiceMethod === 'POST') {
      results.push({ phoneNumber: number.phoneNumber, updated: false });
      continue;
    }
    await client.incomingPhoneNumbers(number.sid).update({
      voiceUrl,
      voiceMethod: 'POST',
    });
    results.push({ phoneNumber: number.phoneNumber, updated: true });
  }

  return results;
}

/** Point a Twilio incoming number's voice webhook at this app. */
export async function configureIncomingNumberVoiceWebhook(options: {
  phoneNumber?: string;
  voiceUrl: string;
}): Promise<{ sid: string; phoneNumber: string } | null> {
  const client = getClient();
  const target = normalizePhone(
    options.phoneNumber?.trim() || resolveVoiceForwardFromNumber()
  );
  const list = await client.incomingPhoneNumbers.list({ pageSize: 1000 });
  const match = list.find((n) => normalizePhone(n.phoneNumber) === target);
  if (!match) return null;

  await client.incomingPhoneNumbers(match.sid).update({
    voiceUrl: options.voiceUrl,
    voiceMethod: 'POST',
  });

  return { sid: match.sid, phoneNumber: match.phoneNumber };
}
