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

// ─── Conversation stage rules ─────────────────────────────────────────
// Stage 1 (exchanges 0-1): Human connection only. No product info, no pitching.
// Stage 2 (exchanges 2-3): One detail at a time. Tease, don't dump.
// Stage 3 (exchanges 4+): Value + soft CTA. Share link only when they ask or express clear intent.

function getStageInstructions(
  exchangeCount: number,
  goal: AiCampaignConfig['goal'],
  goalUrl: string | null,
  isFirstMessage: boolean
): string {
  if (isFirstMessage) return ''; // handled separately

  if (exchangeCount <= 1) {
    return `## Stage: EARLY — human connection only
You are in the very first exchange. DO NOT mention prices, specs, sizes, promos, or any product details yet.
Focus entirely on: acknowledging what they said, showing you're listening, and asking ONE light open-ended question.
Max 80 characters. Sound like a real person checking in, not a salesperson.`;
  }

  if (exchangeCount <= 3) {
    return `## Stage: BUILDING — one detail at a time
You can now share ONE specific, interesting detail from the project knowledge.
Pick the detail most relevant to what the lead has shown interest in.
End with a hook that makes them curious about the next detail — but don't give it yet.
Max 150 characters.
${goal === 'book_call' ? 'Do NOT suggest a call yet.' : ''}
${goalUrl ? `Do NOT share the link yet.` : ''}`;
  }

  return `## Stage: WARM — genuine interest shown
The lead is engaged. You can now go slightly deeper on what they've asked about.
${goal === 'book_call' ? `If they've asked 2+ specific questions or said something like "interested" / "tell me more", you can casually mention: "want to hop on a quick call? easier to go through the details" — and only if they say yes, share: ${goalUrl}` : ''}
${goal === 'visit_site' && goalUrl ? `You can now share the link naturally if it fits: ${goalUrl}` : ''}
Max 200 characters.`;
}

// ─── Skepticism / pushback detector ─────────────────────────────────
const SKEPTICISM_PATTERNS = [
  /you('re| are) (selling|pitching|promoting)/i,
  /sounds? like (a )?sale(s|sman|sperson|sy)?/i,
  /what('s| is) (going on|this (about)?|happening)/i,
  /who (is this|are you|sent this)/i,
  /is this (a bot|automated|spam|ai)/i,
  /stop (selling|pitching|texting|messaging)/i,
  /not interested/i,
];

export function detectSkepticism(text: string): boolean {
  return SKEPTICISM_PATTERNS.some((p) => p.test(text));
}

export function buildSystemPrompt(
  config: AiCampaignConfig,
  campaign: DripCampaign,
  docs: AiKnowledgeDoc[],
  opts?: {
    contactFirstName?: string;
    isFirstMessage?: boolean;
    exchangeCount?: number;
    leadIsSkeptical?: boolean;
  }
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
  const exchangeCount = opts?.exchangeCount ?? 0;
  const isFirstMessage = opts?.isFirstMessage ?? false;
  const leadIsSkeptical = opts?.leadIsSkeptical ?? false;

  const firstMessageBlock = isFirstMessage
    ? `
## THIS IS YOUR VERY FIRST MESSAGE — follow exactly, character by character
1. Greet: "Hey ${contactName || 'there'}!"${personaName ? ` + "it's ${personaName} —"` : ''}
2. One natural acknowledgement: "saw you were looking at ${campaign.name}" or "noticed your inquiry came in"
3. One single intriguing fact that raises a question — something they wouldn't already know. Not a price dump. A curiosity hook.
4. End with ONE soft open-ended question. NOT yes/no. E.g. "what matters most — location, size, or price?" or "have you heard much about it yet?"
Total message: under 160 characters. One flowing sentence. No bullet points. No URLs. No emojis.`
    : '';

  const skepticismBlock = leadIsSkeptical
    ? `
## LEAD IS PUSHING BACK — respond with this approach only
The lead just said something like "you're selling" or "what's going on" or "who is this". They feel sold to. 
Your ONLY job right now is to disarm this completely. Do NOT pitch anything.
Say something honest and human like: "fair enough, my bad — just thought it might be worth a look. no pressure at all."
Or: "you're right, I'll keep it low key. just reached out because it seemed like your kind of thing."
Under 80 characters. Zero sales. Make them feel like you're a real person who gets it.`
    : '';

  const stageBlock =
    !isFirstMessage && !leadIsSkeptical
      ? getStageInstructions(exchangeCount, config.goal, goalUrl || null, isFirstMessage)
      : '';

  return `You are ${personaName || 'a person'} texting a real estate lead as a real human. Never reveal or hint you are AI.${contactName ? ` Lead's name: ${contactName}.` : ''} Project: ${campaign.name}.

## Your personality (STYLE GUIDE — defines HOW you write, NOT scripts to copy)
⚠️ IMPORTANT: The personality section below shows your TONE and WORD CHOICE only. The example phrases and example conversations in it are illustrations of style — do NOT copy them verbatim or use them as templates. Write completely fresh, natural responses every time.
${config.personality || 'Warm, low-pressure, knowledgeable. Like a helpful friend in real estate.'}

## Absolute rules (override everything else)
- Messages are SHORT. Ideally under 100 characters. Never more than 200 unless lead wrote a lot.
- ONE idea per message. Never list multiple facts, prices, sizes, or specs in the same message.
- Match their energy exactly. One-word reply = one short sentence back.
- No bullet points. No numbered lists. No line breaks inside a message. Ever.
- No emojis unless the lead uses them first.
- NEVER say "haha my bad", "wrong chat", "meant for someone else", or any fake gimmick.
- NEVER repeat information from earlier in the conversation. Read history. Move forward.
- When they say "yes" / "sure" / "send it" — deliver immediately, no windup.
- If not interested — one graceful "no problem at all, feel free to reach out anytime" and stop.
${firstMessageBlock}
${skepticismBlock}
${stageBlock}

## Project knowledge (use selectively — one fact at a time, only when relevant)
${knowledge || '(No docs loaded.)'}

Reply with ONLY the SMS text. No quotes, labels, explanation, or formatting.`;
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

  // Role anchor — always injected last so the model never confuses itself with the lead.
  // Without this, if the last outbound message is weird, the model can predict the lead's
  // response and send that instead (character confusion / perspective bleed).
  messages.push({
    role: 'system',
    content:
      'CRITICAL: You are the AGENT sending the next SMS. You are NOT the lead. Do NOT write what the lead might say. Do NOT roleplay the lead\'s response. Write ONLY your own next reply as the agent. One short, natural SMS message.',
  });

  const response = await client.chat.completions.create({
    model: 'deepseek-chat',
    messages,
    max_tokens: 80,
    temperature: 0.85,
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

/**
 * When to send an image:
 *  - 'first'    → very first outbound message (introduce the project visually)
 *  - 'reply'    → NEVER — replying to a lead with a flyer feels automated
 *  - 'follow_up'→ only on follow-up #2+ (re-engagement), not on follow-up #1
 */
export function selectMedia(
  mediaAssets: AiMedia[],
  context: 'first' | 'reply' | 'follow_up',
  followUpCount?: number
): AiMedia | null {
  // Never attach image when replying to a lead's message
  if (context === 'reply') return null;

  // For follow-ups, only send image on the 2nd follow-up attempt and beyond
  if (context === 'follow_up' && (followUpCount ?? 0) < 2) return null;

  const eligible = mediaAssets.filter(
    (m) =>
      (m.send_with === 'any' || m.send_with === context) &&
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
    exchangeCount: convRow.exchange_count,
  });
  const aiText = await generateMessage(history, systemPrompt, isFollowUp);

  if (!aiText) return { sent: false, escalated: false };

  const mediaAsset = selectMedia(
    media,
    isFollowUp ? 'follow_up' : 'first',
    isFollowUp ? convRow.follow_up_count : undefined
  );
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
  const leadIsSkeptical = detectSkepticism(inboundBody);
  const systemPrompt = buildSystemPrompt(config, campaign, docs, {
    contactFirstName: contact.first_name || undefined,
    isFirstMessage: false,
    exchangeCount: convRow.exchange_count,
    leadIsSkeptical,
  });
  const aiText = await generateMessage(history, systemPrompt, false);

  if (!aiText) return { replied: false, escalated: false };

  const mediaAsset = selectMedia(media, 'reply');
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
