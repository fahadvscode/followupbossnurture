'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { GoalSelector } from './GoalSelector';
import { TwilioFromSelect } from '@/components/campaigns/TwilioFromSelect';
import type { AiCampaignGoal, AiEscalationAction } from '@/types';
import { CheckCircle } from 'lucide-react';

interface FormData {
  name: string;
  description: string;
  goal: AiCampaignGoal;
  booking_url: string;
  landing_url: string;
  persona_name: string;
  personality: string;
  first_message_override: string;
  office_address: string;
  max_exchanges: number;
  follow_up_delay_minutes: number;
  max_follow_ups: number;
  escalation_action: AiEscalationAction;
  trigger_tags: string;
  trigger_sources: string;
  twilio_from_number: string;
  status: string;
}

interface Props {
  initial?: Partial<FormData> & { id?: string; persona_name?: string | null; first_message_override?: string | null; office_address?: string | null };
  isEdit?: boolean;
  onSaved?: () => void;
}

export function AiCampaignForm({ initial, isEdit, onSaved }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const [form, setForm] = useState<FormData>({
    name: initial?.name || '',
    description: initial?.description || '',
    goal: initial?.goal || 'book_call',
    booking_url: initial?.booking_url || '',
    landing_url: initial?.landing_url || '',
    persona_name: initial?.persona_name || '',
    personality: initial?.personality || '',
    first_message_override: initial?.first_message_override || '',
    office_address: initial?.office_address || '',
    max_exchanges: initial?.max_exchanges ?? 10,
    follow_up_delay_minutes: initial?.follow_up_delay_minutes ?? 1440,
    max_follow_ups: initial?.max_follow_ups ?? 3,
    escalation_action: initial?.escalation_action || 'both',
    trigger_tags: initial?.trigger_tags || '',
    trigger_sources: initial?.trigger_sources || '',
    twilio_from_number: initial?.twilio_from_number || '',
    status: initial?.status || 'paused',
  });

  const set = <K extends keyof FormData>(k: K, v: FormData[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  const submit = async () => {
    if (!form.name.trim()) {
      setError('Name is required');
      return;
    }
    if (!form.twilio_from_number) {
      setError('Select a Twilio number');
      return;
    }
    setSaving(true);
    setError('');

    const payload = {
      ...form,
      ...(isEdit ? { id: initial?.id } : {}),
      trigger_tags: form.trigger_tags
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      trigger_sources: form.trigger_sources
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    };

    const res = await fetch('/api/ai-campaigns', {
      method: isEdit ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || 'Save failed');
      setSaving(false);
      return;
    }

    setSaving(false);

    if (isEdit) {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      onSaved?.();
      return;
    }

    const data = await res.json();
    router.push(`/ai-nurture/${data.campaign?.id}`);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      {saved && (
        <div className="rounded-lg border border-green-300 bg-green-50 p-3 text-sm text-green-700 flex items-center gap-2">
          <CheckCircle size={16} />
          Campaign updated successfully.
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-foreground mb-1">Campaign Name</label>
        <input
          value={form.name}
          onChange={(e) => set('name', e.target.value)}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          placeholder="e.g. Novella AI Nurture"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-1">Description</label>
        <input
          value={form.description}
          onChange={(e) => set('description', e.target.value)}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          placeholder="Optional description"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-2">Campaign Goal</label>
        <GoalSelector value={form.goal} onChange={(v) => set('goal', v)} />
      </div>

      {form.goal === 'book_call' && (
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Booking URL</label>
          <input
            value={form.booking_url}
            onChange={(e) => set('booking_url', e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            placeholder="https://calendly.com/..."
          />
        </div>
      )}

      {form.goal === 'visit_site' && (
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Landing Page URL</label>
          <input
            value={form.landing_url}
            onChange={(e) => set('landing_url', e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            placeholder="https://..."
          />
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-foreground mb-1">
          AI Persona Name
        </label>
        <input
          value={form.persona_name}
          onChange={(e) => set('persona_name', e.target.value)}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          placeholder="e.g. Jordan (the name the AI will use when texting leads)"
        />
        <p className="text-xs text-muted mt-1">
          Used in the first message: &quot;Hey [Lead], it&apos;s Jordan!&quot;
        </p>
      </div>

      <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-4">
        <div>
          <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-3">Agent Configuration — unique to this campaign</p>
          <label className="block text-sm font-medium text-foreground mb-1">
            Agent Instructions
          </label>
          <textarea
            value={form.personality}
            onChange={(e) => set('personality', e.target.value)}
            rows={4}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            placeholder={`Describe how this agent should behave for this specific campaign.\n\nE.g.: You are a knowledgeable Novella sales rep. Keep it conversational and low-pressure. Focus on lot sizes and the interest-free mortgage promo. If asked about pricing, always mention the promo first.`}
          />
          <p className="text-xs text-muted mt-1">These instructions only apply to this campaign — other campaigns have their own separate agents.</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            Office / Meeting Address <span className="text-muted font-normal">(optional)</span>
          </label>
          <input
            value={form.office_address}
            onChange={(e) => set('office_address', e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            placeholder="e.g. 2550 Argentia Rd, Unit 203, Mississauga, ON"
          />
          <p className="text-xs text-muted mt-1">If a lead asks about visiting or meeting in person, the agent will flag it for you and reply that it will get back to them. This address is shown to the AI so it never invents a fake one.</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            First Message <span className="text-muted font-normal">(optional — write your own)</span>
          </label>
          <textarea
            value={form.first_message_override}
            onChange={(e) => set('first_message_override', e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            placeholder={`Leave blank to let the AI write the first message.\n\nOr write your own: "Hey {{name}}, it's Fahad — saw you were looking at Novella. Rare detached in Mississauga — starting from $1.4M. Heard much about it?"`}
          />
          <p className="text-xs text-muted mt-1">Use <code className="bg-muted px-1 rounded">{'{{name}}'}</code> to insert the lead&apos;s first name. If left blank, the AI generates the opening based on your instructions above.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Max Exchanges</label>
          <input
            type="number"
            min={1}
            max={100}
            value={form.max_exchanges}
            onChange={(e) => set('max_exchanges', parseInt(e.target.value) || 10)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <p className="text-xs text-muted mt-1">Before escalation</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Follow-up Delay</label>
          <input
            type="number"
            min={60}
            value={form.follow_up_delay_minutes}
            onChange={(e) => set('follow_up_delay_minutes', parseInt(e.target.value) || 1440)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <p className="text-xs text-muted mt-1">
            Minutes after your last outbound before the next nudge if the lead stays silent.{' '}
            <strong>1440 (24h)</strong> ≈ at most one automated follow-up per day — a common bar for
            SMS nurture so you don’t fatigue leads or trigger spam filters.
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Max Follow-ups</label>
          <input
            type="number"
            min={0}
            max={20}
            value={form.max_follow_ups}
            onChange={(e) => set('max_follow_ups', parseInt(e.target.value) || 3)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <p className="text-xs text-muted mt-1">Without reply</p>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-1">On Escalation</label>
        <select
          value={form.escalation_action}
          onChange={(e) => set('escalation_action', e.target.value as AiEscalationAction)}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="pause">Pause only</option>
          <option value="fub_task">Create FUB task</option>
          <option value="both">Pause + FUB task</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-1">Twilio Number</label>
        <TwilioFromSelect
          value={form.twilio_from_number}
          onChange={(v) => set('twilio_from_number', v)}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Trigger Tags</label>
          <input
            value={form.trigger_tags}
            onChange={(e) => set('trigger_tags', e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            placeholder="tag1, tag2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Trigger Sources</label>
          <input
            value={form.trigger_sources}
            onChange={(e) => set('trigger_sources', e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            placeholder="Facebook, Website"
          />
        </div>
      </div>

      {isEdit && (
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Status</label>
          <select
            value={form.status}
            onChange={(e) => set('status', e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="archived">Archived</option>
          </select>
        </div>
      )}

      <button
        onClick={submit}
        disabled={saving}
        className="rounded-lg bg-accent px-6 py-2.5 text-sm font-semibold text-white hover:bg-accent/90 disabled:opacity-50"
      >
        {saving ? 'Saving...' : isEdit ? 'Update Campaign' : 'Create Campaign'}
      </button>
    </div>
  );
}
