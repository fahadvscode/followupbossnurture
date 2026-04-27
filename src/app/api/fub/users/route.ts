import { NextResponse } from 'next/server';
import { listAllFubUsers } from '@/lib/fub';

export async function GET() {
  try {
    const users = await listAllFubUsers();
    return NextResponse.json({ users });
  } catch (error) {
    console.error('Failed to list FUB users:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load Follow Up Boss users' },
      { status: 500 }
    );
  }
}
