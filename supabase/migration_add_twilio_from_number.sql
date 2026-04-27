-- Run once if you already applied migration.sql before twilio_from_number existed
ALTER TABLE drip_campaigns ADD COLUMN IF NOT EXISTS twilio_from_number TEXT;
