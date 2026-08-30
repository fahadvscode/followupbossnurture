import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';
import { syncFubPersonAndEnroll, wasFubPersonSyncedRecently, type FubSyncEnrollResult } from '@/lib/fub-sync-and-enroll';
import type { AutoEnrollResult } from '@/lib/drip-engine';
import { resolveFubWebhookPersonIds } from '@/lib/fub-webhook';
import { processCallAutoSmsForWebhook } from '@/lib/fub-call-auto-sms';

/** Zapier often adds tags after FUB fires peopleCreated; brief wait lets tags land. */
const PEOPLE_CREATED_TAG_SETTLE_MS = 4500;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const db = getServiceClient();
  const webhookEvent = typeof body.event === 'string' ? body.event : undefined;

  // Inbound call auto-SMS (resourceIds are call IDs, not people).
  if (webhookEvent === 'callsCreated' || webhookEvent === 'callsUpdated') {
    try {
      const { results } = await processCallAutoSmsForWebhook(body);
      return NextResponse.json({ ok: true, event: webhookEvent, callAutoSms: results });
    } catch (error) {
      console.error('FUB call auto-SMS webhook error:', error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Failed' },
        { status: 500 }
      );
    }
  }

  if (webhookEvent === 'peopleCreated') {
    await sleep(PEOPLE_CREATED_TAG_SETTLE_MS);
  }

  const personIds = await resolveFubWebhookPersonIds(body);

  if (personIds.length === 0) {
    return NextResponse.json({ error: 'No person ID' }, { status: 400 });
  }

  try {
    const contactIds: string[] = [];
    const errors: string[] = [];
    const enrollments: AutoEnrollResult[] = [];
    const syncedTags: string[][] = [];

    for (const personId of personIds) {
      try {
        if (webhookEvent === 'peopleUpdated' && (await wasFubPersonSyncedRecently(db, personId))) {
          continue;
        }
        const { contactId, enroll, tags }: FubSyncEnrollResult = await syncFubPersonAndEnroll(
          db,
          personId,
          webhookEvent
        );
        contactIds.push(contactId);
        enrollments.push(enroll);
        syncedTags.push(tags);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Sync failed';
        console.error(`FUB webhook person ${personId}:`, err);
        errors.push(`${personId}: ${msg}`);
      }
    }

    const skippedRecent = personIds.length - contactIds.length - errors.length;

    if (contactIds.length === 0 && errors.length === 0) {
      return NextResponse.json({
        ok: true,
        event: webhookEvent,
        skipped: skippedRecent,
        reason: 'recently_synced',
      });
    }

    if (contactIds.length > 0) {
      await db.from('drip_sync_log').insert({
        sync_type: 'webhook',
        status: errors.length === personIds.length ? 'failed' : 'completed',
        contacts_synced: contactIds.length,
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      });
    }

    if (contactIds.length === 0) {
      return NextResponse.json(
        { error: errors.join('; ') || 'All person syncs failed' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      event: webhookEvent,
      contactIds,
      tags: syncedTags,
      enrollments,
      ...(skippedRecent > 0 ? { skipped: skippedRecent } : {}),
      ...(errors.length ? { partialErrors: errors } : {}),
    });
  } catch (error) {
    console.error('FUB webhook error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed' },
      { status: 500 }
    );
  }
}
