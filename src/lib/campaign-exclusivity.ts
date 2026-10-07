/**
 * Cloned campaigns like "Pre-Con — 7-Day Fast Start (Enclave Milton Towns)"
 * share a family with "Pre-Con — 7-Day Fast Start (Hawthorne East)".
 * A lead should only run ONE campaign in that family, scored against the
 * latest inquiry (e.g. Facebook.Enclave Milton Towns) — not leftover CRM tags.
 */

export type ExclusiveCampaign = {
  id: string;
  name: string;
  trigger_tags?: string[] | null;
  trigger_groups?: { label?: string; tags?: string[] }[] | null;
};

/** Strip a trailing "(variant)" so clones share a family key. */
export function campaignFamilyKey(name: string): string {
  return name.replace(/\s*\([^)]*\)\s*$/, '').trim().toLowerCase();
}

export function campaignVariantLabel(name: string): string {
  const m = name.match(/\(([^)]+)\)\s*$/);
  return (m?.[1] || '').trim();
}

export function exclusiveFamilySizes(campaigns: { name: string }[]): Map<string, number> {
  const sizes = new Map<string, number>();
  for (const c of campaigns) {
    const key = campaignFamilyKey(c.name);
    sizes.set(key, (sizes.get(key) || 0) + 1);
  }
  return sizes;
}

export function normalizeHaystack(text: string): string {
  return text
    .toLowerCase()
    .replace(/[._/+\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function allTriggerTags(campaign: ExclusiveCampaign): string[] {
  const tags: string[] = [];
  for (const t of campaign.trigger_tags || []) {
    if (t.trim()) tags.push(t.trim());
  }
  for (const group of campaign.trigger_groups || []) {
    for (const t of group?.tags || []) {
      if (t.trim()) tags.push(t.trim());
    }
  }
  return tags;
}

function tagCountsInFamily(family: ExclusiveCampaign[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const campaign of family) {
    const seen = new Set<string>();
    for (const tag of allTriggerTags(campaign)) {
      const n = tag.toLowerCase();
      if (seen.has(n)) continue;
      seen.add(n);
      counts.set(n, (counts.get(n) || 0) + 1);
    }
  }
  return counts;
}

export function scoreCampaignForInquiry(
  campaign: ExclusiveCampaign,
  family: ExclusiveCampaign[],
  contactTags: string[],
  inquiryContext: string,
  /** false = score only against the inquiry text (leftover contact tags ignored). */
  useContactTags = true
): number {
  const haystack = normalizeHaystack(inquiryContext);
  const contact = new Set(
    useContactTags ? contactTags.map((t) => t.trim().toLowerCase()).filter(Boolean) : []
  );
  const counts = tagCountsInFamily(family);
  const variantNorm = normalizeHaystack(campaignVariantLabel(campaign.name));
  let score = 0;

  if (variantNorm && haystack.includes(variantNorm)) score += 100;

  for (const token of variantNorm.split(' ').filter((t) => t.length >= 4)) {
    if (haystack.includes(token)) score += 12;
  }

  for (const tag of allTriggerTags(campaign)) {
    const n = tag.toLowerCase();
    const unique = (counts.get(n) || 0) === 1;
    const inInquiry = Boolean(haystack) && haystack.includes(n);
    const onContact = contact.has(n);
    if (unique && inInquiry) score += 30;
    else if (unique && onContact) score += 20;
    else if (inInquiry) score += 4;
  }

  const propGroup = (campaign.trigger_groups || []).find((g) =>
    /property/i.test(g.label || '')
  );
  for (const t of propGroup?.tags || []) {
    const n = t.trim().toLowerCase();
    if (!n) continue;
    if ((counts.get(n) || 0) === 1 && (contact.has(n) || haystack.includes(n))) {
      score += 25;
    }
  }

  return score;
}

export function pickExclusiveWinner<T extends ExclusiveCampaign>(
  campaigns: T[],
  contactTags: string[],
  inquiryContext: string
): T {
  if (campaigns.length === 0) {
    throw new Error('pickExclusiveWinner requires at least one campaign');
  }
  if (campaigns.length === 1) return campaigns[0];

  const pick = (useContactTags: boolean) => {
    let best = campaigns[0];
    let bestScore = scoreCampaignForInquiry(best, campaigns, contactTags, inquiryContext, useContactTags);
    for (let i = 1; i < campaigns.length; i++) {
      const next = campaigns[i];
      const score = scoreCampaignForInquiry(next, campaigns, contactTags, inquiryContext, useContactTags);
      if (
        score > bestScore ||
        (score === bestScore && next.name.localeCompare(best.name) < 0)
      ) {
        best = next;
        bestScore = score;
      }
    }
    return { best, bestScore };
  };

  // 1) The latest inquiry text decides, ignoring leftover tags from older inquiries.
  const byInquiry = pick(false);
  if (byInquiry.bestScore > 0) return byInquiry.best;

  // 2) Inquiry text matched nothing (or is missing): fall back to the contact's tags.
  return pick(true).best;
}
