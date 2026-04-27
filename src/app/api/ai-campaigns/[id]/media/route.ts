import { NextRequest } from 'next/server';
import { getServiceClient } from '@/lib/supabase';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getServiceClient();
  const { data } = await db
    .from('drip_ai_media')
    .select('*')
    .eq('campaign_id', id)
    .order('sort_order');

  return Response.json({ media: data || [] });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const db = getServiceClient();

  const { data, error } = await db
    .from('drip_ai_media')
    .insert({
      campaign_id: id,
      title: body.title || 'Untitled',
      media_url: body.media_url,
      mime_type: body.mime_type || null,
      send_with: body.send_with || 'any',
      sort_order: body.sort_order ?? 0,
    })
    .select('*')
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ media: data }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const { media_id } = await request.json();
  if (!media_id) return Response.json({ error: 'media_id required' }, { status: 400 });

  const db = getServiceClient();
  await db.from('drip_ai_media').delete().eq('id', media_id);

  return Response.json({ success: true });
}
