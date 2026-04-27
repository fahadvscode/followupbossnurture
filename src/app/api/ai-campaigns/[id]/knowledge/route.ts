import { NextRequest } from 'next/server';
import { getServiceClient } from '@/lib/supabase';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getServiceClient();
  const { data } = await db
    .from('drip_ai_knowledge_docs')
    .select('*')
    .eq('campaign_id', id)
    .order('sort_order');

  return Response.json({ docs: data || [] });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const db = getServiceClient();

  const { data, error } = await db
    .from('drip_ai_knowledge_docs')
    .insert({
      campaign_id: id,
      doc_type: body.doc_type || 'text',
      title: body.title || 'Untitled',
      content_text: body.content_text || '',
      file_url: body.file_url || null,
      file_name: body.file_name || null,
      file_size: body.file_size || null,
      mime_type: body.mime_type || null,
      extracted_text: body.extracted_text || null,
      sort_order: body.sort_order ?? 0,
    })
    .select('*')
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ doc: data }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const { doc_id } = await request.json();
  if (!doc_id) return Response.json({ error: 'doc_id required' }, { status: 400 });

  const db = getServiceClient();
  await db.from('drip_ai_knowledge_docs').delete().eq('id', doc_id);

  return Response.json({ success: true });
}
