import { getServiceClient } from '@/lib/supabase';
import { getRecentlyUpdatedPeople, isFubApiConfigured } from '@/lib/fub';
import { syncFubPersonAndEnroll } from '@/lib/fub-sync-and-enroll';

function parseFubTime(value: unknown): number {
  if (typeof value !== 'string') return 0;
  const t = Date.parse(value);
  return Number.isFinite(t) ? t : 0;
}

/**
 * Poll FUB for recently updated leads and sync + auto-enroll.
 * Works with FUB_API_KEY only — no webhooks required.
 */
export async function syncRecentFubLeads(options: { lookbackMinutes?: number; limit?: number } = {}) {
  if (!isFubApiConfigured()) {
    return { synced: 0, enrolled: 0, skipped: 0, reason: 'fub_api_not_configured' as const };
  }

  const lookbackMinutes = Math.max(5, options.lookbackMinutes ?? 180);
  const limit = Math.min(100, Math.max(1, options.limit ?? 40));
  const cutoffMs = Date.now() - lookbackMinutes * 60 * 1000;

  const db = getServiceClient();
  const people = await getRecentlyUpdatedPeople(limit);
  let synced = 0;
  let enrolled = 0;
  let skipped = 0;

  for (const person of people) {
    const fubId = person.id;
    if (!Number.isFinite(fubId) || fubId < 1) continue;

    const fubUpdatedMs = parseFubTime(person.updated);
    const fubCreatedMs = parseFubTime(person.created);
    const activityMs = Math.max(fubUpdatedMs, fubCreatedMs);
    if (activityMs > 0 && activityMs < cutoffMs) break;

    const { data: existing } = await db
      .from('drip_contacts')
      .select('fub_updated_at, fub_last_synced_at')
      .eq('fub_id', fubId)
      .maybeSingle();

    const storedUpdatedMs = parseFubTime(existing?.fub_updated_at);
    const needsSync =
      !existing ||
      !existing.fub_last_synced_at ||
      (fubUpdatedMs > 0 && fubUpdatedMs > storedUpdatedMs);

    if (!needsSync) {
      skipped++;
      continue;
    }

    try {
      const { enroll } = await syncFubPersonAndEnroll(db, fubId, 'peopleUpdated');
      synced++;
      enrolled += enroll.enrolled.length;
    } catch (err) {
      console.error(`Recent FUB sync failed for person ${fubId}:`, err);
    }
  }

  if (synced > 0) {
    await db.from('drip_sync_log').insert({
      sync_type: 'manual',
      status: 'completed',
      contacts_synced: synced,
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    });
  }

  return { synced, enrolled, skipped, reason: 'ok' as const };
}
