import { NextRequest } from 'next/server';
import { getServiceClient } from '@/lib/supabase';

// GET /api/ai-conversations?filter=needs_action|escalated|human_takeover|all
export async function GET(request: NextRequest) {
  const db = getServiceClient();
  const filter = request.nextUrl.searchParams.get('filter') || 'all';

  let query = db
    .from('drip_ai_conversations')
    .select('*, contact:drip_contacts(id,first_name,last_name,phone,fub_id), campaign:drip_campaigns(id,name)')
    .order('updated_at', { ascending: false })
    .limit(200);

  if (filter === 'needs_action') {
    query = query.or('needs_attention.eq.true,status.eq.escalated');
  } else if (filter === 'escalated') {
    query = query.eq('status', 'escalated');
  } else if (filter === 'human_takeover') {
    query = query.eq('status', 'human_takeover');
  } else if (filter === 'active') {
    query = query.eq('status', 'active');
  }

  const { data, error } = await query;
  if (error) return Response.json({ error: error.message }, { status: 500 });

  // Attach last message preview
  const enriched = await Promise.all(
    (data || []).map(async (conv) => {
      const { data: lastMsg } = await db
        .from('drip_messages')
        .select('body,direction,sent_at')
        .eq('enrollment_id', conv.enrollment_id)
        .order('sent_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return { ...conv, last_message: lastMsg || null };
    })
  );

  // Count needs-action total for badge
  const { count: needsActionCount } = await db
    .from('drip_ai_conversations')
    .select('id', { count: 'exact', head: true })
    .or('needs_attention.eq.true,status.eq.escalated');

  return Response.json({ conversations: enriched, needs_action_count: needsActionCount || 0 });
}
