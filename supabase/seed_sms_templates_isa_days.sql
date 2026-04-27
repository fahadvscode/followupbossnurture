-- Preload SMS templates for ISA Day 1, 2, and 7 (same copy as seed_7day_sms_email_campaign.sql SMS steps).
-- PREREQUISITE:
--   migration_drip_message_templates.sql
--   migration_drip_template_folders.sql (adds folder_id on templates)
-- Safe to re-run: skips any row whose name already exists.

INSERT INTO drip_template_folders (name, sort_order)
SELECT 'ISA 7-Day Drip', 10
WHERE NOT EXISTS (SELECT 1 FROM drip_template_folders WHERE name = 'ISA 7-Day Drip');

INSERT INTO drip_message_templates (name, channel, email_subject, body_plain, body_html, folder_id)
SELECT
  'ISA — Day 1 SMS',
  'sms',
  '',
  'Hi {first_name}, thanks for interest in {project}! Quick Q — live-in or invest? I have early access pricing.',
  NULL,
  f.id
FROM drip_template_folders f
WHERE f.name = 'ISA 7-Day Drip'
  AND NOT EXISTS (SELECT 1 FROM drip_message_templates WHERE name = 'ISA — Day 1 SMS');

INSERT INTO drip_message_templates (name, channel, email_subject, body_plain, body_html, folder_id)
SELECT
  'ISA — Day 2 SMS',
  'sms',
  '',
  'Hey {first_name}, tried calling about {project}. Floor plans going fast — want me to send?',
  NULL,
  f.id
FROM drip_template_folders f
WHERE f.name = 'ISA 7-Day Drip'
  AND NOT EXISTS (SELECT 1 FROM drip_message_templates WHERE name = 'ISA — Day 2 SMS');

INSERT INTO drip_message_templates (name, channel, email_subject, body_plain, body_html, folder_id)
SELECT
  'ISA — Day 7 SMS',
  'sms',
  '',
  'Closing the loop on {project}. Not the right time? I''ll keep you posted.',
  NULL,
  f.id
FROM drip_template_folders f
WHERE f.name = 'ISA 7-Day Drip'
  AND NOT EXISTS (SELECT 1 FROM drip_message_templates WHERE name = 'ISA — Day 7 SMS');
