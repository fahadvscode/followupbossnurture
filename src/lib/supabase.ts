import { createClient, type SupabaseClient } from '@supabase/supabase-js';

function isUsableServiceKey(key: string | undefined): key is string {
  if (!key?.trim()) return false;
  const k = key.trim().toLowerCase();
  if (k.startsWith('your-') || k.includes('paste') || k === 'placeholder') return false;
  return true;
}

function requirePublicSupabase(): { url: string; anonKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set');
  }
  return { url, anonKey };
}

/** Uses service role when set; otherwise anon (fine for local dev if RLS allows anon on drip_*). */
export function getServiceClient(): SupabaseClient {
  const { url, anonKey } = requirePublicSupabase();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!isUsableServiceKey(serviceKey)) {
    return createClient(url, anonKey);
  }
  return createClient(url, serviceKey.trim());
}
