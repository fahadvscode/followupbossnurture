'use client';

import { useEffect } from 'react';

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-[50vh] flex items-center justify-center p-8">
      <div className="max-w-md rounded-xl border border-border bg-card p-6 space-y-4 text-center">
        <h1 className="text-lg font-semibold text-foreground">Something went wrong</h1>
        <p className="text-sm text-muted leading-relaxed">
          Production builds hide error details. If this happened right after sign-in, confirm{' '}
          <strong>Supabase</strong> env vars on Vercel and check{' '}
          <strong className="text-foreground">Deployment → Logs</strong> for the real error.
        </p>
        {error.digest && (
          <p className="text-xs font-mono text-muted">
            Digest: <span className="text-foreground">{error.digest}</span>
          </p>
        )}
        <button
          type="button"
          onClick={() => reset()}
          className="w-full rounded-lg bg-accent py-2.5 text-sm font-medium text-white hover:bg-accent-hover"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
