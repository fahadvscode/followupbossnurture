'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Pause, Play, Archive, RotateCcw } from 'lucide-react';
import { useState } from 'react';

interface CampaignControlsProps {
  campaignId: string;
  status: string;
  /** Called after status changes (e.g. client pages that fetch their own data). */
  onUpdated?: () => void;
  /** Smaller buttons for list cards. */
  compact?: boolean;
}

export function CampaignControls({ campaignId, status, onUpdated, compact }: CampaignControlsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function patchStatus(next: string) {
    setLoading(true);
    await fetch('/api/campaigns', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: campaignId, status: next }),
    });
    if (onUpdated) onUpdated();
    else router.refresh();
    setLoading(false);
  }

  const btnSize = compact ? 'sm' : 'sm';
  const iconClass = compact ? '' : 'mr-1.5';

  return (
    <div className={compact ? 'flex flex-col gap-1' : 'flex flex-wrap gap-2'}>
      {status === 'active' && (
        <Button variant="secondary" size={btnSize} disabled={loading} onClick={() => patchStatus('paused')} title="Pause campaign">
          <Pause size={14} className={iconClass} /> {!compact && 'Pause campaign'}
        </Button>
      )}
      {status === 'paused' && (
        <Button variant="secondary" size={btnSize} disabled={loading} onClick={() => patchStatus('active')} title="Resume campaign">
          <Play size={14} className={iconClass} /> {!compact && 'Resume campaign'}
        </Button>
      )}
      {status !== 'archived' && (
        <Button variant="ghost" size={btnSize} disabled={loading} onClick={() => patchStatus('archived')} title="Archive campaign">
          <Archive size={14} className={iconClass} /> {!compact && 'Archive'}
        </Button>
      )}
      {status === 'archived' && (
        <Button variant="secondary" size={btnSize} disabled={loading} onClick={() => patchStatus('paused')} title="Restore from archive">
          <RotateCcw size={14} className={iconClass} /> {!compact && 'Restore from archive'}
        </Button>
      )}
    </div>
  );
}
