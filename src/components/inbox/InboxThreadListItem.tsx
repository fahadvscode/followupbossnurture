'use client';

import Link from 'next/link';
import { cn, formatPhone } from '@/lib/utils';
import { conversationPath } from '@/lib/conversation-url';
import { ArrowDownLeft, Check, CheckCheck, Mail, Phone } from 'lucide-react';

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
  contact: {
    id: string;
    first_name: string;
    last_name: string;
    phone: string;
    email?: string | null;
  } | null;
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
  selected?: boolean;
};

export function InboxThreadListItem({ thread, selected }: Props) {
  const name =
    `${thread.contact?.first_name || ''} ${thread.contact?.last_name || ''}`.trim() ||
    thread.contact?.phone ||
    'Unknown';
  const phone = thread.contact?.phone ? formatPhone(thread.contact.phone) : '';
  const email = thread.contact?.email?.trim() || '';

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
      aria-current={selected ? 'page' : undefined}
      className={cn(
        'flex items-start gap-3 rounded-xl border px-3 py-2.5 transition-colors hover:bg-card-hover active:bg-card-hover',
        selected
          ? 'border-accent bg-accent/10'
          : thread.unread
            ? 'border-accent/40 bg-accent/[0.06]'
            : 'border-border bg-card'
      )}
    >
      <div className="relative mt-0.5 shrink-0">
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

        {(phone || email) && (
          <div className="mt-0.5 space-y-0.5 text-[11px] text-muted">
            {phone ? (
              <p className="flex min-w-0 items-center gap-1 truncate">
                <Phone size={10} className="shrink-0" />
                <span className="truncate">{phone}</span>
              </p>
            ) : null}
            {email ? (
              <p className="flex min-w-0 items-center gap-1 truncate">
                <Mail size={10} className="shrink-0" />
                <span className="truncate">{email}</span>
              </p>
            ) : null}
          </div>
        )}

        <p className="mt-0.5 truncate text-[11px] text-muted/80">
          {thread.campaign?.name || 'Campaign'}
        </p>

        {lastMsg && (
          <div className="mt-1 flex min-w-0 items-start gap-1">
            {!isInboundLast && (
              <span className="mt-0.5 flex shrink-0 items-center gap-0.5 text-[11px] text-muted">
                <CheckCheck size={12} className="text-accent/70" />
                <span>You:</span>
              </span>
            )}
            {isInboundLast && thread.lead_has_replied && (
              <ArrowDownLeft
                size={12}
                className={cn(
                  'mt-0.5 shrink-0',
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
          <p className="mt-1 flex items-center gap-1 text-[12px] text-success">
            <ArrowDownLeft size={12} /> Lead replied
          </p>
        )}

        {thread.escalation_reason && (
          <p className="mt-0.5 truncate text-[11px] text-red-600">⚠ {thread.escalation_reason}</p>
        )}
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1.5 self-center">
        {thread.unread ? (
          <span className="h-2.5 w-2.5 rounded-full bg-accent" aria-hidden />
        ) : thread.lead_has_replied && isInboundLast ? (
          <span className="whitespace-nowrap text-[10px] font-medium text-success">Replied</span>
        ) : thread.lead_has_replied ? (
          <span className="flex items-center gap-0.5 text-[10px] text-muted">
            <Check size={10} /> Sent
          </span>
        ) : (
          <span className="text-[10px] text-muted/60">No reply</span>
        )}
      </div>
    </Link>
  );
}
