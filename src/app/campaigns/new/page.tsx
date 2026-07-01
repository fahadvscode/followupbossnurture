import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { CampaignTemplateGallery } from '@/components/campaigns/CampaignTemplateGallery';

export default function NewCampaignPage() {
  return (
    <div>
      <Link
        href="/campaigns"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground mb-6"
      >
        <ArrowLeft size={14} /> Back to Campaigns
      </Link>

      <h1 className="text-2xl font-bold text-foreground mb-2">Create Campaign</h1>
      <p className="text-sm text-muted mb-8 max-w-2xl">
        Pick a proven template to preview and customize, or start from scratch with a blank campaign.
      </p>

      <CampaignTemplateGallery />
    </div>
  );
}
