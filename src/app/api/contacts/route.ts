import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const db = getServiceClient();
  const searchParams = request.nextUrl.searchParams;

  let query = db.from('drip_contacts').select('*', { count: 'exact' });

  const search = searchParams.get('search');
  if (search) {
    query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`);
  }

  const source = searchParams.get('source');
  if (source) {
    query = query.eq('source_category', source);
  }

  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = parseInt(searchParams.get('offset') || '0');

  query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

  const { data, count, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ contacts: data, total: count });
}
