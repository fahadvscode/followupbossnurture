'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { EmptyState } from '@/components/ui/empty-state';
import { CampaignCard } from '@/components/campaigns/CampaignCard';
import { cn } from '@/lib/utils';
import type { DripCampaign, DripCampaignFolder } from '@/types';
import {
  Folder,
  FolderInput,
  FolderPlus,
  Loader2,
  MessageSquare,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';

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
};

type FolderScope = 'all' | 'unfiled' | string;

export function CampaignsClient({
  initialCampaigns,
  statsMap,
  dayLabelsByCampaign,
}: Props) {
  const [campaigns, setCampaigns] = useState(initialCampaigns);
  const [folders, setFolders] = useState<DripCampaignFolder[]>([]);
  const [folderScope, setFolderScope] = useState<FolderScope>('all');
  const [foldersLoading, setFoldersLoading] = useState(true);
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [folderActionError, setFolderActionError] = useState<string | null>(null);
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [renameFolderDraft, setRenameFolderDraft] = useState('');
  const [movingCampaignId, setMovingCampaignId] = useState<string | null>(null);

  const loadFolders = useCallback(async () => {
    setFoldersLoading(true);
    setFolderActionError(null);
    try {
      const r = await fetch('/api/campaign-folders', { credentials: 'same-origin' });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setFolders([]);
        setFolderActionError(
          typeof d.error === 'string' ? d.error : 'Could not load folders (run DB migration).'
        );
        return;
      }
      setFolders(Array.isArray(d.folders) ? d.folders : []);
    } catch {
      setFolders([]);
      setFolderActionError('Network error loading folders.');
    } finally {
      setFoldersLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFolders();
  }, [loadFolders]);

  const filteredCampaigns = useMemo(() => {
    if (folderScope === 'all') return campaigns;
    if (folderScope === 'unfiled') return campaigns.filter((c) => !c.folder_id);
    return campaigns.filter((c) => c.folder_id === folderScope);
  }, [campaigns, folderScope]);

  function folderLabel(id: string | null | undefined): string {
    if (!id) return '';
    return folders.find((f) => f.id === id)?.name || '';
  }

  async function createFolder() {
    const name = newFolderName.trim();
    if (!name) return;
    setCreatingFolder(true);
    setFolderActionError(null);
    try {
      const r = await fetch('/api/campaign-folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setFolderActionError(typeof d.error === 'string' ? d.error : 'Could not create folder.');
        return;
      }
      setNewFolderName('');
      await loadFolders();
      if (d.id) setFolderScope(d.id);
    } finally {
      setCreatingFolder(false);
    }
  }

  function startRenameFolder(f: DripCampaignFolder) {
    setRenamingFolderId(f.id);
    setRenameFolderDraft(f.name);
  }

  function cancelRenameFolder() {
    setRenamingFolderId(null);
    setRenameFolderDraft('');
  }

  async function saveRenameFolder() {
    if (!renamingFolderId) return;
    const name = renameFolderDraft.trim();
    if (!name) return;
    const r = await fetch(`/api/campaign-folders/${renamingFolderId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (r.ok) {
      cancelRenameFolder();
      await loadFolders();
    }
  }

  async function deleteFolder(id: string, name: string) {
    if (!confirm(`Delete folder "${name}"? Campaigns inside become unfiled.`)) return;
    const r = await fetch(`/api/campaign-folders/${id}`, { method: 'DELETE' });
    if (r.ok) {
      setCampaigns((prev) =>
        prev.map((c) => (c.folder_id === id ? { ...c, folder_id: null } : c))
      );
      if (folderScope === id) setFolderScope('all');
      await loadFolders();
    }
  }

  async function moveCampaignToFolder(campaignId: string, folderId: string) {
    setMovingCampaignId(campaignId);
    try {
      const r = await fetch('/api/campaigns', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: campaignId,
          folder_id: folderId === '' ? null : folderId,
        }),
      });
      if (r.ok) {
        setCampaigns((prev) =>
          prev.map((c) =>
            c.id === campaignId
              ? { ...c, folder_id: folderId === '' ? null : folderId }
              : c
          )
        );
      }
    } finally {
      setMovingCampaignId(null);
    }
  }

  const scopeLabel =
    folderScope === 'all'
      ? 'All campaigns'
      : folderScope === 'unfiled'
        ? 'Unfiled'
        : folderLabel(folderScope) || 'Folder';

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Campaigns</h1>
          <p className="text-sm text-muted mt-1">
            {filteredCampaigns.length} of {campaigns.length} campaigns
            {folderScope !== 'all' ? ` · ${scopeLabel}` : ''}
          </p>
        </div>
        <Link href="/campaigns/new">
          <Button>
            <Plus size={14} className="mr-2" /> New Campaign
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,13rem)_minmax(0,1fr)] gap-4 lg:gap-6">
        <Card className="lg:min-h-[20rem] h-fit">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Folders</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-foreground" htmlFor="new-campaign-folder">
                Folder name
              </label>
              <Input
                id="new-campaign-folder"
                value={newFolderName}
                onChange={(e) => {
                  setNewFolderName(e.target.value);
                  if (folderActionError) setFolderActionError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void createFolder();
                  }
                }}
                placeholder="e.g. ISA, Nurture"
                className="text-sm"
                autoComplete="off"
              />
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={creatingFolder}
                onClick={() => void createFolder()}
              >
                <FolderPlus size={14} className="mr-1.5" />
                {creatingFolder ? 'Creating…' : 'Create folder'}
              </Button>
              {folderActionError ? (
                <p className="text-xs text-danger" role="alert">
                  {folderActionError}
                </p>
              ) : null}
            </div>

            <nav className="flex flex-col gap-0.5 border-t border-border pt-3">
              <button
                type="button"
                onClick={() => setFolderScope('all')}
                className={cn(
                  'flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors',
                  folderScope === 'all'
                    ? 'bg-accent/15 text-accent font-medium'
                    : 'text-muted hover:bg-card-hover hover:text-foreground'
                )}
              >
                <Folder size={14} />
                All campaigns
              </button>
              <button
                type="button"
                onClick={() => setFolderScope('unfiled')}
                className={cn(
                  'flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors',
                  folderScope === 'unfiled'
                    ? 'bg-accent/15 text-accent font-medium'
                    : 'text-muted hover:bg-card-hover hover:text-foreground'
                )}
              >
                <FolderInput size={14} />
                Unfiled
              </button>
              {foldersLoading ? (
                <p className="text-xs text-muted px-2 py-1 flex items-center gap-1">
                  <Loader2 size={12} className="animate-spin" /> Loading…
                </p>
              ) : (
                folders.map((f) =>
                  renamingFolderId === f.id ? (
                    <div key={f.id} className="rounded-md border border-border bg-card-hover p-2 space-y-2">
                      <Input
                        value={renameFolderDraft}
                        onChange={(e) => setRenameFolderDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            void saveRenameFolder();
                          }
                          if (e.key === 'Escape') cancelRenameFolder();
                        }}
                        className="text-sm"
                        autoFocus
                      />
                      <div className="flex gap-1">
                        <Button type="button" size="sm" onClick={() => void saveRenameFolder()}>
                          Save
                        </Button>
                        <Button type="button" size="sm" variant="ghost" onClick={cancelRenameFolder}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div key={f.id} className="group flex items-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => setFolderScope(f.id)}
                        className={cn(
                          'flex flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors min-w-0',
                          folderScope === f.id
                            ? 'bg-accent/15 text-accent font-medium'
                            : 'text-muted hover:bg-card-hover hover:text-foreground'
                        )}
                      >
                        <Folder size={14} className="shrink-0" />
                        <span className="truncate">{f.name}</span>
                      </button>
                      <button
                        type="button"
                        aria-label={`Rename ${f.name}`}
                        onClick={() => startRenameFolder(f)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-muted hover:text-foreground rounded"
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete ${f.name}`}
                        onClick={() => void deleteFolder(f.id, f.name)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-muted hover:text-danger rounded"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  )
                )
              )}
            </nav>
          </CardContent>
        </Card>

        <div>
          {filteredCampaigns.length === 0 ? (
            <EmptyState
              icon={MessageSquare}
              title={campaigns.length === 0 ? 'No campaigns yet' : 'No campaigns in this folder'}
              description={
                campaigns.length === 0
                  ? 'Create your first campaign from a template or start from scratch.'
                  : 'Move campaigns here using the folder dropdown on each card, or create a new campaign.'
              }
              action={
                <Link href="/campaigns/new">
                  <Button>Create Campaign</Button>
                </Link>
              }
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredCampaigns.map((campaign) => (
                <div key={campaign.id} className="space-y-2">
                  <div className="flex items-center justify-end gap-2 px-1">
                    <label htmlFor={`folder-${campaign.id}`} className="sr-only">
                      Folder for {campaign.name}
                    </label>
                    <Select
                      id={`folder-${campaign.id}`}
                      value={campaign.folder_id || ''}
                      disabled={movingCampaignId === campaign.id}
                      onChange={(e) => void moveCampaignToFolder(campaign.id, e.target.value)}
                      className="text-xs py-1.5 max-w-[10rem]"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <option value="">Unfiled</option>
                      {folders.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <CampaignCard
                    campaign={campaign}
                    stats={statsMap[campaign.id] || { enrolled: 0, active: 0, messages_sent: 0, replies: 0 }}
                    stepDayLabels={dayLabelsByCampaign[campaign.id] || []}
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
