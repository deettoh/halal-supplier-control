import { Link, useLocation } from 'wouter';
import {
  ClipboardList,
  ScanLine,
  Inbox,
  History,
  FileBadge,
  ChevronDown,
  RotateCcw,
  ChevronRight,
  Building2,
} from 'lucide-react';
import {
  API_MODE,
  PERSONAS,
  ROLE_LABELS,
  useDeliveries,
  useResetDemo,
  useSession,
} from '@/lib/api';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { errText } from '@/components/status';
import { cn } from '@/lib/utils';
export const NAV = [
  { href: '/check', label: 'Delivery check', icon: ScanLine, roles: ['staff'] },
  {
    href: '/review',
    label: 'Review queue',
    icon: Inbox,
    roles: ['supervisor'],
  },
  {
    href: '/masterlist',
    label: 'Masterlist',
    icon: ClipboardList,
    roles: ['staff', 'supervisor'],
  },
  {
    href: '/activity',
    label: 'Activity log',
    icon: History,
    roles: ['supervisor'],
  },
  {
    href: '/certificates',
    label: 'Certificates',
    icon: FileBadge,
    roles: ['supplier'],
  },
];
export const HOME = {
  staff: '/check',
  supervisor: '/review',
  supplier: '/certificates',
};
function initials(s) {
  return s
    .split(/\s+/)
    .filter((w) => /^[A-Z]/.test(w))
    .slice(0, 2)
    .map((w) => w[0])
    .join('');
}
export function Shell({ children }) {
  const { session, actorName, orgName, setSession } = useSession();
  const [loc, navigate] = useLocation();
  const reset = useResetDemo();
  const { toast } = useToast();
  const pending = useDeliveries('pending_review');
  const pendingCount =
    session.role === 'supervisor' ? (pending.data?.length ?? 0) : 0;
  const nav = NAV.filter((n) => n.roles.includes(session.role));
  const groups = Array.from(new Set(PERSONAS.map((p) => p.org)));
  return (
    <div className="min-h-[100dvh]">
      <header className="sticky top-0 z-30 bg-sidebar text-sidebar-foreground shadow-[0_1px_0_hsl(var(--sidebar-border))]">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-2.5">
          <div className="flex items-center gap-2 text-sm">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-sidebar-primary font-display text-sm font-extrabold text-sidebar-primary-foreground">
              O
            </span>
            <span className="opacity-70">Orbyte</span>
            <ChevronRight className="h-3.5 w-3.5 opacity-50" />
            <span className="font-display font-bold tracking-tight">
              Halal Supplier Control
            </span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {API_MODE === 'demo' && (
              <DropdownMenu>
                <DropdownMenuTrigger
                  data-testid="button-demo-menu"
                  className="rounded-full border border-sidebar-primary/50 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-sidebar-primary hover:bg-sidebar-accent"
                >
                  Demo data
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                    Synthetic data. Fictional SAMPLE certification board.
                  </DropdownMenuLabel>
                  <DropdownMenuItem
                    data-testid="button-reset-demo"
                    onClick={() =>
                      reset.mutate(undefined, {
                        onSuccess: () =>
                          toast({
                            title: 'Demo reset',
                            description:
                              'All deliveries, decisions and renewals cleared.',
                          }),
                        onError: (e) =>
                          toast({
                            variant: 'destructive',
                            title: 'Reset failed',
                            description: errText(e),
                          }),
                      })
                    }
                  >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Reset demo
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger
                data-testid="button-persona"
                className="flex items-center gap-2 rounded-lg bg-sidebar-accent px-2 py-1 text-left hover:brightness-110"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-sidebar-foreground/15 text-[11px] font-bold">
                  {initials(actorName) || 'U'}
                </span>
                <span className="hidden leading-tight sm:block">
                  <span
                    className="block text-xs font-semibold"
                    data-testid="text-org"
                  >
                    {orgName}
                  </span>
                  <span
                    className="block text-[11px] opacity-70"
                    data-testid="text-role"
                  >
                    {ROLE_LABELS[session.role]} ·{' '}
                    {actorName.replace(/\s*\(.*\)/, '')}
                  </span>
                </span>
                <ChevronDown className="h-4 w-4 opacity-60" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                {groups.map((g, gi) => (
                  <div key={g}>
                    {gi > 0 && <DropdownMenuSeparator />}
                    <DropdownMenuLabel className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Building2 className="h-3.5 w-3.5" />
                      {g}
                    </DropdownMenuLabel>
                    {PERSONAS.filter((p) => p.org === g).map((p) => {
                      const active =
                        p.session.role === session.role &&
                        p.session.tenant === session.tenant;
                      return (
                        <DropdownMenuItem
                          key={p.session.role + p.session.tenant}
                          data-testid={`persona-${p.session.tenant}-${p.session.role}`}
                          onClick={() => {
                            setSession(p.session);
                            navigate(HOME[p.session.role]);
                          }}
                          className={cn(active && 'bg-secondary font-semibold')}
                        >
                          {p.label}
                          {active && (
                            <span className="ml-auto font-mono text-[10px] text-muted-foreground">
                              current
                            </span>
                          )}
                        </DropdownMenuItem>
                      );
                    })}
                  </div>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4">
          {nav.map((n) => {
            const active = loc === n.href;
            const I = n.icon;
            return (
              <Link
                key={n.href}
                href={n.href}
                data-testid={`link-${n.href.slice(1)}`}
                className={cn(
                  'relative flex items-center gap-2 whitespace-nowrap px-3 py-2.5 text-sm transition-colors',
                  active
                    ? 'text-sidebar-foreground'
                    : 'text-sidebar-foreground/60 hover:text-sidebar-foreground',
                )}
              >
                <I className="h-4 w-4" />
                {n.label}
                {n.href === '/review' && pendingCount > 0 && (
                  <span className="rounded-full bg-sidebar-primary px-1.5 font-mono text-[10px] font-bold text-sidebar-primary-foreground">
                    {pendingCount}
                  </span>
                )}
                <span
                  className={cn(
                    'absolute inset-x-2 bottom-0 h-[3px] rounded-t bg-sidebar-primary transition-transform origin-left',
                    active ? 'scale-x-100' : 'scale-x-0',
                  )}
                />
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8">{children}</main>
      <footer className="mx-auto max-w-7xl px-4 pb-8 text-xs text-muted-foreground">
        This module records whether documents on file cover a delivery. It does
        not certify any product. All organisations and certificates shown are
        fictional SAMPLE data.
      </footer>
    </div>
  );
}
