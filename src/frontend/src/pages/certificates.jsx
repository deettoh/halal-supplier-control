import { useEffect, useRef, useState } from 'react';
import {
  FileBadge,
  Loader2,
  Plus,
  RefreshCw,
  Sparkles,
  X,
  Network,
} from 'lucide-react';
import {
  RECOGNISED_ISSUERS,
  useCertificates,
  useCreateCertificate,
} from '@/lib/api';
import { EmptyState, PageHead, errText, fmtDate } from '@/components/status';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
const daysTo = (d) =>
  Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
function CertCard({ c }) {
  const days = daysTo(c.expiry_date);
  const active = c.status === 'active';
  const tone = !active
    ? 'text-muted-foreground'
    : days < 0
      ? 'text-[hsl(var(--bad))]'
      : days <= 60
        ? 'text-[hsl(36_90%_30%)]'
        : 'text-[hsl(var(--ok))]';
  return (
    <div
      data-testid={`card-cert-${c.id}`}
      className={cn(
        'rise relative overflow-hidden rounded-xl border bg-card p-4',
        !active && 'opacity-60',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-mono text-sm font-semibold">{c.cert_no}</p>
          <p className="text-xs text-muted-foreground">{c.issuer}</p>
        </div>
        <span
          className={cn(
            'rounded-md px-2 py-0.5 font-mono text-[10px] uppercase',
            active ? 'bg-primary text-primary-foreground' : 'bg-muted',
          )}
        >
          {c.status}
        </span>
      </div>
      <p className="mt-2 text-sm">{c.holder_name}</p>
      <p className={cn('text-sm font-semibold', tone)}>
        Expires {fmtDate(c.expiry_date)}
        {active &&
          ` · ${days < 0 ? `expired ${-days} days ago` : `${days} days left`}`}
      </p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {c.scope.map((s) => (
          <span
            key={s}
            className="rounded-full bg-secondary px-2 py-0.5 text-xs"
          >
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}
export default function Certificates() {
  const { data, isLoading, error, refetch } = useCertificates();
  const create = useCreateCertificate();
  const { toast } = useToast();
  const active = data?.find((c) => c.status === 'active');
  const [issuer, setIssuer] = useState(RECOGNISED_ISSUERS[0]);
  const [certNo, setCertNo] = useState('');
  const [holder, setHolder] = useState('');
  const [expiry, setExpiry] = useState('');
  const [scope, setScope] = useState([]);
  const [chip, setChip] = useState('');
  const [image, setImage] = useState(null);
  const [done, setDone] = useState(null);
  const initFor = useRef(null);
  useEffect(() => {
    if (active && initFor.current !== active.id) {
      initFor.current = active.id;
      setIssuer(active.issuer);
      setCertNo(active.cert_no);
      setHolder(active.holder_name);
      setExpiry(active.expiry_date);
      setScope(active.scope);
    }
  }, [active]);
  const addChips = (raw) => {
    const vals = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (vals.length) setScope((s) => Array.from(new Set([...s, ...vals])));
    setChip('');
  };
  const valid = issuer && certNo && holder && expiry && scope.length > 0;
  const submit = (e) => {
    e.preventDefault();
    if (!valid) return;
    create.mutate(
      {
        issuer,
        cert_no: certNo,
        holder_name: holder,
        expiry_date: expiry,
        scope,
        image,
      },
      {
        onSuccess: (c) => {
          setDone(c);
          toast({
            title: 'Certificate renewed in shared registry',
            description: 'Every SME buying from you now sees the new coverage.',
          });
        },
        onError: (err) =>
          toast({
            variant: 'destructive',
            title: 'Renewal failed',
            description: errText(err),
          }),
      },
    );
  };
  const sorted = [...(data ?? [])].sort((a, b) =>
    a.status === b.status
      ? b.expiry_date.localeCompare(a.expiry_date)
      : a.status === 'active'
        ? -1
        : 1,
  );
  return (
    <div>
      <PageHead
        kicker="Shared certificate registry"
        title="Your halal certificates"
        sub="Renew once here. Every SME that lists you on their masterlist is covered immediately."
      />
      {done && (
        <div
          className="stamp mb-6 flex gap-3 rounded-xl border-2 border-[hsl(var(--ok)/0.5)] bg-[hsl(var(--ok)/0.08)] p-4"
          style={{ transform: 'none' }}
          data-testid="status-renewed"
        >
          <Network className="h-6 w-6 shrink-0 text-[hsl(var(--ok))]" />
          <div className="text-sm">
            <p className="font-semibold">
              {done.cert_no} is now active, valid to {fmtDate(done.expiry_date)}
              .
            </p>
            <p>
              Every SME linked to your company now sees coverage computed from
              this certificate. Their masterlists and next delivery checks use
              it automatically; no re-upload needed on their side.
            </p>
          </div>
          <button
            className="ml-auto self-start"
            onClick={() => setDone(null)}
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-[1fr_440px]">
        <div className="space-y-3">
          {error ? (
            <div className="rounded-xl border border-destructive/40 p-4 text-sm">
              {errText(error)}{' '}
              <Button size="sm" variant="outline" onClick={() => refetch()}>
                Retry
              </Button>
            </div>
          ) : isLoading ? (
            [0, 1].map((i) => <Skeleton key={i} className="h-36" />)
          ) : !sorted.length ? (
            <EmptyState
              icon={FileBadge}
              title="No certificates yet"
              body="Add your first certificate with the form."
            />
          ) : (
            sorted.map((c) => <CertCard key={c.id} c={c} />)
          )}
        </div>
        <form
          onSubmit={submit}
          className="rise space-y-4 self-start rounded-2xl border bg-card p-5 shadow-sm lg:sticky lg:top-32"
        >
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl font-bold">
              Renew certificate
            </h2>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled
              title="Coming soon"
            >
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              Pre-fill from image · soon
            </Button>
          </div>
          {active && (
            <p className="text-xs text-muted-foreground">
              Pre-filled from {active.cert_no}. Update what changed.
            </p>
          )}
          <div className="space-y-1.5">
            <Label>Issuer</Label>
            <Input
              data-testid="input-issuer"
              value={issuer}
              onChange={(e) => setIssuer(e.target.value)}
              list="issuers"
            />
            <datalist id="issuers">
              {RECOGNISED_ISSUERS.map((i) => (
                <option key={i} value={i} />
              ))}
            </datalist>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Certificate no.</Label>
              <Input
                data-testid="input-cert-no"
                value={certNo}
                onChange={(e) => setCertNo(e.target.value)}
                className="font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Expiry date</Label>
              <Input
                data-testid="input-expiry"
                type="date"
                value={expiry}
                onChange={(e) => setExpiry(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Holder name</Label>
            <Input
              data-testid="input-holder"
              value={holder}
              onChange={(e) => setHolder(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Scope (products covered)</Label>
            <div className="flex min-h-11 flex-wrap gap-1.5 rounded-md border bg-background p-2">
              {scope.map((s) => (
                <span
                  key={s}
                  className="flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground"
                >
                  {s}
                  <button
                    type="button"
                    aria-label={`Remove ${s}`}
                    data-testid={`button-remove-scope-${s}`}
                    onClick={() => setScope(scope.filter((x) => x !== s))}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <input
                data-testid="input-scope"
                value={chip}
                onChange={(e) => setChip(e.target.value)}
                placeholder="type, press Enter or comma"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ',') {
                    e.preventDefault();
                    addChips(chip);
                  } else if (e.key === 'Backspace' && !chip)
                    setScope(scope.slice(0, -1));
                }}
                onBlur={() => chip && addChips(chip)}
                className="min-w-[120px] flex-1 bg-transparent text-sm outline-none"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Certificate image (optional)</Label>
            <Input
              data-testid="input-cert-image"
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => setImage(e.target.files?.[0] ?? null)}
            />
          </div>
          <Button
            data-testid="button-renew"
            type="submit"
            disabled={!valid || create.isPending}
            className="h-11 w-full"
          >
            {create.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : active ? (
              <RefreshCw className="mr-2 h-4 w-4" />
            ) : (
              <Plus className="mr-2 h-4 w-4" />
            )}
            {active ? 'Publish renewal to registry' : 'Publish certificate'}
          </Button>
        </form>
      </div>
    </div>
  );
}
