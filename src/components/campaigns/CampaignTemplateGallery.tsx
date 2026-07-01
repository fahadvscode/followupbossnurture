'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  MessageSquare,
  Mail,
  Phone,
  ClipboardList,
  Sparkles,
  FilePlus,
  Eye,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TemplatePreviewModal } from '@/components/campaigns/TemplatePreviewModal';
import {
  CAMPAIGN_TEMPLATES,
  CATEGORY_LABELS,
  TEMPLATE_CATEGORY_ORDER,
  templateChannelCounts,
  templateDurationLabel,
  type CampaignTemplate,
} from '@/lib/campaign-templates';

export function CampaignTemplateGallery() {
  const router = useRouter();
  const [previewTemplate, setPreviewTemplate] = useState<CampaignTemplate | null>(null);

  const grouped = TEMPLATE_CATEGORY_ORDER.map((cat) => ({
    category: cat,
    templates: CAMPAIGN_TEMPLATES.filter((t) => t.category === cat),
  })).filter((g) => g.templates.length > 0);

  function goToSetup(id: string) {
    router.push(`/campaigns/new/setup?template=${encodeURIComponent(id)}`);
  }

  return (
    <>
      <div className="mb-8">
        <Link
          href="/campaigns/new/setup"
          className="group flex items-start gap-4 rounded-xl border border-dashed border-border bg-card p-5 transition-colors hover:border-accent/50 hover:bg-accent/5"
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-muted/20 text-muted group-hover:bg-accent/10 group-hover:text-accent transition-colors">
            <FilePlus size={24} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-foreground">Start from scratch</h2>
            <p className="text-sm text-muted mt-1">
              Blank campaign with one touch — build your own schedule step by step.
            </p>
          </div>
          <ArrowRight size={18} className="mt-1 shrink-0 text-muted group-hover:text-accent transition-colors" />
        </Link>
      </div>

      <div className="mb-4 flex items-center gap-2">
        <Sparkles size={18} className="text-accent" />
        <h2 className="text-lg font-semibold text-foreground">Or start from a template</h2>
      </div>
      <p className="text-sm text-muted mb-6 max-w-2xl">
        Proven multi-channel cadences with SMS, email, and Follow Up Boss call tasks. Preview any
        template, then customize triggers and copy before you go live.
      </p>

      <div className="space-y-8">
        {grouped.map((group) => (
          <section key={group.category}>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
              {CATEGORY_LABELS[group.category]}
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {group.templates.map((t) => {
                const counts = templateChannelCounts(t.steps);
                return (
                  <article
                    key={t.id}
                    className="flex flex-col rounded-xl border border-border bg-card p-4 shadow-sm transition-colors hover:border-accent/40"
                  >
                    <h3 className="text-sm font-semibold text-foreground">{t.name}</h3>
                    <p className="mt-1.5 line-clamp-3 text-xs text-muted flex-1">{t.description}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-muted">
                      <span className="font-medium text-foreground/80">
                        {templateDurationLabel(t.steps)}
                      </span>
                      <span className="flex items-center gap-0.5">
                        <MessageSquare size={11} /> {counts.sms}
                      </span>
                      <span className="flex items-center gap-0.5">
                        <Mail size={11} /> {counts.email}
                      </span>
                      <span className="flex items-center gap-0.5">
                        <Phone size={11} /> {counts.task}
                      </span>
                      <span className="flex items-center gap-0.5">
                        <ClipboardList size={11} /> {t.steps.length}
                      </span>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => setPreviewTemplate(t)}
                      >
                        <Eye size={14} className="mr-1.5" />
                        Preview
                      </Button>
                      <Button type="button" size="sm" onClick={() => goToSetup(t.id)}>
                        Use template
                      </Button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <TemplatePreviewModal
        template={previewTemplate}
        open={previewTemplate !== null}
        onClose={() => setPreviewTemplate(null)}
        onUse={
          previewTemplate
            ? () => {
                const id = previewTemplate.id;
                setPreviewTemplate(null);
                goToSetup(id);
              }
            : undefined
        }
      />
    </>
  );
}
