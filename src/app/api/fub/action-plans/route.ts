import { NextResponse } from 'next/server';
import { listActionPlans } from '@/lib/fub';

export async function GET() {
  try {
    const all: { id: number; name: string; status: string }[] = [];
    let offset = 0;
    for (let guard = 0; guard < 20; guard++) {
      const data = await listActionPlans({ limit: 100, offset });
      all.push(...(data.actionPlans || []));
      if (all.length >= (data._metadata?.total ?? 0) || (data.actionPlans || []).length < 100) break;
      offset += 100;
    }
    return NextResponse.json({ actionPlans: all });
  } catch (error) {
    console.error('Failed to list FUB action plans:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed' },
      { status: 500 }
    );
  }
}
