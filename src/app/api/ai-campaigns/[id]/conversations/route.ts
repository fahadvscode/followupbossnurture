import { NextRequest } from 'next/server';
import { getServiceClient } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getServiceClient();

  const status = request.nextUrl.searchParams.get('status');
  const contactId = request.nextUrl.searchParams.get('contact_id');

  if (contactId) {
    const { data: messages } = await db
      .from('drip_messages')
      .select('*')
      .eq('campaign_id', id)
      .eq('contact_id', contactId)
      .order('created_at', { ascending: true });

    const { data: conv } = await db
      .from('drip_ai_conversations')
      .select('*')
      .eq('campaign_id', id)
      .eq('contact_id', contactId)
      .single();

    return Response.json({ messages: messages || [], conversation: conv });
  }

  let query = db
    .from('drip_ai_conversations')
    .select('*, contact:drip_contacts(*)')
    .eq('campaign_id', id)
    .order('updated_at', { ascending: false });

  if (status) query = query.eq('status', status);

  const { data } = await query;

  return Response.json({ conversations: data || [] });
}
