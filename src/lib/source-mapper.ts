import type { SourceCategory } from '@/types';

const SOURCE_MAP: { pattern: RegExp; category: SourceCategory; }[] = [
  { pattern: /facebook|fb\s|fb_|meta\s/i, category: 'Facebook' },
  { pattern: /google|adwords|ppc/i, category: 'Google' },
  { pattern: /website|web\s|homepage|organic/i, category: 'Website' },
  { pattern: /landing\s?page|cornerstone|novella|lp_/i, category: 'Landing Page' },
  { pattern: /email\s?signup|newsletter|mailchimp|email\s?list/i, category: 'Email Signup' },
  { pattern: /manual|import|csv|spreadsheet|added\s?by/i, category: 'Manual' },
  { pattern: /referral|refer|word\s?of\s?mouth/i, category: 'Referral' },
];

const LANDING_PAGE_PATTERNS = [
  { pattern: /cornerstone/i, detail: 'Cornerstone' },
  { pattern: /novella/i, detail: 'Novella' },
  { pattern: /the\s?grove/i, detail: 'The Grove' },
  { pattern: /park\s?view/i, detail: 'Park View' },
  { pattern: /sky\s?tower/i, detail: 'Sky Tower' },
];

export function mapSource(rawSource: string | null, tags: string[] = []): {
  category: SourceCategory;
  detail: string | null;
} {
  const combined = [rawSource || '', ...tags].join(' ');

  let category: SourceCategory = 'Other';
  let detail: string | null = null;

  for (const mapping of SOURCE_MAP) {
    if (mapping.pattern.test(combined)) {
      category = mapping.category;
      break;
    }
  }

  if (category === 'Landing Page' || category === 'Other') {
    for (const lp of LANDING_PAGE_PATTERNS) {
      if (lp.pattern.test(combined)) {
        category = 'Landing Page';
        detail = lp.detail;
        break;
      }
    }
  }

  return { category, detail };
}
