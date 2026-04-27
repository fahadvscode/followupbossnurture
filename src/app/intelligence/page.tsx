'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '@/components/ui/stat-card';
import { SourceChart } from '@/components/analytics/SourceChart';
import { EngagementBySource } from '@/components/analytics/EngagementBySource';
import { FunnelChart } from '@/components/analytics/FunnelChart';
import Link from 'next/link';
import { Brain, Users, TrendingUp, Loader2, GitMerge } from 'lucide-react';

interface SourceData {
  source_category: string;
  count: number;
}

interface EngagementData {
  source_category: string;
  total: number;
  replied: number;
  engagement_rate: number;
}

interface FunnelStage {
  stage: string;
  value: number;
}

interface OverlapPayload {
  count: number;
  contacts: { id: string; name: string; source_category: string; channels: string[] }[];
}

export default function IntelligencePage() {
  const [sourceData, setSourceData] = useState<SourceData[]>([]);
  const [engagementData, setEngagementData] = useState<EngagementData[]>([]);
  const [funnelData, setFunnelData] = useState<FunnelStage[]>([]);
  const [overlap, setOverlap] = useState<OverlapPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/analytics?type=source_breakdown').then((r) => r.json()),
      fetch('/api/analytics?type=engagement_by_source').then((r) => r.json()),
      fetch('/api/analytics?type=funnel').then((r) => r.json()),
      fetch('/api/analytics?type=cross_source_overlap').then((r) => r.json()),
    ]).then(([sources, engagement, funnel, cross]) => {
      setSourceData(sources);
      setEngagementData(engagement);
      setFunnelData(funnel);
      setOverlap(cross);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-muted" />
      </div>
    );
  }

  const totalLeads = sourceData.reduce((sum, s) => sum + s.count, 0);
  const topSource = sourceData[0]?.source_category || 'N/A';
  const bestEngagement =
    engagementData.length > 0
      ? engagementData.reduce((best, curr) =>
          curr.engagement_rate > best.engagement_rate ? curr : best
        )
      : null;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Lead Intelligence</h1>
        <p className="text-sm text-muted mt-1">Source analytics and engagement insights across all channels</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Leads" value={totalLeads.toLocaleString()} icon={Users} />
        <StatCard label="Top Source" value={topSource} icon={TrendingUp} />
        <StatCard
          label="Best Engagement"
          value={bestEngagement ? `${bestEngagement.engagement_rate}%` : '0%'}
          icon={Brain}
          change={bestEngagement?.source_category || ''}
        />
        <StatCard
          label="Cross-channel signals"
          value={overlap?.count ?? 0}
          icon={GitMerge}
          change="Tags + source hint at 2+ channels"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Leads by Source</CardTitle>
          </CardHeader>
          <CardContent>
            {sourceData.length > 0 ? (
              <SourceChart data={sourceData} />
            ) : (
              <div className="text-center py-10 text-sm text-muted">No data yet. Sync contacts to see source breakdown.</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Engagement by Source</CardTitle>
          </CardHeader>
          <CardContent>
            {engagementData.length > 0 ? (
              <EngagementBySource data={engagementData} />
            ) : (
              <div className="text-center py-10 text-sm text-muted">No engagement data yet.</div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Cross-source overlap</CardTitle>
        </CardHeader>
        <CardContent>
          {!overlap || overlap.count === 0 ? (
            <p className="text-sm text-muted">
              No overlapping channel signals detected yet. This flags contacts whose tags and source text suggest
              more than one channel (for example Facebook cues plus email signup language).
            </p>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-muted mb-3">
                {overlap.count} contact{overlap.count === 1 ? '' : 's'} show multiple channel signals (sample below).
              </p>
              <ul className="divide-y divide-border rounded-lg border border-border overflow-hidden">
                {overlap.contacts.map((c) => (
                  <li key={c.id} className="px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 bg-card-hover/50">
                    <Link href={`/contacts/${c.id}`} className="text-sm font-medium text-accent hover:underline">
                      {c.name}
                    </Link>
                    <span className="text-xs text-muted">{c.channels.join(' · ')}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Conversion Funnel</CardTitle>
          </CardHeader>
          <CardContent>
            {funnelData.length > 0 ? (
              <FunnelChart data={funnelData} />
            ) : (
              <div className="text-center py-10 text-sm text-muted">No funnel data yet.</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Engagement Rate by Channel</CardTitle>
          </CardHeader>
          <CardContent>
            {engagementData.length > 0 ? (
              <div className="space-y-3">
                {engagementData
                  .sort((a, b) => b.engagement_rate - a.engagement_rate)
                  .map((source) => (
                    <div key={source.source_category} className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        <span className="text-sm font-medium text-foreground w-28">{source.source_category}</span>
                        <div className="flex-1 h-2 bg-background rounded-full overflow-hidden">
                          <div
                            className="h-full bg-accent rounded-full"
                            style={{ width: `${Math.min(source.engagement_rate, 100)}%` }}
                          />
                        </div>
                      </div>
                      <span className="text-sm font-bold text-foreground w-14 text-right">{source.engagement_rate}%</span>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="text-center py-10 text-sm text-muted">No data yet.</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
