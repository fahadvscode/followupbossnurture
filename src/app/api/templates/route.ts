import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';

const MAX_BODY = 2_000_000; // ~2MB per field

function clampBody(s: unknown): string {
  const t = String(s ?? '');
  return t.length > MAX_BODY ? t.slice(0, MAX_BODY) : t;
}

function parseFolderFilter(raw: string | null): 'all' | 'unfiled' | string {
  if (!raw || raw === 'all') return 'all';
  if (raw === 'unfiled') return 'unfiled';
  return raw;
}

export async function GET(request: NextRequest) {
  const db = getServiceClient();
  const channel = request.nextUrl.searchParams.get('channel');
  const folderRaw = request.nextUrl.searchParams.get('folder_id');
  const folder = parseFolderFilter(folderRaw);

  let q = db.from('drip_message_templates').select('*').order('name');
  if (channel === 'sms' || channel === 'email') {
    q = q.eq('channel', channel);
  }
  if (folder === 'unfiled') {
    q = q.is('folder_id', null);
  } else if (folder !== 'all') {
    q = q.eq('folder_id', folder);
  }
  const { data, error } = await q;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ templates: data || [] });
}

export async function POST(request: NextRequest) {
  const db = getServiceClient();
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const name = String((body as { name?: string }).name || '').trim();
  const channel = (body as { channel?: string }).channel;
  if (!name) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }
  if (channel !== 'sms' && channel !== 'email') {
    return NextResponse.json({ error: 'channel must be sms or email' }, { status: 400 });
  }

  const email_subject = clampBody((body as { email_subject?: string }).email_subject).trim();
  const body_plain = clampBody((body as { body_plain?: string }).body_plain);
  const body_html_raw = (body as { body_html?: string | null }).body_html;
  const body_html =
    body_html_raw == null || body_html_raw === ''
      ? null
      : clampBody(body_html_raw) || null;

  let folder_id: string | null = null;
  if ('folder_id' in (body as object)) {
    const f = (body as { folder_id?: string | null }).folder_id;
    if (f != null && String(f).trim() !== '') {
      folder_id = String(f).trim();
    }
  }

  if (channel === 'sms') {
    if (!body_plain.trim()) {
      return NextResponse.json({ error: 'SMS body (body_plain) is required' }, { status: 400 });
    }
    const { data, error } = await db
      .from('drip_message_templates')
      .insert({
        name,
        channel: 'sms',
        email_subject: '',
        body_plain,
        body_html: null,
        folder_id,
      })
      .select()
      .single();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data);
  }

  if (!email_subject) {
    return NextResponse.json({ error: 'Email subject is required' }, { status: 400 });
  }
  if (!body_plain.trim() && !body_html?.trim()) {
    return NextResponse.json(
      { error: 'Provide plain body and/or HTML body for email templates' },
      { status: 400 }
    );
  }

  const { data, error } = await db
    .from('drip_message_templates')
    .insert({
      name,
      channel: 'email',
      email_subject,
      body_plain,
      body_html,
      folder_id,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}
