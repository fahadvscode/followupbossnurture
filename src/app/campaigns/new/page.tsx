'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { StepEditor, defaultCampaignStep, type CampaignStepForm } from '@/components/campaigns/StepEditor';
import { TwilioFromSelect } from '@/components/campaigns/TwilioFromSelect';
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

export default function NewCampaignPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [triggerTags, setTriggerTags] = useState('');
  const [triggerSources, setTriggerSources] = useState('');
  const [twilioFrom, setTwilioFrom] = useState('');
  const [steps, setSteps] = useState<CampaignStepForm[]>([
    defaultCampaignStep({ step_number: 1 }),
  ]);

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
        trigger_tags: triggerTags.split(',').map((t) => t.trim()).filter(Boolean),
        trigger_sources: triggerSources.split(',').map((t) => t.trim()).filter(Boolean),
        status: 'active',
        twilio_from_number: hasSms ? twilioFrom.trim() : null,
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
      <Link href="/campaigns" className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground mb-6">
        <ArrowLeft size={14} /> Back to Campaigns
      </Link>

      <h1 className="text-2xl font-bold text-foreground mb-6">Create Campaign</h1>

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
                  Trigger Tags
                  <span className="text-xs text-muted font-normal ml-1">(comma separated)</span>
                </label>
                <Input
                  value={triggerTags}
                  onChange={(e) => setTriggerTags(e.target.value)}
                  placeholder="Cornerstone, Novella"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Trigger Sources
                  <span className="text-xs text-muted font-normal ml-1">(comma separated)</span>
                </label>
                <Input
                  value={triggerSources}
                  onChange={(e) => setTriggerSources(e.target.value)}
                  placeholder="Facebook, Website"
                />
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
