'use client';

import { useState } from 'react';
import { MessageSquare, Mail, Phone, ClipboardList, Sparkles, ChevronDown } from 'lucide-react';
import {
  CAMPAIGN_TEMPLATES,
  CATEGORY_LABELS,
  type CampaignTemplate,
  type TemplateStep,
} from '@/lib/campaign-templates';

type Props = {
  onSelect: (template: CampaignTemplate) => void;
  selectedId?: string | null;
};

const CATEGORY_ORDER: CampaignTemplate['category'][] = ['other', 'short', 'mid', 'long'];

function channelCounts(steps: TemplateStep[]) {
  return {
    sms: steps.filter((s) => s.step_type === 'sms').length,
    email: steps.filter((s) => s.step_type === 'email').length,
    task: steps.filter((s) => s.step_type === 'fub_task' || s.step_type === 'fub_action_plan').length,
  };
}

function durationLabel(steps: TemplateStep[]): string {
  const maxDays = steps.reduce((max, s) => Math.max(max, s.delay_days), 0);
  if (maxDays >= 1) return `${maxDays} day${maxDays === 1 ? '' : 's'}`;
  return 'Same day';
}

export function TemplatePicker({ onSelect, selectedId }: Props) {
  const [open, setOpen] = useState(true);

  const grouped = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    templates: CAMPAIGN_TEMPLATES.filter((t) => t.category === cat),
  })).filter((g) => g.templates.length > 0);

  return (
    <div className="rounded-xl border border-border bg-card mb-6">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-4"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Sparkles size={16} className="text-accent" />
          Start from a template
          <span className="font-normal text-muted">(optional — prefills the touches below)</span>
        </span>
        <ChevronDown
          size={16}
          className={`text-muted transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="space-y-5 px-5 pb-5">
          {grouped.map((group) => (
            <div key={group.category}>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted">
                {CATEGORY_LABELS[group.category]}
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {group.templates.map((t) => {
                  const counts = channelCounts(t.steps);
                  const isSelected = selectedId === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => onSelect(t)}
                      className={`flex flex-col rounded-lg border p-3 text-left transition-colors ${
                        isSelected
                          ? 'border-accent bg-accent/5'
                          : 'border-border bg-background hover:border-accent/40'
                      }`}
                    >
                      <span className="text-sm font-semibold text-foreground">{t.name}</span>
                      <span className="mt-1 line-clamp-3 text-xs text-muted">{t.description}</span>
                      <span className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-muted">
                        <span className="font-medium text-foreground/80">{durationLabel(t.steps)}</span>
                        <span className="flex items-center gap-1">
                          <MessageSquare size={12} /> {counts.sms}
                        </span>
                        <span className="flex items-center gap-1">
                          <Mail size={12} /> {counts.email}
                        </span>
                        <span className="flex items-center gap-1">
                          <Phone size={12} /> {counts.task}
                        </span>
                        <span className="flex items-center gap-1">
                          <ClipboardList size={12} /> {t.steps.length} touches
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
