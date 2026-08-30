import { getServiceClient } from '@/lib/supabase';
import { shouldSyncFubTimeline, syncFubPersonDeep } from '@/lib/fub-person-sync';
import { autoEnrollContact, type AutoEnrollResult } from '@/lib/drip-engine';
import { existingLeadIdTags } from '@/lib/fub-lead-id';

type Db = ReturnType<typeof getServiceClient>;

function onlyLeadIdTagsAdded(previous: string[], next: string[]): boolean {
  const prevSet = new Set(previous);
  const nextSet = new Set(next);
  const added = next.filter((t) => !prevSet.has(t));
  const removed = previous.filter((t) => !nextSet.has(t));
  if (removed.length > 0 || added.length === 0) return false;
  return added.every((t) => existingLeadIdTags([t]).length > 0);
}

export type FubSyncEnrollResult = {
  contactId: string;
  enroll: AutoEnrollResult;
  tags: string[];
};

/** Skip echo peopleUpdated webhooks (our own tag PUT, drip SMS timeline, lastActivity). */
const PEOPLE_UPDATED_DEBOUNCE_MS = 120_000;

export async function wasFubPersonSyncedRecently(
  db: Db,
  personId: number,
  windowMs = PEOPLE_UPDATED_DEBOUNCE_MS
): Promise<boolean> {
  const { data } = await db
    .from('drip_contacts')
    .select('fub_last_synced_at')
    .eq('fub_id', personId)
    .maybeSingle();
  if (!data?.fub_last_synced_at) return false;
  const t = Date.parse(data.fub_last_synced_at);
  return Number.isFinite(t) && Date.now() - t < windowMs;
}

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
  const isNewContact = !beforeRow;

  const { contactId, opted_out, hasNewInquiry } = await syncFubPersonDeep(db, personId, {
    syncTimeline: shouldSyncFubTimeline(webhookEvent),
  });

  const { data: contact } = await db
    .from('drip_contacts')
    .select('tags, source_category')
    .eq('id', contactId)
    .single();

  const tags = (contact?.tags as string[]) || [];
  let enroll: AutoEnrollResult = { enrolled: [], skipped: [], unmatched: [] };

  // Lead-ID backfill / stamp fires peopleTagsCreated; do not re-run campaign matching.
  if (webhookEvent === 'peopleTagsCreated' && onlyLeadIdTagsAdded(previousTags, tags)) {
    return { contactId, enroll, tags };
  }

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
        isNewContact,
      }
    );
  }

  return { contactId, enroll, tags };
}
