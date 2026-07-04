import type { CampaignType } from '@/types';

/** Path to open the SMS conversation thread for a lead + campaign. */
export function conversationPath(args: {
  contactId: string;
  campaignId: string;
  campaignType?: CampaignType | string | null;
}): string {
  const { contactId, campaignId, campaignType } = args;
  if (campaignType === 'ai_nurture') {
    return `/ai-nurture/${campaignId}/conversations/${contactId}`;
  }
  return `/contacts/${contactId}?campaignId=${campaignId}&chat=1`;
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
