-- Idempotent log of auto-SMS replies triggered by inbound FUB calls.
CREATE TABLE IF NOT EXISTS drip_call_auto_sms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fub_call_id INTEGER NOT NULL UNIQUE,
  to_number TEXT NOT NULL,
  from_number TEXT NOT NULL,
  fub_person_id INTEGER,
  twilio_sid TEXT,
  message_body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent'
    CHECK (status IN ('sent', 'skipped', 'failed')),
  skip_reason TEXT,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS drip_call_auto_sms_created_at_idx
  ON drip_call_auto_sms (created_at DESC);
