import { NextRequest, NextResponse } from 'next/server';
import { verifyPassword, setAuthCookie } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const { password } = await request.json();

  const valid = await verifyPassword(password);
  if (!valid) {
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
  }

  await setAuthCookie();
  return NextResponse.json({ ok: true });
}
