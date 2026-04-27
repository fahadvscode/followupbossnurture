import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';
import { syncFubPersonDeep } from '@/lib/fub-person-sync';
import { autoEnrollContact } from '@/lib/drip-engine';
import { isFubApiConfigured, searchPeopleByEmail } from '@/lib/fub';

function syncPersonErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object') {
    const o = error as Record<string, unknown>;
    const msg = typeof o.message === 'string' ? o.message : '';
    const details = typeof o.details === 'string' ? o.details : '';
    const hint = typeof o.hint === 'string' ? o.hint : '';
    const code = typeof o.code === 'string' ? o.code : '';
    const parts = [code, msg, details, hint].filter(Boolean);
    if (parts.length) return parts.join(' — ');
  }
  return 'Sync failed';
}

/**
 * Pull / refresh a lead from Follow Up Boss into drip_contacts (full persona sync),
 * then run the same auto-enrollment rules as the FUB webhook (trigger tags / sources).
 *
 * Body: { personId: number } or { email: string }
 */
export async function POST(request: NextRequest) {
  if (!isFubApiConfigured()) {
    return NextResponse.json({ error: 'FUB_API_KEY is not configured' }, { status: 500 });
  }

  const body = await request.json().catch(() => ({}));
  const personIdRaw = body.personId ?? body.fub_person_id ?? body.person_id;
  const email = typeof body.email === 'string' ? body.email.trim() : '';

  let fubId: number | null = null;

  if (personIdRaw != null && String(personIdRaw).trim() !== '') {
    const n = typeof personIdRaw === 'number' ? personIdRaw : parseInt(String(personIdRaw), 10);
    if (!Number.isFinite(n) || n < 1) {
      return NextResponse.json({ error: 'Invalid personId' }, { status: 400 });
    }
    fubId = n;
  } else if (email) {
    try {
      const people = await searchPeopleByEmail(email);
      if (people.length === 0) {
        return NextResponse.json(
          { error: 'No person found in Follow Up Boss with that email' },
          { status: 404 }
        );
      }
      if (people.length > 1) {
        return NextResponse.json(
          {
            error: 'Multiple people match that email; pass personId from Follow Up Boss',
            matches: people.map((p) => ({
              id: p.id,
              name: [p.firstName, (p as { lastName?: string }).lastName].filter(Boolean).join(' '),
            })),
          },
          { status: 400 }
        );
      }
      fubId = people[0].id;
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : 'Follow Up Boss lookup failed' },
        { status: 502 }
      );
    }
  } else {
    return NextResponse.json({ error: 'Provide personId or email' }, { status: 400 });
  }

  const db = getServiceClient();

  try {
    const { contactId, opted_out } = await syncFubPersonDeep(db, fubId);

    const { data: contact } = await db
      .from('drip_contacts')
      .select('tags, source_category')
      .eq('id', contactId)
      .single();

    if (!opted_out && contact) {
      await autoEnrollContact(
        contactId,
        (contact.tags as string[]) || [],
        (contact.source_category as string) || 'Other'
      );
    }

    return NextResponse.json({
      ok: true,
      contactId,
      fubPersonId: fubId,
      optedOut: opted_out,
    });
  } catch (error) {
    console.error('FUB sync-person error:', error);
    return NextResponse.json(
      { error: syncPersonErrorMessage(error) },
      { status: 500 }
    );
  }
}
