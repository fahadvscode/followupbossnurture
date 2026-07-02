'use client';

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { AiCampaignCard } from '@/components/ai-nurture/AiCampaignCard';
import { CampaignFolderSelect } from '@/components/campaigns/CampaignFolderSelect';
import { CampaignFoldersSidebar } from '@/components/campaigns/CampaignFoldersSidebar';
import { useCampaignFolders } from '@/hooks/useCampaignFolders';
import type { AiCampaignGoal, CampaignStatus, DripCampaign } from '@/types';
import { Plus, Sparkles } from 'lucide-react';

export type AiCampaignListRow = {
  id: string;
  name: string;
  status: CampaignStatus;
  folder_id: string | null;
  ai_goal: AiCampaignGoal | null;
  active_conversations: number;
  total_enrolled: number;
};

type Props = {
  initialCampaigns: AiCampaignListRow[];
};

export function AiNurtureCampaignsClient({ initialCampaigns }: Props) {
  const [campaigns, setCampaigns] = useState(initialCampaigns);
  const folders = useCampaignFolders();

  const reloadCampaigns = useCallback(async () => {
    const res = await fetch('/api/ai-campaigns');
    const data = await res.json();
    const rows = (data.campaigns || []) as Array<
      DripCampaign & {
        ai_goal: AiCampaignGoal | null;
        active_conversations: number;
        total_enrolled: number;
      }
    >;
    setCampaigns(
      rows.map((c) => ({
        id: c.id,
        name: c.name,
        status: c.status,
        folder_id: c.folder_id ?? null,
        ai_goal: c.ai_goal,
        active_conversations: c.active_conversations,
        total_enrolled: c.total_enrolled,
      }))
    );
  }, []);

  const filteredCampaigns = useMemo(() => {
    if (folders.folderScope === 'all') return campaigns;
    if (folders.folderScope === 'unfiled') return campaigns.filter((c) => !c.folder_id);
    return campaigns.filter((c) => c.folder_id === folders.folderScope);
  }, [campaigns, folders.folderScope]);

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
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
            <Sparkles size={22} className="text-accent" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">AI Nurture Campaigns</h1>
            <p className="text-sm text-muted">
              {filteredCampaigns.length} of {campaigns.length} campaigns
              {folders.folderScope !== 'all' ? ` · ${folders.scopeLabel}` : ''}
            </p>
          </div>
        </div>
        <Link
          href="/ai-nurture/new"
          className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent/90"
        >
          <Plus size={16} /> New Campaign
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,13rem)_minmax(0,1fr)] gap-4 lg:gap-6">
        <CampaignFoldersSidebar folders={folders} onDeleteFolder={handleFolderDeleted} />

        <div>
          {filteredCampaigns.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
              <Sparkles size={40} className="mx-auto text-muted mb-3" />
              <h2 className="text-lg font-semibold text-foreground mb-1">
                {campaigns.length === 0 ? 'No AI campaigns yet' : 'No campaigns in this folder'}
              </h2>
              <p className="text-sm text-muted mb-4">
                {campaigns.length === 0
                  ? 'Create your first AI-powered nurture campaign to start engaging leads automatically.'
                  : 'Use the folder dropdown on each card to move campaigns here.'}
              </p>
              {campaigns.length === 0 ? (
                <Link
                  href="/ai-nurture/new"
                  className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent/90"
                >
                  <Plus size={16} /> Create Campaign
                </Link>
              ) : null}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredCampaigns.map((c) => (
                <div key={c.id} className="space-y-2">
                  <CampaignFolderSelect
                    campaignId={c.id}
                    campaignName={c.name}
                    folderId={c.folder_id}
                    folders={folders.folders}
                    disabled={folders.movingCampaignId === c.id}
                    onMove={handleMove}
                    className="justify-end px-1"
                  />
                  <AiCampaignCard
                    id={c.id}
                    name={c.name}
                    status={c.status}
                    goal={c.ai_goal}
                    activeConversations={c.active_conversations}
                    totalEnrolled={c.total_enrolled}
                    folderName={folders.folderLabel(c.folder_id)}
                    onUpdated={reloadCampaigns}
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
