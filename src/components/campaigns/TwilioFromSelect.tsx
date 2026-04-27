'use client';

import { useEffect, useRef, useState } from 'react';
import { Select } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';

interface Listed {
  sid: string;
  phoneNumber: string;
  friendlyName: string | null;
  smsCapable: boolean;
}

interface TwilioFromSelectProps {
  value: string;
  onChange: (e164: string) => void;
  disabled?: boolean;
}

export function TwilioFromSelect({ value, onChange, disabled }: TwilioFromSelectProps) {
  const [numbers, setNumbers] = useState<Listed[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const valueRef = useRef(value);
  const autoPicked = useRef(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  valueRef.current = value;

  useEffect(() => {
    fetch('/api/twilio/numbers')
      .then((r) => r.json())
      .then((data) => {
        if (data.error && !data.numbers?.length) setError(data.error);
        const list: Listed[] = data.numbers || [];
        setNumbers(list);
        if (
          list.length > 0 &&
          !autoPicked.current &&
          !valueRef.current?.trim()
        ) {
          autoPicked.current = true;
          onChangeRef.current(list[0].phoneNumber);
        }
      })
      .catch(() => setError('Could not load Twilio numbers'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted py-2">
        <Loader2 size={16} className="animate-spin" />
        Loading Twilio numbers…
      </div>
    );
  }

  if (error && numbers.length === 0) {
    return <p className="text-sm text-warning">{error}</p>;
  }

  if (numbers.length === 0) {
    return (
      <p className="text-sm text-muted">
        No numbers found. Check TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN, or buy a number in Twilio.
      </p>
    );
  }

  const known = numbers.some((n) => n.phoneNumber === value);
  const selectValue = known ? value : value?.trim() ? value : numbers[0]?.phoneNumber ?? '';

  return (
    <div>
      <Select
        value={selectValue}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full"
      >
        {value?.trim() && !known && (
          <option value={value}>{value} (saved; not in current Twilio list)</option>
        )}
        {numbers.map((n) => (
          <option key={n.sid} value={n.phoneNumber}>
            {n.phoneNumber}
            {n.friendlyName ? ` — ${n.friendlyName}` : ''}
            {!n.smsCapable ? ' (SMS unclear)' : ''}
          </option>
        ))}
      </Select>
      <p className="text-xs text-muted mt-1">
        Numbers from your Twilio account. Each campaign sends from the number you choose.
      </p>
    </div>
  );
}
