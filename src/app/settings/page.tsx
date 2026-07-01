import { FubIntegrationSettings } from '@/components/settings/FubIntegrationSettings';

export const dynamic = 'force-dynamic';

export default function SettingsPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-2">Settings</h1>
      <p className="text-sm text-muted mb-8">
        Connect Follow Up Boss so new Zapier / Facebook leads sync and drip automatically.
      </p>
      <FubIntegrationSettings />
    </div>
  );
}
