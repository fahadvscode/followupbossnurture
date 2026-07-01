import { fubWebhookCallbackUrl } from '@/lib/public-base-url';
import {
  deleteFubWebhook,
  isFubApiConfigured,
  isFubWebhookAdminConfigured,
  listFubWebhooks,
  registerFubWebhook,
} from '@/lib/fub';

export const FUB_DRIP_WEBHOOK_EVENTS = [
  'peopleCreated',
  'peopleUpdated',
  'peopleTagsCreated',
  'eventsCreated',
] as const;

export type FubWebhookRow = {
  id: number;
  event: string;
  status: string;
  url: string;
};

export type FubWebhookSetupStatus = {
  webhookUrl: string;
  fubApiConfigured: boolean;
  systemRegistered: boolean;
  webhooks: FubWebhookRow[];
  events: Array<{
    event: string;
    status: 'active' | 'missing' | 'wrong_url' | 'disabled';
    webhookId?: number;
    url?: string;
  }>;
  autoSyncEnabled: boolean;
};

function normalizeUrl(url: string): string {
  return url.trim().replace(/\/$/, '').toLowerCase();
}

export async function getFubWebhookSetupStatus(): Promise<FubWebhookSetupStatus> {
  const webhookUrl = fubWebhookCallbackUrl();
  const fubApiConfigured = isFubApiConfigured();
  const systemRegistered = isFubWebhookAdminConfigured();

  let webhooks: FubWebhookRow[] = [];
  if (systemRegistered) {
    try {
      webhooks = await listFubWebhooks();
    } catch (err) {
      console.error('listFubWebhooks failed:', err);
    }
  }

  const target = normalizeUrl(webhookUrl);
  const events = FUB_DRIP_WEBHOOK_EVENTS.map((event) => {
    const matches = webhooks.filter((w) => w.event === event);
    const exact = matches.find((w) => normalizeUrl(w.url) === target && w.status === 'Active');
    if (exact) {
      return { event, status: 'active' as const, webhookId: exact.id, url: exact.url };
    }
    const activeWrong = matches.find((w) => w.status === 'Active');
    if (activeWrong) {
      return { event, status: 'wrong_url' as const, webhookId: activeWrong.id, url: activeWrong.url };
    }
    const disabled = matches.find((w) => w.status === 'Disabled');
    if (disabled) {
      return { event, status: 'disabled' as const, webhookId: disabled.id, url: disabled.url };
    }
    return { event, status: 'missing' as const };
  });

  return {
    webhookUrl,
    fubApiConfigured,
    systemRegistered,
    webhooks,
    events,
    autoSyncEnabled: fubApiConfigured,
  };
}

export async function registerAllDripFubWebhooks(): Promise<{
  registered: string[];
  alreadyActive: string[];
  errors: Array<{ event: string; error: string }>;
}> {
  const webhookUrl = fubWebhookCallbackUrl();
  if (!webhookUrl) {
    throw new Error('Could not determine public app URL. Set NEXT_PUBLIC_BASE_URL in Vercel.');
  }
  if (!isFubWebhookAdminConfigured()) {
    throw new Error(
      'FUB system not configured. Add FUB_SYSTEM_NAME and FUB_SYSTEM_KEY from https://apps.followupboss.com/system-registration to Vercel env vars.'
    );
  }

  const status = await getFubWebhookSetupStatus();
  const registered: string[] = [];
  const alreadyActive: string[] = [];
  const errors: Array<{ event: string; error: string }> = [];

  for (const row of status.events) {
    if (row.status === 'active') {
      alreadyActive.push(row.event);
      continue;
    }

    if (row.status === 'wrong_url' || row.status === 'disabled') {
      if (row.webhookId != null) {
        try {
          await deleteFubWebhook(row.webhookId);
        } catch (err) {
          errors.push({
            event: row.event,
            error: err instanceof Error ? err.message : 'Could not remove old webhook',
          });
          continue;
        }
      }
    }

    try {
      await registerFubWebhook(webhookUrl, row.event);
      registered.push(row.event);
    } catch (err) {
      errors.push({
        event: row.event,
        error: err instanceof Error ? err.message : 'Registration failed',
      });
    }
  }

  return { registered, alreadyActive, errors };
}
