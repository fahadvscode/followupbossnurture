'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Settings, Sparkles, MessageSquare, Users, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DuplicateCampaignButton } from '@/components/campaigns/DuplicateCampaignButton';
import { KnowledgeManager } from '@/components/ai-nurture/KnowledgeManager';
import { MediaManager } from '@/components/ai-nurture/MediaManager';
import { AiCampaignForm } from '@/components/ai-nurture/AiCampaignForm';
import type { AiCampaignConfig, AiKnowledgeDoc, AiMedia, DripCampaign, AiConversation, DripContact } from '@/types';

const goalLabels = {
  book_call: 'Book a Call',
  long_nurture: 'Long Nurture',
  visit_site: 'Drive to Site',
};

const statusColors: Record<string, string> = {
  active: 'bg-green-500/15 text-green-600',
  paused: 'bg-yellow-500/15 text-yellow-600',
  escalated: 'bg-red-500/15 text-red-600',
  goal_met: 'bg-blue-500/15 text-blue-600',
  human_takeover: 'bg-blue-500/15 text-blue-600',
};

type Tab = 'overview' | 'knowledge' | 'media' | 'conversations' | 'settings';

export default function AiCampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);

  const [campaign, setCampaign] = useState<DripCampaign | null>(null);
  const [config, setConfig] = useState<AiCampaignConfig | null>(null);
  const [docs, setDocs] = useState<AiKnowledgeDoc[]>([]);
  const [media, setMedia] = useState<AiMedia[]>([]);
  const [stats, setStats] = useState({ active_conversations: 0, total_enrolled: 0, messages_sent: 0 });
  const [conversations, setConversations] = useState<(AiConversation & { contact: DripContact })[]>([]);

  const load = useCallback(async () => {
    const res = await fetch(`/api/ai-campaigns?id=${id}`);
    if (!res.ok) { router.push('/ai-nurture'); return; }
    const data = await res.json();
    setCampaign(data.campaign);
    setConfig(data.config);
    setDocs(data.docs || []);
    setMedia(data.media || []);
    setStats(data.stats || stats);
    setLoading(false);
  }, [id, router]);

  const loadConversations = useCallback(async () => {
    const res = await fetch(`/api/ai-campaigns/${id}/conversations`);
    const data = await res.json();
    setConversations(data.conversations || []);
  }, [id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (tab === 'conversations') loadConversations(); }, [tab, loadConversations]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  if (!campaign || !config) return null;

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'knowledge', label: 'Knowledge' },
    { key: 'media', label: 'Media' },
    { key: 'conversations', label: 'Conversations' },
    { key: 'settings', label: 'Settings' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/ai-nurture"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted hover:text-foreground hover:bg-card-hover"
          >
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-foreground">{campaign.name}</h1>
            <p className="text-sm text-muted">{goalLabels[config.goal]}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <DuplicateCampaignButton campaignId={id} />
          <span
            className={cn(
              'rounded-full px-3 py-1 text-xs font-medium',
              campaign.status === 'active'
                ? 'bg-green-500/15 text-green-600'
                : campaign.status === 'paused'
                  ? 'bg-yellow-500/15 text-yellow-600'
                  : 'bg-gray-500/15 text-gray-500'
            )}
          >
            {campaign.status}
          </span>
        </div>
      </div>

      <div className="flex gap-1 border-b border-border overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors',
              tab === t.key
                ? 'border-b-2 border-accent text-accent'
                : 'text-muted hover:text-foreground'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-muted mb-1">
                <MessageSquare size={16} />
                <span className="text-xs font-medium">Active Conversations</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{stats.active_conversations}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-muted mb-1">
                <Users size={16} />
                <span className="text-xs font-medium">Total Enrolled</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{stats.total_enrolled}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-muted mb-1">
                <Send size={16} />
                <span className="text-xs font-medium">Messages Sent</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{stats.messages_sent}</p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Configuration</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div>
                <span className="text-xs text-muted">Max Exchanges</span>
                <p className="font-medium text-foreground">{config.max_exchanges}</p>
              </div>
              <div>
                <span className="text-xs text-muted">Follow-up Delay</span>
                <p className="font-medium text-foreground">{config.follow_up_delay_minutes} min</p>
              </div>
              <div>
                <span className="text-xs text-muted">Max Follow-ups</span>
                <p className="font-medium text-foreground">{config.max_follow_ups}</p>
              </div>
              <div>
                <span className="text-xs text-muted">Escalation</span>
                <p className="font-medium text-foreground">{config.escalation_action}</p>
              </div>
            </div>
            {config.personality && (
              <div>
                <span className="text-xs text-muted">Personality</span>
                <p className="text-sm text-foreground mt-0.5">{config.personality}</p>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <p className="text-xs text-muted mb-1">Knowledge documents: {docs.length} &middot; Media assets: {media.length}</p>
          </div>
        </div>
      )}

      {tab === 'knowledge' && (
        <div className="rounded-xl border border-border bg-card p-5">
          <KnowledgeManager campaignId={id} docs={docs} onUpdate={load} />
        </div>
      )}

      {tab === 'media' && (
        <div className="rounded-xl border border-border bg-card p-5">
          <MediaManager campaignId={id} media={media} onUpdate={load} />
        </div>
      )}

      {tab === 'conversations' && (
        <div className="space-y-3">
          {conversations.length === 0 ? (
            <p className="text-sm text-muted text-center py-8">No conversations yet.</p>
          ) : (
            conversations.map((conv) => {
              const contact = conv.contact;
              const name = `${contact?.first_name || ''} ${contact?.last_name || ''}`.trim() || contact?.phone || 'Unknown';
              return (
                <Link
                  key={conv.id}
                  href={`/ai-nurture/${id}/conversations/${conv.contact_id}`}
                  className="flex items-center justify-between rounded-xl border border-border bg-card p-4 hover:border-accent/40 transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">{name}</p>
                    <p className="text-xs text-muted">
                      {conv.exchange_count} exchanges &middot; {conv.follow_up_count} follow-ups
                    </p>
                  </div>
                  <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', statusColors[conv.status])}>
                    {conv.status.replace('_', ' ')}
                  </span>
                </Link>
              );
            })
          )}
        </div>
      )}

      {tab === 'settings' && (
        <div className="rounded-xl border border-border bg-card p-6">
          <AiCampaignForm
            isEdit
            onSaved={load}
            initial={{
              id: campaign.id,
              name: campaign.name,
              description: campaign.description || '',
              goal: config.goal,
              booking_url: config.booking_url || '',
              landing_url: config.landing_url || '',
              persona_name: config.persona_name || '',
              personality: config.personality,
              first_message_override: config.first_message_override || '',
              office_address: config.office_address || '',
              max_exchanges: config.max_exchanges,
              follow_up_delay_minutes: config.follow_up_delay_minutes,
              max_follow_ups: config.max_follow_ups,
              escalation_action: config.escalation_action,
              trigger_tags: (campaign.trigger_tags || []).join(', '),
              trigger_sources: (campaign.trigger_sources || []).join(', '),
              twilio_from_number: campaign.twilio_from_number || '',
              status: campaign.status,
            }}
          />
        </div>
      )}
    </div>
  );
}
