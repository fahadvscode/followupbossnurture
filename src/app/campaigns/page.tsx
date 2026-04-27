import { getServiceClient } from '@/lib/supabase';
import { CampaignCard } from '@/components/campaigns/CampaignCard';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { formatDripStepDayLabel } from '@/lib/utils';
import { MessageSquare, Plus } from 'lucide-react';
import Link from 'next/link';
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

  const dayLabelsByCampaign = new Map<string, string[]>();
  for (const [cid, steps] of stepsByCampaign) {
    dayLabelsByCampaign.set(
      cid,
      steps.map((s) =>
        formatDripStepDayLabel({
          delay_days: s.delay_days,
          delay_hours: s.delay_hours,
          delay_minutes: s.delay_minutes ?? 0,
        })
      )
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

  const statsMap = Object.fromEntries(campaignStats.map(s => [s.campaignId, s]));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Campaigns</h1>
          <p className="text-sm text-muted mt-1">{(campaigns || []).length} drip campaigns</p>
        </div>
        <Link href="/campaigns/new">
          <Button>
            <Plus size={14} className="mr-2" /> New Campaign
          </Button>
        </Link>
      </div>

      {(campaigns || []).length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="No campaigns yet"
          description="Create your first SMS drip campaign to start engaging leads automatically."
          action={
            <Link href="/campaigns/new">
              <Button>Create Campaign</Button>
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(campaigns as DripCampaign[]).map((campaign) => (
            <CampaignCard
              key={campaign.id}
              campaign={campaign}
              stats={statsMap[campaign.id] || { enrolled: 0, active: 0, messages_sent: 0, replies: 0 }}
              stepDayLabels={dayLabelsByCampaign.get(campaign.id) || []}
            />
          ))}
        </div>
      )}
    </div>
  );
}
