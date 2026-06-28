-- Grouped tag triggers for campaigns.
-- A lead auto-enrolls only when it exactly matches a tag in at least
-- `trigger_min_groups` of the defined groups (e.g. match 2 of: Property Type, City, Category).
-- Existing `trigger_tags` (any-match) and `trigger_sources` still work when no groups are set.

ALTER TABLE drip_campaigns
  ADD COLUMN IF NOT EXISTS trigger_groups JSONB DEFAULT '[]'::jsonb;

ALTER TABLE drip_campaigns
  ADD COLUMN IF NOT EXISTS trigger_min_groups INTEGER NOT NULL DEFAULT 1;
