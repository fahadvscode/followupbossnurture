import { Badge } from '@/components/ui/badge';
import { formatDateTime } from '@/lib/utils';
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import type { DripMessage } from '@/types';

interface ContactTimelineProps {
  messages: DripMessage[];
  campaignNames: Record<string, string>;
  /** campaignId → step_number → "Day 1, 0m" */
  stepDayLabelsByCampaign?: Record<string, Record<number, string>>;
}

export function ContactTimeline({
  messages,
  campaignNames,
  stepDayLabelsByCampaign,
}: ContactTimelineProps) {
  if (messages.length === 0) {
    return (
      <div className="text-center py-10 text-sm text-muted">
        No messages yet for this contact.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {messages.map((msg) => (
        <div key={msg.id} className="flex gap-3">
          <div className={`mt-1 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
            msg.direction === 'inbound' ? 'bg-success/15' : 'bg-accent/15'
          }`}>
            {msg.direction === 'inbound' ? (
              <ArrowDownLeft size={14} className="text-success" />
            ) : (
              <ArrowUpRight size={14} className="text-accent" />
            )}
          </div>
          <div className="flex-1 min-w-0 bg-card-hover rounded-lg px-4 py-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium text-foreground">
                {msg.direction === 'inbound' ? 'Reply' : 'Sent'}
              </span>
              {msg.campaign_id && campaignNames[msg.campaign_id] && (
                <Badge variant="info">{campaignNames[msg.campaign_id]}</Badge>
              )}
              {msg.step_number != null &&
                msg.campaign_id &&
                stepDayLabelsByCampaign?.[msg.campaign_id]?.[msg.step_number] && (
                  <span className="text-xs text-muted">
                    {stepDayLabelsByCampaign[msg.campaign_id][msg.step_number]}
                  </span>
                )}
              <Badge variant={
                msg.status === 'delivered' ? 'success' :
                msg.status === 'failed' ? 'danger' :
                msg.status === 'received' ? 'success' : 'default'
              }>
                {msg.status}
              </Badge>
            </div>
            <p className="text-sm text-foreground">{msg.body}</p>
            <p className="text-xs text-muted mt-1">{formatDateTime(msg.sent_at || msg.created_at)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
