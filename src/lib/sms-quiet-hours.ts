/**
 * Proactive SMS quiet hours (default: Toronto / Eastern home-market).
 * Industry practice: avoid outbound marketing/nurture texts during sleep hours;
 * response to an inbound message is handled separately (see env below).
 *
 * Env:
 *   SMS_QUIET_HOURS_TZ       — IANA zone (default America/Toronto)
 *   SMS_QUIET_START_HOUR     — 0–23, start of blocked window (default 21 = 9pm)
 *   SMS_QUIET_END_HOUR       — 0–23, first allowed hour (default 8 = 8am)
 *   SMS_QUIET_BLOCK_REPLIES  — if "true", also defer AI auto-replies during quiet hours
 */

function hourInTimeZone(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: 'numeric',
    hour12: false,
  }).formatToParts(date);
  const h = parts.find((p) => p.type === 'hour')?.value;
  return h != null ? parseInt(h, 10) : 0;
}

export function getSmsQuietConfig(): { tz: string; startHour: number; endHour: number } {
  const tz = process.env.SMS_QUIET_HOURS_TZ?.trim() || 'America/Toronto';
  const startHour = Math.min(23, Math.max(0, parseInt(process.env.SMS_QUIET_START_HOUR || '21', 10)));
  const endHour = Math.min(23, Math.max(0, parseInt(process.env.SMS_QUIET_END_HOUR || '8', 10)));
  return { tz, startHour, endHour };
}

/**
 * True when local time is inside the "do not send proactive SMS" window.
 * Default: block 21:00–08:00 (same calendar day wrap: 9pm through 7:59am).
 */
export function isProactiveSmsQuietHoursNow(date = new Date()): boolean {
  const { tz, startHour, endHour } = getSmsQuietConfig();
  const hour = hourInTimeZone(date, tz);
  if (startHour > endHour) {
    return hour >= startHour || hour < endHour;
  }
  return hour >= startHour && hour < endHour;
}

/** Proactive = first touch, follow-ups, standard drip SMS. */
export function shouldDeferProactiveSms(now = new Date()): boolean {
  return isProactiveSmsQuietHoursNow(now);
}

/**
 * AI auto-replies to inbound texts are not deferred by default (the lead opened the thread).
 * Set SMS_QUIET_BLOCK_REPLIES=true to defer those too (requires a future queued-reply feature).
 */
export function shouldDeferAiInboundReply(now = new Date()): boolean {
  return process.env.SMS_QUIET_BLOCK_REPLIES?.trim().toLowerCase() === 'true'
    ? isProactiveSmsQuietHoursNow(now)
    : false;
}
