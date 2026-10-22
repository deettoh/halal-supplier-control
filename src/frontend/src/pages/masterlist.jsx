import { useMemo, useState } from 'react';
import { ClipboardList, Search } from 'lucide-react';
import { useMaterials } from '@/lib/api';
import {
  CoverageBadge,
  COVERAGE,
  EmptyState,
  PageHead,
  errText,
  fmtDate,
  toneBar,
} from '@/components/status';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
export default function Masterlist() {
  const { data, isLoading, error, refetch } = useMaterials();
  const [q, setQ] = useState('');
  const [f, setF] = useState('all');
  const counts = useMemo(() => {
    const c = { covered: 0, expiring: 0, not_covered: 0 };
    data?.forEach((m) => c[m.coverage]++);
    return c;
  }, [data]);
  const rows = (data ?? []).filter(
    (m) =>
      (f === 'all' || m.coverage === f) &&
      `${m.name} ${m.supplier_name} ${m.brand} ${m.manufacturer} ${m.certificate?.cert_no ?? ''}`
        .toLowerCase()
        .includes(q.toLowerCase()),
  );
  return (
    <div>
      <PageHead
        kicker="Raw Material Masterlist"
        title="What your documents cover"
        sub="Coverage is computed live from each supplier's current certificate in the shared registry."
      />
      <div
        className="rise mb-6 grid grid-cols-2 gap-3 md:grid-cols-4"
        style={{ animationDelay: '60ms' }}
      >
        <button
          data-testid="filter-all"
          onClick={() => setF('all')}
          className={cn(
            'rounded-xl border bg-card p-4 text-left transition',
            f === 'all' && 'ring-2 ring-primary',
          )}
        >
          <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Materials
          </p>
          <p className="font-display text-3xl font-extrabold">
            {isLoading ? '–' : (data?.length ?? 0)}
          </p>
        </button>
        {Object.keys(COVERAGE).map((k) => (
          <button
            key={k}
            data-testid={`filter-${k}`}
            onClick={() => setF(f === k ? 'all' : k)}
            className={cn(
              'relative overflow-hidden rounded-xl border bg-card p-4 text-left transition',
              f === k && 'ring-2 ring-primary',
            )}
          >
            <span
              className={cn(
                'absolute inset-y-0 left-0 w-1.5',
                toneBar[COVERAGE[k].tone],
              )}
            />
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              {COVERAGE[k].label}
            </p>
            <p
              className="font-display text-3xl font-extrabold"
              data-testid={`count-${k}`}
            >
              {isLoading ? '–' : counts[k]}
            </p>
          </button>
        ))}
      </div>
      <div className="relative mb-3 max-w-sm">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          data-testid="input-search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search material, supplier, brand, cert no"
          className="pl-9"
        />
      </div>
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
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Nothing matches"
          body="Try another search or clear the coverage filter."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b bg-secondary/60 text-left font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="p-3">Material</th>
                <th className="p-3">Supplier</th>
                <th className="p-3">Brand / Manufacturer</th>
                <th className="p-3">Certificate</th>
                <th className="p-3">Coverage</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m, i) => (
                <tr
                  key={m.id}
                  data-testid={`row-material-${m.id}`}
                  className="rise border-b last:border-0 hover:bg-secondary/30"
                  style={{ animationDelay: `${i * 25}ms` }}
                >
                  <td className="p-3 font-semibold">{m.name}</td>
                  <td className="p-3">{m.supplier_name}</td>
                  <td className="p-3">
                    <div>{m.brand}</div>
                    <div className="text-xs text-muted-foreground">
                      {m.manufacturer}
                    </div>
                  </td>
                  <td className="p-3">
                    {m.certificate ? (
                      <>
                        <div className="font-mono text-xs">
                          {m.certificate.cert_no}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {m.certificate.issuer}
                        </div>
                        <div className="text-xs">
                          Expires {fmtDate(m.certificate.expiry_date)}
                        </div>
                      </>
                    ) : (
                      <span className="text-xs italic text-muted-foreground">
                        No certificate on file
                      </span>
                    )}
                  </td>
                  <td className="p-3">
                    <CoverageBadge coverage={m.coverage} />
                    <p className="mt-1 max-w-[220px] text-xs text-muted-foreground">
                      {m.coverage_detail}
                    </p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
