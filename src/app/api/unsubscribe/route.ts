import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';
import { markContactOptedOut } from '@/lib/contact-opt-out';
import { verifyContactUnsubscribe } from '@/lib/unsubscribe';
import { pushEvent } from '@/lib/fub';

async function optOut(contactId: string, token: string): Promise<
  { ok: true } | { ok: false; status: number; error: string }
> {
  if (!contactId || !token || !verifyContactUnsubscribe(contactId, token)) {
    return { ok: false, status: 400, error: 'Invalid or expired unsubscribe link' };
  }

  const db = getServiceClient();
  const { data: contact } = await db
    .from('drip_contacts')
    .select('id, phone, first_name, last_name, fub_id, opted_out')
    .eq('id', contactId)
    .maybeSingle();

  if (!contact) {
    return { ok: false, status: 404, error: 'Contact not found' };
  }

  if (!contact.opted_out) {
    await markContactOptedOut(db, contact, 'EMAIL_UNSUBSCRIBE');
    if (contact.fub_id) {
      pushEvent(contact.fub_id, {
        type: 'Note',
        source: 'Drip Platform',
        message: `[Opt-out] ${contact.first_name || ''} ${contact.last_name || ''} clicked the email unsubscribe link — drips stopped.`,
      }).catch((e) => console.error('Failed to log unsubscribe to FUB:', e));
    }
  }

  return { ok: true };
}

/** RFC 8058 one-click unsubscribe: Gmail / Outlook POST here with no body. */
export async function POST(request: NextRequest) {
  const url = new URL(request.url);
  const contactId = url.searchParams.get('c') || '';
  const token = url.searchParams.get('t') || '';
  const result = await optOut(contactId, token);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ ok: true });
}

/** Fallback GET (in case a mail client uses it) — mirrors POST. */
export async function GET(request: NextRequest) {
  return POST(request);
}
