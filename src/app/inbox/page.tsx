'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { AlertCircle, Bot, UserCheck, Activity, Inbox, Clock } from 'lucide-react';

type Filter = 'needs_action' | 'escalated' | 'human_takeover' | 'active' | 'all';

interface ConvRow {
  id: string;
  enrollment_id: string;
  contact_id: string;
  campaign_id: string;
  status: string;
  needs_attention: boolean;
  exchange_count: number;
  follow_up_count: number;
  last_outbound_at: string | null;
  last_inbound_at: string | null;
  escalation_reason: string | null;
  takeover_at: string | null;
  contact: { id: string; first_name: string; last_name: string; phone: string } | null;
  campaign: { id: string; name: string } | null;
  last_message: { body: string; direction: string; sent_at: string } | null;
}

const FILTERS: { key: Filter; label: string; icon: React.ElementType; color: string }[] = [
  { key: 'needs_action', label: 'Needs Action', icon: AlertCircle, color: 'text-red-500' },
  { key: 'escalated', label: 'Escalated', icon: AlertCircle, color: 'text-orange-500' },
  { key: 'human_takeover', label: 'Taken Over', icon: UserCheck, color: 'text-blue-500' },
  { key: 'active', label: 'Active AI', icon: Bot, color: 'text-green-500' },
  { key: 'all', label: 'All', icon: Activity, color: 'text-muted' },
];

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-500/15 text-green-600',
  escalated: 'bg-red-500/15 text-red-600',
  human_takeover: 'bg-blue-500/15 text-blue-600',
  paused: 'bg-yellow-500/15 text-yellow-600',
  goal_met: 'bg-purple-500/15 text-purple-600',
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
  const [filter, setFilter] = useState<Filter>('needs_action');
  const [conversations, setConversations] = useState<ConvRow[]>([]);
  const [needsActionCount, setNeedsActionCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/ai-conversations?filter=${filter}`);
    const data = await res.json();
    setConversations(data.conversations || []);
    setNeedsActionCount(data.needs_action_count || 0);
    setLoading(false);
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Inbox size={22} className="text-accent" />
          <h1 className="text-xl font-bold text-foreground">AI Inbox</h1>
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

      {/* Filter tabs */}
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

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        </div>
      ) : conversations.length === 0 ? (
        <div className="text-center py-16 text-sm text-muted">
          No conversations in this view.
        </div>
      ) : (
        <div className="space-y-2">
          {conversations.map((conv) => {
            const name =
              `${conv.contact?.first_name || ''} ${conv.contact?.last_name || ''}`.trim() ||
              conv.contact?.phone ||
              'Unknown';
            const lastActivity = conv.last_inbound_at || conv.last_outbound_at;
            const lastMsg = conv.last_message;
            const isInbound = lastMsg?.direction === 'inbound';

            return (
              <Link
                key={conv.id}
                href={`/ai-nurture/${conv.campaign_id}/conversations/${conv.contact_id}`}
                className={cn(
                  'flex items-start justify-between rounded-xl border bg-card p-4 hover:border-accent/40 transition-colors gap-3',
                  conv.needs_attention || conv.status === 'escalated'
                    ? 'border-red-300'
                    : 'border-border'
                )}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-semibold text-foreground truncate">{name}</p>
                    {conv.needs_attention && (
                      <span className="shrink-0 rounded-full bg-red-500/15 px-1.5 py-0.5 text-[10px] font-bold text-red-600">
                        Needs Action
                      </span>
                    )}
                    <span
                      className={cn(
                        'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium',
                        STATUS_COLORS[conv.status] || 'bg-gray-100 text-gray-500'
                      )}
                    >
                      {conv.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <p className="text-xs text-muted mb-1 truncate">
                    {conv.campaign?.name || 'Unknown campaign'}
                    {' · '}
                    {conv.exchange_count} exchanges
                  </p>
                  {lastMsg && (
                    <p className={cn('text-xs truncate', isInbound ? 'text-foreground font-medium' : 'text-muted')}>
                      {isInbound ? '← ' : '→ '}
                      {lastMsg.body}
                    </p>
                  )}
                  {conv.escalation_reason && (
                    <p className="text-xs text-red-600 mt-0.5 truncate">⚠ {conv.escalation_reason}</p>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs text-muted flex items-center gap-1 justify-end">
                    <Clock size={11} />
                    {timeAgo(lastActivity)}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
