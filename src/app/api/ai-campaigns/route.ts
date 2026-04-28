import { NextRequest } from 'next/server';
import { getServiceClient } from '@/lib/supabase';
import type { AiCampaignConfig, DripCampaign } from '@/types';

export async function GET(request: NextRequest) {
  const db = getServiceClient();
  const id = request.nextUrl.searchParams.get('id');

  if (id) {
    const { data: campaign } = await db
      .from('drip_campaigns')
      .select('*')
      .eq('id', id)
      .eq('campaign_type', 'ai_nurture')
      .single();

    if (!campaign)
      return Response.json({ error: 'Not found' }, { status: 404 });

    const { data: config } = await db
      .from('drip_ai_campaign_config')
      .select('*')
      .eq('campaign_id', id)
      .single();

    const { data: docs } = await db
      .from('drip_ai_knowledge_docs')
      .select('*')
      .eq('campaign_id', id)
      .order('sort_order');

    const { data: media } = await db
      .from('drip_ai_media')
      .select('*')
      .eq('campaign_id', id)
      .order('sort_order');

    const { count: convCount } = await db
      .from('drip_ai_conversations')
      .select('id', { count: 'exact', head: true })
      .eq('campaign_id', id)
      .eq('status', 'active');

    const { count: enrollCount } = await db
      .from('drip_enrollments')
      .select('id', { count: 'exact', head: true })
      .eq('campaign_id', id);

    const { count: msgCount } = await db
      .from('drip_messages')
      .select('id', { count: 'exact', head: true })
      .eq('campaign_id', id)
      .eq('direction', 'outbound');

    return Response.json({
      campaign,
      config,
      docs: docs || [],
      media: media || [],
      stats: {
        active_conversations: convCount || 0,
        total_enrolled: enrollCount || 0,
        messages_sent: msgCount || 0,
      },
    });
  }

  const { data: campaigns } = await db
    .from('drip_campaigns')
    .select('*')
    .eq('campaign_type', 'ai_nurture')
    .order('created_at', { ascending: false });

  const enriched = await Promise.all(
    (campaigns || []).map(async (c: DripCampaign) => {
      const { data: config } = await db
        .from('drip_ai_campaign_config')
        .select('goal, max_exchanges')
        .eq('campaign_id', c.id)
        .single();

      const { count: convCount } = await db
        .from('drip_ai_conversations')
        .select('id', { count: 'exact', head: true })
        .eq('campaign_id', c.id)
        .eq('status', 'active');

      const { count: enrollCount } = await db
        .from('drip_enrollments')
        .select('id', { count: 'exact', head: true })
        .eq('campaign_id', c.id);

      return {
        ...c,
        ai_goal: (config as Partial<AiCampaignConfig> | null)?.goal || null,
        active_conversations: convCount || 0,
        total_enrolled: enrollCount || 0,
      };
    })
  );

  return Response.json({ campaigns: enriched });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const db = getServiceClient();

  const { data: campaign, error: campErr } = await db
    .from('drip_campaigns')
    .insert({
      name: body.name || 'Untitled AI Campaign',
      description: body.description || null,
      trigger_tags: body.trigger_tags || [],
      trigger_sources: body.trigger_sources || [],
      status: body.status || 'paused',
      campaign_type: 'ai_nurture',
      twilio_from_number: body.twilio_from_number || null,
    })
    .select('*')
    .single();

  if (campErr || !campaign)
    return Response.json({ error: campErr?.message || 'Insert failed' }, { status: 500 });

  const { error: configErr } = await db.from('drip_ai_campaign_config').insert({
    campaign_id: campaign.id,
    goal: body.goal || 'book_call',
    booking_url: body.booking_url || null,
    landing_url: body.landing_url || null,
    persona_name: body.persona_name || null,
    personality: body.personality || '',
    max_exchanges: body.max_exchanges ?? 10,
    follow_up_delay_minutes: body.follow_up_delay_minutes ?? 120,
    max_follow_ups: body.max_follow_ups ?? 3,
    escalation_action: body.escalation_action || 'both',
    escalation_fub_user_id: body.escalation_fub_user_id || null,
  });

  if (configErr)
    return Response.json({ error: configErr.message }, { status: 500 });

  return Response.json({ campaign }, { status: 201 });
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  if (!body.id) return Response.json({ error: 'id required' }, { status: 400 });

  const db = getServiceClient();

  await db
    .from('drip_campaigns')
    .update({
      name: body.name,
      description: body.description ?? null,
      trigger_tags: body.trigger_tags,
      trigger_sources: body.trigger_sources,
      status: body.status,
      twilio_from_number: body.twilio_from_number ?? null,
    })
    .eq('id', body.id);

  await db
    .from('drip_ai_campaign_config')
    .update({
      goal: body.goal,
      booking_url: body.booking_url ?? null,
      landing_url: body.landing_url ?? null,
      persona_name: body.persona_name ?? null,
      personality: body.personality,
      max_exchanges: body.max_exchanges,
      follow_up_delay_minutes: body.follow_up_delay_minutes,
      max_follow_ups: body.max_follow_ups,
      escalation_action: body.escalation_action,
      escalation_fub_user_id: body.escalation_fub_user_id ?? null,
    })
    .eq('campaign_id', body.id);

  return Response.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const { id } = await request.json();
  if (!id) return Response.json({ error: 'id required' }, { status: 400 });

  const db = getServiceClient();
  await db.from('drip_campaigns').delete().eq('id', id);

  return Response.json({ success: true });
}
