'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import { conversationPath } from '@/lib/conversation-url';
import { ArrowDownLeft, Check, CheckCheck, Clock, RefreshCw } from 'lucide-react';

export type InboxThreadListItemData = {
  id: string;
  kind: 'ai' | 'standard';
  conversation_id: string | null;
  contact_id: string;
  campaign_id: string;
  status: string;
  unread: boolean;
  lead_has_replied: boolean;
  message_count: number;
  exchange_count: number;
  last_inbound_at: string | null;
  last_outbound_at: string | null;
  escalation_reason: string | null;
  contact: { id: string; first_name: string; last_name: string; phone: string; email?: string | null } | null;
  campaign: { id: string; name: string; campaign_type: string } | null;
  last_message: { body: string; direction: string; sent_at: string } | null;
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function formatListTime(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);

  if (d >= startOfToday) {
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }
  if (d >= startOfYesterday) return 'Yesterday';
  if (d.getFullYear() === now.getFullYear()) {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
}

function previewText(body: string, max = 72): string {
  const oneLine = body.replace(/\s+/g, ' ').trim();
  return oneLine.length > max ? `${oneLine.slice(0, max)}…` : oneLine;
}

type Props = {
  thread: InboxThreadListItemData;
  onRestart?: (convId: string, e: React.MouseEvent) => void;
  restarting?: boolean;
};

export function InboxThreadListItem({ thread, onRestart, restarting }: Props) {
  const name =
    `${thread.contact?.first_name || ''} ${thread.contact?.last_name || ''}`.trim() ||
    thread.contact?.phone ||
    'Unknown';

  const lastMsg = thread.last_message;
  const isInboundLast = lastMsg?.direction === 'inbound';
  const lastActivity = lastMsg?.sent_at || thread.last_inbound_at || thread.last_outbound_at;
  const href = conversationPath({
    contactId: thread.contact_id,
    campaignId: thread.campaign_id,
    campaignType:
      (thread.campaign?.campaign_type as 'standard' | 'ai_nurture' | undefined) ||
      (thread.kind === 'ai' ? 'ai_nurture' : 'standard'),
  });

  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-3 rounded-xl border px-3 py-3 transition-colors hover:bg-card-hover',
        thread.unread ? 'border-accent/40 bg-accent/[0.06]' : 'border-border bg-card'
      )}
    >
      {/* Avatar + unread dot */}
      <div className="relative shrink-0">
        <div
          className={cn(
            'flex h-11 w-11 items-center justify-center rounded-full text-sm font-semibold',
            thread.unread
              ? 'bg-accent text-white'
              : thread.lead_has_replied
                ? 'bg-success/15 text-success'
                : 'bg-muted/30 text-muted'
          )}
        >
          {initials(name)}
        </div>
        {thread.unread && (
          <span
            className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-accent ring-2 ring-card"
            aria-label="Unread"
          />
        )}
        {!thread.unread && thread.lead_has_replied && isInboundLast && (
          <span
            className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-success text-white ring-2 ring-card"
            aria-label="Lead replied"
          >
            <ArrowDownLeft size={10} strokeWidth={3} />
          </span>
        )}
      </div>

      {/* Main content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p
            className={cn(
              'truncate text-[15px]',
              thread.unread ? 'font-bold text-foreground' : 'font-medium text-foreground'
            )}
          >
            {name}
          </p>
          <span
            className={cn(
              'shrink-0 text-[11px] tabular-nums',
              thread.unread ? 'font-semibold text-accent' : 'text-muted'
            )}
          >
            {formatListTime(lastActivity)}
          </span>
        </div>

        <p className="truncate text-[11px] text-muted mt-0.5">
          {thread.campaign?.name || 'Campaign'}
          {thread.contact?.phone ? ` · ${thread.contact.phone}` : ''}
          {thread.contact?.email ? ` · ${thread.contact.email}` : ''}
        </p>

        {lastMsg && (
          <div className="mt-1 flex items-start gap-1 min-w-0">
            {!isInboundLast && (
              <span className="shrink-0 text-[11px] text-muted flex items-center gap-0.5 mt-0.5">
                <CheckCheck size={12} className="text-accent/70" />
                <span>You:</span>
              </span>
            )}
            {isInboundLast && thread.lead_has_replied && (
              <ArrowDownLeft
                size={12}
                className={cn(
                  'shrink-0 mt-0.5',
                  thread.unread ? 'text-accent' : 'text-success'
                )}
                strokeWidth={2.5}
              />
            )}
            <p
              className={cn(
                'truncate text-[13px] leading-snug',
                thread.unread
                  ? 'font-semibold text-foreground'
                  : isInboundLast
                    ? 'text-foreground/90'
                    : 'text-muted'
              )}
            >
              {previewText(lastMsg.body)}
            </p>
          </div>
        )}

        {!lastMsg && thread.lead_has_replied && (
          <p className="mt-1 text-[12px] text-success flex items-center gap-1">
            <ArrowDownLeft size={12} /> Lead replied
          </p>
        )}

        {thread.escalation_reason && (
          <p className="text-[11px] text-red-600 mt-0.5 truncate">⚠ {thread.escalation_reason}</p>
        )}
      </div>

      {/* Trailing status */}
      <div className="shrink-0 flex flex-col items-end gap-1.5 self-center">
        {thread.unread ? (
          <span className="h-2.5 w-2.5 rounded-full bg-accent" aria-hidden />
        ) : thread.lead_has_replied && isInboundLast ? (
          <span className="text-[10px] font-medium text-success whitespace-nowrap">Replied</span>
        ) : thread.lead_has_replied ? (
          <span className="text-[10px] text-muted flex items-center gap-0.5">
            <Check size={10} /> Sent
          </span>
        ) : (
          <span className="text-[10px] text-muted/60">No reply</span>
        )}

        {thread.conversation_id &&
          onRestart &&
          ['active', 'escalated', 'paused', 'human_takeover', 'goal_met'].includes(thread.status) && (
            <button
              type="button"
              onClick={(e) => onRestart(thread.conversation_id!, e)}
              disabled={restarting}
              className="flex items-center gap-1 text-[10px] font-medium text-accent border border-accent/30 rounded-md px-2 py-0.5 hover:bg-accent/10 disabled:opacity-50"
            >
              <RefreshCw size={9} />
              {restarting ? '…' : 'Fresh'}
            </button>
          )}
      </div>
    </Link>
  );
}
