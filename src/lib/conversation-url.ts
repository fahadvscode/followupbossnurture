import type { CampaignType } from '@/types';

/** Path to the inbox conversation view for a lead + campaign. */
export function conversationPath(args: {
  contactId: string;
  campaignId: string;
  campaignType?: CampaignType | string | null;
}): string {
  const { contactId, campaignId } = args;
  return `/inbox/${contactId}/${campaignId}`;
}

/** Absolute URL for email deep links. */
export function conversationUrl(args: {
  origin: string;
  contactId: string;
  campaignId: string;
  campaignType?: CampaignType | string | null;
}): string {
  return `${args.origin.replace(/\/$/, '')}${conversationPath(args)}`;
}

/** Inbox list, optionally focused on one contact. */
export function inboxPath(contactId?: string | null): string {
  if (contactId) return `/inbox?contactId=${contactId}`;
  return '/inbox';
}
