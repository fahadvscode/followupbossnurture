import type { getServiceClient } from '@/lib/supabase';

type Db = ReturnType<typeof getServiceClient>;

type CampaignPauseRow = {
  campaign_type?: string | null;
  pause_on_sms_reply?: boolean | null;
};

function unwrapOne<T>(row: T | T[] | null | undefined): T | null {
  if (row == null) return null;
  return Array.isArray(row) ? (row[0] ?? null) : row;
}

/** Pause active standard drip enrollments for a contact after they text back. */
export async function pauseStandardEnrollmentsOnSmsReply(
  db: Db,
  contactId: string,
  options: { excludeEnrollmentIds?: string[] } = {}
): Promise<string[]> {
  const exclude = new Set(options.excludeEnrollmentIds || []);

  const { data: activeRows } = await db
    .from('drip_enrollments')
    .select('id, campaign:drip_campaigns(campaign_type, pause_on_sms_reply)')
    .eq('contact_id', contactId)
    .eq('status', 'active');

  const toPause = (activeRows || []).filter((row) => {
    if (exclude.has(row.id)) return false;
    const camp = unwrapOne(row.campaign as CampaignPauseRow | CampaignPauseRow[] | null);
    if (camp?.campaign_type === 'ai_nurture') return false;
    return camp?.pause_on_sms_reply !== false;
  });

  if (toPause.length === 0) return [];

  const now = new Date().toISOString();
  const ids = toPause.map((row) => row.id);
  const { error } = await db
    .from('drip_enrollments')
    .update({ status: 'paused', paused_at: now })
    .in('id', ids);

  if (error) {
    console.error('Failed to pause enrollments on SMS reply:', error);
    return [];
  }

  return ids;
}
