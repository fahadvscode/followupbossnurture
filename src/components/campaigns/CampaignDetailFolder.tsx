'use client';

import { useEffect, useState } from 'react';
import { CampaignFolderSelect } from '@/components/campaigns/CampaignFolderSelect';
import type { DripCampaignFolder } from '@/types';

type Props = {
  campaignId: string;
  campaignName: string;
  initialFolderId: string | null;
};

export function CampaignDetailFolder({ campaignId, campaignName, initialFolderId }: Props) {
  const [folderId, setFolderId] = useState(initialFolderId);
  const [folders, setFolders] = useState<DripCampaignFolder[]>([]);
  const [moving, setMoving] = useState(false);

  useEffect(() => {
    void fetch('/api/campaign-folders', { credentials: 'same-origin' })
      .then((r) => r.json())
      .then((d) => setFolders(Array.isArray(d.folders) ? d.folders : []))
      .catch(() => setFolders([]));
  }, []);

  async function handleMove(_id: string, nextFolderId: string) {
    setMoving(true);
    try {
      const r = await fetch('/api/campaigns', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: campaignId,
          folder_id: nextFolderId === '' ? null : nextFolderId,
        }),
      });
      if (r.ok) setFolderId(nextFolderId === '' ? null : nextFolderId);
    } finally {
      setMoving(false);
    }
  }

  return (
    <CampaignFolderSelect
      campaignId={campaignId}
      campaignName={campaignName}
      folderId={folderId}
      folders={folders}
      disabled={moving}
      onMove={handleMove}
    />
  );
}
