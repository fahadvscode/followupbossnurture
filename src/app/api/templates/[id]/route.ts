import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';

const MAX_BODY = 2_000_000;

function clampBody(s: unknown): string {
  const t = String(s ?? '');
  return t.length > MAX_BODY ? t.slice(0, MAX_BODY) : t;
}

export async function GET(
  _request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const db = getServiceClient();
  const { data, error } = await db.from('drip_message_templates').select('*').eq('id', id).single();
  if (error || !data) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json(data);
}

export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const db = getServiceClient();
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if ('name' in body) updates.name = String((body as { name?: string }).name || '').trim();
  if ('email_subject' in body) {
    updates.email_subject = clampBody((body as { email_subject?: string }).email_subject).trim();
  }
  if ('body_plain' in body) updates.body_plain = clampBody((body as { body_plain?: string }).body_plain);
  if ('body_html' in body) {
    const raw = (body as { body_html?: string | null }).body_html;
    updates.body_html =
      raw == null || raw === '' ? null : clampBody(raw) || null;
  }
  if ('folder_id' in body) {
    const f = (body as { folder_id?: string | null }).folder_id;
    if (f === null || f === undefined || String(f).trim() === '') {
      updates.folder_id = null;
    } else {
      updates.folder_id = String(f).trim();
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  const { data, error } = await db
    .from('drip_message_templates')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json(data);
}

export async function DELETE(
  _request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const db = getServiceClient();
  const { error } = await db.from('drip_message_templates').delete().eq('id', id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
