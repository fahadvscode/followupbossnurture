'use client';

import { Suspense } from 'react';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { InboxThreadList } from '@/components/inbox/InboxThreadList';

function parseInboxSelection(pathname: string): {
  contactId: string | null;
  campaignId: string | null;
} {
  const parts = pathname.split('/').filter(Boolean);
  if (parts[0] !== 'inbox' || parts.length < 3) {
    return { contactId: null, campaignId: null };
  }
  return { contactId: parts[1], campaignId: parts[2] };
}

export function InboxShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { contactId, campaignId } = parseInboxSelection(pathname);
  const conversationOpen = Boolean(contactId && campaignId);

  return (
    <div
      className={cn(
        '-mx-4 -mb-4 flex min-h-0 overflow-hidden sm:-mx-6 sm:-mb-6 lg:-mx-8 lg:-mb-8',
        'h-[calc(100dvh-4rem)] lg:h-[calc(100dvh-2rem)]'
      )}
    >
      <aside
        className={cn(
          'flex min-h-0 w-full shrink-0 flex-col border-border bg-background lg:w-[380px] lg:border-r xl:w-[420px]',
          conversationOpen ? 'hidden lg:flex' : 'flex'
        )}
      >
        <Suspense
          fallback={
            <div className="flex flex-1 items-center justify-center">
              <div className="h-7 w-7 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            </div>
          }
        >
          <InboxThreadList selectedContactId={contactId} selectedCampaignId={campaignId} />
        </Suspense>
      </aside>

      <section
        className={cn(
          'min-h-0 min-w-0 flex-1 flex-col bg-background',
          conversationOpen ? 'flex' : 'hidden lg:flex'
        )}
      >
        {children}
      </section>
    </div>
  );
}
