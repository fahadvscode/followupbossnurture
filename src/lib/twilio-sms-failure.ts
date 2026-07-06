import type { getServiceClient } from '@/lib/supabase';
import { markContactOptedOut } from '@/lib/contact-opt-out';
import {
  deliveryErrorMeta,
  isTwilioGeoBlockedError,
  isTwilioInvalidPhoneError,
  isTwilioUnsubscribedError,
} from '@/lib/delivery-error-meta';

type Db = ReturnType<typeof getServiceClient>;

export type TwilioSmsFailureAction = 'opt_out' | 'skip' | 'retry';

export function classifyTwilioSmsFailure(error: unknown): TwilioSmsFailureAction {
  if (isTwilioUnsubscribedError(error)) return 'opt_out';
  if (isTwilioInvalidPhoneError(error) || isTwilioGeoBlockedError(error)) return 'skip';
  return 'retry';
}

type HandleFailureArgs = {
  db: Db;
  error: unknown;
  contact: { id: string; phone: string | null; fub_id?: number | null; first_name?: string | null; last_name?: string | null };
  enrollmentId: string;
  campaignId: string;
  body: string;
  stepNumber?: number | null;
  now?: string;
};

/** Log failed SMS + apply opt-out / skip rules. Returns whether the caller should stop retrying. */
export async function handleTwilioSmsFailure(args: HandleFailureArgs): Promise<{
  action: TwilioSmsFailureAction;
  stopRetrying: boolean;
}> {
  const {
    db,
    error,
    contact,
    enrollmentId,
    campaignId,
    body,
    stepNumber = null,
    now = new Date().toISOString(),
  } = args;

  const action = classifyTwilioSmsFailure(error);
  const invalidPhone = isTwilioInvalidPhoneError(error);
  const geoBlocked = isTwilioGeoBlockedError(error);
  const unsubscribed = action === 'opt_out';

  await db.from('drip_messages').insert({
    enrollment_id: enrollmentId,
    contact_id: contact.id,
    campaign_id: campaignId,
    step_number: stepNumber,
    direction: 'outbound',
    body: geoBlocked
      ? `[SMS skipped — region not enabled in Twilio] ${body}`
      : invalidPhone
        ? `[SMS skipped — invalid phone number] ${body}`
        : unsubscribed
          ? `[SMS skipped — recipient unsubscribed] ${body}`
          : body,
    status: 'failed',
    sent_at: now,
    channel: 'sms',
    error_detail: deliveryErrorMeta(error, 'twilio', 'send'),
  });

  if (unsubscribed) {
    await markContactOptedOut(db, contact, 'TWILIO_21610');
    return { action, stopRetrying: true };
  }

  if (action === 'skip') {
    return { action, stopRetrying: true };
  }

  return { action, stopRetrying: false };
}

/** Pause AI nurture when SMS cannot be delivered (prevents cron retry loops). */
export async function pauseAiForSmsFailure(
  db: Db,
  enrollmentId: string,
  conversationId: string,
  reason: string
): Promise<void> {
  const now = new Date().toISOString();
  await db
    .from('drip_enrollments')
    .update({ status: 'paused', paused_at: now })
    .eq('id', enrollmentId)
    .in('status', ['active']);
  await db
    .from('drip_ai_conversations')
    .update({ status: 'paused', escalation_reason: reason })
    .eq('id', conversationId);
}
