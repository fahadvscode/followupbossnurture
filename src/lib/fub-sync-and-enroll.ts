import { getServiceClient } from '@/lib/supabase';
import { syncFubPersonDeep } from '@/lib/fub-person-sync';
import { autoEnrollContact, type AutoEnrollResult } from '@/lib/drip-engine';

type Db = ReturnType<typeof getServiceClient>;

export type FubSyncEnrollResult = {
  contactId: string;
  enroll: AutoEnrollResult;
  tags: string[];
};

/** Full FUB sync + campaign auto-enrollment (webhook, cron, manual). */
export async function syncFubPersonAndEnroll(
  db: Db,
  personId: number,
  webhookEvent?: string
): Promise<FubSyncEnrollResult> {
  const { data: beforeRow } = await db
    .from('drip_contacts')
    .select('tags, source_category')
    .eq('fub_id', personId)
    .maybeSingle();

  const previousTags = (beforeRow?.tags as string[]) || [];
  const previousSourceCategory = (beforeRow?.source_category as string) || '';

  const { contactId, opted_out, hasNewInquiry } = await syncFubPersonDeep(db, personId);

  const { data: contact } = await db
    .from('drip_contacts')
    .select('tags, source_category')
    .eq('id', contactId)
    .single();

  const tags = (contact?.tags as string[]) || [];
  let enroll: AutoEnrollResult = { enrolled: [], skipped: [], unmatched: [] };

  if (!opted_out && contact) {
    enroll = await autoEnrollContact(
      contactId,
      tags,
      (contact.source_category as string) || 'Other',
      {
        previousTags,
        previousSourceCategory,
        webhookEvent,
        hasNewInquiry,
      }
    );
  }

  return { contactId, enroll, tags };
}
