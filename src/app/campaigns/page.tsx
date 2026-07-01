import { getServiceClient } from '@/lib/supabase';
import { CampaignsClient } from '@/components/campaigns/CampaignsClient';
import { formatDripStepDayLabel } from '@/lib/utils';
import type { DripCampaign } from '@/types';

export const dynamic = 'force-dynamic';

type StepRow = {
  campaign_id: string;
  step_number: number;
  delay_days: number;
  delay_hours: number;
  delay_minutes: number | null;
};

export default async function CampaignsPage() {
  const db = getServiceClient();

  const { data: campaigns } = await db
    .from('drip_campaigns')
    .select('*')
    .order('created_at', { ascending: false });

  const campaignIds = (campaigns || []).map((c: DripCampaign) => c.id);
  let stepsByCampaign = new Map<string, StepRow[]>();
  if (campaignIds.length > 0) {
    const { data: allSteps } = await db
      .from('drip_campaign_steps')
      .select('campaign_id, step_number, delay_days, delay_hours, delay_minutes')
      .in('campaign_id', campaignIds);

    for (const row of (allSteps || []) as StepRow[]) {
      const list = stepsByCampaign.get(row.campaign_id) || [];
      list.push(row);
      stepsByCampaign.set(row.campaign_id, list);
    }
    for (const list of stepsByCampaign.values()) {
      list.sort((a, b) => a.step_number - b.step_number);
    }
  }

  const dayLabelsByCampaign: Record<string, string[]> = {};
  for (const [cid, steps] of stepsByCampaign) {
    dayLabelsByCampaign[cid] = steps.map((s) =>
      formatDripStepDayLabel({
        delay_days: s.delay_days,
        delay_hours: s.delay_hours,
        delay_minutes: s.delay_minutes ?? 0,
      })
    );
  }

  const campaignStats = await Promise.all(
    (campaigns || []).map(async (campaign: DripCampaign) => {
      const [enrolled, active, sent, replies] = await Promise.all([
        db.from('drip_enrollments').select('id', { count: 'exact', head: true }).eq('campaign_id', campaign.id),
        db.from('drip_enrollments').select('id', { count: 'exact', head: true }).eq('campaign_id', campaign.id).eq('status', 'active'),
        db.from('drip_messages').select('id', { count: 'exact', head: true }).eq('campaign_id', campaign.id).eq('direction', 'outbound'),
        db.from('drip_messages').select('id', { count: 'exact', head: true }).eq('campaign_id', campaign.id).eq('direction', 'inbound'),
      ]);

      return {
        campaignId: campaign.id,
        enrolled: enrolled.count || 0,
        active: active.count || 0,
        messages_sent: sent.count || 0,
        replies: replies.count || 0,
      };
    })
  );

  const statsMap = Object.fromEntries(campaignStats.map((s) => [s.campaignId, s]));

  return (
    <CampaignsClient
      initialCampaigns={(campaigns as DripCampaign[]) || []}
      statsMap={statsMap}
      dayLabelsByCampaign={dayLabelsByCampaign}
    />
  );
}
