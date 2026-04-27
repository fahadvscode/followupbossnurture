'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import {
  StepEditor,
  defaultCampaignStep,
  type CampaignStepForm,
} from '@/components/campaigns/StepEditor';
import type { EmailBodyFormat } from '@/types';
import { TwilioFromSelect } from '@/components/campaigns/TwilioFromSelect';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import Link from 'next/link';

const VALID_STEP_TYPES = new Set(['sms', 'email', 'fub_action_plan', 'fub_task']);

function normalizeStepsFromApi(raw: unknown[]): CampaignStepForm[] {
  return raw.map((row, i) => {
    const s = row as Record<string, unknown>;
    const st = String(s.step_type || 'sms');
    const step_type = (VALID_STEP_TYPES.has(st) ? st : 'sms') as CampaignStepForm['step_type'];
    return defaultCampaignStep({
      id: s.id as string | undefined,
      step_number: (s.step_number as number) ?? i + 1,
      delay_days: Number(s.delay_days) || 0,
      delay_hours: Number(s.delay_hours) || 0,
      delay_minutes: Number(s.delay_minutes) || 0,
      message_template: (s.message_template as string) || '',
      email_subject_template: (s.email_subject_template as string) || '',
      email_body_format:
        s.email_body_format === 'html' ? 'html' : ('plain' as EmailBodyFormat),
      step_type,
      fub_action_plan_id:
        s.fub_action_plan_id != null && s.fub_action_plan_id !== ''
          ? Number(s.fub_action_plan_id)
          : '',
      fub_task_type: (s.fub_task_type as string) || 'Call',
      fub_task_name_template: (s.fub_task_name_template as string) || '',
      fub_due_offset_minutes: Number(s.fub_due_offset_minutes) || 0,
      fub_assigned_user_id:
        s.fub_assigned_user_id != null && s.fub_assigned_user_id !== ''
          ? Number(s.fub_assigned_user_id)
          : '',
      fub_email_user_id:
        s.fub_email_user_id != null && s.fub_email_user_id !== ''
          ? Number(s.fub_email_user_id)
          : '',
      fub_remind_seconds_before:
        s.fub_remind_seconds_before != null && s.fub_remind_seconds_before !== ''
          ? Number(s.fub_remind_seconds_before)
          : '',
    });
  });
}

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

export default function EditCampaignPage() {
  const router = useRouter();
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('active');
  const [triggerTags, setTriggerTags] = useState('');
  const [triggerSources, setTriggerSources] = useState('');
  const [twilioFrom, setTwilioFrom] = useState('');
  const [steps, setSteps] = useState<CampaignStepForm[]>([]);

  useEffect(() => {
    fetch(`/api/campaigns?id=${id}`)
      .then((r) => r.json())
      .then((data) => {
        setName(data.campaign.name);
        setDescription(data.campaign.description || '');
        setStatus(data.campaign.status);
        setTriggerTags((data.campaign.trigger_tags || []).join(', '));
        setTriggerSources((data.campaign.trigger_sources || []).join(', '));
        setTwilioFrom(data.campaign.twilio_from_number || '');
        setSteps(
          Array.isArray(data.steps) && data.steps.length > 0
            ? normalizeStepsFromApi(data.steps)
            : [defaultCampaignStep({ step_number: 1 })]
        );
        setLoading(false);
      });
  }, [id]);

  async function handleSave() {
    if (!stepsAreValid(steps)) return;
    const hasSms = steps.some((s) => s.step_type === 'sms');
    if (hasSms && !twilioFrom.trim()) {
      alert('Choose a Twilio sending number for SMS touches, or remove SMS touches.');
      return;
    }
    setSaving(true);

    const res = await fetch('/api/campaigns', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id,
        name: name.trim(),
        description: description.trim() || null,
        status,
        trigger_tags: triggerTags.split(',').map((t) => t.trim()).filter(Boolean),
        trigger_sources: triggerSources.split(',').map((t) => t.trim()).filter(Boolean),
        twilio_from_number: hasSms ? twilioFrom.trim() : null,
        steps,
      }),
    });

    if (res.ok) {
      router.push(`/campaigns/${id}`);
    } else {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-muted" />
      </div>
    );
  }

  return (
    <div>
      <Link href={`/campaigns/${id}`} className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground mb-6">
        <ArrowLeft size={14} /> Back to Campaign
      </Link>

      <h1 className="text-2xl font-bold text-foreground mb-6">Edit Campaign</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Campaign Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Name</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Description</label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Status</label>
                <Select value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="archived">Archived</option>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Trigger Tags</label>
                <Input value={triggerTags} onChange={(e) => setTriggerTags(e.target.value)} placeholder="Comma separated" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Trigger Sources</label>
                <Input value={triggerSources} onChange={(e) => setTriggerSources(e.target.value)} placeholder="Comma separated" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Send SMS from (Twilio)
                </label>
                <p className="text-xs text-muted mb-1">Required if any touch is SMS.</p>
                <TwilioFromSelect value={twilioFrom} onChange={setTwilioFrom} />
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

          <div className="flex justify-end mt-6 gap-3">
            <Link href={`/campaigns/${id}`}>
              <Button variant="secondary">Cancel</Button>
            </Link>
            <Button onClick={handleSave} disabled={saving || !name.trim()}>
              <Save size={14} className="mr-2" />
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
