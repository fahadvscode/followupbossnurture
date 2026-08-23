'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  InboxThreadListItem,
  type InboxThreadListItemData,
} from '@/components/inbox/InboxThreadListItem';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';

type Props = {
  selectedContactId?: string | null;
  selectedCampaignId?: string | null;
};

function sortThreads(threads: InboxThreadListItemData[]): InboxThreadListItemData[] {
  return [...threads].sort((a, b) => {
    if (a.unread !== b.unread) return a.unread ? -1 : 1;
    const aTime = a.last_message?.sent_at || a.last_inbound_at || a.last_outbound_at || '';
    const bTime = b.last_message?.sent_at || b.last_inbound_at || b.last_outbound_at || '';
    return new Date(bTime).getTime() - new Date(aTime).getTime();
  });
}

export function InboxThreadList({ selectedContactId, selectedCampaignId }: Props) {
  const searchParams = useSearchParams();
  const focusContactId = searchParams.get('contactId');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [threads, setThreads] = useState<InboxThreadListItemData[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const hasLoadedRef = useRef(false);
  const selectedRef = useRef({ contactId: selectedContactId, campaignId: selectedCampaignId });
  selectedRef.current = { contactId: selectedContactId, campaignId: selectedCampaignId };

  useEffect(() => {
    const t = window.setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const applyThreads = useCallback((next: InboxThreadListItemData[], unread: number) => {
    const { contactId, campaignId } = selectedRef.current;
    const marked = next.map((t) =>
      contactId && campaignId && t.contact_id === contactId && t.campaign_id === campaignId
        ? { ...t, unread: false }
        : t
    );
    const selectedWasUnread = next.some(
      (t) => t.unread && t.contact_id === contactId && t.campaign_id === campaignId
    );
    setThreads(sortThreads(marked));
    setUnreadCount(Math.max(0, unread - (selectedWasUnread ? 1 : 0)));
  }, []);

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent && !hasLoadedRef.current) setLoading(true);
      const q = new URLSearchParams({ filter: 'all' });
      if (focusContactId) q.set('contactId', focusContactId);
      if (search) q.set('search', search);
      const res = await fetch(`/api/inbox?${q.toString()}`);
      const data = await res.json();
      applyThreads(data.threads || [], data.unread_count || 0);
      hasLoadedRef.current = true;
      setLoading(false);
    },
    [focusContactId, search, applyThreads]
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === 'hidden') return;
      void load({ silent: true });
    };
    const interval = window.setInterval(tick, 15000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [load]);

  useEffect(() => {
    if (!selectedContactId || !selectedCampaignId) return;
    setThreads((prev) =>
      sortThreads(
        prev.map((t) =>
          t.contact_id === selectedContactId && t.campaign_id === selectedCampaignId
            ? { ...t, unread: false }
            : t
        )
      )
    );
  }, [selectedCampaignId, selectedContactId]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 space-y-2.5 border-b border-border px-3 pb-2.5 pt-3 sm:px-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <h1 className="text-lg font-bold text-foreground">Messages</h1>
            {unreadCount > 0 && (
              <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-white">
                {unreadCount}
              </span>
            )}
          </div>
        </div>

        <div className="relative">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
          />
          <Input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search name, phone, email…"
            className="pl-9 pr-9"
          />
          {searchInput ? (
            <button
              type="button"
              onClick={() => setSearchInput('')}
              className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted hover:bg-card-hover hover:text-foreground"
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          ) : null}
        </div>

        {search ? (
          <p className="text-xs text-muted">
            {loading
              ? 'Searching…'
              : `${threads.length} result${threads.length === 1 ? '' : 's'} for “${search}”`}
          </p>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-2 sm:px-3">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          </div>
        ) : threads.length === 0 ? (
          <div className="px-4 py-16 text-center text-sm text-muted">
            {search ? `No conversations matching “${search}”.` : 'No SMS conversations yet.'}
          </div>
        ) : (
          <div className="space-y-1">
            {threads.map((thread) => (
              <InboxThreadListItem
                key={thread.id}
                thread={thread}
                selected={
                  thread.contact_id === selectedContactId &&
                  thread.campaign_id === selectedCampaignId
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
