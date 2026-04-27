import { getServiceClient } from '@/lib/supabase';
import { ContactTable } from '@/components/contacts/ContactTable';
import { ContactFilters } from '@/components/contacts/ContactFilters';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ContactsQuickFubImport } from '@/components/contacts/ContactsQuickFubImport';
import { ContactsFubSyncButton } from '@/components/contacts/ContactsFubSyncButton';
import { EmptyState } from '@/components/ui/empty-state';
import { Users } from 'lucide-react';
import Link from 'next/link';
import type { DripContact } from '@/types';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{
    search?: string;
    source?: string;
    drip_status?: string;
    tag?: string;
    stage?: string;
    project?: string;
    page?: string;
    synced?: string;
    sync_error?: string;
  }>;
}

const PAGE_SIZE = 50;

function buildQueryString(params: Record<string, string | undefined>, page?: number): string {
  const sp = new URLSearchParams();
  if (params.search) sp.set('search', params.search);
  if (params.source) sp.set('source', params.source);
  if (params.drip_status) sp.set('drip_status', params.drip_status);
  if (params.tag) sp.set('tag', params.tag);
  if (params.stage) sp.set('stage', params.stage);
  if (params.project) sp.set('project', params.project);
  if (page && page > 1) sp.set('page', String(page));
  const q = sp.toString();
  return q ? `?${q}` : '';
}

export default async function ContactsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const db = getServiceClient();
  const page = parseInt(params.page || '1');
  const offset = (page - 1) * PAGE_SIZE;

  const needsActiveIds =
    params.drip_status === 'In Active Drip' || params.drip_status === 'No Active Drip';
  const needsCompletedIds = params.drip_status === 'Completed Drip';

  let activeContactIds: string[] = [];
  if (needsActiveIds) {
    const { data: activeEnrollRows } = await db
      .from('drip_enrollments')
      .select('contact_id')
      .eq('status', 'active');
    activeContactIds = [...new Set((activeEnrollRows || []).map((r) => r.contact_id))];
  }

  let completedContactIds: string[] = [];
  if (needsCompletedIds) {
    const { data: completedEnrollRows } = await db
      .from('drip_enrollments')
      .select('contact_id')
      .eq('status', 'completed');
    completedContactIds = [...new Set((completedEnrollRows || []).map((r) => r.contact_id))];
  }

  let emptyReason: string | null = null;

  let query = db.from('drip_contacts').select('*', { count: 'exact' });

  if (params.drip_status === 'Opted Out') {
    query = query.eq('opted_out', true);
  } else if (params.drip_status === 'In Active Drip') {
    if (activeContactIds.length === 0) emptyReason = 'No contacts are in an active drip right now.';
    else query = query.in('id', activeContactIds);
  } else if (params.drip_status === 'No Active Drip') {
    if (activeContactIds.length > 0) {
      query = query.not('id', 'in', `(${activeContactIds.join(',')})`);
    }
  } else if (params.drip_status === 'Completed Drip') {
    if (completedContactIds.length === 0) emptyReason = 'No contacts have completed a drip yet.';
    else query = query.in('id', completedContactIds);
  }

  if (params.search) {
    const s = params.search.replace(/%/g, '');
    query = query.or(
      `first_name.ilike.%${s}%,last_name.ilike.%${s}%,email.ilike.%${s}%,phone.ilike.%${s}%`
    );
  }
  if (params.source) {
    query = query.eq('source_category', params.source);
  }
  if (params.tag) {
    query = query.contains('tags', [params.tag]);
  }
  if (params.stage) {
    query = query.ilike('stage', `%${params.stage.replace(/%/g, '')}%`);
  }
  if (params.project) {
    query = query.ilike('source_detail', `%${params.project.replace(/%/g, '')}%`);
  }

  query = query.order('created_at', { ascending: false }).range(offset, offset + PAGE_SIZE - 1);

  const { data: contacts, count } = emptyReason ? { data: [], count: 0 } : await query;

  const filteredContacts = (contacts || []) as DripContact[];
  const totalPages = Math.ceil((count || 0) / PAGE_SIZE);

  const qs = {
    search: params.search,
    source: params.source,
    drip_status: params.drip_status,
    tag: params.tag,
    stage: params.stage,
    project: params.project,
  };

  return (
    <div>
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Contacts</h1>
            <p className="text-sm text-muted mt-1">
              {count ?? 0} contacts in this app (from Follow Up Boss or manual). Search below only filters this
              list — it does not choose who gets imported from FUB.
            </p>
          </div>
          <div className="w-full lg:max-w-xl shrink-0 space-y-3">
            <ContactsQuickFubImport />
            <div className="rounded-lg border border-border border-dashed bg-card/40 p-3 space-y-2">
              <p className="text-xs text-muted leading-relaxed">
                <strong className="text-foreground">Full account sync</strong> walks every person in Follow Up Boss.
                Large accounts can take a long time. You will be asked to confirm before it starts.
              </p>
              <ContactsFubSyncButton />
            </div>
          </div>
        </div>
      </div>

      {params.synced === '1' && (
        <p className="text-sm text-success mb-4">Sync completed. Contacts are up to date.</p>
      )}
      {params.sync_error && (
        <p className="text-sm text-danger mb-4">Sync failed: {params.sync_error}</p>
      )}

      <ContactFilters />

      <Card>
        <CardContent className="p-0">
          {emptyReason || filteredContacts.length === 0 ? (
            <EmptyState
              icon={Users}
              title={emptyReason ? 'No matches' : 'No contacts found'}
              description={
                emptyReason ||
                'Sync your Follow Up Boss contacts or adjust your filters.'
              }
            />
          ) : (
            <ContactTable contacts={filteredContacts} />
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          {page > 1 && (
            <Link href={`/contacts${buildQueryString(qs, page - 1)}`}>
              <Button variant="secondary" size="sm">
                Previous
              </Button>
            </Link>
          )}
          <span className="text-sm text-muted">
            Page {page} of {totalPages}
          </span>
          {page < totalPages && (
            <Link href={`/contacts${buildQueryString(qs, page + 1)}`}>
              <Button variant="secondary" size="sm">
                Next
              </Button>
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
