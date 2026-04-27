import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';
import { getPeople } from '@/lib/fub';
import { autoEnrollContact } from '@/lib/drip-engine';
import { buildDripContactFieldsFromFub } from '@/lib/fub-contact-from-person';
import type { FUBPerson } from '@/types';

export async function POST(request: NextRequest) {
  const db = getServiceClient();

  const { data: syncLog } = await db
    .from('drip_sync_log')
    .insert({
      sync_type: 'full',
      status: 'running',
      contacts_synced: 0,
      started_at: new Date().toISOString(),
    })
    .select()
    .single();

  try {
    let offset = 0;
    const limit = 100;
    let totalSynced = 0;
    let hasMore = true;

    while (hasMore) {
      const result = await getPeople({ limit, offset, fields: 'allFields' });
      const people = result.people || [];

      if (people.length === 0) {
        hasMore = false;
        break;
      }

      for (const person of people) {
        await upsertContact(db, person);
        totalSynced++;
      }

      offset += limit;
      if (people.length < limit) hasMore = false;
    }

    if (syncLog) {
      await db
        .from('drip_sync_log')
        .update({
          status: 'completed',
          contacts_synced: totalSynced,
          completed_at: new Date().toISOString(),
        })
        .eq('id', syncLog.id);
    }

    const redirectUrl = new URL('/contacts?synced=1', request.url);
    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    if (syncLog) {
      await db
        .from('drip_sync_log')
        .update({
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
          completed_at: new Date().toISOString(),
        })
        .eq('id', syncLog.id);
    }

    const failUrl = new URL(
      `/contacts?sync_error=${encodeURIComponent(error instanceof Error ? error.message : 'Sync failed')}`,
      request.url
    );
    return NextResponse.redirect(failUrl);
  }
}

async function upsertContact(db: ReturnType<typeof getServiceClient>, person: FUBPerson) {
  const contactData = buildDripContactFieldsFromFub(person as unknown as Record<string, unknown>, {
    fullSnapshot: true,
  });
  const tags = (contactData.tags as string[]) || [];

  const { data: existing } = await db
    .from('drip_contacts')
    .select('id')
    .eq('fub_id', person.id)
    .maybeSingle();

  let contactId: string | undefined;

  if (existing?.id) {
    await db.from('drip_contacts').update(contactData).eq('fub_id', person.id);
    contactId = existing.id;
  } else {
    const { data: inserted } = await db
      .from('drip_contacts')
      .insert(contactData)
      .select('id')
      .single();

    contactId = inserted?.id;
  }

  if (contactId) {
    await autoEnrollContact(contactId, tags, contactData.source_category as string);
  }
}
