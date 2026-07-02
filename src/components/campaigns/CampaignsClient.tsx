'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { CampaignCard } from '@/components/campaigns/CampaignCard';
import { CampaignFolderSelect } from '@/components/campaigns/CampaignFolderSelect';
import { CampaignFoldersSidebar } from '@/components/campaigns/CampaignFoldersSidebar';
import { DeleteCampaignButton } from '@/components/campaigns/DeleteCampaignButton';
import { useCampaignFolders } from '@/hooks/useCampaignFolders';
import type { DripCampaign } from '@/types';
import { MessageSquare, Plus } from 'lucide-react';

type CampaignStats = {
  enrolled: number;
  active: number;
  messages_sent: number;
  replies: number;
};

type Props = {
  initialCampaigns: DripCampaign[];
  statsMap: Record<string, CampaignStats>;
  dayLabelsByCampaign: Record<string, string[]>;
  /** When set, only show campaigns of this type (e.g. standard vs ai_nurture). */
  campaignTypeFilter?: 'standard' | 'ai_nurture' | null;
  title?: string;
  newCampaignHref?: string;
};

export function CampaignsClient({
  initialCampaigns,
  statsMap,
  dayLabelsByCampaign,
  campaignTypeFilter = null,
  title = 'Campaigns',
  newCampaignHref = '/campaigns/new',
}: Props) {
  const [campaigns, setCampaigns] = useState(initialCampaigns);
  const folders = useCampaignFolders();

  const visibleCampaigns = useMemo(() => {
    if (!campaignTypeFilter) {
      return campaigns.filter((c) => c.campaign_type !== 'ai_nurture');
    }
    return campaigns.filter((c) => c.campaign_type === campaignTypeFilter);
  }, [campaigns, campaignTypeFilter]);

  const filteredCampaigns = useMemo(() => {
    if (folders.folderScope === 'all') return visibleCampaigns;
    if (folders.folderScope === 'unfiled') return visibleCampaigns.filter((c) => !c.folder_id);
    return visibleCampaigns.filter((c) => c.folder_id === folders.folderScope);
  }, [visibleCampaigns, folders.folderScope]);

  async function handleMove(campaignId: string, folderId: string) {
    const ok = await folders.moveCampaignToFolder(campaignId, folderId);
    if (ok) {
      setCampaigns((prev) =>
        prev.map((c) =>
          c.id === campaignId ? { ...c, folder_id: folderId === '' ? null : folderId } : c
        )
      );
    }
  }

  function handleFolderDeleted(folderId: string) {
    setCampaigns((prev) =>
      prev.map((c) => (c.folder_id === folderId ? { ...c, folder_id: null } : c))
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{title}</h1>
          <p className="text-sm text-muted mt-1">
            {filteredCampaigns.length} of {visibleCampaigns.length} campaigns
            {folders.folderScope !== 'all' ? ` · ${folders.scopeLabel}` : ''}
          </p>
        </div>
        <Link href={newCampaignHref}>
          <Button>
            <Plus size={14} className="mr-2" /> New Campaign
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,13rem)_minmax(0,1fr)] gap-4 lg:gap-6">
        <CampaignFoldersSidebar folders={folders} onDeleteFolder={handleFolderDeleted} />

        <div>
          {filteredCampaigns.length === 0 ? (
            <EmptyState
              icon={MessageSquare}
              title={visibleCampaigns.length === 0 ? 'No campaigns yet' : 'No campaigns in this folder'}
              description={
                visibleCampaigns.length === 0
                  ? 'Create your first campaign from a template or start from scratch.'
                  : 'Use the folder dropdown on each card to move campaigns here.'
              }
              action={
                <Link href={newCampaignHref}>
                  <Button>Create Campaign</Button>
                </Link>
              }
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredCampaigns.map((campaign) => (
                <div key={campaign.id} className="space-y-2">
                  <div className="flex items-center justify-end gap-1 px-1">
                    <CampaignFolderSelect
                      campaignId={campaign.id}
                      campaignName={campaign.name}
                      folderId={campaign.folder_id}
                      folders={folders.folders}
                      disabled={folders.movingCampaignId === campaign.id}
                      onMove={handleMove}
                      className="justify-end"
                    />
                    <DeleteCampaignButton
                      campaignId={campaign.id}
                      campaignName={campaign.name}
                      campaignType={campaign.campaign_type === 'ai_nurture' ? 'ai_nurture' : 'standard'}
                      variant="icon"
                      onDeleted={() => setCampaigns((prev) => prev.filter((c) => c.id !== campaign.id))}
                    />
                  </div>
                  <CampaignCard
                    campaign={campaign}
                    stats={statsMap[campaign.id] || { enrolled: 0, active: 0, messages_sent: 0, replies: 0 }}
                    stepDayLabels={dayLabelsByCampaign[campaign.id] || []}
                    folderName={folders.folderLabel(campaign.folder_id)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
