'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import { MessageSquare, Users, Sparkles } from 'lucide-react';
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
  return (
    <Link
      href={`/ai-nurture/${id}`}
      className="block rounded-xl border border-border bg-card p-5 transition-all hover:border-accent/40 hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
            <Sparkles size={20} className="text-accent" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">{name}</h3>
            {goal && (
              <span className="text-xs text-muted">{goalLabels[goal]}</span>
            )}
          </div>
        </div>
        <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', statusColors[status])}>
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
  );
}
