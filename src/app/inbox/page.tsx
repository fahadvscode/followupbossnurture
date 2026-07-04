'use client';

import { Suspense, useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import { conversationPath } from '@/lib/conversation-url';
import { AlertCircle, Bot, UserCheck, Activity, Inbox, Clock, RefreshCw } from 'lucide-react';

type Filter = 'needs_action' | 'escalated' | 'human_takeover' | 'active' | 'all';

interface ThreadRow {
  id: string;
  kind: 'ai' | 'standard';
  conversation_id: string | null;
  contact_id: string;
  campaign_id: string;
  status: string;
  needs_attention: boolean;
  message_count: number;
  exchange_count: number;
  last_outbound_at: string | null;
  last_inbound_at: string | null;
  escalation_reason: string | null;
  contact: { id: string; first_name: string; last_name: string; phone: string } | null;
  campaign: { id: string; name: string; campaign_type: string } | null;
  last_message: { body: string; direction: string; sent_at: string } | null;
}

const FILTERS: { key: Filter; label: string; icon: React.ElementType; color: string }[] = [
  { key: 'needs_action', label: 'Needs Action', icon: AlertCircle, color: 'text-red-500' },
  { key: 'all', label: 'All', icon: Activity, color: 'text-muted' },
  { key: 'escalated', label: 'Escalated', icon: AlertCircle, color: 'text-orange-500' },
  { key: 'human_takeover', label: 'Taken Over', icon: UserCheck, color: 'text-blue-500' },
  { key: 'active', label: 'Active AI', icon: Bot, color: 'text-green-500' },
];

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-500/15 text-green-600',
  escalated: 'bg-red-500/15 text-red-600',
  human_takeover: 'bg-blue-500/15 text-blue-600',
  paused: 'bg-yellow-500/15 text-yellow-600',
  goal_met: 'bg-purple-500/15 text-purple-600',
  replied: 'bg-amber-500/15 text-amber-700',
};

function timeAgo(iso: string | null) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function InboxPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        </div>
      }
    >
      <InboxPageContent />
    </Suspense>
  );
}

function InboxPageContent() {
  const searchParams = useSearchParams();
  const focusContactId = searchParams.get('contactId');
  const [filter, setFilter] = useState<Filter>('all');
  const [threads, setThreads] = useState<ThreadRow[]>([]);
  const [needsActionCount, setNeedsActionCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [restarting, setRestarting] = useState<string | null>(null);

  const restartConv = async (convId: string, e: React.MouseEvent) => {
    e.preventDefault();
    if (
      !window.confirm(
        'Start fresh? The full transcript stays in the log, but the AI will only use messages from now on.'
      )
    ) {
      return;
    }
    setRestarting(convId);
    await fetch(`/api/ai-conversations/${convId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'refresh_context' }),
    });
    setRestarting(null);
    load();
  };

  const load = useCallback(async () => {
    setLoading(true);
    const q = new URLSearchParams({ filter });
    if (focusContactId) q.set('contactId', focusContactId);
    const res = await fetch(`/api/inbox?${q.toString()}`);
    const data = await res.json();
    setThreads(data.threads || []);
    setNeedsActionCount(data.needs_action_count || 0);
    setLoading(false);
  }, [filter, focusContactId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Inbox size={22} className="text-accent" />
          <h1 className="text-xl font-bold text-foreground">Inbox</h1>
          {needsActionCount > 0 && (
            <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">
              {needsActionCount}
            </span>
          )}
        </div>
        <button
          onClick={load}
          className="text-xs text-muted hover:text-foreground border border-border rounded-lg px-3 py-1.5"
        >
          Refresh
        </button>
      </div>

      <p className="text-sm text-muted -mt-2">
        All SMS threads across campaigns. Click any conversation to view the full history and reply.
        {focusContactId ? ' Showing threads for this lead.' : ''}
      </p>

      <div className="flex gap-1 border-b border-border overflow-x-auto">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors',
              filter === f.key
                ? 'border-b-2 border-accent text-accent'
                : 'text-muted hover:text-foreground'
            )}
          >
            <f.icon size={14} className={filter === f.key ? 'text-accent' : f.color} />
            {f.label}
            {f.key === 'needs_action' && needsActionCount > 0 && (
              <span className="rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                {needsActionCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        </div>
      ) : threads.length === 0 ? (
        <div className="text-center py-16 text-sm text-muted">
          No conversations in this view.
        </div>
      ) : (
        <div className="space-y-2">
          {threads.map((thread) => {
            const name =
              `${thread.contact?.first_name || ''} ${thread.contact?.last_name || ''}`.trim() ||
              thread.contact?.phone ||
              'Unknown';
            const lastActivity = thread.last_inbound_at || thread.last_outbound_at;
            const lastMsg = thread.last_message;
            const isInbound = lastMsg?.direction === 'inbound';
            const href = conversationPath({
              contactId: thread.contact_id,
              campaignId: thread.campaign_id,
              campaignType:
                (thread.campaign?.campaign_type as 'standard' | 'ai_nurture' | undefined) ||
                (thread.kind === 'ai' ? 'ai_nurture' : 'standard'),
            });

            return (
              <Link
                key={thread.id}
                href={href}
                className={cn(
                  'flex items-start justify-between rounded-xl border bg-card p-4 hover:border-accent/40 transition-colors gap-3',
                  thread.needs_attention || thread.status === 'escalated'
                    ? 'border-red-300'
                    : 'border-border'
                )}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-semibold text-foreground truncate">{name}</p>
                    {thread.needs_attention && (
                      <span className="shrink-0 rounded-full bg-red-500/15 px-1.5 py-0.5 text-[10px] font-bold text-red-600">
                        Needs Action
                      </span>
                    )}
                    <span
                      className={cn(
                        'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium',
                        STATUS_COLORS[thread.status] || 'bg-gray-100 text-gray-500'
                      )}
                    >
                      {thread.status.replace(/_/g, ' ')}
                    </span>
                    {thread.kind === 'standard' && (
                      <span className="shrink-0 rounded-full bg-muted/30 px-1.5 py-0.5 text-[10px] text-muted">
                        Drip
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted mb-1 truncate">
                    {thread.campaign?.name || 'Unknown campaign'}
                    {thread.message_count > 0 ? ` · ${thread.message_count} messages` : ''}
                    {thread.kind === 'ai' && thread.exchange_count > 0
                      ? ` · ${thread.exchange_count} AI exchanges`
                      : ''}
                  </p>
                  {lastMsg && (
                    <p
                      className={cn(
                        'text-xs truncate',
                        isInbound ? 'text-foreground font-medium' : 'text-muted'
                      )}
                    >
                      {isInbound ? '← ' : '→ '}
                      {lastMsg.body}
                    </p>
                  )}
                  {thread.escalation_reason && (
                    <p className="text-xs text-red-600 mt-0.5 truncate">⚠ {thread.escalation_reason}</p>
                  )}
                </div>
                <div className="shrink-0 text-right flex flex-col items-end gap-2">
                  <p className="text-xs text-muted flex items-center gap-1">
                    <Clock size={11} />
                    {timeAgo(lastActivity)}
                  </p>
                  {thread.conversation_id &&
                    ['active', 'escalated', 'paused', 'human_takeover', 'goal_met'].includes(
                      thread.status
                    ) && (
                      <button
                        onClick={(e) => restartConv(thread.conversation_id!, e)}
                        disabled={restarting === thread.conversation_id}
                        className="flex items-center gap-1 text-[10px] font-medium text-accent border border-accent/30 rounded-md px-2 py-1 hover:bg-accent/10 disabled:opacity-50"
                      >
                        <RefreshCw size={10} />
                        {restarting === thread.conversation_id ? '...' : 'Start fresh'}
                      </button>
                    )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
