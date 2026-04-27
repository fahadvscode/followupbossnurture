import { Badge } from '@/components/ui/badge';
import { formatDateTime } from '@/lib/utils';
import { MessageCircle } from 'lucide-react';
import type { DripMessage, DripContact } from '@/types';
import Link from 'next/link';

interface ReplyFeedProps {
  replies: (DripMessage & { contact?: DripContact })[];
  /** step_number → day label for this campaign */
  stepDayLabels?: Record<number, string>;
}

export function ReplyFeed({ replies, stepDayLabels }: ReplyFeedProps) {
  if (replies.length === 0) {
    return (
      <div className="text-center py-10 text-sm text-muted">
        No replies yet for this campaign.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {replies.map((reply) => (
        <div key={reply.id} className="bg-card-hover border border-border rounded-lg px-4 py-3">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <MessageCircle size={14} className="text-success" />
              <Link
                href={`/contacts/${reply.contact_id}`}
                className="text-sm font-medium text-foreground hover:text-accent"
              >
                {reply.contact ? `${reply.contact.first_name || ''} ${reply.contact.last_name || ''}`.trim() : 'Unknown'}
              </Link>
              {reply.step_number != null && stepDayLabels?.[reply.step_number] && (
                <Badge variant="default">After {stepDayLabels[reply.step_number]}</Badge>
              )}
            </div>
            <span className="text-xs text-muted">{formatDateTime(reply.created_at)}</span>
          </div>
          <p className="text-sm text-foreground pl-6">{reply.body}</p>
        </div>
      ))}
    </div>
  );
}
