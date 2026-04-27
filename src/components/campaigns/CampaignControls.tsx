'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Pause, Play, Archive } from 'lucide-react';
import { useState } from 'react';

interface CampaignControlsProps {
  campaignId: string;
  status: string;
}

export function CampaignControls({ campaignId, status }: CampaignControlsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function patchStatus(next: string) {
    setLoading(true);
    await fetch('/api/campaigns', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: campaignId, status: next }),
    });
    router.refresh();
    setLoading(false);
  }

  return (
    <div className="flex flex-wrap gap-2">
      {status === 'active' && (
        <Button variant="secondary" size="sm" disabled={loading} onClick={() => patchStatus('paused')}>
          <Pause size={14} className="mr-1.5" /> Pause campaign
        </Button>
      )}
      {status === 'paused' && (
        <Button variant="secondary" size="sm" disabled={loading} onClick={() => patchStatus('active')}>
          <Play size={14} className="mr-1.5" /> Resume campaign
        </Button>
      )}
      {status !== 'archived' && (
        <Button variant="ghost" size="sm" disabled={loading} onClick={() => patchStatus('archived')}>
          <Archive size={14} className="mr-1.5" /> Archive
        </Button>
      )}
      {status === 'archived' && (
        <Button variant="secondary" size="sm" disabled={loading} onClick={() => patchStatus('paused')}>
          Restore from archive
        </Button>
      )}
    </div>
  );
}
