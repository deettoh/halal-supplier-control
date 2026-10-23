import React, { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronRight, ArrowLeft } from "lucide-react";
import { useSession } from "../lib/session.jsx";
import { useRecord, useScopedMutation } from "../lib/api/hooks.js";
import { Status } from "../components/status.jsx";
import { RequestState, ErrorMessage } from "../components/request-state.jsx";
import { DeliveryEvidence } from "../components/delivery-evidence.jsx";
import { DecisionForm } from "../components/decision-form.jsx";
export default function Review() {
  const session = useSession();
  const client = useQueryClient();
  const pending = useRecord("listPending");
  const materials = useRecord("listMaterials");
  const history = useRecord("listHistory", {
    enabled: session.gateway.mode === "preview",
  });
  const [selectedId, setSelectedId] = useState(null);
  const [saved, setSaved] = useState(null);
  const [blocked, setBlocked] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const queue = pending.data || [];
  const id = selectedId ?? queue[0]?.id;
  const selected = saved?.id === id ? saved : queue.find((d) => d.id === id);
  const mutation = useScopedMutation(
    (ctx, input) => session.gateway.decide(ctx, id, input),
    {
      onSuccess: (value) => {
        setSelectedId(value.id);
        setSaved(value);
      },
      onError: (error) => {
        if (error.status === 409 || error.status === 404) {
          setSelectedId(id);
          setBlocked(id);
          client.invalidateQueries({
            queryKey: [...session.key, "listPending"],
          });
        }
      },
    },
  );
  const material = (materials.data || []).find(
    (m) => m.id === selected?.material_id,
  );
  function choose(delivery) {
    if (mutation.isPending) return;
    if (!session.confirmDiscard()) return;
    setSelectedId(delivery.id);
    setSaved(null);
    mutation.reset();
    setBlocked(null);
    setShowDetail(true);
  }
  return (
    <div className={"review-layout " + (showDetail ? "show-detail" : "")}>
      <aside className="delivery-queue" aria-label="Delivery queue">
        <h1 className="mobile-title">Review deliveries</h1>
        <h2>Pending deliveries ({queue.length})</h2>
        {mutation.isPending && (
          <p className="muted" role="status">
            Saving the current decision. You can open another delivery when it
            finishes.
          </p>
        )}
        <RequestState query={pending} noun="deliveries">
          {queue.length === 0 && (
            <p className="muted">
              No deliveries waiting for review. New flagged deliveries will
              appear here.
            </p>
          )}
          <ul>
            {queue.map((d) => (
              <li key={d.id}>
                <button
                  type="button"
                  disabled={mutation.isPending}
                  className={"queue-item " + (d.id === id ? "selected" : "")}
                  aria-current={d.id === id ? "true" : undefined}
                  onClick={() => choose(d)}
                >
                  <span className="queue-top">
                    <span>#{d.id}</span>
                    <Status value={d.status} />
                  </span>
                  <strong>
                    {(materials.data || []).find((m) => m.id === d.material_id)
                      ?.name || "Delivery #" + d.id}
                  </strong>
                  <span className="queue-detail">
                    {d.verdict === "substitution"
                      ? "Identity differs"
                      : d.verdict === "needs_human"
                        ? "Reading incomplete"
                        : "Coverage needs review"}
                    <ChevronRight size={17} aria-hidden="true" />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </RequestState>
        <section className="queue-history">
          <h2>Decided deliveries</h2>
          {session.gateway.mode === "preview" ? (
            <RequestState query={history} noun="prepared history">
              {history.data?.length ? (
                <ul>
                  {history.data.map((d) => (
                    <li key={d.id}>
                      <button
                        className="queue-item"
                        disabled={mutation.isPending}
                        onClick={() => {
                          if (session.confirmDiscard()) {
                            mutation.reset();
                            setBlocked(null);
                            setSelectedId(d.id);
                            setSaved(d);
                            setShowDetail(true);
                          }
                        }}
                      >
                        #{d.id} <Status value={d.status} />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted">No decided deliveries yet.</p>
              )}
            </RequestState>
          ) : (
            <p className="muted">
              Delivery history is not available from the backend yet.
            </p>
          )}
        </section>
      </aside>
      <section className="review-detail">
        <button
          className="button quiet queue-back"
          onClick={() => {
            if (session.confirmDiscard()) setShowDetail(false);
          }}
        >
          <ArrowLeft size={18} aria-hidden="true" />
          Back to queue
        </button>
        {selected ? (
          <>
            <h1>
              {material?.name || "Delivery"} · Delivery #{selected.id}
            </h1>
            <div className="delivery-summary">
              <div>
                <p>Original coverage result</p>
                <Status value={selected.verdict} />
              </div>
              <div>
                <p>Current delivery status</p>
                <Status value={selected.status} />
                <p className="muted verdict-detail">
                  {selected.verdict === "substitution"
                    ? "Brand or manufacturer differs."
                    : selected.verdict === "needs_human"
                      ? "Reading incomplete. Supervisor review is required."
                      : selected.rule_results.find((r) => r.passed === false)
                          ?.detail}
                </p>
              </div>
              <div className="supplier-summary">
                <p>Supplier</p>
                <strong>
                  {material?.supplier_name || "Approved record unavailable"}
                </strong>
              </div>
            </div>
            {selected.error && (
              <p className="request-error">{selected.error}</p>
            )}
            <DeliveryEvidence material={material} delivery={selected} />
          </>
        ) : (
          <div className="empty-workbench">
            <h1>Review deliveries</h1>
            <ErrorMessage error={mutation.error} />
            <p>
              {id
                ? "This delivery is no longer in the pending queue."
                : "Select a delivery to inspect its photo and document checks."}
            </p>
            <button
              className="button quiet"
              onClick={() => {
                setSelectedId(null);
                setSaved(null);
                setBlocked(null);
                mutation.reset();
                pending.refetch();
              }}
            >
              Refresh queue
            </button>
          </div>
        )}
      </section>
      {selected && (
        <DecisionForm
          key={selected.id}
          delivery={selected}
          onDecision={mutation.mutate}
          pending={mutation.isPending}
          error={mutation.error}
          blocked={blocked === selected.id}
        />
      )}
    </div>
  );
}
