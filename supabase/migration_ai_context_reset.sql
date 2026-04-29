-- When set, loadConversationHistory only includes messages with created_at > this time.
-- Full message history is kept for the UI; the model sees a clean slate.
ALTER TABLE drip_ai_conversations
  ADD COLUMN IF NOT EXISTS context_reset_at TIMESTAMPTZ;
