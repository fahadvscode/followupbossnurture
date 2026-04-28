import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';
import { sendAiNurtureFirstTouchAfterEnroll } from '@/lib/drip-engine';

export async function POST(request: NextRequest) {
  const db = getServiceClient();
  const body = await request.json();
  const { contact_id, campaign_id, action, enrollment_id } = body;

  if (action === 'pause_enrollment' && enrollment_id) {
    await db
      .from('drip_enrollments')
      .update({ status: 'paused', paused_at: new Date().toISOString() })
      .eq('id', enrollment_id)
      .eq('status', 'active');
    return NextResponse.json({ ok: true });
  }

  if (action === 'resume_enrollment' && enrollment_id) {
    await db
      .from('drip_enrollments')
      .update({ status: 'active', paused_at: null })
      .eq('id', enrollment_id)
      .eq('status', 'paused');
    return NextResponse.json({ ok: true });
  }

  if (action === 'restart_enrollment' && enrollment_id) {
    const { data: en, error: fetchErr } = await db
      .from('drip_enrollments')
      .select('id, status, contact_id, campaign_id, campaign:drip_campaigns(campaign_type)')
      .eq('id', enrollment_id)
      .single();

    if (fetchErr || !en) {
      return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 });
    }
    if (en.status === 'opted_out') {
      return NextResponse.json(
        { error: 'Cannot restart an opted-out enrollment. Clear opt-out first if appropriate.' },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const { error } = await db
      .from('drip_enrollments')
      .update({
        status: 'active',
        current_step: 0,
        paused_at: null,
        completed_at: null,
        enrolled_at: now,
      })
      .eq('id', enrollment_id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const campRow = en.campaign as { campaign_type?: string } | null;
    if (campRow?.campaign_type === 'ai_nurture') {
      void sendAiNurtureFirstTouchAfterEnroll({
        enrollmentId: enrollment_id,
        contactId: en.contact_id,
        campaignId: en.campaign_id,
      });
    }

    return NextResponse.json({ ok: true });
  }

  if (action === 'enroll') {
    const { data: existing } = await db
      .from('drip_enrollments')
      .select('id')
      .eq('contact_id', contact_id)
      .eq('campaign_id', campaign_id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: 'Already enrolled' }, { status: 400 });
    }

    const { data, error } = await db
      .from('drip_enrollments')
      .insert({
        contact_id,
        campaign_id,
        status: 'active',
        current_step: 0,
        enrolled_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    void sendAiNurtureFirstTouchAfterEnroll({
      enrollmentId: data.id,
      contactId: contact_id,
      campaignId: campaign_id,
    });

    return NextResponse.json(data);
  }

  if (action === 'pause') {
    await db
      .from('drip_enrollments')
      .update({ status: 'paused', paused_at: new Date().toISOString() })
      .eq('contact_id', contact_id)
      .eq('campaign_id', campaign_id)
      .eq('status', 'active');

    return NextResponse.json({ ok: true });
  }

  if (action === 'resume') {
    await db
      .from('drip_enrollments')
      .update({ status: 'active', paused_at: null })
      .eq('contact_id', contact_id)
      .eq('campaign_id', campaign_id)
      .eq('status', 'paused');

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
