'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ConversationThread } from '@/components/ai-nurture/ConversationThread';
import type { DripMessage, AiConversation } from '@/types';

export default function ConversationDetailPage() {
  const { id, contactId } = useParams<{ id: string; contactId: string }>();
  const [messages, setMessages] = useState<DripMessage[]>([]);
  const [conversation, setConversation] = useState<AiConversation | null>(null);
  const [contactName, setContactName] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch(
      `/api/ai-campaigns/${id}/conversations?contact_id=${contactId}`
    );
    const data = await res.json();
    setMessages(data.messages || []);
    setConversation(data.conversation || null);
    setLoading(false);
  }, [id, contactId]);

  const loadContact = useCallback(async () => {
    const res = await fetch(`/api/contacts?id=${contactId}`);
    if (res.ok) {
      const data = await res.json();
      const c = data.contact;
      if (c)
        setContactName(
          `${c.first_name || ''} ${c.last_name || ''}`.trim() || c.phone || 'Lead'
        );
    }
  }, [contactId]);

  useEffect(() => {
    load();
    loadContact();
  }, [load, loadContact]);

  const statusColors: Record<string, string> = {
    active: 'bg-green-500/15 text-green-600',
    paused: 'bg-yellow-500/15 text-yellow-600',
    escalated: 'bg-red-500/15 text-red-600',
    goal_met: 'bg-blue-500/15 text-blue-600',
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href={`/ai-nurture/${id}`}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted hover:text-foreground hover:bg-card-hover"
          >
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-foreground">{contactName || 'Conversation'}</h1>
            {conversation && (
              <p className="text-xs text-muted">
                {conversation.exchange_count} exchanges &middot;{' '}
                {conversation.follow_up_count} follow-ups
              </p>
            )}
          </div>
        </div>
        {conversation && (
          <span
            className={cn(
              'rounded-full px-2.5 py-0.5 text-xs font-medium',
              statusColors[conversation.status] || ''
            )}
          >
            {conversation.status.replace('_', ' ')}
          </span>
        )}
      </div>

      {conversation?.escalation_reason && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          Escalated: {conversation.escalation_reason}
        </div>
      )}

      <div className="rounded-xl border border-border bg-card px-4 min-h-[300px]">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          </div>
        ) : (
          <ConversationThread messages={messages} contactName={contactName} />
        )}
      </div>
    </div>
  );
}
