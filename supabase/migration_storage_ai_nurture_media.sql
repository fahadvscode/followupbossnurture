-- Public bucket for AI Nurture → Media → file uploads (Twilio needs a public image URL)
-- Supabase → SQL Editor → run this once

INSERT INTO storage.buckets (id, name, public)
VALUES ('ai-nurture-media', 'ai-nurture-media', true)
ON CONFLICT (id) DO UPDATE SET public = true;
