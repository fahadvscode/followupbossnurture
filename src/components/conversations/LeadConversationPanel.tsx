'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Send,
  UserCheck,
  Bot,
  AlertCircle,
  CheckCircle,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ConversationThread } from '@/components/ai-nurture/ConversationThread';
import type { AiConversation, CampaignType, DripMessage } from '@/types';

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-500/15 text-green-600',
  paused: 'bg-yellow-500/15 text-yellow-600',
  escalated: 'bg-red-500/15 text-red-600',
  goal_met: 'bg-blue-500/15 text-blue-600',
  human_takeover: 'bg-blue-500/15 text-blue-600',
  replied: 'bg-amber-500/15 text-amber-700',
};

type Props = {
  campaignId: string;
  contactId: string;
  campaignType: CampaignType;
  contactName?: string;
  backHref?: string;
  /** Hide back link (e.g. when embedded on contact page). */
  embedded?: boolean;
};

export function LeadConversationPanel({
  campaignId,
  contactId,
  campaignType,
  contactName: initialName = '',
  backHref,
  embedded = false,
}: Props) {
  const [messages, setMessages] = useState<DripMessage[]>([]);
  const [conversation, setConversation] = useState<AiConversation | null>(null);
  const [contactName, setContactName] = useState(initialName);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isAi = campaignType === 'ai_nurture';

  const load = useCallback(async () => {
    const res = await fetch(
      `/api/ai-campaigns/${campaignId}/conversations?contact_id=${contactId}`
    );
    const data = await res.json();
    setMessages(data.messages || []);
    setConversation(data.conversation || null);
    setLoading(false);
  }, [campaignId, contactId]);

  useEffect(() => {
    if (initialName) setContactName(initialName);
  }, [initialName]);

  useEffect(() => {
    if (!initialName) {
      fetch(`/api/contacts?id=${contactId}`)
        .then((r) => r.json())
        .then((data) => {
          const c = data.contact;
          if (c) {
            setContactName(
              `${c.first_name || ''} ${c.last_name || ''}`.trim() || c.phone || 'Lead'
            );
          }
        })
        .catch(() => {});
    }
  }, [contactId, initialName]);

  useEffect(() => {
    setLoading(true);
    void load();
    void fetch('/api/inbox/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contact_id: contactId, campaign_id: campaignId }),
    });
  }, [load, contactId, campaignId]);

  const convAction = useCallback(
    async (action: string, message?: string) => {
      if (isAi) {
        if (!conversation) {
          setActionStatus('Error: Conversation not ready — refresh and try again.');
          return;
        }
        if (action === 'restart' || action === 'refresh_context') {
          const ok = window.confirm(
            'Start fresh? The full transcript stays in the log, but the AI will only use messages from now on.'
          );
          if (!ok) return;
        }
        setSending(true);
        setActionStatus(null);
        const res = await fetch(`/api/ai-conversations/${conversation.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, message }),
        });
        const data = await res.json();
        if (!res.ok) {
          setActionStatus(`Error: ${data.error || 'Failed'}`);
        } else {
          setActionStatus(
            action === 'reply'
              ? 'Sent!'
              : action === 'takeover'
                ? 'You are now in control — AI paused.'
                : action === 'handback'
                  ? 'AI resumed.'
                  : action === 'restart' || action === 'refresh_context'
                    ? 'Started fresh.'
                    : 'Done.'
          );
          await load();
          if (action === 'reply') setReply('');
          setTimeout(() => setActionStatus(null), 3000);
        }
        setSending(false);
        return;
      }

      if (action !== 'reply' || !message?.trim()) return;
      setSending(true);
      setActionStatus(null);
      const res = await fetch(`/api/contacts/${contactId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaign_id: campaignId, message: message.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionStatus(`Error: ${data.error || 'Failed to send'}`);
      } else {
        setActionStatus('Sent!');
        await load();
        setReply('');
        setTimeout(() => setActionStatus(null), 3000);
      }
      setSending(false);
    },
    [conversation, contactId, campaignId, isAi, load]
  );

  const sendReply = useCallback(async () => {
    if (!reply.trim()) return;
    await convAction('reply', reply.trim());
  }, [reply, convAction]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void sendReply();
  };

  const isHumanTakeover = conversation?.status === 'human_takeover';
  const isEscalated = conversation?.status === 'escalated';
  const isEnded =
    isEscalated ||
    conversation?.status === 'goal_met' ||
    conversation?.status === 'paused';

  const statusLabel = isAi
    ? conversation?.status.replace(/_/g, ' ') || 'active'
    : 'SMS thread';

  return (
    <div
      className={cn(
        'flex min-h-0 flex-col',
        embedded
          ? 'h-[min(70dvh,560px)]'
          : 'h-[calc(100dvh-4.5rem)] sm:h-[calc(100dvh-5.5rem)] lg:h-[calc(100dvh-6.5rem)] max-w-2xl mx-auto'
      )}
    >
      {!embedded && (
        <div className="shrink-0 border-b border-border bg-background px-1 pb-3 pt-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-3">
              {backHref ? (
                <Link
                  href={backHref}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted hover:bg-card-hover hover:text-foreground"
                >
                  <ArrowLeft size={16} />
                </Link>
              ) : null}
              <div className="min-w-0">
                <h2 className="truncate text-lg font-bold text-foreground">
                  {contactName || 'Conversation'}
                </h2>
                {isAi && conversation ? (
                  <p className="text-xs text-muted">
                    {conversation.exchange_count} exchanges · {conversation.follow_up_count} follow-ups
                  </p>
                ) : (
                  <p className="text-xs text-muted">Standard drip — reply manually via SMS</p>
                )}
              </div>
            </div>
            <span
              className={cn(
                'shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium',
                STATUS_COLORS[conversation?.status || (isAi ? 'active' : 'replied')] || ''
              )}
            >
              {statusLabel}
            </span>
          </div>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
        <div className="space-y-3 p-3 sm:p-4">
          {isAi && conversation?.context_reset_at && (
            <div className="rounded-lg border border-blue-200 bg-blue-50/80 px-3 py-2.5 text-xs text-blue-900">
              <strong>AI context reset</strong> —{' '}
              {new Date(conversation.context_reset_at).toLocaleString()}.
            </div>
          )}

          {isAi && conversation && conversation.status === 'active' && !isHumanTakeover && (
            <div className="flex flex-col gap-3 rounded-lg border border-dashed border-border bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted">
                <strong className="text-foreground">Start fresh</strong> — clear the AI’s memory for this
                thread.
              </p>
              <button
                type="button"
                onClick={() => convAction('refresh_context')}
                disabled={sending}
                className="flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-accent/30 px-3 py-2 text-xs font-medium text-accent hover:bg-accent/10 disabled:opacity-50"
              >
                <RefreshCw size={12} /> Start fresh
              </button>
            </div>
          )}

          {isAi && conversation?.needs_attention && !isHumanTakeover && (
            <div className="flex items-center justify-between rounded-lg border border-yellow-300 bg-yellow-50 p-3">
              <div className="flex items-center gap-2 text-sm text-yellow-800">
                <AlertCircle size={16} />
                Lead may be waiting for a follow-up.
              </div>
              <button
                type="button"
                onClick={() => convAction('dismiss_attention')}
                className="text-xs font-medium text-yellow-700 hover:text-yellow-900"
              >
                Dismiss
              </button>
            </div>
          )}

          {isAi && (isEscalated || conversation?.escalation_reason) && (
            <div className="flex items-center justify-between rounded-lg border border-red-300 bg-red-50 p-3">
              <p className="text-sm text-red-700">
                <strong>Escalated:</strong> {conversation?.escalation_reason || 'Needs human review'}
              </p>
            </div>
          )}

          {isAi && isHumanTakeover && (
            <div className="flex flex-col gap-2 rounded-lg border border-blue-300 bg-blue-50 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-sm text-blue-800">
                <UserCheck size={16} />
                You are in control — AI is paused.
              </div>
              <button
                type="button"
                onClick={() => convAction('handback')}
                disabled={sending}
                className="flex items-center gap-1 rounded-lg border border-blue-300 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"
              >
                <Bot size={12} /> Hand back to AI
              </button>
            </div>
          )}

          <div className="rounded-xl border border-border bg-card px-2 sm:px-4">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
              </div>
            ) : (
              <ConversationThread messages={messages} contactName={contactName} />
            )}
          </div>

          {isAi && isEnded && !isEscalated && (
            <div className="rounded-lg border border-border bg-card p-3 text-sm text-muted">
              AI conversation ended ({conversation?.status.replace(/_/g, ' ')}). Use Start fresh to
              re-engage.
            </div>
          )}
        </div>
      </div>

      <div className="shrink-0 border-t border-border bg-card px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-4px_12px_rgba(0,0,0,0.06)]">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-muted">
            {isAi
              ? isHumanTakeover
                ? 'Reply as yourself (AI paused)'
                : 'Reply manually (overrides AI for this message)'
              : 'Reply via SMS'}
          </p>
          {isAi && !isHumanTakeover && conversation && (
            <button
              type="button"
              onClick={() => convAction('takeover')}
              disabled={sending}
              className="flex shrink-0 items-center gap-1 rounded-lg border border-accent/30 px-2.5 py-1 text-xs font-medium text-accent hover:bg-accent/10 disabled:opacity-50"
            >
              <UserCheck size={12} /> Take Over
            </button>
          )}
        </div>

        {actionStatus && (
          <div
            className={cn(
              'mb-2 flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs',
              actionStatus.startsWith('Error') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
            )}
          >
            {!actionStatus.startsWith('Error') && <CheckCircle size={12} />}
            {actionStatus}
          </div>
        )}

        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={2}
            placeholder="Message…"
            className="max-h-32 min-h-[2.75rem] flex-1 resize-none rounded-2xl border border-border bg-background px-3 py-2.5 text-base sm:text-sm focus:outline-none focus:ring-1 focus:ring-accent"
          />
          <button
            type="button"
            onClick={() => void sendReply()}
            disabled={sending || !reply.trim()}
            aria-label="Send message"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-white hover:bg-accent/90 disabled:opacity-50"
          >
            <Send size={18} />
          </button>
        </div>
        <p className="mt-1.5 hidden text-[10px] text-muted sm:block">
          Cmd+Enter to send
        </p>
      </div>
    </div>
  );
}
