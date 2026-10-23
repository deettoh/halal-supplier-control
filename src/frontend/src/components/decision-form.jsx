import React, { useId, useState } from "react";
import { Info } from "lucide-react";
import { useDraft } from "../lib/session.jsx";
import { ErrorMessage } from "./request-state.jsx";
export function DecisionForm({
  delivery,
  onDecision,
  pending = false,
  error,
  blocked = false,
}) {
  const [decision, setDecision] = useState("");
  const [reason, setReason] = useState("");
  const id = useId();
  const resolved = delivery.status !== "pending_review";
  useDraft(!resolved && (!!decision || !!reason));
  const disabled = pending || blocked || !decision || !reason.trim();
  if (delivery.status === "auto_accepted")
    return (
      <section className="decision-panel">
        <h2>Automatically accepted.</h2>
        <p>The recorded checks did not require a supervisor decision.</p>
        <p className="muted">
          The original coverage result remains on the delivery record.
        </p>
      </section>
    );
  function submit(event) {
    event.preventDefault();
    if (!disabled) onDecision({ decision, reason: reason.trim() });
  }
  return (
    <section className="decision-panel" aria-labelledby={id + "heading"}>
      <h2 id={id + "heading"}>Record a decision</h2>
      {resolved ? (
        <div className="decision-confirmation" role="status">
          <strong>Decision recorded.</strong>
          <p>
            {delivery.status === "accepted" ? "Accepted" : "Rejected"} by{" "}
            {delivery.decided_by}.
          </p>
          <p>{delivery.reason}</p>
        </div>
      ) : (
        <form onSubmit={submit}>
          <fieldset disabled={pending || blocked}>
            <legend className="sr-only">Decision</legend>
            {["accept", "reject"].map((value) => (
              <label className="decision-option" key={value}>
                <input
                  type="radio"
                  aria-label={
                    value === "accept" ? "Accept delivery" : "Reject delivery"
                  }
                  name={id + "decision"}
                  value={value}
                  checked={decision === value}
                  onChange={() => setDecision(value)}
                />
                <span>
                  <strong>
                    {value === "accept" ? "Accept delivery" : "Reject delivery"}
                  </strong>
                  <small>
                    Record {value === "accept" ? "acceptance" : "rejection"}{" "}
                    with a reason.
                  </small>
                </span>
              </label>
            ))}
          </fieldset>
          <div className="decision-reason">
            <label htmlFor={id + "reason"}>Reason (required)</label>
            <textarea
              id={id + "reason"}
              required
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={pending || blocked}
              placeholder="Explain your decision."
            />
          </div>
          <div className="decision-action">
            <button className="button primary" disabled={disabled}>
              {pending ? "Recording decision…" : "Record decision"}
            </button>
            <p className="decision-hint">
              <Info size={20} aria-hidden="true" />
              {blocked
                ? "Refresh the queue before deciding."
                : "Choose a decision and enter a reason."}
            </p>
            <p className="coverage-disclosure">
              Document coverage only.
              <br />
              No certification or authenticity ruling.
            </p>
          </div>
        </form>
      )}
      {error && <ErrorMessage error={error} />}
    </section>
  );
}
