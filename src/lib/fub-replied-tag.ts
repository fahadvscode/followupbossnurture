import type { getServiceClient } from '@/lib/supabase';
import { mergePersonTags } from '@/lib/fub';

type Db = ReturnType<typeof getServiceClient>;

/** Tag applied in Follow Up Boss when a lead sends an inbound SMS. */
export const FUB_REPLIED_TAG = 'replied';

function hasRepliedTag(tags: unknown): boolean {
  if (!Array.isArray(tags)) return false;
  return tags.some((t) => String(t).trim().toLowerCase() === FUB_REPLIED_TAG);
}

/** Merge the "replied" tag onto the FUB person and mirror it on drip_contacts. */
export async function tagLeadRepliedInFub(
  db: Db,
  contact: { id: string; fub_id: number | null; tags?: string[] | null }
): Promise<void> {
  if (!contact.fub_id) return;

  const { data: row } = await db
    .from('drip_contacts')
    .select('tags')
    .eq('id', contact.id)
    .maybeSingle();

  const existingTags = Array.isArray(row?.tags)
    ? (row.tags as string[])
    : Array.isArray(contact.tags)
      ? contact.tags
      : [];

  if (hasRepliedTag(existingTags)) return;

  await mergePersonTags(contact.fub_id, [FUB_REPLIED_TAG]);

  await db
    .from('drip_contacts')
    .update({ tags: [...existingTags, FUB_REPLIED_TAG] })
    .eq('id', contact.id);
}
