import { getServiceClient } from '@/lib/supabase';
import { AiNurtureCampaignsClient } from '@/components/ai-nurture/AiNurtureCampaignsClient';
import type { AiCampaignConfig, DripCampaign } from '@/types';
import type { AiCampaignListRow } from '@/components/ai-nurture/AiNurtureCampaignsClient';

export const dynamic = 'force-dynamic';

export default async function AiNurturePage() {
  const db = getServiceClient();

  const { data: campaigns } = await db
    .from('drip_campaigns')
    .select('*')
    .eq('campaign_type', 'ai_nurture')
    .order('created_at', { ascending: false });

  const enriched: AiCampaignListRow[] = await Promise.all(
    (campaigns || []).map(async (c: DripCampaign) => {
      const { data: config } = await db
        .from('drip_ai_campaign_config')
        .select('goal')
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
        id: c.id,
        name: c.name,
        status: c.status,
        folder_id: c.folder_id ?? null,
        ai_goal: (config as Partial<AiCampaignConfig> | null)?.goal || null,
        active_conversations: convCount || 0,
        total_enrolled: enrollCount || 0,
      };
    })
  );

  return <AiNurtureCampaignsClient initialCampaigns={enriched} />;
}
