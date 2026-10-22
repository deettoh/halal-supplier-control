import { useMemo, useRef, useState } from 'react';
import {
  Camera,
  ImagePlus,
  Loader2,
  PackageCheck,
  ScanLine,
  Wand2,
} from 'lucide-react';
import {
  API_MODE,
  DEMO_LABELS,
  useCreateDelivery,
  useDeliveries,
  useMaterials,
} from '@/lib/api';
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
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
function placeholderFile(text) {
  const c = document.createElement('canvas');
  c.width = 480;
  c.height = 480;
  const g = c.getContext('2d');
  g.fillStyle = '#f3ede1';
  g.fillRect(0, 0, 480, 480);
  g.strokeStyle = '#1b2650';
  g.lineWidth = 6;
  g.strokeRect(24, 24, 432, 432);
  g.fillStyle = '#1b2650';
  g.font = 'bold 30px sans-serif';
  g.textAlign = 'center';
  g.fillText('PLACEHOLDER LABEL', 240, 200);
  g.font = '22px sans-serif';
  g.fillText(text.slice(0, 32), 240, 250);
  g.font = '16px monospace';
  g.fillText(new Date().toISOString().slice(0, 19), 240, 300);
  return new Promise((res) =>
    c.toBlob(
      (b) => res(new File([b], 'placeholder-label.png', { type: 'image/png' })),
      'image/png',
    ),
  );
}
export default function Check() {
  const materials = useMaterials();
  const deliveries = useDeliveries();
  const create = useCreateDelivery();
  const { toast } = useToast();
  const [materialId, setMaterialId] = useState('');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [labelId, setLabelId] = useState('');
  const [anyLabel, setAnyLabel] = useState(false);
  const [result, setResult] = useState(null);
  const inputRef = useRef(null);
  const labels = useMemo(
    () =>
      anyLabel
        ? DEMO_LABELS
        : DEMO_LABELS.filter((l) => String(l.material_id) === materialId),
    [anyLabel, materialId],
  );
  const material = materials.data?.find((m) => String(m.id) === materialId);
  const setImg = (f) => {
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };
  const submit = () => {
    if (!materialId || !file) return;
    create.mutate(
      {
        material_id: materialId,
        image: file,
        demo_label_id: API_MODE === 'demo' && labelId ? labelId : undefined,
      },
      {
        onSuccess: (d) => {
          setResult(d);
          toast({
            title:
              d.status === 'auto_accepted'
                ? 'Delivery auto-accepted'
                : 'Sent to Halal Supervisor',
            description: `${d.material_name}: ${d.status === 'auto_accepted' ? 'documents on file cover it.' : 'flagged for a recorded decision.'}`,
          });
          setFile(null);
          setPreview(null);
          setLabelId('');
        },
        onError: (e) =>
          toast({
            variant: 'destructive',
            title: 'Check failed',
            description: errText(e),
          }),
      },
    );
  };
  return (
    <div>
      <PageHead
        kicker="Receiving door"
        title="Check a delivery"
        sub="Pick the material, photograph the label, submit. Rules decide; anything flagged goes to your Halal Supervisor."
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_1fr]">
        <section className="rise space-y-5 rounded-2xl border bg-card p-5 shadow-sm">
          <div className="space-y-1.5">
            <Label className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[11px] text-primary-foreground">
                1
              </span>
              Material
            </Label>
            {materials.isLoading ? (
              <Skeleton className="h-10" />
            ) : (
              <Select
                value={materialId}
                onValueChange={(v) => {
                  setMaterialId(v);
                  setLabelId('');
                }}
              >
                <SelectTrigger data-testid="select-material" className="h-11">
                  <SelectValue placeholder="Choose from masterlist" />
                </SelectTrigger>
                <SelectContent>
                  {materials.data?.map((m) => (
                    <SelectItem key={m.id} value={String(m.id)}>
                      {m.name} · {m.brand}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {material && (
              <p className="text-xs text-muted-foreground">
                Expect {material.brand} from {material.manufacturer}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[11px] text-primary-foreground">
                2
              </span>
              Label photo
            </Label>
            <input
              ref={inputRef}
              data-testid="input-photo"
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && setImg(e.target.files[0])}
            />
            <button
              type="button"
              data-testid="button-photo"
              onClick={() => inputRef.current?.click()}
              className="group flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-xl border-2 border-dashed bg-secondary/50 transition hover:border-primary"
            >
              {preview ? (
                <img
                  src={preview}
                  alt="Label preview"
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
                  <Camera className="h-8 w-8 transition group-hover:scale-110" />
                  Take or upload photo
                </span>
              )}
            </button>
            <div className="flex gap-2">
              {preview && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => inputRef.current?.click()}
                >
                  <ImagePlus className="mr-1.5 h-4 w-4" />
                  Retake
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                data-testid="button-placeholder"
                onClick={async () =>
                  setImg(await placeholderFile(material?.name ?? 'Delivery'))
                }
              >
                <Wand2 className="mr-1.5 h-4 w-4" />
                No photo handy? Use placeholder
              </Button>
            </div>
          </div>

          {API_MODE === 'demo' && (
            <div className="space-y-2 rounded-xl border border-dashed border-accent bg-accent/10 p-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs">
                  Demo label (stands in for the vision model)
                </Label>
                <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  Any{' '}
                  <Switch
                    data-testid="switch-any-label"
                    checked={anyLabel}
                    onCheckedChange={setAnyLabel}
                  />
                </label>
              </div>
              <Select value={labelId} onValueChange={setLabelId}>
                <SelectTrigger data-testid="select-demo-label">
                  <SelectValue
                    placeholder={
                      labels.length
                        ? 'Choose a demo label'
                        : 'No demo label for this material'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {labels.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.title} · {l.description}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <Button
            data-testid="button-submit-check"
            disabled={!materialId || !file || create.isPending}
            onClick={submit}
            className="h-12 w-full text-base"
          >
            {create.isPending ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Reading label and running rules
              </>
            ) : (
              <>
                <ScanLine className="mr-2 h-5 w-5" />
                Run check
              </>
            )}
          </Button>
        </section>

        <section
          className="rise rounded-2xl border bg-card p-5"
          style={{ animationDelay: '80ms' }}
        >
          {create.isPending ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-48" />
              <Skeleton className="h-6 w-64" />
              <Skeleton className="h-32" />
              <Skeleton className="h-48" />
            </div>
          ) : result ? (
            <DeliveryDetail d={result} />
          ) : (
            <EmptyState
              icon={PackageCheck}
              title="Result appears here"
              body="Verdict, the five rule checks and what was read from the label. You never accept or reject here; flagged items go to the supervisor."
            />
          )}
        </section>
      </div>

      <h2 className="mb-3 mt-10 font-display text-xl font-bold">
        Recent deliveries
      </h2>
      {deliveries.isLoading ? (
        <Skeleton className="h-32" />
      ) : !deliveries.data?.length ? (
        <EmptyState
          icon={ScanLine}
          title="No deliveries checked yet"
          body="Your first check today will show up here."
        />
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {[...deliveries.data]
            .sort((a, b) => b.created_at.localeCompare(a.created_at))
            .slice(0, 12)
            .map((d) => (
              <li key={d.id} data-testid={`row-delivery-${d.id}`}>
                <button
                  onClick={() => setResult(d)}
                  className="flex w-full flex-wrap items-center gap-3 p-3 text-left hover:bg-secondary/40"
                >
                  <span className="min-w-[160px] flex-1 font-semibold">
                    {d.material_name}
                  </span>
                  <VerdictBadge verdict={d.verdict} />
                  <StatusBadge status={d.status} />
                  <span className="font-mono text-xs text-muted-foreground">
                    {fmtTime(d.created_at)}
                  </span>
                </button>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
