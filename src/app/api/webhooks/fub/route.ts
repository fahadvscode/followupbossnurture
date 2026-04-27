import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';
import { syncFubPersonDeep } from '@/lib/fub-person-sync';
import { autoEnrollContact } from '@/lib/drip-engine';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const db = getServiceClient();

  const rawId = body.person?.id ?? body.personId;
  const personId =
    typeof rawId === 'number'
      ? rawId
      : typeof rawId === 'string'
        ? parseInt(rawId, 10)
        : NaN;

  if (!Number.isFinite(personId)) {
    return NextResponse.json({ error: 'No person ID' }, { status: 400 });
  }

  try {
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

    await db.from('drip_sync_log').insert({
      sync_type: 'webhook',
      status: 'completed',
      contacts_synced: 1,
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true, contactId });
  } catch (error) {
    console.error('FUB webhook error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed' },
      { status: 500 }
    );
  }
}
