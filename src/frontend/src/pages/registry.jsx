import React, { useState, useRef, useEffect } from "react";
import { RefreshCw, Check, ArrowRight, X } from "lucide-react";
import { useSession, useDraft } from "../lib/session.jsx";
import { useRecord, useScopedMutation } from "../lib/api/hooks.js";
import { RequestState, ErrorMessage } from "../components/request-state.jsx";
import { RenewalComparison } from "../components/renewal-comparison.jsx";
import { Status } from "../components/status.jsx";
function ReviewForm({ item, onDecision, pending, error, blocked }) {
  const [note, setNote] = useState("");
  const errorRef = useRef();
  useDraft(!!note || pending);
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);
  function submit(decision) {
    if (note.trim() && !pending && !blocked)
      onDecision({ id: item.renewal.id, decision, note: note.trim() });
  }
  return (
    <section className="registry-decision">
      <h2>Record your review</h2>
      <p>Both verification and rejection need a note for the shared record.</p>
      <div className="field">
        <label htmlFor="registry-note">Review note (required)</label>
        <textarea
          id="registry-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={4}
          disabled={pending || blocked}
          placeholder="Explain what you checked and why."
        />
      </div>
      <div className="registry-decision-actions">
        <button
          type="button"
          className="button primary"
          disabled={!note.trim() || pending || blocked}
          onClick={() => submit("verify")}
        >
          <Check size={18} aria-hidden="true" />
          {pending ? "Recording review…" : "Verify renewal"}
        </button>
        <button
          type="button"
          className="button quiet"
          disabled={!note.trim() || pending || blocked}
          onClick={() => submit("reject")}
        >
          <X size={18} aria-hidden="true" />
          Reject renewal
        </button>
      </div>
      {blocked && (
        <p className="request-error">
          This renewal has already been reviewed. Refresh the queue.
        </p>
      )}
      <div ref={errorRef} tabIndex={-1}>
        {error && <ErrorMessage error={error} />}
      </div>
      <p className="capability-note">
        A registry review updates the shared record. It is not an independent
        certificate-authenticity decision.
      </p>
    </section>
  );
}
export default function Registry() {
  const session = useSession(),
    query = useRecord("listRenewals");
  const [selectedId, setSelectedId] = useState(null),
    [receipt, setReceipt] = useState(null),
    [blocked, setBlocked] = useState(false),
    [conflict, setConflict] = useState(null);
  const rows = query.data || [],
    selected =
      conflict || rows.find((r) => r.renewal.id === selectedId) || rows[0];
  const receiptRef = useRef();
  const mutation = useScopedMutation(
    (ctx, input) =>
      session.gateway.decideRenewal(ctx, input.id, {
        decision: input.decision,
        note: input.note,
      }),
    {
      onSuccess: (value) => {
        setReceipt(value);
        setSelectedId(null);
        setBlocked(false);
        setConflict(null);
      },
      onError: (error) => {
        if ([404, 409].includes(error.status)) {
          setConflict(selected);
          setBlocked(true);
          query.refetch();
        }
      },
    },
  );
  const expiry = useScopedMutation((ctx) =>
    session.gateway.runExpiryCheck(ctx),
  );
  useEffect(() => {
    if (receipt) receiptRef.current?.focus();
  }, [receipt]);
  function refresh() {
    if (!session.confirmDiscard()) return;
    setBlocked(false);
    setConflict(null);
    setReceipt(null);
    mutation.reset();
    query.refetch();
  }
  return (
    <div className="page registry-page">
      <div className="registry-page-heading">
        <div>
          <h1>Review renewals</h1>
          <p>One careful review. A current record for every linked buyer.</p>
        </div>
        <button
          type="button"
          className="button quiet"
          disabled={mutation.isPending}
          onClick={refresh}
        >
          <RefreshCw size={17} aria-hidden="true" />
          Refresh queue
        </button>
      </div>
      <div className="registry-workbench">
        <aside className="registry-queue">
          <h2>
            Waiting for review <span>{rows.length}</span>
          </h2>
          <RequestState query={query} noun="renewals">
            {!rows.length && (
              <p className="registry-empty">
                No renewals are waiting for review.
              </p>
            )}
            <ul>
              {rows.map((row) => (
                <li key={row.renewal.id}>
                  <button
                    type="button"
                    className={
                      selected?.renewal.id === row.renewal.id ? "selected" : ""
                    }
                    disabled={mutation.isPending}
                    onClick={() => {
                      if (session.confirmDiscard()) {
                        setSelectedId(row.renewal.id);
                        setConflict(null);
                        setReceipt(null);
                        setBlocked(false);
                        mutation.reset();
                      }
                    }}
                  >
                    <strong>{row.supplier_name}</strong>
                    <span>{row.renewal.cert_no}</span>
                    <small>Pending registry review</small>
                    <ArrowRight size={15} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          </RequestState>
          <section className="expiry-check">
            <h2>Keep records current</h2>
            <p>Check which active certificates need a renewal request.</p>
            <button
              type="button"
              className="button quiet"
              disabled={
                !session.gateway.capabilities?.expiry || expiry.isPending
              }
              onClick={() => expiry.mutate()}
            >
              {expiry.isPending ? "Checking expiry…" : "Run expiry check"}
            </button>
            {!session.gateway.capabilities?.expiry && (
              <p className="capability-note">
                Expiry checks are not available from the connected backend yet.
              </p>
            )}
            {expiry.data && (
              <p role="status">
                {expiry.data.requests_created} renewal{" "}
                {expiry.data.requests_created === 1 ? "request" : "requests"}{" "}
                recorded. {expiry.data.certificates_checked} certificates
                checked.
              </p>
            )}
            {expiry.error && <ErrorMessage error={expiry.error} />}
            <p className="capability-note">
              Records requests only. No email or message is sent.
            </p>
          </section>
        </aside>
        <div className="registry-evidence">
          {receipt && (
            <section className="registry-receipt" role="status">
              <h2 ref={receiptRef} tabIndex={-1}>
                {receipt.status === "active"
                  ? "Renewal verified"
                  : "Renewal rejected"}
              </h2>
              <p>{receipt.cert_no}</p>
              <Status value={receipt.status} />
              <p>{receipt.review_note}</p>
              <p className="muted">Reviewed by {receipt.reviewed_by}.</p>
              <p>
                {receipt.status === "active"
                  ? "The new record is active. Linked buyers use it when they refresh."
                  : "The existing active certificate remains in place."}
              </p>
            </section>
          )}
          {selected ? (
            <>
              <div className="registry-supplier">
                <h2>{selected.supplier_name}</h2>
                <Status value="pending" />
              </div>
              <RenewalComparison
                current={selected.current}
                renewal={selected.renewal}
              />
              <ReviewForm
                key={selected.renewal.id}
                item={selected}
                onDecision={mutation.mutate}
                pending={mutation.isPending}
                error={mutation.error}
                blocked={blocked}
              />
            </>
          ) : (
            !receipt &&
            !query.isLoading &&
            !query.error && (
              <div className="registry-clear">
                <Check size={32} aria-hidden="true" />
                <h2>The registry queue is clear</h2>
                <p>
                  Supplier submissions will appear here. Current records stay in
                  place while renewals wait for review.
                </p>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
