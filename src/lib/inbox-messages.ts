import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchAllPages } from '@/lib/supabase-fetch-all';
import { isSmsMessage } from '@/lib/delivery-error-meta';
import type { DripMessage } from '@/types';

/** All SMS rows for a contact in a campaign, including legacy rows with null campaign_id. */
export async function loadContactCampaignSmsMessages(
  db: SupabaseClient,
  contactId: string,
  campaignId: string
): Promise<DripMessage[]> {
  const { data: enrollments } = await db
    .from('drip_enrollments')
    .select('id')
    .eq('contact_id', contactId)
    .eq('campaign_id', campaignId);

  const enrollmentIds = (enrollments || []).map((e) => e.id as string);

  const byCampaign = await fetchAllPages<DripMessage>((range) =>
    db
      .from('drip_messages')
      .select('*')
      .eq('contact_id', contactId)
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: true })
      .range(range.from, range.to)
  );

  let byEnrollment: DripMessage[] = [];
  if (enrollmentIds.length > 0) {
    byEnrollment = await fetchAllPages<DripMessage>((range) =>
      db
        .from('drip_messages')
        .select('*')
        .eq('contact_id', contactId)
        .is('campaign_id', null)
        .in('enrollment_id', enrollmentIds)
        .order('created_at', { ascending: true })
        .range(range.from, range.to)
    );
  }

  const seen = new Set<string>();
  const merged: DripMessage[] = [];
  for (const row of [...byCampaign, ...byEnrollment]) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    merged.push(row);
  }

  merged.sort(
    (a, b) =>
      new Date(a.sent_at || a.created_at).getTime() -
      new Date(b.sent_at || b.created_at).getTime()
  );

  return merged.filter(isSmsMessage);
}
