'use client';

import { Suspense, useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import {
  InboxThreadListItem,
  type InboxThreadListItemData,
} from '@/components/inbox/InboxThreadListItem';
import { useSearchParams } from 'next/navigation';
import { AlertCircle, Bot, UserCheck, Activity, Inbox, Mail, Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';

type Filter = 'unread' | 'needs_action' | 'escalated' | 'human_takeover' | 'active' | 'all';

const FILTERS: { key: Filter; label: string; icon: React.ElementType; color: string }[] = [
  { key: 'all', label: 'All SMS', icon: Activity, color: 'text-muted' },
  { key: 'unread', label: 'Unread', icon: Mail, color: 'text-accent' },
  { key: 'needs_action', label: 'Needs Action', icon: AlertCircle, color: 'text-red-500' },
  { key: 'escalated', label: 'Escalated', icon: AlertCircle, color: 'text-orange-500' },
  { key: 'human_takeover', label: 'Taken Over', icon: UserCheck, color: 'text-blue-500' },
  { key: 'active', label: 'Active AI', icon: Bot, color: 'text-green-500' },
];

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
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [threads, setThreads] = useState<InboxThreadListItemData[]>([]);
  const [needsActionCount, setNeedsActionCount] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
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

  useEffect(() => {
    const t = window.setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const load = useCallback(async () => {
    setLoading(true);
    const q = new URLSearchParams({ filter });
    if (focusContactId) q.set('contactId', focusContactId);
    if (search) q.set('search', search);
    const res = await fetch(`/api/inbox?${q.toString()}`);
    const data = await res.json();
    setThreads(data.threads || []);
    setNeedsActionCount(data.needs_action_count || 0);
    setUnreadCount(data.unread_count || 0);
    setLoading(false);
  }, [filter, focusContactId, search]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Inbox size={22} className="text-accent" />
          <h1 className="text-xl font-bold text-foreground">SMS Inbox</h1>
          {unreadCount > 0 && (
            <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-white">
              {unreadCount}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={load}
          className="text-xs text-muted hover:text-foreground border border-border rounded-lg px-3 py-1.5"
        >
          Refresh
        </button>
      </div>

      <p className="text-sm text-muted -mt-2">
        All SMS conversations. Use the <strong className="font-medium text-foreground/80">Unread</strong> tab for messages you have not opened yet.{' '}
        <span className="inline-flex items-center gap-3 text-xs">
          <span>
            <span className="inline-block h-2 w-2 rounded-full bg-accent mr-1" />
            Unread
          </span>
          <span>
            <span className="inline-block h-2 w-2 rounded-full bg-success mr-1" />
            Replied
          </span>
          <span className="text-muted/70">No dot = no reply yet</span>
        </span>
      </p>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
        <Input
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search name, phone, email, or message…"
          className="pl-9 pr-9"
        />
        {searchInput ? (
          <button
            type="button"
            onClick={() => setSearchInput('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-md text-muted hover:text-foreground hover:bg-card-hover"
            aria-label="Clear search"
          >
            <X size={14} />
          </button>
        ) : null}
      </div>

      {search ? (
        <p className="text-xs text-muted">
          {loading ? 'Searching…' : `${threads.length} result${threads.length === 1 ? '' : 's'} for “${search}”`}
        </p>
      ) : null}

      <div className="flex gap-1 border-b border-border overflow-x-auto">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
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
            {f.key === 'unread' && unreadCount > 0 && (
              <span className="rounded-full bg-accent px-1.5 text-[10px] font-bold text-white">
                {unreadCount}
              </span>
            )}
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
          {search
            ? `No conversations matching “${search}”.`
            : filter === 'unread'
              ? 'No unread SMS messages — you are caught up.'
              : 'No conversations in this view.'}
        </div>
      ) : (
        <div className="space-y-1">
          {threads.map((thread) => (
            <InboxThreadListItem
              key={thread.id}
              thread={thread}
              onRestart={restartConv}
              restarting={restarting === thread.conversation_id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
