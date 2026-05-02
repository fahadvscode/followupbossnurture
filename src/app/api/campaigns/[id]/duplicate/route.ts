import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';

function copyCampaignName(name: string): string {
  const t = name.trim();
  return t.endsWith(' (copy)') ? `${t} 2` : `${t} (copy)`;
}

export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const db = getServiceClient();

  const { data: src, error: cErr } = await db.from('drip_campaigns').select('*').eq('id', id).single();
  if (cErr || !src) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  }

  const { id: _srcId, created_at: _ca, updated_at: _ua, name: srcName, ...campaignRest } = src as Record<
    string,
    unknown
  >;

  const { data: newCamp, error: insErr } = await db
    .from('drip_campaigns')
    .insert({
      ...campaignRest,
      name: copyCampaignName(String(srcName || 'Campaign')),
      status: 'paused',
    })
    .select()
    .single();

  if (insErr || !newCamp) {
    return NextResponse.json({ error: insErr?.message || 'Insert failed' }, { status: 500 });
  }

  if (src.campaign_type === 'ai_nurture') {
    const { data: cfg } = await db.from('drip_ai_campaign_config').select('*').eq('campaign_id', id).single();
    if (cfg) {
      const {
        id: _id,
        campaign_id: _cid,
        created_at: _ca,
        updated_at: _ua,
        ...cfgRest
      } = cfg as Record<string, unknown>;
      const { error: cfgErr } = await db
        .from('drip_ai_campaign_config')
        .insert({ ...cfgRest, campaign_id: newCamp.id });
      if (cfgErr) {
        await db.from('drip_campaigns').delete().eq('id', newCamp.id);
        return NextResponse.json({ error: cfgErr.message }, { status: 500 });
      }
    }

    const { data: docs } = await db.from('drip_ai_knowledge_docs').select('*').eq('campaign_id', id);
    if (docs?.length) {
      const docRows = docs.map((d) => {
        const { id: did, campaign_id: _c, created_at: _c2, ...rest } = d as Record<string, unknown>;
        void did;
        return { ...rest, campaign_id: newCamp.id };
      });
      const { error: docErr } = await db.from('drip_ai_knowledge_docs').insert(docRows);
      if (docErr) {
        await db.from('drip_campaigns').delete().eq('id', newCamp.id);
        return NextResponse.json({ error: docErr.message }, { status: 500 });
      }
    }

    const { data: media } = await db.from('drip_ai_media').select('*').eq('campaign_id', id);
    if (media?.length) {
      const mediaRows = media.map((m) => {
        const { id: mid, campaign_id: _c, created_at: _c2, ...rest } = m as Record<string, unknown>;
        void mid;
        return { ...rest, campaign_id: newCamp.id };
      });
      const { error: mediaErr } = await db.from('drip_ai_media').insert(mediaRows);
      if (mediaErr) {
        await db.from('drip_campaigns').delete().eq('id', newCamp.id);
        return NextResponse.json({ error: mediaErr.message }, { status: 500 });
      }
    }

    return NextResponse.json({ campaign: newCamp });
  }

  const { data: steps } = await db.from('drip_campaign_steps').select('*').eq('campaign_id', id);
  if (steps?.length) {
    const stepRows = steps.map((s) => {
      const { id: sid, campaign_id: _c, created_at: _c2, ...rest } = s as Record<string, unknown>;
      void sid;
      return { ...rest, campaign_id: newCamp.id };
    });
    const { error: stepErr } = await db.from('drip_campaign_steps').insert(stepRows);
    if (stepErr) {
      await db.from('drip_campaigns').delete().eq('id', newCamp.id);
      return NextResponse.json({ error: stepErr.message }, { status: 500 });
    }
  }

  return NextResponse.json({ campaign: newCamp });
}
