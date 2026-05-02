import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';

function copyLabel(name: string): string {
  const t = name.trim();
  return t.endsWith(' (copy)') ? `${t} 2` : `${t} (copy)`;
}

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const db = getServiceClient();

  const { data: src, error: fetchErr } = await db
    .from('drip_message_templates')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchErr || !src) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  let customName: string | null = null;
  try {
    const body = await request.json().catch(() => null);
    if (body && typeof body === 'object' && typeof (body as { name?: string }).name === 'string') {
      const n = (body as { name: string }).name.trim();
      if (n) customName = n;
    }
  } catch {
    /* ignore */
  }

  const name = customName || copyLabel(src.name);

  const { data, error } = await db
    .from('drip_message_templates')
    .insert({
      name,
      channel: src.channel,
      email_subject: src.email_subject ?? '',
      body_plain: src.body_plain ?? '',
      body_html: src.body_html,
      folder_id: src.folder_id,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}
