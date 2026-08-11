import { getServiceClient } from '@/lib/supabase';
import {
  ensurePersonForPhone,
  getCallById,
  isFubApiConfigured,
  listCallsToNumber,
  type FubCallRecord,
} from '@/lib/fub';
import { sendSMS } from '@/lib/twilio';
import { isPlausibleSmsPhone, normalizePhone } from '@/lib/utils';

/**
 * STRICT allowlist — auto-SMS only for inbound calls to this exact FUB number.
 * Not configurable via env on purpose (nothing else should ever trigger this).
 */
export const CALL_AUTO_SMS_TO_NUMBER = '6474926055';

/** @deprecated use CALL_AUTO_SMS_TO_NUMBER */
export const DEFAULT_CALL_AUTO_SMS_TO = CALL_AUTO_SMS_TO_NUMBER;

export const DEFAULT_CALL_AUTO_SMS_BODY =
  "Hi! We're sorry we missed your call — we're currently experiencing high demand. Please take a moment to book your cleaning service here: https://www.aceofcleanspace.com/ We look forward to serving you!";

function digits10(phone: string | null | undefined): string {
  if (!phone) return '';
  const d = phone.replace(/\D/g, '');
  if (d.length === 11 && d.startsWith('1')) return d.slice(1);
  if (d.length >= 10) return d.slice(-10);
  return d;
}

/** True only when the dialed number is exactly (647) 492-6055. */
export function isStrictCallAutoSmsTarget(toNumber: string | null | undefined): boolean {
  return digits10(toNumber) === CALL_AUTO_SMS_TO_NUMBER;
}

export function getCallAutoSmsTargetNumber(): string {
  return CALL_AUTO_SMS_TO_NUMBER;
}

export function getCallAutoSmsBody(): string {
  const fromEnv = process.env.FUB_CALL_AUTO_SMS_BODY?.trim();
  return fromEnv || DEFAULT_CALL_AUTO_SMS_BODY;
}

export function isCallAutoSmsEnabled(): boolean {
  const raw = process.env.FUB_CALL_AUTO_SMS_ENABLED?.trim().toLowerCase();
  if (raw === '0' || raw === 'false' || raw === 'off' || raw === 'no') return false;
  return true;
}

function callerPhoneFromCall(call: FubCallRecord): string {
  return normalizePhone(call.fromNumber || call.phone || '');
}

export type CallAutoSmsResult = {
  callId: number;
  status: 'sent' | 'skipped' | 'failed' | 'already';
  reason?: string;
  twilioSid?: string;
  to?: string;
};

async function alreadyProcessed(callId: number): Promise<boolean> {
  const db = getServiceClient();
  const { data } = await db
    .from('drip_call_auto_sms')
    .select('id')
    .eq('fub_call_id', callId)
    .maybeSingle();
  return Boolean(data?.id);
}

async function recordResult(row: {
  fub_call_id: number;
  to_number: string;
  from_number: string;
  fub_person_id?: number | null;
  twilio_sid?: string | null;
  message_body: string;
  status: 'sent' | 'skipped' | 'failed';
  skip_reason?: string | null;
  error?: string | null;
}): Promise<'inserted' | 'duplicate'> {
  const db = getServiceClient();
  const { error } = await db.from('drip_call_auto_sms').insert(row);
  if (error) {
    if (error.code === '23505') return 'duplicate';
    throw error;
  }
  return 'inserted';
}

/**
 * Process one FUB call: if inbound to the configured number, SMS the caller via Twilio.
 */
export async function processCallAutoSmsForCallId(callId: number): Promise<CallAutoSmsResult> {
  if (!isCallAutoSmsEnabled()) {
    return { callId, status: 'skipped', reason: 'disabled' };
  }
  if (!isFubApiConfigured()) {
    return { callId, status: 'skipped', reason: 'fub_not_configured' };
  }
  if (await alreadyProcessed(callId)) {
    return { callId, status: 'already' };
  }

  const call = await getCallById(callId);
  return processCallAutoSmsForCall(call);
}

export async function processCallAutoSmsForCall(call: FubCallRecord): Promise<CallAutoSmsResult> {
  const callId = call.id;
  if (!Number.isFinite(callId)) {
    return { callId: 0, status: 'skipped', reason: 'invalid_call' };
  }
  if (!isCallAutoSmsEnabled()) {
    return { callId, status: 'skipped', reason: 'disabled' };
  }
  if (await alreadyProcessed(callId)) {
    return { callId, status: 'already' };
  }

  // Hard gate: never SMS (or log) for any other dialed number.
  if (!call.isIncoming || !isStrictCallAutoSmsTarget(call.toNumber)) {
    return { callId, status: 'skipped', reason: 'wrong_to_number' };
  }

  const body = getCallAutoSmsBody();
  const caller = callerPhoneFromCall(call);

  const skip = async (reason: string): Promise<CallAutoSmsResult> => {
    const inserted = await recordResult({
      fub_call_id: callId,
      to_number: CALL_AUTO_SMS_TO_NUMBER,
      from_number: call.fromNumber || call.phone || '',
      fub_person_id: call.personId && call.personId > 0 ? call.personId : null,
      message_body: body,
      status: 'skipped',
      skip_reason: reason,
    });
    if (inserted === 'duplicate') return { callId, status: 'already' };
    return { callId, status: 'skipped', reason };
  };

  if (!isPlausibleSmsPhone(caller)) return skip('invalid_caller_phone');

  let personId =
    typeof call.personId === 'number' && call.personId > 0 ? call.personId : undefined;
  try {
    if (!personId) {
      personId = await ensurePersonForPhone({
        phone: caller,
        source: 'Ace of Clean Space Call',
        message: `Inbound call to (647) 492-6055`,
      });
    }
  } catch (err) {
    console.error(`Call auto-SMS: ensure person failed for call ${callId}:`, err);
  }

  try {
    const fromOverride = process.env.FUB_CALL_AUTO_SMS_FROM?.trim() || null;
    const result = await sendSMS(caller, body, fromOverride);
    const inserted = await recordResult({
      fub_call_id: callId,
      to_number: CALL_AUTO_SMS_TO_NUMBER,
      from_number: call.fromNumber || caller,
      fub_person_id: personId ?? null,
      twilio_sid: result.sid,
      message_body: body,
      status: 'sent',
    });
    if (inserted === 'duplicate') return { callId, status: 'already' };
    return { callId, status: 'sent', twilioSid: result.sid, to: caller };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'SMS send failed';
    console.error(`Call auto-SMS: send failed for call ${callId}:`, err);
    try {
      await recordResult({
        fub_call_id: callId,
        to_number: CALL_AUTO_SMS_TO_NUMBER,
        from_number: call.fromNumber || caller,
        fub_person_id: personId ?? null,
        message_body: body,
        status: 'failed',
        error: message,
      });
    } catch (logErr) {
      console.error('Call auto-SMS: failed to log error row:', logErr);
    }
    return { callId, status: 'failed', reason: message, to: caller };
  }
}

/** Webhook helper: process each call resource id from callsCreated. */
export async function processCallAutoSmsForWebhook(body: unknown): Promise<{
  results: CallAutoSmsResult[];
}> {
  if (!body || typeof body !== 'object') return { results: [] };
  const b = body as Record<string, unknown>;
  const resourceIds = Array.isArray(b.resourceIds) ? b.resourceIds : [];
  const results: CallAutoSmsResult[] = [];

  for (const raw of resourceIds) {
    const callId = typeof raw === 'number' ? raw : parseInt(String(raw), 10);
    if (!Number.isFinite(callId)) continue;
    try {
      results.push(await processCallAutoSmsForCallId(callId));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed';
      console.error(`Call auto-SMS webhook call ${callId}:`, err);
      results.push({ callId, status: 'failed', reason: message });
    }
  }

  return { results };
}

/**
 * Cron backup: scan recent inbound calls to the target FUB number and SMS any not yet handled.
 * Only considers calls from the last `lookbackMinutes` so historical calls are not blasted.
 */
export async function processRecentCallAutoSms(
  limit = 30,
  lookbackMinutes = 30
): Promise<{
  checked: number;
  sent: number;
  skipped: number;
  failed: number;
  already: number;
}> {
  const summary = { checked: 0, sent: 0, skipped: 0, failed: 0, already: 0 };
  if (!isCallAutoSmsEnabled() || !isFubApiConfigured()) return summary;

  // Cron only ever queries this one FUB number — never other lines.
  const calls = await listCallsToNumber(CALL_AUTO_SMS_TO_NUMBER, limit);
  const cutoff = Date.now() - Math.max(5, lookbackMinutes) * 60 * 1000;
  const recent = calls.filter((c) => {
    if (!isStrictCallAutoSmsTarget(c.toNumber)) return false;
    if (!c.isIncoming) return false;
    if (!c.created) return false;
    const t = Date.parse(c.created);
    return Number.isFinite(t) && t >= cutoff;
  });
  summary.checked = recent.length;

  for (const call of recent) {
    try {
      // Defense in depth: re-check before send.
      if (!isStrictCallAutoSmsTarget(call.toNumber)) {
        summary.skipped++;
        continue;
      }
      const result = await processCallAutoSmsForCall(call);
      if (result.status === 'sent') summary.sent++;
      else if (result.status === 'failed') summary.failed++;
      else if (result.status === 'already') summary.already++;
      else summary.skipped++;
    } catch (err) {
      summary.failed++;
      console.error(`Call auto-SMS cron call ${call.id}:`, err);
    }
  }

  return summary;
}
