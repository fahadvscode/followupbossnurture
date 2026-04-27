'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Plus, Sparkles } from 'lucide-react';
import { AiCampaignCard } from '@/components/ai-nurture/AiCampaignCard';

interface CampaignRow {
  id: string;
  name: string;
  status: 'active' | 'paused' | 'archived';
  ai_goal: 'book_call' | 'long_nurture' | 'visit_site' | null;
  active_conversations: number;
  total_enrolled: number;
}

export default function AiNurturePage() {
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch('/api/ai-campaigns');
    const data = await res.json();
    setCampaigns(data.campaigns || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
            <Sparkles size={22} className="text-accent" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">AI Nurture Campaigns</h1>
            <p className="text-sm text-muted">Conversational AI-driven lead nurturing via SMS</p>
          </div>
        </div>
        <Link
          href="/ai-nurture/new"
          className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent/90"
        >
          <Plus size={16} /> New Campaign
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        </div>
      ) : campaigns.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
          <Sparkles size={40} className="mx-auto text-muted mb-3" />
          <h2 className="text-lg font-semibold text-foreground mb-1">No AI campaigns yet</h2>
          <p className="text-sm text-muted mb-4">
            Create your first AI-powered nurture campaign to start engaging leads automatically.
          </p>
          <Link
            href="/ai-nurture/new"
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent/90"
          >
            <Plus size={16} /> Create Campaign
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {campaigns.map((c) => (
            <AiCampaignCard
              key={c.id}
              id={c.id}
              name={c.name}
              status={c.status}
              goal={c.ai_goal}
              activeConversations={c.active_conversations}
              totalEnrolled={c.total_enrolled}
            />
          ))}
        </div>
      )}
    </div>
  );
}
