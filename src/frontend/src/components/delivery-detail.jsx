import { ImageOff } from 'lucide-react';
import {
  Checklist,
  Extracted,
  StatusBadge,
  VerdictBadge,
  fmtTime,
} from '@/components/status';
export function DeliveryDetail({ d }) {
  return (
    <div className="space-y-4" data-testid={`detail-delivery-${d.id}`}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="stamp" key={d.id}>
          <VerdictBadge verdict={d.verdict} size="lg" />
        </div>
        <StatusBadge status={d.status} />
      </div>
      <div>
        <h3 className="font-display text-xl font-bold">{d.material_name}</h3>
        <p className="text-xs text-muted-foreground">
          {d.supplier_name} · checked by {d.created_by} ·{' '}
          {fmtTime(d.created_at)}
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-[180px_1fr]">
        {d.image_url ? (
          <img
            src={d.image_url}
            alt="Label photo"
            className="aspect-square w-full rounded-lg border object-cover"
          />
        ) : (
          <div className="flex aspect-square w-full items-center justify-center rounded-lg border bg-secondary text-muted-foreground">
            <ImageOff className="h-6 w-6" />
          </div>
        )}
        <div className="space-y-2">
          <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Extracted from label
          </p>
          <Extracted ex={d.extracted} error={d.error} />
          {d.error && d.extracted && (
            <p className="text-xs text-[hsl(var(--bad))]">{d.error}</p>
          )}
        </div>
      </div>
      <div className="space-y-2">
        <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Rule checklist
        </p>
        <Checklist results={d.rule_results} />
      </div>
      {d.decision && (
        <div className="rounded-lg border-l-4 border-primary bg-secondary/60 p-3 text-sm">
          <p className="font-semibold">
            {d.decision.decision === 'accept' ? 'Accepted' : 'Rejected'} by{' '}
            {d.decision.actor}
          </p>
          <p>“{d.decision.reason}”</p>
          <p className="text-xs text-muted-foreground">
            {fmtTime(d.decision.decided_at)}
          </p>
        </div>
      )}
    </div>
  );
}
