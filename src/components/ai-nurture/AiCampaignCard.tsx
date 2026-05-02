'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { MessageSquare, Users, Sparkles, Copy } from 'lucide-react';
import type { AiCampaignGoal, CampaignStatus } from '@/types';

const goalLabels: Record<AiCampaignGoal, string> = {
  book_call: 'Book a Call',
  long_nurture: 'Long Nurture',
  visit_site: 'Drive to Site',
};

const statusColors: Record<CampaignStatus, string> = {
  active: 'bg-green-500/15 text-green-600',
  paused: 'bg-yellow-500/15 text-yellow-600',
  archived: 'bg-gray-500/15 text-gray-500',
};

interface Props {
  id: string;
  name: string;
  status: CampaignStatus;
  goal: AiCampaignGoal | null;
  activeConversations: number;
  totalEnrolled: number;
}

export function AiCampaignCard({ id, name, status, goal, activeConversations, totalEnrolled }: Props) {
  const router = useRouter();
  const [duping, setDuping] = useState(false);

  async function duplicate(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDuping(true);
    try {
      const res = await fetch(`/api/campaigns/${id}/duplicate`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        window.alert(typeof data.error === 'string' ? data.error : 'Could not duplicate campaign.');
        return;
      }
      const newId = (data.campaign as { id?: string } | undefined)?.id;
      if (newId) router.push(`/ai-nurture/${newId}`);
    } finally {
      setDuping(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card transition-all hover:border-accent/40 hover:shadow-sm">
      <div className="flex items-stretch gap-0">
        <Link href={`/ai-nurture/${id}`} className="min-w-0 flex-1 p-5 block">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/10">
                <Sparkles size={20} className="text-accent" />
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-foreground truncate">{name}</h3>
                {goal && <span className="text-xs text-muted">{goalLabels[goal]}</span>}
              </div>
            </div>
            <span className={cn('shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium', statusColors[status])}>
              {status}
            </span>
          </div>

          <div className="mt-4 flex gap-5 text-sm text-muted">
            <span className="flex items-center gap-1.5">
              <MessageSquare size={14} />
              {activeConversations} active
            </span>
            <span className="flex items-center gap-1.5">
              <Users size={14} />
              {totalEnrolled} enrolled
            </span>
          </div>
        </Link>
        <div className="flex flex-col items-center justify-center border-l border-border px-2 py-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-9 w-9 p-0 text-muted hover:text-foreground"
            disabled={duping}
            title="Duplicate campaign"
            aria-label="Duplicate campaign"
            onClick={(e) => void duplicate(e)}
          >
            <Copy size={16} />
          </Button>
        </div>
      </div>
    </div>
  );
}
