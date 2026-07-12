import twilio from 'twilio';
import { normalizePhone } from '@/lib/utils';

/** Twilio drip line that forwards inbound voice calls. */
export const DEFAULT_VOICE_FORWARD_FROM = '+16475605822';
const DEFAULT_FORWARD_TO = '+16478981739';

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

/** Inbound voice on the drip Twilio number forwards to the agent cell. */
export function resolveVoiceForwardTarget(calledNumber: string): string | null {
  const fromNumber = resolveVoiceForwardFromNumber();
  const forwardTo = normalizePhone(
    process.env.TWILIO_VOICE_FORWARD_TO?.trim() || DEFAULT_FORWARD_TO
  );
  const called = normalizePhone(calledNumber);
  if (!called || called !== fromNumber || !forwardTo) return null;
  return forwardTo;
}

export function buildVoiceForwardTwiml(forwardTo: string, callerId?: string): string {
  const dialAttrs = callerId?.trim()
    ? ` callerId="${escapeXml(normalizePhone(callerId))}"`
    : '';
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial${dialAttrs}>${escapeXml(forwardTo)}</Dial>
</Response>`;
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
