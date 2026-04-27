import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { EnrollmentActions } from '@/components/campaigns/EnrollmentActions';
import { formatDate, formatPhone } from '@/lib/utils';
import type { DripContact, DripEnrollment } from '@/types';

interface EnrollmentTableProps {
  enrollments: (DripEnrollment & { contact: DripContact })[];
  totalSteps: number;
  /** step_number (last completed) → day label */
  stepDayLabels?: Record<number, string>;
}

export function EnrollmentTable({ enrollments, totalSteps, stepDayLabels }: EnrollmentTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border text-left">
            <th className="px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider">Contact</th>
            <th className="px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider">Phone</th>
            <th className="px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider">Progress</th>
            <th className="px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider">Status</th>
            <th className="px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider">Enrolled</th>
            <th className="px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider w-20">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {enrollments.map((e) => (
            <tr key={e.id} className="hover:bg-card-hover transition-colors">
              <td className="px-4 py-3">
                <Link href={`/contacts/${e.contact_id}`} className="text-sm font-medium text-foreground hover:text-accent">
                  {`${e.contact?.first_name || ''} ${e.contact?.last_name || ''}`.trim() || 'Unknown'}
                </Link>
              </td>
              <td className="px-4 py-3 text-sm text-muted">{formatPhone(e.contact?.phone)}</td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-background rounded-full overflow-hidden max-w-[100px]">
                    <div
                      className="h-full bg-accent rounded-full"
                      style={{ width: `${totalSteps > 0 ? (e.current_step / totalSteps * 100) : 0}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted whitespace-nowrap">
                    {e.current_step > 0 && stepDayLabels?.[e.current_step] && (
                      <>
                        <span className="text-foreground/90">{stepDayLabels[e.current_step]}</span>
                        <span className="mx-1">·</span>
                      </>
                    )}
                    {e.current_step}/{totalSteps} touches
                  </span>
                </div>
              </td>
              <td className="px-4 py-3">
                <Badge variant={
                  e.status === 'active' ? 'success' :
                  e.status === 'completed' ? 'info' :
                  e.status === 'paused' ? 'warning' : 'danger'
                }>
                  {e.status}
                </Badge>
              </td>
              <td className="px-4 py-3 text-sm text-muted">{formatDate(e.enrolled_at)}</td>
              <td className="px-4 py-3">
                <EnrollmentActions enrollmentId={e.id} status={e.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
