export type InboxReplyTemplate = {
  id: string;
  label: string;
  body: (firstName: string) => string;
};

function greet(firstName: string): string {
  const name = firstName.trim();
  return name ? `Hi ${name}` : 'Hi';
}

/**
 * Inbox SMS chips, written from real outbound replies (manual + after a lead texts back).
 * Click fills the composer so the wording can still be edited before send.
 */
export const INBOX_REPLY_TEMPLATES: InboxReplyTemplate[] = [
  {
    id: 'check_email',
    label: 'Check email / spam',
    body: (first) =>
      `${greet(first)}, just sent the details — please check your inbox or spam.`,
  },
  {
    id: 'visit_office',
    label: 'Visit office',
    body: (first) =>
      `${greet(first)}, want to come by our office in Heartland Mississauga (600 Matheson Blvd W)? Sales centre is 1pm–6pm. What time works for you?`,
  },
  {
    id: 'quick_call',
    label: 'Quick call',
    body: (first) =>
      `${greet(first)}, are you available for a quick call? You can also reach me at 647-898-1739.`,
  },
  {
    id: 'book_time',
    label: 'Book a time',
    body: (first) =>
      `${greet(first)}, grab a time that works for you here: https://www.qikfill.com/fj-booking`,
  },
  {
    id: 'ask_budget',
    label: 'Ask budget',
    body: (first) =>
      `${greet(first)}, what is your budget if you don’t mind me asking? That’ll help me send the right options.`,
  },
  {
    id: 'plans_sent',
    label: 'Plans sent',
    body: (first) =>
      `${greet(first)}, I’ve sent you the plans — please have a look and let me know what you think.`,
  },
];
