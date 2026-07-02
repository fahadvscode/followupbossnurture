'use client';

import { Select } from '@/components/ui/select';
import type { DripCampaignFolder } from '@/types';
import { FolderInput } from 'lucide-react';

type Props = {
  campaignId: string;
  campaignName: string;
  folderId: string | null | undefined;
  folders: DripCampaignFolder[];
  disabled?: boolean;
  onMove: (campaignId: string, folderId: string) => void | Promise<void>;
  className?: string;
  showIcon?: boolean;
};

export function CampaignFolderSelect({
  campaignId,
  campaignName,
  folderId,
  folders,
  disabled,
  onMove,
  className,
  showIcon = true,
}: Props) {
  return (
    <div className={`flex items-center gap-1.5 ${className || ''}`}>
      {showIcon ? <FolderInput size={14} className="text-muted shrink-0" aria-hidden /> : null}
      <label htmlFor={`folder-${campaignId}`} className="sr-only">
        Folder for {campaignName}
      </label>
      <Select
        id={`folder-${campaignId}`}
        value={folderId || ''}
        disabled={disabled}
        onChange={(e) => void onMove(campaignId, e.target.value)}
        className="text-xs py-1.5 min-w-[8rem] max-w-[12rem]"
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
  );
}
