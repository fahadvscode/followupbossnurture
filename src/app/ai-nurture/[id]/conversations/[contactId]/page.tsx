'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Send, UserCheck, Bot, AlertCircle, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ConversationThread } from '@/components/ai-nurture/ConversationThread';
import type { DripMessage, AiConversation } from '@/types';

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-500/15 text-green-600',
  paused: 'bg-yellow-500/15 text-yellow-600',
  escalated: 'bg-red-500/15 text-red-600',
  goal_met: 'bg-blue-500/15 text-blue-600',
  human_takeover: 'bg-blue-500/15 text-blue-600',
};

export default function ConversationDetailPage() {
  const { id, contactId } = useParams<{ id: string; contactId: string }>();
  const [messages, setMessages] = useState<DripMessage[]>([]);
  const [conversation, setConversation] = useState<AiConversation | null>(null);
  const [contactName, setContactName] = useState('');
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/ai-campaigns/${id}/conversations?contact_id=${contactId}`);
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
      if (c) setContactName(`${c.first_name || ''} ${c.last_name || ''}`.trim() || c.phone || 'Lead');
    }
  }, [contactId]);

  useEffect(() => {
    load();
    loadContact();
  }, [load, loadContact]);

  const convAction = useCallback(
    async (action: string, message?: string) => {
      if (!conversation) return;
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
        setActionStatus(action === 'reply' ? 'Sent!' : action === 'takeover' ? 'You are now in control — AI paused.' : action === 'handback' ? 'AI resumed.' : 'Done.');
        await load();
        if (action === 'reply') setReply('');
        setTimeout(() => setActionStatus(null), 3000);
      }
      setSending(false);
    },
    [conversation, load]
  );

  const sendReply = useCallback(async () => {
    if (!reply.trim()) return;
    await convAction('reply', reply.trim());
  }, [reply, convAction]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) sendReply();
  };

  const isHumanTakeover = conversation?.status === 'human_takeover';
  const isEscalated = conversation?.status === 'escalated';

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      {/* Header */}
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
                {conversation.exchange_count} exchanges · {conversation.follow_up_count} follow-ups
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {conversation && (
            <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', STATUS_COLORS[conversation.status] || '')}>
              {conversation.status.replace(/_/g, ' ')}
            </span>
          )}
        </div>
      </div>

      {/* Attention banner */}
      {conversation?.needs_attention && !isHumanTakeover && (
        <div className="flex items-center justify-between rounded-lg border border-yellow-300 bg-yellow-50 p-3">
          <div className="flex items-center gap-2 text-sm text-yellow-800">
            <AlertCircle size={16} />
            AI said it would follow up — lead may be waiting for info.
          </div>
          <button
            onClick={() => convAction('dismiss_attention')}
            className="text-xs text-yellow-700 hover:text-yellow-900 font-medium"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Escalation banner */}
      {(isEscalated || conversation?.escalation_reason) && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          <strong>Escalated:</strong> {conversation?.escalation_reason || 'Needs human review'}
        </div>
      )}

      {/* Human takeover banner */}
      {isHumanTakeover && (
        <div className="flex items-center justify-between rounded-lg border border-blue-300 bg-blue-50 p-3">
          <div className="flex items-center gap-2 text-sm text-blue-800">
            <UserCheck size={16} />
            You are in control — AI is paused for this conversation.
          </div>
          <button
            onClick={() => convAction('handback')}
            disabled={sending}
            className="flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-900 border border-blue-300 rounded-lg px-3 py-1.5 hover:bg-blue-100 disabled:opacity-50"
          >
            <Bot size={12} /> Hand back to AI
          </button>
        </div>
      )}

      {/* Messages */}
      <div className="rounded-xl border border-border bg-card px-4 min-h-[300px]">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          </div>
        ) : (
          <ConversationThread messages={messages} contactName={contactName} />
        )}
      </div>

      {/* Reply box — always visible */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-muted">
            {isHumanTakeover ? 'Reply as yourself (AI paused)' : 'Reply manually (overrides AI for this message)'}
          </p>
          {!isHumanTakeover && conversation && (
            <button
              onClick={() => convAction('takeover')}
              disabled={sending}
              className="flex items-center gap-1 text-xs font-medium text-accent border border-accent/30 rounded-lg px-3 py-1.5 hover:bg-accent/10 disabled:opacity-50"
            >
              <UserCheck size={12} /> Take Over
            </button>
          )}
          {isHumanTakeover && (
            <button
              onClick={() => convAction('handback')}
              disabled={sending}
              className="flex items-center gap-1 text-xs font-medium text-muted border border-border rounded-lg px-3 py-1.5 hover:bg-card-hover disabled:opacity-50"
            >
              <Bot size={12} /> Hand back to AI
            </button>
          )}
        </div>

        <textarea
          ref={textareaRef}
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={3}
          placeholder="Type your message... (Cmd+Enter to send)"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-accent"
        />

        {actionStatus && (
          <div className={cn(
            'flex items-center gap-1.5 text-xs rounded-lg px-3 py-2',
            actionStatus.startsWith('Error') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
          )}>
            {!actionStatus.startsWith('Error') && <CheckCircle size={12} />}
            {actionStatus}
          </div>
        )}

        <div className="flex justify-end">
          <button
            onClick={sendReply}
            disabled={sending || !reply.trim()}
            className="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50"
          >
            <Send size={14} />
            {sending ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}
