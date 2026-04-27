'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { formatPhone, formatDate } from '@/lib/utils';
import type { DripContact } from '@/types';

interface ContactTableProps {
  contacts: DripContact[];
}

function sourceBadgeVariant(category: string): 'default' | 'success' | 'warning' | 'danger' | 'info' {
  const map: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
    Facebook: 'info',
    Google: 'warning',
    Website: 'success',
    'Landing Page': 'success',
    'Email Signup': 'info',
    Manual: 'default',
    Referral: 'success',
  };
  return map[category] || 'default';
}

export function ContactTable({ contacts }: ContactTableProps) {
  const router = useRouter();

  function openContact(id: string) {
    router.push(`/contacts/${id}`);
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border text-left">
            <th className="px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider">Name</th>
            <th className="px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider">Phone</th>
            <th className="px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider">Source</th>
            <th className="px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider">Tags</th>
            <th className="px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider">Stage</th>
            <th className="px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider">Added</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {contacts.map((contact) => (
            <tr
              key={contact.id}
              role="link"
              tabIndex={0}
              aria-label={`Open contact ${`${contact.first_name || ''} ${contact.last_name || ''}`.trim() || 'Unknown'}`}
              className="group hover:bg-card-hover transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-inset"
              onClick={() => openContact(contact.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  openContact(contact.id);
                }
              }}
            >
              <td className="px-4 py-3">
                <Link
                  href={`/contacts/${contact.id}`}
                  className="text-sm font-medium text-foreground hover:text-accent transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  {`${contact.first_name || ''} ${contact.last_name || ''}`.trim() || 'Unknown'}
                </Link>
                {contact.email && (
                  <p className="text-xs text-muted">{contact.email}</p>
                )}
              </td>
              <td className="px-4 py-3 text-sm text-muted">{formatPhone(contact.phone)}</td>
              <td className="px-4 py-3">
                <Badge variant={sourceBadgeVariant(contact.source_category)}>
                  {contact.source_category}
                </Badge>
                {contact.source_detail && (
                  <span className="text-xs text-muted ml-1">{contact.source_detail}</span>
                )}
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1">
                  {(contact.tags || []).slice(0, 3).map((tag) => (
                    <Badge key={tag} variant="default">{tag}</Badge>
                  ))}
                  {(contact.tags || []).length > 3 && (
                    <span className="text-xs text-muted">+{contact.tags.length - 3}</span>
                  )}
                </div>
              </td>
              <td className="px-4 py-3 text-sm text-muted">{contact.stage || '—'}</td>
              <td className="px-4 py-3 text-sm text-muted">{formatDate(contact.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
