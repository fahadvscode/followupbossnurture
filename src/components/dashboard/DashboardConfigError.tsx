import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type Props = {
  /** Shown in production only if safe (no secrets). */
  hint?: string;
};

export function DashboardConfigError({ hint }: Props) {
  return (
    <div className="max-w-xl">
      <Card className="border-warning/40 bg-warning/[0.06]">
        <CardHeader>
          <CardTitle className="text-lg">Dashboard couldn&apos;t load</CardTitle>
          <p className="text-sm text-muted leading-relaxed">
            Sign-in worked, but loading data from Supabase failed. This usually means environment variables are missing
            on Vercel or the database schema doesn&apos;t match this deployment (for example{' '}
            <code className="text-[11px]">channel</code> / <code className="text-[11px]">error_detail</code> on{' '}
            <code className="text-[11px]">drip_messages</code>).
          </p>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-foreground">
          <p className="font-medium">Check in Vercel → Settings → Environment Variables (Production):</p>
          <ul className="list-disc pl-5 space-y-1 text-muted">
            <li>
              <code className="text-[11px] text-foreground">NEXT_PUBLIC_SUPABASE_URL</code>
            </li>
            <li>
              <code className="text-[11px] text-foreground">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>
            </li>
            <li>
              <code className="text-[11px] text-foreground">SUPABASE_SERVICE_ROLE_KEY</code>
            </li>
          </ul>
          <p className="text-muted">
            After changing variables, redeploy. In Vercel → Deployment → <strong>Logs</strong>, look for the real error
            next to a failed request to <code className="text-[11px]">/</code>.
          </p>
          {hint && (
            <p className="text-xs text-danger/90 font-mono whitespace-pre-wrap break-all border border-border rounded-md p-2 bg-background">
              {hint}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
