import type { getServiceClient } from '@/lib/supabase';

type Db = ReturnType<typeof getServiceClient>;

export function shouldPauseStandardDripOnSmsReply(campaign: {
  campaign_type?: string | null;
  pause_on_sms_reply?: boolean | null;
}): boolean {
  if (campaign.campaign_type === 'ai_nurture') return false;
  return campaign.pause_on_sms_reply !== false;
}

/** True when the lead has sent at least one inbound SMS since `sinceIso` (or ever if omitted). */
export async function contactHasInboundSmsSince(
  db: Db,
  contactId: string,
  sinceIso?: string | null
): Promise<boolean> {
  let query = db
    .from('drip_messages')
    .select('id', { count: 'exact', head: true })
    .eq('contact_id', contactId)
    .eq('direction', 'inbound')
    .eq('channel', 'sms');

  if (sinceIso) {
    query = query.gte('sent_at', sinceIso);
  }

  const { count } = await query;
  return (count || 0) > 0;
}

/** Pause a standard enrollment when the lead has already texted back. */
export async function pauseEnrollmentIfLeadReplied(
  db: Db,
  enrollment: { id: string; contact_id: string; enrolled_at: string },
  campaign: {
    campaign_type?: string | null;
    pause_on_sms_reply?: boolean | null;
  }
): Promise<boolean> {
  if (!shouldPauseStandardDripOnSmsReply(campaign)) return false;

  const hasReplied = await contactHasInboundSmsSince(
    db,
    enrollment.contact_id,
    enrollment.enrolled_at
  );
  if (!hasReplied) return false;

  const now = new Date().toISOString();
  const { error } = await db
    .from('drip_enrollments')
    .update({ status: 'paused', paused_at: now })
    .eq('id', enrollment.id)
    .eq('status', 'active');

  return !error;
}
