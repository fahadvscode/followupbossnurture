'use client';

import { Mail, MessageSquare, Phone, ClipboardList, ListTodo } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatDripStepDayLabel } from '@/lib/utils';
import {
  templateChannelCounts,
  templateDurationLabel,
  type CampaignTemplate,
  type TemplateStep,
} from '@/lib/campaign-templates';

type Props = {
  template: CampaignTemplate | null;
  open: boolean;
  onClose: () => void;
  onUse?: () => void;
};

function stepTypeLabel(step: TemplateStep): string {
  switch (step.step_type) {
    case 'sms':
      return 'SMS';
    case 'email':
      return 'Email';
    case 'fub_task':
      return `FUB ${step.fub_task_type || 'Task'}`;
    case 'fub_action_plan':
      return 'FUB Action Plan';
    default:
      return 'Touch';
  }
}

function StepIcon({ step }: { step: TemplateStep }) {
  const size = 14;
  switch (step.step_type) {
    case 'sms':
      return <MessageSquare size={size} className="text-accent" />;
    case 'email':
      return <Mail size={size} className="text-accent" />;
    case 'fub_task':
      return <Phone size={size} className="text-warning" />;
    default:
      return <ListTodo size={size} className="text-muted" />;
  }
}

function stepPreviewBody(step: TemplateStep): string {
  if (step.step_type === 'email') {
    const subj = step.email_subject_template?.trim();
    const body = step.message_template?.trim();
    if (subj && body) return `Subject: ${subj}\n\n${body}`;
    return subj || body || '(empty email)';
  }
  if (step.step_type === 'fub_task' || step.step_type === 'fub_action_plan') {
    return step.fub_task_name_template?.trim() || '(task name)';
  }
  return step.message_template?.trim() || '(empty message)';
}

function remindLabel(seconds: number | ''): string | null {
  if (seconds === '' || !seconds) return null;
  const n = Number(seconds);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n < 3600) return `${Math.round(n / 60)} min before`;
  return `${Math.round(n / 3600)}h before`;
}

export function TemplatePreviewModal({ template, open, onClose, onUse }: Props) {
  if (!template) return null;

  const counts = templateChannelCounts(template.steps);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={template.name}
      className="max-w-2xl"
    >
      <p className="text-sm text-muted mb-4">{template.description}</p>

      <div className="flex flex-wrap gap-2 mb-5">
        <Badge variant="info">{templateDurationLabel(template.steps)}</Badge>
        <Badge variant="default">{template.steps.length} touches</Badge>
        {counts.sms > 0 && (
          <Badge variant="default">
            <MessageSquare size={11} className="mr-1 inline" /> {counts.sms} SMS
          </Badge>
        )}
        {counts.email > 0 && (
          <Badge variant="default">
            <Mail size={11} className="mr-1 inline" /> {counts.email} email
          </Badge>
        )}
        {counts.task > 0 && (
          <Badge variant="default">
            <Phone size={11} className="mr-1 inline" /> {counts.task} tasks
          </Badge>
        )}
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2 bg-card-hover border-b border-border text-xs font-medium text-muted">
          <ClipboardList size={14} />
          Touch timeline (from enrollment)
        </div>
        <ol className="divide-y divide-border max-h-[50vh] overflow-y-auto">
          {template.steps.map((step) => {
            const remind = remindLabel(step.fub_remind_seconds_before);
            return (
              <li key={step.step_number} className="px-4 py-3">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/10">
                    <StepIcon step={step} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="text-xs font-semibold text-foreground">
                        {formatDripStepDayLabel(step)}
                      </span>
                      <Badge variant="default" className="text-[10px]">
                        {stepTypeLabel(step)}
                      </Badge>
                      {remind && (
                        <span className="text-[10px] text-warning">Reminder {remind}</span>
                      )}
                    </div>
                    <pre className="text-xs text-muted whitespace-pre-wrap font-sans leading-relaxed">
                      {stepPreviewBody(step)}
                    </pre>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 mt-6">
        <Button type="button" variant="secondary" onClick={onClose}>
          Close
        </Button>
        {onUse && (
          <Button type="button" onClick={onUse}>
            Use this template
          </Button>
        )}
      </div>
    </Modal>
  );
}
