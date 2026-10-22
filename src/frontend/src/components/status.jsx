import {
  Check,
  X,
  AlertTriangle,
  ShieldCheck,
  ShieldX,
  ShieldAlert,
  Shuffle,
  UserRound,
} from 'lucide-react';
import { ApiError } from '@/lib/api';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
const toneCls = {
  ok: 'bg-[hsl(var(--ok)/0.12)] text-[hsl(var(--ok))] border-[hsl(var(--ok)/0.35)]',
  warn: 'bg-[hsl(var(--warn)/0.14)] text-[hsl(36_90%_30%)] border-[hsl(var(--warn)/0.45)]',
  bad: 'bg-[hsl(var(--bad)/0.1)] text-[hsl(var(--bad))] border-[hsl(var(--bad)/0.4)]',
  sub: 'bg-[hsl(var(--sub)/0.1)] text-[hsl(var(--sub))] border-[hsl(var(--sub)/0.35)]',
  human:
    'bg-[hsl(var(--human)/0.1)] text-[hsl(var(--human))] border-[hsl(var(--human)/0.35)]',
  neutral: 'bg-muted text-muted-foreground border-border',
};
export const toneBar = {
  ok: 'bg-[hsl(var(--ok))]',
  warn: 'bg-[hsl(var(--warn))]',
  bad: 'bg-[hsl(var(--bad))]',
  sub: 'bg-[hsl(var(--sub))]',
  human: 'bg-[hsl(var(--human))]',
  neutral: 'bg-muted-foreground',
};
export const VERDICT = {
  covered: {
    label: 'Covered',
    tone: 'ok',
    icon: ShieldCheck,
    hint: 'Documents on file cover this delivery.',
  },
  expiring: {
    label: 'Expiring',
    tone: 'warn',
    icon: ShieldAlert,
    hint: 'Covered, but the certificate expires within 60 days.',
  },
  not_covered: {
    label: 'Not covered',
    tone: 'bad',
    icon: ShieldX,
    hint: 'Certificate scope, validity or issuer does not cover this delivery.',
  },
  substitution: {
    label: 'Substitution',
    tone: 'sub',
    icon: Shuffle,
    hint: 'Brand or manufacturer differs from the masterlist.',
  },
  needs_human: {
    label: 'Needs human',
    tone: 'human',
    icon: UserRound,
    hint: 'Label fields could not be read. A supervisor must check.',
  },
};
export const COVERAGE = {
  covered: { label: 'Covered', tone: 'ok' },
  expiring: { label: 'Expiring', tone: 'warn' },
  not_covered: { label: 'Not covered', tone: 'bad' },
};
const STATUS = {
  auto_accepted: { label: 'Auto-accepted', tone: 'ok' },
  pending_review: { label: 'Pending review', tone: 'human' },
  accepted: { label: 'Accepted by supervisor', tone: 'ok' },
  rejected: { label: 'Rejected', tone: 'bad' },
};
export const RULES = {
  R1: { title: 'Required label fields extracted', fail: 'Needs human' },
  R2: {
    title: 'Brand and manufacturer match masterlist (score 90+)',
    fail: 'Substitution',
  },
  R3: { title: 'Certificate scope includes product', fail: 'Not covered' },
  R4: { title: 'Certificate not expired', fail: 'Not covered' },
  R5: { title: 'Issuer on recognised list', fail: 'Not covered' },
};
function Pill({ tone, children, className, testId }) {
  return (
    <span
      data-testid={testId}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap',
        toneCls[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
export function VerdictBadge({ verdict, size = 'sm' }) {
  const v = VERDICT[verdict];
  const I = v.icon;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span>
          <Pill
            tone={v.tone}
            testId={`status-verdict-${verdict}`}
            className={size === 'lg' ? 'text-base px-4 py-1.5' : ''}
          >
            <I className={size === 'lg' ? 'h-5 w-5' : 'h-3.5 w-3.5'} />
            {v.label}
          </Pill>
        </span>
      </TooltipTrigger>
      <TooltipContent>{v.hint}</TooltipContent>
    </Tooltip>
  );
}
export function CoverageBadge({ coverage }) {
  const c = COVERAGE[coverage];
  return (
    <Pill tone={c.tone} testId={`status-coverage-${coverage}`}>
      <span className={cn('h-1.5 w-1.5 rounded-full', toneBar[c.tone])} />
      {c.label}
    </Pill>
  );
}
export function StatusBadge({ status }) {
  const s = STATUS[status];
  return (
    <Pill
      tone={s.tone}
      className="font-mono text-[11px] uppercase tracking-wide rounded-md"
    >
      {s.label}
    </Pill>
  );
}
export function Checklist({ results }) {
  if (!results.length)
    return <p className="text-sm text-muted-foreground">No rules evaluated.</p>;
  return (
    <ol className="divide-y rounded-lg border bg-card">
      {results.map((r) => (
        <li
          key={r.rule}
          data-testid={`rule-${r.rule}`}
          className="flex gap-3 p-3"
        >
          <span
            className={cn(
              'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-white',
              r.passed ? toneBar.ok : toneBar.bad,
            )}
          >
            {r.passed ? (
              <Check className="h-4 w-4" />
            ) : (
              <X className="h-4 w-4" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-mono text-xs font-semibold text-muted-foreground">
                {r.rule}
              </span>
              <span className="text-sm font-semibold">
                {RULES[r.rule]?.title ?? r.rule}
              </span>
              {!r.passed && (
                <span className="text-xs text-[hsl(var(--bad))]">
                  fail: {RULES[r.rule]?.fail}
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{r.detail}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
export function Extracted({ ex, error }) {
  if (!ex)
    return (
      <div className="flex gap-2 rounded-lg border border-[hsl(var(--human)/0.4)] bg-[hsl(var(--human)/0.08)] p-3 text-sm">
        <AlertTriangle className="h-4 w-4 shrink-0 text-[hsl(var(--human))]" />
        <span>
          {error ??
            'Label extraction failed. A supervisor must read the label manually.'}
        </span>
      </div>
    );
  const rows = [
    ['Product', ex.product_name],
    ['Brand', ex.brand],
    ['Manufacturer', ex.manufacturer],
    [
      'Halal mark on label',
      ex.halal_mark_present === null
        ? null
        : ex.halal_mark_present
          ? 'Present'
          : 'Absent',
    ],
  ];
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border">
      {rows.map(([k, v]) => (
        <div key={k} className="bg-card p-2.5">
          <dt className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {k}
          </dt>
          <dd
            className={cn(
              'text-sm font-medium',
              !v && 'italic text-muted-foreground',
            )}
          >
            {v ?? 'not read'}
          </dd>
        </div>
      ))}
    </dl>
  );
}
export function errText(e) {
  if (e instanceof ApiError) {
    if (e.status === 403) return `Not permitted for your role. ${e.message}`;
    if (e.status === 422) return `Missing information. ${e.message}`;
    return e.message;
  }
  return e instanceof Error ? e.message : 'Something went wrong';
}
export function fmtDate(s) {
  const d = new Date(s);
  return isNaN(+d)
    ? s
    : d.toLocaleDateString('en-MY', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
}
export function fmtTime(s) {
  const d = new Date(s);
  return isNaN(+d)
    ? s
    : d.toLocaleString('en-MY', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
}
export function PageHead({ kicker, title, sub, right }) {
  return (
    <div className="rise mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          {kicker}
        </p>
        <h1 className="font-display text-3xl font-extrabold md:text-4xl">
          {title}
        </h1>
        {sub && (
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{sub}</p>
        )}
      </div>
      {right}
    </div>
  );
}
export function EmptyState({ icon: I, title, body }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed bg-card/60 px-6 py-12 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
        <I className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="font-display text-lg font-bold">{title}</p>
      <p className="max-w-sm text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
