# Drip Engine — FUB Multi-Channel Campaign Platform

A standalone multi-channel drip campaign platform that connects to Follow Up Boss (FUB) via API. Runs automated drip sequences via SMS (Twilio), email (FUB marketing timeline + SMTP), FUB action plans (email from connected inbox), and FUB tasks. Every touchpoint is logged to the lead's FUB timeline.

## Tech Stack

- **Next.js 16** (App Router) + TypeScript + Tailwind CSS
- **Supabase** (PostgreSQL database)
- **Twilio** (SMS sending/receiving)
- **Follow Up Boss API** (CRM sync)
- **Recharts** (data visualizations)
- **Vercel** (deployment + cron jobs)

## Getting Started

### 1. Set up the database

Run the SQL migration in your Supabase SQL Editor:

```
supabase/migration.sql
```

If the project already existed, also run any `supabase/migration_add_*.sql` files you have not applied yet:

- `migration_add_fub_task_steps.sql` — task columns
- `migration_add_email_steps.sql` — email columns + step_type constraint
- `migration_add_fub_action_plan_steps.sql` — action plan column + updated constraint
- `migration_ai_nurture.sql` — AI nurture engine tables (campaign config, knowledge docs, media, conversations)

**Shortcut for older DBs:** if the seed fails with missing columns on `drip_campaign_steps`, run `migration_drip_steps_catchup.sql` once (adds email, task, action-plan columns and the final `step_type` check).

This creates all `drip_*` tables (won't touch your existing tables).

**Optional:** load a paused 7-day multi-channel template campaign:

```
supabase/seed_7day_sms_email_campaign.sql
```

### 2. Configure environment variables

Copy `.env.local` and fill in missing values:

- `SUPABASE_SERVICE_ROLE_KEY` — from Supabase dashboard > Settings > API
- `TWILIO_AUTH_TOKEN` — from Twilio console
- `TWILIO_PHONE_NUMBER` — your Twilio number (e.g., +12125551234)
- `ADMIN_PASSWORD` — choose your login password
- `CRON_SECRET` — any random string for cron auth
- **Email drip steps (Follow Up Boss):** the app uses FUB's **email marketing API** (`/emCampaigns` + `/emEvents`) so each send appears on the person's timeline. Set **`FUB_EMAIL_USER_ID`** (numeric FUB user id) so the send is attributed to the same agent as in FUB (optional; falls back to `FUB_DEFAULT_TASK_ASSIGNED_USER_ID`). FUB's API does **not** send through the Gmail/Outlook OAuth connection by itself.
- **Inbox delivery (optional SMTP):** to actually deliver to the lead's mailbox from the same address you use in FUB, add SMTP for that mailbox — e.g. **`SMTP_HOST`**, **`SMTP_PORT`** (587 or 465), **`SMTP_USER`**, **`SMTP_PASS`** (Google: [app password](https://support.google.com/accounts/answer/185833)), and **`EMAIL_FROM`** (must match that mailbox, e.g. `Jane Agent <jane@yourbroker.com>`).
- **FUB Action Plans:** for email steps that send directly from the agent's connected FUB inbox (Gmail/Outlook), create the email sequence as an FUB Action Plan, then use the "FUB Action Plan" step type and pick the plan. No SMTP needed — replies go straight to FUB.
- **AI Nurture (optional):** set **`DEEPSEEK_API_KEY`** from [platform.deepseek.com](https://platform.deepseek.com). This powers the AI Nurture campaign type — conversational SMS via DeepSeek. Without it, AI campaigns won't send but the rest of the app is unaffected.

### 3. Run locally

```bash
cd followup-boss-drip-platform
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and log in with your admin password.

### 4. Deploy to Vercel

Push to GitHub and connect to Vercel. Add all env vars in Vercel dashboard. The cron job (every minute, UTC) is configured in `vercel.json`. **Vercel Hobby** only allows cron **once per day**; for schedules more frequent than daily you need **Vercel Pro** (or another scheduler hitting `/api/cron/send-drips`).

### 5. Set up webhooks

After deploying, configure:

- **Follow Up Boss webhook**: Go to FUB Settings > Webhooks, point `peopleCreated` and `peopleUpdated` to `https://your-domain.vercel.app/api/webhooks/fub`
- **Twilio SMS webhook**: In your Twilio phone number config, set the incoming message webhook to `https://your-domain.vercel.app/api/webhooks/twilio/inbound`

## Features

- **Contact Sync**: Pull all FUB contacts with full persona (tags, custom fields, notes, events, snapshot)
- **Drip Campaigns**: Multi-step sequences with 4 channel types:
  - **SMS** (Twilio) — outbound texts + replies pushed to FUB timeline
  - **Email** (FUB marketing timeline + optional SMTP inbox delivery)
  - **FUB Action Plan** — triggers a pre-built action plan; email sends from connected inbox, replies land in FUB
  - **FUB Task** — creates tasks with assignee, due time, reminders; logged to FUB timeline
- **Auto-enrollment**: Contacts auto-enroll based on tags or source category
- **Reply Tracking**: Replies matched to campaigns, auto-pause drips, pushed to FUB timeline
- **Opt-out Handling**: STOP/UNSUBSCRIBE detection, opt-out events pushed to FUB
- **FUB Two-way Timeline Sync**: Every outbound SMS, email, task, and action plan trigger is logged to the lead's FUB timeline. Inbound replies and opt-outs are also pushed.
- **Lead Intelligence**: Source breakdown, engagement rates, conversion funnel
- **Campaign Analytics**: Per-step performance, reply rates, daily trends
- **AI Nurture Engine**: Conversational AI-powered SMS campaigns using DeepSeek:
  - Upload project knowledge (docs, pricing, location) — AI uses it for natural texting
  - 3 campaign goals: book a call, long-term nurture, drive to website
  - MMS support: attach banners/flyers as images alongside AI-generated text
  - Auto-reply with sentiment detection: pauses and escalates if lead is angry or asks for a human
  - Configurable follow-up cadence and max exchanges before escalation
  - Conversation thread view with full message history

### 6. AI Nurture — Supabase Storage (optional, for file uploads)

If you want to upload PDF/DOCX knowledge docs or MMS banners via file upload instead of pasting URLs:

1. In Supabase Dashboard → Storage, create two buckets:
   - `ai-nurture-docs` (private) — for knowledge documents
   - `ai-nurture-media` (public) — for MMS images (Twilio needs a public URL)
2. The current version accepts pasted text and direct URLs; file upload with Supabase Storage is ready to wire up when needed.
