import { NextRequest } from 'next/server';
import { getServiceClient } from '@/lib/supabase';
import { ensureAiConversation } from '@/lib/ai-engine';
import { loadContactCampaignSmsMessages } from '@/lib/inbox-messages';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getServiceClient();

  const status = request.nextUrl.searchParams.get('status');
  const contactId = request.nextUrl.searchParams.get('contact_id');

  if (contactId) {
    const messages = await loadContactCampaignSmsMessages(db, contactId, id);

    let conv = null;
    const { data: existing } = await db
      .from('drip_ai_conversations')
      .select('*')
      .eq('campaign_id', id)
      .eq('contact_id', contactId)
      .maybeSingle();

    if (existing) {
      conv = existing;
    } else {
      const { data: campaign } = await db
        .from('drip_campaigns')
        .select('campaign_type')
        .eq('id', id)
        .maybeSingle();

      if (campaign?.campaign_type === 'ai_nurture') {
        const { data: enrollment } = await db
          .from('drip_enrollments')
          .select('id')
          .eq('contact_id', contactId)
          .eq('campaign_id', id)
          .order('enrolled_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (enrollment) {
          conv = await ensureAiConversation(enrollment.id, contactId, id);
        }
      }
    }

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
