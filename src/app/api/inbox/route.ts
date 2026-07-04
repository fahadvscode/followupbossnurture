import { NextRequest } from 'next/server';
import { loadInboxThreads } from '@/lib/inbox-threads';

// GET /api/inbox?filter=all&contactId=optional
export async function GET(request: NextRequest) {
  const filter = (request.nextUrl.searchParams.get('filter') || 'unread') as
    | 'unread'
    | 'needs_action'
    | 'escalated'
    | 'human_takeover'
    | 'active'
    | 'all';

  const focusContactId = request.nextUrl.searchParams.get('contactId');
  const search = request.nextUrl.searchParams.get('search');

  try {
    const result = await loadInboxThreads(filter, focusContactId, search);
    return Response.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to load inbox';
    return Response.json({ error: message }, { status: 500 });
  }
}
