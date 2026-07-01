import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';
import { syncFubPersonDeep } from '@/lib/fub-person-sync';
import { autoEnrollContact } from '@/lib/drip-engine';
import { extractFubWebhookPersonIds } from '@/lib/fub-webhook';

async function processFubPerson(db: ReturnType<typeof getServiceClient>, personId: number) {
  const { contactId, opted_out } = await syncFubPersonDeep(db, personId);

  const { data: contact } = await db
    .from('drip_contacts')
    .select('tags, source_category')
    .eq('id', contactId)
    .single();

  if (!opted_out && contact) {
    await autoEnrollContact(
      contactId,
      (contact.tags as string[]) || [],
      contact.source_category as string
    );
  }

  return contactId;
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const db = getServiceClient();

  const personIds = extractFubWebhookPersonIds(body);

  if (personIds.length === 0) {
    return NextResponse.json({ error: 'No person ID' }, { status: 400 });
  }

  try {
    const contactIds: string[] = [];
    const errors: string[] = [];

    for (const personId of personIds) {
      try {
        contactIds.push(await processFubPerson(db, personId));
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Sync failed';
        console.error(`FUB webhook person ${personId}:`, err);
        errors.push(`${personId}: ${msg}`);
      }
    }

    await db.from('drip_sync_log').insert({
      sync_type: 'webhook',
      status: errors.length === personIds.length ? 'failed' : 'completed',
      contacts_synced: contactIds.length,
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    });

    if (contactIds.length === 0) {
      return NextResponse.json(
        { error: errors.join('; ') || 'All person syncs failed' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      contactIds,
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
