export type DeliveryErrorSource = 'twilio' | 'smtp' | 'fub' | 'app' | 'email';

export type DeliveryErrorDetail = {
  source: DeliveryErrorSource;
  message: string;
  phase?: 'send' | 'status_callback' | 'config' | 'delivery';
  code?: string | number;
  httpStatus?: number;
  moreInfo?: string;
  twilioStatus?: string;
};

/** Normalize unknown thrown values into JSON we can store on drip_messages.error_detail */
export function deliveryErrorMeta(
  error: unknown,
  source: DeliveryErrorSource,
  phase?: DeliveryErrorDetail['phase']
): DeliveryErrorDetail {
  if (error && typeof error === 'object') {
    const e = error as Record<string, unknown>;
    const message =
      typeof e.message === 'string'
        ? e.message
        : typeof e.error === 'string'
          ? e.error
          : 'Request failed';
    const code = e.code ?? e.status;
    const httpStatus = typeof e.status === 'number' ? e.status : undefined;
    const moreInfo = typeof e.moreInfo === 'string' ? e.moreInfo : undefined;
    if (code !== undefined || httpStatus !== undefined || moreInfo) {
      return {
        source,
        phase,
        message,
        ...(code !== undefined ? { code: code as string | number } : {}),
        ...(httpStatus !== undefined ? { httpStatus } : {}),
        ...(moreInfo ? { moreInfo } : {}),
      };
    }
    return { source, phase, message };
  }
  if (error instanceof Error) {
    return { source, phase, message: error.message };
  }
  return { source, phase, message: String(error) };
}

/** Twilio 21408 — destination region disabled in Geo Permissions (not retryable). */
export function isTwilioGeoBlockedError(error: unknown): boolean {
  return twilioErrorCode(error) === 21408 || matchesTwilioMessage(error, [
    '21408',
    'permission to send an sms has not been enabled for the region',
    'permissions disabled for the destination region',
  ]);
}

/** Twilio 21610 — recipient unsubscribed / opted out (not retryable; CASL). */
export function isTwilioUnsubscribedError(error: unknown): boolean {
  return twilioErrorCode(error) === 21610 || matchesTwilioMessage(error, [
    '21610',
    'unsubscribed recipient',
    'attempt to send to unsubscribed',
  ]);
}

/** Twilio 21211 — invalid destination number (not retryable). */
export function isTwilioInvalidPhoneError(error: unknown): boolean {
  return twilioErrorCode(error) === 21211 || matchesTwilioMessage(error, [
    '21211',
    "invalid 'to' phone number",
    'invalid to phone number',
  ]);
}

export function isTwilioPermanentSmsError(error: unknown): boolean {
  return (
    isTwilioGeoBlockedError(error) ||
    isTwilioUnsubscribedError(error) ||
    isTwilioInvalidPhoneError(error)
  );
}

export function twilioErrorCode(error: unknown): number | null {
  const meta = deliveryErrorMeta(error, 'twilio', 'send');
  if (meta.code === undefined || meta.code === null) return null;
  const n = typeof meta.code === 'number' ? meta.code : parseInt(String(meta.code), 10);
  return Number.isFinite(n) ? n : null;
}

/** Read a stored drip_messages.error_detail JSON blob. */
export function errorDetailCode(detail: unknown): number | null {
  if (!detail || typeof detail !== 'object') return null;
  const code = (detail as Record<string, unknown>).code;
  if (code === undefined || code === null) return null;
  const n = typeof code === 'number' ? code : parseInt(String(code), 10);
  return Number.isFinite(n) ? n : null;
}

export function errorDetailIndicatesUnsubscribed(detail: unknown): boolean {
  if (errorDetailCode(detail) === 21610) return true;
  if (!detail || typeof detail !== 'object') return false;
  const msg = String((detail as Record<string, unknown>).message || '').toLowerCase();
  return msg.includes('21610') || msg.includes('unsubscribed');
}

/** Billing / account / rate-limit errors — safe to retry after Twilio is funded again. */
export function isTwilioRetryableFailure(detail: unknown): boolean {
  const code = errorDetailCode(detail);
  if (code != null) {
    // 20003 auth, 20429 too many requests, 21606 from invalid (sometimes transient)
    if ([20003, 20429, 20500, 20503].includes(code)) return true;
  }
  if (!detail || typeof detail !== 'object') return false;
  const msg = String((detail as Record<string, unknown>).message || '').toLowerCase();
  return (
    msg.includes('insufficient') ||
    msg.includes('balance') ||
    msg.includes('authenticate') ||
    msg.includes('20003') ||
    msg.includes('unable to create record') ||
    msg.includes('account suspended') ||
    msg.includes('payment')
  );
}

export function isTwilioPermanentStoredFailure(detail: unknown): boolean {
  if (errorDetailIndicatesUnsubscribed(detail)) return true;
  const code = errorDetailCode(detail);
  if (code === 21211 || code === 21408 || code === 21610) return true;
  if (!detail || typeof detail !== 'object') return false;
  const msg = String((detail as Record<string, unknown>).message || '').toLowerCase();
  if (msg.includes('invalid phone') || msg.includes('21211')) return true;
  if (msg.includes('region not enabled') || msg.includes('21408')) return true;
  if (isTwilioRetryableFailure(detail)) return false;
  // Unknown failures: allow retry (do not auto-skip the step).
  return false;
}

function matchesTwilioMessage(error: unknown, needles: string[]): boolean {
  const msg = deliveryErrorMeta(error, 'twilio', 'send').message.toLowerCase();
  return needles.some((n) => msg.includes(n));
}

/** One-line + expandable JSON for dashboard / UI */
export function summarizeErrorDetail(d: unknown): string {
  if (!d || typeof d !== 'object') return '';
  const o = d as Record<string, unknown>;
  const parts: string[] = [];
  if (o.source) {
    parts.push(`${o.source}${o.phase ? ` · ${o.phase}` : ''}`);
  }
  if (o.twilioStatus) parts.push(`Twilio status: ${o.twilioStatus}`);
  if (o.errorCode != null) parts.push(`code ${o.errorCode}`);
  if (typeof o.message === 'string' && o.message.trim()) parts.push(o.message.trim());
  if (o.httpStatus != null) parts.push(`HTTP ${o.httpStatus}`);
  if (typeof o.moreInfo === 'string' && o.moreInfo.trim()) parts.push(o.moreInfo.trim());
  return parts.join(' — ') || 'See details below';
}

export function inferMessageChannel(msg: {
  body: string;
  channel?: string | null;
  twilio_sid?: string | null;
}): 'sms' | 'email' | 'fub_task' | 'fub_action_plan' | 'other' {
  if (msg.channel && ['sms', 'email', 'fub_task', 'fub_action_plan'].includes(msg.channel)) {
    return msg.channel as 'sms' | 'email' | 'fub_task' | 'fub_action_plan';
  }
  const b = msg.body || '';
  if (b.startsWith('[Email') || b.includes('FUB timeline')) return 'email';
  if (b.startsWith('[FUB action plan')) return 'fub_action_plan';
  if (b.startsWith('[FUB task')) return 'fub_task';
  if (msg.twilio_sid?.startsWith('fub-em-')) return 'email';
  if (msg.twilio_sid?.startsWith('fub-ap-')) return 'fub_action_plan';
  return 'sms';
}

/** True when a drip_messages row is an SMS (not email, FUB task, or action plan). */
export function isSmsMessage(msg: {
  body: string;
  channel?: string | null;
  twilio_sid?: string | null;
}): boolean {
  return inferMessageChannel(msg) === 'sms';
}
