'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import Link from 'next/link';
import { formatDripStepDayLabel } from '@/lib/utils';
import type { DripTemplateFolder, EmailBodyFormat, FubUserOption } from '@/types';
import { FubUserPicker } from '@/components/campaigns/FubUserPicker';

export type CampaignStepForm = {
  id?: string;
  step_number: number;
  delay_days: number;
  delay_hours: number;
  delay_minutes: number;
  message_template: string;
  step_type: 'sms' | 'email' | 'fub_action_plan' | 'fub_task';
  email_subject_template: string;
  email_body_format: EmailBodyFormat;
  fub_action_plan_id: number | '';
  fub_task_type: string;
  fub_task_name_template: string;
  fub_due_offset_minutes: number;
  fub_assigned_user_id: number | '';
  /** FUB user for email timeline attribution */
  fub_email_user_id: number | '';
  fub_remind_seconds_before: number | '';
};

interface StepEditorProps {
  steps: CampaignStepForm[];
  onChange: (steps: CampaignStepForm[]) => void;
}

interface FubActionPlan {
  id: number;
  name: string;
  status: string;
}

interface SavedMessageTemplate {
  id: string;
  name: string;
  channel: 'sms' | 'email';
  email_subject: string;
  body_plain: string;
  body_html: string | null;
  folder_id?: string | null;
}

type TemplatePickerGroup = {
  key: string;
  label: string;
  items: SavedMessageTemplate[];
};

function groupTemplatesForPicker(
  channel: 'sms' | 'email',
  templates: SavedMessageTemplate[],
  folders: DripTemplateFolder[]
): TemplatePickerGroup[] {
  const filtered = templates.filter((t) => t.channel === channel);
  const folderIds = new Set(folders.map((f) => f.id));
  const bucket = new Map<string | null, SavedMessageTemplate[]>();

  for (const t of filtered) {
    let fid: string | null = t.folder_id ?? null;
    if (fid && !folderIds.has(fid)) fid = null;
    if (!bucket.has(fid)) bucket.set(fid, []);
    bucket.get(fid)!.push(t);
  }

  for (const arr of bucket.values()) {
    arr.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  }

  const sortedFolders = [...folders].sort(
    (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  );

  const out: TemplatePickerGroup[] = [];
  for (const f of sortedFolders) {
    const items = bucket.get(f.id);
    if (items?.length) out.push({ key: `f-${f.id}`, label: f.name, items });
  }
  const unfiled = bucket.get(null);
  if (unfiled?.length) {
    out.push({ key: 'unfiled', label: 'Unfiled', items: unfiled });
  }
  return out;
}

const FUB_TASK_TYPES = [
  'Call',
  'Text',
  'Email',
  'Follow Up',
  'Appointment',
  'Showing',
  'Closing',
  'Open House',
  'Thank You',
] as const;

export function defaultCampaignStep(partial: Partial<CampaignStepForm> & { step_number: number }): CampaignStepForm {
  return {
    step_number: partial.step_number,
    delay_days: partial.delay_days ?? 0,
    delay_hours: partial.delay_hours ?? 0,
    delay_minutes: partial.delay_minutes ?? 0,
    message_template: partial.message_template ?? '',
    step_type: partial.step_type ?? 'sms',
    email_subject_template: partial.email_subject_template ?? '',
    email_body_format: partial.email_body_format ?? 'plain',
    fub_action_plan_id: partial.fub_action_plan_id ?? '',
    fub_task_type: partial.fub_task_type ?? 'Call',
    fub_task_name_template: partial.fub_task_name_template ?? '',
    fub_due_offset_minutes: partial.fub_due_offset_minutes ?? 0,
    fub_assigned_user_id: partial.fub_assigned_user_id ?? '',
    fub_email_user_id: partial.fub_email_user_id ?? '',
    fub_remind_seconds_before: partial.fub_remind_seconds_before ?? '',
    id: partial.id,
  };
}

export function StepEditor({ steps, onChange }: StepEditorProps) {
  const [actionPlans, setActionPlans] = useState<FubActionPlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [savedTemplates, setSavedTemplates] = useState<SavedMessageTemplate[]>([]);
  const [templateFolders, setTemplateFolders] = useState<DripTemplateFolder[]>([]);
  const [templateLibraryReady, setTemplateLibraryReady] = useState(false);

  const hasActionPlanStep = steps.some((s) => s.step_type === 'fub_action_plan');
  const needsFubUsers = steps.some((s) => s.step_type === 'fub_task' || s.step_type === 'email');
  const needsTemplates = steps.some((s) => s.step_type === 'sms' || s.step_type === 'email');

  const [fubUsers, setFubUsers] = useState<FubUserOption[]>([]);
  const [fubUsersLoading, setFubUsersLoading] = useState(false);
  const [fubUsersError, setFubUsersError] = useState<string | null>(null);
  const [fubUsersFetched, setFubUsersFetched] = useState(false);

  useEffect(() => {
    if (!needsTemplates) return;
    if (templateLibraryReady) return;
    let cancelled = false;
    Promise.all([fetch('/api/templates'), fetch('/api/template-folders')])
      .then(async ([tr, fr]) => {
        const tData = await tr.json().catch(() => ({}));
        const fData = await fr.json().catch(() => ({}));
        if (cancelled) return;
        setSavedTemplates(Array.isArray(tData.templates) ? tData.templates : []);
        setTemplateFolders(Array.isArray(fData.folders) ? fData.folders : []);
      })
      .catch((e) => console.error('Failed to load templates or folders:', e))
      .finally(() => {
        if (!cancelled) setTemplateLibraryReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [needsTemplates, templateLibraryReady]);

  const smsTemplateGroups = useMemo(
    () => groupTemplatesForPicker('sms', savedTemplates, templateFolders),
    [savedTemplates, templateFolders]
  );

  const emailTemplateGroups = useMemo(
    () => groupTemplatesForPicker('email', savedTemplates, templateFolders),
    [savedTemplates, templateFolders]
  );

  useEffect(() => {
    if (!hasActionPlanStep) return;
    if (actionPlans.length > 0) return;
    setPlansLoading(true);
    fetch('/api/fub/action-plans')
      .then((r) => r.json())
      .then((d) => setActionPlans(d.actionPlans || []))
      .catch((e) => console.error('Failed to load FUB action plans:', e))
      .finally(() => setPlansLoading(false));
  }, [hasActionPlanStep, actionPlans.length]);

  useEffect(() => {
    if (!needsFubUsers || fubUsersFetched) return;
    let cancelled = false;
    setFubUsersLoading(true);
    setFubUsersError(null);
    fetch('/api/fub/users')
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) {
          throw new Error(typeof d.error === 'string' ? d.error : 'Could not load FUB users');
        }
        return d;
      })
      .then((d) => {
        if (cancelled) return;
        const list = Array.isArray(d.users) ? d.users : [];
        setFubUsers(list as FubUserOption[]);
      })
      .catch((e) => {
        console.error(e);
        if (!cancelled) {
          setFubUsersError(e instanceof Error ? e.message : 'Failed to load users');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setFubUsersLoading(false);
          setFubUsersFetched(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [needsFubUsers, fubUsersFetched]);

  function addStep() {
    const lastStep = steps[steps.length - 1];
    const newStep = defaultCampaignStep({
      step_number: steps.length + 1,
      delay_days: lastStep ? lastStep.delay_days + 7 : 0,
      delay_hours: 0,
      message_template: '',
      step_type: 'sms',
    });
    onChange([...steps, newStep]);
  }

  function updateStep(index: number, updates: Partial<CampaignStepForm>) {
    const updated = steps.map((s, i) => (i === index ? { ...s, ...updates } : s));
    onChange(updated);
  }

  function removeStep(index: number) {
    const updated = steps
      .filter((_, i) => i !== index)
      .map((s, i) => ({ ...s, step_number: i + 1 }));
    onChange(updated);
  }

  function applyTemplate(index: number, templateId: string) {
    const t = savedTemplates.find((x) => x.id === templateId);
    if (!t) return;
    const step = steps[index];
    if (step.step_type === 'sms' && t.channel === 'sms') {
      updateStep(index, { message_template: t.body_plain });
      return;
    }
    if (step.step_type === 'email' && t.channel === 'email') {
      const hasHtml = Boolean(t.body_html?.trim());
      updateStep(index, {
        email_subject_template: t.email_subject || '',
        email_body_format: hasHtml ? 'html' : 'plain',
        message_template: hasHtml ? (t.body_html || '') : t.body_plain,
      });
    }
  }

  return (
    <div className="space-y-4">
      {steps.map((step, index) => (
        <div key={index} className="bg-card-hover border border-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <GripVertical size={14} className="text-muted" />
              <span className="text-sm font-medium text-foreground">
                {formatDripStepDayLabel(step)}
              </span>
            </div>
            {steps.length > 1 && (
              <Button variant="ghost" size="sm" onClick={() => removeStep(index)}>
                <Trash2 size={14} className="text-danger" />
              </Button>
            )}
          </div>

          <div className="mb-3">
            <label className="block text-xs text-muted mb-1">Channel</label>
            <Select
              value={step.step_type}
              onChange={(e) => {
                const v = e.target.value as CampaignStepForm['step_type'];
                updateStep(index, {
                  step_type: v,
                  ...(v === 'email'
                    ? { email_body_format: step.email_body_format ?? 'plain' }
                    : {}),
                });
              }}
            >
              <option value="sms">SMS (Twilio)</option>
              <option value="email">Email (FUB marketing timeline + SMTP)</option>
              <option value="fub_action_plan">FUB Action Plan (email from connected inbox)</option>
              <option value="fub_task">Follow Up Boss task</option>
            </Select>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-3">
            <div>
              <label className="block text-xs text-muted mb-1">Delay (days)</label>
              <Input
                type="number"
                min={0}
                value={step.delay_days}
                onChange={(e) => updateStep(index, { delay_days: parseInt(e.target.value) || 0 })}
              />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">+ Hours</label>
              <Input
                type="number"
                min={0}
                max={23}
                value={step.delay_hours}
                onChange={(e) => updateStep(index, { delay_hours: parseInt(e.target.value) || 0 })}
              />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">+ Minutes</label>
              <Input
                type="number"
                min={0}
                max={59}
                value={step.delay_minutes}
                onChange={(e) => updateStep(index, { delay_minutes: parseInt(e.target.value) || 0 })}
              />
            </div>
          </div>
          <p className="text-xs text-muted mb-3">
            Delay is measured from when the contact was enrolled (not from the previous step).
          </p>

          {/* SMS */}
          {step.step_type === 'sms' && (
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <label className="text-xs text-muted">Load from library</label>
                <Select
                  className="max-w-md flex-1 min-w-[12rem]"
                  value=""
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v) applyTemplate(index, v);
                    e.target.value = '';
                  }}
                >
                  <option value="">— SMS template (by folder) —</option>
                  {smsTemplateGroups.map((g) => (
                    <optgroup key={g.key} label={g.label}>
                      {g.items.map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </Select>
                <Link
                  href="/templates"
                  className="text-xs text-accent hover:underline"
                >
                  Manage templates
                </Link>
              </div>
              <label className="block text-xs text-muted mb-1">
                SMS message
                <span className="text-muted/60 ml-1">
                  {'{first_name}'} {'{last_name}'} {'{project}'} {'{campaign}'}
                </span>
              </label>
              <Textarea
                value={step.message_template}
                onChange={(e) => updateStep(index, { message_template: e.target.value })}
                placeholder="Hi {first_name}, thanks for your interest in {project}..."
                rows={3}
              />
              <p className="text-xs text-muted mt-1">{step.message_template.length}/1600 characters</p>
              <p className="text-xs text-muted mt-1">
                Sent via Twilio. The outbound text and any inbound replies are pushed to the
                lead&apos;s FUB timeline automatically.
              </p>
            </div>
          )}

          {/* Email (FUB marketing + SMTP) */}
          {step.step_type === 'email' && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <label className="text-xs text-muted">Load from library</label>
                <Select
                  className="max-w-md flex-1 min-w-[12rem]"
                  value=""
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v) applyTemplate(index, v);
                    e.target.value = '';
                  }}
                >
                  <option value="">— Email template (by folder) —</option>
                  {emailTemplateGroups.map((g) => (
                    <optgroup key={g.key} label={g.label}>
                      {g.items.map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </Select>
                <Link href="/templates" className="text-xs text-accent hover:underline">
                  Manage templates
                </Link>
              </div>
              <div>
                <label className="block text-xs text-muted mb-1">
                  Email subject
                  <span className="text-muted/60 ml-1">
                    {'{first_name}'} {'{project}'} …
                  </span>
                </label>
                <Input
                  value={step.email_subject_template}
                  onChange={(e) => updateStep(index, { email_subject_template: e.target.value })}
                  placeholder="{first_name}, quick follow-up on {project}"
                />
              </div>
              <div>
                <label className="block text-xs text-muted mb-1">Body format</label>
                <Select
                  value={step.email_body_format}
                  onChange={(e) => {
                    const v = e.target.value as EmailBodyFormat;
                    updateStep(index, { email_body_format: v });
                  }}
                >
                  <option value="plain">Plain text (line breaks become HTML paragraphs)</option>
                  <option value="html">HTML (paste or upload designed content; use full URLs for images)</option>
                </Select>
              </div>
              <div>
                <label className="block text-xs text-muted mb-1">
                  {step.email_body_format === 'html' ? 'Email body (HTML)' : 'Email body (plain text)'}
                  <span className="text-muted/60 ml-1">
                    {'{first_name}'} {'{last_name}'} {'{project}'} {'{campaign}'}
                  </span>
                </label>
                <Textarea
                  value={step.message_template}
                  onChange={(e) => updateStep(index, { message_template: e.target.value })}
                  placeholder={
                    step.email_body_format === 'html'
                      ? '<html><body><p>Hi {first_name},</p><img src="https://…" alt="" /></body></html>'
                      : 'Hi {first_name},\n\nThanks again for reaching out about {project}...'
                  }
                  rows={step.email_body_format === 'html' ? 14 : 6}
                  className={step.email_body_format === 'html' ? 'font-mono text-xs' : ''}
                />
              </div>
              {step.email_body_format === 'html' && step.message_template.trim() && (
                <div className="rounded-lg border border-border overflow-hidden bg-background">
                  <p className="text-[10px] uppercase tracking-wide text-muted px-3 py-1.5 bg-card-hover border-b border-border">
                    Preview (how HTML may render)
                  </p>
                  <iframe
                    title="Email preview"
                    className="w-full min-h-[200px] bg-white"
                    sandbox=""
                    srcDoc={step.message_template}
                  />
                </div>
              )}
              <div>
                <label className="block text-xs text-muted mb-1">
                  Show on FUB timeline as sent by (optional)
                </label>
                <FubUserPicker
                  users={fubUsers}
                  loading={fubUsersLoading}
                  error={fubUsersError}
                  value={step.fub_email_user_id}
                  onChange={(v) => updateStep(index, { fub_email_user_id: v })}
                />
                <p className="text-xs text-muted mt-1">
                  Credits the <code className="text-[11px]">delivered</code> event to this FUB user. If unset, uses{' '}
                  <code className="text-[11px]">FUB_EMAIL_USER_ID</code> or{' '}
                  <code className="text-[11px]">FUB_DEFAULT_TASK_ASSIGNED_USER_ID</code> in env.
                </p>
              </div>
              <p className="text-xs text-muted">
                Emails register on FUB&apos;s marketing timeline via emCampaigns API. To also deliver
                to the lead&apos;s inbox, configure SMTP_HOST / SMTP_USER / SMTP_PASS / EMAIL_FROM.
                For native FUB inbox delivery, use the &quot;FUB Action Plan&quot; step type instead.
              </p>
            </div>
          )}

          {/* FUB Action Plan */}
          {step.step_type === 'fub_action_plan' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-muted mb-1">Action Plan</label>
                {plansLoading ? (
                  <p className="text-sm text-muted animate-pulse">Loading FUB action plans…</p>
                ) : actionPlans.length > 0 ? (
                  <Select
                    value={step.fub_action_plan_id === '' ? '' : String(step.fub_action_plan_id)}
                    onChange={(e) => {
                      const v = e.target.value;
                      updateStep(index, {
                        fub_action_plan_id: v === '' ? '' : parseInt(v, 10) || '',
                      });
                    }}
                  >
                    <option value="">— Select an action plan —</option>
                    {actionPlans.map((ap) => (
                      <option key={ap.id} value={ap.id}>
                        {ap.name} (#{ap.id})
                      </option>
                    ))}
                  </Select>
                ) : (
                  <div>
                    <Input
                      type="number"
                      min={1}
                      placeholder="FUB Action Plan ID"
                      value={step.fub_action_plan_id === '' ? '' : step.fub_action_plan_id}
                      onChange={(e) => {
                        const v = e.target.value;
                        updateStep(index, {
                          fub_action_plan_id: v === '' ? '' : parseInt(v, 10) || '',
                        });
                      }}
                    />
                    <p className="text-xs text-muted mt-1">
                      Could not load plans from FUB. Enter the plan ID manually.
                    </p>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs text-muted mb-1">Label / note (optional)</label>
                <Input
                  value={step.fub_task_name_template}
                  onChange={(e) => updateStep(index, { fub_task_name_template: e.target.value })}
                  placeholder="e.g. 7-Day Email Nurture Plan"
                />
              </div>
              <p className="text-xs text-muted">
                Applies a pre-built FUB action plan to the lead. Emails send from the agent&apos;s
                connected inbox in FUB. Replies land directly in FUB. The action plan and its
                trigger are also logged on the FUB timeline.
              </p>
            </div>
          )}

          {/* FUB Task */}
          {step.step_type === 'fub_task' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-muted mb-1">Task type (FUB)</label>
                <Select
                  value={step.fub_task_type}
                  onChange={(e) => updateStep(index, { fub_task_type: e.target.value })}
                >
                  {FUB_TASK_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="block text-xs text-muted mb-1">
                  Task name
                  <span className="text-muted/60 ml-1">
                    {'{first_name}'} {'{last_name}'} {'{project}'} {'{campaign}'}
                  </span>
                </label>
                <Input
                  value={step.fub_task_name_template}
                  onChange={(e) => updateStep(index, { fub_task_name_template: e.target.value })}
                  placeholder="Call {first_name} about {project}"
                />
                <p className="text-xs text-muted mt-1">
                  Due time is when this step runs, plus the offset below (e.g. 30 = call in 30 minutes).
                  Task creation is logged on the FUB timeline automatically.
                </p>
              </div>
              <div>
                <label className="block text-xs text-muted mb-1">Due in (minutes)</label>
                <Input
                  type="number"
                  min={0}
                  className="max-w-[12rem]"
                  value={step.fub_due_offset_minutes}
                  onChange={(e) =>
                    updateStep(index, { fub_due_offset_minutes: parseInt(e.target.value) || 0 })
                  }
                />
              </div>
              <div>
                <label className="block text-xs text-muted mb-1">Assign task to (Follow Up Boss)</label>
                <FubUserPicker
                  users={fubUsers}
                  loading={fubUsersLoading}
                  error={fubUsersError}
                  value={step.fub_assigned_user_id}
                  onChange={(v) => updateStep(index, { fub_assigned_user_id: v })}
                />
                <p className="text-xs text-muted mt-1">
                  If you leave default, the runner uses <code className="text-[11px]">FUB_DEFAULT_TASK_ASSIGNED_USER_ID</code>{' '}
                  in env, then the contact&apos;s assigned agent in FUB.
                </p>
              </div>
              <div>
                <label className="block text-xs text-muted mb-1">
                  Reminder (seconds before due, optional)
                </label>
                <Input
                  type="number"
                  min={0}
                  placeholder="e.g. 900 for 15 min"
                  value={step.fub_remind_seconds_before === '' ? '' : step.fub_remind_seconds_before}
                  onChange={(e) => {
                    const v = e.target.value;
                    updateStep(index, {
                      fub_remind_seconds_before: v === '' ? '' : parseInt(v, 10) || '',
                    });
                  }}
                />
              </div>
            </div>
          )}
        </div>
      ))}

      <Button variant="secondary" onClick={addStep} className="w-full">
        <Plus size={14} className="mr-2" /> Add touch
      </Button>
    </div>
  );
}
