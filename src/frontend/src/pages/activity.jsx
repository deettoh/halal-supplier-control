import { History } from 'lucide-react';
import { ROLE_LABELS, useActivity } from '@/lib/api';
import { EmptyState, PageHead, errText, fmtTime } from '@/components/status';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
export default function Activity() {
  const { data, isLoading, error, refetch } = useActivity();
  const rows = [...(data ?? [])].sort((a, b) =>
    b.created_at.localeCompare(a.created_at),
  );
  return (
    <div>
      <PageHead
        kicker="Audit trail"
        title="Activity log"
        sub="Every check, decision and certificate renewal, newest first. This is what you show the auditor."
      />
      {error ? (
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-6 text-sm">
          {errText(error)}{' '}
          <Button
            size="sm"
            variant="outline"
            className="ml-2"
            onClick={() => refetch()}
          >
            Retry
          </Button>
        </div>
      ) : isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={History}
          title="No activity yet"
          body="Delivery checks and supervisor decisions will be recorded here."
        />
      ) : (
        <ol className="relative ml-2 border-l-2 border-border pl-6">
          {rows.map((a, i) => (
            <li
              key={a.id}
              data-testid={`row-activity-${a.id}`}
              className="rise relative pb-5"
              style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}
            >
              <span className="absolute -left-[31px] top-1.5 h-3 w-3 rounded-full border-2 border-background bg-primary" />
              <div className="flex flex-wrap items-baseline gap-x-3">
                <span className="font-semibold">{a.action}</span>
                <span className="font-mono text-xs text-muted-foreground">
                  {fmtTime(a.created_at)}
                </span>
              </div>
              <p className="text-sm">{a.detail}</p>
              <p className="text-xs text-muted-foreground">
                {a.actor} ·{' '}
                {a.role === 'system' ? 'System' : ROLE_LABELS[a.role]}
              </p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
