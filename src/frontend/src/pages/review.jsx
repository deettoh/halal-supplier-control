import { useState } from 'react';
import { CheckCircle2, Inbox, Loader2, XCircle } from 'lucide-react';
import { useDecideDelivery, useDeliveries } from '@/lib/api';
import {
  EmptyState,
  PageHead,
  StatusBadge,
  VerdictBadge,
  errText,
  fmtTime,
} from '@/components/status';
import { DeliveryDetail } from '@/components/delivery-detail';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
export default function Review() {
  const pending = useDeliveries('pending_review');
  const all = useDeliveries();
  const decide = useDecideDelivery();
  const { toast } = useToast();
  const [sel, setSel] = useState(null);
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const queue = pending.data ?? [];
  const history = (all.data ?? [])
    .filter((d) => d.status !== 'pending_review')
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  const current =
    [...queue, ...history].find((d) => d.id === sel) ?? queue[0] ?? null;
  const act = (decision) => {
    setTouched(true);
    if (!current || !reason.trim()) return;
    decide.mutate(
      { id: current.id, decision, reason: reason.trim() },
      {
        onSuccess: () => {
          toast({
            title:
              decision === 'accept'
                ? 'Accepted and recorded'
                : 'Rejected and recorded',
            description: `${current.material_name}. Logged to the activity trail.`,
          });
          setReason('');
          setTouched(false);
          setSel(null);
        },
        onError: (e) =>
          toast({
            variant: 'destructive',
            title: 'Decision not recorded',
            description: errText(e),
          }),
      },
    );
  };
  const List = ({ items, empty }) =>
    items.length === 0 ? (
      <>{empty}</>
    ) : (
      <ul className="space-y-2">
        {items.map((d) => (
          <li key={d.id}>
            <button
              data-testid={`row-review-${d.id}`}
              onClick={() => {
                setSel(d.id);
                setReason('');
                setTouched(false);
              }}
              className={cn(
                'w-full rounded-xl border bg-card p-3 text-left transition hover:-translate-y-0.5',
                current?.id === d.id && 'ring-2 ring-primary',
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">{d.material_name}</span>
                <VerdictBadge verdict={d.verdict} />
              </div>
              <div className="mt-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>{d.created_by}</span>
                <span className="font-mono">{fmtTime(d.created_at)}</span>
              </div>
              {d.status !== 'pending_review' && (
                <div className="mt-2">
                  <StatusBadge status={d.status} />
                </div>
              )}
            </button>
          </li>
        ))}
      </ul>
    );
  return (
    <div>
      <PageHead
        kicker="Halal Supervisor"
        title="Review queue"
        sub="Flagged deliveries wait here. Your call is recorded with a reason for the auditor."
      />
      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <Tabs defaultValue="queue">
          <TabsList className="mb-3 w-full">
            <TabsTrigger
              value="queue"
              className="flex-1"
              data-testid="tab-queue"
            >
              Pending ({queue.length})
            </TabsTrigger>
            <TabsTrigger
              value="history"
              className="flex-1"
              data-testid="tab-history"
            >
              Decided
            </TabsTrigger>
          </TabsList>
          <TabsContent value="queue">
            {pending.isLoading ? (
              <div className="space-y-2">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-20" />
                ))}
              </div>
            ) : pending.error ? (
              <p className="text-sm text-destructive">
                {errText(pending.error)}
              </p>
            ) : (
              <List
                items={queue}
                empty={
                  <EmptyState
                    icon={CheckCircle2}
                    title="Queue is clear"
                    body="Nothing is waiting for your decision. Flagged deliveries appear here."
                  />
                }
              />
            )}
          </TabsContent>
          <TabsContent value="history">
            {all.isLoading ? (
              <Skeleton className="h-40" />
            ) : (
              <List
                items={history}
                empty={
                  <EmptyState
                    icon={Inbox}
                    title="No history yet"
                    body="Decided and auto-accepted deliveries will be listed here."
                  />
                }
              />
            )}
          </TabsContent>
        </Tabs>

        <section className="rounded-2xl border bg-card p-5">
          {pending.isLoading ? (
            <Skeleton className="h-96" />
          ) : !current ? (
            <EmptyState
              icon={Inbox}
              title="Select a delivery"
              body="Pick an item on the left to see its photo, extracted fields and checklist."
            />
          ) : (
            <div className="space-y-5">
              <DeliveryDetail d={current} />
              {current.status === 'pending_review' && (
                <div className="space-y-3 rounded-xl border-2 border-primary/20 bg-secondary/40 p-4">
                  <label className="text-sm font-semibold" htmlFor="reason">
                    Reason for decision{' '}
                    <span className="text-destructive">*</span>
                  </label>
                  <Textarea
                    id="reason"
                    data-testid="input-reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="e.g. Called supplier; substitute brand covered under cert SHCB-2025-00412, copy filed."
                  />
                  {touched && !reason.trim() && (
                    <p className="text-xs text-destructive">
                      A reason is required for the audit record.
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      data-testid="button-accept"
                      disabled={decide.isPending}
                      onClick={() => act('accept')}
                      className="bg-[hsl(var(--ok))] text-white hover:bg-[hsl(var(--ok))]"
                    >
                      {decide.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                      )}
                      Accept delivery
                    </Button>
                    <Button
                      data-testid="button-reject"
                      variant="destructive"
                      disabled={decide.isPending}
                      onClick={() => act('reject')}
                    >
                      <XCircle className="mr-2 h-4 w-4" />
                      Reject delivery
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
