'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function DuplicateCampaignButton({ campaignId }: { campaignId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/duplicate`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        window.alert(typeof data.error === 'string' ? data.error : 'Could not duplicate campaign.');
        return;
      }
      const c = data.campaign as { id?: string; campaign_type?: string } | undefined;
      if (!c?.id) {
        window.alert('Duplicate succeeded but no campaign id was returned.');
        return;
      }
      if (c.campaign_type === 'ai_nurture') router.push(`/ai-nurture/${c.id}`);
      else router.push(`/campaigns/${c.id}/edit`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button type="button" variant="secondary" disabled={busy} onClick={() => void run()}>
      <Copy size={14} className="mr-2" />
      {busy ? 'Duplicating…' : 'Duplicate'}
    </Button>
  );
}
