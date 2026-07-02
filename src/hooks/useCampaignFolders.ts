'use client';

import { useCallback, useEffect, useState } from 'react';
import type { DripCampaignFolder } from '@/types';

export type CampaignFolderScope = 'all' | 'unfiled' | string;

export function useCampaignFolders() {
  const [folders, setFolders] = useState<DripCampaignFolder[]>([]);
  const [folderScope, setFolderScope] = useState<CampaignFolderScope>('all');
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
    void loadFolders();
  }, [loadFolders]);

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

  async function deleteFolder(
    id: string,
    name: string,
    onCampaignsUnfiled?: (folderId: string) => void
  ) {
    if (!confirm(`Delete folder "${name}"? Campaigns inside become unfiled.`)) return;
    const r = await fetch(`/api/campaign-folders/${id}`, { method: 'DELETE' });
    if (r.ok) {
      onCampaignsUnfiled?.(id);
      if (folderScope === id) setFolderScope('all');
      await loadFolders();
    }
  }

  async function moveCampaignToFolder(
    campaignId: string,
    folderId: string
  ): Promise<boolean> {
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
      return r.ok;
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

  return {
    folders,
    folderScope,
    setFolderScope,
    foldersLoading,
    newFolderName,
    setNewFolderName,
    creatingFolder,
    folderActionError,
    setFolderActionError,
    renamingFolderId,
    renameFolderDraft,
    setRenameFolderDraft,
    movingCampaignId,
    loadFolders,
    folderLabel,
    createFolder,
    startRenameFolder,
    cancelRenameFolder,
    saveRenameFolder,
    deleteFolder,
    moveCampaignToFolder,
    scopeLabel,
  };
}
