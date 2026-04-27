'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { AiCampaignForm } from '@/components/ai-nurture/AiCampaignForm';

export default function NewAiCampaignPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/ai-nurture"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted hover:text-foreground hover:bg-card-hover"
        >
          <ArrowLeft size={16} />
        </Link>
        <h1 className="text-xl font-bold text-foreground">Create AI Nurture Campaign</h1>
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <AiCampaignForm />
      </div>
    </div>
  );
}
