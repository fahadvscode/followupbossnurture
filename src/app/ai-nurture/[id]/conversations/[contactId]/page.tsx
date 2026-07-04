'use client';

import { useParams } from 'next/navigation';
import { LeadConversationPanel } from '@/components/conversations/LeadConversationPanel';

export default function ConversationDetailPage() {
  const { id, contactId } = useParams<{ id: string; contactId: string }>();

  return (
    <LeadConversationPanel
      campaignId={id}
      contactId={contactId}
      campaignType="ai_nurture"
      backHref={`/ai-nurture/${id}`}
    />
  );
}
