import { clsx, type ClassValue } from 'clsx';

/** All user-facing dates/times use this IANA zone (Eastern — Toronto). */
export const APP_TIMEZONE = 'America/Toronto';

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatPhone(phone: string | null): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return phone;
}

export function normalizePhone(phone: string | null): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return '+1' + digits;
  if (digits.length === 11 && digits.startsWith('1')) return '+' + digits;
  if (digits.startsWith('+')) return phone;
  return '+' + digits;
}

export function formatDate(date: string | null): string {
  if (!date) return '';
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: APP_TIMEZONE,
  });
}

export function formatDateTime(date: string | null): string {
  if (!date) return '';
  return new Date(date).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: APP_TIMEZONE,
    timeZoneName: 'short',
  });
}

/**
 * YYYY-MM-DD for an instant in {@link APP_TIMEZONE} (for grouping / charts).
 */
export function dateKeyInAppTimezone(isoOrTimestamp: string): string {
  return new Date(isoOrTimestamp).toLocaleDateString('en-CA', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

/**
 * UTC ISO string for the first moment of the calendar day of `ref` in {@link APP_TIMEZONE}.
 */
export function startOfAppDayUtcIso(ref: Date = new Date()): string {
  const ymd = ref.toLocaleDateString('en-CA', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const [Y, M, D] = ymd.split('-').map((n) => parseInt(n, 10));
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  });
  const matchesDay = (t: Date) => {
    const p = dtf.formatToParts(t);
    const get = (type: Intl.DateTimeFormatPartTypes) =>
      parseInt(p.find((x) => x.type === type)?.value || '0', 10);
    return get('year') === Y && get('month') === M && get('day') === D;
  };
  const lo = Date.UTC(Y, M - 1, D - 1, 4, 0, 0);
  const hi = Date.UTC(Y, M - 1, D + 1, 8, 0, 0);
  for (let ms = lo; ms <= hi; ms += 60 * 1000) {
    const t = new Date(ms);
    if (matchesDay(t)) return t.toISOString();
  }
  return new Date(Date.UTC(Y, M - 1, D, 5, 0, 0)).toISOString();
}

export function timeAgo(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(date);
}

export function percentage(part: number, total: number): string {
  if (total === 0) return '0%';
  return (part / total * 100).toFixed(1) + '%';
}

/** ISA-style label from enrollment offset: Day 1, Day 1, 5m, Day 2, Day 14+, etc. */
export function formatDripStepDayLabel(step: {
  delay_days: number;
  delay_hours?: number | null;
  delay_minutes?: number | null;
}): string {
  const days = Number(step.delay_days) || 0;
  const hours = Number(step.delay_hours) || 0;
  const mins = Number(step.delay_minutes) || 0;
  const dayNum = days + 1;

  if (days === 13 && hours === 0 && mins === 0) return 'Day 14+';

  if (days === 0 && hours === 0 && mins === 0) return 'Day 1, 0m';

  const timeParts: string[] = [];
  if (hours > 0) timeParts.push(`${hours}h`);
  if (mins > 0) timeParts.push(`${mins}m`);
  if (timeParts.length === 0) return `Day ${dayNum}`;
  return `Day ${dayNum}, ${timeParts.join(' ')}`;
}

export type StepForDayLabel = {
  step_number: number;
  delay_days: number;
  delay_hours?: number | null;
  delay_minutes?: number | null;
};

/** Map step_number → Day 1, 0m … for timeline / replies / enrollment UI */
export function buildStepDayLabelMap(steps: StepForDayLabel[]): Record<number, string> {
  const m: Record<number, string> = {};
  for (const s of steps) {
    m[s.step_number] = formatDripStepDayLabel(s);
  }
  return m;
}
