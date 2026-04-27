'use client';

import { useMemo, useState } from 'react';
import { Select } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import type { FubUserOption } from '@/types';

type Props = {
  users: FubUserOption[];
  loading: boolean;
  error: string | null;
  value: number | '';
  onChange: (next: number | '') => void;
  disabled?: boolean;
};

function userLabel(u: FubUserOption): string {
  const bits = [u.name, u.email ? `<${u.email}>` : '', u.role ? `· ${u.role}` : ''].filter(Boolean);
  const suffix = u.status && u.status !== 'Active' ? ` (${u.status})` : '';
  return `${bits.join(' ')} — #${u.id}${suffix}`;
}

export function FubUserPicker({ users, loading, error, value, onChange, disabled }: Props) {
  const [manualMode, setManualMode] = useState(false);

  const { active, other } = useMemo(() => {
    const a: FubUserOption[] = [];
    const o: FubUserOption[] = [];
    for (const u of users) {
      if ((u.status || '').toLowerCase() === 'active') a.push(u);
      else o.push(u);
    }
    return { active: a, other: o };
  }, [users]);

  if (loading) {
    return <p className="text-sm text-muted animate-pulse py-2">Loading Follow Up Boss users…</p>;
  }

  if (error && users.length === 0) {
    return (
      <div className="space-y-2">
        <p className="text-xs text-danger">{error}</p>
        <Input
          type="number"
          min={1}
          placeholder="FUB user ID (numeric)"
          value={value === '' ? '' : value}
          onChange={(e) => {
            const v = e.target.value;
            onChange(v === '' ? '' : parseInt(v, 10) || '');
          }}
          disabled={disabled}
        />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {!manualMode ? (
        <Select
          value={value === '' ? '' : String(value)}
          onChange={(e) => {
            const v = e.target.value;
            onChange(v === '' ? '' : parseInt(v, 10) || '');
          }}
          disabled={disabled}
        >
          <option value="">— Default (env or contact) —</option>
          {active.map((u) => (
            <option key={u.id} value={u.id}>
              {userLabel(u)}
            </option>
          ))}
          {other.length > 0 && (
            <optgroup label="Other statuses">
              {other.map((u) => (
                <option key={u.id} value={u.id}>
                  {userLabel(u)}
                </option>
              ))}
            </optgroup>
          )}
        </Select>
      ) : (
        <Input
          type="number"
          min={1}
          placeholder="FUB user ID"
          value={value === '' ? '' : value}
          onChange={(e) => {
            const v = e.target.value;
            onChange(v === '' ? '' : parseInt(v, 10) || '');
          }}
          disabled={disabled}
        />
      )}
      <button
        type="button"
        className="text-xs text-accent hover:underline"
        onClick={() => setManualMode((m) => !m)}
      >
        {manualMode ? 'Pick from team list' : 'Enter user ID manually'}
      </button>
      {error && users.length > 0 && <p className="text-xs text-warning">{error}</p>}
    </div>
  );
}
