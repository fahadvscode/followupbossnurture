-- Optional FUB user id for email-step timeline attribution (postEmEmailDelivered userId).
-- Run in Supabase SQL Editor if the column is missing.

ALTER TABLE drip_campaign_steps
  ADD COLUMN IF NOT EXISTS fub_email_user_id INTEGER;
