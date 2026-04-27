'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Pause, Play, RotateCcw } from 'lucide-react';
import { useState } from 'react';

interface EnrollmentActionsProps {
  enrollmentId: string;
  status: string;
  /** Show “Pause” / “Resume” text (e.g. on contact page). */
  showLabels?: boolean;
}

export function EnrollmentActions({ enrollmentId, status, showLabels }: EnrollmentActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function run(action: 'pause_enrollment' | 'resume_enrollment') {
    setLoading(true);
    try {
      const res = await fetch('/api/enrollments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, enrollment_id: enrollmentId }),
      });
      if (res.ok) router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function restart() {
    if (
      !window.confirm(
        'Restart this drip from step 1? Progress resets to the beginning, status becomes active, and step delays count from now. Past messages stay in the timeline.'
      )
    ) {
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/enrollments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'restart_enrollment', enrollment_id: enrollmentId }),
      });
      if (res.ok) router.refresh();
    } finally {
      setLoading(false);
    }
  }

  if (status === 'opted_out') {
    return <span className="text-xs text-muted">—</span>;
  }

  const btnVariant = showLabels ? 'secondary' : 'ghost';

  return (
    <div className="flex flex-wrap gap-1 shrink-0 justify-end">
      {status === 'active' && (
        <Button variant={btnVariant} size="sm" disabled={loading} onClick={() => void run('pause_enrollment')}>
          <Pause size={14} className={showLabels ? 'mr-1.5' : ''} />
          {showLabels ? 'Pause drip' : null}
        </Button>
      )}
      {status === 'paused' && (
        <Button variant={btnVariant} size="sm" disabled={loading} onClick={() => void run('resume_enrollment')}>
          <Play size={14} className={showLabels ? 'mr-1.5' : ''} />
          {showLabels ? 'Resume drip' : null}
        </Button>
      )}
      <Button
        variant={btnVariant}
        size="sm"
        disabled={loading}
        title={showLabels ? undefined : 'Restart from step 1'}
        onClick={() => void restart()}
      >
        <RotateCcw size={14} className={showLabels ? 'mr-1.5' : ''} />
        {showLabels ? 'Restart drip' : null}
      </Button>
    </div>
  );
}
