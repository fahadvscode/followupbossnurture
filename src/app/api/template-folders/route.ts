import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';

export async function GET() {
  const db = getServiceClient();
  const { data, error } = await db
    .from('drip_template_folders')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ folders: data || [] });
}

export async function POST(request: NextRequest) {
  const db = getServiceClient();
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const name = String((body as { name?: string }).name || '').trim();
  if (!name) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }
  const sort_order = Math.max(0, Number((body as { sort_order?: number }).sort_order) || 0);

  const { data, error } = await db
    .from('drip_template_folders')
    .insert({ name, sort_order })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}
