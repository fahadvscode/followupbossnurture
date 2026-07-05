'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { LeadConversationPanel } from '@/components/conversations/LeadConversationPanel';
import type { CampaignType } from '@/types';

export default function InboxConversationPage() {
  const { contactId, campaignId } = useParams<{ contactId: string; campaignId: string }>();
  const [campaignType, setCampaignType] = useState<CampaignType | null>(null);

  useEffect(() => {
    fetch(`/api/campaigns?id=${campaignId}`)
      .then((r) => r.json())
      .then((data) => {
        const t = data.campaign?.campaign_type;
        setCampaignType(t === 'ai_nurture' ? 'ai_nurture' : 'standard');
      })
      .catch(() => setCampaignType('standard'));
  }, [campaignId]);

  if (!campaignType) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="-mx-4 -mb-4 flex min-h-0 flex-col sm:-mx-6 lg:mx-auto lg:mb-0 lg:max-w-2xl lg:w-full">
      <LeadConversationPanel
        campaignId={campaignId}
        contactId={contactId}
        campaignType={campaignType}
        backHref="/inbox"
      />
    </div>
  );
}
