'use client';

import { cn } from '@/lib/utils';
import { Phone, Globe, Heart } from 'lucide-react';
import type { AiCampaignGoal } from '@/types';

const goals: { value: AiCampaignGoal; label: string; desc: string; icon: typeof Phone }[] = [
  { value: 'book_call', label: 'Book a Call', desc: 'AI works toward scheduling a meeting', icon: Phone },
  { value: 'long_nurture', label: 'Long-term Nurture', desc: 'Stay top-of-mind with periodic info', icon: Heart },
  { value: 'visit_site', label: 'Drive to Website', desc: 'Get the lead to visit a landing page', icon: Globe },
];

export function GoalSelector({
  value,
  onChange,
}: {
  value: AiCampaignGoal;
  onChange: (v: AiCampaignGoal) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {goals.map((g) => (
        <button
          key={g.value}
          type="button"
          onClick={() => onChange(g.value)}
          className={cn(
            'flex flex-col items-center gap-2 rounded-xl border-2 p-4 text-center transition-all',
            value === g.value
              ? 'border-accent bg-accent/5 text-accent'
              : 'border-border bg-card text-muted hover:border-accent/40'
          )}
        >
          <g.icon size={24} />
          <span className="text-sm font-semibold">{g.label}</span>
          <span className="text-xs text-muted">{g.desc}</span>
        </button>
      ))}
    </div>
  );
}
