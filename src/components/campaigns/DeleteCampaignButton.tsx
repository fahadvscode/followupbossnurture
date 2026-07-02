'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DeleteCampaignButtonProps {
  campaignId: string;
  campaignName: string;
  campaignType?: 'standard' | 'ai_nurture';
  /** Icon-only for list cards; full button on detail pages. */
  variant?: 'button' | 'icon';
  /** Called after successful delete instead of navigating away. */
  onDeleted?: () => void;
  /** Override post-delete redirect (defaults to campaigns or ai-nurture list). */
  redirectTo?: string;
}

export function DeleteCampaignButton({
  campaignId,
  campaignName,
  campaignType = 'standard',
  variant = 'button',
  onDeleted,
  redirectTo,
}: DeleteCampaignButtonProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function run() {
    const label = campaignName.trim() || 'this campaign';
    const ok = window.confirm(
      `Delete "${label}"?\n\nThis permanently removes the campaign, its steps, enrollments, and message history. This cannot be undone.`
    );
    if (!ok) return;

    setBusy(true);
    try {
      const endpoint = campaignType === 'ai_nurture' ? '/api/ai-campaigns' : '/api/campaigns';
      const res = await fetch(endpoint, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: campaignId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        window.alert(typeof data.error === 'string' ? data.error : 'Could not delete campaign.');
        return;
      }
      if (onDeleted) onDeleted();
      else router.push(redirectTo ?? (campaignType === 'ai_nurture' ? '/ai-nurture' : '/campaigns'));
    } finally {
      setBusy(false);
    }
  }

  if (variant === 'icon') {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-9 w-9 p-0 text-muted hover:text-danger"
        disabled={busy}
        title="Delete campaign"
        aria-label="Delete campaign"
        onClick={() => void run()}
      >
        <Trash2 size={16} />
      </Button>
    );
  }

  return (
    <Button type="button" variant="danger" disabled={busy} onClick={() => void run()}>
      <Trash2 size={14} className="mr-2" />
      {busy ? 'Deleting…' : 'Delete'}
    </Button>
  );
}
