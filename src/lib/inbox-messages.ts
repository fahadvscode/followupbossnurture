import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchAllPages } from '@/lib/supabase-fetch-all';
import { isSmsMessage } from '@/lib/delivery-error-meta';
import type { DripMessage } from '@/types';

export type MessageAttributionRow = {
  contact_id: string;
  campaign_id: string | null;
  enrollment_id: string | null;
};

/** Map enrollment + contact fallbacks so orphan SMS rows still land in a thread. */
export async function buildMessageCampaignResolver(
  db: SupabaseClient,
  messages: MessageAttributionRow[]
): Promise<(msg: MessageAttributionRow) => string | null> {
  const enrollmentIds = [
    ...new Set(messages.map((m) => m.enrollment_id).filter(Boolean) as string[]),
  ];

  const enrollmentCampaign = new Map<string, string>();
  if (enrollmentIds.length > 0) {
    for (let i = 0; i < enrollmentIds.length; i += 200) {
      const chunk = enrollmentIds.slice(i, i + 200);
      const { data: enrollments } = await db
        .from('drip_enrollments')
        .select('id,campaign_id')
        .in('id', chunk);
      for (const e of enrollments || []) {
        if (e.campaign_id) enrollmentCampaign.set(e.id as string, e.campaign_id as string);
      }
    }
  }

  const orphanContactIds = new Set<string>();
  for (const msg of messages) {
    if (!msg.contact_id) continue;
    const resolved =
      msg.campaign_id ||
      (msg.enrollment_id ? enrollmentCampaign.get(msg.enrollment_id) : null);
    if (!resolved) orphanContactIds.add(msg.contact_id);
  }

  const contactLatestCampaign = new Map<string, string>();
  if (orphanContactIds.size > 0) {
    const ids = [...orphanContactIds];
    for (let i = 0; i < ids.length; i += 200) {
      const chunk = ids.slice(i, i + 200);
      const { data: enrollments } = await db
        .from('drip_enrollments')
        .select('contact_id,campaign_id,enrolled_at')
        .in('contact_id', chunk)
        .neq('status', 'opted_out')
        .order('enrolled_at', { ascending: false });
      for (const e of enrollments || []) {
        const cid = e.contact_id as string;
        if (!contactLatestCampaign.has(cid) && e.campaign_id) {
          contactLatestCampaign.set(cid, e.campaign_id as string);
        }
      }
    }
  }

  return (msg) =>
    msg.campaign_id ||
    (msg.enrollment_id ? enrollmentCampaign.get(msg.enrollment_id) : null) ||
    contactLatestCampaign.get(msg.contact_id) ||
    null;
}

/** Latest enrollment for attributing inbound SMS when no active enrollment exists. */
export async function findAttributionEnrollment(
  db: SupabaseClient,
  contactId: string
): Promise<{ id: string; campaign_id: string; current_step: number | null } | null> {
  const { data } = await db
    .from('drip_enrollments')
    .select('id,campaign_id,current_step')
    .eq('contact_id', contactId)
    .neq('status', 'opted_out')
    .order('enrolled_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data?.campaign_id) return null;
  return {
    id: data.id as string,
    campaign_id: data.campaign_id as string,
    current_step: (data.current_step as number | null) ?? null,
  };
}

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

  let orphanInbound: DripMessage[] = [];
  if (enrollmentIds.length > 0) {
    orphanInbound = await fetchAllPages<DripMessage>((range) =>
      db
        .from('drip_messages')
        .select('*')
        .eq('contact_id', contactId)
        .eq('direction', 'inbound')
        .is('campaign_id', null)
        .is('enrollment_id', null)
        .order('created_at', { ascending: true })
        .range(range.from, range.to)
    );
  }

  const seen = new Set<string>();
  const merged: DripMessage[] = [];
  for (const row of [...byCampaign, ...byEnrollment, ...orphanInbound]) {
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
