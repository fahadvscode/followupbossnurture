-- Delivery debugging: channel + structured error payload (Twilio, FUB, SMTP, app)
ALTER TABLE drip_messages ADD COLUMN IF NOT EXISTS channel TEXT;
ALTER TABLE drip_messages ADD COLUMN IF NOT EXISTS error_detail JSONB DEFAULT NULL;

COMMENT ON COLUMN drip_messages.channel IS 'sms | email | fub_task | fub_action_plan — optional, inferred in UI if null';
COMMENT ON COLUMN drip_messages.error_detail IS 'JSON: source, message, code, twilioStatus, etc.';

NOTIFY pgrst, 'reload schema';
