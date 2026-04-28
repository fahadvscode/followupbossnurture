import OpenAI from 'openai';
import { getServiceClient } from './supabase';
import { sendSMS, sendMMS } from './twilio';
import { normalizePhone } from './utils';
import { pushEvent, createFubTask } from './fub';
import type {
  AiCampaignConfig,
  AiConversation,
  AiKnowledgeDoc,
  AiMedia,
  DripContact,
  DripCampaign,
  DripMessage,
} from '@/types';

// ─── DeepSeek client ─────────────────────────────────────────────────

function getAiClient() {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (!apiKey) throw new Error('DEEPSEEK_API_KEY is not set');
  return new OpenAI({ apiKey, baseURL: 'https://api.deepseek.com' });
}

// ─── System prompt builder ───────────────────────────────────────────

const GOAL_INSTRUCTIONS: Record<AiCampaignConfig['goal'], string> = {
  book_call: `End goal: a quick call. Build curiosity exchange by exchange. Only suggest a call after the lead has asked 2+ questions or shown real interest — keep it casual: "want to hop on a quick call this week?" Share the booking link only when they say yes.`,
  long_nurture: `End goal: stay top of mind over weeks. Share one interesting detail per exchange, never push. Think of yourself as a knowledgeable friend in real estate checking in periodically.`,
  visit_site: `End goal: get the lead to visit the site. Tease compelling facts first. Share the link naturally only after 2–3 engaged replies — never in the first message.`,
};

export function buildSystemPrompt(
  config: AiCampaignConfig,
  campaign: DripCampaign,
  docs: AiKnowledgeDoc[],
  opts?: { contactFirstName?: string; isFirstMessage?: boolean }
): string {
  const knowledge = docs
    .map((d) => {
      const text = d.doc_type === 'file' ? d.extracted_text || '' : d.content_text;
      return text.trim() ? `### ${d.title}\n${text.trim()}` : '';
    })
    .filter(Boolean)
    .join('\n\n');

  const goalUrl =
    config.goal === 'book_call'
      ? config.booking_url
      : config.goal === 'visit_site'
        ? config.landing_url
        : null;

  const personaName = config.persona_name?.trim() || null;
  const contactName = opts?.contactFirstName?.trim() || null;

  const firstMessageBlock = opts?.isFirstMessage
    ? `
## FIRST MESSAGE — follow exactly
- Start: "Hey ${contactName || 'there'}!"${personaName ? ` then "it's ${personaName}"` : ''}
- Acknowledge their interest in ${campaign.name} naturally — e.g. "saw your inquiry" or "noticed you were looking at this one"
- Drop ONE intriguing detail that creates curiosity (a unique feature, scarcity, or price angle they wouldn't already know)
- End with ONE soft open-ended question — NOT yes/no. E.g. "what matters more to you, location or price?" or "have you seen it yet?"
- Entire message under 160 characters. One flowing sentence — no bullet points, no line breaks, no URLs`
    : '';

  return `You are ${personaName || 'someone'} — texting a real estate lead. You are a real person. Never hint you are AI.${contactName ? ` The lead's name is ${contactName}.` : ''} Project: ${campaign.name}.

${config.personality ? `## Personality\n${config.personality}` : '## Personality\nWarm, low-pressure, knowledgeable. Like a helpful friend in real estate.'}

## Objective
${GOAL_INSTRUCTIONS[config.goal]}
${goalUrl ? `\nBooking/site link (share naturally after 2–3 engaged replies, never first message): ${goalUrl}` : ''}

## Curiosity strategy — the most important part
Every single message must make the lead want to reply to find out more. Do this by:
1. Sharing ONE compelling detail but leaving a natural "next question" unanswered
2. Answering their question then ending with a hook — e.g. "there's also something about the promo that's worth knowing" or "the location story is actually more interesting than most people realise"
3. Reflecting what they said, then adding one new thing that raises their curiosity

Example hooks that work:
- "there's a reason buyers from outside the city keep asking about this one specifically"
- "the deposit structure is actually pretty different from what most pre-cons do"
- "one detail about the location that most people don't know about"

## Hard rules
- SHORT — ideally under 160 chars, max 300. No paragraphs.
- Match their energy. Brief reply = brief response.
- No emojis unless they use them first.
- NEVER say "haha my bad", "wrong chat", "meant for someone else", or any fake tricks
- NEVER repeat info already in the conversation history — read it and move forward
- NEVER apologise for previous messages unless there was a real error
- When they say "send it" / "yes" / "sure" — deliver directly, no preamble
- If not interested — one graceful close, done
- If you don't know something — say you'll find out, don't make things up
${firstMessageBlock}

## Project knowledge
${knowledge || '(No docs loaded — ask questions to keep conversation going.)'}

Reply with ONLY the SMS text. No quotes, labels, or explanation.`;
}

// ─── Message generation ──────────────────────────────────────────────

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export async function generateMessage(
  conversationHistory: ChatMessage[],
  systemPrompt: string,
  isFollowUp: boolean
): Promise<string> {
  const client = getAiClient();

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory,
  ];

  if (isFollowUp && conversationHistory.length > 0) {
    messages.push({
      role: 'system',
      content:
        'The lead has not replied. Send a short, natural follow-up that sparks curiosity from a completely different angle — share one new intriguing detail they haven\'t heard yet, or ask a different light question. Never repeat what you already said. Under 100 characters ideally.',
    });
  }

  const response = await client.chat.completions.create({
    model: 'deepseek-chat',
    messages,
    max_tokens: 150,
    temperature: 0.9,
  });

  const text = response.choices[0]?.message?.content?.trim() || '';
  return text.replace(/^["']|["']$/g, '');
}

// ─── Sentiment / escalation detection ────────────────────────────────

const SENSITIVE_PATTERNS = [
  /\b(speak|talk|call)\s+(to|with)\s+(a\s+)?(real\s+)?(person|human|agent|someone)/i,
  /\b(f+u+c+k|sh+i+t|a+s+s+h+o+l+e|damn|hell)\b/i,
  /\b(stop|unsubscribe|leave me alone|don't (text|message|contact))\b/i,
  /\b(angry|furious|pissed|upset|annoyed|frustrated)\b/i,
  /\b(lawsuit|lawyer|attorney|sue|legal|report)\b/i,
  /\b(do not disturb|dnd|harassment|harassing)\b/i,
];

export function detectSensitiveReply(text: string): {
  isSensitive: boolean;
  reason: string | null;
} {
  for (const pattern of SENSITIVE_PATTERNS) {
    if (pattern.test(text)) {
      return { isSensitive: true, reason: `Matched pattern: ${pattern.source}` };
    }
  }
  return { isSensitive: false, reason: null };
}

export function shouldEscalate(
  conversation: AiConversation,
  config: AiCampaignConfig,
  sensitiveReply: boolean
): { escalate: boolean; reason: string | null } {
  if (sensitiveReply) {
    return { escalate: true, reason: 'Sensitive reply detected — needs human review' };
  }
  if (conversation.exchange_count >= config.max_exchanges) {
    return {
      escalate: true,
      reason: `Max exchanges reached (${config.max_exchanges})`,
    };
  }
  return { escalate: false, reason: null };
}

// ─── Media selection ─────────────────────────────────────────────────

// Twilio MMS only supports JPEG, PNG, and GIF — webp/svg/etc will be rejected
const TWILIO_MMS_SUPPORTED = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];

export function selectMedia(
  mediaAssets: AiMedia[],
  messageType: 'first' | 'follow_up'
): AiMedia | null {
  const eligible = mediaAssets.filter(
    (m) =>
      (m.send_with === 'any' || m.send_with === messageType) &&
      TWILIO_MMS_SUPPORTED.includes((m.mime_type || '').toLowerCase())
  );
  return eligible.length > 0 ? eligible[0] : null;
}

// ─── Load conversation context from DB messages ──────────────────────

export async function loadConversationHistory(
  enrollmentId: string,
  limit = 20
): Promise<ChatMessage[]> {
  const db = getServiceClient();
  const { data: messages } = await db
    .from('drip_messages')
    .select('direction, body')
    .eq('enrollment_id', enrollmentId)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (!messages) return [];

  return messages.map((m: { direction: string; body: string }) => ({
    role: (m.direction === 'outbound' ? 'assistant' : 'user') as 'assistant' | 'user',
    content: m.body,
  }));
}

// ─── Load campaign AI context ────────────────────────────────────────

export async function loadAiCampaignContext(campaignId: string) {
  const db = getServiceClient();

  const [configRes, docsRes, mediaRes, campaignRes] = await Promise.all([
    db
      .from('drip_ai_campaign_config')
      .select('*')
      .eq('campaign_id', campaignId)
      .single(),
    db
      .from('drip_ai_knowledge_docs')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('sort_order'),
    db
      .from('drip_ai_media')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('sort_order'),
    db.from('drip_campaigns').select('*').eq('id', campaignId).single(),
  ]);

  return {
    config: configRes.data as AiCampaignConfig | null,
    docs: (docsRes.data || []) as AiKnowledgeDoc[],
    media: (mediaRes.data || []) as AiMedia[],
    campaign: campaignRes.data as DripCampaign | null,
  };
}

// ─── Send AI message (first touch or follow-up) ─────────────────────

export async function sendAiMessage(opts: {
  enrollmentId: string;
  contactId: string;
  campaignId: string;
  contact: DripContact;
  isFollowUp: boolean;
}): Promise<{ sent: boolean; escalated: boolean }> {
  const db = getServiceClient();
  const { enrollmentId, contactId, campaignId, contact, isFollowUp } = opts;
  const now = new Date().toISOString();

  const { config, docs, media, campaign } = await loadAiCampaignContext(campaignId);
  if (!campaign) {
    console.warn('sendAiMessage: campaign not found', campaignId);
    return { sent: false, escalated: false };
  }
  if (!config) {
    console.warn(
      'sendAiMessage: missing drip_ai_campaign_config for campaign',
      campaignId,
      '- run supabase/migration_ai_nurture.sql and create the campaign in AI Nurture UI'
    );
    return { sent: false, escalated: false };
  }

  let convRow = await getOrCreateConversation(enrollmentId, contactId, campaignId);

  if (convRow.status !== 'active') return { sent: false, escalated: false };
  if (isFollowUp && convRow.follow_up_count >= config.max_follow_ups) {
    await escalateConversation(convRow, config, 'Max follow-ups reached without reply', contact);
    return { sent: false, escalated: true };
  }

  const phone = normalizePhone(contact.phone);
  if (!phone) return { sent: false, escalated: false };

  const history = await loadConversationHistory(enrollmentId);
  const isFirstMessage = !isFollowUp && history.length === 0;
  const systemPrompt = buildSystemPrompt(config, campaign, docs, {
    contactFirstName: contact.first_name || undefined,
    isFirstMessage,
  });
  const aiText = await generateMessage(history, systemPrompt, isFollowUp);

  if (!aiText) return { sent: false, escalated: false };

  const mediaAsset = selectMedia(media, isFollowUp ? 'follow_up' : 'first');
  const fromNumber = campaign.twilio_from_number || undefined;

  try {
    let result: { sid: string; status: string };
    if (mediaAsset) {
      result = await sendMMS(phone, aiText, mediaAsset.media_url, fromNumber);
    } else {
      result = await sendSMS(phone, aiText, fromNumber);
    }

    await db.from('drip_messages').insert({
      enrollment_id: enrollmentId,
      contact_id: contactId,
      campaign_id: campaignId,
      direction: 'outbound',
      body: aiText,
      twilio_sid: result.sid,
      status: result.status === 'queued' ? 'queued' : 'sent',
      sent_at: now,
      channel: 'sms',
    });

    await db
      .from('drip_ai_conversations')
      .update({
        last_outbound_at: now,
        follow_up_count: isFollowUp ? convRow.follow_up_count + 1 : convRow.follow_up_count,
        exchange_count: isFollowUp ? convRow.exchange_count : convRow.exchange_count + 1,
      })
      .eq('id', convRow.id);

    if (contact.fub_id) {
      pushEvent(contact.fub_id, {
        type: 'outgoing_sms',
        source: 'Drip Platform (AI)',
        message: `[AI Nurture: ${campaign.name}] ${aiText}`,
      }).catch(() => {});
    }

    return { sent: true, escalated: false };
  } catch (err) {
    console.error('AI message send failed:', err);
    await db.from('drip_messages').insert({
      enrollment_id: enrollmentId,
      contact_id: contactId,
      campaign_id: campaignId,
      direction: 'outbound',
      body: aiText,
      status: 'failed',
      sent_at: now,
      channel: 'sms',
    });
    return { sent: false, escalated: false };
  }
}

// ─── Handle inbound reply for AI campaign ────────────────────────────

export async function handleAiReply(opts: {
  enrollmentId: string;
  contactId: string;
  campaignId: string;
  contact: DripContact;
  inboundBody: string;
}): Promise<{ replied: boolean; escalated: boolean }> {
  const db = getServiceClient();
  const { enrollmentId, contactId, campaignId, contact, inboundBody } = opts;
  const now = new Date().toISOString();

  const { config, docs, media, campaign } = await loadAiCampaignContext(campaignId);
  if (!config || !campaign) return { replied: false, escalated: false };

  let convRow = await getOrCreateConversation(enrollmentId, contactId, campaignId);
  if (convRow.status !== 'active') return { replied: false, escalated: false };

  await db
    .from('drip_ai_conversations')
    .update({
      last_inbound_at: now,
      exchange_count: convRow.exchange_count + 1,
      follow_up_count: 0,
    })
    .eq('id', convRow.id);

  convRow = { ...convRow, exchange_count: convRow.exchange_count + 1, follow_up_count: 0 };

  const sensitivity = detectSensitiveReply(inboundBody);
  const esc = shouldEscalate(convRow, config, sensitivity.isSensitive);

  if (esc.escalate) {
    await escalateConversation(convRow, config, esc.reason || 'Escalation triggered', contact);
    return { replied: false, escalated: true };
  }

  const phone = normalizePhone(contact.phone);
  if (!phone) return { replied: false, escalated: false };

  const history = await loadConversationHistory(enrollmentId);
  const systemPrompt = buildSystemPrompt(config, campaign, docs, {
    contactFirstName: contact.first_name || undefined,
    isFirstMessage: false,
  });
  const aiText = await generateMessage(history, systemPrompt, false);

  if (!aiText) return { replied: false, escalated: false };

  const mediaAsset = selectMedia(media, 'follow_up');
  const fromNumber = campaign.twilio_from_number || undefined;

  try {
    let result: { sid: string; status: string };
    if (mediaAsset) {
      result = await sendMMS(phone, aiText, mediaAsset.media_url, fromNumber);
    } else {
      result = await sendSMS(phone, aiText, fromNumber);
    }

    await db.from('drip_messages').insert({
      enrollment_id: enrollmentId,
      contact_id: contactId,
      campaign_id: campaignId,
      direction: 'outbound',
      body: aiText,
      twilio_sid: result.sid,
      status: result.status === 'queued' ? 'queued' : 'sent',
      sent_at: now,
      channel: 'sms',
    });

    await db
      .from('drip_ai_conversations')
      .update({ last_outbound_at: now })
      .eq('id', convRow.id);

    if (contact.fub_id) {
      pushEvent(contact.fub_id, {
        type: 'outgoing_sms',
        source: 'Drip Platform (AI)',
        message: `[AI Nurture: ${campaign.name}] ${aiText}`,
      }).catch(() => {});
    }

    return { replied: true, escalated: false };
  } catch (err) {
    console.error('AI reply send failed:', err);
    return { replied: false, escalated: false };
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────

async function getOrCreateConversation(
  enrollmentId: string,
  contactId: string,
  campaignId: string
): Promise<AiConversation> {
  const db = getServiceClient();

  const { data: existing } = await db
    .from('drip_ai_conversations')
    .select('*')
    .eq('enrollment_id', enrollmentId)
    .single();

  if (existing) return existing as AiConversation;

  const { data: created } = await db
    .from('drip_ai_conversations')
    .insert({
      enrollment_id: enrollmentId,
      contact_id: contactId,
      campaign_id: campaignId,
      status: 'active',
    })
    .select('*')
    .single();

  return created as AiConversation;
}

async function escalateConversation(
  conv: AiConversation,
  config: AiCampaignConfig,
  reason: string,
  contact: DripContact
) {
  const db = getServiceClient();
  const now = new Date().toISOString();

  await db
    .from('drip_ai_conversations')
    .update({ status: 'escalated', escalation_reason: reason })
    .eq('id', conv.id);

  await db
    .from('drip_enrollments')
    .update({ status: 'paused', paused_at: now })
    .eq('id', conv.enrollment_id);

  if (
    (config.escalation_action === 'fub_task' || config.escalation_action === 'both') &&
    contact.fub_id
  ) {
    const assignee = config.escalation_fub_user_id
      ? { assignedUserId: config.escalation_fub_user_id }
      : {};

    createFubTask({
      personId: contact.fub_id,
      name: `AI Nurture escalation: ${reason}`,
      type: 'Follow Up',
      dueDateTime: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      ...assignee,
    }).catch((e) => console.error('Escalation FUB task failed:', e));
  }

  if (contact.fub_id) {
    pushEvent(contact.fub_id, {
      type: 'Note',
      source: 'Drip Platform (AI)',
      message: `[AI Nurture Escalated] ${reason}`,
    }).catch(() => {});
  }
}

// ─── Find AI enrollments that need follow-up ─────────────────────────

export async function findDueAiFollowUps(): Promise<
  {
    enrollment: { id: string; contact_id: string; campaign_id: string };
    contact: DripContact;
    conversation: AiConversation;
    config: AiCampaignConfig;
  }[]
> {
  const db = getServiceClient();
  const results: Awaited<ReturnType<typeof findDueAiFollowUps>> = [];

  const { data: convos } = await db
    .from('drip_ai_conversations')
    .select('*')
    .eq('status', 'active');

  if (!convos) return results;

  for (const conv of convos as AiConversation[]) {
    if (!conv.last_outbound_at) continue;

    const lastOut = new Date(conv.last_outbound_at).getTime();
    const lastIn = conv.last_inbound_at
      ? new Date(conv.last_inbound_at).getTime()
      : 0;

    if (lastIn > lastOut) continue;

    const { data: configRow } = await db
      .from('drip_ai_campaign_config')
      .select('*')
      .eq('campaign_id', conv.campaign_id)
      .single();

    if (!configRow) continue;
    const config = configRow as AiCampaignConfig;

    if (conv.follow_up_count >= config.max_follow_ups) continue;

    const delayMs = config.follow_up_delay_minutes * 60 * 1000;
    if (Date.now() - lastOut < delayMs) continue;

    const { data: campaignRow } = await db
      .from('drip_campaigns')
      .select('status')
      .eq('id', conv.campaign_id)
      .single();
    if (!campaignRow || campaignRow.status !== 'active') continue;

    const { data: contactRow } = await db
      .from('drip_contacts')
      .select('*')
      .eq('id', conv.contact_id)
      .single();
    if (!contactRow || contactRow.opted_out) continue;

    results.push({
      enrollment: {
        id: conv.enrollment_id,
        contact_id: conv.contact_id,
        campaign_id: conv.campaign_id,
      },
      contact: contactRow as DripContact,
      conversation: conv,
      config,
    });
  }

  return results;
}
