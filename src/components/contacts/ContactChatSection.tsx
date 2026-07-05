'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { MessageSquare, X } from 'lucide-react';
import { LeadConversationPanel } from '@/components/conversations/LeadConversationPanel';
import { conversationPath } from '@/lib/conversation-url';
import type { CampaignType } from '@/types';

export type ContactEnrollmentChat = {
  campaign_id: string;
  campaign_name: string;
  campaign_type: CampaignType;
};

type Props = {
  contactId: string;
  contactName: string;
  enrollments: ContactEnrollmentChat[];
};

export function ContactChatSection({ contactId, contactName, enrollments }: Props) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const chatOpen = searchParams.get('chat') === '1';
  const campaignIdParam = searchParams.get('campaignId') || '';

  const withMessages = useMemo(
    () => enrollments.filter((e) => e.campaign_id),
    [enrollments]
  );

  const [activeCampaignId, setActiveCampaignId] = useState('');

  useEffect(() => {
    if (!chatOpen) return;
    if (campaignIdParam && withMessages.some((e) => e.campaign_id === campaignIdParam)) {
      setActiveCampaignId(campaignIdParam);
      return;
    }
    if (withMessages.length > 0 && !activeCampaignId) {
      setActiveCampaignId(withMessages[0].campaign_id);
    }
  }, [chatOpen, campaignIdParam, withMessages, activeCampaignId]);

  const active = withMessages.find((e) => e.campaign_id === activeCampaignId);

  function closeChat() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('chat');
    params.delete('campaignId');
    const q = params.toString();
    router.replace(q ? `/contacts/${contactId}?${q}` : `/contacts/${contactId}`, { scroll: false });
  }

  function selectCampaign(id: string) {
    setActiveCampaignId(id);
    const params = new URLSearchParams(searchParams.toString());
    params.set('chat', '1');
    params.set('campaignId', id);
    router.replace(`/contacts/${contactId}?${params.toString()}`, { scroll: false });
  }

  if (!chatOpen) return null;

  return (
    <div className="rounded-xl border-2 border-accent/40 bg-card shadow-lg overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-accent/5 px-4 py-3">
        <div className="flex items-center gap-2">
          <MessageSquare size={18} className="text-accent" />
          <div>
            <p className="text-sm font-semibold text-foreground">Conversation</p>
            <p className="text-xs text-muted">{contactName}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={closeChat}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted hover:text-foreground"
          aria-label="Close conversation"
        >
          <X size={16} />
        </button>
      </div>

      {withMessages.length > 1 && (
        <div className="flex gap-1 border-b border-border px-3 py-2 overflow-x-auto">
          {withMessages.map((e) => (
            <button
              key={e.campaign_id}
              type="button"
              onClick={() => selectCampaign(e.campaign_id)}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                e.campaign_id === activeCampaignId
                  ? 'bg-accent text-white'
                  : 'bg-card-hover text-muted hover:text-foreground'
              }`}
            >
              {e.campaign_name}
            </button>
          ))}
        </div>
      )}

      <div className="p-4 pt-0">
        {active ? (
          <LeadConversationPanel
            embedded
            campaignId={active.campaign_id}
            contactId={contactId}
            campaignType={active.campaign_type}
            contactName={contactName}
          />
        ) : (
          <p className="text-sm text-muted text-center py-8">
            No campaign enrollments to chat in. Enroll this lead in a campaign first.
          </p>
        )}
      </div>
    </div>
  );
}

/** Link that opens the chat panel on the contact page (standard campaigns). */
export function openContactChatHref(contactId: string, campaignId: string) {
  return conversationPath({ contactId, campaignId, campaignType: 'standard' });
}
