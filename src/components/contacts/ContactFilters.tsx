'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Search, X } from 'lucide-react';

const SOURCE_OPTIONS = [
  'All Sources', 'Facebook', 'Google', 'Website', 'Landing Page',
  'Email Signup', 'Manual', 'Referral', 'Other',
];

const DRIP_STATUS_OPTIONS = [
  'All Drip Status', 'In Active Drip', 'No Active Drip', 'Completed Drip', 'Opted Out',
];

export function ContactFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value && !value.startsWith('All')) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete('page');
    params.delete('synced');
    params.delete('sync_error');
    router.push(`/contacts?${params.toString()}`);
  }

  function clearFilters() {
    router.push('/contacts');
  }

  const hasFilters = Array.from(searchParams.keys()).some(
    (k) => !['page', 'synced', 'sync_error'].includes(k)
  );

  return (
    <div className="flex flex-wrap items-center gap-3 mb-6">
      <div className="relative flex-1 min-w-[200px] max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <Input
          placeholder="Filter by name, email, or phone (already in this app)…"
          defaultValue={searchParams.get('search') || ''}
          onChange={(e) => updateParam('search', e.target.value)}
          className="pl-9"
        />
      </div>

      <Select
        value={searchParams.get('source') || ''}
        onChange={(e) => updateParam('source', e.target.value)}
        className="w-40"
      >
        {SOURCE_OPTIONS.map((s) => (
          <option key={s} value={s === 'All Sources' ? '' : s}>{s}</option>
        ))}
      </Select>

      <Select
        value={searchParams.get('drip_status') || ''}
        onChange={(e) => updateParam('drip_status', e.target.value)}
        className="w-44"
      >
        {DRIP_STATUS_OPTIONS.map((s) => (
          <option key={s} value={s === 'All Drip Status' ? '' : s}>{s}</option>
        ))}
      </Select>

      <Input
        type="text"
        placeholder="Tag..."
        defaultValue={searchParams.get('tag') || ''}
        onChange={(e) => updateParam('tag', e.target.value)}
        className="w-32"
      />

      <Input
        type="text"
        placeholder="Stage..."
        defaultValue={searchParams.get('stage') || ''}
        onChange={(e) => updateParam('stage', e.target.value)}
        className="w-32"
      />

      <Input
        type="text"
        placeholder="Project / LP..."
        defaultValue={searchParams.get('project') || ''}
        onChange={(e) => updateParam('project', e.target.value)}
        className="w-36"
      />

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={clearFilters}>
          <X size={14} className="mr-1" /> Clear
        </Button>
      )}
    </div>
  );
}
