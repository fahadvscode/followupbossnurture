'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { StepEditor, defaultCampaignStep, type CampaignStepForm } from '@/components/campaigns/StepEditor';
import { TwilioFromSelect } from '@/components/campaigns/TwilioFromSelect';
import { TriggerGroupEditor } from '@/components/campaigns/TriggerGroupEditor';
import { getCampaignTemplateById, type CampaignTemplate } from '@/lib/campaign-templates';
import type { TriggerGroup } from '@/types';
import { ArrowLeft, Save } from 'lucide-react';
import Link from 'next/link';

function stepsAreValid(steps: CampaignStepForm[]): boolean {
  return steps.every((s) => {
    if (s.step_type === 'sms') return s.message_template.trim().length > 0;
    if (s.step_type === 'email') {
      return s.message_template.trim().length > 0 && s.email_subject_template.trim().length > 0;
    }
    if (s.step_type === 'fub_action_plan') return s.fub_action_plan_id !== '' && s.fub_action_plan_id > 0;
    return (s.fub_task_name_template || '').trim().length > 0;
  });
}

function buildInitialSteps(template?: CampaignTemplate): CampaignStepForm[] {
  if (!template) return [defaultCampaignStep({ step_number: 1 })];
  return template.steps.map((s, i) => defaultCampaignStep({ ...s, step_number: i + 1 }));
}

function CampaignSetupForm({ template }: { template?: CampaignTemplate }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(template?.name ?? '');
  const [description, setDescription] = useState(template?.description ?? '');
  const [triggerSources, setTriggerSources] = useState('');
  const [triggerGroups, setTriggerGroups] = useState<TriggerGroup[]>([]);
  const [triggerMinGroups, setTriggerMinGroups] = useState(2);
  const [twilioFrom, setTwilioFrom] = useState('');
  const [pauseOnSmsReply, setPauseOnSmsReply] = useState(true);
  const [steps, setSteps] = useState<CampaignStepForm[]>(() => buildInitialSteps(template));

  async function handleSave() {
    if (!name.trim() || !stepsAreValid(steps)) return;
    const hasSms = steps.some((s) => s.step_type === 'sms');
    if (hasSms && !twilioFrom.trim()) {
      alert('Choose a Twilio sending number for SMS touches, or remove SMS touches.');
      return;
    }
    setSaving(true);

    const res = await fetch('/api/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name.trim(),
        description: description.trim() || null,
        trigger_tags: [],
        trigger_sources: triggerSources.split(',').map((t) => t.trim()).filter(Boolean),
        trigger_groups: triggerGroups,
        trigger_min_groups: triggerMinGroups,
        status: 'active',
        twilio_from_number: hasSms ? twilioFrom.trim() : null,
        pause_on_sms_reply: pauseOnSmsReply,
        steps,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      router.push(`/campaigns/${data.id}`);
    } else {
      setSaving(false);
    }
  }

  return (
    <div>
      <Link
        href="/campaigns/new"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground mb-6"
      >
        <ArrowLeft size={14} /> Back to templates
      </Link>

      <h1 className="text-2xl font-bold text-foreground mb-2">Set up campaign</h1>
      {template ? (
        <p className="text-sm text-muted mb-6">
          Based on template: <span className="text-foreground font-medium">{template.name}</span>
          — edit anything below before saving.
        </p>
      ) : (
        <p className="text-sm text-muted mb-6">Configure details, triggers, and your touch schedule.</p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Campaign Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Name</label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Cornerstone Inquiry Follow-up"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Description</label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe what this campaign does..."
                  rows={2}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Trigger Tag Groups
                </label>
                <p className="text-xs text-muted mb-2">
                  Group your tags (e.g. property type, city, category) and require a minimum number of
                  groups to match before a lead enrolls.
                </p>
                <TriggerGroupEditor
                  value={triggerGroups}
                  minGroups={triggerMinGroups}
                  onChange={(groups, min) => {
                    setTriggerGroups(groups);
                    setTriggerMinGroups(min);
                  }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Trigger Sources
                  <span className="text-xs text-muted font-normal ml-1">(optional, comma separated)</span>
                </label>
                <Input
                  value={triggerSources}
                  onChange={(e) => setTriggerSources(e.target.value)}
                  placeholder="Facebook, Website"
                />
                <p className="text-xs text-muted mt-1">
                  Sources enroll on any single match and are ignored when tag groups are set.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Send SMS from (Twilio)
                  <span className="text-xs text-muted font-normal block mt-0.5">
                    Required if any touch is SMS. Task-only campaigns can leave empty.
                  </span>
                </label>
                <TwilioFromSelect value={twilioFrom} onChange={setTwilioFrom} />
              </div>
              <div className="rounded-lg border border-border bg-background px-3 py-3">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pauseOnSmsReply}
                    onChange={(e) => setPauseOnSmsReply(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-border accent-accent"
                  />
                  <span>
                    <span className="block text-sm font-medium text-foreground">
                      Stop drip when lead replies by text
                    </span>
                    <span className="block text-xs text-muted mt-0.5">
                      Recommended. When they text back, their enrollment pauses so you can talk live
                      without more automated touches going out.
                    </span>
                  </span>
                </label>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Touch schedule</CardTitle>
            </CardHeader>
            <CardContent>
              <StepEditor steps={steps} onChange={setSteps} />
            </CardContent>
          </Card>

          <div className="flex justify-end mt-6">
            <Button onClick={handleSave} disabled={saving || !name.trim()}>
              <Save size={14} className="mr-2" />
              {saving ? 'Creating...' : 'Create Campaign'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CampaignSetupPageInner() {
  const searchParams = useSearchParams();
  const templateParam = searchParams.get('template');
  const template = templateParam ? getCampaignTemplateById(templateParam) : undefined;

  return <CampaignSetupForm key={templateParam || 'blank'} template={template} />;
}

export default function CampaignSetupPage() {
  return (
    <Suspense
      fallback={
        <div className="animate-pulse space-y-4">
          <div className="h-4 w-32 bg-card-hover rounded" />
          <div className="h-8 w-64 bg-card-hover rounded" />
          <div className="h-96 bg-card rounded-xl border border-border" />
        </div>
      }
    >
      <CampaignSetupPageInner />
    </Suspense>
  );
}
