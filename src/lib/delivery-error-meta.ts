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
