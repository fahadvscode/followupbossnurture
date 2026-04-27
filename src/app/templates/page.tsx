'use client';

import dynamic from 'next/dynamic';

const TemplatesClient = dynamic(() => import('./TemplatesClient'), {
  ssr: false,
  loading: () => (
    <div className="animate-pulse space-y-6">
      <div className="h-4 w-40 bg-card-hover rounded" />
      <div className="h-9 w-64 bg-card-hover rounded" />
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,13rem)_minmax(0,1fr)_minmax(0,1fr)] gap-4 lg:gap-6">
        <div className="h-[28rem] bg-card rounded-xl border border-border" />
        <div className="h-[28rem] bg-card rounded-xl border border-border" />
        <div className="h-[28rem] bg-card rounded-xl border border-border" />
      </div>
    </div>
  ),
});

export default function TemplatesPage() {
  return <TemplatesClient />;
}
