import { NextRequest } from 'next/server';
import { loadInboxThreads } from '@/lib/inbox-threads';

// GET /api/inbox?filter=needs_action|escalated|human_takeover|active|all
export async function GET(request: NextRequest) {
  const filter = (request.nextUrl.searchParams.get('filter') || 'all') as
    | 'needs_action'
    | 'escalated'
    | 'human_takeover'
    | 'active'
    | 'all';

  try {
    const result = await loadInboxThreads(filter);
    return Response.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to load inbox';
    return Response.json({ error: message }, { status: 500 });
  }
}
