import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { listTwilioPhoneNumbers } from '@/lib/twilio';

export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const numbers = await listTwilioPhoneNumbers();
    const smsNumbers = numbers.filter((n) => n.smsCapable);
    return NextResponse.json({
      numbers: smsNumbers.length > 0 ? smsNumbers : numbers,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Twilio error';
    return NextResponse.json({ error: message, numbers: [] }, { status: 200 });
  }
}
