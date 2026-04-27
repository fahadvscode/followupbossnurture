import { NextRequest, NextResponse } from 'next/server';
import { clearAuth } from '@/lib/auth';

export async function POST(request: NextRequest) {
  await clearAuth();
  return NextResponse.redirect(new URL('/', request.url));
}
