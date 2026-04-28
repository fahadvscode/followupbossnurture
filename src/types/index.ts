export interface DripContact {
  id: string;
  fub_id: number | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  source: string | null;
  source_category: SourceCategory;
  source_detail: string | null;
  tags: string[];
  stage: string | null;
  assigned_agent: string | null;
  custom_fields: Record<string, unknown>;
  opted_out: boolean;
  fub_created_at: string | null;
  source_url?: string | null;
  fub_created_via?: string | null;
  fub_updated_at?: string | null;
  fub_last_synced_at?: string | null;
  fub_snapshot?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface DripFubNote {
  id: string;
  contact_id: string;
  fub_note_id: number;
  subject: string | null;
  body: string | null;
  is_html: boolean;
  note_type: string | null;
  created_by: string | null;
  updated_by: string | null;
  fub_created_at: string | null;
  fub_updated_at: string | null;
  raw: Record<string, unknown>;
  created_at: string;
}

export interface DripFubEvent {
  id: string;
  contact_id: string;
  fub_event_id: number;
  event_type: string | null;
  message: string | null;
  description: string | null;
  event_source: string | null;
  occurred_at: string | null;
  property: Record<string, unknown> | null;
  raw: Record<string, unknown>;
  created_at: string;
}

export type SourceCategory =
  | 'Facebook'
  | 'Website'
  | 'Landing Page'
  | 'Email Signup'
  | 'Manual'
  | 'Referral'
  | 'Google'
  | 'Other';

export type CampaignType = 'standard' | 'ai_nurture';

export interface DripCampaign {
  id: string;
  name: string;
  description: string | null;
  trigger_tags: string[];
  trigger_sources: string[];
  status: CampaignStatus;
  campaign_type: CampaignType;
  /** E.164 Twilio number to send this campaign from; null uses TWILIO_PHONE_NUMBER env */
  twilio_from_number: string | null;
  created_at: string;
  updated_at: string;
}

export type CampaignStatus = 'active' | 'paused' | 'archived';

/** Follow Up Boss user row from GET /api/fub/users (subset of FUB /users). */
export type FubUserOption = {
  id: number;
  name: string;
  email: string;
  role: string;
  status: string;
};

export type CampaignStepType = 'sms' | 'email' | 'fub_action_plan' | 'fub_task';

/** Email step: plain wraps newlines for HTML; html sends message_template as real HTML (images, layout). */
export type EmailBodyFormat = 'plain' | 'html';

export interface DripTemplateFolder {
  id: string;
  name: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface DripMessageTemplate {
  id: string;
  folder_id: string | null;
  name: string;
  channel: 'sms' | 'email';
  email_subject: string;
  body_plain: string;
  body_html: string | null;
  created_at: string;
  updated_at: string;
}

export interface DripCampaignStep {
  id: string;
  campaign_id: string;
  step_number: number;
  delay_days: number;
  delay_hours: number;
  delay_minutes: number;
  message_template: string;
  step_type: CampaignStepType;
  /** Used when step_type is email; merge tags same as SMS body */
  email_subject_template: string;
  email_body_format: EmailBodyFormat;
  /** FUB action plan ID to apply (step_type fub_action_plan) */
  fub_action_plan_id: number | null;
  /** FUB task type: Call, Text, Email, Follow Up, etc. */
  fub_task_type: string;
  /** Task title; supports {first_name}, {last_name}, {project}, {campaign} */
  fub_task_name_template: string;
  /** Minutes after this step runs (cron) until task due time */
  fub_due_offset_minutes: number;
  fub_assigned_user_id: number | null;
  /** FUB user id for email timeline attribution (postEmEmailDelivered); optional */
  fub_email_user_id: number | null;
  fub_remind_seconds_before: number | null;
  created_at: string;
}

export interface DripEnrollment {
  id: string;
  contact_id: string;
  campaign_id: string;
  status: EnrollmentStatus;
  current_step: number;
  enrolled_at: string;
  paused_at: string | null;
  completed_at: string | null;
}

export type EnrollmentStatus = 'active' | 'paused' | 'completed' | 'opted_out';

export interface DripMessage {
  id: string;
  enrollment_id: string | null;
  contact_id: string;
  campaign_id: string | null;
  step_number: number | null;
  direction: 'outbound' | 'inbound';
  body: string;
  twilio_sid: string | null;
  status: MessageStatus;
  sent_at: string | null;
  created_at: string;
  /** sms | email | fub_task | fub_action_plan when set */
  channel?: string | null;
  /** Structured provider / app error (Twilio callback, API, config) */
  error_detail?: Record<string, unknown> | null;
}

export type MessageStatus = 'queued' | 'sent' | 'delivered' | 'failed' | 'received';

export interface DripOptOut {
  id: string;
  contact_id: string;
  phone: string;
  reason: string;
  opted_out_at: string;
}

export interface DripSyncLog {
  id: string;
  sync_type: 'full' | 'webhook' | 'manual';
  status: 'running' | 'completed' | 'failed';
  contacts_synced: number;
  started_at: string;
  completed_at: string | null;
  error: string | null;
}

export interface CampaignWithSteps extends DripCampaign {
  steps: DripCampaignStep[];
}

export interface CampaignStats {
  total_enrolled: number;
  active: number;
  completed: number;
  paused: number;
  opted_out: number;
  messages_sent: number;
  messages_delivered: number;
  messages_failed: number;
  replies: number;
  reply_rate: number;
}

export interface EnrollmentWithContact extends DripEnrollment {
  contact: DripContact;
}

export interface ContactWithEnrollments extends DripContact {
  enrollments: (DripEnrollment & { campaign: DripCampaign })[];
  messages: DripMessage[];
}

export interface SourceAnalytics {
  source_category: SourceCategory;
  count: number;
  replied: number;
  engagement_rate: number;
}

export interface StepPerformance {
  step_number: number;
  delay_days: number;
  sent: number;
  delivered: number;
  failed: number;
  replies: number;
  reply_rate: number;
}

// ─── AI Nurture Engine types ─────────────────────────────────────────

export type AiCampaignGoal = 'book_call' | 'long_nurture' | 'visit_site';
export type AiEscalationAction = 'pause' | 'fub_task' | 'both';
export type AiConversationStatus = 'active' | 'paused' | 'escalated' | 'goal_met';
export type AiMediaSendWith = 'first' | 'follow_up' | 'any' | 'manual';
export type AiDocType = 'text' | 'file';

export interface AiCampaignConfig {
  id: string;
  campaign_id: string;
  goal: AiCampaignGoal;
  booking_url: string | null;
  landing_url: string | null;
  persona_name: string | null;
  personality: string;
  max_exchanges: number;
  follow_up_delay_minutes: number;
  max_follow_ups: number;
  escalation_action: AiEscalationAction;
  escalation_fub_user_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface AiKnowledgeDoc {
  id: string;
  campaign_id: string;
  doc_type: AiDocType;
  title: string;
  content_text: string;
  file_url: string | null;
  file_name: string | null;
  file_size: number | null;
  mime_type: string | null;
  extracted_text: string | null;
  sort_order: number;
  created_at: string;
}

export interface AiMedia {
  id: string;
  campaign_id: string;
  title: string;
  media_url: string;
  mime_type: string | null;
  send_with: AiMediaSendWith;
  sort_order: number;
  created_at: string;
}

export interface AiConversation {
  id: string;
  enrollment_id: string;
  contact_id: string;
  campaign_id: string;
  exchange_count: number;
  follow_up_count: number;
  last_outbound_at: string | null;
  last_inbound_at: string | null;
  status: AiConversationStatus;
  goal_met_at: string | null;
  escalation_reason: string | null;
  conversation_summary: string | null;
  created_at: string;
  updated_at: string;
}

export interface AiCampaignWithConfig extends DripCampaign {
  ai_config: AiCampaignConfig;
}

export interface AiConversationWithContact extends AiConversation {
  contact: DripContact;
}

export interface FUBPerson {
  id: number;
  firstName: string;
  lastName: string;
  emails: { value: string; type: string }[];
  phones: { value: string; type: string }[];
  source: string | null;
  tags: string[];
  stage: string | null;
  assignedTo: string | null;
  created: string;
  updated: string;
  [key: string]: unknown;
}
