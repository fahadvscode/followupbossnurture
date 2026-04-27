import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { MessageSquare, Users, ArrowUpRight } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import type { DripCampaign } from '@/types';

interface CampaignCardProps {
  campaign: DripCampaign;
  stats: {
    enrolled: number;
    active: number;
    messages_sent: number;
    replies: number;
  };
  /** Schedule preview: Day 1, 0m · Day 1, 5m · Day 2 … */
  stepDayLabels?: string[];
}

const MAX_DAY_LABELS_ON_CARD = 12;

export function CampaignCard({ campaign, stats, stepDayLabels = [] }: CampaignCardProps) {
  const labels = stepDayLabels.slice(0, MAX_DAY_LABELS_ON_CARD);
  const moreCount = stepDayLabels.length - labels.length;
  return (
    <Link href={`/campaigns/${campaign.id}`}>
      <Card className="hover:border-accent/30 transition-all cursor-pointer">
        <CardContent className="p-5">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="text-base font-semibold text-foreground">{campaign.name}</h3>
              {campaign.description && (
                <p className="text-sm text-muted mt-0.5 line-clamp-1">{campaign.description}</p>
              )}
            </div>
            <Badge variant={
              campaign.status === 'active' ? 'success' :
              campaign.status === 'paused' ? 'warning' : 'default'
            }>
              {campaign.status}
            </Badge>
          </div>

          <div className="flex flex-wrap gap-1.5 mb-4">
            {(campaign.trigger_tags || []).map((tag) => (
              <Badge key={tag} variant="info">{tag}</Badge>
            ))}
            {(campaign.trigger_sources || []).map((src) => (
              <Badge key={src} variant="default">{src}</Badge>
            ))}
          </div>

          {labels.length > 0 && (
            <div className="mb-4">
              <p className="text-[10px] font-medium text-muted uppercase tracking-wide mb-1.5">Schedule</p>
              <p className="text-xs text-foreground/90 leading-relaxed">
                {labels.map((label, i) => (
                  <span key={i}>
                    {i > 0 && <span className="text-muted mx-1">·</span>}
                    {label}
                  </span>
                ))}
                {moreCount > 0 && (
                  <span className="text-muted">
                    <span className="mx-1">·</span>+{moreCount} more
                  </span>
                )}
              </p>
            </div>
          )}

          <div className="grid grid-cols-4 gap-3">
            <div>
              <p className="text-lg font-bold text-foreground">{stats.enrolled}</p>
              <p className="text-xs text-muted">Enrolled</p>
            </div>
            <div>
              <p className="text-lg font-bold text-foreground">{stats.active}</p>
              <p className="text-xs text-muted">Active</p>
            </div>
            <div>
              <p className="text-lg font-bold text-foreground">{stats.messages_sent}</p>
              <p className="text-xs text-muted">Sent</p>
            </div>
            <div>
              <p className="text-lg font-bold text-success">{stats.replies}</p>
              <p className="text-xs text-muted">Replies</p>
            </div>
          </div>

          <p className="text-xs text-muted mt-3">Created {formatDate(campaign.created_at)}</p>
        </CardContent>
      </Card>
    </Link>
  );
}
